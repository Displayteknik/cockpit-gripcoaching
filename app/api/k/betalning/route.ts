import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/customer-context";
import { supabaseService } from "@/lib/supabase-admin";
import { hamtaInstallningar } from "@/lib/billing/installningar";
import { statusbesked } from "@/lib/billing/status";
import { medMoms, nastaBetalningKlartext, INTERVALL_TEXT, type Intervall } from "@/lib/billing/avtal";

export const runtime = "nodejs";

// BETAL-1 (B-3) — kundens egen betalsida.
//
// ★ Den här routen får INTE gå via requireAdminOrCustomer: en spärrad kund måste kunna
// nå sin betalsida, annars kan hon inte betala sig ut ur spärren. Grinden är i stället
// kund-sessionen direkt, och tenanten resolvas alltid ur den HttpOnly-validerade token:en.
//
// Allt på svenska, klarspråk, inga tankstreck.

interface Kvitto {
  id: string;
  nummer: string | null;
  belopp: number;
  moms: number;
  status: string;
  datum: string | null;
  pdf: string | null;
  lank: string | null;
}

export async function GET() {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ error: "Ej inloggad" }, { status: 401 });

  const clientId = session.client_id;
  const sb = supabaseService();

  const [inst, { data: avtalData }, { data: planData }, { data: prenData }, { data: fakturor }, { data: kundData }] =
    await Promise.all([
      hamtaInstallningar(),
      sb.from("billing_avtal").select("*").eq("client_id", clientId).maybeSingle(),
      sb.from("billing_plans").select("id, label, beskrivning, belopp_sek").eq("active", true),
      sb.from("billing_subscriptions").select("*").eq("client_id", clientId).maybeSingle(),
      sb.from("billing_invoices")
        .select("stripe_invoice_id, nummer, belopp_sek, moms_sek, status, betald_datum, faktura_datum, invoice_pdf_url, hosted_invoice_url")
        .eq("client_id", clientId)
        .order("faktura_datum", { ascending: false })
        .limit(24),
      sb.from("billing_customers").select("stripe_customer_id").eq("client_id", clientId).maybeSingle(),
    ]);

  const avtal = avtalData as {
    plan_id: string | null; belopp_sek: number | null; intervall: Intervall; betalsatt: string;
    kalla: string; nasta_betalning: string | null; status: string;
  } | null;
  const planer = (planData || []) as Array<{ id: string; label: string; beskrivning: string | null; belopp_sek: number }>;
  const plan = avtal?.plan_id ? planer.find((p) => p.id === avtal.plan_id) || null : null;
  const pren = prenData as { stripe_status: string | null; current_period_end: string | null; cancel_at_period_end: boolean } | null;

  const belopp = Number(avtal?.belopp_sek) || Number(plan?.belopp_sek) || 0;

  // Stripe äger datumet när affären ligger där. Annars gäller det som står i avtalet.
  const nasta =
    avtal?.kalla === "stripe" && pren?.current_period_end ? pren.current_period_end.slice(0, 10) : avtal?.nasta_betalning || null;

  const kvitton: Kvitto[] = ((fakturor || []) as Array<Record<string, unknown>>).map((f) => ({
    id: f.stripe_invoice_id as string,
    nummer: (f.nummer as string) || null,
    belopp: Number(f.belopp_sek) || 0,
    moms: Number(f.moms_sek) || 0,
    status: (f.status as string) || "",
    datum: ((f.betald_datum || f.faktura_datum) as string) || null,
    pdf: (f.invoice_pdf_url as string) || null,
    lank: (f.hosted_invoice_url as string) || null,
  }));

  const harStripeKund = !!(kundData as { stripe_customer_id: string } | null)?.stripe_customer_id;

  return NextResponse.json({
    status: session.billing_status,
    besked: statusbesked(session.billing_status),
    plan: {
      namn: plan?.label || (avtal ? "Ditt abonnemang" : null),
      beskrivning: plan?.beskrivning || null,
      belopp_ex_moms: belopp,
      belopp_inkl_moms: medMoms(belopp, inst.momssats),
      momssats: inst.momssats,
      intervall_text: avtal ? INTERVALL_TEXT[avtal.intervall] : null,
      betalsatt: avtal?.betalsatt || null,
      aktivt: avtal ? avtal.status === "aktiv" : false,
      sags_upp: !!pren?.cancel_at_period_end,
    },
    nasta_betalning: nasta,
    nasta_betalning_text: nastaBetalningKlartext(nasta),
    kvitton,
    // Kortknappen visas bara när det finns ett kort att hantera hos Stripe.
    kan_hantera_kort: harStripeKund,
    foretag: { namn: inst.foretagsnamn, org_nr: inst.org_nr },
  });
}

/** POST — knapparna på sidan: portal-länk eller köp av tokens. */
export async function POST(req: Request) {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ error: "Ej inloggad" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { atgard?: string };
  const { stripeKonfigurerat, stripeFelText } = await import("@/lib/billing/stripe");

  if (!(await stripeKonfigurerat())) {
    return NextResponse.json(
      { ok: false, besked: "Kortbetalning är inte påslagen än. Hör av dig till din rådgivare så löser vi det." },
      { status: 503 },
    );
  }

  try {
    const ops = await import("@/lib/billing/stripe-ops");
    if (body.atgard === "portal") {
      return NextResponse.json({ ok: true, url: await ops.skapaPortalLank(session.client_id) });
    }
    if (body.atgard === "tokens") {
      return NextResponse.json({ ok: true, url: await ops.skapaTopupCheckout(session.client_id) });
    }
    return NextResponse.json({ ok: false, besked: "Okänd åtgärd." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, besked: `Det gick inte just nu. Stripe ${stripeFelText(e)}` }, { status: 500 });
  }
}
