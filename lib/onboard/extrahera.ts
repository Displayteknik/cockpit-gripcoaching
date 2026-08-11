// ONBOARD-1 — hårda fakta läses, aldrig härleds.
//
// Skiljelinjen mot `harled.ts` är avsiktlig och viktig:
//
//   Här:        namn, telefon, mejl, adress, öppettider, sociala länkar, priser.
//               Sådant som har ett RÄTT SVAR som står på sajten. Läses deterministiskt.
//   harled.ts:  bransch, målgrupp, smärta, tonläge. Sådant som måste TOLKAS, och därför
//               går genom modellen — med krav på ordagrant citat.
//
// Anledningen är [[lesson_enhet_pa_externt_falt_maste_bevisas]] och den bredare regeln att
// en modell aldrig ska få gissa ett telefonnummer. Ett påhittat telefonnummer i ett
// kundkonto är värre än ett tomt fält: det ser rätt ut.
//
// Starkast källa är JSON-LD (`schema`). Ett `LocalBusiness`-block bär oftast namn,
// telefon, adress, öppettider och betyg i strukturerad form — det är kundens egen
// deklaration om sig själv och slår allt vi kan regex:a fram ur brödtext.

import { decodePayload } from "@/lib/seo-deep";
import { funnet, tomt, type Falt, type Oppettid, type Tjanst } from "./typer";
import type { OnboardSida } from "./typer";

// ── JSON-LD ──────────────────────────────────────────────────────────────────

/** Typer som beskriver själva företaget. Andra typer (Article, BreadcrumbList) hoppas över. */
const FORETAGSTYPER =
  /^(Organization|LocalBusiness|Corporation|Store|Restaurant|Dentist|MedicalBusiness|MedicalClinic|HealthAndBeautyBusiness|ProfessionalService|HomeAndConstructionBusiness|AutomotiveBusiness|BeautySalon|HairSalon|Physician|LegalService|AccountingService|RealEstateAgent|SportsActivityLocation|EducationalOrganization|ExerciseGym|FinancialService|InsuranceAgency|TravelAgency|Plumber|Electrician|GeneralContractor|Locksmith|MovingCompany|RoofingContractor|Cafe|CafeOrCoffeeShop|Bakery|BarOrPub|FoodEstablishment|NGO|Veterinary|VeterinaryCare|ChildCare|Attorney)$/i;

type Ld = Record<string, unknown>;

/** Plockar alla JSON-LD-block ur en sida, även när de ligger i en JS-payload. */
export function lasJsonLd(html: string): Ld[] {
  const ut: Ld[] = [];
  const kalla = decodePayload(html);
  for (const m of kalla.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const tolkad = JSON.parse(m[1].trim());
      const platta = (n: unknown): void => {
        if (Array.isArray(n)) return n.forEach(platta);
        if (n && typeof n === "object") {
          ut.push(n as Ld);
          const graf = (n as Ld)["@graph"];
          if (graf) platta(graf);
        }
      };
      platta(tolkad);
    } catch {
      // Trasig JSON-LD är vanligt. Hoppa blocket, aldrig hela sidan.
    }
  }
  return ut;
}

const typerAv = (nod: Ld): string[] => {
  const t = nod["@type"];
  if (typeof t === "string") return [t];
  if (Array.isArray(t)) return t.filter((x): x is string => typeof x === "string");
  return [];
};

/**
 * Poängsätter hur troligt det är att en JSON-LD-nod beskriver KUNDENS FÖRETAG.
 *
 * ⚠ Att ta första noden med rätt @type räcker inte. Provkörningen mot
 * linnetandvarden.se plockade `{"@type":"Organization","name":"TB Elementor"}` — ett
 * WordPress-temas egen signatur — och hade skrivit in tandvårdskliniken i MySales under
 * namnet på ett sidbyggarplugin. Noden hade rätt typ och inget annat.
 *
 * Poängen mäter substans: ett företag som beskriver sig själv anger adress, telefon och
 * öppettider. Ett plugin anger bara ett namn. Noll poäng = ingen företagsnod hittad,
 * och då faller namnet tillbaka på og:site_name och sidtiteln i stället.
 */
