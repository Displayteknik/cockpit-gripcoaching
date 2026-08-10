// BETAL-1 — operationerna mot Stripe: kunder, produkter, Checkout och Customer Portal.
//
// Beslutade vägval (fråga inte om dessa igen):
//   · Kortbyte sker i Stripes Customer Portal, inte i en egen inbäddad lösning. Minst kod,
//     och kortuppgifter passerar aldrig vår server.
//   · Påfyllning av tokens går via Stripe Checkout och krediteras automatiskt när
//     sessionen är betald. Det ersätter K2:s manuella "owner godkänner order".
//
// Server-only (nodejs runtime).

import { supabaseService } from "../supabase-admin";
import { stripeKlient, kronorTillOre, stripeTidTillDatum, oreTillKronor } from "./stripe";
import { hamtaInstallningar } from "./installningar";
import { basadress as bas } from "./adress";

// ── Stripe-kund per tenant ──────────────────────────────────────────────────

/**
 * Hämtar eller skapar tenantens Stripe-kund och sparar mappningen.
 *
 * Mappningen kontrolleras mot LÄGET: en kund skapad i testläge finns inte i skarpt läge,
 * och att återanvända id:t hade gett "resource_missing" i exakt fel ögonblick.
 */
export async function sakerstallStripeKund(clientId: string): Promise<string> {
  const sb = supabaseService();
  const inst = await hamtaInstallningar();

  const { data } = await sb
    .from("billing_customers")
    .select("stripe_customer_id, lage")
    .eq("client_id", clientId)
    .maybeSingle();
  const befintlig = data as { stripe_customer_id: string; lage: string } | null;
  if (befintlig && befintlig.lage === inst.stripe_lage) return befintlig.stripe_customer_id;

  const { data: klient } = await sb.from("clients").select("name, slug").eq("id", clientId).maybeSingle();
  const { data: avtal } = await sb.from("billing_avtal").select("faktura_epost, kontaktperson").eq("client_id", clientId).maybeSingle();

  const stripe = await stripeKlient();
  const kund = await stripe.customers.create({
    name: (klient as { name: string } | null)?.name || undefined,
    email: (avtal as { faktura_epost: string } | null)?.faktura_epost || undefined,
    // Metadatan är brygga tillbaka hit när en webhook kommer utan vår egen referens.
    metadata: { client_id: clientId, slug: (klient as { slug: string } | null)?.slug || "" },
  });

  await sb.from("billing_customers").upsert(
    {
      client_id: clientId,
      stripe_customer_id: kund.id,
      epost: (avtal as { faktura_epost: string } | null)?.faktura_epost || null,
      lage: inst.stripe_lage,
    },
    { onConflict: "client_id" },
  );

  return kund.id;
}

/** Tenanten bakom ett Stripe-kund-id. Webhooks bär kundens id, inte vårt. */
export async function klientFranStripeKund(stripeCustomerId: string | null | undefined): Promise<string | null> {
  if (!stripeCustomerId) return null;
  try {
    const { data } = await supabaseService()
      .from("billing_customers")
      .select("client_id")
      .eq("stripe_customer_id", stripeCustomerId)
      .maybeSingle();
    return (data as { client_id: string } | null)?.client_id || null;
  } catch {
    return null;
  }
}

// ── Produkter och priser ────────────────────────────────────────────────────

export interface SyncSvar {
  ok: boolean;
  besked: string;
  skapade: string[];
}

/**
 * Skapar de planer som saknar pris i Stripe och sparar id:t. Idempotent: en plan som
 * redan har ett stripe_price_id lämnas orörd, för ett pris i Stripe går inte att ändra
 * i efterhand utan att skapa ett nytt.
 *
 * Momsen sköts av Stripe Tax. Priserna läggs in EX moms med tax_behavior 'exclusive',
 * så momsen räknas på och syns som egen rad på kvittot.
 */
