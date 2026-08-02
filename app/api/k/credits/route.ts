import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/customer-context";
import { supabaseService } from "@/lib/supabase-admin";
import { hamtaSaldo, skapaTopupOrder, creditPris, forbrukningKlartext, TOPUP_CREDITS, TOPUP_PRIS_SEK, CREDIT_MODUL } from "@/lib/credits";

export const runtime = "nodejs";

// ETAPP K2-2 — kundens egen creditvy. Klienten resolvas ALLTID ur den HttpOnly-validerade
// kund-sessionen: kunden kan aldrig se eller fylla på en annan tenants saldo.
//
// Kunden ser aldrig kronor. Förbrukningen skrivs i klartext ("14 bilder, 1 video"),
// för credits är en abstraktion och siffran ensam säger inget om vad man fått.

export async function GET() {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ error: "Ej inloggad" }, { status: 401 });
  if (!session.features.includes(CREDIT_MODUL)) {
    return NextResponse.json({ error: "Saknar behörighet" }, { status: 403 });
  }

  const tenantId = session.client_id;
  const saldo = await hamtaSaldo(tenantId);
  if (!saldo) return NextResponse.json({ error: "Kunde inte läsa saldot" }, { status: 500 });

  const sb = supabaseService();
  const [{ data: tx }, { data: pending }, priser] = await Promise.all([
    sb.from("credit_transactions")
      .select("created_at, delta, type, note")
      .eq("tenant_id", tenantId)
      .gte("created_at", `${saldo.periodStart}T00:00:00Z`)
      .order("created_at", { ascending: false })
      .limit(200),
    sb.from("topup_orders").select("id, credits, created_at").eq("tenant_id", tenantId).eq("status", "pending").maybeSingle(),
    Promise.all((["social-bild", "hero-bild", "video"] as const).map(async (a) => [a, await creditPris(a)] as const)),
  ]);

  const rader = (tx || []) as Array<{ created_at: string; delta: number; type: string; note: string | null }>;
  const pris = Object.fromEntries(priser) as Record<string, number>;

  // Antal per åtgärd räknas ur credits delat med priset — transaktionen bär åtgärden i note.
  const antal: Record<string, number> = {};
  for (const r of rader) {
    if (r.type !== "usage" || !r.note) continue;
    const styck = pris[r.note] || 1;
    antal[r.note] = (antal[r.note] || 0) + Math.max(1, Math.round(Math.abs(r.delta) / styck));
  }

  return NextResponse.json({
    saldo: saldo.saldo,
    kvot: saldo.kvot,
    extra: saldo.extra,
    anvant: saldo.anvant,
    procentKvar: saldo.procentKvar,
    periodStart: saldo.periodStart,
    forbrukning: forbrukningKlartext(antal),
    antal,
    priser: pris,
    historik: rader.slice(0, 50),
    pending: pending || null,
    topup: { credits: TOPUP_CREDITS, pris: TOPUP_PRIS_SEK },
  });
}

// POST — beställ en påfyllning. Ingen betalning här: owner godkänner och fakturerar utanför.
export async function POST() {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ error: "Ej inloggad" }, { status: 401 });
  if (!session.features.includes(CREDIT_MODUL)) {
    return NextResponse.json({ error: "Saknar behörighet" }, { status: 403 });
  }
  const r = await skapaTopupOrder(session.client_id);
  return NextResponse.json(r, { status: r.ok ? 200 : 500 });
}