function nodPoang(nod: Ld, sidUrl: string): number {
  let p = 0;
  const typer = typerAv(nod);

  // En specifik verksamhetstyp (Dentist, Restaurant) är en starkare självdeklaration
  // än den generiska Organization, som allt möjligt sätter på sig.
  if (typer.some((t) => FORETAGSTYPER.test(t) && !/^(Organization|Corporation)$/i.test(t))) p += 3;

  if (nod.address && typeof nod.address === "object") p += 3;
  if (strang(nod.telephone)) p += 2;
  if (nod.openingHoursSpecification) p += 2;
  if (strang(nod.email)) p += 1;
  if (nod.aggregateRating) p += 1;
  if (nod.sameAs) p += 1;

  // Pekar noden ut samma domän som vi läser är det med största sannolikhet kunden själv.
  const nodUrl = strang(nod.url);
  if (nodUrl) {
    try {
      const a = new URL(nodUrl).hostname.replace(/^www\./i, "").toLowerCase();
      const b = new URL(sidUrl).hostname.replace(/^www\./i, "").toLowerCase();
      if (a === b) p += 3;
    } catch {
      /* trasig url i schemat säger ingenting */
    }
  }
  return p;
}

/**
 * Hittar företagsnoden — den med högst substans, inte den första.
 * Null när ingen nod bär mer än ett namn.
 */
export function foretagsNod(sidor: OnboardSida[]): { nod: Ld; url: string } | null {
  let bast: { nod: Ld; url: string; poang: number } | null = null;
  for (const s of sidor) {
    if (!s.html) continue;
    for (const nod of lasJsonLd(s.html)) {
      if (!typerAv(nod).some((t) => FORETAGSTYPER.test(t))) continue;
      const poang = nodPoang(nod, s.url);
      if (!bast || poang > bast.poang) bast = { nod, url: s.url, poang };
    }
  }
  // Enbart ett namn utan adress, telefon, öppettider eller matchande domän är för tunt
  // för att lita på. Då är det bättre att läsa namnet ur og:site_name.
  if (!bast || bast.poang < 3) return null;
  return { nod: bast.nod, url: bast.url };
}

const strang = (v: unknown): string | null => {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number") return String(v);
  return null;
};

// ── Kontaktfakta ─────────────────────────────────────────────────────────────

/** Svenska telefonnummer i länkform. `tel:`-länkar är entydiga — brödtext är det inte. */
export function telefonUrSidor(sidor: OnboardSida[]): Falt {
  for (const s of sidor) {
    const kalla = s.html ? decodePayload(s.html) : s.text;
    const m = kalla.match(/tel:\s*([+0-9][0-9\s\-()]{6,20})/i);
    if (m) {
      const nummer = m[1].replace(/[\s\-()]/g, "");
      return funnet(nummer, "sajt", s.url, { citat: m[0].slice(0, 60), sakerhet: "hog" });
    }
  }
  return tomt("Ingen telefonlänk (tel:) hittades på de lästa sidorna.");
}

/** Skräpadresser som finns på nästan varje sajt men aldrig är företagets egen. */
const SKRAP_EPOST = /(example|sentry|wixpress|@2x|\.png|\.jpg|\.svg|noreply@|no-reply@|donotreply)/i;

