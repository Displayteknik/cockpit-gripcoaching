import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/customer-context";
import { supabaseService } from "@/lib/supabase-admin";
import { hamtaSaldo, skapaTopupOrder, creditPris, forbrukningKlartext, TOPUP_CREDITS, TOPUP_PRIS_SEK, CREDIT_MODUL } from "@/lib/credits";

export const runtime = "nodejs";

// ETAPP K2-2, utbyggd i BETAL-1 — kundens egen tokenvy. Klienten resolvas ALLTID ur den
// HttpOnly-validerade kund-sessionen: kunden kan aldrig se eller fylla på en annan
// tenants saldo.
//
// Kunden ser aldrig kronor för sin förbrukning. Förbrukningen skrivs i klartext
// ("14 bilder, 1 video"), för ett tokenbelopp säger inget om vad man faktiskt fått.
//
// NAMN: kundvänt heter det tokens. Internt heter det credits, och det gör det även här —
// fältnamnen i svaret är oförändrade så inget som redan läser dem går sönder.

export async function GET() {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ error: "Ej inloggad" }, { status: 401 });
  if (session.billing_status === "sparrad") {
    const { SPARRAD_API_BESKED } = await import("@/lib/billing/status");
    return NextResponse.json({ error: SPARRAD_API_BESKED, betalsparr: true }, { status: 402 });
  }
  if (!session.features.includes(CREDIT_MODUL)) {
    return NextResponse.json({ error: "Saknar behörighet" }, { status: 403 });
  }

  const tenantId = session.client_id;
  const saldo = await hamtaSaldo(tenantId);
  if (!saldo) return NextResponse.json({ error: "Kunde inte läsa saldot" }, { status: 500 });

  const sb = supabaseService();
  const [{ data: tx }, { data: pending }, priser, planRes, stripePa, kort] = await Promise.all([
    sb.from("credit_transactions")
      .select("created_at, delta, type, note")
      .eq("tenant_id", tenantId)
      .gte("created_at", `${saldo.periodStart}T00:00:00Z`)
      .order("created_at", { ascending: false })
      .limit(200),
    sb.from("topup_orders").select("id, credits, created_at").eq("tenant_id", tenantId).eq("status", "pending").maybeSingle(),
    Promise.all((["social-bild", "hero-bild", "video"] as const).map(async (a) => [a, await creditPris(a)] as const)),
    sb.from("billing_plans").select("credits, belopp_sek").eq("id", "topup_100").maybeSingle(),
    import("@/lib/billing/stripe").then((m) => m.stripeKonfigurerat()),
    import("@/lib/billing/stripe-ops").then((m) => m.hamtaSparatKort(tenantId)).catch(() => null),
  ]);

  const rader = (tx || []) as Array<{ created_at: string; delta: number; type: string; note: string | null }>;
  const pris = Object.fromEntries(priser) as Record<string, number>;
  const plan = planRes.data as { credits: number | null; belopp_sek: number } | null;

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
    topup: {
      credits: plan?.credits || TOPUP_CREDITS,
      pris: Number(plan?.belopp_sek) || TOPUP_PRIS_SEK,
      // true = köpet går direkt via kort. false = beställning som Håkan godkänner (gamla vägen).
      direktkop: stripePa,
      // Satt när kunden redan har ett kort hos oss. Då dras beloppet på det, och knappen
      // säger vilket kort det gäller i stället för att bara heta "fyll på".
      kort: kort ? { marke: kort.marke, sista_fyra: kort.sista_fyra } : null,
    },
  });
}

/**
 * POST — fyll på tokens.
 *
 * Två vägar, och den gamla behålls tills den nya är bevisad i skarp drift:
 *   · Stripe kopplat → Checkout-länk tillbaka. Saldot ökar först när betalningen är klar,
 *     via webhooken. Tokens som delas ut i förskott går inte att ta tillbaka.
 *   · Stripe inte kopplat → beställning som Håkan godkänner, precis som förut.
 */
export async function POST() {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ error: "Ej inloggad" }, { status: 401 });
  if (session.billing_status === "sparrad") {
    const { SPARRAD_API_BESKED } = await import("@/lib/billing/status");
    return NextResponse.json({ error: SPARRAD_API_BESKED, betalsparr: true }, { status: 402 });
  }
  if (!session.features.includes(CREDIT_MODUL)) {
    return NextResponse.json({ error: "Saknar behörighet" }, { status: 403 });
  }

  const { stripeKonfigurerat } = await import("@/lib/billing/stripe");
  if (await stripeKonfigurerat()) {
    try {
      // ★ Har kunden redan lagt in sitt kort dras beloppet direkt på det. Att skicka
      // henne genom en ny betalsida och be om kortet igen vore att låtsas att vi inte
      // redan känner henne. Saknas kort, eller vill banken ha en bekräftelse, får hon
      // en betallänk tillbaka i stället — samma köp, andra vägen.
      const { dragPaSparatKort } = await import("@/lib/billing/stripe-ops");
      const r = await dragPaSparatKort(session.client_id);
      return NextResponse.json(r, { status: r.ok ? 200 : 500 });
    } catch (e) {
      const { stripeFelText } = await import("@/lib/billing/stripe");
      return NextResponse.json(
        { ok: false, besked: `Betalningen kunde inte startas. Stripe ${stripeFelText(e)}` },
        { status: 500 },
      );
    }
  }

  const r = await skapaTopupOrder(session.client_id);
  return NextResponse.json(r, { status: r.ok ? 200 : 500 });
}
