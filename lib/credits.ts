// ETAPP K2 (STEG 3) — Cockpit Credits. Månadskvot per tenant för bilder och video.
//
// ★ GRUNDREGELN: credits är en VY ovanpå KOSTNAD-1:s ledger, aldrig en egen parallell
// mätning. Varje `usage`-transaktion pekar på raden i `ai_usage_events` som orsakade den.
// Vid konflikt mellan siffrorna är ai_usage_events sanningen.
//
// Affärsregler (beslutade, hårda):
//   · 300 credits per månad som default, ingen rollover, förnyas den 1:a 00:00 svensk tid
//   · Kunden ser aldrig kronor, bara credits
//   · TEXT drar inga credits (öresnivå) — credits gäller media. Begripligt för kunden:
//     credits = bilder och video
//   · Hård kostnadsgräns 200 kr per tenant och månad gäller OAVSETT creditsaldo
//     (den bor i lib/ai-usage, mäts i ledgern)
//   · Priser i credit_pricing, ägarstyrda utan deploy
//
// Server-only (service-role). Fail-open i varje led: går mätningen sönder ska kundens
// flöde ändå fungera. Ett spärrat flöde är ett dyrare fel än en omätt bild.

import { supabaseService } from "./supabase-admin";

export type CreditAtgard = "social-bild" | "hero-bild" | "video";
export type TransaktionsTyp = "monthly_reset" | "usage" | "topup" | "manual_grant";

export const STANDARDKVOT = 300;
/** Modulen som styr om kunden möter creditsystemet. K2-4: default AV. */
export const CREDIT_MODUL = "credits";

export interface Konto {
  tenant_id: string;
  monthly_quota: number;
  extra_credits: number;
  period_start: string;   // YYYY-MM-DD
  used_this_period: number;
}

export interface Saldo {
  saldo: number;
  kvot: number;
  extra: number;
  anvant: number;
  periodStart: string;
  /** Andel av kvoten som är kvar, 0–100. Styr förvarningen under 15 procent. */
  procentKvar: number;
}

/**
 * Första dagen i innevarande period, i SVENSK tid. Servern kör UTC — utan
 * tidszonen skulle en generering 1 augusti kl 01:30 svensk tid räknas mot juli.
 */
export function aktuellPeriod(nu: Date = new Date()): string {
  const svensktDatum = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(nu);
  return `${svensktDatum.slice(0, 7)}-01`;
}

// ── Prislista (cachad, ägarstyrd i DB) ─────────────────────────────────────

let prisCache: { karta: Map<string, number>; tid: number } | null = null;
const PRIS_TTL_MS = 5 * 60 * 1000;

/** Fallback när prislistan inte går att läsa — samma startvärden som migrationen. */
const PRIS_FALLBACK: Record<CreditAtgard, number> = { "social-bild": 3, "hero-bild": 8, video: 15 };

export async function creditPris(atgard: CreditAtgard): Promise<number> {
  if (!prisCache || Date.now() - prisCache.tid > PRIS_TTL_MS) {
    try {
      const { data } = await supabaseService().from("credit_pricing").select("action, credits").eq("active", true);
      prisCache = {
        karta: new Map((data || []).map((r) => [(r as { action: string }).action, Number((r as { credits: number }).credits) || 0])),
        tid: Date.now(),
      };
    } catch {
      prisCache = { karta: new Map(), tid: Date.now() };
    }
  }
  return prisCache.karta.get(atgard) ?? PRIS_FALLBACK[atgard];
}

export function nollstallCreditPrisCache() {
  prisCache = null;
}

// ── Konto och månadsreset ──────────────────────────────────────────────────

/**
 * Hämtar kontot, skapar det om det saknas och nollställer det om perioden runnit ut.
 *
 * Resetten är RACE-SÄKER: uppdateringen villkoras på den gamla perioden, så bara den
 * första anroparen vinner och skriver `monthly_reset`-transaktionen. Cron och en
 * samtidig användarförfrågan kan alltså köra samtidigt utan dubbel logg.
 *
 * Ingen rollover: `used_this_period` nollas och `extra_credits` lämnas orörda
 * (köpta credits är betalda och försvinner inte vid månadsskiftet).
 */
