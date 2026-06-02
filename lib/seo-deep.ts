// Djup-extraktor: plockar ut den FAKTISKA strukturen och innehållet ur en sida,
// så AI-rapporten kan analysera på riktigt (E-E-A-T, citerbarhet, rubrikhierarki)
// istället för att bara tolka mätvärden. Alla siffror här är deterministiska = korrekta.
//
// RENDER-MEDVETEN: client-side-renderade sajter (GoHighLevel, Next/SPA) lägger
// canonical + schema HTML-kodat i hydrerings-payloaden (<link ...). Vi söker
// därför både i rå HTML och i en avkodad kopia, så vi inte ger falska "saknas".
// Källa kodifierad i lesson_ghl_client_side_verify.

export interface CwvMetric {
  value: number;
  category: "good" | "needs-improvement" | "poor";
}
export interface PageSignals {
  url: string;
  title: string | null;
  titleLength: number;
  metaDescription: string | null;
  metaLength: number;
  canonical: string | null;
  canonicalSource: "static" | "payload" | "none";
  lang: string | null;
  robots: string | null;
  ogTags: Record<string, string>;
  schemaTypes: string[];
  faqs: { question: string; answer: string }[];
  headings: { level: number; text: string }[];
  emptyHeadings: number;
  wordCount: number;
  paragraphCount: number;
  listCount: number;
  images: { total: number; withoutAlt: number };
  links: { internal: number; external: number };
  hasUpdatedDate: boolean;
  // Nytt: plattform + teknisk hygien hämtad live
  platform: string;
  robotsTxt: { found: boolean; blocksEverything: boolean; sitemapDeclared: string | null } | null;
  sitemap: { found: boolean; urlCount: number } | null;
  cwv: { lcp: CwvMetric | null; inp: CwvMetric | null; cls: CwvMetric | null; source: "field" | "none" } | null;
  lighthouseSeo: number | null; // 0-100, renderad (Lighthouse via PSI)
  lighthouseAudits: { id: string; title: string; score: number | null; displayValue?: string }[] | null;
  renderNote: string;
  mainText: string; // rensad, trunkerad till ~12000 tecken
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

// Avkoda JS-strängars escaping så client-side-renderade taggar blir sökbara
const decodePayload = (html: string) =>
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

async function fetchRobotsAndSitemap(url: string) {
  let robotsTxt: PageSignals["robotsTxt"] = null;
  let sitemap: PageSignals["sitemap"] = null;
  try {
    const origin = new URL(url).origin;
    try {
      const r = await fetch(`${origin}/robots.txt`, { signal: AbortSignal.timeout(8000) });
      if (r.ok) {
        const t = await r.text();
        const sm = first(t, /sitemap:\s*(\S+)/i) || null;
        const blocksEverything = /user-agent:\s*\*[\s\S]*?disallow:\s*\/\s*$/im.test(t);
        robotsTxt = { found: true, blocksEverything, sitemapDeclared: sm };
      } else {
        robotsTxt = { found: false, blocksEverything: false, sitemapDeclared: null };
      }
    } catch { /* ignore */ }
    try {
      const smUrl = robotsTxt?.sitemapDeclared || `${origin}/sitemap.xml`;
      const s = await fetch(smUrl, { signal: AbortSignal.timeout(8000) });
      if (s.ok) {
        const x = await s.text();
        const urlCount = (x.match(/<loc>/gi) || []).length;
        sitemap = { found: true, urlCount };
      } else {
        sitemap = { found: false, urlCount: 0 };
      }
    } catch { /* ignore */ }
  } catch { /* ignore */ }
  return { robotsTxt, sitemap };
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
async function fetchLighthouse(url: string): Promise<{ seo: number | null; cwv: PageSignals["cwv"]; audits: LhAudit[] | null }> {
  try {
    const key = process.env.PAGESPEED_API_KEY || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    const u =
      `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}` +
      `&strategy=mobile&category=seo${key ? `&key=${key}` : ""}`;
    const r = await fetch(u, { signal: AbortSignal.timeout(45000) });
    if (!r.ok) return { seo: null, cwv: null, audits: null };
    const d = await r.json();
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
export function schemaRichEligibility(types: string[]): { eligible: string[]; valid_no_rich: string[] } {
  const eligible = types.filter((t) => RICH_ELIGIBLE.has(t));
  const valid_no_rich = types.filter((t) => !RICH_ELIGIBLE.has(t)); // t.ex. FAQPage/HowTo: giltigt men ej rich result för vanliga sajter
  return { eligible, valid_no_rich };
}

// Render-medveten, deterministisk poängsättning (0-100) — ankrad i Lighthouse där det finns.
export function scoreSignals(s: PageSignals): {
  seo: number; aeo: number; indexerbar: boolean; checks: { id: string; label: string; pass: boolean; detail: string }[];
} {
  const checks: { id: string; label: string; pass: boolean; detail: string }[] = [];
  const add = (id: string, label: string, pass: boolean, detail: string) => checks.push({ id, label, pass, detail });

  // Indexerbarhet-grind
  const noindex = /noindex/i.test(s.robots || "");
  const blocked = s.robotsTxt?.blocksEverything === true;
  const indexerbar = !noindex && !blocked;
  add("indexerbar", "Indexerbar", indexerbar, noindex ? "meta robots: noindex" : blocked ? "robots.txt blockerar allt" : "ok");

  // On-page SEO (vår del)
  let seo = 100;
  if (!s.title) { seo -= 15; add("title", "Title finns", false, "saknas"); }
  else { add("title", "Title finns", true, `${s.titleLength} tecken`); if (s.titleLength > 65) seo -= 4; }
  if (!s.metaDescription) { seo -= 12; add("meta", "Meta description", false, "saknas"); }
  else { add("meta", "Meta description", true, `${s.metaLength} tecken`); if (s.metaLength > 170) seo -= 4; }
  if (s.headings.filter((h) => h.level === 1).length === 0) { seo -= 10; add("h1", "H1 finns", false, "saknas"); }
  else add("h1", "H1 finns", true, "ok");
  if (s.emptyHeadings > 0) { seo -= 4; add("tomma_rubriker", "Inga tomma rubriker", false, `${s.emptyHeadings} tomma`); }
  if (s.canonicalSource === "none") { seo -= 8; add("canonical", "Canonical finns", false, "ingen hittad"); }
  else add("canonical", "Canonical finns", true, s.canonicalSource === "payload" ? "renderad (client-side)" : "statisk");
  if (s.wordCount < 300) { seo -= 10; add("innehall", "Tillräckligt innehåll", false, `${s.wordCount} ord`); }
  if (s.images.withoutAlt > 0) seo -= Math.min(8, s.images.withoutAlt);
  if (s.links.internal < 3) seo -= 4;
  if (s.sitemap && !s.sitemap.found) { seo -= 4; add("sitemap", "Sitemap finns", false, "hittades ej"); }
  seo = Math.max(0, indexerbar ? seo : Math.min(seo, 25));
  // Ankra mot Lighthouse SEO (renderad) om tillgänglig
  if (s.lighthouseSeo != null) seo = Math.round(0.5 * s.lighthouseSeo + 0.5 * seo);

  // AEO (citerbarhet)
  let aeo = 100;
  if (s.schemaTypes.length === 0) aeo -= 20;
  if (!s.schemaTypes.includes("FAQPage") && s.faqs.length === 0) aeo -= 12;
  if (s.wordCount < 600) aeo -= 8;
  const qHeadings = s.headings.filter((h) => /\?$/.test(h.text) || /^(varför|hur|vad|när|vilken|vilka|kan)/i.test(h.text));
  if (qHeadings.length === 0) aeo -= 8;
  if (s.listCount < 2) aeo -= 5;
  if (!s.hasUpdatedDate) aeo -= 5;
  aeo = Math.max(0, aeo);

  return { seo, aeo, indexerbar, checks };
}

export async function extractPageSignals(url: string, opts?: { skipLighthouse?: boolean }): Promise<PageSignals> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Cockpit-SEO-DeepAudit/2.0" },
    signal: AbortSignal.timeout(20000),
  });
  const raw = await res.text();
  const decoded = decodePayload(raw);
  // Sök i både rå HTML och avkodad payload (client-side-renderat)
  const hay = raw + "\n<!--decoded-->\n" + decoded;

  const baseHost = (() => { try { return new URL(url).host; } catch { return ""; } })();
  const platform = detectPlatform(raw, res.headers);

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

  const [{ robotsTxt, sitemap }, lh] = await Promise.all([
    fetchRobotsAndSitemap(url),
    opts?.skipLighthouse ? Promise.resolve({ seo: null, cwv: null, audits: null }) : fetchLighthouse(url),
  ]);

  const renderNote =
    canonicalSource === "payload"
      ? "Canonical/schema hittades i JS-payload (client-side-renderad sajt) — bedömd från avkodad DOM."
      : "Signaler lästa från levererad HTML.";

  return {
    url,
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
    faqs: faqs.slice(0, 12),
    headings: headings.slice(0, 40),
    emptyHeadings,
    wordCount,
    paragraphCount,
    listCount,
    images: { total: imgs.length, withoutAlt },
    links: { internal, external },
    hasUpdatedDate,
    platform,
    robotsTxt,
    sitemap,
    cwv: lh.cwv,
    lighthouseSeo: lh.seo,
    lighthouseAudits: lh.audits,
    renderNote,
    mainText: text.slice(0, 12000),
  };
}
