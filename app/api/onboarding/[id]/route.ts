import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { supabaseService } from "@/lib/supabase-admin";

export const runtime = "nodejs";

/** Hämtar en onboarding-körning med förslag, status och provisioneringsstegen. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  const sb = supabaseService();
  const { data, error } = await sb
    .from("onboarding_korningar")
    .select("id, doman, url, epost, status, analys, forslag, client_id, ghl_location_id, steg, fel, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Körningen finns inte." }, { status: 404 });
  return NextResponse.json(data);
}

/**
 * Sparar Håkans redigeringar av förslaget.
 *
 * En körning som redan är 'klar' får inte ändras — förslaget är då en logg över vad som
 * faktiskt skapades, och skriver man om det stämmer det inte längre med kontot i GHL.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  let body: { forslag?: unknown; godkand?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }
  if (!body.forslag && body.godkand === undefined) {
    return NextResponse.json({ error: "Inget att spara." }, { status: 400 });
  }

  const sb = supabaseService();
  const { data: rad } = await sb.from("onboarding_korningar").select("status").eq("id", id).maybeSingle();
  if (!rad) return NextResponse.json({ error: "Körningen finns inte." }, { status: 404 });
  if (rad.status === "klar") {
    return NextResponse.json({ error: "Kontot är redan skapat — förslaget kan inte ändras i efterhand." }, { status: 409 });
  }

  const uppdatering: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.forslag) uppdatering.forslag = body.forslag;
  if (body.godkand === true) uppdatering.status = "godkand";

  const { error } = await sb.from("onboarding_korningar").update(uppdatering).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
