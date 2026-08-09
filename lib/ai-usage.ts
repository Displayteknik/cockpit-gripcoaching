// KOSTNAD-1 — central AI-kostnadsmätning. ENDA vägen till en AI- eller mediaprovider.
//
// Samma princip som lib/prompt-core: ingen route får anropa en provider direkt. Går ett
// anrop förbi den här filen syns det varken i kostnaden, i provider-hälsan eller i
// budgetgrinden — och då är mätningen värdelös. En route utan wrapper är ett fel.
//
// ⚠ REGELN FRÅN BETALNINGSSPÄRREN (2026-08-01, `6bf3143`): vid fel loggas ALLTID hela
// svarskroppen, aldrig bara statuskoden. Gemini-projektet var betalningsspärrat och
// svarade 403 "Lightning dunning decision is deny" — felet visades för användaren som
// "Kunde inte uppfatta rösten" och kostade en timmes felsökning på en påhittad bugg.
// Svarskroppen bar hela diagnosen.
//
// Två ingångar, samma logg:
//   anropaProvider()  — för rå fetch mot ett HTTP-API (Gemini, fal.ai, Pexels …)
//   loggaAnrop()      — för SDK-anrop där vi inte äger fetchen (Anthropic-SDK i iterate)
//
// Fail-open i varje led: går loggningen fel, saknas prislistan eller är databasen nere
// släpps anropet ändå igenom. Mätningen får aldrig fälla användarens flöde.
// Server-only (service-role) — importera aldrig från en klientkomponent.

import { supabaseService } from "./supabase-admin";
import type { CreditAtgard } from "./credits";
// G-1: typ-import (raderas vid kompilering) — själva loggaren laddas dynamiskt nedan,
// samma mönster som credits, så ingen importcykel kan uppstå.
import type { GenereringsMeta } from "./generationslogg";

// Alla tjänster vi betalar per anrop för. Fasta abonnemang (Vercel, Supabase, GHL,
// domäner) mäts inte här — de ligger i tabellen `fasta_kostnader` och visas i samma vy,
// annars är överblicken inte sann.
export type Provider =
  | "gemini" | "anthropic" | "fal" | "fireworks"   // AI
  | "pexels" | "pixabay"                            // bildsök
  | "resend" | "elks"                               // mejl och SMS
  | "google";                                       // PageSpeed och övriga Google-API:er
export type Felklass = "billing" | "quota" | "auth" | "model" | "other";

/** Standardtak per tenant och månad, i kronor. Kan höjas per tenant i adminvyn. */
export const TENANT_TAK_SEK = 200;

export interface AnropsMeta {
  provider: Provider;
  model: string;
  /**
   * Vilket flöde anropet tillhör: "studio-caption", "blogg", "dm-bildlasning", "prata-in" …
   * Utelämnas den härleds den ur requestens sökväg (se autoKontext) — det är avsiktligt:
   * ett bibliotek djupt ner i kedjan ska inte behöva veta vilken knapp som tryckts, och
   * ett nytt flöde ska aldrig kunna glömmas bort och landa omätt.
   */
  flow?: string;
  /** null = owner-flöde utan tenant. Utelämnas den härleds den ur sessionen. */
  tenantId?: string | null;
  /** Bilder (st) eller video (sekunder) när kostnaden inte mäts i tokens. */
  mediaUnits?: number;
  /**
   * VERKLIG kostnad i kronor när tjänsten själv rapporterar den (46elks skickar med
   * priset per SMS). Går före prislistan: ett fakturerat pris slår alltid en uppskattning.
   */
  kostnadSek?: number;
  /**
   * ETAPP K2: vad kunden får ut, i creditsystemets termer. Sätts på MEDIAanrop (bild,
   * video) — text drar inga credits. Utelämnad på ett anrop med `mediaUnits` tolkas det
   * som en bild till ett inlägg, den vanligaste och billigaste åtgärden.
   */
  mediaAtgard?: CreditAtgard;
  /** Antal enheter av åtgärden (video: påbörjade femsekundersklipp). */
  mediaAntal?: number;
  /**
   * G-1: metadata om GENERERINGEN, när anropet producerar kundtext eller kundbild.
   * Sätts av flödet — bara det vet syfte, format och vilken promptversion som byggde
   * prompten. Utelämnad loggas ingen generering, och det syns som en lucka i vyn
   * i stället för att gissas fram.
   *
   * Ligger HÄR och inte i ett eget anrop av samma skäl som kostnadsloggen: en väg förbi
   * den obligatoriska vägen är en väg förbi hela mätningen.
   */
  generering?: GenereringsMeta;
}

