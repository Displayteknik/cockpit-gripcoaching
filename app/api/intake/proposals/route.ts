import { NextRequest, NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase-admin";
import { getActiveClientId } from "@/lib/client-context";
import { requireAdminOrCustomer } from "@/lib/api-auth";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;
  const { id, decision, edited_value }: { id: string; decision: "accepted" | "edited" | "skipped"; edited_value?: string } = await req.json();
  if (!id || !decision) return NextResponse.json({ error: "id + decision krävs" }, { status: 400 });
  const sb = supabaseService();
  const clientId = await getActiveClientId();
  const { error } = await sb
    .from("intake_proposals")
    .update({ decision, edited_value: edited_value ?? null, decided_at: new Date().toISOString() })
    .eq("id", id)
    .eq("client_id", clientId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