export async function sakerstallKonto(tenantId: string, nu: Date = new Date()): Promise<Konto | null> {
  const sb = supabaseService();
  const period = aktuellPeriod(nu);

  const { data: befintligt } = await sb
    .from("credit_accounts")
    .select("tenant_id, monthly_quota, extra_credits, period_start, used_this_period")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!befintligt) {
    const nytt = { tenant_id: tenantId, monthly_quota: STANDARDKVOT, extra_credits: 0, period_start: period, used_this_period: 0 };
    const { data } = await sb.from("credit_accounts").insert(nytt).select().maybeSingle();
    // ⚠ Medveten fail-open: gick skrivningen fel returneras kontot ändå, med full kvot.
    // Konsekvensen är att en trasig databas ALDRIG spärrar en kund — rätt riktning, men
    // det betyder också att ett returnerat konto inte är ett bevis på att raden finns.
    // Ett DoD-skript måste därför läsa tillbaka raden, inte lita på returvärdet.
    return (data as Konto | null) ?? nytt;
  }

  const konto = befintligt as Konto;
  if (konto.period_start >= period) return konto;

  const { data: uppdaterat } = await sb
    .from("credit_accounts")
    .update({ period_start: period, used_this_period: 0, updated_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("period_start", konto.period_start) // vinner bara om ingen hann före
    .select()
    .maybeSingle();

  if (uppdaterat) {
    await sb.from("credit_transactions").insert({
      tenant_id: tenantId,
      delta: konto.monthly_quota,
      type: "monthly_reset",
      note: `Ny period ${period}. Förbrukningen nollställd (${konto.used_this_period} credits användes förra perioden).`,
      created_by: "system",
    });
    return uppdaterat as Konto;
  }

  // Någon annan hann före — läs om.
  const { data: omlast } = await sb
    .from("credit_accounts")
    .select("tenant_id, monthly_quota, extra_credits, period_start, used_this_period")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return (omlast as Konto | null) ?? konto;
}

export function raknaSaldo(konto: Konto): Saldo {
  const saldo = konto.monthly_quota + konto.extra_credits - konto.used_this_period;
  const tak = konto.monthly_quota + konto.extra_credits;
  return {
    saldo,
    kvot: konto.monthly_quota,
    extra: konto.extra_credits,
    anvant: konto.used_this_period,
    periodStart: konto.period_start,
    procentKvar: tak > 0 ? Math.max(0, (saldo / tak) * 100) : 0,
  };
}

export async function hamtaSaldo(tenantId: string, nu: Date = new Date()): Promise<Saldo | null> {
  const konto = await sakerstallKonto(tenantId, nu);
  return konto ? raknaSaldo(konto) : null;
}

/** Månadsreset för alla konton. Körs av cron; idempotent och säker att köra ofta. */
export async function manadsresetAlla(nu: Date = new Date()): Promise<number> {
  try {
    const period = aktuellPeriod(nu);
    const { data } = await supabaseService()
      .from("credit_accounts")
      .select("tenant_id")
      .lt("period_start", period)
      .limit(500);
    let antal = 0;
    for (const rad of (data || []) as Array<{ tenant_id: string }>) {
      await sakerstallKonto(rad.tenant_id, nu);
      antal++;
    }
    return antal;
  } catch (e) {
    console.error("[credits] månadsreset failade:", (e as Error).message);
    return 0;
  }
}

// ── Entitlement (K2-4: default AV) ─────────────────────────────────────────

const modulCache = new Map<string, { pa: boolean; tid: number }>();
const MODUL_TTL_MS = 60 * 1000;

/** Möter den här kunden creditsystemet alls? Är modulen av mäts allt i ledgern utan spärr. */
export async function creditsAktivt(tenantId: string): Promise<boolean> {
  const cachad = modulCache.get(tenantId);
  if (cachad && Date.now() - cachad.tid < MODUL_TTL_MS) return cachad.pa;
  let pa = false;
  try {
    const { hasModule } = await import("./entitlements");
    pa = await hasModule(tenantId, CREDIT_MODUL);
  } catch {
    pa = false; // fail-open: kan vi inte avgöra rättigheten spärrar vi ingen
  }
  modulCache.set(tenantId, { pa, tid: Date.now() });
  return pa;
}

export function nollstallCreditModulCache(tenantId?: string) {
  if (tenantId) modulCache.delete(tenantId);
  else modulCache.clear();
}

// ── Spärr och dragning ─────────────────────────────────────────────────────

export interface Creditlage {
  /** false = gör INTE anropet. */
  tillaten: boolean;
  /** false = modulen är av för tenanten, credits gäller inte här. */
  aktiv: boolean;
  kostnad: number;
  saldo: number;
  /** Vänligt svenskt besked när tillaten === false. Kunden ser aldrig kronor. */
  besked?: string;
}

const ETIKETT: Record<string, { ental: string; flertal: string }> = {
  "social-bild": { ental: "bild", flertal: "bilder" },
  "hero-bild": { ental: "stor bild", flertal: "stora bilder" },
  video: { ental: "video", flertal: "videor" },
  // K3-INKÖP: raderna finns i prislistan men är avstängda och kostar noll tills
  // ICP-motorns kostnadskarta finns. Etiketterna läggs in SAMTIDIGT som raderna:
  // utan dem hade kunden fått läsa "3 lead_niva_a" den dag de slås på.
  lead_niva_a: { ental: "lead nivå A", flertal: "leads nivå A" },
  lead_niva_b: { ental: "lead nivå B", flertal: "leads nivå B" },
};

/**
 * Förbrukningen i klartext: "14 bilder, 1 video".
 * Ett creditbelopp säger inget om vad kunden faktiskt fått — siffran måste översättas
 * till saker hon känner igen, annars är kvoten obegriplig.
 */
export function forbrukningKlartext(antalPerAtgard: Record<string, number>): string {
  const delar = Object.entries(antalPerAtgard)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([atgard, n]) => {
      const e = ETIKETT[atgard] || { ental: atgard, flertal: atgard };
      return `${n} ${n === 1 ? e.ental : e.flertal}`;
    });
  return delar.length ? delar.join(", ") : "inget än den här månaden";
}

