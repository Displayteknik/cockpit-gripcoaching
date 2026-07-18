import { NextRequest, NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase-admin";
import { getActiveClientId } from "@/lib/client-context";
import { requireAdminOrCustomer } from "@/lib/api-auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;
  const sb = supabaseService(); // ikigai_sessions har RLS på → service-role; tenant-scopad via clientId nedan
  const clientId = await getActiveClientId();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (id) {
    const { data, error } = await sb
      .from("ikigai_sessions")
      .select("*")
      .eq("id", id)
      .eq("client_id", clientId)
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json(data);
  }

  const { data, error } = await sb
    .from("ikigai_sessions")
    .select("id, person_name, person_email, source, status, intake_session_id, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sessions: data ?? [] });
}

export async function DELETE(req: NextRequest) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;
  const sb = supabaseService(); // ikigai_sessions har RLS på → service-role; tenant-scopad via clientId nedan
  const clientId = await getActiveClientId();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id krävs" }, { status: 400 });
  const { error } = await sb.from("ikigai_sessions").delete().eq("id", id).eq("client_id", clientId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
