// ONBOARD-1 — vilka sidor ska läsas?
//
// Kravet är "skrapa och analysera hela sajten, inte bara startsidan". Men "hela" är fel
// mål: en sajt kan ha 400 sidor och 395 av dem är blogginlägg som inte säger något om
// företagsfakta. Vi vill ha de FÅ sidor som bär svaren — kontakt, om oss, tjänster,
// priser, omdömen — och startsidan.
//
// ⚠ SEO-motorns `crawlSite` bygger sin sidlista ENBART på /sitemap.xml. Det räcker inte
//   här: småföretagssajter (och just de kunder detta flöde finns för) saknar ofta sitemap
//   helt. Därför kombineras två källor — sitemap OCH länkarna på startsidan — och
//   resultatet rangordnas på hur troligt det är att sidan bär företagsfakta.

import { hamtaRatt } from "@/lib/seo-hamta";
import { decodePayload } from "@/lib/seo-deep";
import type { SidRoll } from "./typer";

/**
 * Ordvalen är svenska först, engelska sedan — kundstocken är svensk, men många svenska
 * sajter kör engelska slugs (/about, /pricing). Båda måste träffa.
 *
 * Ordningen i listan är prioritetsordningen när vi måste välja bort sidor.
 */
const ROLL_MONSTER: { roll: SidRoll; monster: RegExp; vikt: number }[] = [
  { roll: "kontakt", monster: /(^|\/)(kontakt|kontakta-oss|contact|hitta-hit|find-us)(\/|$|-)/i, vikt: 100 },
  { roll: "om", monster: /(^|\/)(om|om-oss|om-foretaget|about|about-us|vilka-vi-ar|var-historia)(\/|$|-)/i, vikt: 90 },
  { roll: "priser", monster: /(^|\/)(pris|priser|prislista|prices|pricing|kostnad|avgifter|paket)(\/|$|-)/i, vikt: 85 },
  { roll: "tjanster", monster: /(^|\/)(tjanst|tjanster|service|services|behandling|behandlingar|vad-vi-gor|erbjudande|produkter|sortiment)(\/|$|-)/i, vikt: 80 },
  { roll: "omdomen", monster: /(^|\/)(omdome|omdomen|recension|recensioner|referens|referenser|kundcase|case|testimonial|reviews|nojda-kunder)(\/|$|-)/i, vikt: 70 },
];

/** Sidor som aldrig bär företagsfakta. Att läsa dem kostar tid och ger brus. */
const SKIP_MONSTER =
  /(^|\/)(blogg?|blog|nyheter|news|artiklar|inlagg|post|tag|taggar|kategori|category|author|forfattare|integritet|privacy|cookie|gdpr|villkor|terms|kop-villkor|logga-in|login|min-sida|konto|account|kassa|checkout|varukorg|cart|sok|search|tack|thank-you|sitemap)(\/|$|-)/i;

/**
 * Maskinytor och kvarglömda sidor. Egen lista för att felet de orsakar är ett ANNAT:
 * SKIP_MONSTER sorterar bort sidor som är irrelevanta, det här sorterar bort sidor som
 * aktivt FÖRGIFTAR underlaget.
 *
 * Provkörningen mot linnetandvarden.se drog in `/wp-json` (321 000 tecken rå JSON) och
 * `/feed` i textunderlaget som modellen sedan skulle härleda tonläge ur, plus `/hem-old`
 * som är en gammal version av startsidan. Ingen av dem beskriver företaget — men de
 * trängde undan de sidor som gör det, eftersom underlaget är teckenbegränsat.
 */
// Terminatorn tillåter även "." — annars slinker `/xmlrpc.php` igenom, vilket den gjorde
// i provkörningen och kostade oss ett 403-svar per sajt.
const SKIP_MASKIN =
  /(^|\/)(wp-json|wp-admin|wp-content|wp-includes|xmlrpc|feed|rss|atom|amp|embed|oembed|api|graphql|\.well-known)(\/|$|\.)|(^|\/)[^/]*-(old|gammal|backup|kopia|test|temp|draft)(\/|$)|(^|\/)(old|gammal|backup|kopia)-[^/]*(\/|$)/i;

/** Filändelser som inte är sidor. */
const SKIP_ANDELSE = /\.(pdf|jpe?g|png|gif|svg|webp|avif|ico|css|js|json|xml|zip|mp4|mp3|woff2?|ttf)$/i;

