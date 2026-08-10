// BETAL-1c — koppla ihop Cockpit med det som REDAN finns i Stripe.
//
// ⚠ Utgångspunkten ändrades 2026-08-10: Håkan har inte ett tomt Stripe-konto. Han har
// produkter, priser och löpande abonnemang som kunderna tecknat via betallänkar, och
// pengar som rullar in varje månad.
//
// Därför får systemet ALDRIG skapa nytt vid sidan av. En andra produkt med samma namn
// och pris ger dubbletter i katalogen, och ett andra abonnemang skulle dubbeldebitera en
// riktig kund. Den här filen läser i stället vad som finns och låter Håkan peka ut vilken
// Cockpit-kund varje Stripe-kund är.
//
// Matchningen föreslås men bestäms aldrig automatiskt. Ett felkopplat abonnemang skickar
// en påminnelse till fel företag, och det är värre än att han får klicka tretton gånger.
//
// Server-only.

import { supabaseService } from "../supabase-admin";
import { stripeKlient, oreTillKronor, stripeTidTillDatum } from "./stripe";

export interface StripePris {
  price_id: string;
  produkt_id: string;
  produkt_namn: string;
  belopp_sek: number;
  intervall: string;          // "manad" | "kvartal" | "ar" | "engang"
  /** Satt när priset redan är knutet till en plan hos oss. */
  kopplad_plan: string | null;
}

export interface StripeAbonnemang {
  subscription_id: string;
  stripe_customer_id: string;
  kund_namn: string | null;
  kund_epost: string | null;
  belopp_sek: number;
  intervall: string;
  status: string;
  nasta_betalning: string | null;
  price_id: string | null;
  /** Cockpit-klienten abonnemanget redan är kopplat till, om någon. */
  kopplad_klient: string | null;
  /** Vårt förslag, grundat på namn eller e-post. Aldrig automatiskt tillämpat. */
  forslag_klient: string | null;
  forslag_skal: string | null;
}

export interface StripeOversikt {
  priser: StripePris[];
  abonnemang: StripeAbonnemang[];
  antal_okopplade: number;
}

function intervallFran(pris: { recurring?: { interval?: string; interval_count?: number } | null } | null): string {
  const r = pris?.recurring;
  if (!r?.interval) return "engang";
  if (r.interval === "year") return "ar";
  if (r.interval === "month") return (r.interval_count || 1) === 3 ? "kvartal" : "manad";
  return "manad";
}

/** Normalisering för namnjämförelse: gemener, utan bolagsformer och skiljetecken. */
function nyckel(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/\b(ab|hb|kb|ekonomisk förening|aktiebolag)\b/g, "")
    .replace(/[^a-z0-9åäö]/g, "")
    .trim();
}

/**
 * Läser Stripe och matchar mot Cockpit. Föreslår en klient per abonnemang när namnet
 * eller e-posten pekar tydligt åt ett håll, och lämnar resten tomma.
 */
