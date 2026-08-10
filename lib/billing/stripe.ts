// BETAL-1 — Stripe-klienten. ENDA vägen till Stripes API.
//
// Samma princip som lib/ai-usage och lib/prompt-core: ingen route bygger en egen klient.
// Går ett anrop förbi den här filen kan det använda fel nyckel, fel läge eller sakna
// felhantering — och det upptäcks först när en riktig kund debiteras fel.
//
// Nyckeln hämtas ur billing_settings (krypterad) med env som fallback. Klienten cachas
// per nyckel, så ett byte av nyckel i adminvyn slår igenom utan omstart.
//
// Server-only (nodejs runtime).

import Stripe from "stripe";
import { hamtaInstallningar, nyckelStammerMedLage } from "./installningar";

let klientCache: { nyckel: string; klient: Stripe } | null = null;

export class StripeSaknasError extends Error {
  constructor() {
    super("Stripe är inte kopplat än. Fyll i din hemliga nyckel under Betalning och abonnemang.");
    this.name = "StripeSaknasError";
  }
}

/** Klienten, eller null när Stripe inte är konfigurerat. Kastar aldrig. */
export async function stripeKlientOrNull(): Promise<Stripe | null> {
  const { stripe_secret_key } = await hamtaInstallningar();
  if (!stripe_secret_key) return null;
  if (klientCache?.nyckel === stripe_secret_key) return klientCache.klient;
  const klient = new Stripe(stripe_secret_key, {
    // Egen etikett i Stripes loggar, så det går att se vad som kom härifrån.
    appInfo: { name: "MySales Pro", url: "https://cockpit.gripcoaching.se" },
    maxNetworkRetries: 2,
  });
  klientCache = { nyckel: stripe_secret_key, klient };
  return klient;
}

/** Klienten, eller kastar StripeSaknasError. För routes som inte kan göra något utan. */
export async function stripeKlient(): Promise<Stripe> {
  const k = await stripeKlientOrNull();
  if (!k) throw new StripeSaknasError();
  return k;
}

export async function stripeKonfigurerat(): Promise<boolean> {
  return (await stripeKlientOrNull()) !== null;
}

// ── Belopp ──────────────────────────────────────────────────────────────────
// Stripe räknar i ören. Omräkningen sker HÄR, en enda gång, så ingen vy kan råka
// visa 199 000 kr för ett abonnemang på 1 990 kr.

export const oreTillKronor = (ore: number | null | undefined): number =>
  Math.round(((Number(ore) || 0) / 100) * 100) / 100;

export const kronorTillOre = (kronor: number | null | undefined): number =>
  Math.round((Number(kronor) || 0) * 100);

export const stripeTidTillDatum = (sekunder: number | null | undefined): string | null =>
  sekunder ? new Date(Number(sekunder) * 1000).toISOString() : null;

// ── Kopplingstest ───────────────────────────────────────────────────────────

export interface Kopplingssvar {
  ok: boolean;
  besked: string;
  konto?: { namn: string | null; land: string | null; valuta: string | null; testlage: boolean };
}

/**
 * Testar nyckeln mot Stripe och kontrollerar att läget stämmer. Ett live-konto i
 * testläge (eller tvärtom) är det dyraste konfigurationsfelet som finns här.
 */
export async function testaKoppling(): Promise<Kopplingssvar> {
  const inst = await hamtaInstallningar();
  if (!inst.stripe_secret_key) {
    return { ok: false, besked: "Ingen hemlig nyckel är ifylld än." };
  }
  if (!nyckelStammerMedLage(inst.stripe_secret_key, inst.stripe_lage)) {
    return {
      ok: false,
      besked:
        inst.stripe_lage === "test"
          ? "Nyckeln är en skarp nyckel men läget står på test. Byt läge, eller klistra in testnyckeln."
          : "Nyckeln är en testnyckel men läget står på skarpt. Byt läge, eller klistra in den skarpa nyckeln.",
    };
  }
  try {
    const stripe = await stripeKlient();
    // Saldot är det enklaste anropet som bevisar att nyckeln godtas. Går det igenom
    // fungerar kopplingen, oavsett vad kontot heter.
    await stripe.balance.retrieve();
    const testlage = inst.stripe_secret_key.includes("_test_");

    // Kontouppgifterna är trevliga att visa men får aldrig fälla testet: GET /v1/account
    // tar inget id i SDK:ns typer, så anropet görs löst typat och i egen try.
    let konto: Kopplingssvar["konto"];
    try {
      const k = await (stripe.accounts as unknown as { retrieve: () => Promise<{
        business_profile?: { name?: string | null } | null;
        settings?: { dashboard?: { display_name?: string | null } | null } | null;
        country?: string | null;
        default_currency?: string | null;
      }> }).retrieve();
      konto = {
        namn: k.business_profile?.name || k.settings?.dashboard?.display_name || null,
        land: k.country || null,
        valuta: k.default_currency?.toUpperCase() || null,
        testlage,
      };
    } catch {
      konto = { namn: null, land: null, valuta: null, testlage };
    }

    return {
      ok: true,
      besked: testlage
        ? "Kopplingen fungerar. Du kör i testläge, inga riktiga pengar rör sig."
        : "Kopplingen fungerar och du kör skarpt. Riktiga betalningar går igenom.",
      konto,
    };
  } catch (e) {
    return { ok: false, besked: `Stripe svarade: ${stripeFelText(e)}` };
  }
}

/** Stripes felmeddelanden i klartext. Rå engelsk text är sista utvägen, inte första. */
export function stripeFelText(e: unknown): string {
  const fel = e as { type?: string; code?: string; message?: string };
  if (fel?.type === "StripeAuthenticationError") return "nyckeln godtas inte. Kontrollera att du kopierat hela nyckeln.";
  if (fel?.type === "StripeConnectionError") return "gick inte att nå. Försök igen om en stund.";
  if (fel?.code === "resource_missing") return "hittade inte det som efterfrågades. Det kan vara skapat i det andra läget (test eller skarpt).";
  return fel?.message || "ett okänt fel.";
}
