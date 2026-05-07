import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-admin";
import { getActiveClientId } from "@/lib/client-context";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sb = supabaseServer();
  const clientId = await getActiveClientId();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (id) {
    const [{ data: session }, { data: proposals }, { data: clarifications }] = await Promise.all([
      sb.from("intake_sessions").select("*").eq("id", id).eq("client_id", clientId).single(),
      sb.from("intake_proposals").select("*").eq("session_id", id).order("sort_order", { ascending: true }),
      sb.from("intake_clarifications").select("*").eq("session_id", id).order("sort_order", { ascending: true }),
    ]);
    if (!session) return NextResponse.json({ error: "Session saknas" }, { status: 404 });
    return NextResponse.json({ session, proposals: proposals ?? [], clarifications: clarifications ?? [] });
  }

  const { data, error } = await sb
    .from("intake_sessions")
    .select("id, source_type, source_label, status, confidence, transcript_excerpt, raw_analysis, created_at, committed_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sessions: data ?? [] });
}

export async function DELETE(req: NextRequest) {
  const sb = supabaseServer();
  const clientId = await getActiveClientId();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id krävs" }, { status: 400 });
  const { error } = await sb.from("intake_sessions").delete().eq("id", id).eq("client_id", clientId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