export async function synkaPlanerTillStripe(): Promise<SyncSvar> {
  const sb = supabaseService();
  const stripe = await stripeKlient();
  const { data } = await sb.from("billing_plans").select("*").eq("active", true).order("sort_order");
  const planer = (data || []) as Array<{
    id: string; label: string; beskrivning: string | null; typ: string;
    belopp_sek: number; intervall: string; stripe_price_id: string | null; stripe_product_id: string | null;
  }>;

  const skapade: string[] = [];
  for (const p of planer) {
    if (p.stripe_price_id) continue;
    try {
      const produkt = p.stripe_product_id
        ? await stripe.products.retrieve(p.stripe_product_id)
        : await stripe.products.create({
            name: p.label,
            description: p.beskrivning || undefined,
            metadata: { plan_id: p.id },
          });

      const aterkommande =
        p.typ === "abonnemang" && p.intervall !== "engang"
          ? {
              recurring: {
                interval: (p.intervall === "ar" ? "year" : "month") as "year" | "month",
                interval_count: p.intervall === "kvartal" ? 3 : 1,
              },
            }
          : {};

      const pris = await stripe.prices.create({
        product: produkt.id,
        currency: "sek",
        unit_amount: kronorTillOre(p.belopp_sek),
        tax_behavior: "exclusive", // priset är ex moms, Stripe Tax lägger på svensk moms
        metadata: { plan_id: p.id },
        ...aterkommande,
      });

      await sb
        .from("billing_plans")
        .update({ stripe_product_id: produkt.id, stripe_price_id: pris.id })
        .eq("id", p.id);
      skapade.push(p.label);
    } catch (e) {
      const { stripeFelText } = await import("./stripe");
      return { ok: false, besked: `Kunde inte skapa "${p.label}" i Stripe: ${stripeFelText(e)}`, skapade };
    }
  }

  return {
    ok: true,
    besked: skapade.length
      ? `Klart. Skapade ${skapade.length} i Stripe: ${skapade.join(", ")}.`
      : "Alla planer finns redan i Stripe. Ingenting behövde skapas.",
    skapade,
  };
}

// ── Checkout ────────────────────────────────────────────────────────────────


/**
 * Checkout-session för ett engångsköp av tokens. Krediteringen sker INTE här utan i
 * webhooken när sessionen är betald — en session som skapas är inte en session som
 * betalas, och tokens som delas ut i förskott går inte att ta tillbaka.
 */
export async function skapaTopupCheckout(clientId: string, planId = "topup_100"): Promise<string> {
  const sb = supabaseService();
  const { data } = await sb.from("billing_plans").select("*").eq("id", planId).eq("active", true).maybeSingle();
  const plan = data as { id: string; label: string; belopp_sek: number; credits: number | null; stripe_price_id: string | null } | null;
  if (!plan) throw new Error("Det gick inte att hitta paketet just nu. Försök igen om en stund.");

  const stripe = await stripeKlient();
  const kundId = await sakerstallStripeKund(clientId);

  const rad = plan.stripe_price_id
    ? { price: plan.stripe_price_id, quantity: 1 }
    : {
        // Utan färdigt pris i Stripe byggs raden här, så köpet fungerar även innan
        // planerna hunnit synkas. Samma belopp, samma moms.
        price_data: {
          currency: "sek",
          unit_amount: kronorTillOre(plan.belopp_sek),
          tax_behavior: "exclusive" as const,
          product_data: { name: plan.label },
        },
        quantity: 1,
      };

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: kundId,
    line_items: [rad],
    automatic_tax: { enabled: true },
    customer_update: { address: "auto" },
    // ★ Metadatan är hela kopplingen tillbaka: webhooken vet vem som ska krediteras
    // och med hur mycket, utan att behöva gissa ur beloppet.
    metadata: { client_id: clientId, plan_id: plan.id, credits: String(plan.credits || 0), syfte: "topup" },
    success_url: `${bas()}/k/betalning?kop=klart`,
    cancel_url: `${bas()}/k/betalning?kop=avbrutet`,
    locale: "sv",
  });

  if (!session.url) throw new Error("Stripe gav ingen betallänk tillbaka.");
  return session.url;
}

/** Checkout för att teckna abonnemanget. Används när en kund ska börja betala med kort. */
export async function skapaAbonnemangCheckout(clientId: string, planId: string): Promise<string> {
  const sb = supabaseService();
  const { data } = await sb.from("billing_plans").select("*").eq("id", planId).eq("active", true).maybeSingle();
  const plan = data as { id: string; label: string; belopp_sek: number; intervall: string; stripe_price_id: string | null } | null;
  if (!plan) throw new Error("Planen hittades inte.");
  if (!plan.stripe_price_id) throw new Error("Planen saknar pris i Stripe. Kör Skapa i Stripe först.");

  const stripe = await stripeKlient();
  const kundId = await sakerstallStripeKund(clientId);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: kundId,
    line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
    automatic_tax: { enabled: true },
    customer_update: { address: "auto", name: "auto" },
    metadata: { client_id: clientId, plan_id: plan.id, syfte: "abonnemang" },
    subscription_data: { metadata: { client_id: clientId, plan_id: plan.id } },
    success_url: `${bas()}/k/betalning?tecknat=klart`,
    cancel_url: `${bas()}/k/betalning`,
    locale: "sv",
  });

  if (!session.url) throw new Error("Stripe gav ingen betallänk tillbaka.");
  return session.url;
}

