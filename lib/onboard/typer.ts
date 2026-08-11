// ONBOARD-1 — automatisk provisionering av nya MySales Pro-kunder.
// ENDA indata är kundens webbadress. Allt annat härleds därifrån.
//
// ★ BÄRANDE REGEL I HELA MODULEN: ett fält utan belagd källa är TOMT, aldrig gissat.
//
// Därför finns `Falt<T>`. Ett fält är inte ett värde — det är ett värde PLUS beviset för
// var det kom ifrån. Utan den kopplingen går det inte att skilja "vi läste detta på
// kundens kontaktsida" från "modellen skrev något som lät rimligt". Granskningsvyn visar
// `kalla` och `citat` bredvid varje rad, så Håkan ser skillnaden innan han godkänner.
//
// Jämför [[lesson_modellen_ekar_prompten_som_svar]]: utdata som går rakt in i ett fält
// eller en databas måste grindas. Här är grinden typad — ett värde utan källa går inte
// ens att uttrycka.

/** Var ett värde kommer ifrån. Ordningen speglar hur mycket vi litar på det. */
export type Kalltyp =
  /** Läst ur strukturerad data på sajten (JSON-LD Organization/LocalBusiness). Starkast. */
  | "schema"
  /** Läst ordagrant ur sajtens HTML eller text (telefonlänk, adressrad, prislista). */
  | "sajt"
  /** Hämtat från Google Business Profile. */
  | "gbp"
  /** Härlett av AI ur sajtens texter. Kräver alltid ett ordagrant citat som belägg. */
  | "harlett"
  /** Håkan har skrivit eller ändrat värdet i granskningsvyn. Vinner alltid. */
  | "manuell"
  /** Fast standardvärde ur vår egen konfiguration (land, tidszon). */
  | "standard";

// ── ONBOARD-2: KLASSEN ÄR DET HÅKAN GRANSKAR PÅ ──────────────────────────────
//
// Källtypen säger VAR värdet kom ifrån. Klassen säger HUR MYCKET tolkning som ligger
// mellan källan och värdet — och det är den frågan granskningen faktiskt handlar om.
// Direkta fält ögnas igenom. Belagda tolkningar är där felen sitter.
//
//   DIREKT           värdet står ordagrant i källan (telefon, adress, pris, öppettid)
//   BELAGD_TOLKNING  värdet är utläst ur källtexten och bär citat som stöder det
//                    (tonläge, målgrupp, smärtpunkter, USP). Tillåtet och önskvärt.
//   STANDARD         inget belägg alls. Endast tillåtet för GHL:s obligatoriska fält.
export type Klass = "direkt" | "belagd_tolkning" | "standard" | "manuell";

export function klassAv(kalla: Kalltyp | null): Klass | null {
  if (!kalla) return null;
  switch (kalla) {
    case "schema":
    case "sajt":
    case "gbp":
      return "direkt";
    case "harlett":
      return "belagd_tolkning";
    case "standard":
      return "standard";
    case "manuell":
      return "manuell";
  }
}

/**
 * ★ DE ENDA FÄLT SOM FÅR VARA `standard`.
 *
 * Regeln är inte estetisk. Ett standardvärde är ett värde utan belägg, och ett värde utan
 * belägg som ser ut som ett svar blir aldrig kontrollerat av någon. Undantaget finns bara
 * för att GHL vägrar skapa sub-accountet utan dem:
 *
 *   land     — POST /locations/ kräver `country`. Utan värde: HTTP 422, inget konto skapas.
 *   tidszon  — POST /locations/ kräver `timezone`. Samma sak.
 *
 * ⚠ Lägg ALDRIG till ett fält här utan att skriva ut i klartext varför GHL kräver det för
 * att kunna skapa kontot. Färg, bransch och tagline hör INTE hit — GHL skapar kontot utan
 * dem, alltså ska de lämnas tomma och flaggas när de inte går att belägga.
 */
export const STANDARD_TILLATNA = ["land", "tidszon"] as const;
export type StandardTillaten = (typeof STANDARD_TILLATNA)[number];

export const arStandardTillaten = (falt: string): falt is StandardTillaten =>
  (STANDARD_TILLATNA as readonly string[]).includes(falt);

/**
 * Två källor som säger olika saker om samma fält.
 *
 * Motorn får ALDRIG välja tyst mellan dem. Verkligt fall: forbalance.se anger kursen
 * "Lugnets väg" till 6 100 kr i brödtexten och 6 900 kr i prisfältet, på samma sida.
 * Vilket som är rätt kan bara kunden svara på — så båda visas och Håkan väljer aktivt.
 */
export interface Konflikt<T = unknown> {
  varde: T;
  kalla: Kalltyp;
  kallUrl: string | null;
  citat: string | null;
}

