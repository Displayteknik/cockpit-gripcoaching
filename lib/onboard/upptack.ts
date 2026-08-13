// ONBOARD-1 — vilka sidor ska läsas?
//
// Kravet är "skrapa och analysera hela sajten, inte bara startsidan". Men "hela" är fel
// mål: en sajt kan ha 400 sidor och 395 av dem är blogginlägg som inte säger något om
// företagsfakta. Vi vill ha de FÅ sidor som bär svaren — kontakt, om oss, tjänster,
// priser, omdömen — och startsidan.
//
// Två källor kombineras — sitemap OCH länkarna på startsidan — och resultatet rangordnas
// på hur troligt det är att sidan bär företagsfakta. Småföretagssajter (och just de kunder
// detta flöde finns för) saknar ofta sitemap helt, så länkkällan är inte en bonus här.
//
// ★ SJÄLVA UPPTÄCKTEN BOR NUMERA I `lib/lankupptackt.ts` — Håkans beslut 13/8.
//   Den här filen hade rätt logik medan djupgranskningen hade fel, och varningen om det
//   stod kvar här i en kommentar i stället för att bli en delad modul. Det som skiljer
//   konsumenterna åt är bara FILTRET: onboardingen sorterar bort bloggen (den bär sällan
//   företagsfakta), djupgranskningen tar med den. Filtret skickas därför som konfiguration.

import { upptackUrler, normalisera as normaliseraDelad } from "@/lib/lankupptackt";
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
 * Normaliserar en URL till en jämförbar form. Re-export från den delade modulen — den
 * här filens anropare (och tester) importerar den härifrån sedan tidigare, och en
 * fungerande väg rivs aldrig.
 */
export const normalisera = normaliseraDelad;

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

export { lankarIHtml } from "@/lib/lankupptackt";

/**
 * Bygger sidlistan att läsa: startsidan först, sedan de tyngsta rollerna.
 *
 * `startHtml` är startsidans HTML om vi redan hämtat den — då slipper vi en extra
 * hämtning och får länkupptäckt gratis.
 *
 * Upptäckten görs av den delade modulen; det här flödets EGET bidrag är filtret
 * (bloggen bort) och rangordningen på roll.
 */
export async function upptackSidor(
  rotUrl: string,
  startHtml: string | null,
  maxSidor: number,
): Promise<UpptacktSida[]> {
  const origin = new URL(rotUrl).origin;
  const rotNorm = normalisera(rotUrl, origin)!;

  const upptackt = await upptackUrler({
    rotUrl,
    startHtml,
    // Onboardingens filter, oförändrat: sidor som inte bär företagsfakta och maskinytor
    // som aktivt förgiftar underlaget.
    hoppaMonster: [SKIP_MONSTER, SKIP_MASKIN],
  });

  const rankade: UpptacktSida[] = [];
  for (const url of upptackt.urls) {
    // SKIP_ANDELSE täcks numera av den delade maskinfilsfiltreringen, men behålls som
    // extra nät: listan här är bredare på bildformat än den delade.
    if (url !== rotNorm && SKIP_ANDELSE.test(url)) continue;
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
