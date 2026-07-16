import { NextRequest, NextResponse } from "next/server";
import { getActiveClientId } from "@/lib/client-context";
import { ghlListAccounts } from "@/lib/studio/ghl";
import { supabaseService } from "@/lib/supabase-admin";

export const runtime = "nodejs";

// Studio ↔ GHL-koppling per klient (självbetjäning). Token lagras men returneras ALDRIG.

// GET — status för aktiv klient (utan att läcka token)
export async function GET() {
  try {
    const clientId = await getActiveClientId();
    const sb = supabaseService();
    const { data } = await sb.from("clients").select("ghl_location_id, ghl_pit").eq("id", clientId).maybeSingle();
    return NextResponse.json({
      connected: !!(data?.ghl_location_id && data?.ghl_pit),
      locationId: data?.ghl_location_id || "",
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// POST { locationId, pit } — validerar mot GHL innan sparning (fel token = ingen sparning)
export async function POST(req: NextRequest) {
  try {
    const clientId = await getActiveClientId();
    const b = await req.json().catch(() => ({}));
    const locationId = (b.locationId || "").toString().trim();
    const pit = (b.pit || "").toString().trim();
    if (!locationId || !pit) return NextResponse.json({ error: "Location-id och token krävs" }, { status: 400 });

    // Validera: kan token nå location + har Social Media-scope?
    const check = await ghlListAccounts({ locationId, pit });
    if (check.error) {
      return NextResponse.json({ error: `Kunde inte koppla: ${check.error}` }, { status: 400 });
    }

    const sb = supabaseService();
    const { error } = await sb.from("clients").update({ ghl_location_id: locationId, ghl_pit: pit }).eq("id", clientId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ connected: true, accounts: check.accounts.length });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// DELETE — koppla från
export async function DELETE() {
  try {
    const clientId = await getActiveClientId();
    const sb = supabaseService();
    await sb.from("clients").update({ ghl_location_id: null, ghl_pit: null }).eq("id", clientId);
    return NextResponse.json({ connected: false });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
