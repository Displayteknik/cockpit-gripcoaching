import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET() {
  const sb = supabaseServer();
  const { data, error } = await sb
    .from("hm_social_posts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, ...rest } = body;
  const sb = supabaseServer();
  const { data, error } = await sb
    .from("hm_social_posts")
    .update({ ...rest, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id krävs" }, { status: 400 });
  const sb = supabaseServer();
  const { error } = await sb.from("hm_social_posts").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