/**
 * Flöde och tenant ur den pågående requesten. Middleware sätter `x-pathname` på VARJE
 * request (proxy.ts), och tenanten är den som `getActiveClientId` redan äger — samma
 * källa som resten av appen, så mätningen kan aldrig visa en annan tenant än den som
 * faktiskt betjänades.
 *
 * Utanför en request (cron, skript, batch) finns ingen kontext: då loggas anropet som
 * owner-flöde utan tenant, vilket är sant.
 */
async function autoKontext(): Promise<{ flow: string; tenantId: string | null }> {
  let flow = "okant";
  let tenantId: string | null = null;
  try {
    const { headers } = await import("next/headers");
    const h = await headers();
    const p = h.get("x-pathname") || "";
    if (p) flow = p.replace(/^\/api\//, "").replace(/^\//, "") || "okant";
  } catch { /* ingen request-kontext */ }
  try {
    const { getActiveClientId } = await import("./client-context");
    tenantId = await getActiveClientId();
  } catch { /* ingen session */ }
  return { flow, tenantId };
}

async function fyllKontext(meta: AnropsMeta): Promise<AnropsMeta & { flow: string }> {
  if (meta.flow && meta.tenantId !== undefined) return { ...meta, flow: meta.flow };
  const auto = await autoKontext();
  return {
    ...meta,
    flow: meta.flow || auto.flow,
    tenantId: meta.tenantId !== undefined ? meta.tenantId : auto.tenantId,
  };
}

export interface ProviderSvar<T = unknown> {
  ok: boolean;
  status: number;
  data: T | null;
  /** Rå svarskropp — alltid läst, även vid fel. */
  raw: string;
  felklass?: Felklass;
  /** Klartext till anroparen. Sätts bara när ok === false. */
  fel?: string;
  latencyMs: number;
  /** true = en grind stoppade anropet innan det gjordes (ingen provider kontaktades). */
  budgetstopp?: boolean;
  /** true = stoppet berodde på slut creditsaldo, inte på kronorsgränsen. */
  creditstopp?: boolean;
  /** Id på raden i ai_usage_events. Credits-ledgern (STEG 3) pekar på den. */
  handelseId?: string | null;
  /**
   * G-1: id på raden i generation_log, när `generering` skickades med. Anroparen behöver
   * det för att binda genereringen till inlägget den blev (`kopplaTillInlagg`) eller för
   * att markera den kasserad vid omgenerering.
   */
  generationId?: string | null;
}

// ── Felklassning ───────────────────────────────────────────────────────────

/**
 * Klassa ett providerfel. Statuskoden ensam räcker inte: 403 är både "fel nyckel" och
 * "obetald faktura", och 400 är både "trasig prompt" och "tom plånbok" hos Anthropic.
 * Därför läses kroppen. Betalning prövas FÖRST — den är den dyraste feldiagnosen att missa.
 */
export function klassaFel(status: number, kropp: string): Felklass {
  const k = (kropp || "").toLowerCase();
  const betalning = /billing|payment|dunning|credit balance|insufficient|suspend|past due|obetald/.test(k);
  if (status === 402 || betalning) return "billing";
  if (status === 429 || /rate.?limit|resource.?exhausted|too many requests/.test(k)) return "quota";
  if (status === 401 || status === 403 || /api[_ -]?key|unauthenticated|permission.?denied|invalid.?x-api-key/.test(k)) return "auth";
  if (status === 404 || /model|not found|unsupported/.test(k)) return "model";
  return "other";
}

/** Kort svensk klartext per felklass — används i adminvyns larmbanner. */
export function felklassText(f: Felklass, provider: string): string {
  switch (f) {
    case "billing": return `${provider} svarar med betalningsfel. Kontrollera fakturan hos leverantören.`;
    case "auth": return `${provider} nekar nyckeln. Kontrollera att API-nyckeln är giltig och satt i miljövariablerna.`;
    case "quota": return `${provider} har nått sin hastighetsgräns. Anropen går fram igen när kvoten återställs.`;
    case "model": return `${provider} känner inte igen modellen som efterfrågades.`;
    default: return `${provider} svarade med ett fel.`;
  }
}

/** RÖD status = kräver att någon gör något. Kvot löser sig själv, betalning och nyckel gör det inte. */
export const ROD_FELKLASS: Felklass[] = ["billing", "auth"];

// ── Prislista (cachad, ägarstyrd i DB utan deploy) ─────────────────────────

interface Prisrad {
  provider: string;
  model: string;
  pris_in_per_mtoken: number | null;
  pris_ut_per_mtoken: number | null;
  pris_per_media: number | null;
  vaxelkurs: number;
}

let prisCache: { rader: Prisrad[]; tid: number } | null = null;
const PRIS_TTL_MS = 5 * 60 * 1000;

async function prislista(): Promise<Prisrad[]> {
  if (prisCache && Date.now() - prisCache.tid < PRIS_TTL_MS) return prisCache.rader;
  try {
    const sb = supabaseService();
    const { data } = await sb
      .from("ai_pricing")
      .select("provider, model, pris_in_per_mtoken, pris_ut_per_mtoken, pris_per_media, vaxelkurs")
      .eq("aktiv", true);
    prisCache = { rader: (data || []) as Prisrad[], tid: Date.now() };
    return prisCache.rader;
  } catch {
    return prisCache?.rader || []; // fail-open: okänt pris är 0, aldrig ett stopp
  }
}

/** Töm prischen (adminvyn anropar efter att priser ändrats). */
export function nollstallPrisCache() {
  prisCache = null;
}

export function beraknaKostnad(
  rad: Prisrad | undefined,
  tokensIn: number,
  tokensUt: number,
  mediaUnits: number,
): number {
  if (!rad) return 0;
  const kurs = Number(rad.vaxelkurs) || 1;
  if (rad.pris_per_media != null && mediaUnits > 0) {
    return Number(rad.pris_per_media) * mediaUnits * kurs;
  }
  const inKost = ((Number(rad.pris_in_per_mtoken) || 0) * tokensIn) / 1_000_000;
  const utKost = ((Number(rad.pris_ut_per_mtoken) || 0) * tokensUt) / 1_000_000;
  return (inKost + utKost) * kurs;
}

// ── Loggning ───────────────────────────────────────────────────────────────

export interface Handelse extends AnropsMeta {
  flow: string;
  tokensIn: number;
  tokensUt: number;
  status: "ok" | "error";
  felklass?: Felklass;
  httpStatus?: number;
  /** Hela svarskroppen vid fel. Klipps bara för att inte spränga raden. */
  svarskropp?: string;
  latencyMs: number;
}

const KROPP_MAX = 8000;

/**
 * Skriver en rad i ai_usage_events och returnerar radens id (credits-ledgern i STEG 3
 * pekar på det). Kastar aldrig — mätningen får inte fälla flödet.
 */
export async function loggaHandelse(h: Handelse): Promise<string | null> {
  try {
    const rader = await prislista();
    const rad = rader.find((r) => r.provider === h.provider && r.model === h.model);
    const media = h.mediaUnits || 0;
    // Rapporterat pris går före prislistan: fakturerat slår uppskattat.
    const kostnad = h.kostnadSek !== undefined ? h.kostnadSek : beraknaKostnad(rad, h.tokensIn, h.tokensUt, media);
    const sb = supabaseService();
    const { data } = await sb.from("ai_usage_events").insert({
      tenant_id: h.tenantId || null,
      provider: h.provider,
      model: h.model,
      flow: h.flow,
      tokens_in: h.tokensIn,
      tokens_out: h.tokensUt,
      media_units: media,
      estimated_cost_sek: kostnad,
      status: h.status,
      error_class: h.felklass || null,
      http_status: h.httpStatus ?? null,
      error_body: h.svarskropp ? h.svarskropp.slice(0, KROPP_MAX) : null,
      latency_ms: h.latencyMs,
    }).select("id").maybeSingle();
    return (data as { id: string } | null)?.id ?? null;
  } catch (e) {
    console.error("[ai-usage] kunde inte logga anrop:", (e as Error).message);
    return null;
  }
}

/**
 * Rättar kostnaden på en redan skriven rad. Behövs när tjänsten rapporterar priset i
 * svaret (46elks) — då är det fakturerade priset känt först efter att raden skrivits.
 * Kastar aldrig.
 */
export async function skrivKostnad(handelseId: string, kostnadSek: number): Promise<void> {
  try {
    await supabaseService().from("ai_usage_events").update({ estimated_cost_sek: kostnadSek }).eq("id", handelseId);
  } catch (e) {
    console.error("[ai-usage] kunde inte skriva verklig kostnad:", (e as Error).message);
  }
}

// ── Budgetgrind (K4) ───────────────────────────────────────────────────────

export interface Budgetlage {
  tillaten: boolean;
  forbrukat: number;
  tak: number;
  procent: number;
  /** Vänligt svenskt besked när tillaten === false. */
  besked?: string;
}

const budgetCache = new Map<string, { lage: Budgetlage; tid: number }>();
const BUDGET_TTL_MS = 60 * 1000;

function manadensStart(): string {
  const nu = new Date();
  return new Date(Date.UTC(nu.getUTCFullYear(), nu.getUTCMonth(), 1)).toISOString();
}

/** Summerad kostnad för en tenant (eller hela plattformen när tenantId utelämnas). */
export async function forbrukatDennaManad(tenantId?: string | null): Promise<number> {
  try {
    const sb = supabaseService();
    let q = sb.from("ai_usage_events").select("estimated_cost_sek").gte("created_at", manadensStart());
    if (tenantId) q = q.eq("tenant_id", tenantId);
    const { data } = await q;
    return (data || []).reduce((s, r) => s + (Number((r as { estimated_cost_sek: number }).estimated_cost_sek) || 0), 0);
  } catch {
    return 0; // fail-open: kan vi inte mäta får vi inte heller spärra
  }
}

export async function tenantTak(tenantId: string): Promise<number> {
  try {
    const sb = supabaseService();
    const { data } = await sb.from("ai_tenant_budget").select("tak_sek").eq("tenant_id", tenantId).maybeSingle();
    const t = Number((data as { tak_sek: number } | null)?.tak_sek);
    return Number.isFinite(t) && t > 0 ? t : TENANT_TAK_SEK;
  } catch {
    return TENANT_TAK_SEK;
  }
}

/**
 * Hård kostnadsgräns per tenant och månad. Mäts i ledgern, gäller oavsett creditsaldo
 * (ETAPP K2 bygger ovanpå samma siffra — aldrig en egen parallell mätning).
 */
export async function kontrolleraBudget(tenantId: string | null | undefined): Promise<Budgetlage> {
  if (!tenantId) return { tillaten: true, forbrukat: 0, tak: 0, procent: 0 };
  const cachad = budgetCache.get(tenantId);
  if (cachad && Date.now() - cachad.tid < BUDGET_TTL_MS) return cachad.lage;

  const [forbrukat, tak] = await Promise.all([forbrukatDennaManad(tenantId), tenantTak(tenantId)]);
  const procent = tak > 0 ? (forbrukat / tak) * 100 : 0;
  const lage: Budgetlage = {
    tillaten: procent < 100,
    forbrukat,
    tak,
    procent,
    besked:
      procent < 100
        ? undefined
        : "Månadens utrymme för AI-tjänster är slut. Det nollställs den 1:a. Hör av dig till din rådgivare om du behöver mer redan nu.",
  };
  budgetCache.set(tenantId, { lage, tid: Date.now() });
  return lage;
}

/** Adminvyn anropar efter att ett tak höjts, så spärren släpper direkt. */
export function nollstallBudgetCache(tenantId?: string) {
  if (tenantId) budgetCache.delete(tenantId);
  else budgetCache.clear();
}

// ── Ingång 1: rå HTTP mot en provider ──────────────────────────────────────

function plockaTokens(provider: Provider, data: unknown): { in: number; ut: number } {
  const d = data as Record<string, unknown> | null;
  if (!d) return { in: 0, ut: 0 };
  if (provider === "gemini") {
    const u = (d.usageMetadata || {}) as Record<string, unknown>;
    return { in: Number(u.promptTokenCount) || 0, ut: Number(u.candidatesTokenCount) || 0 };
  }
  if (provider === "anthropic") {
    const u = (d.usage || {}) as Record<string, unknown>;
    return { in: Number(u.input_tokens) || 0, ut: Number(u.output_tokens) || 0 };
  }
  return { in: 0, ut: 0 };
}

/**
 * Gör anropet, mäter det, klassar felet och loggar raden. Kastar aldrig på HTTP-fel —
 * anroparen läser `ok` och `fel`. Nätverksfel och timeout loggas som "other".
 */
export async function anropaProvider<T = unknown>(
  raw_opts: AnropsMeta & { url: string; init: RequestInit; timeoutMs?: number },
): Promise<ProviderSvar<T>> {
  const opts = { ...raw_opts, ...(await fyllKontext(raw_opts)) };
  // Budgetstopp loggas INTE som ett providerfel: ingen provider kontaktades, och en
  // spärrad tenant får inte färga providerhälsan röd för alla andra.
  const budget = await kontrolleraBudget(opts.tenantId);
  if (!budget.tillaten) {
    return { ok: false, status: 0, data: null, raw: "", fel: budget.besked, latencyMs: 0, budgetstopp: true };
  }

  // ETAPP K2: creditspärr för MEDIAanrop. Ligger här, på den obligatoriska vägen, av
  // samma skäl som kostnadsloggen: en väg förbi spärren är en väg förbi hela systemet.
  // Kronorsgränsen ovan gäller alltid; credits bara för tenants som har modulen på.
  const arMedia = !!raw_opts.mediaAtgard || (raw_opts.mediaUnits || 0) > 0;
  const atgard: CreditAtgard = raw_opts.mediaAtgard || "social-bild";
  const antal = raw_opts.mediaAntal ?? 1;
  let creditlage: Awaited<ReturnType<typeof import("./credits").kontrolleraCredits>> | null = null;
  if (arMedia && opts.tenantId) {
    const { kontrolleraCredits } = await import("./credits");
    creditlage = await kontrolleraCredits(opts.tenantId, atgard, antal);
    if (!creditlage.tillaten) {
      return { ok: false, status: 0, data: null, raw: "", fel: creditlage.besked, latencyMs: 0, budgetstopp: true, creditstopp: true };
    }
  }

  const t0 = Date.now();
  let status = 0;
  let raw = "";
  let data: T | null = null;
  let felklass: Felklass | undefined;
  let fel: string | undefined;

  try {
    const res = await fetch(opts.url, {
      ...opts.init,
      signal: opts.init.signal ?? (opts.timeoutMs ? AbortSignal.timeout(opts.timeoutMs) : undefined),
    });
    status = res.status;
    raw = await res.text(); // ALLTID — kroppen är diagnosen
    try {
      data = JSON.parse(raw) as T;
    } catch {
      data = null;
    }
    if (!res.ok) {
      felklass = klassaFel(status, raw);
      fel = felklassText(felklass, opts.provider);
    }
  } catch (e) {
    // Nätverksfel, avbruten fetch eller timeout: ingen statuskod finns.
    raw = (e as Error).message || String(e);
    felklass = /abort|timeout/i.test(raw) ? "quota" : "other";
    fel = `Anropet till ${opts.provider} gick inte fram: ${raw}`;
  }

  const latencyMs = Date.now() - t0;
  const ok = status >= 200 && status < 300;
  const tokens = ok ? plockaTokens(opts.provider, data) : { in: 0, ut: 0 };

  const handelseId = await loggaHandelse({
    provider: opts.provider,
    model: opts.model,
    flow: opts.flow,
    tenantId: opts.tenantId,
    mediaUnits: ok ? opts.mediaUnits : 0,
    kostnadSek: ok ? opts.kostnadSek : 0,
    tokensIn: tokens.in,
    tokensUt: tokens.ut,
    status: ok ? "ok" : "error",
    felklass,
    httpStatus: status || undefined,
    svarskropp: ok ? undefined : raw,
    latencyMs,
  });

  // Credits dras FÖRST efter ett lyckat anrop, och transaktionen pekar på ledgerraden.
  // Ett misslyckat anrop kostar kunden ingenting — det är inte kundens fel.
  if (ok && creditlage?.aktiv && opts.tenantId) {
    const { dragCredits } = await import("./credits");
    await dragCredits({ tenantId: opts.tenantId, atgard, antal, usageEventId: handelseId });
  }

  // G-1: generationsloggen. Skrivs ÄVEN vid fel — ett flöde som misslyckas ofta på en
  // viss promptversion är exakt det mätningen ska kunna se.
  const generationId = await loggaGenereringOmBegard(opts, handelseId, ok);

  return { ok, status, data, raw, felklass, fel, latencyMs, handelseId, generationId };
}

/**
 * G-1: skriver generationsraden när flödet bett om det, och binder den till kostnadsraden.
 * Dynamisk import — samma mönster som credits, så typ-cykeln aldrig blir en runtime-cykel.
 * Kastar aldrig: loggaGenerering är själv fail-open, och den här nivån lägger inte till
 * någon egen väg att fälla anropet.
 */
async function loggaGenereringOmBegard(
  opts: AnropsMeta,
  handelseId: string | null,
  ok: boolean,
): Promise<string | null> {
  if (!opts.generering) return null;
  const { loggaGenerering } = await import("./generationslogg");
  return loggaGenerering({
    ...opts.generering,
    tenantId: opts.tenantId,
    aiUsageEventId: handelseId,
    // Flödet får sätta 'kasserad' i efterhand; här avgör anropets utfall.
    status: ok ? "ok" : "error",
  });
}

// ── Ingång 2: SDK-anrop vi inte äger fetchen för ───────────────────────────

/**
 * Kör ett SDK-anrop och logga det. Callbacken returnerar resultatet plus vad den vet om
 * token-användningen. Fel klassas ur SDK:ns egna fält (`status`, meddelandetext) och
 * kastas vidare — anroparen behåller sin felhantering.
 */
export async function loggaAnrop<T>(
  raw_meta: AnropsMeta,
  kor: () => Promise<{ resultat: T; tokensIn?: number; tokensUt?: number; mediaUnits?: number }>,
): Promise<T> {
  const meta = await fyllKontext(raw_meta);
  const budget = await kontrolleraBudget(meta.tenantId);
  if (!budget.tillaten) throw new Error(budget.besked);

  const t0 = Date.now();
  try {
    const r = await kor();
    const handelseId = await loggaHandelse({
      ...meta,
      mediaUnits: r.mediaUnits ?? meta.mediaUnits,
      tokensIn: r.tokensIn || 0,
      tokensUt: r.tokensUt || 0,
      status: "ok",
      latencyMs: Date.now() - t0,
    });
    // G-1: Anthropic-vägen loggar sina genereringar precis som fetch-vägen. Skulle den
    // saknas hade iterationsloopens texter varit osynliga i mätningen — och det är just
    // dem hela röstarbetet handlar om.
    await loggaGenereringOmBegard(meta, handelseId, true);
    return r.resultat;
  } catch (e) {
    const err = e as { status?: number; message?: string; error?: unknown };
    const kropp = [err.message, err.error ? JSON.stringify(err.error) : ""].filter(Boolean).join(" ");
    const handelseId = await loggaHandelse({
      ...meta,
      mediaUnits: 0,
      tokensIn: 0,
      tokensUt: 0,
      status: "error",
      felklass: klassaFel(err.status || 0, kropp),
      httpStatus: err.status,
      svarskropp: kropp,
      latencyMs: Date.now() - t0,
    });
    await loggaGenereringOmBegard(meta, handelseId, false);
    throw e;
  }
}
