import { NextResponse } from "next/server";
import { requireAdminOrCustomer } from "@/lib/api-auth";
import { getActiveClientId } from "@/lib/client-context";
import { resolveCoachContext, resolveCoachGhl } from "@/lib/coach-bridge";
import { supabaseService } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const BASE = "https://services.leadconnectorhq.com";

// POST /api/fokus/plan
//   Skapa: { oppId, ghlContactId?, kanal, dueAt, note?, kontaktNamn? } → planerar en kontakt
//          (fokus_planering = "Att göra idag"-källan) + skapar en uppgift i MySales/GHL (best-effort).
//   Klar:  { planId, done: true } → markerar planeringen utförd.
// Tenant-låst via bryggan. GHL-uppgiften skapas via kundens knapptryck.
export async function POST(req: Request) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;

  let body: {
    oppId?: string;
    ghlContactId?: string;
    kanal?: string;
    dueAt?: string;
    note?: string;
    kontaktNamn?: string;
    planId?: string;
    done?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 });
  }

  const clientId = await getActiveClientId();
  const ctx = await resolveCoachContext(clientId);
  if (!ctx.ids.length) return NextResponse.json({ error: "Ingen Coach-koppling" }, { status: 400 });
  const sb = supabaseService();

  // ── Markera klar ──
  if (body.planId && body.done) {
    const { error } = await sb
      .from("fokus_planering")
      .update({ status: "done", done_at: new Date().toISOString() })
      .eq("id", body.planId)
      .in("tenant_id", ctx.ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // ── Skapa planering ──
  const { oppId, ghlContactId, kanal = "ring", dueAt, note, kontaktNamn } = body;
  if (!oppId || !dueAt) return NextResponse.json({ error: "oppId och dueAt krävs" }, { status: 400 });

  // Kanonisk tenant + opp-uuid (samma mönster som coachen).
  const { data: oppRows } = await sb
    .from("fokus_opportunities")
    .select("id, tenant_id, ghl_contact_id")
    .in("tenant_id", ctx.ids)
    .eq("ghl_opportunity_id", oppId)
    .order("tenant_id", { ascending: true });
  const canon = (oppRows as { id: string; tenant_id: string; ghl_contact_id: string | null }[] | null)?.[0] || null;
  if (!canon) return NextResponse.json({ error: "Affär ej hittad" }, { status: 404 });
  const contactId = ghlContactId || canon.ghl_contact_id || "";

  // Ersätt ev. tidigare öppen planering på samma affär (en aktiv plan i taget).
  await sb
    .from("fokus_planering")
    .update({ status: "superseded" })
    .eq("tenant_id", canon.tenant_id)
    .eq("ghl_opportunity_id", oppId)
    .eq("status", "open");

  // Skapa GHL-uppgift (best-effort — planeringen gäller även om GHL failar).
  let ghlTaskId: string | null = null;
  try {
    const { token } = await resolveCoachGhl(clientId);
    if (token && contactId) {
      const gh = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Version: "2021-07-28" };
      const titel = `${kanal === "mejl" ? "Mejla" : "Ring"} ${kontaktNamn || "kund"}`;
      const r = await fetch(`${BASE}/contacts/${contactId}/tasks`, {
        method: "POST",
        headers: gh,
        body: JSON.stringify({ title: titel, body: note || "Planerad via Fokus idag", dueDate: dueAt, completed: false }),
      });
      if (r.ok) {
        const d = await r.json().catch(() => ({}));
        ghlTaskId = d?.task?.id || d?.id || null;
      }
    }
  } catch {
    // strunt — planeringen sparas ändå
  }

  const { data: ins, error } = await sb
    .from("fokus_planering")
    .insert({
      tenant_id: canon.tenant_id,
      opportunity_id: canon.id,
      ghl_opportunity_id: oppId,
      ghl_contact_id: contactId || null,
      kanal,
      due_at: dueAt,
      note: note || null,
      status: "open",
      ghl_task_id: ghlTaskId,
    })
    .select("id, due_at, kanal")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, planering: ins, ghlTask: !!ghlTaskId });
}
