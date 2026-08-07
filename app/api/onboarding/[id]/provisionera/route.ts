import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { supabaseService } from "@/lib/supabase-admin";
import { provisionera } from "@/lib/onboard/provisionera";
import type { Forslag } from "@/lib/onboard/typer";

export const runtime = "nodejs";

// GHL:s snapshot-laddning pollas i upp till 45 sekunder innan custom values skrivs.
export const maxDuration = 60;

/**
 * ONBOARD-1 steg 6: skapar sub-account, tenant, mappning och skickar välkomstmejl.
 *
 * ★ TORRKÖRNING ÄR STANDARD. Skarp körning kräver `torrkorning: false` i kroppen.
 *   Ett sub-account hos GHL går inte att ångra, så det ska aldrig kunna hända för att
 *   någon råkade skicka en tom kropp.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;

  let body: { torrkorning?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    // Tom kropp = torrkörning, vilket är det säkra läget.
  }
  const torrkorning = body.torrkorning !== false;

  const sb = supabaseService();
  const { data: rad, error } = await sb
    .from("onboarding_korningar")
    .select("id, status, forslag, epost")
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!rad) return NextResponse.json({ error: "Körningen finns inte." }, { status: 404 });
  if (!rad.forslag) return NextResponse.json({ error: "Körningen saknar förslag — kör analysen först." }, { status: 400 });

  try {
    const resultat = await provisionera({
      korningId: id,
      forslag: rad.forslag as Forslag,
      inloggningsEpost: rad.epost as string | null,
      torrkorning,
      basUrl: new URL(req.url).origin,
    });
    // Nycklarna görs om till samma skrivsätt som GET /api/onboarding/[id] använder.
    // provisionera() returnerar camelCase (idiomatisk TS), men GET speglar
    // databaskolumnerna. Två skrivsätt för samma sak i samma resurs är en fälla för
    // nästa läsare — kontraktet utåt är snake_case.
    // 207 = körningen gick igenom men minst ett steg föll; UI:t visar då checklistan
    // med rött på rätt rad i stället för ett allmänt fel.
    return NextResponse.json(
      {
        ok: resultat.ok,
        torrkorning: resultat.torrkorning,
        steg: resultat.steg,
        client_id: resultat.clientId,
        ghl_location_id: resultat.ghlLocationId,
        inloggnings_url: resultat.inloggningsUrl,
        fel: resultat.fel,
      },
      { status: resultat.ok ? 200 : 207 },
    );
  } catch (e) {
    // Ett oväntat kast får inte lämna körningen låst i status 'kor'.
    if (!torrkorning) {
      await sb
        .from("onboarding_korningar")
        .update({ status: "fel", fel: e instanceof Error ? e.message : String(e), updated_at: new Date().toISOString() })
        .eq("id", id);
    }
    return NextResponse.json({ error: e instanceof Error ? e.message : "Provisioneringen kunde inte köras." }, { status: 500 });
  }
}
