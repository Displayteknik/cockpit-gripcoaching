import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-admin";
import { getActiveClientId } from "@/lib/client-context";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest) {
  const { id, answer }: { id: string; answer: string } = await req.json();
  if (!id) return NextResponse.json({ error: "id krävs" }, { status: 400 });
  const sb = supabaseServer();
  const clientId = await getActiveClientId();

  const { data: clarif } = await sb.from("intake_clarifications").select("session_id").eq("id", id).single();
  if (!clarif) return NextResponse.json({ error: "Clarification saknas" }, { status: 404 });

  const { data: session } = await sb.from("intake_sessions").select("client_id").eq("id", clarif.session_id).single();
  if (session?.client_id !== clientId) return NextResponse.json({ error: "Otillåten" }, { status: 403 });

  await sb.from("intake_clarifications").update({ answer, answered_at: new Date().toISOString() }).eq("id", id);

  const { count } = await sb
    .from("intake_clarifications")
    .select("id", { count: "exact", head: true })
    .eq("session_id", clarif.session_id)
    .is("answered_at", null);
  if ((count ?? 0) === 0) {
    await sb.from("intake_sessions").update({ status: "reviewing", updated_at: new Date().toISOString() }).eq("id", clarif.session_id);
  }
  return NextResponse.json({ ok: true, remaining: count ?? 0 });
}
