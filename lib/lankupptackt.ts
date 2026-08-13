// EN länkupptäckt för hela plattformen — Håkans beslut 2026-08-13 (RAPPORT-1, beslut 1).
//
// ★ VARFÖR DEN HÄR FILEN FINNS.
//
//   Onboardingmotorn (`lib/onboard/upptack.ts`) kunde redan följa sitemap-index, läsa
//   barn-sitemaps och plocka länkar ur startsidans HTML. Djupgranskningens `crawlSite`
//   läste bara `/sitemap.xml` rakt av. Filen upptack.ts bar till och med en varning om
//   just det på rad 8 — kunskapen fanns i kodbasen, den hade bara aldrig flyttats.
//
//   MÄTT 13/8 på forbalance.se: sajtens `/sitemap.xml` ÄR ett index som pekar på
//   `sitemap_pages.xml` (10 sidor) och `sitemap_blog.xml` (7 poster). Djupgranskningen
//   tog de två `<loc>`-värdena som SIDOR och crawlade alltså tre "sidor": startsidan och
//   två XML-filer. Rapporten påstod därför att sajten har 3 sidor. Den har 17, och
//   rapportens dyraste rekommendation ("skapa fem undersidor") vilade på det felet.
//
//   Två parallella implementationer glider isär. Det var precis så buggen uppstod. Därför
//   ligger logiken här och konsumeras av båda, med skip-mönster som KONFIGURATION:
//   onboardingen sorterar bort bloggen (den bär sällan företagsfakta), djupgranskningen
//   tar med den (den ska granska allt kunden publicerat).

import { hamtaRatt } from "@/lib/seo-hamta";

/**
 * Avkoda JS-strängars escaping så client-side-renderade taggar blir sökbara.
 *
 * Bor här och inte i seo-deep för att undvika en cirkulär import: seo-deep konsumerar
 * den här modulen. `lib/seo-deep` re-exporterar den, så inget anropsställe behövde ändras.
 */
