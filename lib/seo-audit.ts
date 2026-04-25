// SEO + AEO audit-engine. Hämtar HTML, analyserar, returnerar score + issues.

export interface AuditResult {
  url: string;
  title: string | null;
  meta_description: string | null;
  h1: string | null;
  word_count: number;
  has_schema: boolean;
  has_faq: boolean;
  has_og: boolean;
  internal_links: number;
  external_links: number;
  images_total: number;
  images_no_alt: number;
  pagespeed_mobile?: number;
  pagespeed_desktop?: number;
  seo_score: number;
  aeo_score: number;
  issues: { level: "error" | "warn" | "info"; field: string; message: string }[];
}

const stripTags = (html: string) => html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ");
const m = (html: string, re: RegExp) => (html.match(re)?.[1] || "").trim();
const all = (html: string, re: RegExp) => Array.from(html.matchAll(re));

export async function auditUrl(url: string, baseUrl: string): Promise<AuditResult> {
  const issues: AuditResult["issues"] = [];
  let html = "";
  try {
    const res = await fetch(url, { headers: { "User-Agent": "HM-Motor-SEO-Auditor/1.0" } });
    if (!res.ok) {
      issues.push({ level: "error", field: "fetch", message: `HTTP ${res.status}` });
    }
    html = await res.text();
  } catch (e) {
    issues.push({ level: "error", field: "fetch", message: (e as Error).message });
    return emptyResult(url, issues);
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

function emptyResult(url: string, issues: AuditResult["issues"]): AuditResult {
  return {
    url, title: null, meta_description: null, h1: null,
    word_count: 0, has_schema: false, has_faq: false, has_og: false,
    internal_links: 0, external_links: 0, images_total: 0, images_no_alt: 0,
    seo_score: 0, aeo_score: 0, issues,
  };
}

// PageSpeed Insights — gratis, ingen nyckel krävs för låg volym
export async function pageSpeed(url: string): Promise<{ mobile: number | null; desktop: number | null }> {
  async function get(strategy: "mobile" | "desktop") {
    try {
      const u = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=${strategy}&category=performance`;
      const r = await fetch(u, { signal: AbortSignal.timeout(45000) });
      if (!r.ok) return null;
      const d = await r.json();
      const score = d?.lighthouseResult?.categories?.performance?.score;
      return typeof score === "number" ? Math.round(score * 100) : null;
    } catch { return null; }
  }
  const [mobile, desktop] = await Promise.all([get("mobile"), get("desktop")]);
  return { mobile, desktop };
}
