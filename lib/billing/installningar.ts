// BETAL-1 — ownerns betalinställningar. EN rad i billing_settings.
//
// ★ GRUNDREGELN: Stripes hemliga nyckel lämnar aldrig servern. Den lagras krypterad
// (AES-256-GCM via lib/crypto/token-vault, samma vault som Meta-tokens) och skickas
// ALDRIG till webbläsaren — vyn får bara en maskerad version ("sk_test_••••4242").
//
// Nycklarna bor i DB och inte i env av ett enda skäl: Håkan ska kunna gå från testläge
// till skarpt läge utan deploy. Env behålls som fallback (behåll-fungerande-väg) och
// läses när DB-fältet är tomt.
//
// Server-only (service-role). Importera aldrig från en klientkomponent.

import { supabaseService } from "../supabase-admin";
import { encryptToken, decryptMaybe } from "../crypto/token-vault";

export type StripeLage = "test" | "live";

export interface Betalinstallningar {
  stripe_lage: StripeLage;
  stripe_secret_key: string | null;      // dekrypterad — bara server-side
  stripe_webhook_secret: string | null;  // dekrypterad — bara server-side
  stripe_publik_nyckel: string | null;
  foretagsnamn: string | null;
  org_nr: string | null;
  moms_nr: string | null;
  momssats: number;
  faktura_avsandare: string | null;
  antal_paminnelser: number;
  paminnelse_dagar: number[];
  gracedagar: number;
  dunning_aktiv: boolean;
}

/** Det vyn får se. Aldrig en hel hemlig nyckel. */
export interface InstallningarForVy extends Omit<Betalinstallningar, "stripe_secret_key" | "stripe_webhook_secret"> {
  stripe_secret_key_maskerad: string | null;
  stripe_webhook_secret_maskerad: string | null;
  stripe_kopplad: boolean;
}

const STANDARD: Betalinstallningar = {
  stripe_lage: "test",
  stripe_secret_key: null,
  stripe_webhook_secret: null,
  stripe_publik_nyckel: null,
  foretagsnamn: null,
  org_nr: null,
  moms_nr: null,
  momssats: 25,
  faktura_avsandare: null,
  antal_paminnelser: 3,
  paminnelse_dagar: [0, 7, 14],
  gracedagar: 0,
  dunning_aktiv: false,
};

let cache: { v: Betalinstallningar; tid: number } | null = null;
const TTL_MS = 30 * 1000;

/**
 * Maskerar en nyckel för visning: prefixet (som visar läge) + fyra sista tecknen.
 * Mitten ersätts med punkter, aldrig med rätt antal punkter — längden är också information.
 */
export function maskera(nyckel: string | null | undefined): string | null {
  if (!nyckel) return null;
  const prefix = nyckel.slice(0, 8);
  const slut = nyckel.slice(-4);
  return `${prefix}••••••••${slut}`;
}

export function nollstallInstallningsCache() {
  cache = null;
}

export async function hamtaInstallningar(): Promise<Betalinstallningar> {
  if (cache && Date.now() - cache.tid < TTL_MS) return cache.v;
  try {
    const { data } = await supabaseService().from("billing_settings").select("*").eq("id", 1).maybeSingle();
    const r = (data || {}) as Record<string, unknown>;
    const v: Betalinstallningar = {
      stripe_lage: (r.stripe_lage as StripeLage) || "test",
      // Env är fallback, inte huvudväg: en nyckel i DB vinner alltid.
      stripe_secret_key: decryptMaybe(r.stripe_secret_key as string | null) || process.env.STRIPE_SECRET_KEY || null,
      stripe_webhook_secret: decryptMaybe(r.stripe_webhook_secret as string | null) || process.env.STRIPE_WEBHOOK_SECRET || null,
      stripe_publik_nyckel: (r.stripe_publik_nyckel as string | null) || null,
      foretagsnamn: (r.foretagsnamn as string | null) || null,
      org_nr: (r.org_nr as string | null) || null,
      moms_nr: (r.moms_nr as string | null) || null,
      momssats: Number(r.momssats ?? 25),
      faktura_avsandare: (r.faktura_avsandare as string | null) || null,
      antal_paminnelser: Number(r.antal_paminnelser ?? 3),
      paminnelse_dagar: (r.paminnelse_dagar as number[] | null) || [0, 7, 14],
      gracedagar: Number(r.gracedagar ?? 0),
      dunning_aktiv: Boolean(r.dunning_aktiv),
    };
    cache = { v, tid: Date.now() };
    return v;
  } catch (e) {
    console.error("[billing] kunde inte läsa inställningar:", (e as Error).message);
    // Fail-safe åt rätt håll: utan inställningar är dunning AV, alltså spärrar vi ingen.
    return { ...STANDARD, stripe_secret_key: process.env.STRIPE_SECRET_KEY || null };
  }
}