export const decodePayload = (html: string) =>
  html
    .replace(/\\u003C/gi, "<")
    .replace(/\\u003E/gi, ">")
    .replace(/\\u0026/gi, "&")
    .replace(/\\u002F/gi, "/")
    // ⚠ MÄTT 13/8: forbalance.se länkar till /klienten-berättar, och i JS-payloaden står
    // det `/klienten-berättar`. Utan generell avkodning blev länken
    // `/klienten-ber/u00e4ttar`, som svarade 404. Vi hade alltså RAPPORTERAT EN DÖD LÄNK
    // SOM INTE FINNS, på kundens sajt, med vår egen bugg som källa. Svenska tecken i
    // adresser är regel snarare än undantag hos den här kundstocken.
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, kod: string) => String.fromCharCode(parseInt(kod, 16)))
    .replace(/\\"/g, '"')
    .replace(/\\\//g, "/");

/**
 * Filändelser som aldrig är sidor.
 *
 * ⚠ `.xml` står först med flit: det var XML-filer maskerade som sidor som gav
 * forbalance-rapporten sina två spöksidor. `hamtaSida` kontrollerar bara status och
 * storlek, inte content-type, så en 1 797 byte stor sitemap godkändes som en sida utan
 * title och utan H1 — och göder i sin tur "tunna sidor"-fynden.
 */
export const MASKINFIL_ANDELSE =
  /\.(xml|pdf|jpe?g|png|gif|svg|webp|avif|ico|css|js|json|txt|zip|rar|mp4|mp3|wav|woff2?|ttf|eot|rss|atom)$/i;

/** Content-types som inte är en sida, även när ändelsen ser oskyldig ut. */
const MASKIN_CONTENT_TYPE = /^(application\/(xml|json|pdf|zip|rss)|text\/(xml|plain|css|javascript)|image\/|video\/|audio\/)/i;

/**
 * Sökvägar som är infrastruktur, inte innehåll. Gäller ALLA konsumenter.
 *
 * ⚠ MÄTT 13/8 på displayteknik.se: Cloudflares `/cdn-cgi/l/email-protection` låg som
 * href i sidfoten, svarade 404, och drog ned täckningen till "partiell". Vi hade alltså
 * levererat en blockeringsrapport på grund av en länk kunden varken skapat eller kan ta
 * bort.
 */
const MASKIN_SOKVAG = /(^|\/)(cdn-cgi|wp-json|wp-admin|xmlrpc|\.well-known|feed|rss|atom)(\/|$|\.)/i;

export function arMaskinfil(url: string): boolean {
  try {
    const p = new URL(url).pathname;
    return MASKINFIL_ANDELSE.test(p) || MASKIN_SOKVAG.test(p);
  } catch {
    return MASKINFIL_ANDELSE.test(url) || MASKIN_SOKVAG.test(url);
  }
}

export function arMaskinContentType(ct: string | null | undefined): boolean {
  return !!ct && MASKIN_CONTENT_TYPE.test(ct.split(";")[0].trim());
}

/**
 * Normaliserar en URL till jämförbar form: samma värd, utan hash, utan query, utan
 * avslutande snedstreck. Utan detta blir /kontakt, /kontakt/ och /kontakt?utm=x tre sidor.
 */
export function normalisera(raw: string, origin: string): string | null {
  try {
    const u = new URL(raw, origin);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    u.hash = "";
    u.search = "";
    let p = u.pathname.replace(/\/+$/, "");
    if (p === "") p = "/";
    u.pathname = p;
    return u.toString();
  } catch {
    return null;
  }
}

export interface SitemapResultat {
  /** null = sitemapen kunde inte läsas. [] = den lästes och var tom. */
  urls: string[] | null;
  /** Var /sitemap.xml ett index som pekade på fler sitemaps? */
  arIndex: boolean;
  /** Barn-sitemaps som följdes. Tom när det inte var ett index. */
  barn: string[];
  fel: string | null;
}

/** Hur många barn-sitemaps som följs. Höjt från 3: forbalance har 2, större sajter fler. */
const MAX_BARN_SITEMAPS = 10;

/**
 * Läser `/sitemap.xml` och följer sitemap-index till barn-sitemaps.
 *
 * ⚠ I ett `<sitemapindex>` är `<loc>` andra SITEMAPFILER, inte sidor. Att blanda ihop
 * dem är hela forbalance-buggen. Barnens URL:er ersätter därför indexets, de läggs
 * aldrig till bredvid.
 */
export async function sitemapUrler(origin: string): Promise<SitemapResultat> {
  const r = await hamtaRatt(`${origin}/sitemap.xml`, { timeoutMs: 10000, accepteraIckeOk: true });
  if (r.logg.status === 404 || r.logg.status === 410) {
    return { urls: [], arIndex: false, barn: [], fel: null }; // finns verkligen inte
  }
  if (r.logg.status !== 200 || r.text == null) {
    return { urls: null, arIndex: false, barn: [], fel: r.logg.fel || `sitemap.xml gav HTTP ${r.logg.status ?? "-"}` };
  }

  const locs = new Set<string>();
  for (const m of r.text.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)) locs.add(m[1].trim());

  if (!/<sitemapindex/i.test(r.text)) {
    return { urls: Array.from(locs), arIndex: false, barn: [], fel: null };
  }

  const barn = Array.from(locs).slice(0, MAX_BARN_SITEMAPS);
  const ut = new Set<string>();
  const felade: string[] = [];
  for (const b of barn) {
    const rb = await hamtaRatt(b, { timeoutMs: 10000, accepteraIckeOk: true });
    if (rb.logg.status === 200 && rb.text) {
      for (const m of rb.text.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)) ut.add(m[1].trim());
    } else {
      felade.push(`${b} (${rb.logg.status ?? "inget svar"})`);
    }
  }
  return {
    urls: Array.from(ut),
    arIndex: true,
    barn,
    // En sitemap som inte gick att läsa är ett hål i täckningen och ska synas, inte tigas ihjäl.
    fel: felade.length ? `Barn-sitemap kunde inte läsas: ${felade.join("; ")}` : null,
  };
}

