import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-admin";
import { getActiveClientId } from "@/lib/client-context";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest) {
  const { id, decision, edited_value }: { id: string; decision: "accepted" | "edited" | "skipped"; edited_value?: string } = await req.json();
  if (!id || !decision) return NextResponse.json({ error: "id + decision krävs" }, { status: 400 });
  const sb = supabaseServer();
  const clientId = await getActiveClientId();
  const { error } = await sb
    .from("intake_proposals")
    .update({ decision, edited_value: edited_value ?? null, decided_at: new Date().toISOString() })
    .eq("id", id)
    .eq("client_id", clientId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