export async function hamtaStripeOversikt(): Promise<StripeOversikt> {
  const stripe = await stripeKlient();
  const sb = supabaseService();

  const [priserSvar, abonnemangSvar, { data: klienter }, { data: planer }, { data: mappade }, { data: avtal }] =
    await Promise.all([
      stripe.prices.list({ active: true, limit: 100, expand: ["data.product"] }),
      stripe.subscriptions.list({ status: "all", limit: 100, expand: ["data.customer"] }),
      sb.from("clients").select("id, name, slug, archived"),
      sb.from("billing_plans").select("id, stripe_price_id"),
      sb.from("billing_customers").select("client_id, stripe_customer_id"),
      sb.from("billing_avtal").select("client_id, faktura_epost"),
    ]);

  const planPerPris = new Map(
    ((planer || []) as Array<{ id: string; stripe_price_id: string | null }>)
      .filter((p) => p.stripe_price_id)
      .map((p) => [p.stripe_price_id as string, p.id]),
  );
  const klientPerStripeKund = new Map(
    ((mappade || []) as Array<{ client_id: string; stripe_customer_id: string }>).map((m) => [m.stripe_customer_id, m.client_id]),
  );

  const aktivaKlienter = ((klienter || []) as Array<{ id: string; name: string; slug: string; archived: boolean }>)
    .filter((k) => !k.archived);
  const perNamn = new Map(aktivaKlienter.map((k) => [nyckel(k.name), k.id]));
  const perEpost = new Map(
    ((avtal || []) as Array<{ client_id: string; faktura_epost: string | null }>)
      .filter((a) => a.faktura_epost)
      .map((a) => [(a.faktura_epost as string).toLowerCase(), a.client_id]),
  );

  const priser: StripePris[] = priserSvar.data
    .filter((p) => p.active)
    .map((p) => {
      const produkt = p.product as { id: string; name?: string; deleted?: boolean } | string;
      return {
        price_id: p.id,
        produkt_id: typeof produkt === "string" ? produkt : produkt.id,
        produkt_namn: typeof produkt === "string" ? produkt : produkt.name || "Namnlös produkt",
        belopp_sek: oreTillKronor(p.unit_amount),
        intervall: intervallFran(p),
        kopplad_plan: planPerPris.get(p.id) || null,
      };
    })
    .sort((a, b) => b.belopp_sek - a.belopp_sek);

  const abonnemang: StripeAbonnemang[] = abonnemangSvar.data.map((s) => {
    const kund = s.customer as { id: string; name?: string | null; email?: string | null; deleted?: boolean } | string;
    const kundId = typeof kund === "string" ? kund : kund.id;
    const namn = typeof kund === "string" ? null : kund.name || null;
    const epost = typeof kund === "string" ? null : kund.email || null;

    const rad = s.items?.data?.[0];
    const periodSlut =
      (rad as unknown as { current_period_end?: number } | undefined)?.current_period_end ??
      (s as unknown as { current_period_end?: number }).current_period_end ??
      null;

    // Förslaget: e-post är starkare bevis än namn, så den prövas först.
    let forslag: string | null = null;
    let skal: string | null = null;
    if (epost && perEpost.has(epost.toLowerCase())) {
      forslag = perEpost.get(epost.toLowerCase()) || null;
      skal = "samma e-post som på affären";
    } else if (namn && perNamn.has(nyckel(namn))) {
      forslag = perNamn.get(nyckel(namn)) || null;
      skal = "samma företagsnamn";
    }

    return {
      subscription_id: s.id,
      stripe_customer_id: kundId,
      kund_namn: namn,
      kund_epost: epost,
      belopp_sek: oreTillKronor(rad?.price?.unit_amount),
      intervall: intervallFran(rad?.price || null),
      status: s.status,
      nasta_betalning: stripeTidTillDatum(periodSlut)?.slice(0, 10) || null,
      price_id: rad?.price?.id || null,
      kopplad_klient: klientPerStripeKund.get(kundId) || null,
      forslag_klient: forslag,
      forslag_skal: skal,
    };
  });

  return {
    priser,
    abonnemang: abonnemang.sort((a, b) => (a.kopplad_klient ? 1 : 0) - (b.kopplad_klient ? 1 : 0)),
    antal_okopplade: abonnemang.filter((a) => !a.kopplad_klient).length,
  };
}

/**
 * Kopplar ETT Stripe-abonnemang till EN Cockpit-kund. Skriver mappningen, speglar
 * abonnemanget och sätter avtalet till att styras av Stripe.
 *
 * Rör aldrig något i Stripe. Det här är enbart vår sida av kopplingen.
 */
