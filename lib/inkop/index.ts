// K3-INKÖP — datalagret. Läser leverantörssaldon, räknar takt och prognos ur KOSTNAD-1:s
// ledger och bygger larmraderna.
//
// ★ EN KÄLLA. `byggInkop()` anropas av BÅDE /api/kostnader (inköpsvyn och bannern) och
// /api/hq (raden överst i morgonlistan). Ingen av dem har egen larmlogik. Skulle de två
// vyerna kunna räkna olika vore larmet värdelöst precis när det behövs.
//
// Server-only (service-role). Importera aldrig från en klientkomponent.

import { supabaseService } from "../supabase-admin";
import type { Provider } from "../ai-usage";
import {
  TROSKLAR_STANDARD,
  bedomLarm,
  byggRekommendation,
  dagarKvar as raknaDagarKvar,
  larmtext,
  prognosManad,
  raknaTakt,
  type Dagskostnad,
  type Inkopstyp,
  type Larmniva,
  type Larmrad,
  type Rekommendation,
  type Takt,
  type Trosklar,
} from "./berakning";

export type Kontoprovider = "fal" | "google_cloud" | "anthropic" | "resend" | "elks46" | "ovrig";

/**
 * Vilka provider-nycklar i ai_usage_events som betalas av vilket konto.
 * Ett konto kan bära flera: Google Cloud-fakturan täcker både Gemini och PageSpeed.
 * `ovrig` fångar upp resten så ingen förbrukning kan försvinna mellan stolarna.
 */
export const KONTOTS_PROVIDERS: Record<Kontoprovider, Provider[]> = {
  fal: ["fal"],
  google_cloud: ["gemini", "google"],
  anthropic: ["anthropic"],
  resend: ["resend"],
  elks46: ["elks"],
  ovrig: ["pexels", "pixabay", "fireworks"],
};

export interface Kontorad {
  id: string;
  provider: Kontoprovider;
  etikett: string;
  typ: Inkopstyp;
  saldo_belopp: number | null;
  saldo_valuta: string;
  saldo_kalla: "api" | "manuellt";
  saldo_uppdaterad: string | null;
  saldo_fel: string | null;
  betalkort_sista_fyra: string | null;
  forra_fakturan_sek: number | null;
  forra_fakturan_datum: string | null;
  pafyllningssteg: number | null;
  fakturalank: string | null;
  notering: string | null;
  aktiv: boolean;
  sort_order: number;
}

export interface Inkopsrad extends Kontorad {
  /** Saldot omräknat till kronor med kursen nedan. null = inget saldo inlagt. */
  saldoSek: number | null;
  kurs: number;
  takt7: Takt;
  takt30: Takt;
  dagarKvar: number | null;
  prognosSek: number;
  larmniva: Larmniva;
  larmorsak: string;
  billingfelSenasteDygnet: boolean;
  senasteFel: string | null;
  rekommendation: Rekommendation | null;
  /** Saldots ålder i hela dagar. null = aldrig uppdaterat. */
  saldoAlderDagar: number | null;
  manadHittills: number;
}

export interface InkopsData {
  idag: string;
  trosklar: Trosklar;
  rader: Inkopsrad[];
  larm: Larmrad[];
}

const TZ = "Europe/Stockholm";
const dagIStockholm = (d: Date): string => d.toLocaleDateString("sv-SE", { timeZone: TZ });

const SALDO_TTL_MS = 60 * 60 * 1000; // högst en hämtning i timmen, per beställningen
const HAMTA_TIMEOUT_MS = 8000;

// ── Saldohämtning ──────────────────────────────────────────────────────────
//
// Medvetet UTANFÖR lib/ai-usage-wrappern, av samma skäl som Gemini Files API och
// Anthropics statuspoll står som dokumenterade undantag där: det här är ingen betald
// generativ anrop utan en gratis läsning av vårt eget konto. Lades den i ledgern hade
// den fyllt kostnadsvyn med en rad i timmen som aldrig kostat en krona, och fått
// provider-hälsan att blinka på något som inte är ett produktionsfel.
//
// Går hämtningen fel skrivs ORSAKEN, aldrig ett gissat saldo. Vyn visar hellre
// "manuellt, 3 dagar gammalt" än en siffra som ser färsk ut och är påhittad.

interface Saldosvar {
  belopp: number;
  valuta: string;
}