export interface UpptacktSida {
  url: string;
  roll: SidRoll;
  vikt: number;
}

/**
 * Normaliserar en URL till en jämförbar form: samma värd, utan hash, utan query, utan
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

/** Vilken roll spelar sidan? Avgörs på sökvägen — inte på innehållet, som vi inte läst än. */
export function klassaRoll(url: string, rotUrl: string): { roll: SidRoll; vikt: number } {
  if (normalisera(url, rotUrl) === normalisera(rotUrl, rotUrl)) return { roll: "start", vikt: 1000 };
  let sokvag = url;
  try {
    sokvag = new URL(url).pathname;
  } catch {
    /* behåll rå sträng */
  }
  for (const m of ROLL_MONSTER) {
    if (m.monster.test(sokvag)) return { roll: m.roll, vikt: m.vikt };
  }
  // Grunda sidor (ett segment) är oftare navigationssidor med substans än djupa.
  const djup = sokvag.split("/").filter(Boolean).length;
  return { roll: "ovrig", vikt: djup <= 1 ? 30 : 10 };
}

/** Hämtar sitemapens URL:er. null = sitemapen kunde inte läsas (≠ tom sitemap). */
async function sitemapUrler(origin: string): Promise<string[] | null> {
  const r = await hamtaRatt(`${origin}/sitemap.xml`, { timeoutMs: 10000, accepteraIckeOk: true });
  if (r.logg.status !== 200 || r.text == null) return null;

  const urler = new Set<string>();
  for (const m of r.text.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)) urler.add(m[1].trim());

  // Sitemap-index: <sitemap><loc> pekar på fler sitemaps. Följ de tre första.
  if (/<sitemapindex/i.test(r.text)) {
    const barn = Array.from(urler).slice(0, 3);
    urler.clear();
    for (const b of barn) {
      const rb = await hamtaRatt(b, { timeoutMs: 10000, accepteraIckeOk: true });
      if (rb.logg.status === 200 && rb.text) {
        for (const m of rb.text.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)) urler.add(m[1].trim());
      }
    }
  }
  return Array.from(urler);
}

/** Plockar interna länkar ur startsidans HTML. Fungerar även på JS-renderad payload. */
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

/**
 * Bygger sidlistan att läsa: startsidan först, sedan de tyngsta rollerna.
 *
 * `startHtml` är startsidans HTML om vi redan hämtat den — då slipper vi en extra
 * hämtning och får länkupptäckt gratis.
 */
export async function upptackSidor(
  rotUrl: string,
  startHtml: string | null,
  maxSidor: number,
): Promise<UpptacktSida[]> {
  const origin = new URL(rotUrl).origin;
  const rotNorm = normalisera(rotUrl, origin)!;

  const kandidater = new Set<string>([rotNorm]);

  const franSitemap = await sitemapUrler(origin);
  for (const u of franSitemap ?? []) {
    const n = normalisera(u, origin);
    if (n && n.startsWith(origin)) kandidater.add(n);
  }

  if (startHtml) {
    for (const u of lankarIHtml(startHtml, origin)) kandidater.add(u);
  }

  const rankade: UpptacktSida[] = [];
  for (const url of kandidater) {
    if (url !== rotNorm) {
      if (SKIP_ANDELSE.test(url)) continue;
      let sokvag = "";
      try {
        sokvag = new URL(url).pathname;
      } catch {
        continue;
      }
      if (SKIP_MONSTER.test(sokvag) || SKIP_MASKIN.test(sokvag)) continue;
    }
    const { roll, vikt } = klassaRoll(url, rotUrl);
    rankade.push({ url, roll, vikt });
  }

  rankade.sort((a, b) => b.vikt - a.vikt || a.url.length - b.url.length);

  // Ta högst två sidor per roll — tio tjänstesidor säger inte mer än två om vem
  // företaget är, och varje extra sida kostar tid vi inte har inom en request.
  const perRoll = new Map<SidRoll, number>();
  const valda: UpptacktSida[] = [];
  for (const s of rankade) {
    if (valda.length >= maxSidor) break;
    const tagna = perRoll.get(s.roll) ?? 0;
    const tak = s.roll === "start" ? 1 : s.roll === "ovrig" ? 3 : 2;
    if (tagna >= tak) continue;
    perRoll.set(s.roll, tagna + 1);
    valda.push(s);
  }
  return valda;
}