export async function kopplaAbonnemang(opts: {
  clientId: string;
  stripeCustomerId: string;
  subscriptionId: string;
}): Promise<{ ok: boolean; besked: string }> {
  if (!opts.clientId || !opts.stripeCustomerId || !opts.subscriptionId) {
    return { ok: false, besked: "Både kund och abonnemang måste anges." };
  }

  try {
    const stripe = await stripeKlient();
    const sb = supabaseService();
    const inst = await import("./installningar").then((m) => m.hamtaInstallningar());

    const sub = await stripe.subscriptions.retrieve(opts.subscriptionId);
    const rad = sub.items?.data?.[0];
    const belopp = oreTillKronor(rad?.price?.unit_amount);
    const intervall = intervallFran(rad?.price || null);
    const periodSlut =
      (rad as unknown as { current_period_end?: number } | undefined)?.current_period_end ??
      (sub as unknown as { current_period_end?: number }).current_period_end ??
      null;

    // Vilken plan hos oss motsvarar priset? Finns ingen koppling lämnas den tom —
    // beloppet på avtalet är ändå det som gäller.
    const { data: planRad } = await sb.from("billing_plans").select("id").eq("stripe_price_id", rad?.price?.id || "").maybeSingle();
    const planId = (planRad as { id: string } | null)?.id || null;

    await sb.from("billing_customers").upsert(
      {
        client_id: opts.clientId,
        stripe_customer_id: opts.stripeCustomerId,
        epost: typeof sub.customer === "string" ? null : (sub.customer as { email?: string }).email || null,
        lage: inst.stripe_lage,
      },
      { onConflict: "client_id" },
    );

    await sb.from("billing_subscriptions").upsert(
      {
        client_id: opts.clientId,
        stripe_subscription_id: sub.id,
        plan_id: planId,
        stripe_status: sub.status,
        belopp_sek: belopp,
        intervall: rad?.price?.recurring?.interval || null,
        current_period_end: stripeTidTillDatum(periodSlut),
        cancel_at_period_end: !!sub.cancel_at_period_end,
      },
      { onConflict: "client_id" },
    );

    // Avtalet får källan 'stripe' → datumet läses hädanefter ur abonnemanget, inte ur
    // ett manuellt fält som skulle kunna säga något annat än vad kunden debiteras.
    const { data: fanns } = await sb.from("billing_avtal").select("client_id").eq("client_id", opts.clientId).maybeSingle();
    const patch = {
      client_id: opts.clientId,
      kalla: "stripe",
      betalsatt: "stripe",
      belopp_sek: belopp || null,
      intervall,
      status: sub.status === "canceled" ? "avslutad" : "aktiv",
      ...(planId ? { plan_id: planId } : {}),
    };
    if (fanns) await sb.from("billing_avtal").update(patch).eq("client_id", opts.clientId);
    else await sb.from("billing_avtal").insert(patch);

    return { ok: true, besked: "Kopplad. Nästa betalning läses nu direkt från Stripe." };
  } catch (e) {
    const { stripeFelText } = await import("./stripe");
    return { ok: false, besked: `Kopplingen misslyckades. Stripe ${stripeFelText(e)}` };
  }
}

/** Tar bort kopplingen. Rör inte abonnemanget i Stripe, bara vår spegling. */
export async function slappKoppling(clientId: string): Promise<{ ok: boolean; besked: string }> {
  try {
    const sb = supabaseService();
    await sb.from("billing_subscriptions").delete().eq("client_id", clientId);
    await sb.from("billing_customers").delete().eq("client_id", clientId);
    await sb.from("billing_avtal").update({ kalla: "manuell" }).eq("client_id", clientId);
    return { ok: true, besked: "Kopplingen är borttagen. Abonnemanget i Stripe är orört." };
  } catch (e) {
    return { ok: false, besked: (e as Error).message };
  }
}

/**
 * Knyter en Cockpit-plan till ett pris som REDAN finns i Stripe.
 * Alternativet till att skapa ett nytt, vilket skulle ge dubbletter i katalogen.
 */
export async function kopplaPris(planId: string, priceId: string): Promise<{ ok: boolean; besked: string }> {
  try {
    const stripe = await stripeKlient();
    const pris = await stripe.prices.retrieve(priceId);
    const produkt = typeof pris.product === "string" ? pris.product : pris.product.id;

    const { error } = await supabaseService()
      .from("billing_plans")
      .update({ stripe_price_id: pris.id, stripe_product_id: produkt, belopp_sek: oreTillKronor(pris.unit_amount) })
      .eq("id", planId);
    if (error) return { ok: false, besked: error.message };

    return { ok: true, besked: `Kopplad till priset i Stripe. Beloppet hämtades därifrån: ${oreTillKronor(pris.unit_amount)} kr.` };
  } catch (e) {
    const { stripeFelText } = await import("./stripe");
    return { ok: false, besked: `Kunde inte koppla priset. Stripe ${stripeFelText(e)}` };
  }
}
