import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-admin";
import { getActiveClientId } from "@/lib/client-context";

export const runtime = "nodejs";

export async function GET() {
  const sb = supabaseServer();
  const clientId = await getActiveClientId();
  const { data, error } = await sb
    .from("linkedin_pillars")
    .select("*")
    .eq("client_id", clientId)
    .eq("archived", false)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ pillars: data ?? [] });
}

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const clientId = await getActiveClientId();
  const body = await req.json();
  const { data, error } = await sb
    .from("linkedin_pillars")
    .insert({ client_id: clientId, name: body.name, description: body.description ?? null, sort_order: body.sort_order ?? 0 })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ pillar: data });
}

export async function PATCH(req: NextRequest) {
  const sb = supabaseServer();
  const clientId = await getActiveClientId();
  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: "id krävs" }, { status: 400 });
  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.description !== undefined) updates.description = body.description;
  if (body.sort_order !== undefined) updates.sort_order = body.sort_order;
  if (body.archived !== undefined) updates.archived = body.archived;
  const { data, error } = await sb
    .from("linkedin_pillars")
    .update(updates)
    .eq("id", body.id)
    .eq("client_id", clientId)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ pillar: data });
}

export async function DELETE(req: NextRequest) {
  const sb = supabaseServer();
  const clientId = await getActiveClientId();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id krävs" }, { status: 400 });
  const { error } = await sb.from("linkedin_pillars").delete().eq("id", id).eq("client_id", clientId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
