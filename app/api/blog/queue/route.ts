import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET() {
  const sb = supabaseServer();
  const { data, error } = await sb
    .from("hm_blog_queue")
    .select("*")
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const sb = supabaseServer();
  const rows = Array.isArray(body) ? body : [body];
  const { data, error } = await sb.from("hm_blog_queue").insert(rows).select();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id krävs" }, { status: 400 });
  const sb = supabaseServer();
  const { error } = await sb.from("hm_blog_queue").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
