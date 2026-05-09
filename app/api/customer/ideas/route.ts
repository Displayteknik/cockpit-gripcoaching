import { NextRequest, NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/customer-context";
import { supabaseService } from "@/lib/supabase-admin";

export const runtime = "nodejs";

// Klient godkänner/avvisar idé i sin portal.
// Endast den inloggade klientens ideas_bank-rader.
export async function POST(req: NextRequest) {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const id = body.id as string | undefined;
  const decision = body.decision as "approved" | "rejected" | undefined;
  if (!id || !decision || !["approved", "rejected"].includes(decision)) {
    return NextResponse.json({ error: "id och decision (approved/rejected) krävs" }, { status: 400 });
  }

  const sb = supabaseService();
  // Kontrollera att raden tillhor klienten
  const { data: row } = await sb
    .from("ideas_bank")
    .select("id, client_id")
    .eq("id", id)
    .maybeSingle();

  if (!row || (row as { client_id: string }).client_id !== session.client_id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const updates: Record<string, unknown> = {
    status: decision,
    approved_at: decision === "approved" ? new Date().toISOString() : null,
  };

  const { error } = await sb.from("ideas_bank").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Vid godkannande — skapa client_assets med category='winning_example' for voice-loopen
  if (decision === "approved") {
    const { data: full } = await sb
      .from("ideas_bank")
      .select("type, body, voice_score")
      .eq("id", id)
      .maybeSingle();
    if (full) {
      const f = full as { type: string; body: string; voice_score: number | null };
      const subcategory = f.type === "linkedin_post" ? "linkedin" : f.type === "mejl" ? "email" : f.type;
      await sb.from("client_assets").insert({
        client_id: session.client_id,
        asset_type: f.type,
        category: "winning_example",
        subcategory,
        body: f.body,
        voice_score: f.voice_score ?? 85,
        status: "active",
        source: "customer_portal_approval",
      });
    }
  }

  return NextResponse.json({ ok: true });
}
