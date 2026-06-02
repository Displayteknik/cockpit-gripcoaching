// Djup-extraktor: plockar ut den FAKTISKA strukturen och innehållet ur en sida,
// så AI-rapporten kan analysera på riktigt (E-E-A-T, citerbarhet, rubrikhierarki)
// istället för att bara tolka mätvärden. Alla siffror här är deterministiska = korrekta.

export interface PageSignals {
  url: string;
  title: string | null;
  titleLength: number;
  metaDescription: string | null;
  metaLength: number;
  canonical: string | null;
  lang: string | null;
  robots: string | null;
  ogTags: Record<string, string>;
  schemaTypes: string[];
  faqs: { question: string; answer: string }[];
  headings: { level: number; text: string }[];
  wordCount: number;
  paragraphCount: number;
  listCount: number;
  images: { total: number; withoutAlt: number };
  links: { internal: number; external: number };
  hasUpdatedDate: boolean;
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

const first = (html: string, re: RegExp) => (html.match(re)?.[1] || "").trim();
const allMatches = (html: string, re: RegExp) => Array.from(html.matchAll(re));

// Plocka @type rekursivt ur valfri JSON-LD-struktur
function collectTypes(node: unknown, out: Set<string>) {
  if (!node) return;
  if (Array.isArray(node)) {
    node.forEach((n) => collectTypes(n, out));
    return;
  }
  if (typeof node === "object") {
    const obj = node as Record<string, unknown>;
    const t = obj["@type"];
    if (typeof t === "string") out.add(t);
    if (Array.isArray(t)) t.forEach((x) => typeof x === "string" && out.add(x));
    Object.values(obj).forEach((v) => collectTypes(v, out));
  }
}

// Plocka FAQ-frågor/svar ur FAQPage-schema
function collectFaqs(node: unknown, out: { question: string; answer: string }[]) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    node.forEach((n) => collectFaqs(n, out));
    return;
  }
  const obj = node as Record<string, unknown>;
  if (obj["@type"] === "Question" && typeof obj.name === "string") {
    const ans = obj.acceptedAnswer as Record<string, unknown> | undefined;
    const text = ans && typeof ans.text === "string" ? ans.text : "";
    out.push({ question: obj.name, answer: stripText(text).slice(0, 400) });
  }
  Object.values(obj).forEach((v) => collectFaqs(v, out));
}

export async function extractPageSignals(url: string): Promise<PageSignals> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Cockpit-SEO-DeepAudit/1.0" },
    signal: AbortSignal.timeout(20000),
  });
  const html = await res.text();

  const baseHost = (() => {
    try {
      return new URL(url).host;
    } catch {
      return "";
    }
  })();

  const title = first(html, /<title[^>]*>([\s\S]*?)<\/title>/i) || null;
  const metaDescription =
    first(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) || null;
  const canonical = first(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i) || null;
  const lang = first(html, /<html[^>]+lang=["']([^"']+)["']/i) || null;
  const robots = first(html, /<meta[^>]+name=["']robots["'][^>]+content=["']([^"']+)["']/i) || null;

  // Open Graph
  const ogTags: Record<string, string> = {};
  allMatches(html, /<meta[^>]+property=["']og:([^"']+)["'][^>]+content=["']([^"']*)["']/gi).forEach(
    (m) => {
      ogTags[m[1]] = m[2];
    }
  );

  // JSON-LD: typer + FAQ
  const schemaSet = new Set<string>();
  const faqs: { question: string; answer: string }[] = [];
  allMatches(html, /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi).forEach(
    (m) => {
      try {
        const json = JSON.parse(m[1].trim());
        collectTypes(json, schemaSet);
        collectFaqs(json, faqs);
      } catch {
        /* ogiltig JSON-LD, hoppa */
      }
    }
  );

  // Rubrikhierarki H1-H3
  const headings: { level: number; text: string }[] = [];
  allMatches(html, /<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi).forEach((m) => {
    const text = stripText(m[2]);
    if (text) headings.push({ level: parseInt(m[1]), text: text.slice(0, 160) });
  });

  const text = stripText(html);
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const paragraphCount = allMatches(html, /<p[\s>]/gi).length;
  const listCount = allMatches(html, /<(ul|ol)[\s>]/gi).length;

  const imgs = allMatches(html, /<img[^>]*>/gi).map((m) => m[0]);
  const withoutAlt = imgs.filter((i) => !/alt=["'][^"']+["']/i.test(i)).length;

  let internal = 0,
    external = 0;
  allMatches(html, /<a[^>]+href=["']([^"']+)["']/gi).forEach((m) => {
    const href = m[1];
    if (!href || /^(#|mailto:|tel:|javascript:)/i.test(href)) return;
    try {
      const u = new URL(href, url);
      if (u.host === baseHost) internal++;
      else external++;
    } catch {
      /* ignore */
    }
  });

  const hasUpdatedDate =
    /datemodified|datepublished|uppdaterad|senast ändrad|published|updated/i.test(html);

  return {
    url,
    title,
    titleLength: title?.length ?? 0,
    metaDescription,
    metaLength: metaDescription?.length ?? 0,
    canonical,
    lang,
    robots,
    ogTags,
    schemaTypes: Array.from(schemaSet),
    faqs: faqs.slice(0, 12),
    headings: headings.slice(0, 40),
    wordCount,
    paragraphCount,
    listCount,
    images: { total: imgs.length, withoutAlt },
    links: { internal, external },
    hasUpdatedDate,
    mainText: text.slice(0, 12000),
  };
}