async function hamtaFalSaldo(): Promise<Saldosvar> {
  const nyckel = process.env.FAL_KEY;
  if (!nyckel) throw new Error("FAL_KEY saknas i miljövariablerna");
  const r = await fetch("https://rest.fal.ai/billing/user_balance", {
    headers: { Authorization: `Key ${nyckel}` },
    signal: AbortSignal.timeout(HAMTA_TIMEOUT_MS),
  });
  const kropp = await r.text();
  if (!r.ok) throw new Error(`Fal.ai svarade ${r.status}: ${kropp.slice(0, 200)}`);
  const belopp = Number(String(kropp).trim().replace(/^"|"$/g, ""));
  if (!Number.isFinite(belopp)) throw new Error(`Fal.ai svarade något som inte är ett saldo: ${kropp.slice(0, 100)}`);
  return { belopp, valuta: "USD" };
}

async function hamtaElksSaldo(): Promise<Saldosvar> {
  const user = process.env.ELKS_API_USERNAME;
  const pass = process.env.ELKS_API_PASSWORD;
  if (!user || !pass) throw new Error("ELKS_API_USERNAME eller ELKS_API_PASSWORD saknas");
  const r = await fetch("https://api.46elks.com/a1/me", {
    headers: { Authorization: "Basic " + Buffer.from(`${user}:${pass}`).toString("base64") },
    signal: AbortSignal.timeout(HAMTA_TIMEOUT_MS),
  });
  const kropp = await r.text();
  if (!r.ok) throw new Error(`46elks svarade ${r.status}: ${kropp.slice(0, 200)}`);
  const d = JSON.parse(kropp) as { balance?: number; currency?: string };
  if (typeof d.balance !== "number") throw new Error("46elks svarade utan saldo");
  // 46elks räknar i tiotusendelar av valutan, precis som priset per SMS i lib/sms/elks.
  return { belopp: d.balance / 10000, valuta: d.currency || "SEK" };
}

const HAMTARE: Partial<Record<Kontoprovider, () => Promise<Saldosvar>>> = {
  fal: hamtaFalSaldo,
  elks46: hamtaElksSaldo,
};

/** Har en providers saldo ett läsbart API alls? Styr texten i vyn. */
export function harSaldoApi(provider: Kontoprovider): boolean {
  return !!HAMTARE[provider];
}

async function fraschaSaldon(konton: Kontorad[], nu: Date): Promise<Kontorad[]> {
  const sb = supabaseService();
  const uppdaterade = await Promise.all(
    konton.map(async (k) => {
      const hamtare = HAMTARE[k.provider];
      if (!hamtare || k.saldo_kalla !== "api" || !k.aktiv) return k;
      const alder = k.saldo_uppdaterad ? nu.getTime() - Date.parse(k.saldo_uppdaterad) : Infinity;
      if (alder < SALDO_TTL_MS) return k;

      try {
        const svar = await hamtare();
        const rad = {
          saldo_belopp: svar.belopp,
          saldo_valuta: svar.valuta,
          saldo_uppdaterad: nu.toISOString(),
          saldo_fel: null,
          uppdaterad: nu.toISOString(),
        };
        await sb.from("provider_accounts").update(rad).eq("id", k.id);
        return { ...k, ...rad };
      } catch (e) {
        // Saldot lämnas ORÖRT. Bara orsaken skrivs, så vyn kan säga hur gammal siffran är.
        const fel = (e as Error).message.slice(0, 300);
        await sb.from("provider_accounts").update({ saldo_fel: fel, uppdaterad: nu.toISOString() }).eq("id", k.id);
        return { ...k, saldo_fel: fel };
      }
    }),
  );
  return uppdaterade;
}

// ── Underlaget ur ledgern ──────────────────────────────────────────────────

interface Handelse {
  created_at: string;
  provider: string;
  estimated_cost_sek: number | string;
}

/** Kronor per dag och provider de senaste 30 dagarna, plus första mätdag per provider. */
function grupperaPerDag(handelser: Handelse[]): {
  perProvider: Map<string, Dagskostnad[]>;
  forstaDag: Map<string, string>;
} {
  const karta = new Map<string, Map<string, number>>();
  const forstaDag = new Map<string, string>();
  for (const h of handelser) {
    const dag = dagIStockholm(new Date(h.created_at));
    const kostnad = Number(h.estimated_cost_sek) || 0;
    const inre = karta.get(h.provider) || new Map<string, number>();
    inre.set(dag, (inre.get(dag) || 0) + kostnad);
    karta.set(h.provider, inre);
    const tidigare = forstaDag.get(h.provider);
    if (!tidigare || dag < tidigare) forstaDag.set(h.provider, dag);
  }
  const perProvider = new Map<string, Dagskostnad[]>();
  for (const [provider, inre] of karta) {
    perProvider.set(
      provider,
      [...inre.entries()].map(([dag, kostnadSek]) => ({ dag, kostnadSek })),
    );
  }
  return { perProvider, forstaDag };
}

