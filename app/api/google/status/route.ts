import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-admin";
import { getActiveClientId } from "@/lib/client-context";
import { googleConfigured } from "@/lib/google";

export const runtime = "nodejs";

export async function GET() {
  const clientId = await getActiveClientId();
  const sb = supabaseServer();
  const { data } = await sb
    .from("google_connections")
    .select("email, gsc_site, ga_property_id, created_at, updated_at")
    .eq("client_id", clientId)
    .maybeSingle();
  return NextResponse.json({
    configured: googleConfigured(),
    connected: !!data,
    connection: data,
  });
}

export async function DELETE() {
  const clientId = await getActiveClientId();
  const sb = supabaseServer();
  await sb.from("google_connections").delete().eq("client_id", clientId);
  return NextResponse.json({ ok: true });
}
