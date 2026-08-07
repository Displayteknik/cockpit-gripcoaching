// Djup-extraktor: plockar ut den FAKTISKA strukturen och innehållet ur en sida,
// så AI-rapporten kan analysera på riktigt (E-E-A-T, citerbarhet, rubrikhierarki)
// istället för att bara tolka mätvärden. Alla siffror här är deterministiska = korrekta.
//
// RENDER-MEDVETEN: client-side-renderade sajter (GoHighLevel, Next/SPA) lägger
// canonical + schema HTML-kodat i hydrerings-payloaden (<link ...). Vi söker
// därför både i rå HTML och i en avkodad kopia, så vi inte ger falska "saknas".
// Källa kodifierad i lesson_ghl_client_side_verify.
//
// SEO-1 / S-1 + S-2 — TVÅ REGLER SOM INTE FÅR BRYTAS:
//  * All hämtning går genom lib/seo-hamta (EN user-agent, bara 200, minst 500 byte,
//    logg per URL). En sida som inte kunde läsas kastar `SidaEjLast`.
//  * `null` betyder "inte mätt", `0` betyder "mätt till noll". Ingen kodväg får
//    konvertera ett misslyckat anrop till 0, tom sträng eller tom lista — det var
//    exakt så for-balance-rapporten fick "0 ord, 0 bilder, ingen title" om en sajt
//    med 678 ord och 75 bilder, och grönt ljus på "inga bilder utan alt-text".

import { hamtaSida, hamtaRatt, arSidaEjLast, type HamtLogg, type HamtOrsak } from "./seo-hamta";

export { SEO_USER_AGENT, SidaEjLast, arSidaEjLast, MIN_SIDSTORLEK_BYTE } from "./seo-hamta";
export type { HamtLogg } from "./seo-hamta";

export interface CwvMetric {
  value: number;
  category: "good" | "needs-improvement" | "poor";
}

/**
 * Alla mätvärden är nullbara med flit.
 * `null` = INTE MÄTT. `0` / `[]` / `""` = mätt, och resultatet blev tomt.
 */
export interface PageSignals {
  url: string;
  /** Bevis på vad hämtningen gav: statuskod, byte, slutlig URL, tid. */
  hamtning: HamtLogg;
  /** null = sidan lästes. Sträng = varför sidan INTE lästes; då är alla mätvärden null. */
  ejMattOrsak: string | null;
  /** Sajtnivåhämtningar som försöktes men föll. null = lyckades eller hoppades över. */
  sajtHamtFel: { robots: string | null; sitemap: string | null };
  title: string | null;
  titleLength: number | null;
  metaDescription: string | null;
  metaLength: number | null;
  canonical: string | null;
  canonicalSource: "static" | "payload" | "none" | "okand";
  lang: string | null;
  robots: string | null;
  ogTags: Record<string, string> | null;
  schemaTypes: string[] | null;
  faqs: { question: string; answer: string }[] | null;
  headings: { level: number; text: string }[] | null;
  emptyHeadings: number | null;
  wordCount: number | null;
  paragraphCount: number | null;
  listCount: number | null;
  images: { total: number; withoutAlt: number } | null;
  links: { internal: number; external: number } | null;
  hasUpdatedDate: boolean | null;
  // Plattform + teknisk hygien hämtad live
  platform: string | null;
  robotsTxt: { found: boolean; blocksEverything: boolean; sitemapDeclared: string | null } | null;
  sitemap: { found: boolean; urlCount: number | null } | null;
  cwv: { lcp: CwvMetric | null; inp: CwvMetric | null; cls: CwvMetric | null; source: "field" | "none" } | null;
  lighthouseSeo: number | null; // 0-100, renderad (Lighthouse via PSI)
  lighthouseAudits: { id: string; title: string; score: number | null; displayValue?: string }[] | null;
  renderNote: string;
  mainText: string | null; // rensad, trunkerad till ~12000 tecken. null = ej mätt
}

const stripText = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

// Avkoda JS-strängars escaping så client-side-renderade taggar blir sökbara.
// Exporterad för att onboarding-skrapan (lib/onboard) ska läsa GHL- och Next-sajter
// likadant som SEO-motorn gör — en kopia här hade garanterat glidit isär över tid.
export const decodePayload = (html: string) =>
  html
    .replace(/\\u003C/gi, "<")
    .replace(/\\u003E/gi, ">")
    .replace(/\\u0026/gi, "&")
    .replace(/\\u002F/gi, "/")
    .replace(/\\"/g, '"')
    .replace(/\\\//g, "/");

const first = (html: string, re: RegExp) => (html.match(re)?.[1] || "").trim();
const allMatches = (html: string, re: RegExp) => Array.from(html.matchAll(re));

function collectTypes(node: unknown, out: Set<string>) {
  if (!node) return;
  if (Array.isArray(node)) return node.forEach((n) => collectTypes(n, out));
  if (typeof node === "object") {
    const obj = node as Record<string, unknown>;
    const t = obj["@type"];
    if (typeof t === "string") out.add(t);
    if (Array.isArray(t)) t.forEach((x) => typeof x === "string" && out.add(x));
    Object.values(obj).forEach((v) => collectTypes(v, out));
  }
}

function collectFaqs(node: unknown, out: { question: string; answer: string }[]) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) return node.forEach((n) => collectFaqs(n, out));
  const obj = node as Record<string, unknown>;
  if (obj["@type"] === "Question" && typeof obj.name === "string") {
    const ans = obj.acceptedAnswer as Record<string, unknown> | undefined;
    const text = ans && typeof ans.text === "string" ? ans.text : "";
    out.push({ question: obj.name, answer: stripText(text).slice(0, 400) });
  }
  Object.values(obj).forEach((v) => collectFaqs(v, out));
}