/** Plockar interna länkar ur HTML. Fungerar även på JS-renderad payload. */
export function lankarIHtml(html: string, origin: string): string[] {
  const kalla = decodePayload(html);
  const ut = new Set<string>();
  for (const m of kalla.matchAll(/href\s*=\s*["']([^"'#]+)["']/gi)) {
    const n = normalisera(m[1], origin);
    if (!n) continue;
    try {
      if (new URL(n).origin !== origin) continue; // bara samma sajt
    } catch {
      continue;
    }
    ut.add(n);
  }
  return Array.from(ut);
}

/** Kända sociala profiler som sajten själv länkar till. Källa för schemats `sameAs`. */
export function socialaProfilerIHtml(html: string): string[] {
  const kalla = decodePayload(html);
  const ut = new Set<string>();
  const monster =
    /https?:\/\/(?:www\.)?(facebook\.com|instagram\.com|linkedin\.com|youtube\.com|tiktok\.com|x\.com|twitter\.com|pinterest\.[a-z.]+)\/[^\s"'<>)]+/gi;
  for (const m of kalla.matchAll(monster)) {
    const rensad = m[0].replace(/[).,]+$/, "");
    // Delnings- och widgetlänkar är inte profiler.
    if (/\/(sharer|share|intent|plugins|embed|tr\?|dialog)/i.test(rensad)) continue;
    ut.add(rensad);
  }
  return Array.from(ut);
}

export interface UpptacktsIndata {
  rotUrl: string;
  /** Startsidans HTML om den redan hämtats — ger länkupptäckt utan extra anrop. */
  startHtml: string | null;
  /** Sökvägsmönster som konsumenten inte vill ha med. Onboardingen skickar sitt blogg-filter. */
  hoppaMonster?: RegExp[];
  /** Ta med maskinfiler (.xml, .pdf …)? Aldrig i praktiken — flaggan finns för att göra valet synligt. */
  taMedMaskinfiler?: boolean;
}

export interface UpptacktUtfall {
  /** Alla kandidat-URL:er, normaliserade och dedupade. Startsidan först. */
  urls: string[];
  franSitemap: string[];
  franLankar: string[];
  sitemap: SitemapResultat;
  /** URL:er som filtrerades bort, med skäl — så en tom lista aldrig ser ut som en tom sajt. */
  bortfiltrerade: { url: string; skal: "maskinfil" | "monster" | "annan-domän" }[];
}

/**
 * Bygger kandidatlistan från BÅDA källorna: sitemap (index-medvetet) och länkarna i
 * startsidans HTML. Ingen konsument får bygga en egen — se filhuvudet.
 */
export async function upptackUrler(indata: UpptacktsIndata): Promise<UpptacktUtfall> {
  const origin = new URL(indata.rotUrl).origin;
  const rotNorm = normalisera(indata.rotUrl, origin)!;
  const bortfiltrerade: UpptacktUtfall["bortfiltrerade"] = [];

  const sitemap = await sitemapUrler(origin);
  const franSitemap: string[] = [];
  for (const u of sitemap.urls ?? []) {
    const n = normalisera(u, origin);
    if (!n) continue;
    if (!n.startsWith(origin)) { bortfiltrerade.push({ url: n, skal: "annan-domän" }); continue; }
    franSitemap.push(n);
  }

  const franLankar: string[] = [];
  if (indata.startHtml) {
    for (const u of lankarIHtml(indata.startHtml, origin)) {
      if (!franLankar.includes(u)) franLankar.push(u);
    }
  }

  const urls: string[] = [rotNorm];
  const sedda = new Set<string>([rotNorm]);
  for (const u of [...franSitemap, ...franLankar]) {
    if (sedda.has(u)) continue;
    if (!indata.taMedMaskinfiler && arMaskinfil(u)) { bortfiltrerade.push({ url: u, skal: "maskinfil" }); sedda.add(u); continue; }
    let sokvag = "";
    try { sokvag = new URL(u).pathname; } catch { continue; }
    if (indata.hoppaMonster?.some((m) => m.test(sokvag))) { bortfiltrerade.push({ url: u, skal: "monster" }); sedda.add(u); continue; }
    sedda.add(u);
    urls.push(u);
  }

  return { urls, franSitemap, franLankar, sitemap, bortfiltrerade };
}
