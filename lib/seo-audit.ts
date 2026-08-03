// SEO + AEO audit-engine. Hämtar HTML, analyserar, returnerar score + issues.
//
// SEO-1 / S-1 + S-2: hämtningen går genom lib/seo-hamta (en user-agent, bara 200,
// minst 500 byte, logg per URL) och varje mätvärde är nullbart. `null` = inte mätt,
// `0` = mätt till noll. En misslyckad hämtning får ALDRIG bli nollor.
import { extractPageSignals, scoreSignals, type LighthouseSvar } from "./seo-deep";
import { hamtaSida, arSidaEjLast, type HamtLogg, type HamtOrsak } from "./seo-hamta";

export interface AuditResult {
  url: string;
  /** Hämtningens facit — utan den går nästa fel inte att felsöka. */
  hamtning: { ok: boolean; status: number | null; bytes: number | null; slutUrl: string | null; ms: number; orsak: HamtOrsak | null };
  /** null = sidan lästes. Sträng = varför den inte kunde läsas; då är allt nedan null. */
  ej_matt_orsak: string | null;
  title: string | null;
  meta_description: string | null;
  h1: string | null;
  word_count: number | null;
  has_schema: boolean | null;
  has_faq: boolean | null;
  has_og: boolean | null;
  internal_links: number | null;
  external_links: number | null;
  images_total: number | null;
  images_no_alt: number | null;
  pagespeed_mobile?: number;
  pagespeed_desktop?: number;
  seo_score: number | null;
  aeo_score: number | null;
  issues: { level: "error" | "warn" | "info"; field: string; message: string }[];
}

const stripTags = (html: string) => html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ");
const m = (html: string, re: RegExp) => (html.match(re)?.[1] || "").trim();
const all = (html: string, re: RegExp) => Array.from(html.matchAll(re));