function slaIhop(providers: string[], perProvider: Map<string, Dagskostnad[]>): Dagskostnad[] {
  const summa = new Map<string, number>();
  for (const p of providers) {
    for (const d of perProvider.get(p) || []) summa.set(d.dag, (summa.get(d.dag) || 0) + d.kostnadSek);
  }
  return [...summa.entries()].map(([dag, kostnadSek]) => ({ dag, kostnadSek }));
}

/** Tidigaste mätdagen bland kontots providers. null = ingen mätning alls. */
function forstaMatdag(providers: string[], forstaDag: Map<string, string>): string | null {
  let forsta: string | null = null;
  for (const p of providers) {
    const d = forstaDag.get(p);
    if (d && (!forsta || d < forsta)) forsta = d;
  }
  return forsta;
}

// ── Hälsan: billing-fel senaste dygnet ─────────────────────────────────────

interface Halsorad {
  provider: string;
  senaste_fel: string | null;
  senaste_felklass: string | null;
}

/**
 * Har någon av kontots providers flaggat ett betalningsfel det senaste dygnet?
 * Läses ur samma vy som kostnadsmodulens providerhälsa (ai_provider_health), aldrig
 * ur en egen fråga mot händelsetabellen.
 */
function billingfel(providers: string[], halsa: Halsorad[], nu: Date): { flaggat: boolean; nar: string | null } {
  const grans = nu.getTime() - 24 * 60 * 60 * 1000;
  for (const h of halsa) {
    if (!providers.includes(h.provider)) continue;
    if (h.senaste_felklass !== "billing" || !h.senaste_fel) continue;
    if (Date.parse(h.senaste_fel) >= grans) return { flaggat: true, nar: h.senaste_fel };
  }
  return { flaggat: false, nar: null };
}

// ── Huvudingången ──────────────────────────────────────────────────────────

/**
 * Bygger hela inköpsbilden: ett konto per leverantör med saldo, takt, prognos,
 * larmnivå och köprekommendation, plus larmraderna som båda vyerna renderar.
 *
 * Fail-open: går något fel returneras tomma rader och inga larm, aldrig ett kastat fel.
 * En trasig inköpsvy får inte fälla kostnadsmodulen eller Founder HQ.
 */
