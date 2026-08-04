import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getAdminScope } from "@/lib/api-auth";
import { getActiveClientId, setActiveClientId } from "@/lib/client-context";
import { supabaseService } from "@/lib/supabase-admin";

export const runtime = "nodejs";

// GET /api/offert/lead?id=<uuid>
//
// Hämtar EN offertförfrågan från webbformuläret (tabellen offert_leads, skriven av
// displayteknik-offert/netlify/functions/submit.mjs) så att "Skapa offertförslag"-länken
// i aviseringsmejlet kan öppna offertmotorn med kunden redan ifylld.
//
// ADMIN ONLY. /api/offert/* släpps förbi proxy:ns grind (kundportalen /k/offert använder
// samma prefix), så grinden MÅSTE sitta här. En offertförfrågan är intern säljdata och
// ska aldrig kunna läsas med en kund-session.
export async function GET(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const id = req.nextUrl.searchParams.get("id") || "";
  // Bara ett uuid får gå vidare — id:t kommer ur en länk i ett mejl.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "Ogiltigt lead-id" }, { status: 400 });
  }

  const sb = supabaseService();
  const { data, error } = await sb
    .from("offert_leads")
    .select("id, created_at, namn, foretag, epost, telefon, miljo, mal, yta, ort, beskrivning, tidsplan, budget, bild_path, client_id, lobby_contact_id")
    .eq("id", id)
    .maybeSingle();

  // ⚠ Ett misslyckat anrop ger data:null — exakt som "raden finns inte". Utan den här
  // kollen hade ett databasfel presenterats som "leadet är borta".
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Leadet finns inte" }, { status: 404 });

  const lead = data as { client_id: string | null; bild_path: string | null } & Record<string, unknown>;

  // Klient-scopad admin (t.ex. HM Motor) får bara se sin egen tenants förfrågningar.
  const scope = await getAdminScope();
  if (scope && scope !== lead.client_id) {
    return NextResponse.json({ error: "Leadet tillhör en annan klient" }, { status: 403 });
  }

  // Full admin: växla aktiv klient till leadets tenant. Utan detta öppnas offertmotorn i
  // den klient som råkade ligga kvar i väljaren (default HM Motor) — alltså fel kunds
  // katalog, offertmall och priser. Kopplingen kommer ur leadet, aldrig ur en hårdkodning.
  let bytteKlient = false;
  if (!scope && lead.client_id && lead.client_id !== (await getActiveClientId())) {
    await setActiveClientId(lead.client_id);
    bytteKlient = true;
  }

  // Bilden ligger i en privat bucket → signerad läslänk, samma mönster som mejlet.
  let bildUrl: string | null = null;
  if (lead.bild_path) {
    try {
      const { data: s } = await sb.storage.from("offert-bilder").createSignedUrl(lead.bild_path, 60 * 60);
      bildUrl = s?.signedUrl || null;
    } catch {
      bildUrl = null; // bilden är en bonus, aldrig ett skäl att fälla vyn
    }
  }

  return NextResponse.json({ lead: { ...lead, bild_url: bildUrl }, bytteKlient });
}