export async function auditUrl(url: string, baseUrl: string): Promise<AuditResult> {
  const issues: AuditResult["issues"] = [];
  let html: string;
  let logg: HamtLogg;
  try {
    const svar = await hamtaSida(url, { timeoutMs: 20000 });
    html = svar.text;
    logg = svar.logg;
  } catch (e) {
    // Statuskod, byte-storlek och orsak bevaras — och INGET mätvärde hittas på.
    const l = arSidaEjLast(e)
      ? e.logg
      : ({ url, status: null, bytes: null, slutUrl: null, ms: 0, ok: false, orsak: "natverk", fel: (e as Error).message } as HamtLogg);
    issues.push({ level: "error", field: "fetch", message: l.fel || "Sidan kunde inte läsas" });
    return emptyResult(url, l, issues);
  }

  const title = m(html, /<title[^>]*>([\s\S]*?)<\/title>/i) || null;
  const description = m(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) || null;
  const h1 = m(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i).replace(/<[^>]+>/g, "") || null;
  const text = stripTags(html);
  const word_count = text.split(/\s+/).filter(Boolean).length;

  const has_schema = /application\/ld\+json/i.test(html);
  const has_faq = /FAQPage|"@type":\s*"Question"/i.test(html) || /Vanliga\s+frågor/i.test(text);
  const has_og = /<meta[^>]+property=["']og:/i.test(html);

  const links = all(html, /<a[^>]+href=["']([^"']+)["']/gi).map((mm) => mm[1]);
  const host = new URL(baseUrl).host;
  let internal = 0, external = 0;
  for (const l of links) {
    if (!l || l.startsWith("#") || l.startsWith("mailto:") || l.startsWith("tel:") || l.startsWith("javascript:")) continue;
    try {
      const u = new URL(l, baseUrl);
      if (u.host === host) internal++; else external++;
    } catch { /* ignore */ }
  }

  const imgs = all(html, /<img[^>]*>/gi).map((mm) => mm[0]);
  const images_no_alt = imgs.filter((i) => !/alt=["'][^"']+["']/i.test(i)).length;

  // SEO scoring
  let seo = 100;
  if (!title) { seo -= 15; issues.push({ level: "error", field: "title", message: "Saknar <title>" }); }
  else if (title.length < 30 || title.length > 60) { seo -= 5; issues.push({ level: "warn", field: "title", message: `Title ${title.length} tecken (rekomm 30–60)` }); }
  if (!description) { seo -= 15; issues.push({ level: "error", field: "meta_description", message: "Saknar meta description" }); }
  else if (description.length < 120 || description.length > 160) { seo -= 5; issues.push({ level: "warn", field: "meta_description", message: `Description ${description.length} tecken (rekomm 120–160)` }); }
  if (!h1) { seo -= 10; issues.push({ level: "error", field: "h1", message: "Saknar <h1>" }); }
  if (word_count < 300) { seo -= 10; issues.push({ level: "warn", field: "content", message: `Bara ${word_count} ord — tunt innehåll` }); }
  if (!has_og) { seo -= 5; issues.push({ level: "warn", field: "og", message: "Saknar Open Graph-taggar" }); }
  if (images_no_alt > 0) { seo -= Math.min(10, images_no_alt * 2); issues.push({ level: "warn", field: "images", message: `${images_no_alt} bild(er) utan alt-text` }); }
  if (internal < 3) { seo -= 5; issues.push({ level: "info", field: "internal_links", message: `Bara ${internal} interna länkar` }); }

  // AEO scoring (Answer Engine Optimization — för ChatGPT/Perplexity/Google AI)
  let aeo = 100;
  if (!has_schema) { aeo -= 20; issues.push({ level: "warn", field: "schema", message: "Saknar Schema.org/JSON-LD strukturerad data" }); }
  if (!has_faq) { aeo -= 15; issues.push({ level: "warn", field: "faq", message: "Saknar FAQ-sektion (AI-motorer älskar frågor+svar)" }); }
  if (word_count < 600) { aeo -= 10; issues.push({ level: "info", field: "content_depth", message: "AI-motorer favoriserar djupare innehåll (600+ ord)" }); }
  // Conversational structure: H2/H3 som frågor
  const headings = all(html, /<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi).map(mm => mm[1].replace(/<[^>]+>/g, "").trim());
  const questionHeadings = headings.filter(h => /\?$/.test(h) || /^(varför|hur|vad|när|vilken|vilka|kan jag|går det)/i.test(h));
  if (questionHeadings.length === 0) { aeo -= 10; issues.push({ level: "info", field: "headings", message: "Inga rubriker formulerade som frågor — minskar AEO" }); }
  // Citation-friendly: lists, statistics, named entities
  const lists = all(html, /<(ul|ol)[\s\S]*?<\/\1>/gi).length;
  if (lists < 2) { aeo -= 5; issues.push({ level: "info", field: "lists", message: "Få listor — AI-motorer citerar gärna punktlistor" }); }
  // Last updated date — AI prefers fresh content
  if (!/datemodified|updated|uppdaterad/i.test(html)) { aeo -= 5; issues.push({ level: "info", field: "freshness", message: "Ingen synlig datum/uppdaterad-info — AI prioriterar färskt innehåll" }); }

  return {
    url,
    hamtning: { ok: true, status: logg.status, bytes: logg.bytes, slutUrl: logg.slutUrl, ms: logg.ms, orsak: null },
    ej_matt_orsak: null,
    title,
    meta_description: description,
    h1,
    word_count,
    has_schema,
    has_faq,
    has_og,
    internal_links: internal,
    external_links: external,
    images_total: imgs.length,
    images_no_alt,
    seo_score: Math.max(0, seo),
    aeo_score: Math.max(0, aeo),
    issues,
  };
}

// Render-medveten audit (samma motor som rapporten) — fixar falska "saknas" på
// client-side-renderade sajter (GHL). Använd denna istället för auditUrl().
// ⚠ Kastar `SidaEjLast` när sidan inte gick att läsa. Anroparen ska visa felet,
// aldrig spara nollor.
export async function auditUrlRendered(url: string): Promise<AuditResult> {
  const s = await extractPageSignals(url);
  const sc = scoreSignals(s);
  const issues: AuditResult["issues"] = [];
  for (const c of sc.checks) {
    if (c.status === "fel") issues.push({ level: c.id === "indexerbar" ? "error" : "warn", field: c.id, message: `${c.label}: ${c.detail}` });
    else if (c.status === "ej-matt") issues.push({ level: "info", field: c.id, message: `${c.label}: EJ MÄTT — ${c.detail}` });
  }
  if (s.schemaTypes != null && s.schemaTypes.length === 0) issues.push({ level: "warn", field: "schema", message: "Saknar strukturerad data (JSON-LD)" });
  return {
    url: s.url,
    hamtning: { ok: s.hamtning.ok, status: s.hamtning.status, bytes: s.hamtning.bytes, slutUrl: s.hamtning.slutUrl, ms: s.hamtning.ms, orsak: s.hamtning.orsak },
    ej_matt_orsak: s.ejMattOrsak,
    title: s.title,
    meta_description: s.metaDescription,
    h1: s.headings?.find((h) => h.level === 1)?.text ?? null,
    word_count: s.wordCount,
    has_schema: s.schemaTypes == null ? null : s.schemaTypes.length > 0,
    has_faq: s.schemaTypes == null ? null : s.schemaTypes.includes("FAQPage") || (s.faqs?.length ?? 0) > 0,
    has_og: s.ogTags == null ? null : Object.keys(s.ogTags).length > 0,
    internal_links: s.links ? s.links.internal : null,
    external_links: s.links ? s.links.external : null,
    images_total: s.images ? s.images.total : null,
    images_no_alt: s.images ? s.images.withoutAlt : null,
    seo_score: sc.seo,
    aeo_score: sc.aeo,
    issues,
  };
}

/** Sidan kunde inte läsas. Varje mätvärde är null — aldrig 0, aldrig false. */
function emptyResult(url: string, logg: HamtLogg, issues: AuditResult["issues"]): AuditResult {
  return {
    url,
    hamtning: { ok: false, status: logg.status, bytes: logg.bytes, slutUrl: logg.slutUrl, ms: logg.ms, orsak: logg.orsak },
    ej_matt_orsak: logg.fel || "Sidan kunde inte läsas",
    title: null, meta_description: null, h1: null,
    word_count: null, has_schema: null, has_faq: null, has_og: null,
    internal_links: null, external_links: null, images_total: null, images_no_alt: null,
    seo_score: null, aeo_score: null, issues,
  };
}

// PageSpeed Insights — gratis, ingen nyckel krävs för låg volym
export async function pageSpeed(url: string): Promise<{ mobile: number | null; desktop: number | null }> {
  async function get(strategy: "mobile" | "desktop") {
    try {
      const u = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=${strategy}&category=performance`;
      // KOSTNAD-1b: går genom lib/ai-usage (mätning och felklassning i samma vy).
      const { anropaProvider } = await import("./ai-usage");
      const svar = await anropaProvider<LighthouseSvar>({
        provider: "google",
        model: "pagespeed",
        url: u,
        init: { signal: AbortSignal.timeout(45000) },
      });
      if (!svar.ok) return null;
      const d = svar.data;
      const score = d?.lighthouseResult?.categories?.performance?.score;
      return typeof score === "number" ? Math.round(score * 100) : null;
    } catch { return null; }
  }
  const [mobile, desktop] = await Promise.all([get("mobile"), get("desktop")]);
  return { mobile, desktop };
}
