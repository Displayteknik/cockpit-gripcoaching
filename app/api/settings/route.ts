import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET() {
  const sb = supabaseServer();
  const { data, error } = await sb.from("hm_settings").select("*");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const obj: Record<string, string> = {};
  for (const row of data || []) obj[row.key] = row.value;
  return NextResponse.json(obj);
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const sb = supabaseServer();
  const rows = Object.entries(body).map(([key, value]) => ({
    key,
    value: String(value ?? ""),
    updated_at: new Date().toISOString(),
  }));
  const { error } = await sb.from("hm_settings").upsert(rows, { onConflict: "key" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
