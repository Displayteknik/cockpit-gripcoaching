import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-admin";
import { getActiveClientId } from "@/lib/client-context";

export const runtime = "nodejs";

// Listar idéer fran ideas_bank for aktiv klient.
export async function GET(req: NextRequest) {
  const sb = supabaseServer();
  const clientId = await getActiveClientId();
  const status = req.nextUrl.searchParams.get("status") || "pending";
  const type = req.nextUrl.searchParams.get("type");

  let q = sb
    .from("ideas_bank")
    .select("*")
    .eq("client_id", clientId)
    .eq("status", status)
    .order("voice_score", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(50);

  if (type) q = q.eq("type", type);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ideas: data ?? [] });
}

// Uppdatera status pa en idé (godkanna/avslå).
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, status } = body;
  if (!id || !status) return NextResponse.json({ error: "id + status kravs" }, { status: 400 });
  if (!["approved", "rejected", "used"].includes(status)) {
    return NextResponse.json({ error: "ogiltig status" }, { status: 400 });
  }
  const sb = supabaseServer();
  const updates: Record<string, unknown> = { status };
  if (status === "approved") updates.approved_at = new Date().toISOString();
  if (status === "used") updates.used_at = new Date().toISOString();
  const { error } = await sb.from("ideas_bank").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