// ── Dragning på kundens redan sparade kort ──────────────────────────────────
//
// Har kunden lagt in sitt kort en gång ska en påfyllning bara dras på det. Att skicka
// henne genom en ny betalsida och be om kortet igen är att låtsas att vi inte redan
// känner henne.

export interface Sparatkort {
  marke: string;      // "visa", "mastercard" …
  sista_fyra: string;
  giltigt_till: string; // "09/28"
}

/**
 * Id på kortet vi ska dra på: standardkortet först, annars det första sparade.
 * Kunden har i praktiken bara ett, och att svara "inget kort" när ett finns vore fel.
 */
async function hittaKortId(stripeKundId: string): Promise<string | null> {
  const stripe = await stripeKlient();
  const kund = await stripe.customers.retrieve(stripeKundId);
  if (kund.deleted) return null;

  const standard = kund.invoice_settings?.default_payment_method;
  if (standard) return typeof standard === "string" ? standard : standard.id;

  const lista = await stripe.paymentMethods.list({ customer: stripeKundId, type: "card", limit: 1 });
  return lista.data[0]?.id || null;
}

/** Kundens sparade kort, eller null när inget finns. Kastar aldrig. */
export async function hamtaSparatKort(clientId: string): Promise<Sparatkort | null> {
  try {
    const sb = supabaseService();
    const { data } = await sb.from("billing_customers").select("stripe_customer_id").eq("client_id", clientId).maybeSingle();
    const kundId = (data as { stripe_customer_id: string } | null)?.stripe_customer_id;
    if (!kundId) return null;

    const pmId = await hittaKortId(kundId);
    if (!pmId) return null;

    const stripe = await stripeKlient();
    const pm = await stripe.paymentMethods.retrieve(pmId);
    if (!pm.card) return null;

    return {
      marke: pm.card.brand,
      sista_fyra: pm.card.last4,
      giltigt_till: `${String(pm.card.exp_month).padStart(2, "0")}/${String(pm.card.exp_year).slice(-2)}`,
    };
  } catch {
    // Inget sparat kort är ett normalt läge, inte ett fel att skrika om.
    return null;
  }
}

export interface Dragningssvar {
  ok: boolean;
  /** true = tokens är tillagda och saldot är redan uppdaterat. */
  krediterat: boolean;
  besked: string;
  /** Satt när kunden måste göra något själv, t.ex. bekräfta med BankID hos sin bank. */
  url?: string;
}

/**
 * Drar beloppet direkt på kundens sparade kort och krediterar tokens med en gång.
 *
 * `off_session` betyder att kunden inte står vid skärmen ur bankens perspektiv, och då
 * kan banken kräva att hon bekräftar. Det är inte ett fel utan ett helt normalt utfall —
 * då skickar vi henne till betalsidan i stället, med samma köp.
 */
