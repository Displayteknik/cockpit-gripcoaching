import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-admin";
import { getActiveClientId } from "@/lib/client-context";

export const runtime = "nodejs";

export async function GET() {
  const clientId = await getActiveClientId();
  const sb = supabaseServer();
  const { data } = await sb.from("post_metrics").select("*").eq("client_id", clientId).order("captured_at", { ascending: false }).limit(50);
  return NextResponse.json(data || []);
}
