import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET() {
  const sb = supabaseServer();
  const { data, error } = await sb.from("hm_seo_keywords").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const sb = supabaseServer();
  const rows = Array.isArray(body) ? body : [body];
  const { data, error } = await sb.from("hm_seo_keywords").insert(rows).select();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, ...rest } = body;
  const sb = supabaseServer();
  const update: Record<string, unknown> = { ...rest };
  if (rest.current_rank !== undefined) {
    update.last_checked = new Date().toISOString();
    // Update best_rank
    const { data: existing } = await sb.from("hm_seo_keywords").select("best_rank").eq("id", id).single();
    const best = existing?.best_rank;
    const cur = rest.current_rank;
    if (cur && (!best || cur < best)) update.best_rank = cur;
  }
  const { data, error } = await sb.from("hm_seo_keywords").update(update).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id krävs" }, { status: 400 });
  const sb = supabaseServer();
  const { error } = await sb.from("hm_seo_keywords").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
