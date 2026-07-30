import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { supabaseService } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const IMPOSSIBLE_ID = "00000000-0000-0000-0000-000000000000";

// ANSLUT-1: status för ägar-kopplingen. Returnerar ALDRIG token — bara namn/expiry/status.
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const sb = supabaseService();
  const { data } = await sb
    .from("meta_owner_connection")
    .select("fb_user_name, token_expires_at, scopes, status, last_checked_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    connected: !!data,
    fb_user_name: data?.fb_user_name || null,
    token_expires_at: data?.token_expires_at || null,
    scopes: data?.scopes || [],
    status: data?.status || null,
    last_checked_at: data?.last_checked_at || null,
  });
}

export async function DELETE() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const sb = supabaseService();
  await sb.from("meta_owner_connection").delete().neq("id", IMPOSSIBLE_ID);
  return NextResponse.json({ ok: true });
}
