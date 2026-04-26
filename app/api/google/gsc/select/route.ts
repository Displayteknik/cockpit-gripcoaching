import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-admin";
import { getActiveClientId } from "@/lib/client-context";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { site } = await req.json();
  const clientId = await getActiveClientId();
  const sb = supabaseServer();
  await sb.from("google_connections").update({ gsc_site: site, updated_at: new Date().toISOString() }).eq("client_id", clientId);
  return NextResponse.json({ ok: true });
}
