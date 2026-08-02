import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getAdminScope } from "@/lib/api-auth";
import { supabaseService } from "@/lib/supabase-admin";
import { hamtaValdaPipelines, lasPipeline, senastSynkad, synkaPipeline, type PipelineRad } from "@/lib/hq/pipeline";

export const runtime = "nodejs";

// HQ-1 — underlaget till /dashboard/hq. ENDAST huvudadmin (owner): sidan visar Håkans
// egna bolagssiffror och hela DT-pipelinen, så en klient-scopad admin får aldrig se den.
// Inga AI-anrop i den här modulen.

async function ownerGrind() {
  const denied = await requireAdmin();
  if (denied) return denied;
  if ((await getAdminScope()) !== null) {
    return NextResponse.json({ error: "Endast huvudadmin har åtkomst" }, { status: 403 });
  }
  return null;
}

// Tid alltid i svensk tidszon: servern kör UTC, annars blir "idag" fel efter klockan 22
// på sommaren och morgonlistan tappar eller släpper in fel rader.
const TZ = "Europe/Stockholm";
const dagIStockholm = (d: Date): string => d.toLocaleDateString("sv-SE", { timeZone: TZ });

/** Måndag till söndag runt dagens datum, som ÅÅÅÅ-MM-DD i svensk tid. */
export function veckansSpann(nu: Date): { start: string; slut: string } {
  const idag = dagIStockholm(nu);
  const veckodag = new Date(`${idag}T12:00:00Z`).getUTCDay(); // 0 = söndag
  const stegTillMandag = veckodag === 0 ? 6 : veckodag - 1;
  const bas = new Date(`${idag}T12:00:00Z`).getTime();
  const start = new Date(bas - stegTillMandag * 864e5).toISOString().slice(0, 10);
  const slut = new Date(bas + (6 - stegTillMandag) * 864e5).toISOString().slice(0, 10);
  return { start, slut };
}

const MRR_MAL_SEK = 50000;
const PIONJAR_MAL = 15;
const GDAM_MAL = 2;

interface MrrRad {
  id: string;
  bolag: string;
  kund: string;
  niva: string;
  belopp_ex_moms: number | string;
  startdatum: string | null;
  status: string;
  notering: string | null;
}

interface FastRad {
  id: string;
  bolag: string;
  tjanst: string;
  belopp_per_man: number | string;
  valuta: string;
  notering: string | null;
}

interface TaskRad {
  id: string;
  titel: string;
  bolag: string;
  datum: string | null;
  klar: boolean;
}

