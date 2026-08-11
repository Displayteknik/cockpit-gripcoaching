// ONBOARD-3 — Bokadirekt som egen källa.
//
// För tjänsteföretag ligger affären inte på hemsidan. Gittes Hemsida24-sajt saknar priser,
// tjänstebeskrivningar, öppettider och omdömen. Allt det finns på Bokadirekt. Med enbart
// webbadressen missar motorn merparten av det som gör profilen säljbar.
//
// ★ ALLT NEDAN ÄR VERIFIERAT MOT GITTES RIKTIGA SIDA (place 20545), inte antaget.
//
// Tre källor på samma sida, i fallande tillförlitlighet:
//
//   1. `window.__PRELOADED_STATE__`  — tjänster med pris och längd, recensionstexter,
//                                      kontaktuppgifter. Strukturerat, alltså starkast.
//   2. JSON-LD `LocalBusiness`       — namn, adress, betyg, ett urval recensioner.
//   3. Renderad HTML                 — öppettider per veckodag. Finns bara här.
//
// ⚠ RÄTTELSE AV EN UTBREDD UPPFATTNING: recensionstexterna renderas INTE med JavaScript.
//   De ligger i `place.reviews.topReviews[].review.text` och i JSON-LD. Ingen headless
//   browser behövs. Kontrollerat 2026-08-07 mot rå HTML utan rendering.

import { hamtaRatt } from "@/lib/seo-hamta";
import { decodePayload } from "@/lib/seo-deep";
import {
  funnet, kravForm, tomt,
  type Evenemang, type Falt, type OnboardSida, type Oppettid, type Tjanst,
} from "./typer";

// ── Adressen till profilsidan ────────────────────────────────────────────────

/**
 * Bokadirekt-länkar på kundens sajt pekar oftast på en ENSKILD tjänst:
 *   /boka-tjanst/gitte-ostling-for-balance-20545/forsta-motet-utforskande-samtal-1044315
 * Profilsidan byggs av slug + salongs-id:
 *   /places/gitte-ostling-for-balance-20545
 *
 * Id:t (20545) är det stabila. Slugen varierar mellan länkarna på samma sajt —
 * "gitte-ostling-20545" och "gitte-ostling-for-balance-20545" pekar båda på samma salong,
 * men bara den senare svarar 200. Den förra ger 301. Därför väljs den LÄNGSTA slugen:
 * den är den fullständiga, och en redirect kostar en hämtning vi inte behöver slösa.
 *
 * ⚠ SLUGEN ÄR INTE ALLTID ASCII. Oppråby Gamla Skola länkar
 *   `/places/oppråby-gamla-skola-58298` — med å. Teckenklassen [a-z0-9-] missade den
 *   tyst, och hela Bokadirekt-källan försvann för kunden som behövde den mest.
 *   Därför: allt utom URL-avslutare tillåts i slugen. fetch procentkodar själv.
 */