/** Ett värde med sitt ursprung. `null` i `varde` = vi hittade det inte. */
export interface Falt<T = string> {
  varde: T | null;
  kalla: Kalltyp | null;
  /** URL:en värdet lästes på. Null för standard-värden och manuella ändringar. */
  kallUrl: string | null;
  /**
   * Ifylld när flera källor gav OLIKA värden. Då är `varde` bara den hittills högst
   * prioriterade kandidaten — inte ett svar. Granskningsvyn kräver ett aktivt val.
   */
  konflikt?: Konflikt<T>[] | null;
  /**
   * Ordagrant utdrag ur källan som belägger värdet. OBLIGATORISKT för `harlett`.
   * Utan citat går ett härlett fält inte att kontrollera — och då ska det inte visas
   * som ett svar.
   */
  citat: string | null;
  /**
   * ONBOARD-3: fritext som KVALIFICERAR värdet och måste resa med det.
   *
   * Gittes Bokadirekt-sida anger öppettider måndag till fredag, men bredvid står
   * "Måndagar och Fredagar är kontorsdagar så då når du mig på telefon". Levereras
   * siffrorna utan det förbehållet bokas kunder in på dagar hon inte tar emot — och
   * resultatet är värre än inget, eftersom det ser rätt ut.
   *
   * Regeln är generell: ett fritextfält som modifierar strukturerad data får aldrig
   * skiljas från den. Förbehållet visas alltid intill värdet i granskningsvyn.
   */
  forbehall?: string | null;
  /**
   * ONBOARD-3: värdet är belagt men KÄNT ofullständigt, och skälet står här.
   *
   * Skiljer sig från `saknasVarfor`, som förklarar varför ett fält är TOMT. Det här
   * förklarar varför ett IFYLLT fält ändå inte är hela sanningen — t.ex. att kundcitaten
   * bara är kurerade femstjärniga omdömen, alltså språket för hur det känns EFTERÅT,
   * medan orden folk använder om sitt problem INNAN de köper saknas helt.
   *
   * Texten blir en fråga till kunden i kompletteringslistan (ONBOARD-6).
   */
  partiellt?: string | null;
  /** Hur säkra vi är. Låg säkerhet visas med varning i granskningsvyn. */
  sakerhet: "hog" | "medel" | "lag" | null;
  /** Klartext på svenska när värdet SAKNAS. Visas i granskningsvyn i stället för tomhet. */
  saknasVarfor: string | null;
}

/**
 * ★ TREDJE UTFALLET: källan såg inte ut som vi trodde.
 *
 * Ett tomt fält kan ha två helt olika orsaker, och de får aldrig se likadana ut:
 *
 *   A. Källan saknar uppgiften.       Ärligt. Det är vad "belägg eller tomt" handlar om.
 *   B. Vi läste fel nyckel, eller     Ett KODFEL som ser ut som A.
 *      källans struktur har ändrats.
 *
 * Verkligt fall: Bokadirekt-parsern läste `tjanst.description`, men fältet heter
 * `tjanst.about.description`. Inget kastades, inget loggades — beskrivningarna blev bara
 * tomma strängar. Sista anmälningsdag, deltagartak och hela prisonflikten i Lugnets väg
 * försvann tyst, och resultatet såg ut som att Bokadirekt saknade uppgifterna.
 *
 * Bokadirekt kan byta fältnamn när som helst. Utan den här kontrollen tystnar parsern och
 * vi levererar tunna profiler i veckor utan att någon märker något. Därför: när en parser
 * läser ett nästlat objekt ska den KONTROLLERA att den förväntade formen finns, och kasta
 * det här felet när den inte gör det. Ett hårt fel är billigt. Tyst tomhet är det inte.
 */
export class KallstrukturFel extends Error {
  readonly kalla: string;
  readonly forvantat: string;
  constructor(kalla: string, forvantat: string, sett: string) {
    super(
      `${kalla} såg inte ut som väntat. Förväntade ${forvantat}, men fann ${sett}. ` +
        `Källans struktur har troligen ändrats — parsern måste uppdateras. ` +
        `Inga fält fylls från den här källan, eftersom ett tomt fält annars hade sett ut som att uppgiften saknades.`,
    );
    this.name = "KallstrukturFel";
    this.kalla = kalla;
    this.forvantat = forvantat;
  }
}

/**
 * Kontrollerar att en förväntad form finns innan den läses. Kastar `KallstrukturFel`
 * annars. Använd i VARJE parser som når ner i ett nästlat objekt.
 */
export function kravForm(villkor: boolean, kalla: string, forvantat: string, sett: string): void {
  if (!villkor) throw new KallstrukturFel(kalla, forvantat, sett);
}