export async function GET(req: NextRequest) {
  const denied = await ownerGrind();
  if (denied) return denied;

  // Synk vid sidladdning, högst var tionde minut. "Uppdatera nu" sätter ?uppdatera=1.
  // Går anropet fel lämnas spegeln orörd och felet följer med ut till vyn.
  const tvinga = req.nextUrl.searchParams.get("uppdatera") === "1";
  const synk = await synkaPipeline(tvinga);

  const sb = supabaseService();
  const [{ data: mrrData }, { data: fastData }, { data: taskData }, allaKort, synkadTid] = await Promise.all([
    sb.from("hq_mrr_entries").select("*").order("bolag").order("kund"),
    sb.from("hq_fasta_kostnader").select("*").order("bolag").order("tjanst"),
    sb.from("hq_tasks").select("*").order("datum", { nullsFirst: false }),
    lasPipeline(),
    senastSynkad(),
  ]);

  // Håkans beslut 2026-08-02: bara den pipeline han faktiskt jobbar i ska räknas.
  // GHL:s standardpipelines ("Sales Pipeline" med flera) bär gamla kort som aldrig varit
  // riktiga affärer. Spegeln lagrar dem fortfarande, men de räknas inte här. Antalet
  // bortsorterade skickas med, så inget försvinner tyst.
  const valda = await hamtaValdaPipelines(allaKort[0]?.location_id || "");
  const pipeline = valda.size ? allaKort.filter((p) => p.pipeline_id && valda.has(p.pipeline_id)) : allaKort;
  const utanfor = allaKort.length - pipeline.length;

  const mrr = ((mrrData as MrrRad[] | null) || []).map((r) => ({ ...r, belopp_ex_moms: Number(r.belopp_ex_moms) || 0 }));
  const fasta = ((fastData as FastRad[] | null) || []).map((r) => ({ ...r, belopp_per_man: Number(r.belopp_per_man) || 0 }));
  const tasks = (taskData as TaskRad[] | null) || [];

  const nu = new Date();
  const idag = dagIStockholm(nu);
  const vecka = veckansSpann(nu);
  const manadStart = `${idag.slice(0, 7)}-01`;

  // ── Morgonlistan ────────────────────────────────────────────────────────
  // Två källor, en lista: affärer vars uppföljning förfaller idag eller är passerad,
  // plus egna uppgifter med samma regel. Avbockade uppgifter är inte kvar.
  const forfallnaKort = pipeline
    .filter((p) => p.uppfoljning_datum && dagIStockholm(new Date(p.uppfoljning_datum)) <= idag)
    .sort((a, b) => String(a.uppfoljning_datum).localeCompare(String(b.uppfoljning_datum)));
  const forfallnaTasks = tasks
    .filter((t) => !t.klar && t.datum && t.datum <= idag)
    .sort((a, b) => String(a.datum).localeCompare(String(b.datum)));

  // ── Grip: MRR-motorn ────────────────────────────────────────────────────
  const gripAktiva = mrr.filter((r) => r.bolag === "grip" && r.status === "aktiv");
  const gripMrr = gripAktiva.reduce((s, r) => s + r.belopp_ex_moms, 0);
  const grip = {
    mrr: gripMrr,
    pionjarer: gripAktiva.filter((r) => r.niva === "pro").length,
    pionjarMal: PIONJAR_MAL,
    gdam: gripAktiva.filter((r) => r.niva === "gdam").length,
    gdamMal: GDAM_MAL,
    mal: MRR_MAL_SEK,
    procent: (gripMrr / MRR_MAL_SEK) * 100,
  };

  // ── Displayteknik: pipelinen ur MySales ─────────────────────────────────
  const oppna = pipeline.filter((p) => p.harledd_status === "open");
  const perSteg = new Map<string, { steg: string; pipeline: string; position: number; antal: number; summa: number }>();
  for (const p of oppna) {
    const nyckel = `${p.pipeline_namn || ""}|${p.steg_namn || "okänt steg"}`;
    const g = perSteg.get(nyckel) || {
      steg: p.steg_namn || "okänt steg",
      pipeline: p.pipeline_namn || "",
      position: p.steg_position ?? 99,
      antal: 0,
      summa: 0,
    };
    g.antal += 1;
    g.summa += p.varde;
    perSteg.set(nyckel, g);
  }
  // Vunnet den här månaden räknas på när affären flyttades till vinststeget: GHL:s
  // status står kvar på "open" även för vunna affärer, så den går inte att använda.
  const vunnetManaden = pipeline.filter(
    (p) => p.harledd_status === "won" && p.steg_sedan && dagIStockholm(new Date(p.steg_sedan)) >= manadStart,
  );
  const dt = {
    summaOppna: oppna.reduce((s, p) => s + p.varde, 0),
    antalOppna: oppna.length,
    perSteg: [...perSteg.values()].sort((a, b) => a.pipeline.localeCompare(b.pipeline) || a.position - b.position),
    vunnetManaden: vunnetManaden.reduce((s, p) => s + p.varde, 0),
    antalVunna: vunnetManaden.length,
    uppfoljningarVeckan: pipeline.filter((p) => {
      if (!p.uppfoljning_datum) return false;
      const d = dagIStockholm(new Date(p.uppfoljning_datum));
      return d >= vecka.start && d <= vecka.slut;
    }).length,
  };

  // ── Kostnader ───────────────────────────────────────────────────────────
  // Valutor blandas (USD och SEK). Vi summerar per valuta och räknar ALDRIG om dem
  // åt Håkan: en påhittad växelkurs gör totalen osann.
  const kostnadPerBolag = ["grip", "dt"].map((bolag) => {
    const rader = fasta.filter((f) => f.bolag === bolag);
    const perValuta = new Map<string, number>();
    for (const r of rader) perValuta.set(r.valuta, (perValuta.get(r.valuta) || 0) + r.belopp_per_man);
    return {
      bolag,
      perValuta: [...perValuta.entries()].map(([valuta, summa]) => ({ valuta, summa })),
      saknarBelopp: rader.filter((r) => r.belopp_per_man === 0).length,
    };
  });

  // AI-kostnad per klient den här månaden, ur samma händelselogg som /dashboard/kostnader.
  // Kopplas till MRR-raden när klientens namn matchar kundnamnet. Ingen match = inget påstående.
  const manadStartIso = new Date(Date.UTC(nu.getUTCFullYear(), nu.getUTCMonth(), 1)).toISOString();
  const [{ data: handelser }, { data: klienter }] = await Promise.all([
    sb.from("ai_usage_events").select("tenant_id, estimated_cost_sek").gte("created_at", manadStartIso).limit(20000),
    sb.from("clients").select("id, name"),
  ]);
  const namnPerTenant = new Map(((klienter as Array<{ id: string; name: string }> | null) || []).map((c) => [c.id, c.name]));
  const aiPerNamn = new Map<string, number>();
  for (const h of ((handelser as Array<{ tenant_id: string | null; estimated_cost_sek: number | string }> | null) || [])) {
    const namn = h.tenant_id ? namnPerTenant.get(h.tenant_id) : undefined;
    if (!namn) continue;
    const n = namn.trim().toLowerCase();
    aiPerNamn.set(n, (aiPerNamn.get(n) || 0) + (Number(h.estimated_cost_sek) || 0));
  }
  const aiPerKund = mrr
    .map((r) => ({ kund: r.kund, intakt: r.belopp_ex_moms, aiKostnad: aiPerNamn.get(r.kund.trim().toLowerCase()) ?? null }))
    .filter((r) => r.aiKostnad !== null);

  return NextResponse.json({
    idag,
    vecka,
    morgonlistan: { kort: forfallnaKort, uppgifter: forfallnaTasks },
    grip,
    mrr,
    dt,
    pipeline: [...pipeline].sort(sorteraPaUppfoljning),
    fasta,
    kostnadPerBolag,
    aiPerKund,
    tasks,
    synk: {
      senastSynkad: synkadTid,
      ok: synk.ok,
      fel: synk.fel || null,
      locationId: allaKort[0]?.location_id || null,
      utanforUrvalet: utanfor,
    },
  });
}