/** Vyns variant. Hemligheterna är maskerade innan de lämnar servern. */
export async function hamtaInstallningarForVy(): Promise<InstallningarForVy> {
  const i = await hamtaInstallningar();
  const { stripe_secret_key, stripe_webhook_secret, ...rest } = i;
  return {
    ...rest,
    stripe_secret_key_maskerad: maskera(stripe_secret_key),
    stripe_webhook_secret_maskerad: maskera(stripe_webhook_secret),
    stripe_kopplad: !!stripe_secret_key,
  };
}

export interface SparaInput {
  stripe_lage?: StripeLage;
  stripe_secret_key?: string;      // tom sträng = rör inte, "RENSA" = nolla
  stripe_webhook_secret?: string;
  stripe_publik_nyckel?: string;
  foretagsnamn?: string;
  org_nr?: string;
  moms_nr?: string;
  momssats?: number;
  faktura_avsandare?: string;
  antal_paminnelser?: number;
  paminnelse_dagar?: number[];
  gracedagar?: number;
  dunning_aktiv?: boolean;
}

const RENSA = "RENSA";

/**
 * Sparar. Ett utelämnat eller tomt hemligt fält lämnar den befintliga nyckeln orörd —
 * annars hade en sparning av företagsnamnet raderat Stripe-kopplingen, eftersom vyn
 * aldrig får tillbaka den riktiga nyckeln att skicka in igen.
 */
export async function sparaInstallningar(input: SparaInput): Promise<{ ok: boolean; fel?: string }> {
  const patch: Record<string, unknown> = {};

  const text = (v: string | undefined) => (typeof v === "string" ? v.trim() : undefined);

  for (const falt of ["foretagsnamn", "org_nr", "moms_nr", "faktura_avsandare", "stripe_publik_nyckel"] as const) {
    const v = text(input[falt]);
    if (v !== undefined) patch[falt] = v || null;
  }

  if (input.stripe_lage === "test" || input.stripe_lage === "live") patch.stripe_lage = input.stripe_lage;

  if (Number.isFinite(input.momssats)) patch.momssats = Math.max(0, Number(input.momssats));
  if (Number.isFinite(input.gracedagar)) patch.gracedagar = Math.max(0, Math.round(Number(input.gracedagar)));
  if (typeof input.dunning_aktiv === "boolean") patch.dunning_aktiv = input.dunning_aktiv;

  if (Number.isFinite(input.antal_paminnelser)) {
    const n = Math.min(10, Math.max(0, Math.round(Number(input.antal_paminnelser))));
    patch.antal_paminnelser = n;
  }
  if (Array.isArray(input.paminnelse_dagar)) {
    const dagar = input.paminnelse_dagar
      .map((d) => Math.max(0, Math.round(Number(d))))
      .filter((d) => Number.isFinite(d))
      .sort((a, b) => a - b);
    if (dagar.length) patch.paminnelse_dagar = dagar;
  }

  // Hemligheter: kryptera vid sparning, lämna orörda när fältet är tomt.
  for (const falt of ["stripe_secret_key", "stripe_webhook_secret"] as const) {
    const v = text(input[falt]);
    if (v === undefined || v === "") continue;
    if (v === RENSA) { patch[falt] = null; continue; }
    if (v.includes("••")) continue; // vyn skickade tillbaka maskeringen — inte en ny nyckel
    try {
      patch[falt] = encryptToken(v);
    } catch (e) {
      return { ok: false, fel: `Kunde inte kryptera nyckeln: ${(e as Error).message}` };
    }
  }

  if (Object.keys(patch).length === 0) return { ok: true };

  try {
    const { error } = await supabaseService().from("billing_settings").update(patch).eq("id", 1);
    if (error) return { ok: false, fel: error.message };
    nollstallInstallningsCache();
    return { ok: true };
  } catch (e) {
    return { ok: false, fel: (e as Error).message };
  }
}

/**
 * Rimlighetskoll på nyckel och läge. En live-nyckel i testläge (eller tvärtom) är det
 * fel som annars upptäcks först när en riktig kund debiteras på fel konto.
 */
export function nyckelStammerMedLage(nyckel: string | null, lage: StripeLage): boolean {
  if (!nyckel) return true;
  const arTest = nyckel.startsWith("sk_test_") || nyckel.startsWith("rk_test_");
  const arLive = nyckel.startsWith("sk_live_") || nyckel.startsWith("rk_live_");
  if (!arTest && !arLive) return true; // okänt format — låt Stripe själv säga ifrån
  return lage === "test" ? arTest : arLive;
}