/**
 * ETAPP K2-3: är creditsen felprissatta för den här kunden?
 *
 * Systemet har två oberoende bromsar: creditsaldot (det kunden ser) och kostnadstaket i
 * kronor (det som skyddar marginalen). Slår kronorsbromsen FÖRST, medan credits finns
 * kvar, har kunden blivit lovad ett utrymme hon inte får använda. Det är inte ett fel i
 * spärren utan i prissättningen: en bild kostar mer i verkligheten än den gör i credits.
 *
 * Omvänt är det helt normalt att creditsen tar slut medan kronorna räcker — då är
 * marginalen intakt och kvoten gör sitt jobb.
 */
export function arFelprissatt(kostnadSek: number, takSek: number, creditSaldo: number | null): boolean {
  if (creditSaldo === null) return false; // ingen creditkvot → inget att prissätta fel
  return takSek > 0 && kostnadSek >= takSek && creditSaldo > 0;
}

/** Video prissätts per PÅBÖRJAT femsekundersklipp. 6 sekunder = 2 klipp. */
export function videoKlipp(sekunder: number): number {
  return Math.max(1, Math.ceil((Number(sekunder) || 0) / 5));
}

/**
 * Kontroll FÖRE ett mediaanrop. Räcker inte saldot görs inget anrop alls.
 * Fail-open: kan saldot inte läsas släpps anropet igenom.
 */
export async function kontrolleraCredits(
  tenantId: string | null | undefined,
  atgard: CreditAtgard,
  antal = 1,
  nu: Date = new Date(),
): Promise<Creditlage> {
  const av: Creditlage = { tillaten: true, aktiv: false, kostnad: 0, saldo: 0 };
  if (!tenantId) return av;
  if (!(await creditsAktivt(tenantId))) return av;

  try {
    const konto = await sakerstallKonto(tenantId, nu);
    if (!konto) return av;
    const s = raknaSaldo(konto);
    const kostnad = (await creditPris(atgard)) * Math.max(1, antal);
    if (s.saldo >= kostnad) return { tillaten: true, aktiv: true, kostnad, saldo: s.saldo };
    return {
      tillaten: false,
      aktiv: true,
      kostnad,
      saldo: s.saldo,
      besked:
        s.saldo <= 0
          ? "Månadens bilder och videor är slut. Kvoten förnyas den 1:a. Vill du fylla på tidigare, säg till din rådgivare."
          : `Det här skapandet kostar ${kostnad} credits och du har ${s.saldo} kvar. Kvoten förnyas den 1:a, och du kan fylla på tidigare via din rådgivare.`,
    };
  } catch (e) {
    console.error("[credits] kontroll failade, släpper igenom:", (e as Error).message);
    return av;
  }
}

/**
 * Drar credits EFTER ett lyckat anrop och knyter transaktionen till ledgerraden.
 * `usageEventId` är obligatorisk i praktiken: en usage-transaktion utan koppling till
 * ai_usage_events mäter något annat än det som kostade pengar.
 */
