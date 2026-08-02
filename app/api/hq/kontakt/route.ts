import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getAdminScope } from "@/lib/api-auth";
import { byggLista, loggaSamtal, regelrader, senastSynkad, synkaKontakter } from "@/lib/hq/kontakt";
import { kalenderAuthUrl, kopplingsScope } from "@/lib/hq/kalender";

export const runtime = "nodejs";

// KONTAKT-1 — underlaget till tystnadslistan. ENDAST huvudadmin.
// Modulen mäter och lyfter. Inga utskick, ingen AI, ingen läsning av brödtext.

async function ownerGrind() {
  const denied = await requireAdmin();
  if (denied) return denied;
  if ((await getAdminScope()) !== null) {
    return NextResponse.json({ error: "Endast huvudadmin har åtkomst" }, { status: 403 });
  }
  return null;
}

export async function GET(req: NextRequest) {
  const denied = await ownerGrind();
  if (denied) return denied;

  const scope = await kopplingsScope();
  const synk = await synkaKontakter(req.nextUrl.searchParams.get("uppdatera") === "1");
  const { rader, regler } = await byggLista();

  return NextResponse.json({
    // Utan Gmail-behörighet visas listan ändå, med kortens egna datum. Den säger då
    // mindre, men den ljuger inte: bollen står som okänd tills mejlen kan läsas.
    kopplad: !!scope,
    harGmail: !!scope?.harGmail,
    authUrl: scope?.harGmail ? null : kalenderAuthUrl(req.nextUrl.origin),
    rader,
    regler,
    morgonrader: regelrader(rader, regler),
    antal: {
      totalt: rader.length,
      matbara: rader.filter((r) => r.matbar).length,
      omatbara: rader.filter((r) => !r.matbar).length,
      bollenHosOss: rader.filter((r) => r.bollen === "oss").length,
    },
    synk: { senastSynkad: await senastSynkad(), ok: synk.ok, fel: synk.fel || null },
  });
}

// POST — logga ett samtal. Enda skrivningen i modulen, och den kommer alltid från ett klick.
export async function POST(req: NextRequest) {
  const denied = await ownerGrind();
  if (denied) return denied;

  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan" }, { status: 400 });
  }
  const id = String(b.opportunityId || "");
  if (!id) return NextResponse.json({ error: "Affären saknas" }, { status: 400 });

  const ok = await loggaSamtal(id, String(b.notering || ""));
  if (!ok) return NextResponse.json({ error: "Kunde inte spara samtalet" }, { status: 500 });
  // Noteringen stannar i HQ. MySales äger pipelinen och HQ skriver aldrig dit.
  return NextResponse.json({ ok: true, sparatI: "hq" });
}

// PATCH — trösklarna i reglerna, ägarstyrda utan ny version.
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
  if (!id) return NextResponse.json({ error: "Regeln saknas" }, { status: 400 });

  const rad: Record<string, unknown> = { uppdaterad: new Date().toISOString() };
  if (b.troskel_dagar !== undefined) {
    const t = Number(b.troskel_dagar);
    if (!Number.isFinite(t) || t < 0) return NextResponse.json({ error: "Tröskeln måste vara ett tal, noll eller mer" }, { status: 400 });
    rad.troskel_dagar = Math.round(t);
  }
  if (b.aktiv !== undefined) rad.aktiv = !!b.aktiv;

  const { supabaseService } = await import("@/lib/supabase-admin");
  const { error } = await supabaseService().from("hq_kontakt_regler").update(rad).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