export function profilUrlFranLankar(lankar: string[]): string | null {
  const kandidater: { slug: string; id: string }[] = [];
  for (const l of lankar) {
    const m = l.match(/bokadirekt\.se\/(?:boka-tjanst|places)\/([^\s"'<>?#/]*?)-(\d{3,})(?=[/"'?#\s]|$)/iu);
    if (m) kandidater.push({ slug: m[1], id: m[2] });
  }
  if (!kandidater.length) return null;
  const id = kandidater[0].id;
  const samma = kandidater.filter((k) => k.id === id);
  const slug = samma.map((k) => k.slug).sort((a, b) => b.length - a.length)[0];
  return `https://www.bokadirekt.se/places/${slug}-${id}`;
}

/**
 * Hittar Bokadirekt-profilen ur de redan lästa sidorna.
 *
 * ★ DETTA VAR HÅLET SOM HÖLL KÄLLAN URKOPPLAD. Sidupptäckten (upptack.ts) kastar
 *   medvetet alla externa länkar — den bygger listan över VÅRA sidor att läsa, och där
 *   hör bokadirekt.se inte hemma. Men Bokadirekt-länken är ingen sida att crawla, den
 *   är en UPPGIFT på sajten, precis som ett telefonnummer. Därför letas den här, i de
 *   färdiglästa sidornas innehåll, samma väg som socialaUrSidor går.
 *
 * Rå HTML räcker inte: JS-renderade sajter bär länkarna i payload (decodePayload), och
 * sidor hämtade via renderingstjänsten har ingen HTML alls — då söks texten.
 */
export function bokadirektLankUrSidor(sidor: OnboardSida[]): string | null {
  const lankar: string[] = [];
  for (const s of sidor) {
    const kalla = s.html ? decodePayload(s.html) : s.text;
    for (const m of kalla.matchAll(/https?:\/\/(?:www\.)?bokadirekt\.se\/[^\s"'<>)]+/gi)) {
      lankar.push(m[0]);
    }
  }
  return profilUrlFranLankar(lankar);
}

// ── Hämtning och sammanställning ─────────────────────────────────────────────

/** Det Bokadirekt-sidan bidrar med till förslaget. Fält utan täckning är null. */
export interface BokadirektKallor {
  kallUrl: string;
  bokningslank: Falt;
  tjanster: Falt<Tjanst[]>;
  evenemang: Falt<Evenemang[]>;
  kundcitat: Falt<string[]>;
  oppettider: Falt<Oppettid[]>;
  adress: Falt | null;
  postnummer: Falt | null;
  ort: Falt | null;
  telefon: Falt | null;
}

/**
 * JSON-LD på profilsidan. LocalBusiness bär adress och telefon — STRUKTURERAT.
 *
 * ★ DET HÄR ÄR RÄTTELSEN AV POSTNUMMER-BUGGEN. Textfallbacken i extrahera.ts läste
 *   fem siffror ur sidtexten och fick salongs-id:t 20545 som postnummer. Ur
 *   `"postalCode": "725 94"` går det inte att läsa fel — och finns ingen PostalAddress
 *   lämnas fälten null i stället för att gissas ur text.
 */
function jsonLdLocalBusiness(html: string): Record<string, unknown> | null {
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const j = JSON.parse(m[1]) as Record<string, unknown>;
      const typ = j["@type"];
      if (typ === "LocalBusiness" || (Array.isArray(typ) && typ.includes("LocalBusiness"))) return j;
    } catch {
      /* trasig JSON-LD är sajtens problem, inte vårt stopp */
    }
  }
  return null;
}

/**
 * Hämtar och läser Bokadirekt-profilen. En hämtning, alla parsers.
 *
 * Kastar `KallstrukturFel` när sidans form ändrats (se allaTjanster) — det ska smälla,
 * inte tystna. Nätfel och icke-200 ger däremot null: en nere-för-underhåll-sida hos
 * Bokadirekt får inte fälla hela analysen, bara lämna källan otillgänglig.
 */
export async function hamtaBokadirekt(profilUrl: string): Promise<BokadirektKallor | null> {
  const r = await hamtaRatt(profilUrl, { timeoutMs: 15000, accepteraIckeOk: true });
  if (r.logg.status !== 200 || !r.text) return null;
  const html = r.text;

  const state = lasPreloadedState(html);
  // Verifierat live 2026-08-11 (place 58298): salongen ligger under state.place —
  // toppnivån, inte nästlad. Saknas den har sidans form ändrats, och det ska synas.
  kravForm(
    !!state && typeof (state as Record<string, unknown>).place === "object",
    "Bokadirekt",
    "window.__PRELOADED_STATE__.place",
    state ? `toppnycklar: ${Object.keys(state).join(", ")}` : "ingen __PRELOADED_STATE__ i sidan",
  );
  const place = (state as Record<string, unknown>).place as Record<string, unknown>;

  const ld = jsonLdLocalBusiness(html);
  const adr = (ld?.address ?? null) as Record<string, unknown> | null;
  const gata = typeof adr?.streetAddress === "string" && adr.streetAddress.trim() ? adr.streetAddress.trim() : null;
  const post = typeof adr?.postalCode === "string" && adr.postalCode.trim() ? adr.postalCode.trim() : null;
  const ort = typeof adr?.addressLocality === "string" && adr.addressLocality.trim() ? adr.addressLocality.trim() : null;
  const tel = typeof ld?.telephone === "string" && ld.telephone.trim() ? ld.telephone.trim() : null;

  return {
    kallUrl: profilUrl,
    bokningslank: funnet(profilUrl, "sajt", profilUrl, {
      citat: "Profilsidan på Bokadirekt, härledd ur sajtens bokningslänkar",
      sakerhet: "hog",
    }),
    tjanster: tjansterFranPayload(place, profilUrl),
    evenemang: evenemangFranPayload(place, profilUrl),
    kundcitat: kundcitatFranPayload(place, profilUrl),
    oppettider: oppettiderFranHtml(html, place, profilUrl),
    adress: gata ? funnet(gata, "schema", profilUrl, { citat: `"streetAddress": "${gata}"`, sakerhet: "hog" }) : null,
    postnummer: post ? funnet(post, "schema", profilUrl, { citat: `"postalCode": "${post}"`, sakerhet: "hog" }) : null,
    ort: ort ? funnet(ort, "schema", profilUrl, { citat: `"addressLocality": "${ort}"`, sakerhet: "hog" }) : null,
    telefon: tel ? funnet(tel.replace(/[\s\-()]/g, ""), "schema", profilUrl, { citat: `"telephone": "${tel}"`, sakerhet: "hog" }) : null,
  };
}

// ── Payloaden ────────────────────────────────────────────────────────────────

/**
 * Klipper ut `window.__PRELOADED_STATE__` genom att balansera klamrarna.
 *
 * En regex duger inte: payloaden är ~300 kB JSON med klamrar i strängvärden, och en
 * icke-girig matchning slutar vid första `}` inne i en beskrivningstext.
 */
export function lasPreloadedState(html: string): Record<string, unknown> | null {
  const s = html.indexOf("window.__PRELOADED_STATE__");
  if (s < 0) return null;
  const start = html.indexOf("{", s);
  if (start < 0) return null;

  let djup = 0, iStrang = false, esc = false;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (esc) { esc = false; continue; }
    if (c === "\\") { esc = true; continue; }
    if (c === '"') { iStrang = !iStrang; continue; }
    if (iStrang) continue;
    if (c === "{") djup++;
    else if (c === "}") {
      djup--;
      if (djup === 0) {
        try {
          return JSON.parse(html.slice(start, i + 1)) as Record<string, unknown>;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

interface BdTjanst {
  name?: string;
  price?: number;
  priceLabel?: string;
  durationLabel?: string;
  /** ⚠ Beskrivningen ligger under `about.description`, INTE under `description`. */
  about?: { description?: string };
}

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/**
 * Tjänstens beskrivningstext.
 *
 * ⚠ FÄLLA: objektet har inget `description` på toppnivå. Texten ligger under
 *   `about.description`. Att läsa fel nyckel ger inget fel — den ger tom sträng, och då
 *   försvinner tyst allt som bara står i brödtexten: sista anmälningsdag, deltagartak,
 *   friskvårdsbidrag, och det avvikande priset i Lugnets väg. Fälten blev bara `null`
 *   och såg ut som att sidan saknade uppgifterna.
 */
const beskrivning = (t: BdTjanst): string => str(t.about?.description) ?? "";

/**
 * Plattar ut grupperna. `place.services` är KATEGORIER; tjänsterna ligger ett steg ner.
 *
 * ★ VERIFIERAR FORMEN INNAN DEN LÄSER. Se `KallstrukturFel`: ett fält som blir tomt för
 *   att vi läste fel nyckel får aldrig se ut som ett fält vars uppgift saknas i källan.
 *   Byter Bokadirekt namn på `services`, `about` eller `about.description` ska det smälla
 *   här och nu, inte tystna och ge tunna profiler i veckor.
 */
function allaTjanster(place: Record<string, unknown>): BdTjanst[] {
  kravForm(
    Array.isArray(place.services),
    "Bokadirekt",
    "place.services som lista av tjänstegrupper",
    `${typeof place.services}`,
  );
  const grupper = place.services as Record<string, unknown>[];

  kravForm(
    grupper.every((g) => Array.isArray(g.services)),
    "Bokadirekt",
    "varje tjänstegrupp med en inre services-lista",
    `${grupper.filter((g) => !Array.isArray(g.services)).length} av ${grupper.length} grupper utan services`,
  );
  const tjanster = grupper.flatMap((g) => g.services as BdTjanst[]);
  if (!tjanster.length) return tjanster;

  kravForm(
    tjanster.some((t) => typeof t.name === "string"),
    "Bokadirekt",
    "tjänster med ett name-fält",
    `${tjanster.length} tjänster, ingen med name`,
  );

  // ★ DEN HÄR KONTROLLEN ÄR HELA POÄNGEN. Beskrivningen låg under `about.description` och
  //   parsern läste `description`. Inget fel kastades — fälten blev bara tomma, och sista
  //   anmälningsdag, deltagartak och prisonflikten försvann utan spår. Har INGEN tjänst en
  //   beskrivning på den förväntade platsen är det nästan säkert att nyckeln bytt namn igen.
  kravForm(
    tjanster.some((t) => typeof t.about?.description === "string"),
    "Bokadirekt",
    "tjänstebeskrivningar under about.description",
    `${tjanster.length} tjänster, ingen med about.description (fältet kan ha bytt namn)`,
  );

  return tjanster;
}

// ── Tjänster och priser ──────────────────────────────────────────────────────

/** "Pris: 6 100 kr" i en beskrivning. Bokadirekts prisFÄLT och beskrivningen kan säga olika. */
const PRIS_I_TEXT = /pris:?\s*([\d\s]{3,9})\s*(?:kr|:-|sek)/i;

/**
 * Tjänster med pris. Prisfältet är sanning; ett avvikande pris i beskrivningen bevaras
 * som konflikt i stället för att väljas bort tyst.
 *
 * Verkligt fall: "Utbildning - Lugnets väg" har `price: 6900` medan beskrivningen säger
 * "Pris: 6 100 kr". Samma tjänst, samma sida, två svar. Vilket som gäller kan bara Gitte
 * avgöra, alltså ska motorn inte välja.
 */
export function tjansterFranPayload(place: Record<string, unknown>, kallUrl: string): Falt<Tjanst[]> {
  const ut: Tjanst[] = [];
  for (const t of allaTjanster(place)) {
    const namn = str(t.name);
    if (!namn) continue;
    const pris = str(t.priceLabel) ?? (typeof t.price === "number" ? `${t.price} kr` : null);

    const iText = beskrivning(t).match(PRIS_I_TEXT);
    const textPris = iText ? `${iText[1].replace(/\s+/g, " ").trim()} kr` : null;
    const jamfor = (s: string | null) => (s ? s.replace(/\D/g, "") : "");

    const rad: Tjanst = { namn, pris, prisalternativ: null };
    if (textPris && pris && jamfor(textPris) !== jamfor(pris)) {
      rad.prisalternativ = [
        { pris, kallUrl, citat: `prisfältet i Bokadirekts bokningsdata: ${pris}` },
        { pris: textPris, kallUrl, citat: (iText?.[0] ?? "").trim() },
      ];
    }
    ut.push(rad);
  }

  if (!ut.length) return tomt<Tjanst[]>("Bokadirekt-sidan innehöll inga tjänster.");

  const motstridiga = ut.filter((t) => t.prisalternativ?.length);
  return funnet(ut, "sajt", kallUrl, {
    citat: motstridiga.length
      ? `${ut.length} tjänster ur Bokadirekts bokningsdata. ${motstridiga.length} har två olika priser på sidan: ${motstridiga.map((t) => `${t.namn} (${t.prisalternativ!.map((p) => p.pris).join(" mot ")})`).join("; ")}`
      : `${ut.length} tjänster ur Bokadirekts bokningsdata, pris och längd per tjänst`,
    sakerhet: motstridiga.length ? "lag" : "hog",
  });
}

// ── Kurser och workshops ─────────────────────────────────────────────────────

const MANADER: Record<string, number> = {
  januari: 0, februari: 1, mars: 2, april: 3, maj: 4, juni: 5,
  juli: 6, augusti: 7, september: 8, oktober: 9, november: 10, december: 11,
};

/**
 * Städar källans egen skrivning av ett datum. "8 september -2026" står så på Bokadirekt —
 * bindestrecket är Gittes eget, inte en sammanfogningsartefakt. Vi normaliserar bort det
 * eftersom det inte bär betydelse, men ändrar aldrig dag, månad eller år.
 */
export function stadaDatum(ra: string | null): string | null {
  if (!ra) return null;
  const t = ra.replace(/\s*[-–—]\s*(\d{4})\b/, " $1").replace(/\s+/g, " ").trim();
  return t || null;
}

/**
 * Avgör om ett evenemang redan varit.
 *
 * ⚠ ÅRET SAKNAS OFTA. "7 juni" utan årtal är tvetydigt. Vi gissar inte fram ett år, men
 *   vi väljer medvetet den försiktiga tolkningen: har datumet passerat i år markeras det
 *   som `passerat`. Kostnaderna är osymmetriska — ett felaktigt "passerat" syns i
 *   granskningen och rättas på två sekunder, medan ett passerat tillfälle som levereras
 *   som kommande blir innehåll som marknadsför något som inte finns, och det upptäcks
 *   först av kunden som klickar.
 */
export function evenemangStatus(datum: string | null, idag = new Date()): "kommande" | "passerat" | "okant" {
  if (!datum) return "okant";
  const m = datum.match(/(\d{1,2})\s*(?:e|:e)?\s+([a-zåäö]+)(?:\s+(\d{4}))?/i);
  if (!m) return "okant";
  const manad = MANADER[m[2].toLowerCase()];
  if (manad === undefined) return "okant";
  const dag = Number(m[1]);
  const ar = m[3] ? Number(m[3]) : idag.getFullYear();
  const d = new Date(ar, manad, dag, 23, 59, 59);
  return d.getTime() < idag.getTime() ? "passerat" : "kommande";
}

// "8 ggr" och "vecka 36-43" är Annas (Oppråby) skrivsätt för kursomgångar — lika mycket
// kurstecken som "8 tillfällen", bara kortare.
const KURS_TECKEN = /(utbildning|kurs|workshop|föreläsning|retreat|tillfällen|steg \d|\d+\s*ggr|vecka\s*\d)/i;
const DATUM = /\b(\d{1,2}\s+(?:januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december))\b/i;
/**
 * Kursomgångar anges ofta som veckospann i stället för datum: "vecka 36-43, 8 ggr,
 * tisdagar" (Oppråby). Det är ett datum i källans egen mening — tidsbegränsat och
 * planerbart — och utan det här mönstret försvann alla Annas kursstarter ur förslaget.
 * Året skrivs aldrig ut i formen, så status blir `okant` och granskningen får titta.
 */
const VECKOSPANN = /\b(vecka\s*\d{1,2}(?:\s*[-–—]\s*\d{1,2})?)\b/i;
const SISTA_ANMALAN = /(?:sista\s+(?:anmälningsdag|anmälan|dag för anmälan)|anmälan\s+senast)[:\s]*([^.!\n]{3,40})/i;
const TID = /\btid:?\s*(\d{1,2}[.:]\d{2}\s*[-–—]\s*\d{1,2}[.:]\d{2})/i;
const PLATS = /\bplats:?\s*([^.\n]{4,70})/i;
const VILLKOR = /((?:max|maximalt)\s*\d+\s*(?:deltagare|platser)|friskvårds(?:bidrag|peng)|\d+\s*tillfällen)/gi;

/**
 * Kurser och workshops med datum.
 *
 * ★ VARFÖR DE INTE FÅR KASTAS: markupförankringen i `oppettiderFranHtml` finns för att
 *   kursdatum inte ska förorena öppettiderna. Men de är inte skräp — de är det enda i hela
 *   profilen som har en deadline, och därmed det bästa innehållsunderlaget som finns för
 *   den här kundtypen. De hamnade bara i fel hink.
 */
export function evenemangFranPayload(place: Record<string, unknown>, kallUrl: string): Falt<Evenemang[]> {
  const ut: Evenemang[] = [];
  for (const t of allaTjanster(place)) {
    const namn = str(t.name);
    const text = `${namn ?? ""} ${beskrivning(t)}`;
    if (!namn) continue;
    if (!KURS_TECKEN.test(text)) continue;
    const datum = text.match(DATUM)?.[1] ?? text.match(VECKOSPANN)?.[1] ?? null;
    // Ett "evenemang" utan datum är bara en tjänst. Då hör den hemma i tjänstelistan.
    if (!datum) continue;

    const villkor = [...text.matchAll(VILLKOR)].map((m) => m[1].trim());
    const stadatDatum = stadaDatum(datum);
    ut.push({
      namn,
      datum: stadatDatum,
      sistaAnmalan: stadaDatum(text.match(SISTA_ANMALAN)?.[1]?.trim() ?? null),
      tid: text.match(TID)?.[1]?.trim() ?? null,
      plats: text.match(PLATS)?.[1]?.trim() ?? null,
      pris: str(t.priceLabel) ?? (typeof t.price === "number" ? `${t.price} kr` : null),
      villkor: villkor.length ? [...new Set(villkor)].join(", ") : null,
      status: evenemangStatus(stadatDatum),
    });
  }

  if (!ut.length) return tomt<Evenemang[]>("Inga kurser eller workshops med datum fanns på Bokadirekt-sidan.");

  // Ett passerat tillfälle får inte levereras som kommande. Fältet flaggas så att
  // granskningen tvingas titta, i stället för att raden tyst städas bort eller tyst släpps igenom.
  const passerade = ut.filter((e) => e.status === "passerat");
  return funnet(ut, "sajt", kallUrl, {
    citat:
      `${ut.length} kurstillfällen: ${ut.map((e) => `${e.namn.slice(0, 34)} (${e.datum}${e.status === "passerat" ? ", PASSERAT" : ""})`).join("; ")}` +
      (passerade.length ? `. ${passerade.length} har redan varit och ska inte marknadsföras som kommande.` : ""),
    sakerhet: passerade.length ? "lag" : "hog",
  });
}

// ── Kundcitat ────────────────────────────────────────────────────────────────

/**
 * Recensionstexter — ENBART texten.
 *
 * ★ INGA PERSONUPPGIFTER. Payloaden bär författarnamn och datum, men de sparas inte.
 *   Detta är customer voice, alltså underlag för HUR kundens kunder uttrycker sig — inte
 *   testimonials att publicera. Ett namngivet omdöme som lyfts ur sin kontext och
 *   återanvänds i marknadsföring är en annan sak juridiskt, och det ska inte kunna ske
 *   av misstag för att namnet råkade följa med in i databasen.
 *
 * ★ ALLTID PARTIELLT. `topReviews` är kurerade toppbetyg. De ger språket för EFTER — hur
 *   det känns när det blivit bra. Den mest värdefulla kundrösten är FÖRE: orden folk
 *   använder om sitt problem innan de köper ("hjälplös", "ingen lyssnar", "gett upp").
 *   Sådant står aldrig i en femstjärnig recension. Fältet markeras därför som ofullständigt
 *   även när det är fyllt, och kompletteringslistan frågar efter före-språket.
 */
export function kundcitatFranPayload(place: Record<string, unknown>, kallUrl: string): Falt<string[]> {
  const rev = (place.reviews ?? {}) as Record<string, unknown>;
  const rå = Array.isArray(rev.topReviews) ? rev.topReviews : Object.values(rev.topReviews ?? {}).flat();

  const texter: string[] = [];
  for (const r of rå as Record<string, unknown>[]) {
    const inner = (r?.review ?? {}) as Record<string, unknown>;
    const text = str(typeof r?.review === "string" ? r.review : inner.text);
    if (text && text.length > 15) texter.push(text);
  }

  const PARTIELLT =
    "Bara kurerade toppbetyg, alltså hur kunderna beskriver resultatet EFTERÅT. Orden de använder om sitt problem INNAN de köper saknas, och det är de som gör en öppningsrad träffsäker. Fråga kunden efter före-språket.";

  if (!texter.length) {
    return { ...tomt<string[]>("Inga recensionstexter fanns i Bokadirekts data."), partiellt: PARTIELLT };
  }
  const antal = typeof rev.reviewCount === "number" ? rev.reviewCount : null;
  return {
    ...funnet(texter, "sajt", kallUrl, {
      citat: `${texter.length} recensionstexter ur Bokadirekt${antal ? ` (av ${antal} totalt)` : ""}. Namn och datum sparas medvetet inte.`,
      sakerhet: "hog",
    }),
    partiellt: PARTIELLT,
  };
}

// ── Öppettider ───────────────────────────────────────────────────────────────

const DAGAR = ["Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag", "Söndag"];

/**
 * Öppettider per veckodag. Finns BARA i renderad HTML, inte i payloaden.
 *
 * ⚠ FÖRANKRAD I MARKUPEN, inte i dagnamnet. Gittes sida innehåller "Tisdag 15 september
 *   Tid: 18.00–20.30" och "Torsdag 17 september Del 2" — kurstillfällen, inte öppettider.
 *   Ett mönster som matchar dagnamn + klockslag i löpande text fångar dem. Kravet att det
 *   bara får stå TAGGAR mellan dagen och klockslaget skiljer dem åt.
 */
export function oppettiderFranHtml(html: string, place: Record<string, unknown> | null, kallUrl: string): Falt<Oppettid[]> {
  const monster = new RegExp(
    `>(${DAGAR.join("|")})<\\/[a-z]+>(?:\\s*<[^>]+>\\s*){0,6}(\\d{1,2}[:.]\\d{2})\\s*[-–—]?\\s*(\\d{1,2}[:.]\\d{2})?`,
    "gi",
  );

  const ut: Oppettid[] = [];
  for (const m of html.matchAll(monster)) {
    const dag = DAGAR.find((d) => d.toLowerCase() === m[1].toLowerCase())!;
    if (ut.some((x) => x.dag === dag)) continue;
    ut.push({ dag, tider: m[3] ? `${m[2]}–${m[3]}` : m[2] });
  }

  // ★ Förbehållet måste resa med siffrorna. Se `Falt.forbehall`.
  const installningar = ((place?.about as Record<string, unknown>)?.settings ?? {}) as Record<string, unknown>;
  const extra = str(installningar.openingHoursExtraInformation);

  if (!ut.length) {
    const t = tomt<Oppettid[]>("Inga öppettider gick att läsa ur Bokadirekt-sidan.");
    return extra ? { ...t, forbehall: extra } : t;
  }
  return {
    ...funnet(ut, "sajt", kallUrl, { citat: `${ut.length} veckodagar lästa ur Bokadirekts öppettidsblock`, sakerhet: "hog" }),
    forbehall: extra,
  };
}
