import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-admin";
import { getActiveClientId } from "@/lib/client-context";

export const runtime = "nodejs";

export async function GET() {
  const clientId = await getActiveClientId();
  const sb = supabaseServer();
  const { data, error } = await sb.from("hm_settings").select("*").eq("client_id", clientId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const obj: Record<string, string> = {};
  for (const row of data || []) obj[row.key] = row.value;
  return NextResponse.json(obj);
}

export async function PUT(req: NextRequest) {
  const clientId = await getActiveClientId();
  const body = await req.json();
  const sb = supabaseServer();
  const rows = Object.entries(body).map(([key, value]) => ({
    client_id: clientId,
    key,
    value: String(value ?? ""),
    updated_at: new Date().toISOString(),
  }));
  const { error } = await sb.from("hm_settings").upsert(rows, { onConflict: "client_id,key" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
