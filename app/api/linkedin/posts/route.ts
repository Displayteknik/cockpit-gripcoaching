import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-admin";
import { getActiveClientId } from "@/lib/client-context";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sb = supabaseServer();
  const clientId = await getActiveClientId();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const pillar = searchParams.get("pillar");
  let q = sb
    .from("linkedin_posts")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  if (pillar) q = q.eq("pillar", pillar);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ posts: data ?? [] });
}

export async function PATCH(req: NextRequest) {
  const sb = supabaseServer();
  const clientId = await getActiveClientId();
  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: "id krävs" }, { status: 400 });
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of [
    "status",
    "pillar",
    "format",
    "trust_gate",
    "hook",
    "body",
    "hashtags",
    "cta",
    "length",
    "scheduled_for",
    "posted_at",
    "posted_url",
    "notes",
    "metrics",
  ]) {
    if (body[k] !== undefined) updates[k] = body[k];
  }
  const { data, error } = await sb
    .from("linkedin_posts")
    .update(updates)
    .eq("id", body.id)
    .eq("client_id", clientId)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ post: data });
}

export async function DELETE(req: NextRequest) {
  const sb = supabaseServer();
  const clientId = await getActiveClientId();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id krävs" }, { status: 400 });
  const { error } = await sb.from("linkedin_posts").delete().eq("id", id).eq("client_id", clientId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