function detectPlatform(html: string, headers: Headers): string {
  const gen = first(html, /<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)["']/i);
  if (gen) return gen;
  if (/leadconnector|gohighlevel|filesafe\.space|highlevel/i.test(html)) return "GoHighLevel";
  if (/wp-content|wp-includes/i.test(html)) return "WordPress";
  if (/cdn\.shopify\.com|shopify/i.test(html)) return "Shopify";
  if (/webflow/i.test(html)) return "Webflow";
  if (/_next\/static|__NEXT_DATA__/i.test(html)) return "Next.js";
  const server = headers.get("server") || "";
  if (/cloudflare/i.test(server)) return "okänd (bakom Cloudflare)";
  return "okänd";
}

interface RobotsSitemapResultat {
  robotsTxt: PageSignals["robotsTxt"];
  sitemap: PageSignals["sitemap"];
  fel: { robots: string | null; sitemap: string | null };
}

/** 404/410 = filen finns verkligen inte. Allt annat icke-200 = vi VET inte. */
const arEjHittad = (status: number | null) => status === 404 || status === 410;

async function fetchRobotsAndSitemap(url: string): Promise<RobotsSitemapResultat> {
  let robotsTxt: PageSignals["robotsTxt"] = null;
  let sitemap: PageSignals["sitemap"] = null;
  const fel: { robots: string | null; sitemap: string | null } = { robots: null, sitemap: null };
  let origin: string;
  try {
    origin = new URL(url).origin;
  } catch {
    return { robotsTxt, sitemap, fel: { robots: `Ogiltig URL: ${url}`, sitemap: `Ogiltig URL: ${url}` } };
  }

  const r = await hamtaRatt(`${origin}/robots.txt`, { timeoutMs: 8000, accepteraIckeOk: true });
  if (r.logg.status === 200 && r.text != null) {
    const t = r.text;
    const sm = first(t, /sitemap:\s*(\S+)/i) || null;
    const blocksEverything = /user-agent:\s*\*[\s\S]*?disallow:\s*\/\s*$/im.test(t);
    robotsTxt = { found: true, blocksEverything, sitemapDeclared: sm };
  } else if (arEjHittad(r.logg.status)) {
    robotsTxt = { found: false, blocksEverything: false, sitemapDeclared: null };
  } else {
    // Ej 200 och ej 404 → okänt. Får ALDRIG bli "ingen robots.txt".
    fel.robots = r.logg.fel || `robots.txt gav HTTP ${r.logg.status ?? "-"}`;
  }

  const smUrl = robotsTxt?.sitemapDeclared || `${origin}/sitemap.xml`;
  const s = await hamtaRatt(smUrl, { timeoutMs: 8000, accepteraIckeOk: true });
  if (s.logg.status === 200 && s.text != null) {
    sitemap = { found: true, urlCount: (s.text.match(/<loc>/gi) || []).length };
  } else if (arEjHittad(s.logg.status)) {
    sitemap = { found: false, urlCount: null };
  } else {
    fel.sitemap = s.logg.fel || `sitemap gav HTTP ${s.logg.status ?? "-"}`;
  }

  return { robotsTxt, sitemap, fel };
}

// PSI Lighthouse: renderad (headless Chrome) → SEO-score + CWV-fältdata (CrUX)
function cwvCat(metric: string, v: number): CwvMetric["category"] {
  if (metric === "lcp") return v <= 2500 ? "good" : v <= 4000 ? "needs-improvement" : "poor";
  if (metric === "inp") return v <= 200 ? "good" : v <= 500 ? "needs-improvement" : "poor";
  return v <= 0.1 ? "good" : v <= 0.25 ? "needs-improvement" : "poor"; // cls
}
// Lighthouse SEO-checkar (samma ID-taxonomi som Google Lighthouse, renderade i headless Chrome)
const LH_SEO_AUDITS = [
  "document-title", "meta-description", "http-status-code", "link-text",
  "crawlable-anchors", "is-crawlable", "robots-txt", "image-alt",
  "hreflang", "canonical", "structured-data",
];
type LhAudit = { id: string; title: string; score: number | null; displayValue?: string };

/** Den del av PageSpeed-svaret vi faktiskt läser. */
export interface LighthouseSvar {
  lighthouseResult?: {
    categories?: { seo?: { score?: number }; performance?: { score?: number } };
    audits?: Record<string, { title?: string; score?: number | null; displayValue?: string }>;
  };
  loadingExperience?: { metrics?: Record<string, { percentile?: number }> };
}
async function fetchLighthouse(url: string): Promise<{ seo: number | null; cwv: PageSignals["cwv"]; audits: LhAudit[] | null }> {
  try {
    const key = process.env.PAGESPEED_API_KEY || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    const u =
      `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}` +
      `&strategy=mobile&category=seo${key ? `&key=${key}` : ""}`;
    // KOSTNAD-1b: PageSpeed går genom lib/ai-usage — samma nyckel som Gemini, och en
    // kvotsmäll där ska synas i samma vy som allt annat.
    const { anropaProvider } = await import("./ai-usage");
    const svar = await anropaProvider<LighthouseSvar>({
      provider: "google",
      model: "pagespeed",
      url: u,
      init: { signal: AbortSignal.timeout(45000) },
    });
    if (!svar.ok) return { seo: null, cwv: null, audits: null };
    const d = svar.data;
    const seoScore = d?.lighthouseResult?.categories?.seo?.score;
    const seo = typeof seoScore === "number" ? Math.round(seoScore * 100) : null;
    const auditsRaw = d?.lighthouseResult?.audits || {};
    const audits: LhAudit[] = LH_SEO_AUDITS
      .filter((id) => auditsRaw[id])
      .map((id) => ({
        id,
        title: auditsRaw[id].title as string,
        score: typeof auditsRaw[id].score === "number" ? (auditsRaw[id].score as number) : null,
        displayValue: auditsRaw[id].displayValue as string | undefined,
      }));
    const fm = d?.loadingExperience?.metrics;
    let cwv: PageSignals["cwv"] = null;
    if (fm) {
      const lcpV = fm.LARGEST_CONTENTFUL_PAINT_MS?.percentile;
      const inpV = fm.INTERACTION_TO_NEXT_PAINT?.percentile;
      const clsV = fm.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile;
      cwv = {
        source: "field",
        lcp: typeof lcpV === "number" ? { value: lcpV, category: cwvCat("lcp", lcpV) } : null,
        inp: typeof inpV === "number" ? { value: inpV, category: cwvCat("inp", inpV) } : null,
        cls: typeof clsV === "number" ? { value: clsV / 100, category: cwvCat("cls", clsV / 100) } : null,
      };
    }
    return { seo, cwv, audits: audits.length ? audits : null };
  } catch {
    return { seo: null, cwv: null, audits: null };
  }
}

// Schema-typer som ger rich results 2026 (övriga är giltiga men ger ingen visuell rich snippet)
const RICH_ELIGIBLE = new Set([
  "Product", "Review", "AggregateRating", "BreadcrumbList", "Article", "NewsArticle",
  "BlogPosting", "Event", "Recipe", "VideoObject", "Organization", "LocalBusiness", "JobPosting",
]);
export function schemaRichEligibility(types: string[] | null): { eligible: string[]; valid_no_rich: string[] } | null {
  if (types == null) return null; // ej mätt — får aldrig se ut som "inga rich results"
  const eligible = types.filter((t) => RICH_ELIGIBLE.has(t));
  const valid_no_rich = types.filter((t) => !RICH_ELIGIBLE.has(t)); // t.ex. FAQPage/HowTo: giltigt men ej rich result för vanliga sajter
  return { eligible, valid_no_rich };
}

// ───────────────────────── POÄNGSÄTTNING ─────────────────────────

/** "ej-matt" är ett eget läge. Det får ALDRIG renderas som OK eller som ett kryss. */
export type CheckStatus = "ok" | "fel" | "ej-matt";
export interface SeoCheck {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
}

/** Checkar som alltid ska synas när en sida inte kunde läsas — ingen får saknas tyst. */
const ALLA_CHECKAR: [string, string][] = [
  ["indexerbar", "Indexerbar"],
  ["title", "Title finns"],
  ["meta", "Meta description"],
  ["h1", "H1 finns"],
  ["canonical", "Canonical finns"],
  ["innehall", "Tillräckligt innehåll"],
  ["bilder_alt", "Bilder har alt-text"],
  ["internlankar", "Interna länkar"],
  ["schema", "Strukturerad data"],
  ["sitemap", "Sitemap finns"],
];

// Render-medveten, deterministisk poängsättning — ankrad i Lighthouse där det finns.
// Returnerar null för poäng när sidan inte gick att mäta. En sida som aldrig lästes
// ska INTE få ett lågt men trovärdigt tal — den ska inte få något tal alls.
export function scoreSignals(s: PageSignals): {
  seo: number | null; aeo: number | null; indexerbar: boolean | null; checks: SeoCheck[];
} {
  const checks: SeoCheck[] = [];
  const add = (id: string, label: string, status: CheckStatus, detail: string) => checks.push({ id, label, status, detail });

  // Sidan lästes aldrig → ingenting får bedömas, allt blir "ej mätt" med orsak.
  if (s.ejMattOrsak) {
    for (const [id, label] of ALLA_CHECKAR) add(id, label, "ej-matt", s.ejMattOrsak);
    return { seo: null, aeo: null, indexerbar: null, checks };
  }

  // Ett enda omätt sidfält gör poängen osann → returnera null i stället för ett tal.
  let osakert = false;
  const ejMatt = (id: string, label: string, orsak: string) => { osakert = true; add(id, label, "ej-matt", orsak); };

  // ── Indexerbarhet ────────────────────────────────────────────
  const noindex = /noindex/i.test(s.robots || "");
  const robotsOkant = s.sajtHamtFel.robots;
  let indexerbar: boolean | null;
  if (noindex) { indexerbar = false; add("indexerbar", "Indexerbar", "fel", "meta robots: noindex"); }
  else if (s.robotsTxt?.blocksEverything === true) { indexerbar = false; add("indexerbar", "Indexerbar", "fel", "robots.txt blockerar allt"); }
  else if (robotsOkant) { indexerbar = null; add("indexerbar", "Indexerbar", "ej-matt", `robots.txt kunde inte läsas: ${robotsOkant}`); }
  else { indexerbar = true; add("indexerbar", "Indexerbar", "ok", "ok"); }

  // ── On-page SEO ──────────────────────────────────────────────
  let seo = 100;

  if (s.titleLength == null) ejMatt("title", "Title finns", "titeln kunde inte mätas");
  else if (!s.title) { seo -= 15; add("title", "Title finns", "fel", "saknas"); }
  else { add("title", "Title finns", "ok", `${s.titleLength} tecken`); if (s.titleLength > 65) seo -= 4; }

  if (s.metaLength == null) ejMatt("meta", "Meta description", "meta description kunde inte mätas");
  else if (!s.metaDescription) { seo -= 12; add("meta", "Meta description", "fel", "saknas"); }
  else { add("meta", "Meta description", "ok", `${s.metaLength} tecken`); if (s.metaLength > 170) seo -= 4; }

  if (s.headings == null) ejMatt("h1", "H1 finns", "rubrikerna kunde inte mätas");
  else if (s.headings.filter((h) => h.level === 1).length === 0) { seo -= 10; add("h1", "H1 finns", "fel", "saknas"); }
  else add("h1", "H1 finns", "ok", "ok");

  if (s.emptyHeadings == null) { /* täcks av h1-raden ovan */ }
  else if (s.emptyHeadings > 0) { seo -= 4; add("tomma_rubriker", "Inga tomma rubriker", "fel", `${s.emptyHeadings} tomma`); }

  if (s.canonicalSource === "okand") ejMatt("canonical", "Canonical finns", "canonical kunde inte mätas");
  else if (s.canonicalSource === "none") { seo -= 8; add("canonical", "Canonical finns", "fel", "ingen hittad"); }
  else add("canonical", "Canonical finns", "ok", s.canonicalSource === "payload" ? "renderad (client-side)" : "statisk");

  if (s.wordCount == null) ejMatt("innehall", "Tillräckligt innehåll", "textmängden kunde inte mätas");
  else if (s.wordCount < 300) { seo -= 10; add("innehall", "Tillräckligt innehåll", "fel", `${s.wordCount} ord`); }
  else add("innehall", "Tillräckligt innehåll", "ok", `${s.wordCount} ord`);

  // ⚠ Kärnan i S-2: "inga bilder utan alt-text" får ALDRIG sättas när bildantalet är null.
  // Det var precis den raden som gav grönt ljus på sajtens enda riktiga brist.
  if (s.images == null) ejMatt("bilder_alt", "Bilder har alt-text", "bilderna kunde inte räknas");
  else if (s.images.withoutAlt > 0) { seo -= Math.min(8, s.images.withoutAlt); add("bilder_alt", "Bilder har alt-text", "fel", `${s.images.withoutAlt} av ${s.images.total} saknar alt-text`); }
  else add("bilder_alt", "Bilder har alt-text", "ok", s.images.total === 0 ? "0 bilder totalt" : `${s.images.total} bilder, alla har alt-text`);

  if (s.links == null) ejMatt("internlankar", "Interna länkar", "länkarna kunde inte räknas");
  else if (s.links.internal < 3) { seo -= 4; add("internlankar", "Interna länkar", "fel", `${s.links.internal} interna länkar`); }
  else add("internlankar", "Interna länkar", "ok", `${s.links.internal} interna länkar`);

  // Sitemap är en SAJT-signal — att den inte gick att läsa gör inte sidans poäng osann.
  if (s.sajtHamtFel.sitemap) add("sitemap", "Sitemap finns", "ej-matt", `sitemap kunde inte läsas: ${s.sajtHamtFel.sitemap}`);
  else if (s.sitemap && !s.sitemap.found) { seo -= 4; add("sitemap", "Sitemap finns", "fel", "hittades ej"); }
  else if (s.sitemap) add("sitemap", "Sitemap finns", "ok", s.sitemap.urlCount != null ? `${s.sitemap.urlCount} URL:er` : "hittad");

  // Ankra mot Lighthouse SEO (renderad) FÖRE grinden
  if (s.lighthouseSeo != null) seo = Math.round(0.5 * s.lighthouseSeo + 0.5 * seo);
  // Indexerbarhet-grind SIST: en icke-indexerbar sida kan aldrig få hög teknik-poäng.
  // Är indexerbarheten OKÄND appliceras inget tak — vi låtsas inte veta.
  if (indexerbar === false) seo = Math.min(seo, 25);
  seo = Math.max(0, seo);

  // ── AEO (citerbarhet) ────────────────────────────────────────
  let aeo = 100;
  if (s.schemaTypes == null) ejMatt("schema", "Strukturerad data", "schema kunde inte läsas");
  else {
    if (s.schemaTypes.length === 0) { aeo -= 20; add("schema", "Strukturerad data", "fel", "ingen JSON-LD hittad"); }
    else add("schema", "Strukturerad data", "ok", s.schemaTypes.join(", "));
    if (!s.schemaTypes.includes("FAQPage") && (s.faqs?.length ?? 0) === 0) aeo -= 12;
  }
  if (s.wordCount != null && s.wordCount < 600) aeo -= 8;
  if (s.headings != null) {
    const qHeadings = s.headings.filter((h) => /\?$/.test(h.text) || /^(varför|hur|vad|när|vilken|vilka|kan)/i.test(h.text));
    if (qHeadings.length === 0) aeo -= 8;
  }
  if (s.listCount != null && s.listCount < 2) aeo -= 5;
  if (s.hasUpdatedDate === false) aeo -= 5;
  aeo = Math.max(0, aeo);

  return {
    seo: osakert ? null : seo,
    aeo: osakert ? null : aeo,
    indexerbar,
    checks,
  };
}

// ───────────────────────── SIDHÄMTNING ─────────────────────────

/**
 * En sida som INTE kunde läsas. Varje mätvärde är null med en orsak.
 * Alternativet — att tappa sidan tyst eller fylla den med nollor — är precis
 * det som fällde for-balance-rapporten.
 */
export function omattaSignaler(url: string, logg: HamtLogg): PageSignals {
  const orsak = logg.fel || `Sidan kunde inte läsas (status ${logg.status ?? "okänd"})`;
  return {
    url,
    hamtning: logg,
    ejMattOrsak: orsak,
    sajtHamtFel: { robots: null, sitemap: null },
    title: null,
    titleLength: null,
    metaDescription: null,
    metaLength: null,
    canonical: null,
    canonicalSource: "okand",
    lang: null,
    robots: null,
    ogTags: null,
    schemaTypes: null,
    faqs: null,
    headings: null,
    emptyHeadings: null,
    wordCount: null,
    paragraphCount: null,
    listCount: null,
    images: null,
    links: null,
    hasUpdatedDate: null,
    platform: null,
    robotsTxt: null,
    sitemap: null,
    cwv: null,
    lighthouseSeo: null,
    lighthouseAudits: null,
    renderNote: `Sidan kunde inte läsas: ${orsak}`,
    mainText: null,
  };
}

/**
 * Läser en sida. Kastar `SidaEjLast` om hämtningen misslyckades — en tom eller
 * blockerad sida får aldrig komma tillbaka som nollor.
 */
export async function extractPageSignals(url: string, opts?: { skipLighthouse?: boolean; skipRobotsSitemap?: boolean }): Promise<PageSignals> {
  const { text: raw, headers, logg } = await hamtaSida(url, { timeoutMs: 20000 });

  const decoded = decodePayload(raw);
  // Sök i både rå HTML och avkodad payload (client-side-renderat)
  const hay = raw + "\n<!--decoded-->\n" + decoded;

  const baseHost = (() => { try { return new URL(url).host; } catch { return ""; } })();
  const platform = detectPlatform(raw, headers);

  const title = first(hay, /<title[^>]*>([\s\S]*?)<\/title>/i) || null;
  const metaDescription =
    first(hay, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) ||
    first(hay, /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i) || null;

  // Canonical: först statiskt, annars i avkodad payload
  let canonical = first(raw, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i) || null;
  let canonicalSource: PageSignals["canonicalSource"] = canonical ? "static" : "none";
  if (!canonical) {
    canonical = first(decoded, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i) || null;
    if (canonical) canonicalSource = "payload";
  }

  const lang = first(raw, /<html[^>]+lang=["']([^"']+)["']/i) || null;
  const robots = first(hay, /<meta[^>]+name=["']robots["'][^>]+content=["']([^"']+)["']/i) || null;

  const ogTags: Record<string, string> = {};
  allMatches(hay, /<meta[^>]+property=["']og:([^"']+)["'][^>]+content=["']([^"']*)["']/gi).forEach((m) => {
    if (!ogTags[m[1]]) ogTags[m[1]] = m[2];
  });

  const schemaSet = new Set<string>();
  const faqs: { question: string; answer: string }[] = [];
  allMatches(hay, /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi).forEach((m) => {
    try {
      const json = JSON.parse(m[1].trim());
      collectTypes(json, schemaSet);
      collectFaqs(json, faqs);
    } catch { /* ogiltig JSON-LD */ }
  });

  // Rubrikhierarki H1-H3 (på den synliga HTML:en, inte payloaden)
  const headings: { level: number; text: string }[] = [];
  let emptyHeadings = 0;
  allMatches(raw, /<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi).forEach((m) => {
    const text = stripText(m[2]);
    if (text) headings.push({ level: parseInt(m[1]), text: text.slice(0, 160) });
    else emptyHeadings++;
  });

  const text = stripText(raw);
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const paragraphCount = allMatches(raw, /<p[\s>]/gi).length;
  const listCount = allMatches(raw, /<(ul|ol)[\s>]/gi).length;

  const imgs = allMatches(raw, /<img[^>]*>/gi).map((m) => m[0]);
  const withoutAlt = imgs.filter((i) => !/alt=["'][^"']+["']/i.test(i)).length;

  let internal = 0, external = 0;
  allMatches(raw, /<a[^>]+href=["']([^"']+)["']/gi).forEach((m) => {
    const href = m[1];
    if (!href || /^(#|mailto:|tel:|javascript:)/i.test(href)) return;
    try {
      const u = new URL(href, url);
      if (u.host === baseHost) internal++; else external++;
    } catch { /* ignore */ }
  });

  const hasUpdatedDate = /datemodified|datepublished|uppdaterad|senast ändrad|published|updated/i.test(hay);

  const tomRobots: RobotsSitemapResultat = { robotsTxt: null, sitemap: null, fel: { robots: null, sitemap: null } };
  const [rs, lh] = await Promise.all([
    opts?.skipRobotsSitemap ? Promise.resolve(tomRobots) : fetchRobotsAndSitemap(url),
    opts?.skipLighthouse ? Promise.resolve({ seo: null, cwv: null, audits: null }) : fetchLighthouse(url),
  ]);

  const renderNote =
    canonicalSource === "payload"
      ? "Canonical/schema hittades i JS-payload (client-side-renderad sajt) — bedömd från avkodad DOM."
      : `Signaler lästa från levererad HTML (HTTP ${logg.status}, ${logg.bytes} byte).`;

  return {
    url,
    hamtning: logg,
    ejMattOrsak: null,
    sajtHamtFel: rs.fel,
    title,
    titleLength: title?.length ?? 0,
    metaDescription,
    metaLength: metaDescription?.length ?? 0,
    canonical,
    canonicalSource,
    lang,
    robots,
    ogTags,
    schemaTypes: Array.from(schemaSet),
    faqs: Array.from(new Map(faqs.map((f) => [f.question, f])).values()).slice(0, 12),
    headings: headings.slice(0, 40),
    emptyHeadings,
    wordCount,
    paragraphCount,
    listCount,
    images: { total: imgs.length, withoutAlt },
    links: { internal, external },
    hasUpdatedDate,
    platform,
    robotsTxt: rs.robotsTxt,
    sitemap: rs.sitemap,
    cwv: lh.cwv,
    lighthouseSeo: lh.seo,
    lighthouseAudits: lh.audits,
    renderNote,
    mainText: text.slice(0, 12000),
  };
}

/** Läser en sida och ger tillbaka omätta signaler i stället för att kasta. Tappar aldrig sidan. */
export async function signalerEllerOmatt(
  url: string,
  opts?: { skipLighthouse?: boolean; skipRobotsSitemap?: boolean },
): Promise<PageSignals> {
  try {
    return await extractPageSignals(url, opts);
  } catch (e) {
    if (arSidaEjLast(e)) return omattaSignaler(url, e.logg);
    // Oväntat kodfel — bevaras som okänt, aldrig som nollor.
    return omattaSignaler(url, {
      url, status: null, bytes: null, slutUrl: null, ms: 0, ok: false,
      orsak: "natverk", fel: (e as Error).message || "Okänt fel vid hämtning",
    });
  }
}

// ───────────────────────── HEL-SAJT-CRAWL ─────────────────────────
export interface SitePageSummary {
  url: string;
  /** Hämtningens facit. `ok: false` → alla mätvärden nedan är null. */
  hamtning: { ok: boolean; status: number | null; bytes: number | null; slutUrl: string | null; ms: number; orsak: HamtOrsak | null };
  ejMattOrsak: string | null;
  title: string | null;
  titleLength: number | null;
  metaLength: number | null;
  canonical: string | null;
  canonicalSource: string | null;
  h1: string | null;
  h1Count: number | null;
  emptyHeadings: number | null;
  schemaTypes: string[] | null;
  wordCount: number | null;
  imagesTotal: number | null;
  imagesNoAlt: number | null;
  internalLinks: number | null;
  seo: number | null;
  aeo: number | null;
  indexerbar: boolean | null;
}
export interface SiteAudit {
  root: string;
  origin: string;
  /** Sidor som VERKLIGEN lästes. Aldrig antalet försök. */
  pageCount: number;
  /** Antal URL:er som hämtningen försöktes på. */
  pageCountForsokt: number;
  /** Varje sida som inte gick att läsa, med statuskod och orsak. Tom lista = inget föll. */
  misslyckade: { url: string; status: number | null; bytes: number | null; orsak: HamtOrsak | null; fel: string | null }[];
  /** null = sitemap kunde inte läsas. 0 = sitemap lästes och var tom. */
  sitemapUrlCount: number | null;
  sitemapFel: string | null;
  platform: string | null;
  robotsTxt: PageSignals["robotsTxt"];
  robotsTxtFel: string | null;
  homepageLighthouseSeo: number | null;
  homepageCwv: PageSignals["cwv"];
  /** null = startsidan kunde inte läsas. "" = lästes och var tom. */
  homepageText: string | null;
  domainRedirect: { primaryHost: string; redirectWorks: boolean | null; note: string };
  pages: SitePageSummary[];
  crossPage: {
    canonicalDomains: string[];
    canonicalTagInconsistent: boolean; // taggarna pekar på olika domänvarianter (hygien om redirect finns)
    canonicalInconsistent: boolean;
    duplicateTitles: { title: string; urls: string[] }[];
    thinPages: string[];
    pagesMissingH1: string[];
    pagesWithEmptyH1: string[];
    /** null = ingen sida kunde mätas. */
    totalImagesNoAlt: number | null;
    avgInternalLinks: number | null;
    /** URL:er vars mätvärden saknas helt. Aggregaten ovan bygger INTE på dem. */
    ejMattaSidor: string[];
  };
}

/** null = sitemapen kunde inte läsas. [] = den lästes och innehöll inga URL:er. */
async function fetchSitemapUrls(origin: string): Promise<{ urls: string[] | null; fel: string | null }> {
  const r = await hamtaRatt(`${origin}/sitemap.xml`, { timeoutMs: 10000, accepteraIckeOk: true });
  if (r.logg.status === 200 && r.text != null) {
    const urls = new Set<string>();
    for (const m of r.text.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)) urls.add(m[1].trim());
    return { urls: Array.from(urls), fel: null };
  }
  if (arEjHittad(r.logg.status)) return { urls: [], fel: null }; // finns verkligen inte
  return { urls: null, fel: r.logg.fel || `sitemap.xml gav HTTP ${r.logg.status ?? "-"}` };
}

// Detektera vilken domänvariant som är primär: redirectar www → icke-www (eller tvärtom)?
// Förhindrar falsklarm "duplicerad sajt" när en 301 redan finns.
// ⚠ Samma user-agent som sidhämtaren (S-1). Tidigare satte proben ingen alls, vilket
// gjorde att två delar av samma rapport kunde tala om två olika sajter.
async function detectDomainRedirect(rootUrl: string): Promise<{ primaryHost: string; redirectWorks: boolean | null; note: string }> {
  const u = new URL(rootUrl);
  const bare = u.host.replace(/^www\./, "");
  const wwwHost = "www." + bare;
  const probe = async (host: string) => {
    const r = await hamtaRatt(`${u.protocol}//${host}/`, { redirect: "manual", timeoutMs: 8000, accepteraIckeOk: true });
    let locHost = "";
    const loc = r.headers?.get("location");
    if (loc) { try { locHost = new URL(loc, `${u.protocol}//${host}`).host; } catch { /* ignore */ } }
    return { status: r.logg.status, locHost };
  };
  const [w, nw] = await Promise.all([probe(wwwHost), probe(bare)]);
  if (w.status != null && w.status >= 300 && w.status < 400 && w.locHost === bare)
    return { primaryHost: bare, redirectWorks: true, note: "www → icke-www (301) finns redan — ingen riktig dubblett" };
  if (nw.status != null && nw.status >= 300 && nw.status < 400 && nw.locHost === wwwHost)
    return { primaryHost: wwwHost, redirectWorks: true, note: "icke-www → www (301) finns redan — ingen riktig dubblett" };
  // Nådde ingen av proberna fram vet vi INGENTING om redirecten.
  if (w.status == null && nw.status == null)
    return { primaryHost: bare, redirectWorks: null, note: "Domän-redirecten kunde inte mätas — ingen av proberna nådde fram" };
  return { primaryHost: bare, redirectWorks: false, note: "INGEN domän-redirect detekterad — www och icke-www kan serva separat (riktig dubblett-risk)" };
}

// Granska HELA sajten: sid-lista från sitemap → render-medveten extraktion per sida
// (Lighthouse körs bara på startsidan för fart) → tvärsides-aggregat.
export async function crawlSite(rootUrl: string, opts?: { maxPages?: number; skipLighthouse?: boolean }): Promise<SiteAudit> {
  const maxPages = opts?.maxPages ?? 20;
  const skipLighthouse = opts?.skipLighthouse ?? false;
  const proto = new URL(rootUrl).protocol;
  const domainRedirect = await detectDomainRedirect(rootUrl);
  const primaryRoot = `${proto}//${domainRedirect.primaryHost}/`;
  const origin = `${proto}//${domainRedirect.primaryHost}`;

  // Normalisera alla URL:er till primär värd + utan trailing-slash → dedupe www/icke-www
  const norm = (raw: string): string | null => {
    try {
      const x = new URL(raw, origin);
      x.protocol = proto; x.host = domainRedirect.primaryHost; x.hash = ""; x.search = "";
      let p = x.pathname.replace(/\/+$/, ""); if (p === "") p = "/";
      x.pathname = p;
      return x.toString();
    } catch { return null; }
  };
  const rootNorm = norm(primaryRoot)!;

  // Sajtnivå (en gång): robots/sitemap + Lighthouse på startsidan (primär variant)
  const [rs, sitemapRes, home] = await Promise.all([
    fetchRobotsAndSitemap(primaryRoot),
    fetchSitemapUrls(origin),
    signalerEllerOmatt(primaryRoot, { skipRobotsSitemap: true, skipLighthouse }),
  ]);

  // Sid-lista: normaliserad + dedupad (ingen www/icke-www-dubblett), startsidan först
  const seen = new Set<string>();
  const list: string[] = [];
  for (const raw of [primaryRoot, ...(sitemapRes.urls ?? [])]) {
    const n = norm(raw); if (!n || seen.has(n)) continue; seen.add(n); list.push(n);
  }
  const urls = list.slice(0, maxPages);

  const pages: SitePageSummary[] = [];
  const toSummary = (s: PageSignals): SitePageSummary => {
    const sc = scoreSignals(s);
    const h1s = s.headings?.filter((h) => h.level === 1) ?? null;
    return {
      url: s.url,
      hamtning: { ok: s.hamtning.ok, status: s.hamtning.status, bytes: s.hamtning.bytes, slutUrl: s.hamtning.slutUrl, ms: s.hamtning.ms, orsak: s.hamtning.orsak },
      ejMattOrsak: s.ejMattOrsak,
      title: s.title, titleLength: s.titleLength, metaLength: s.metaLength,
      canonical: s.canonical, canonicalSource: s.ejMattOrsak ? null : s.canonicalSource,
      h1: h1s ? (h1s[0]?.text ?? null) : null, h1Count: h1s ? h1s.length : null, emptyHeadings: s.emptyHeadings,
      schemaTypes: s.schemaTypes, wordCount: s.wordCount,
      imagesTotal: s.images ? s.images.total : null, imagesNoAlt: s.images ? s.images.withoutAlt : null,
      internalLinks: s.links ? s.links.internal : null,
      seo: sc.seo, aeo: sc.aeo, indexerbar: sc.indexerbar,
    };
  };

  // Startsidan är redan hämtad — mätt eller omätt, den räknas alltid med.
  pages.push(toSummary({ ...home, sajtHamtFel: home.ejMattOrsak ? home.sajtHamtFel : rs.fel, robotsTxt: home.ejMattOrsak ? null : rs.robotsTxt }));

  const rest = urls.filter((u) => u !== rootNorm);
  const CONCURRENCY = 4;
  for (let i = 0; i < rest.length; i += CONCURRENCY) {
    const batch = rest.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map((u) => signalerEllerOmatt(u, { skipLighthouse: true, skipRobotsSitemap: true })),
    );
    for (const r of results) pages.push(toSummary(r));
  }

  // Tvärsides-aggregat — BARA på sidor som faktiskt mättes.
  const matta = pages.filter((p) => p.ejMattOrsak == null);
  const canonicalDomains = Array.from(new Set(
    matta.map((p) => { try { return p.canonical ? new URL(p.canonical).host : null; } catch { return null; } }).filter(Boolean) as string[]
  ));
  const titleMap = new Map<string, string[]>();
  for (const p of matta) { if (p.title) { const k = p.title.trim().toLowerCase(); titleMap.set(k, [...(titleMap.get(k) || []), p.url]); } }
  const duplicateTitles = Array.from(titleMap.entries()).filter(([, u]) => u.length > 1).map(([title, urls]) => ({ title, urls }));

  const medBilder = matta.filter((p) => p.imagesNoAlt != null);
  const medLankar = matta.filter((p) => p.internalLinks != null);

  return {
    root: rootUrl,
    origin,
    pageCount: matta.length,
    pageCountForsokt: pages.length,
    misslyckade: pages
      .filter((p) => p.ejMattOrsak != null)
      .map((p) => ({ url: p.url, status: p.hamtning.status, bytes: p.hamtning.bytes, orsak: p.hamtning.orsak, fel: p.ejMattOrsak })),
    sitemapUrlCount: sitemapRes.urls == null ? null : sitemapRes.urls.length,
    sitemapFel: sitemapRes.fel,
    platform: home.platform,
    robotsTxt: rs.robotsTxt,
    robotsTxtFel: rs.fel.robots,
    homepageLighthouseSeo: home.lighthouseSeo,
    homepageCwv: home.cwv,
    homepageText: home.mainText == null ? null : home.mainText.slice(0, 8000),
    domainRedirect,
    pages,
    crossPage: {
      canonicalDomains,
      canonicalTagInconsistent: canonicalDomains.length > 1,
      // ÄKTA duplicerings-problem = taggarna pekar olika OCH ingen domän-redirect finns
      canonicalInconsistent: canonicalDomains.length > 1 && domainRedirect.redirectWorks === false,
      duplicateTitles,
      thinPages: matta.filter((p) => p.wordCount != null && p.wordCount < 300).map((p) => p.url),
      pagesMissingH1: matta.filter((p) => p.h1Count === 0).map((p) => p.url),
      pagesWithEmptyH1: matta.filter((p) => (p.emptyHeadings ?? 0) > 0).map((p) => p.url),
      totalImagesNoAlt: medBilder.length ? medBilder.reduce((a, p) => a + (p.imagesNoAlt ?? 0), 0) : null,
      avgInternalLinks: medLankar.length ? Math.round(medLankar.reduce((a, p) => a + (p.internalLinks ?? 0), 0) / medLankar.length) : null,
      ejMattaSidor: pages.filter((p) => p.ejMattOrsak != null).map((p) => p.url),
    },
  };
}
