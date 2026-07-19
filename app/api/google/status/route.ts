import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase-admin";
import { getActiveClientId } from "@/lib/client-context";
import { googleConfigured, autoSelectGaProperty } from "@/lib/google";

export const runtime = "nodejs";

export async function GET() {
  const clientId = await getActiveClientId();
  const sb = supabaseService();
  const sel = "email, gsc_site, ga_property_id, created_at, updated_at";
  let { data } = await sb.from("google_connections").select(sel).eq("client_id", clientId).maybeSingle();
  // Är Google anslutet men ingen GA4-property vald? Försök koppla rätt property automatiskt (matcha domän).
  if (data && !data.ga_property_id) {
    const picked = await autoSelectGaProperty(clientId);
    if (picked) {
      const re = await sb.from("google_connections").select(sel).eq("client_id", clientId).maybeSingle();
      data = re.data;
    }
  }
  return NextResponse.json({
    configured: googleConfigured(),
    connected: !!data,
    connection: data,
  });
}

export async function DELETE() {
  const clientId = await getActiveClientId();
  const sb = supabaseService();
  await sb.from("google_connections").delete().eq("client_id", clientId);
  return NextResponse.json({ ok: true });
}
