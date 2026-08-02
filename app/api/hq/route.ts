import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getAdminScope } from "@/lib/api-auth";
import { supabaseService } from "@/lib/supabase-admin";
import { hamtaValdaPipelines, lasPipeline, senastSynkad, synkaPipeline, type PipelineRad } from "@/lib/hq/pipeline";
import {
  byggPrognos,
  pipelineSummor,
  type AffarFinans,
  type Bolag,
  type CashPost,
} from "@/lib/hq/likviditet";

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

// ── LIKVID-1 ──────────────────────────────────────────────────────────────────
interface FinansRad {
  opportunity_id: string;
  fakturerat: number | string;
  betalt: number | string;
  forvantat_betaldatum: string | null;
  forfallodatum: string | null;
  notering: string | null;
}

interface SaldoRad {
  id: string;
  bolag: string;
  saldo: number | string;
  datum: string;
  notering: string | null;
}

interface CashRad {
  id: string;
  bolag: string;
  titel: string;
  belopp: number | string;
  datum: string;
  typ: string;
  status: string;
  notering: string | null;
}

interface KonfigRad {
  bolag: string;
  buffertmal: number | string;
  gul_grans_veckor: number;
  usd_kurs: number | string;
  notering: string | null;
}

interface SannolikhetRad {
  steg_id: string;
  pipeline_id: string | null;
  steg_namn: string | null;
  position: number | null;
  procent: number;
  agarsatt: boolean;
}

const KONFIG_STANDARD = { buffertmal: 0, gul_grans_veckor: 4, usd_kurs: 11 };