/** Ett fält vi inte lyckades fylla. Bär alltid en läsbar förklaring. */
export function tomt<T = string>(varfor: string): Falt<T> {
  return { varde: null, kalla: null, kallUrl: null, konflikt: null, citat: null, sakerhet: null, saknasVarfor: varfor };
}

/** Ett fält vi läste direkt ur en källa. */
export function funnet<T = string>(
  varde: T,
  kalla: Kalltyp,
  kallUrl: string | null,
  opts?: { citat?: string | null; sakerhet?: "hog" | "medel" | "lag" },
): Falt<T> {
  return {
    varde,
    kalla,
    kallUrl,
    konflikt: null,
    citat: opts?.citat ?? null,
    sakerhet: opts?.sakerhet ?? (kalla === "schema" ? "hog" : "medel"),
    saknasVarfor: null,
  };
}

/**
 * Markerar att flera källor gav olika värden. Vinnaren enligt källprioritet behålls som
 * `varde`, men fältet bär nu alla kandidater och räknas som "kräver aktivt val".
 */
export function medKonflikt<T>(vinnare: Falt<T>, kandidater: Konflikt<T>[]): Falt<T> {
  if (kandidater.length < 2) return vinnare;
  return { ...vinnare, konflikt: kandidater, sakerhet: "lag" };
}

/**
 * Sant när fältet inte får levereras som ett svar utan att Håkan tittat på det.
 *
 * Tre skäl, alla lika bindande:
 *   1. Källorna säger emot varandra.
 *   2. Säkerheten är låg — låg säkerhet accepteras ALDRIG tyst.
 *   3. Fältet är `standard` utan att stå på undantagslistan (ska aldrig hända; grinden
 *      i `index.ts` fångar det, men kontrollen finns här också så UI:t inte kan missa det).
 */
export function kravsGranskning<T>(falt: Falt<T> | null | undefined, faltNamn?: string): boolean {
  if (!falt) return false;
  if (falt.konflikt && falt.konflikt.length > 1) return true;
  if (falt.sakerhet === "lag" && harVarde(falt)) return true;
  if (falt.kalla === "standard" && faltNamn && !arStandardTillaten(faltNamn)) return true;
  return false;
}

/** True när fältet faktiskt bär ett värde (tom sträng och tom lista räknas som saknat). */
export function harVarde<T>(f: Falt<T> | undefined | null): boolean {
  if (!f || f.varde == null) return false;
  if (typeof f.varde === "string") return f.varde.trim().length > 0;
  if (Array.isArray(f.varde)) return f.varde.length > 0;
  return true;
}

// ── Skrapning ────────────────────────────────────────────────────────────────

/** Hur en sida faktiskt hämtades. Avgör vad vi vågar påstå om sajten. */
export type HamtVag =
  /** Vanlig HTTP-hämtning gav läsbart innehåll. */
  | "direkt"
  /** Sidan är JS-renderad eller blockerade oss — innehållet kom via renderingstjänst. */
  | "rendering";

export interface OnboardSida {
  url: string;
  /** Rå HTML. Null när sidan kom via renderingstjänsten (då finns bara text). */
  html: string | null;
  /** Läsbar text, alltid ifylld när sidan lyckades. */
  text: string;
  via: HamtVag;
  /** Vilken roll sidan spelar: startsida, kontakt, tjänster, priser, om, omdömen. */
  roll: SidRoll;
}

export type SidRoll = "start" | "kontakt" | "tjanster" | "priser" | "om" | "omdomen" | "ovrig";

/** En sida som INTE gick att läsa. Bevaras — tomma fält måste kunna förklaras. */
export interface OnboardMiss {
  url: string;
  status: number | null;
  orsak: string;
}

export interface SkrapResultat {
  /** Startsidans slutliga URL efter redirects och www-normalisering. */
  rotUrl: string;
  origin: string;
  sidor: OnboardSida[];
  missar: OnboardMiss[];
  /** True när minst en sida behövde renderingstjänsten — sajten är JS-driven eller blockerar. */
  behovdeRendering: boolean;
  /** Sant fel: ingen enda sida gick att läsa. Då får inget förslag levereras. */
  totaltMisslyckad: boolean;
  /** Klartext till Håkan när skrapningen gick dåligt. Null när allt gick bra. */
  varning: string | null;
}

// ── Förslaget ────────────────────────────────────────────────────────────────

export interface Oppettid {
  dag: string;
  tider: string;
}

/**
 * ONBOARD-3 — kurs, workshop eller kursstart med ett datum.
 *
 * ★ EGEN HINK, INTE SKRÄP. Markupförankringen som håller kursdatum borta från
 *   öppettiderna gjorde först att de kastades helt. Men för den här kundtypen är de
 *   det VÄRDEFULLASTE underlaget som finns: de är tidsbegränsade, har sista
 *   anmälningsdag och skapar därmed en anledning att höra av sig just nu.
 *
 *   Gitte har två kursstarter i september med sista anmälningsdag 8 september. Att
 *   filtrera bort dem hade tagit bort det enda i hela profilen som har en deadline.
 */
