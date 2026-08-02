import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getAdminScope } from "@/lib/api-auth";
import { supabaseService } from "@/lib/supabase-admin";
import { koraKontroller } from "@/lib/hq/uppstart";

export const runtime = "nodejs";

// START-1 — underlaget till /dashboard/hq/uppstart. ENDAST huvudadmin.
// Modulen mäter och vägleder. Den skriver aldrig till MySales eller andra system.

async function ownerGrind() {
  const denied = await requireAdmin();
  if (denied) return denied;
  if ((await getAdminScope()) !== null) {
    return NextResponse.json({ error: "Endast huvudadmin har åtkomst" }, { status: 403 });
  }
  return null;
}

const KATEGORIER = ["mysales", "ekonomi", "drift", "cockpit", "kalender"];
const STATUSAR = ["att_gora", "pagar", "klar", "skjutet"];

interface StegRad {
  id: string; titel: string; varfor: string; hur: string | null; kategori: string;
  blockerar: string[] | null; uppskattad_tid_min: number; sortering: number;
  status: string; klar_datum: string | null; anteckning: string | null; egen: boolean;
}

export async function GET(req: NextRequest) {
  const denied = await ownerGrind();
  if (denied) return denied;

  await koraKontroller(req.nextUrl.searchParams.get("uppdatera") === "1");

  const sb = supabaseService();
  const [{ data: stegData }, { data: kontrollData }] = await Promise.all([
    sb.from("hq_uppstart_steg").select("*").order("sortering").order("id"),
    sb.from("hq_uppstart_kontroll").select("steg_id, kontrolltyp, senast_kord, resultat_text, uppfyllt"),
  ]);

  const kontroller = new Map<string, { kontrolltyp: string; senast_kord: string | null; resultat_text: string | null; uppfyllt: boolean }>();
  for (const k of ((kontrollData as Array<{ steg_id: string; kontrolltyp: string; senast_kord: string | null; resultat_text: string | null; uppfyllt: boolean }> | null) || [])) {
    kontroller.set(k.steg_id, k);
  }

  const steg = ((stegData as StegRad[] | null) || []).map((s) => {
    const k = kontroller.get(s.id) || null;
    return {
      ...s,
      blockerar: s.blockerar || [],
      kontroll: k,
      // ⚠ Ett steg med kontroll som INTE är uppfylld visas som delvis klart, aldrig som
      // klart. Sanningen bor i mätningen, inte i klicket.
      delvis: s.status === "klar" && !!k && !k.uppfyllt,
    };
  });

  const raknas = steg.filter((s) => s.status !== "skjutet");
  const klara = raknas.filter((s) => s.status === "klar" && !s.delvis).length;
  const kvar = steg.filter((s) => s.status !== "klar" && s.status !== "skjutet");

  return NextResponse.json({
    steg,
    sammanfattning: {
      klara,
      totalt: raknas.length,
      skjutna: steg.filter((s) => s.status === "skjutet").length,
      minuterKvar: kvar.reduce((s, x) => s + x.uppskattad_tid_min, 0),
      mysalesKlart: steg.filter((s) => s.kategori === "mysales").every((s) => s.status === "klar" && !s.delvis),
    },
    nasta: kvar[0] || null,
  });
}

// PATCH — status, anteckning. Ingenting annat får ändras här.
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
  if (!id) return NextResponse.json({ error: "Steget saknas" }, { status: 400 });

  const sb = supabaseService();
  const rad: Record<string, unknown> = { uppdaterad: new Date().toISOString() };

  if (b.status !== undefined) {
    const status = String(b.status);
    if (!STATUSAR.includes(status)) return NextResponse.json({ error: "Okänd status" }, { status: 400 });

    // Spärren: ett steg med kontroll får inte bockas av medan mätningen säger nej.
    // Utan den kan listan visa grönt över en pipeline som fortfarande är blind.
    if (status === "klar") {
      const { data } = await sb.from("hq_uppstart_kontroll")
        .select("uppfyllt, resultat_text").eq("steg_id", id).maybeSingle();
      const k = data as { uppfyllt: boolean; resultat_text: string | null } | null;
      if (k && !k.uppfyllt) {
        return NextResponse.json({
          error: `Steget kan inte bockas av än. ${k.resultat_text || "Kontrollen är inte uppfylld."}`,
        }, { status: 409 });
      }
    }
    rad.status = status;
    rad.klar_datum = status === "klar" ? new Date().toISOString() : null;
  }
  if (b.anteckning !== undefined) rad.anteckning = String(b.anteckning || "").trim().slice(0, 500) || null;

  const { error } = await sb.from("hq_uppstart_steg").update(rad).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// POST — ägarens egna steg. Utan kontroll, alltså manuell avbockning.
export async function POST(req: NextRequest) {
  const denied = await ownerGrind();
  if (denied) return denied;

  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan" }, { status: 400 });
  }
  const titel = String(b.titel || "").trim().slice(0, 200);
  if (!titel) return NextResponse.json({ error: "Skriv vad steget gäller" }, { status: 400 });
  const kategori = KATEGORIER.includes(String(b.kategori)) ? String(b.kategori) : "cockpit";
  const tid = Number(b.uppskattad_tid_min);
  const sortering = Number(b.sortering);

  // Eget id-utrymme, så en framtida seedning aldrig krockar med ägarens egna steg.
  const id = `egen-${Date.now().toString(36)}`;
  const { error } = await supabaseService().from("hq_uppstart_steg").insert({
    id,
    titel,
    varfor: String(b.varfor || "").trim().slice(0, 500) || "Tillagt av dig.",
    hur: String(b.hur || "").trim().slice(0, 2000) || null,
    kategori,
    uppskattad_tid_min: Number.isFinite(tid) && tid > 0 ? Math.min(600, Math.round(tid)) : 10,
    sortering: Number.isFinite(sortering) ? Math.round(sortering) : 500,
    egen: true,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id });
}

// DELETE — bara ägarens egna steg. Seedade steg skjuts upp, de raderas aldrig.
export async function DELETE(req: NextRequest) {
  const denied = await ownerGrind();
  if (denied) return denied;

  const id = req.nextUrl.searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "Steget saknas" }, { status: 400 });

  const sb = supabaseService();
  const { data } = await sb.from("hq_uppstart_steg").select("egen").eq("id", id).maybeSingle();
  if (!(data as { egen: boolean } | null)?.egen) {
    return NextResponse.json({ error: "Bara dina egna steg går att ta bort. Skjut upp det i stället." }, { status: 400 });
  }
  const { error } = await sb.from("hq_uppstart_steg").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