export function epostUrSidor(sidor: OnboardSida[]): Falt {
  for (const s of sidor) {
    const kalla = s.html ? decodePayload(s.html) : s.text;
    const träffar = [
      ...Array.from(kalla.matchAll(/mailto:\s*([^\s"'<>?]+@[^\s"'<>?]+)/gi), (m) => m[1]),
      ...Array.from(kalla.matchAll(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g), (m) => m[0]),
    ];
    for (const rå of träffar) {
      const e = rå.trim().toLowerCase().replace(/[.,;]+$/, "");
      if (SKRAP_EPOST.test(e)) continue;
      if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(e)) continue;
      return funnet(e, "sajt", s.url, { citat: rå.slice(0, 60), sakerhet: "hog" });
    }
  }
  return tomt("Ingen e-postadress hittades på de lästa sidorna.");
}

const SOCIALA: { nyckel: string; vard: RegExp }[] = [
  { nyckel: "facebook", vard: /(^|\.)facebook\.com$/i },
  { nyckel: "instagram", vard: /(^|\.)instagram\.com$/i },
  { nyckel: "linkedin", vard: /(^|\.)linkedin\.com$/i },
  { nyckel: "youtube", vard: /(^|\.)youtube\.com$/i },
  { nyckel: "tiktok", vard: /(^|\.)tiktok\.com$/i },
  { nyckel: "x", vard: /(^|\.)(twitter\.com|x\.com)$/i },
];

export function socialaUrSidor(sidor: OnboardSida[]): Falt<Record<string, string>> {
  const ut: Record<string, string> = {};
  let kallUrl: string | null = null;
  for (const s of sidor) {
    const kalla = s.html ? decodePayload(s.html) : s.text;
    for (const m of kalla.matchAll(/https?:\/\/[^\s"'<>)]+/gi)) {
      let u: URL;
      try {
        u = new URL(m[0]);
      } catch {
        continue;
      }
      for (const soc of SOCIALA) {
        if (!soc.vard.test(u.hostname)) continue;
        // Delningsknappar, dialoger och SPÅRNINGSPIXLAR är inte kundens egen profil.
        // ⚠ `facebook.com/tr?id=…` är Metas pixel och ligger på i stort sett varje sajt
        // som annonserar. Provkörningen tog den som Linnétandvårdens Facebook-sida.
        if (/^\/(tr|sharer|share|intent|dialog|plugins|login|help|policies|privacy|terms|settings|legal)(\/|$)/i.test(u.pathname)) continue;
        // En riktig profil-URL bär ingen frågesträng. Pixlar och spårlänkar gör det alltid.
        if (u.search) continue;
        if (u.pathname.replace(/\/+$/, "") === "") continue;
        if (!ut[soc.nyckel]) {
          ut[soc.nyckel] = u.toString().replace(/\/+$/, "");
          kallUrl = kallUrl || s.url;
        }
      }
    }
  }
  if (!Object.keys(ut).length) return tomt("Inga länkar till sociala konton hittades.");
  return funnet(ut, "sajt", kallUrl, { sakerhet: "hog" });
}

// ── Företagsnamn och adress ──────────────────────────────────────────────────

export function namnUrSidor(sidor: OnboardSida[], nod: Ld | null, nodUrl: string | null): Falt {
  const franSchema = nod ? strang(nod.name) || strang(nod.legalName) : null;
  if (franSchema) {
    return funnet(franSchema, "schema", nodUrl, { citat: `"name": "${franSchema}"`, sakerhet: "hog" });
  }

  const start = sidor.find((s) => s.roll === "start") ?? sidor[0];
  if (start?.html) {
    const kalla = decodePayload(start.html);
    const og = kalla.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i);
    if (og?.[1]?.trim()) {
      return funnet(og[1].trim(), "sajt", start.url, { citat: `og:site_name = ${og[1].trim()}`, sakerhet: "hog" });
    }
    const titel = kalla.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titel?.[1]) {
      // Titlar ser oftast ut som "Tjänst i Stad | Företaget". Sista delen är namnet.
      const delar = titel[1]
        .replace(/\s+/g, " ")
        .trim()
        .split(/\s+[|–—-]\s+/)
        .map((d) => d.trim())
        .filter(Boolean);
      const kandidat = delar.length > 1 ? delar[delar.length - 1] : delar[0];
      // En titel som är en URL eller e-postadress är inte ett företagsnamn. Parkerade
      // domäner har ofta måldomänen som titel — det får aldrig bli kundens namn.
      const arSkrap = !kandidat || /^(https?:\/\/|www\.)/i.test(kandidat) || /@/.test(kandidat) || /^[\d\s.,-]+$/.test(kandidat);
      if (!arSkrap && kandidat.length <= 60) {
        return funnet(kandidat, "sajt", start.url, {
          citat: `<title>${titel[1].trim().slice(0, 80)}</title>`,
          sakerhet: delar.length > 1 ? "medel" : "lag",
        });
      }
    }
  }
  return tomt("Företagsnamnet gick inte att läsa ur strukturerad data, og:site_name eller sidtiteln.");
}

export interface AdressDelar {
  adress: Falt;
  postnummer: Falt;
  ort: Falt;
}

/**
 * Menyord som står direkt efter orten i en sidfot och därför fastnar i regexen.
 *
 * Provkörningen gav "Göteborg Integritetspolicy" och "Stockholm Karta" — sidfoten var
 * "… 41304 Göteborg Integritetspolicy © 2024". Ortnamnet är rätt, ordet efter är en
 * meny­länk. Ett tvåordsmönster behövs ändå: "Upplands Väsby" och "Stora Höga" är
 * riktiga orter.
 */
const ORT_STOPPORD =
  /^(integritetspolicy|integritet|cookies?|cookiepolicy|karta|kontakt|kontakta|hem|meny|boka|om|telefon|tel|e-?post|mejl|mail|villkor|sitemap|copyright|alla|följ|besök|adress|öppettider|org|orgnr|organisationsnummer|instagram|facebook|linkedin|start|hitta|vägbeskrivning|här|läs|se|vår|våra|vi)$/i;

/** Klipper bort menyord som fastnat efter ortnamnet. Null när inget dugligt återstår. */
export function stadaOrt(rå: string): string | null {
  const ord: string[] = [];
  for (const o of rå.trim().split(/\s+/)) {
    if (ORT_STOPPORD.test(o)) break;
    ord.push(o);
    if (ord.length === 2) break;
  }
  const ut = ord.join(" ").trim();
  return ut.length >= 2 ? ut : null;
}

export function adressUrNod(nod: Ld | null, nodUrl: string | null, sidor: OnboardSida[]): AdressDelar {
  const adr = nod?.address as Ld | undefined;
  if (adr && typeof adr === "object") {
    const gata = strang(adr.streetAddress);
    const post = strang(adr.postalCode);
    const ort = strang(adr.addressLocality);
    if (gata || post || ort) {
      return {
        adress: gata
          ? funnet(gata, "schema", nodUrl, { citat: `"streetAddress": "${gata}"`, sakerhet: "hog" })
          : tomt("Gatuadress saknas i sajtens strukturerade data."),
        postnummer: post
          ? funnet(post.replace(/\s+/g, " ").trim(), "schema", nodUrl, { citat: `"postalCode": "${post}"`, sakerhet: "hog" })
          : tomt("Postnummer saknas i sajtens strukturerade data."),
        ort: ort
          ? funnet(ort, "schema", nodUrl, { citat: `"addressLocality": "${ort}"`, sakerhet: "hog" })
          : tomt("Ort saknas i sajtens strukturerade data."),
      };
    }
  }

  // Fallback: svenskt postnummer + ort i brödtext ("826 34 Söderhamn").
  //
  // ⚠ Lookbehind-garden är inte pynt: fem siffror i löptext kan vara ett SALONGS-ID.
  //   "gitte-ostling-for-balance-20545 Västerås" gav postnummer 20545 i skarpt läge.
  //   Siffror som föregås av bindestreck eller fler siffror är del av en slug eller ett
  //   längre tal — aldrig ett postnummer.
  for (const s of sidor) {
    const m = s.text.match(/(?<![-\d])(\d{3}\s?\d{2})\s+([A-ZÅÄÖ][a-zåäöéü-]+(?:\s+[A-ZÅÄÖ][a-zåäöéü-]+)?)\b/);
    if (m) {
      const kontext = s.text.slice(Math.max(0, m.index! - 60), m.index! + 60).trim();
      const ort = stadaOrt(m[2]);
      return {
        adress: tomt("Gatuadressen gick inte att avgöra säkert ur brödtexten."),
        postnummer: funnet(m[1].replace(/\s/g, " "), "sajt", s.url, { citat: kontext, sakerhet: "medel" }),
        ort: ort
          ? funnet(ort, "sajt", s.url, { citat: kontext, sakerhet: "medel" })
          : tomt("Orten gick inte att avgöra säkert ur brödtexten."),
      };
    }
  }
  return {
    adress: tomt("Ingen adress hittades på de lästa sidorna."),
    postnummer: tomt("Inget postnummer hittades på de lästa sidorna."),
    ort: tomt("Ingen ort hittades på de lästa sidorna."),
  };
}

// ── Öppettider ───────────────────────────────────────────────────────────────

const DAG_SV: Record<string, string> = {
  monday: "Måndag", tuesday: "Tisdag", wednesday: "Onsdag", thursday: "Torsdag",
  friday: "Fredag", saturday: "Lördag", sunday: "Söndag",
};

export function oppettiderUrNod(nod: Ld | null, nodUrl: string | null): Falt<Oppettid[]> {
  const spec = nod?.openingHoursSpecification;
  const rader: Oppettid[] = [];

  const las = (n: unknown): void => {
    if (Array.isArray(n)) return n.forEach(las);
    if (!n || typeof n !== "object") return;
    const o = n as Ld;
    const dagar = Array.isArray(o.dayOfWeek) ? o.dayOfWeek : o.dayOfWeek ? [o.dayOfWeek] : [];
    const oppnar = strang(o.opens);
    const stanger = strang(o.closes);
    if (!dagar.length || !oppnar || !stanger) return;
    for (const d of dagar) {
      const namn = String(d).split("/").pop()!.toLowerCase();
      rader.push({ dag: DAG_SV[namn] || String(d), tider: `${oppnar}–${stanger}` });
    }
  };
  las(spec);

  if (rader.length) {
    return funnet(rader, "schema", nodUrl, { citat: "openingHoursSpecification", sakerhet: "hog" });
  }
  return tomt("Inga öppettider fanns i sajtens strukturerade data.");
}

// ── Priser och tjänster ──────────────────────────────────────────────────────

/**
 * ONBOARD-2 — knapp-, meny- och löftestexter som står intill priser men aldrig ÄR tjänsten.
 *
 * Provkörningen mot displayteknik.se gav tjänsten
 *   "Få exakt pris inom 24h 55 tum Skyltfönsterskärm"
 * där "Få exakt pris inom 24h" är texten på en knapp och "55 tum Skyltfönsterskärm" är
 * produkten. De hamnade ihop för att de står nära varandra i texten. Resultatet gick rakt
 * in i GHL:s custom values och brand-profilen som om det vore ett tjänstenamn.
 *
 * Det här är inte en standard som ska ersättas med en bättre standard — det är en
 * FELLÄSNING. Går namnet inte att läsa rent ska raden bort, inte städas till något som
 * ser rimligt ut.
 */
const CTA_FRAS =
  /(få\s+(?:exakt\s+)?(?:pris|offert)|begär\s+(?:pris|offert)|boka\s+(?:tid|möte|demo|samtal)?|läs\s+mer|se\s+mer|visa\s+mer|mer\s+info(?:rmation)?|kontakta\s+(?:oss|mig)|ring\s+oss|hör\s+av\s+dig|skicka\s+(?:förfrågan|meddelande)|köp\s+nu|handla\s+nu|lägg\s+i\s+(?:varukorg|kundvagn)|till\s+kassan|beställ\s+nu|kom\s+igång|klicka\s+här|anmäl\s+dig|prenumerera|inom\s+\d+\s*(?:h|tim|timmar|dagar)|gratis\s+(?:offert|konsultation|rådgivning)|swish|delbetala|från\s+endast)/i;

/** Ren navigation. Står ofta precis före prisblocket i sidfot och menyer. */
const MENY_ORD =
  /^(hem|start|meny|om\s+oss|om|kontakt|kontakta|tjänster|priser|prislista|produkter|blogg|nyheter|galleri|referenser|vanliga\s+frågor|faq|villkor|integritetspolicy|cookies?|sitemap|logga\s+in|mitt\s+konto|sök)$/i;

/**
 * Städar ett kandidatnamn. Returnerar null när raden ska förkastas helt.
 *
 * Ordningen spelar roll: CTA-frasen klipps bort FÖRST (den står före produkten i
 * "Få exakt pris inom 24h 55 tum Skyltfönsterskärm"), och det som återstår måste
 * fortfarande hålla som ett namn på egen hand.
 */
export interface StadatNamn {
  namn: string;
  /** Namnet höll inte alla formkrav men kastas inte — det flaggas för granskning. */
  osaker: boolean;
}

export function stadaTjanstnamn(ra: string): StadatNamn | null {
  let namn = ra.trim();

  // Klipp bort allt till och med sista CTA-frasen — produkten står efter knapptexten.
  let skydd = 0;
  while (CTA_FRAS.test(namn) && skydd++ < 4) {
    namn = namn.replace(new RegExp(`^[\\s\\S]*?${CTA_FRAS.source}`, "i"), "").trim();
  }
  namn = namn.replace(/^[\s,;:.–—-]+/, "").trim();

  // Kvarvarande CTA betyder att raden ÄR en knapp, inte en tjänst.
  if (CTA_FRAS.test(namn)) return null;
  if (MENY_ORD.test(namn)) return null;
  if (namn.length < 3 || namn.length > 70) return null;
  // Ett "namn" som bär mer än en mening är hopklistrad brödtext, inte en tjänst.
  if ((namn.match(/[.!?]\s/g) || []).length >= 1) return null;
  // Minst ett riktigt ord med bokstäver.
  if (!/[a-zåäöA-ZÅÄÖ]{3}/.test(namn)) return null;
  // Halv parentes = mitt i en mening ("30 % på t ex första samtalet (").
  if ((namn.match(/\(/g) || []).length !== (namn.match(/\)/g) || []).length) return null;

  // ★ Ett rent siffervärde är inget namn — men "55 tum Skyltfönsterskärm" är det.
  //   Den gamla regeln förkastade allt som började med en siffra och slängde därmed
  //   varenda produkt vars namn bär sin storlek först, vilket är normen i skyltbranschen.
  if (/^\d/.test(namn) && !/^\d[\d\s.,-]{0,6}\s*[a-zåäöA-ZÅÄÖ]/.test(namn)) return null;

  // ★ Ett tjänstenamn börjar normalt med versal eller siffra. Börjar det med gemen är det
  //   oftast ett utklipp mitt ur en mening — "till Qigong 7e juni med", "en 43-tums".
  //
  //   MEN regeln raderar riktiga tjänster. Gitte säljer "eMcOLORfORM aRT", en upplevelsedag
  //   med meditation och målning. Den börjar med gemen och är ett äkta namn.
  //
  //   Skiljetecknet är versaler INUTI ordet. Ett meningsutklipp har dem aldrig; ett
  //   stiliserat varumärkesnamn har dem alltid. Och när vi ändå är osäkra kastas namnet
  //   inte — det flaggas. Ett bortkastat fält är osynligt, ett flaggat syns.
  const forstaBokstav = namn.match(/[a-zåäöA-ZÅÄÖ]/)?.[0] ?? "";
  const borjarGemen = !/^\d/.test(namn) && !!forstaBokstav && forstaBokstav === forstaBokstav.toLowerCase();
  if (borjarGemen) {
    // Versal inuti ett ord som inleds med gemen = stiliserat namn, inte brödtext.
    const stiliserat = /\b[a-zåäö]+[A-ZÅÄÖ]/.test(namn);
    if (!stiliserat) return null;
    return { namn, osaker: true };
  }

  return { namn, osaker: false };
}

/**
 * Svenska prisuppgifter, ordagrant som de står. Vi räknar ALDRIG om, tolkar aldrig
 * "från"-priser som fastpris, och tar aldrig ett pris utan en rubrik i närheten —
 * ett belopp utan vad det avser är värdelöst i ett kundkonto.
 */
export function priserUrSidor(sidor: OnboardSida[]): Falt<Tjanst[]> {
  const relevanta = sidor.filter((s) => s.roll === "priser" || s.roll === "tjanster");
  const soklista = relevanta.length ? relevanta : sidor;
  const ut: Tjanst[] = [];
  let kallUrl: string | null = null;
  /** Namn som behölls trots att de inte höll formkraven. Flaggas, kastas aldrig. */
  const osakraNamn: string[] = [];

  const PRIS = /((?:från\s+)?\d[\d\s.]{1,9}(?:,\d{1,2})?)\s?(kr|:-|SEK)\b/gi;

  for (const s of soklista) {
    for (const m of s.text.matchAll(PRIS)) {
      const belopp = `${m[1].replace(/\s+/g, " ").trim()} ${m[2] === ":-" ? "kr" : m[2]}`;
      // Texten strax före beloppet är tjänstens namn. Kolon måste dela: raden
      // "Nedan följer ett urval av våra priser: Undersökning 900 kr" ska ge
      // "Undersökning", inte hela inledningen.
      const fore = s.text.slice(Math.max(0, m.index! - 90), m.index!).trim();
      // En prislista utan skiljetecken ("Undersökning 900kr Tanduttagning") ger annars
      // föregående rads pris som del av nästa rads namn. Klipp bort allt till och med
      // det sista beloppet.
      const rått = (fore.split(/[.:•|·—–]|\s{2,}/).pop() ?? "")
        .replace(/^.*?\d[\d\s.]*(?:,\d{1,2})?\s?(?:kr|:-|SEK)\b/i, "")
        .replace(/^[\s,;–—-]+/, "")
        .trim();
      // ONBOARD-2: knapptexter är inte tjänster. Går namnet inte att läsa rent
      // förkastas raden — hellre en tjänst mindre än ett påhittat tjänstenamn.
      const stadat = stadaTjanstnamn(rått);
      if (!stadat) continue;
      const namn = stadat.namn;
      if (stadat.osaker) osakraNamn.push(namn);

      const kontext = s.text.slice(Math.max(0, m.index! - 90), m.index! + belopp.length + 10).replace(/\s+/g, " ").trim();
      const fanns = ut.find((t) => t.namn.toLowerCase() === namn.toLowerCase());
      if (fanns) {
        // ONBOARD-2: samma tjänst, ANNAT pris. Motorn får inte välja tyst — båda bevaras.
        if (fanns.pris && fanns.pris !== belopp) {
          fanns.prisalternativ = fanns.prisalternativ ?? [
            { pris: fanns.pris, kallUrl: kallUrl || s.url, citat: fanns.namn },
          ];
          if (!fanns.prisalternativ.some((p) => p.pris === belopp)) {
            fanns.prisalternativ.push({ pris: belopp, kallUrl: s.url, citat: kontext });
          }
        }
        continue;
      }

      ut.push({ namn, pris: belopp, prisalternativ: null });
      kallUrl = kallUrl || s.url;
      if (ut.length >= 12) break;
    }
    if (ut.length >= 12) break;
  }

  if (!ut.length) return tomt("Inga priser stod utskrivna på de lästa sidorna.");

  if (osakraNamn.length) {
    return funnet(ut, "sajt", kallUrl, {
      citat: `${ut.length} prisrader lästa ordagrant. Kontrollera stavningen på ${osakraNamn.length === 1 ? "tjänsten" : "tjänsterna"} ${osakraNamn.map((n) => `"${n}"`).join(", ")} — namnet börjar med gemen och kan vara ett utklipp ur brödtext, eller ett stiliserat namn som ska stå precis så.`,
      sakerhet: "lag",
    });
  }

  const motstridiga = ut.filter((t) => t.prisalternativ && t.prisalternativ.length > 1);
  if (motstridiga.length) {
    // Låg säkerhet = flaggas alltid i granskningsvyn, aldrig tyst accepterat.
    return funnet(ut, "sajt", kallUrl, {
      citat: `${ut.length} prisrader lästa ordagrant. ${motstridiga.length} tjänst${motstridiga.length === 1 ? "" : "er"} har flera olika priser på sajten: ${motstridiga.map((t) => `${t.namn} (${t.prisalternativ!.map((p) => p.pris).join(" / ")})`).join("; ")}`,
      sakerhet: "lag",
    });
  }
  return funnet(ut, "sajt", kallUrl, { citat: `${ut.length} prisrader lästa ordagrant`, sakerhet: "medel" });
}

// ── Betyg ────────────────────────────────────────────────────────────────────

export function betygUrNod(nod: Ld | null, nodUrl: string | null): { betyg: Falt<number>; antal: Falt<number> } {
  const agg = nod?.aggregateRating as Ld | undefined;
  if (agg && typeof agg === "object") {
    const v = Number(strang(agg.ratingValue));
    const n = Number(strang(agg.reviewCount) ?? strang(agg.ratingCount));
    return {
      betyg: Number.isFinite(v) && v > 0
        ? funnet(v, "schema", nodUrl, { citat: `"ratingValue": ${v}`, sakerhet: "hog" })
        : tomt("Inget betyg i sajtens strukturerade data."),
      antal: Number.isFinite(n) && n > 0
        ? funnet(n, "schema", nodUrl, { citat: `"reviewCount": ${n}`, sakerhet: "hog" })
        : tomt("Inget antal recensioner i sajtens strukturerade data."),
    };
  }
  return {
    betyg: tomt("Inget betyg i sajtens strukturerade data."),
    antal: tomt("Inget antal recensioner i sajtens strukturerade data."),
  };
}

/** Kundomdömen ur JSON-LD `review`. Fri brödtext lämnas till AI-härledningen. */
export function omdomenUrNod(nod: Ld | null, nodUrl: string | null): Falt<string[]> {
  const rev = nod?.review;
  const ut: string[] = [];
  const las = (n: unknown): void => {
    if (Array.isArray(n)) return n.forEach(las);
    if (!n || typeof n !== "object") return;
    const o = n as Ld;
    const kropp = strang(o.reviewBody) || strang(o.description);
    if (kropp && kropp.length > 20) ut.push(kropp.slice(0, 300));
  };
  las(rev);
  if (!ut.length) return tomt("Inga kundomdömen fanns i sajtens strukturerade data.");
  return funnet(ut.slice(0, 8), "schema", nodUrl, { citat: `${ut.length} omdömen i schema`, sakerhet: "hog" });
}