export async function byggInkop(nu: Date = new Date()): Promise<InkopsData> {
  const idag = dagIStockholm(nu);
  const tom: InkopsData = { idag, trosklar: TROSKLAR_STANDARD, rader: [], larm: [] };

  try {
    const sb = supabaseService();
    const franDatum = new Date(nu.getTime() - 30 * 86400000).toISOString();
    const manadStart = new Date(Date.UTC(nu.getUTCFullYear(), nu.getUTCMonth(), 1)).toISOString();

    const [{ data: kontoData }, { data: konfigData }, { data: handelseData }, { data: halsoData }, { data: prisData }] =
      await Promise.all([
        sb.from("provider_accounts").select("*").order("sort_order"),
        sb.from("inkop_konfig").select("*").eq("id", 1).maybeSingle(),
        sb
          .from("ai_usage_events")
          .select("created_at, provider, estimated_cost_sek")
          .gte("created_at", franDatum)
          .limit(50000),
        sb.from("ai_provider_health").select("provider, senaste_fel, senaste_felklass"),
        sb.from("ai_pricing").select("provider, valuta, vaxelkurs").eq("aktiv", true),
      ]);

    const konton = ((kontoData as Kontorad[] | null) || []).map((k) => ({
      ...k,
      saldo_belopp: k.saldo_belopp === null ? null : Number(k.saldo_belopp),
      forra_fakturan_sek: k.forra_fakturan_sek === null ? null : Number(k.forra_fakturan_sek),
      pafyllningssteg: k.pafyllningssteg === null ? null : Number(k.pafyllningssteg),
    }));
    if (!konton.length) return tom;

    const k = konfigData as { gul_dagar: number; rod_dagar: number; gul_prognos_procent: number } | null;
    const trosklar: Trosklar = k
      ? {
          gulDagar: Number(k.gul_dagar) || TROSKLAR_STANDARD.gulDagar,
          rodDagar: Number(k.rod_dagar) || TROSKLAR_STANDARD.rodDagar,
          gulPrognosProcent: Number(k.gul_prognos_procent) || TROSKLAR_STANDARD.gulPrognosProcent,
        }
      : TROSKLAR_STANDARD;

    const handelser = (handelseData as Handelse[] | null) || [];
    const { perProvider, forstaDag } = grupperaPerDag(handelser);
    const halsa = (halsoData as Halsorad[] | null) || [];

    // Växelkursen är den som PRISLISTAN redan använder för att räkna om providerns
    // kostnad till kronor. Att hitta på en egen kurs här hade gjort att saldot och
    // kostnaden mättes med olika måttstock.
    const kurser = new Map<string, number>();
    for (const p of ((prisData as Array<{ provider: string; valuta: string; vaxelkurs: number }> | null) || [])) {
      const nyckel = `${p.provider}|${p.valuta}`;
      if (!kurser.has(nyckel)) kurser.set(nyckel, Number(p.vaxelkurs) || 1);
    }

    const manadFran = manadStart;
    const rader: Inkopsrad[] = konton
      .filter((konto) => konto.aktiv)
      .map((konto) => {
        const providers = KONTOTS_PROVIDERS[konto.provider] || [];
        const dagskostnader = slaIhop(providers, perProvider);
        const matning = forstaMatdag(providers, forstaDag);

        const takt7 = raknaTakt(dagskostnader, idag, 7, matning);
        const takt30 = raknaTakt(dagskostnader, idag, 30, matning);

        const kurs =
          konto.saldo_valuta === "SEK"
            ? 1
            : providers.map((p) => kurser.get(`${p}|${konto.saldo_valuta}`)).find((v) => v !== undefined) ?? 10.5;

        const saldoSek = konto.saldo_belopp === null ? null : konto.saldo_belopp * kurs;
        const dagar = konto.typ === "forbetalt" ? raknaDagarKvar(saldoSek, takt7.snittPerDag) : null;
        const prognosSek = prognosManad(takt30.snittPerDag);
        const fel = billingfel(providers, halsa, nu);

        const bedomning = bedomLarm({
          typ: konto.typ,
          dagarKvar: dagar,
          prognosSek,
          forraFakturanSek: konto.forra_fakturan_sek,
          billingfelSenasteDygnet: fel.flaggat,
          trosklar,
        });

        const rekommendation =
          konto.typ === "forbetalt" && bedomning.niva !== "gron" && takt30.snittPerDag > 0
            ? byggRekommendation({
                etikett: konto.etikett,
                snitt30PerDag: takt30.snittPerDag,
                dagarKvar: dagar,
                valuta: konto.saldo_valuta,
                kurs,
                pafyllningssteg: konto.pafyllningssteg,
                idag,
                rodDagar: trosklar.rodDagar,
              })
            : null;

        const manadHittills = handelser
          .filter((h) => providers.includes(h.provider as Provider) && h.created_at >= manadFran)
          .reduce((s, h) => s + (Number(h.estimated_cost_sek) || 0), 0);

        return {
          ...konto,
          saldoSek,
          kurs,
          takt7,
          takt30,
          dagarKvar: dagar,
          prognosSek,
          larmniva: bedomning.niva,
          larmorsak: bedomning.orsak,
          billingfelSenasteDygnet: fel.flaggat,
          senasteFel: fel.nar,
          rekommendation,
          saldoAlderDagar: konto.saldo_uppdaterad
            ? Math.floor((nu.getTime() - Date.parse(konto.saldo_uppdaterad)) / 86400000)
            : null,
          manadHittills,
        };
      });

    const larm: Larmrad[] = rader
      .filter((r) => r.larmniva !== "gron")
      .map((r) => ({
        id: `inkop-${r.provider}`,
        text: larmtext(r.etikett, { niva: r.larmniva, orsak: r.larmorsak }, r.rekommendation?.klartext ?? null),
        niva: r.larmniva as "gul" | "rod",
        etikett: "Inköp",
        lank: "/dashboard/kostnader#inkop",
      }));

    return { idag, trosklar, rader, larm };
  } catch (e) {
    console.error("[inkop] kunde inte bygga inköpsbilden:", (e as Error).message);
    return tom;
  }
}

/**
 * Bara larmraderna, för Founder HQ:s morgonlista. Anropar samma byggare som
 * kostnadsmodulen: en enda uträkning, två vyer.
 */
export async function inkopLarm(nu: Date = new Date()): Promise<Larmrad[]> {
  return (await byggInkop(nu)).larm;
}

/** Frächa saldon där providern har ett API. Anropas av /api/kostnader vid sidladdning. */
export async function fraschaApiSaldon(nu: Date = new Date()): Promise<void> {
  try {
    const sb = supabaseService();
    const { data } = await sb.from("provider_accounts").select("*").eq("saldo_kalla", "api").eq("aktiv", true);
    await fraschaSaldon(((data as Kontorad[] | null) || []), nu);
  } catch (e) {
    console.error("[inkop] saldohämtningen failade:", (e as Error).message);
  }
}