export async function GET(req: NextRequest) {
  const denied = await ownerGrind();
  if (denied) return denied;

  // Synk vid sidladdning, högst var tionde minut. "Uppdatera nu" sätter ?uppdatera=1.
  // Går anropet fel lämnas spegeln orörd och felet följer med ut till vyn.
  const tvinga = req.nextUrl.searchParams.get("uppdatera") === "1";
  const synk = await synkaPipeline(tvinga);

  const sb = supabaseService();
  const [
    { data: mrrData },
    { data: fastData },
    { data: taskData },
    allaKort,
    synkadTid,
    { data: finansData },
    { data: saldoData },
    { data: cashData },
    { data: konfigData },
    { data: sannData },
  ] = await Promise.all([
    sb.from("hq_mrr_entries").select("*").order("bolag").order("kund"),
    sb.from("hq_fasta_kostnader").select("*").order("bolag").order("tjanst"),
    sb.from("hq_tasks").select("*").order("datum", { nullsFirst: false }),
    lasPipeline(),
    senastSynkad(),
    sb.from("hq_deal_finance").select("*"),
    sb.from("hq_bank_saldo").select("*").order("datum", { ascending: false }).order("skapad", { ascending: false }),
    sb.from("hq_cash_items").select("*").order("datum"),
    sb.from("hq_likvid_konfig").select("*"),
    sb.from("hq_steg_sannolikhet").select("*"),
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
  const perSteg = new Map<
    string,
    { steg: string; steg_id: string | null; pipeline: string; position: number; antal: number; summa: number }
  >();
  for (const p of oppna) {
    const nyckel = `${p.pipeline_namn || ""}|${p.steg_namn || "okänt steg"}`;
    const g = perSteg.get(nyckel) || {
      steg: p.steg_namn || "okänt steg",
      steg_id: p.steg_id || null,
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

  // ── LIKVID-1: betalstatus, tre pipelinesummor och kassaflödesprognos ────
  const finans = new Map(
    ((finansData as FinansRad[] | null) || []).map((r) => [
      r.opportunity_id,
      {
        fakturerat: Number(r.fakturerat) || 0,
        betalt: Number(r.betalt) || 0,
        forvantat_betaldatum: r.forvantat_betaldatum,
        forfallodatum: r.forfallodatum,
        notering: r.notering,
      },
    ]),
  );
  const sannolikhetPerSteg = new Map(
    ((sannData as SannolikhetRad[] | null) || []).map((r) => [r.steg_id, r]),
  );
  const saldon = ((saldoData as SaldoRad[] | null) || []).map((r) => ({ ...r, saldo: Number(r.saldo) || 0 }));
  const cash = ((cashData as CashRad[] | null) || []).map((r) => ({ ...r, belopp: Number(r.belopp) || 0 }));
  const konfigPerBolag = new Map(
    ((konfigData as KonfigRad[] | null) || []).map((r) => [
      r.bolag,
      {
        bolag: r.bolag,
        buffertmal: Number(r.buffertmal) || 0,
        gul_grans_veckor: Number(r.gul_grans_veckor) || KONFIG_STANDARD.gul_grans_veckor,
        usd_kurs: Number(r.usd_kurs) || KONFIG_STANDARD.usd_kurs,
        notering: r.notering,
      },
    ]),
  );
  const konfigFor = (bolag: string) =>
    konfigPerBolag.get(bolag) || { bolag, ...KONFIG_STANDARD, notering: null };

  // Affärerna med sin betalstatus. Sannolikheten kommer ur tabellen; saknas raden
  // används 50 procent och det står i vyn, i stället för att viktningen tyst blir noll.
  const affarerFinans: AffarFinans[] = pipeline.map((p) => {
    const f = finans.get(p.ghl_opportunity_id);
    return {
      id: p.ghl_opportunity_id,
      varde: p.varde,
      fakturerat: f?.fakturerat ?? 0,
      betalt: f?.betalt ?? 0,
      forvantat_betaldatum: f?.forvantat_betaldatum ?? null,
      forfallodatum: f?.forfallodatum ?? null,
      harledd_status: p.harledd_status,
      sannolikhet: p.steg_id ? sannolikhetPerSteg.get(p.steg_id)?.procent ?? 50 : 50,
    };
  });
  const summor = pipelineSummor(affarerFinans, idag);

  // Fasta kostnader räknas om till kronor. USD med kursen ur konfigen, som VISAS i vyn.
  // En valuta utan kurs räknas ALDRIG om, den listas separat så totalen inte ljuger.
  const fastaSekFor = (bolag: string, usdKurs: number) => {
    let sek = 0;
    const utanKurs = new Map<string, number>();
    for (const f of fasta.filter((x) => x.bolag === bolag)) {
      if (f.valuta === "SEK") sek += f.belopp_per_man;
      else if (f.valuta === "USD") sek += f.belopp_per_man * usdKurs;
      else utanKurs.set(f.valuta, (utanKurs.get(f.valuta) || 0) + f.belopp_per_man);
    }
    return { sek, utanKurs: [...utanKurs.entries()].map(([valuta, summa]) => ({ valuta, summa })) };
  };

  const likviditet = (["grip", "dt"] as Bolag[]).map((bolag) => {
    const k = konfigFor(bolag);
    const senasteSaldo = saldon.find((s) => s.bolag === bolag) || null;
    const { sek, utanKurs } = fastaSekFor(bolag, k.usd_kurs);
    const poster: CashPost[] = cash
      .filter((c) => c.bolag === bolag)
      .map((c) => ({ id: c.id, titel: c.titel, belopp: c.belopp, datum: c.datum }));
    const prognos = byggPrognos({
      bolag,
      idag,
      startSaldo: senasteSaldo ? senasteSaldo.saldo : null,
      saldoDatum: senasteSaldo?.datum ?? null,
      // Pipelinen ligger hos Displayteknik. GripCoaching drivs av återkommande intäkt.
      affarer: bolag === "dt" ? affarerFinans : [],
      mrrPerManad: mrr.filter((r) => r.bolag === bolag && r.status === "aktiv").reduce((s, r) => s + r.belopp_ex_moms, 0),
      fastaSek: sek,
      poster,
      buffertmal: k.buffertmal,
      gulGransVeckor: k.gul_grans_veckor,
    });
    return { ...prognos, konfig: k, fastaSek: sek, fastaUtanKurs: utanKurs, saldoHistorik: saldon.filter((s) => s.bolag === bolag).slice(0, 8) };
  });

  // Larmet går in i morgonlistan, samma lista och samma rendering som allt annat som
  // förfaller. Ingen egen banner, ingen andra väg in.
  const larm = likviditet
    .filter((l) => l.trafikljus === "gul" || l.trafikljus === "rod")
    .map((l) => ({
      id: `likvid-${l.bolag}`,
      text: l.klartext,
      niva: l.trafikljus as "gul" | "rod",
      etikett: "Likviditet",
      lank: "#likviditet",
    }));

  // K3-INKÖP: leverantörssaldon som håller på att ta slut läggs i SAMMA lista, från
  // SAMMA källa som kostnadsmodulens banner (lib/inkop). Ingen egen tröskel här, ingen
  // andra uträkning. Faller den returnerar den tomt och morgonlistan står kvar.
  const { inkopLarm } = await import("@/lib/inkop");
  larm.push(...(await inkopLarm(nu)));

  // KONTAKT-1: tystnadsreglerna i SAMMA lista, ur samma byggare som tystnadslistan.
  // Ingen andra tröskel och ingen egen uträkning här, annars kan vyn och morgonlistan
  // säga emot varandra om samma affär. Faller den står morgonlistan kvar.
  try {
    const { byggLista, regelrader } = await import("@/lib/hq/kontakt");
    const { rader: kontaktRader, regler } = await byggLista();
    larm.push(...regelrader(kontaktRader, regler));
  } catch { /* tystnadsmätningen är aldrig värd att fälla morgonlistan för */ }

  // START-1: uppstartsraden ligger ÖVERST i samma lista. Så länge grunden inte är på
  // plats är den viktigare än dagens enskilda uppgifter, för allt annat vilar på den.
  // Uppstartsstegen dubbleras aldrig som vanliga uppgifter i hq_tasks.
  const uppstart = await (async () => {
    const { data } = await sb.from("hq_uppstart_steg").select("titel, status, kategori, sortering").order("sortering");
    const rader = (data as Array<{ titel: string; status: string; kategori: string }> | null) || [];
    if (!rader.length) return null;
    const kvar = rader.filter((r) => r.status !== "klar" && r.status !== "skjutet");
    const mysalesKlart = rader.filter((r) => r.kategori === "mysales").every((r) => r.status === "klar");
    if (!kvar.length) return { text: "Uppstarten är klar. Systemet står på egna ben.", niva: "klar" as const };
    return {
      text: `Uppstart: ${kvar.length} ${kvar.length === 1 ? "steg" : "steg"} kvar, nästa är ${kvar[0].titel}`,
      niva: mysalesKlart ? ("klar" as const) : ("gul" as const),
      mysalesKlart,
    };
  })();
  if (uppstart) {
    larm.unshift({
      id: "uppstart",
      text: uppstart.text,
      niva: uppstart.niva === "klar" ? "gul" : uppstart.niva,
      etikett: "Uppstart",
      lank: "/dashboard/hq/uppstart",
    });
  }

  // PLAN-1: dagens kalenderhändelser överst i morgonlistan, ur SAMMA spegel som
  // planeringsvyn läser. Ingen egen hämtning och ingen andra klassificering, annars
  // kan de två vyerna säga emot varandra om samma dag.
  const dagensHandelser = await (async () => {
    try {
      const { lasCache } = await import("@/lib/hq/kalender");
      const { klassa } = await import("@/lib/hq/planering");
      const fran = new Date(`${idag}T00:00:00Z`);
      const till = new Date(new Date(fran).getTime() + 2 * 864e5);
      const [rader, { data: typer }, { data: ov }] = await Promise.all([
        lasCache(fran, till),
        sb.from("hq_tidstyper").select("*").order("sortering"),
        sb.from("hq_handelse_typ").select("google_event_id, tidstyp_id"),
      ]);
      const overrides: Record<string, string> = {};
      for (const r of ((ov as Array<{ google_event_id: string; tidstyp_id: string }> | null) || [])) {
        overrides[r.google_event_id] = r.tidstyp_id;
      }
      return klassa(rader, overrides, ((typer as Array<{ nyckelord: string[] | null }> | null) || []).map((t) => ({
        ...(t as unknown as { id: string; namn: string; farg_ramp: string; sortering: number }),
        nyckelord: t.nyckelord || [],
      })))
        .filter((h) => h.datum === idag)
        .sort((a, b) => Number(b.heldag) - Number(a.heldag) || a.startMinut - b.startMinut)
        .map((h) => ({
          id: h.google_event_id,
          titel: h.titel,
          heldag: h.heldag,
          start: h.heldag ? null : `${String(Math.floor(h.startMinut / 60)).padStart(2, "0")}:${String(h.startMinut % 60).padStart(2, "0")}`,
          slut: h.heldag ? null : `${String(Math.floor(h.slutMinut / 60)).padStart(2, "0")}:${String(h.slutMinut % 60).padStart(2, "0")}`,
          tidstyp: h.tidstyp?.namn || null,
          farg: h.tidstyp?.farg_ramp || null,
          lank: h.html_lank,
        }));
    } catch {
      return []; // kalendern är inte kopplad än, eller spegeln är tom. Morgonlistan står kvar.
    }
  })();

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
    morgonlistan: { larm, handelser: dagensHandelser, kort: forfallnaKort, uppgifter: forfallnaTasks },
    grip,
    mrr,
    dt: { ...dt, ...summor },
    // Korten bär sin betalstatus med sig, så DT-tabellen kan visa och ändra den utan
    // en andra hämtning.
    pipeline: [...pipeline].sort(sorteraPaUppfoljning).map((p) => ({
      ...p,
      finans: finans.get(p.ghl_opportunity_id) || {
        fakturerat: 0,
        betalt: 0,
        forvantat_betaldatum: null,
        forfallodatum: null,
        notering: null,
      },
      sannolikhet: p.steg_id ? sannolikhetPerSteg.get(p.steg_id)?.procent ?? 50 : 50,
    })),
    likviditet,
    cash,
    sannolikheter: [...sannolikhetPerSteg.values()]
      .filter((s) => !valda.size || (s.pipeline_id && valda.has(s.pipeline_id)))
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
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
const CASH_TYPER = ["leverantorsbetalning", "moms", "skatt", "inkasso", "lan", "ovrigt"];
const CASH_STATUSAR = ["planerad", "klar"];

/** ÅÅÅÅ-MM-DD eller null. Ett halvt datum sparas aldrig, då är fältet tomt. */
function dagEllerNull(v: unknown): string | null {
  const s = String(v ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

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

  // LIKVID-1 — banksaldo. Senaste raden per bolag gäller, historiken sparas.
  if (b.typ === "saldo") {
    const saldo = Number(b.saldo);
    if (!Number.isFinite(saldo)) return NextResponse.json({ error: "Saldot måste vara ett tal" }, { status: 400 });
    const dag = dagEllerNull(b.datum);
    if (!dag) return NextResponse.json({ error: "Ett datum behövs, annars går prognosen inte att räkna" }, { status: 400 });
    const { error } = await sb.from("hq_bank_saldo").insert({
      bolag: BOLAG.includes(String(b.bolag)) ? b.bolag : "grip",
      saldo,
      datum: dag,
      notering: text(b.notering, 400) || null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // LIKVID-1 — känd in- eller utbetalning. Positivt = in, negativt = ut.
  if (b.typ === "cash") {
    const titel = text(b.titel, 200);
    if (!titel) return NextResponse.json({ error: "Skriv vad posten gäller" }, { status: 400 });
    const belopp = Number(b.belopp);
    if (!Number.isFinite(belopp) || belopp === 0)
      return NextResponse.json({ error: "Beloppet måste vara ett tal skilt från noll" }, { status: 400 });
    const dag = dagEllerNull(b.datum);
    if (!dag) return NextResponse.json({ error: "Ett datum behövs för att posten ska hamna rätt i prognosen" }, { status: 400 });
    const { error } = await sb.from("hq_cash_items").insert({
      bolag: BOLAG.includes(String(b.bolag)) ? b.bolag : "grip",
      titel,
      belopp,
      datum: dag,
      typ: CASH_TYPER.includes(String(b.typ_post)) ? b.typ_post : "ovrigt",
      status: CASH_STATUSAR.includes(String(b.status)) ? b.status : "planerad",
      notering: text(b.notering, 400) || null,
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
  const sb = supabaseService();
  const text = (v: unknown, max = 200) => String(v ?? "").trim().slice(0, max);

  // ── LIKVID-1 ────────────────────────────────────────────────────────────
  // De här raderna har inte ett uuid som nyckel, så de tas före id-kontrollen.

  // Betalstatus per affär. Nyckeln är GHL:s opportunity-id. "Kvar att fakturera"
  // sparas ALDRIG, den räknas som affärens belopp minus fakturerat.
  if (b.typ === "finans") {
    const oid = text(b.opportunity_id, 60);
    if (!oid) return NextResponse.json({ error: "Affären saknas" }, { status: 400 });
    const rad: Record<string, unknown> = { opportunity_id: oid, uppdaterad: new Date().toISOString() };
    for (const falt of ["fakturerat", "betalt"] as const) {
      if (b[falt] === undefined) continue;
      const n = Number(b[falt]);
      if (!Number.isFinite(n) || n < 0)
        return NextResponse.json({ error: "Beloppet måste vara ett tal, noll eller mer" }, { status: 400 });
      rad[falt] = n;
    }
    if (b.forvantat_betaldatum !== undefined) rad.forvantat_betaldatum = dagEllerNull(b.forvantat_betaldatum);
    if (b.forfallodatum !== undefined) rad.forfallodatum = dagEllerNull(b.forfallodatum);
    if (b.notering !== undefined) rad.notering = text(b.notering, 400) || null;
    const { error } = await sb.from("hq_deal_finance").upsert(rad, { onConflict: "opportunity_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // Inställningar per bolag: buffertmål, larmgräns i veckor och USD-kursen.
  if (b.typ === "konfig") {
    const bolag = String(b.bolag || "");
    if (!BOLAG.includes(bolag)) return NextResponse.json({ error: "Okänt bolag" }, { status: 400 });
    const rad: Record<string, unknown> = { bolag, uppdaterad: new Date().toISOString() };
    if (b.buffertmal !== undefined) {
      const n = Number(b.buffertmal);
      if (!Number.isFinite(n) || n < 0) return NextResponse.json({ error: "Buffertmålet måste vara ett tal, noll eller mer" }, { status: 400 });
      rad.buffertmal = n;
    }
    if (b.gul_grans_veckor !== undefined) {
      const n = Math.round(Number(b.gul_grans_veckor));
      if (!Number.isFinite(n) || n < 1 || n > 12)
        return NextResponse.json({ error: "Larmgränsen måste vara mellan 1 och 12 veckor" }, { status: 400 });
      rad.gul_grans_veckor = n;
    }
    if (b.usd_kurs !== undefined) {
      const n = Number(b.usd_kurs);
      if (!Number.isFinite(n) || n <= 0) return NextResponse.json({ error: "Kursen måste vara större än noll" }, { status: 400 });
      rad.usd_kurs = n;
    }
    if (b.notering !== undefined) rad.notering = text(b.notering, 400) || null;
    const { error } = await sb.from("hq_likvid_konfig").upsert(rad, { onConflict: "bolag" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // Sannolikhet per steg. Sätter ägaren en egen siffra flaggas raden, och synken
  // rör den aldrig mer.
  if (b.typ === "sannolikhet") {
    const stegId = text(b.steg_id, 60);
    if (!stegId) return NextResponse.json({ error: "Steget saknas" }, { status: 400 });
    const n = Math.round(Number(b.procent));
    if (!Number.isFinite(n) || n < 0 || n > 100)
      return NextResponse.json({ error: "Sannolikheten måste vara mellan 0 och 100" }, { status: 400 });
    const { error } = await sb
      .from("hq_steg_sannolikhet")
      .update({ procent: n, agarsatt: true, uppdaterad: new Date().toISOString() })
      .eq("steg_id", stegId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const id = String(b.id || "");
  if (!id) return NextResponse.json({ error: "Rad saknas" }, { status: 400 });
  const rad: Record<string, unknown> = { uppdaterad: new Date().toISOString() };

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

  if (b.typ === "cash") {
    if (b.titel !== undefined) {
      const titel = text(b.titel, 200);
      if (!titel) return NextResponse.json({ error: "Skriv vad posten gäller" }, { status: 400 });
      rad.titel = titel;
    }
    if (b.belopp !== undefined) {
      const belopp = Number(b.belopp);
      if (!Number.isFinite(belopp) || belopp === 0)
        return NextResponse.json({ error: "Beloppet måste vara ett tal skilt från noll" }, { status: 400 });
      rad.belopp = belopp;
    }
    if (b.datum !== undefined) {
      const dag = dagEllerNull(b.datum);
      if (!dag) return NextResponse.json({ error: "Ett datum behövs för att posten ska hamna rätt i prognosen" }, { status: 400 });
      rad.datum = dag;
    }
    if (b.bolag !== undefined && BOLAG.includes(String(b.bolag))) rad.bolag = b.bolag;
    if (b.typ_post !== undefined && CASH_TYPER.includes(String(b.typ_post))) rad.typ = b.typ_post;
    if (b.status !== undefined && CASH_STATUSAR.includes(String(b.status))) rad.status = b.status;
    if (b.notering !== undefined) rad.notering = text(b.notering, 400) || null;
    const { error } = await sb.from("hq_cash_items").update(rad).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Okänd typ" }, { status: 400 });
}

// DELETE — ta bort en rad. ?typ=mrr|fast|task|saldo|cash&id=<uuid>
// eller ?typ=finans&id=<opportunity_id>
export async function DELETE(req: NextRequest) {
  const denied = await ownerGrind();
  if (denied) return denied;

  const typ = req.nextUrl.searchParams.get("typ") || "";
  const id = req.nextUrl.searchParams.get("id") || "";
  const TABELLER: Record<string, { tabell: string; nyckel: string }> = {
    mrr: { tabell: "hq_mrr_entries", nyckel: "id" },
    fast: { tabell: "hq_fasta_kostnader", nyckel: "id" },
    task: { tabell: "hq_tasks", nyckel: "id" },
    saldo: { tabell: "hq_bank_saldo", nyckel: "id" },
    cash: { tabell: "hq_cash_items", nyckel: "id" },
    finans: { tabell: "hq_deal_finance", nyckel: "opportunity_id" },
  };
  const mal = TABELLER[typ];
  if (!mal || !id) return NextResponse.json({ error: "Rad saknas" }, { status: 400 });

  const { error } = await supabaseService().from(mal.tabell).delete().eq(mal.nyckel, id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