export async function dragPaSparatKort(clientId: string, planId = "topup_100"): Promise<Dragningssvar> {
  const sb = supabaseService();
  const { data } = await sb.from("billing_plans").select("*").eq("id", planId).eq("active", true).maybeSingle();
  const plan = data as { id: string; label: string; belopp_sek: number; credits: number | null } | null;
  if (!plan) return { ok: false, krediterat: false, besked: "Det gick inte att hitta paketet just nu." };

  const kort = await hamtaSparatKort(clientId);
  if (!kort) {
    // Inget kort sparat → gå den vanliga vägen i stället för att svara med ett fel.
    return { ok: true, krediterat: false, besked: "Vi skickar dig vidare till betalningen.", url: await skapaTopupCheckout(clientId, planId) };
  }

  try {
    const stripe = await stripeKlient();
    const kundId = await sakerstallStripeKund(clientId);
    const pmId = await hittaKortId(kundId);

    if (!pmId) {
      return { ok: true, krediterat: false, besked: "Vi skickar dig vidare till betalningen.", url: await skapaTopupCheckout(clientId, planId) };
    }

    const intent = await stripe.paymentIntents.create({
      amount: kronorTillOre(plan.belopp_sek),
      currency: "sek",
      customer: kundId,
      payment_method: pmId,
      off_session: true,
      confirm: true,
      description: plan.label,
      metadata: { client_id: clientId, plan_id: plan.id, credits: String(plan.credits || 0), syfte: "topup" },
    });

    if (intent.status === "succeeded") {
      const { laggTillCredits } = await import("../credits");
      const antal = plan.credits || 0;
      // Referensen gör krediteringen idempotent: kommer webhooken efteråt om samma
      // betalning händer ingenting en andra gång.
      await laggTillCredits({
        tenantId: clientId,
        credits: antal,
        typ: "topup",
        note: `Påfyllning betald med sparat kort (${antal} tokens).`,
        createdBy: "stripe",
        externReferens: intent.id,
      });
      return {
        ok: true,
        krediterat: true,
        besked: `Klart. ${antal} tokens är tillagda och dragna på kortet som slutar på ${kort.sista_fyra}.`,
      };
    }

    // Banken vill ha en bekräftelse → samma köp, men kunden får göra det själv.
    return { ok: true, krediterat: false, besked: "Din bank vill att du bekräftar köpet.", url: await skapaTopupCheckout(clientId, planId) };
  } catch (e) {
    const fel = e as { code?: string; message?: string };
    // Kortet nekades eller kräver bekräftelse. Båda löses av att kunden går till betalsidan.
    if (fel.code === "authentication_required" || fel.code === "card_declined" || fel.code === "expired_card") {
      const url = await skapaTopupCheckout(clientId, planId).catch(() => undefined);
      return {
        ok: true,
        krediterat: false,
        besked:
          fel.code === "authentication_required"
            ? "Din bank vill att du bekräftar köpet."
            : "Kortet gick inte igenom. Prova igen eller använd ett annat kort.",
        url,
      };
    }
    const { stripeFelText } = await import("./stripe");
    return { ok: false, krediterat: false, besked: `Betalningen gick inte igenom. Stripe ${stripeFelText(e)}` };
  }
}

// ── Customer Portal ─────────────────────────────────────────────────────────

/** Portalsession för kortbyte och kvitton. Länken är engångs och kortlivad. */
export async function skapaPortalLank(clientId: string): Promise<string> {
  const stripe = await stripeKlient();
  const kundId = await sakerstallStripeKund(clientId);
  const session = await stripe.billingPortal.sessions.create({
    customer: kundId,
    return_url: `${bas()}/k/betalning`,
    locale: "sv",
  });
  return session.url;
}

// ── Nästa debitering ────────────────────────────────────────────────────────

export interface NastaDebitering {
  belopp_sek: number;
  belopp_ex_moms_sek: number;
  moms_sek: number;
  datum: string | null;
}

/**
 * Kommande faktura direkt från Stripe. Returnerar null när kunden inte har något
 * abonnemang där — då är det avtalet i billing_avtal som gäller, och det är sant.
 */
export async function hamtaNastaDebitering(clientId: string): Promise<NastaDebitering | null> {
  try {
    const sb = supabaseService();
    const { data } = await sb.from("billing_customers").select("stripe_customer_id").eq("client_id", clientId).maybeSingle();
    const kundId = (data as { stripe_customer_id: string } | null)?.stripe_customer_id;
    if (!kundId) return null;

    const stripe = await stripeKlient();
    // Typen finns inte i alla SDK-versioner under samma namn; anropet är stabilt.
    const kommande = await (stripe.invoices as unknown as {
      retrieveUpcoming: (p: { customer: string }) => Promise<{
        total: number; subtotal: number; tax: number | null; next_payment_attempt: number | null; period_end: number | null;
      }>;
    }).retrieveUpcoming({ customer: kundId });

    return {
      belopp_sek: oreTillKronor(kommande.total),
      belopp_ex_moms_sek: oreTillKronor(kommande.subtotal),
      moms_sek: oreTillKronor(kommande.tax || 0),
      datum: stripeTidTillDatum(kommande.next_payment_attempt || kommande.period_end),
    };
  } catch {
    // Ingen kommande faktura är ett helt normalt läge, inte ett fel att skrika om.
    return null;
  }
}