export async function dragCredits(opts: {
  tenantId: string;
  atgard: CreditAtgard;
  antal?: number;
  usageEventId: string | null;
  nu?: Date;
}): Promise<number> {
  try {
    const nu = opts.nu ?? new Date();
    const konto = await sakerstallKonto(opts.tenantId, nu);
    if (!konto) return 0;
    const kostnad = (await creditPris(opts.atgard)) * Math.max(1, opts.antal ?? 1);
    const sb = supabaseService();
    const { data } = await sb
      .from("credit_accounts")
      .update({ used_this_period: konto.used_this_period + kostnad, updated_at: nu.toISOString() })
      .eq("tenant_id", opts.tenantId)
      .eq("used_this_period", konto.used_this_period) // ingen förlorad dragning vid samtidighet
      .select("used_this_period")
      .maybeSingle();

    if (!data) {
      // Någon hann före. Läs om och dra mot det färska värdet i stället för att tappa dragningen.
      const { data: farsk } = await sb.from("credit_accounts").select("used_this_period").eq("tenant_id", opts.tenantId).maybeSingle();
      const anvant = Number((farsk as { used_this_period: number } | null)?.used_this_period) || 0;
      await sb.from("credit_accounts").update({ used_this_period: anvant + kostnad, updated_at: nu.toISOString() }).eq("tenant_id", opts.tenantId);
    }

    await sb.from("credit_transactions").insert({
      tenant_id: opts.tenantId,
      delta: -kostnad,
      type: "usage",
      usage_event_id: opts.usageEventId,
      note: opts.atgard,
      created_by: "system",
    });
    return kostnad;
  } catch (e) {
    console.error("[credits] dragning failade:", (e as Error).message);
    return 0;
  }
}

/** Påfyllning: godkänd beställning eller manuell insättning från owner. */
export async function laggTillCredits(opts: {
  tenantId: string;
  credits: number;
  typ: "topup" | "manual_grant";
  note: string;
  createdBy?: string;
}): Promise<boolean> {
  if (!opts.note?.trim()) return false; // notering är obligatorisk vid manuell insättning
  try {
    const sb = supabaseService();
    const konto = await sakerstallKonto(opts.tenantId);
    if (!konto) return false;
    await sb
      .from("credit_accounts")
      .update({ extra_credits: konto.extra_credits + opts.credits, updated_at: new Date().toISOString() })
      .eq("tenant_id", opts.tenantId);
    await sb.from("credit_transactions").insert({
      tenant_id: opts.tenantId,
      delta: opts.credits,
      type: opts.typ,
      note: opts.note.slice(0, 500),
      created_by: opts.createdBy || "owner",
    });
    return true;
  } catch (e) {
    console.error("[credits] påfyllning failade:", (e as Error).message);
    return false;
  }
}

// ── Påfyllningsbeställningar (ingen Stripe) ────────────────────────────────

export const TOPUP_CREDITS = 100;
export const TOPUP_PRIS_SEK = 149;

export async function skapaTopupOrder(tenantId: string): Promise<{ ok: boolean; besked: string }> {
  try {
    const sb = supabaseService();
    const { data: redanKoad } = await sb
      .from("topup_orders")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("status", "pending")
      .maybeSingle();
    if (redanKoad) {
      return { ok: true, besked: "Du har redan en påfyllning på gång. Den aktiveras inom kort." };
    }
    await sb.from("topup_orders").insert({ tenant_id: tenantId, credits: TOPUP_CREDITS, price_sek: TOPUP_PRIS_SEK });
    return { ok: true, besked: "Din påfyllning är beställd och aktiveras inom kort, faktureras separat." };
  } catch {
    return { ok: false, besked: "Beställningen gick inte fram. Försök igen, eller hör av dig till din rådgivare." };
  }
}

export async function beslutaTopupOrder(orderId: string, godkann: boolean, beslutadAv = "owner"): Promise<boolean> {
  try {
    const sb = supabaseService();
    const { data } = await sb
      .from("topup_orders")
      .select("id, tenant_id, credits, status")
      .eq("id", orderId)
      .maybeSingle();
    const order = data as { id: string; tenant_id: string; credits: number; status: string } | null;
    if (!order || order.status !== "pending") return false;

    await sb
      .from("topup_orders")
      .update({ status: godkann ? "approved" : "rejected", decided_at: new Date().toISOString(), decided_by: beslutadAv })
      .eq("id", orderId);

    if (godkann) {
      await laggTillCredits({
        tenantId: order.tenant_id,
        credits: order.credits,
        typ: "topup",
        note: `Påfyllning godkänd (${order.credits} credits, ${TOPUP_PRIS_SEK} kr, faktureras separat).`,
        createdBy: beslutadAv,
      });
    }
    return true;
  } catch (e) {
    console.error("[credits] beslut om påfyllning failade:", (e as Error).message);
    return false;
  }
}
