import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-admin";
import { getActiveClientId } from "@/lib/client-context";

export const runtime = "nodejs";

export async function GET() {
  const clientId = await getActiveClientId();
  const sb = supabaseServer();
  const { data, error } = await sb.from("competitors").select("*").eq("client_id", clientId).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const clientId = await getActiveClientId();
  const body = await req.json();
  const sb = supabaseServer();
  const { data, error } = await sb.from("competitors").insert({ ...body, client_id: clientId }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const clientId = await getActiveClientId();
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id krävs" }, { status: 400 });
  const sb = supabaseServer();
  await sb.from("competitors").delete().eq("id", id).eq("client_id", clientId);
  return NextResponse.json({ ok: true });
}