export interface Evenemang {
  namn: string;
  /** Datum som det STÅR på sidan ("15 september", "2026-09-15"). Aldrig omtolkat. */
  datum: string | null;
  sistaAnmalan: string | null;
  tid: string | null;
  plats: string | null;
  pris: string | null;
  /** Fritext om antal tillfällen, deltagartak, friskvårdsbidrag och liknande villkor. */
  villkor: string | null;
  /**
   * ★ Ett passerat tillfälle får ALDRIG levereras som kommande.
   *
   * Gittes Qigong-dag annonseras med datumet 7 juni, alltså ett tillfälle som varit. Att
   * skicka in det i en kundprofil som "kommande kurs" ger innehåll som marknadsför något
   * som inte finns, och det upptäcks först av kunden som klickar.
   *
   * `okant` när året inte står utskrivet och datumet är tvetydigt. Vi GISSAR aldrig fram
   * ett år — ett datum utan år som redan passerat i år kan lika gärna vara nästa år, och
   * att välja åt kunden vore samma sorts tysta beslut som konfliktflaggan finns för.
   */
  status: "kommande" | "passerat" | "okant";
}

export interface Tjanst {
  namn: string;
  /** Pris som det STÅR på sajten, ordagrant ("1 445 kr", "från 900 kr/tim"). Aldrig omräknat. */
  pris: string | null;
  /**
   * ONBOARD-2: sajten angav FLERA olika priser för samma tjänst.
   *
   * Verkligt fall: forbalance.se anger kursen "Lugnets väg" till 6 100 kr i brödtexten och
   * 6 900 kr i prisfältet — på samma sida. Tidigare behöll motorn tyst det första den såg.
   * Nu bärs alla varianter hit och Håkan måste välja aktivt.
   */
  prisalternativ?: { pris: string; kallUrl: string; citat: string }[] | null;
}

/**
 * Det ifyllda förslaget Håkan granskar. Varje fält bär sin källa.
 * Fälten är valda för att matcha `hm_brand_profile` + `clients` + GHL:s sub-account-fält,
 * så att godkännandet kan skrivas rakt in utan mellanöversättning.
 */
export interface Forslag {
  // Företagsfakta → clients + GHL location
  foretagsnamn: Falt;
  kontaktperson: Falt;
  epost: Falt;
  telefon: Falt;
  adress: Falt;
  postnummer: Falt;
  ort: Falt;
  land: Falt;
  tidszon: Falt;
  hemsida: Falt;

  // Profil → hm_brand_profile
  bransch: Falt;
  tagline: Falt;
  malgruppPrimar: Falt;
  malgruppSekundar: Falt;
  smartpunkter: Falt<string[]>;
  tonlage: Falt;
  erbjudanden: Falt<Tjanst[]>;
  kundcitat: Falt<string[]>;
  usp: Falt;

  /** ONBOARD-3: kurser och workshops med datum. Tidsbegränsat = bästa innehållsunderlaget. */
  evenemang: Falt<Evenemang[]>;

  // Övrigt från sajten
  oppettider: Falt<Oppettid[]>;
  /**
   * ONBOARD-3: bokningsplattformens profilsida (Bokadirekt). Går som custom value till
   * GHL — det är länken kunden klistrar in i DM och mejl, inte ett internt fält.
   */
  bokningslank: Falt;
  socialaLankar: Falt<Record<string, string>>;
  logotyp: Falt;
  fargpalett: Falt<string[]>;

  // Google Business Profile
  gbpKategori: Falt;
  gbpBetyg: Falt<number>;
  gbpAntalRecensioner: Falt<number>;
}

/** Nycklarna i `Forslag`, för generisk iterering i UI och validering. */
export type ForslagNyckel = keyof Forslag;

/** Ett komplett analysresultat: förslaget plus beviset för hur det togs fram. */
export interface Analys {
  forslag: Forslag;
  skrap: {
    rotUrl: string;
    lastaSidor: { url: string; roll: SidRoll; via: HamtVag; tecken: number }[];
    missar: OnboardMiss[];
    behovdeRendering: boolean;
    varning: string | null;
  };
  /** Fält som lämnades tomma, med förklaring. Visas samlat överst i granskningsvyn. */
  saknade: { falt: ForslagNyckel; varfor: string }[];
  /**
   * ONBOARD-2: fält som bär ett värde men INTE får godkännas passivt — källorna säger
   * emot varandra, eller säkerheten är låg. Låg säkerhet accepteras aldrig tyst.
   */
  granskas: { falt: ForslagNyckel; varfor: string }[];
}