// Sortering: närmast förfallande uppföljning först, kort utan uppföljning sist.
function sorteraPaUppfoljning(a: PipelineRad, b: PipelineRad): number {
  if (a.uppfoljning_datum && b.uppfoljning_datum) return a.uppfoljning_datum.localeCompare(b.uppfoljning_datum);
  if (a.uppfoljning_datum) return -1;
  if (b.uppfoljning_datum) return 1;
  return (b.senast_uppdaterad || "").localeCompare(a.senast_uppdaterad || "");
}

const BOLAG = ["grip", "dt"];
const BOLAG_TASK = ["grip", "dt", "privat"];
const NIVAER = ["grund", "pro", "gdam", "bollplanket", "konsult", "ovrigt"];
const STATUSAR = ["aktiv", "pausad", "avslutad"];
const VALUTOR = ["SEK", "USD", "EUR"];

// POST — skapa en rad. { typ: "mrr" | "fast" | "task", ...falt }
export async function POST(req: NextRequest) {
  const denied = await ownerGrind();
  if (denied) return denied;

  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan" }, { status: 400 });
  }
  const sb = supabaseService();
  const text = (v: unknown, max = 200) => String(v ?? "").trim().slice(0, max);

  if (b.typ === "mrr") {
    const kund = text(b.kund, 120);
    if (!kund) return NextResponse.json({ error: "Kundens namn behövs" }, { status: 400 });
    const belopp = Number(b.belopp_ex_moms);
    if (!Number.isFinite(belopp) || belopp < 0) return NextResponse.json({ error: "Beloppet måste vara ett tal, noll eller mer" }, { status: 400 });
    const { error } = await sb.from("hq_mrr_entries").insert({
      bolag: BOLAG.includes(String(b.bolag)) ? b.bolag : "grip",
      kund,
      niva: NIVAER.includes(String(b.niva)) ? b.niva : "ovrigt",
      belopp_ex_moms: belopp,
      startdatum: b.startdatum ? String(b.startdatum).slice(0, 10) : null,
      status: STATUSAR.includes(String(b.status)) ? b.status : "aktiv",
      notering: text(b.notering, 400) || null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (b.typ === "fast") {
    const tjanst = text(b.tjanst, 120);
    if (!tjanst) return NextResponse.json({ error: "Tjänstens namn behövs" }, { status: 400 });
    const belopp = Number(b.belopp_per_man);
    if (!Number.isFinite(belopp) || belopp < 0) return NextResponse.json({ error: "Beloppet måste vara ett tal, noll eller mer" }, { status: 400 });
    const { error } = await sb.from("hq_fasta_kostnader").insert({
      bolag: BOLAG.includes(String(b.bolag)) ? b.bolag : "grip",
      tjanst,
      belopp_per_man: belopp,
      valuta: VALUTOR.includes(String(b.valuta)) ? b.valuta : "SEK",
      notering: text(b.notering, 400) || null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (b.typ === "task") {
    const titel = text(b.titel, 200);
    if (!titel) return NextResponse.json({ error: "Skriv vad uppgiften gäller" }, { status: 400 });
    const { error } = await sb.from("hq_tasks").insert({
      titel,
      bolag: BOLAG_TASK.includes(String(b.bolag)) ? b.bolag : "grip",
      datum: b.datum ? String(b.datum).slice(0, 10) : null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Okänd typ" }, { status: 400 });
}

// PATCH — ändra en rad. { typ, id, ...falt som ska ändras }
export async function PATCH(req: NextRequest) {
  const denied = await ownerGrind();
  if (denied) return denied;

  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan" }, { status: 400 });
  }
  const id = String(b.id || "");
  if (!id) return NextResponse.json({ error: "Rad saknas" }, { status: 400 });
  const sb = supabaseService();
  const rad: Record<string, unknown> = { uppdaterad: new Date().toISOString() };
  const text = (v: unknown, max = 200) => String(v ?? "").trim().slice(0, max);

  if (b.typ === "mrr") {
    if (b.kund !== undefined) {
      const kund = text(b.kund, 120);
      if (!kund) return NextResponse.json({ error: "Kundens namn behövs" }, { status: 400 });
      rad.kund = kund;
    }
    if (b.belopp_ex_moms !== undefined) {
      const belopp = Number(b.belopp_ex_moms);
      if (!Number.isFinite(belopp) || belopp < 0) return NextResponse.json({ error: "Beloppet måste vara ett tal, noll eller mer" }, { status: 400 });
      rad.belopp_ex_moms = belopp;
    }
    if (b.bolag !== undefined && BOLAG.includes(String(b.bolag))) rad.bolag = b.bolag;
    if (b.niva !== undefined && NIVAER.includes(String(b.niva))) rad.niva = b.niva;
    if (b.status !== undefined && STATUSAR.includes(String(b.status))) rad.status = b.status;
    if (b.startdatum !== undefined) rad.startdatum = b.startdatum ? String(b.startdatum).slice(0, 10) : null;
    if (b.notering !== undefined) rad.notering = text(b.notering, 400) || null;
    const { error } = await sb.from("hq_mrr_entries").update(rad).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (b.typ === "fast") {
    if (b.tjanst !== undefined) {
      const tjanst = text(b.tjanst, 120);
      if (!tjanst) return NextResponse.json({ error: "Tjänstens namn behövs" }, { status: 400 });
      rad.tjanst = tjanst;
    }
    if (b.belopp_per_man !== undefined) {
      const belopp = Number(b.belopp_per_man);
      if (!Number.isFinite(belopp) || belopp < 0) return NextResponse.json({ error: "Beloppet måste vara ett tal, noll eller mer" }, { status: 400 });
      rad.belopp_per_man = belopp;
    }
    if (b.bolag !== undefined && BOLAG.includes(String(b.bolag))) rad.bolag = b.bolag;
    if (b.valuta !== undefined && VALUTOR.includes(String(b.valuta))) rad.valuta = b.valuta;
    if (b.notering !== undefined) rad.notering = text(b.notering, 400) || null;
    const { error } = await sb.from("hq_fasta_kostnader").update(rad).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (b.typ === "task") {
    if (b.titel !== undefined) {
      const titel = text(b.titel, 200);
      if (!titel) return NextResponse.json({ error: "Skriv vad uppgiften gäller" }, { status: 400 });
      rad.titel = titel;
    }
    if (b.klar !== undefined) rad.klar = !!b.klar;
    if (b.bolag !== undefined && BOLAG_TASK.includes(String(b.bolag))) rad.bolag = b.bolag;
    if (b.datum !== undefined) rad.datum = b.datum ? String(b.datum).slice(0, 10) : null;
    const { error } = await sb.from("hq_tasks").update(rad).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Okänd typ" }, { status: 400 });
}

// DELETE — ta bort en rad. ?typ=mrr|fast|task&id=<uuid>
export async function DELETE(req: NextRequest) {
  const denied = await ownerGrind();
  if (denied) return denied;

  const typ = req.nextUrl.searchParams.get("typ") || "";
  const id = req.nextUrl.searchParams.get("id") || "";
  const tabell = typ === "mrr" ? "hq_mrr_entries" : typ === "fast" ? "hq_fasta_kostnader" : typ === "task" ? "hq_tasks" : "";
  if (!tabell || !id) return NextResponse.json({ error: "Rad saknas" }, { status: 400 });

  const { error } = await supabaseService().from(tabell).delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
