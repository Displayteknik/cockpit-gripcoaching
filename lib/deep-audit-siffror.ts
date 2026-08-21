// SIFFERGRINDEN MED KÄLLKLASSER — RAPPORT-1 R-5 (Håkans granskning 13/8).
//
// ★ GRINDEN VAR RÄTT IDÉ MED FEL TRÖSKEL.
//
//   Första versionen maskade 30 tal i DT-rapporten och gjorde klistra-in-texterna
//   opublicerbara. "En vanlig TV har [DIN SIFFRA]-[DIN SIFFRA] nits" stod till och med i
//   ordlistan. Samtidigt stod samma tal OMASKADE i åtgärdsinstruktionerna, eftersom
//   grinden bara kördes på klistra-in-delen. Fyra fel, alla med samma rot: ett tal
//   behandlades som ett tal, oavsett var det kom ifrån.
//
//   Nu klassas varje tal FÖRST, och klassen avgör behandlingen:
//
//     KLASS T (tenant)      priser, egna specar, kundresultat, leveransdetaljer.
//                           Kräver täckning i profil eller crawlad sajttext, annars lucka.
//     KLASS B (branschfakta) standardnummer (IEC 60529), typiska intervall (TV 300-400
//                           nits), fysik. Hämtas ur profilens kunskapsfält, annars skrivs
//                           de ut MÄRKTA som riktvärde. Maskas ALDRIG.
//     KLASS G (Google)      GSC-tal: visningar, klick, position. Alltid källbelagda.
//                           Maskas ALDRIG. I dagens rapport maskades 189 och position 20
//                           trots att samma tal stod i klartext högre upp i dokumentet.
//
//   ETT beslut per tal, för HELA rapporten. Beslutstabellen loggas så varje utfall går att
//   stickprova mot klass och källa.

import { talTokenForKalla } from "@/lib/deep-audit-granska";

//   R-5b (Håkans granskning av Makzy-rapporten 14/8) lade till en fjärde klass och ett
//   undantag. Se `arStrukturtal`, `arSeoFakta` och `arCrawlMatvarde` längre ned:
//
//     KLASS C (crawlen)     våra EGNA mätvärden om sajten: bildantal, ordantal, interna
//                           länkar, titellängd. Alltid belagda — grinden får aldrig maska
//                           det vi själva räknat fram.
//     STRUKTURTAL           list-, rubrik- och tabellnumrering, FAQ-nummer och datum.
//                           Undantas HELT: ingen maskering, ingen rad i beslutstabellen.

export type Sifferklass = "T" | "B" | "G" | "C";
export type Sifferutfall = "belagt" | "riktvarde" | "lucka";

export interface Sifferbeslut {
  /** Talet så som det står i texten, med tusentalsmellanslag och decimaltecken. */
  tal: string;
  klass: Sifferklass;
  utfall: Sifferutfall;
  /** Var täckningen kom ifrån, eller vad som saknas. */
  kalla: string;
  /** Meningen talet står i, så en lucka går att fylla i. */
  mening: string;
  /** Rubriken närmast ovanför, så luckan går att hitta. */
  sektion: string;
}

// ── Talmönster ───────────────────────────────────────────────────────────────
//
// ⚠ PARSNINGSBUGGEN SOM GJORDE "Från 45 000 kr" TILL "Från [DIN SIFFRA] 000 kr":
//   det gamla mönstret matchade "45" och lämnade "000" kvar. Ett tal med
//   tusentalsmellanslag, decimalkomma eller decimalpunkt är EN enhet, och ett intervall
//   är EN enhet. Ordningen i regexen är därför intervall först, sedan sammansatt tal.

/** Ett tal: 45 000 · 2 500,50 · 19.8 · 300. Tusentalsavgränsare bara mellan siffergrupper. */
// ⚠ Ett tal som sitter FAST i ett ord är inget påstående om storlek. Utan lookaround blev
//   plattformsnamnet "Hemsida24" till "Hemsida[DIN SIFFRA]" och klassningen "IP66" till
//   "IP[DIN SIFFRA]". Bokstav före eller efter = talet är del av ett namn, en standard
//   eller en produktbeteckning, aldrig en uppgift kunden ska fylla i.
const TAL = String.raw`(?<![\p{L}\d])(?:\d{1,3}(?:[  ]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?)(?![\p{L}\d])`;
/** Ett intervall: 2500-3500 · 50 000-100 000 · 10–20. Behandlas ALLTID som en helhet. */
const INTERVALL = new RegExp(String.raw`(${TAL})\s*[-–—]\s*(${TAL})`, "gu");
const ENSKILT = new RegExp(TAL, "gu");

/** Normaliserar ett tal till jämförbar form: "45 000" och "45000" är samma tal. */
export function talNyckel(tal: string): string {
  return tal.replace(/[\s .,]/g, "");
}

// ── Klassning ────────────────────────────────────────────────────────────────

/** Standarder och fysik som aldrig är tenantens egna uppgifter. */
const BRANSCHMONSTER = [
  /\bIEC\s*\d+/i, /\bIP\s?\d{2}\b/i, /\bEN\s*\d{3,}/i, /\bISO\s*\d+/i,
  /\bnits\b/i, /\bcd\/m/i, /\bkelvin\b/i, /\bhz\b/i, /\btimmars? livsläng/i,
  /\bpixel pitch\b/i, /\bP\d\b/, /\blumen\b/i, /\bwatt\b/i, /\bgrader\b/i,
];

/** Ord som gör talet till Googles data. */
const GSC_MONSTER = [
  /\bvisning/i, /\bimpression/i, /\bklick\b/i, /\bposition\b/i, /\bCTR\b/i,
  /\bsöktermen?\b/i, /\bsökord\b/i, /\bsida 2\b/i, /\brankar\b/i,
];

/** Ord som gör talet till tenantens eget. */
const TENANT_MONSTER = [
  /\bkr\b/i, /\bkronor\b/i, /\bpris/i, /\bkostar\b/i, /\bfrån\b/i, /\bmoms\b/i,
  /\bvi har\b/i, /\bvåra\b/i, /\bkunder\b/i, /\blevererat\b/i, /\bsedan \d{4}\b/i,
  /\bår i branschen\b/i, /\banställda\b/i, /\bprojekt\b/i,
];

/**
 * Telefonnummer, organisationsnummer och datum är inga påståenden om storlek.
 *
 * ⚠ MÄTT: DT-rapportens kundcitat innehöll telefonnumret 072 541 01 02, och grinden
 * maskade "72 541" mitt i det. Ett maskat telefonnummer i ett kundcitat är både fel och
 * pinsamt.
 */
const EJ_PASTAENDE: { monster: RegExp; skal: string }[] = [
  { monster: /0\d{1,3}[-\s]?\d{2,3}\s?\d{2}\s?\d{2}/, skal: "telefonnummer" },
  { monster: /\d{6}-\d{4}/, skal: "person- eller organisationsnummer" },
  { monster: /(19|20)\d{2}-\d{2}-\d{2}/, skal: "datum" },
  { monster: /\+46\s?\d/, skal: "telefonnummer med landsnummer" },
  // ⚠ MÄTT PÅ DEN OMKÖRDA MAKZY-RAPPORTEN 15/8: "Husby, 602 95 Norrköping" gav TVÅ luckor.
  //   Ett postnummer är lika lite ett påstående om storlek som telefonnumret bredvid det —
  //   och att be kunden fylla i sitt eget postnummer är samma sorts pinsamhet.
  { monster: /\b\d{3}\s?\d{2}\s+[A-ZÅÄÖ][a-zåäöA-ZÅÄÖ]/, skal: "postnummer" },
  // Rapportens EGNA tidsuppskattningar i åtgärdsstegen: "→ ~4 timmar", "**Tid:** ~30 min".
  // Tildet är rapportens formatering och förekommer aldrig i kundens egen text — därför
  // är den, och bara den, signalen. "Första mötet tar cirka 30 minuter" är ett påstående
  // om verksamheten och grindas som vanligt.
  { monster: /~\s?\d+(?:[.,]\d+)?\s*(min|minut|minuter|timm|tim\b|h\b|dag|dagar|vecka|veckor|månad)/i,
    skal: "rapportens egen tidsuppskattning för åtgärden" },
];

/** Varför talet inte är ett påstående om storlek — eller null när det är det. */
export function ejPastaendeSkal(kontext: string): string | null {
  return EJ_PASTAENDE.find((m) => m.monster.test(kontext))?.skal ?? null;
}

export function arEjPastaende(kontext: string): boolean {
  return ejPastaendeSkal(kontext) !== null;
}

// ── R-5b · STRUKTURTAL ───────────────────────────────────────────────────────
//
// ★ MÄTT PÅ DEN SKARPA MAKZY-RAPPORTEN (asset 45bf59c4, 14/8): SEX luckor, och FEM av dem
//   var numrering. Talet "4" stod först i en rubrik ("## 4. Inga kundcitat …"), fick
//   utfallet lucka där, och eftersom beslutet gäller per TAL för hela rapporten maskades
//   sedan varje fyra i dokumentet:
//
//     "## 4. Inga kundcitat …"                  → "## [DIN SIFFRA]. Inga kundcitat …"
//     "**Fråga 4:**" / "**Svar 4:**"            → "**Fråga [DIN SIFFRA]:**"
//     "leveranstiden är vanligtvis 4 veckor"    → maskad (den ENDA av dem som var ett
//                                                 påstående, och alltså rätt maskad)
//
//   Konsekvenskravet — ett beslut per tal — är rätt, men det gör en enda felklassning till
//   ett fel över hela dokumentet. Numrering är inte ett påstående om storlek och ska
//   därför aldrig ens få ett beslut: den hoppas över på PLATSEN, så ett tal som är
//   numrering här och en uppgift där behandlas rätt på båda ställena.
//
// Datum räknas hit av samma skäl. `EJ_PASTAENDE` gav dem redan utfallet "belagt", men de
// tog plats som rader i beslutstabellen ("2026" och "08" ur `**Datum:** 2026-08-14`), och
// en tabell man ska stickprova får inte bestå av brus.

const MANADER = "januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december";

/**
 * Hela datum. Ett datum är aldrig en uppgift kunden ska fylla i.
 *
 * ⚠ MÄTT UNDER BYGGET: den lösa formen `\d{1,2}/\d{1,2}` läste "78/72" i sidtabellen
 *   (SEO- och AEO-poäng) som ett datum, och då blev HELA raden undantagen — fem mätvärden
 *   försvann ur beslutstabellen på en gång. Snedstrecksdatum kräver därför årtal, och
 *   undantaget gäller bara talen som ligger INUTI datumet, aldrig resten av raden.
 */
const DATUM = [
  /(19|20)\d{2}-\d{2}-\d{2}/g,
  new RegExp(String.raw`\b\d{1,2}\s+(${MANADER})(\s+\d{4})?\b`, "gi"),
  /\b\d{1,2}\/\d{1,2}\s+(19|20)\d{2}\b/g,
];

/** Ligger positionen inuti ett datum på raden? */
function iDatum(rad: string, iRaden: number): boolean {
  for (const d of DATUM) {
    d.lastIndex = 0;
    for (const m of rad.matchAll(d)) {
      if (m.index == null) continue;
      if (iRaden >= m.index && iRaden < m.index + m[0].length) return true;
    }
  }
  return false;
}

/** Raden ett tal står på, plus talets position i den raden. */
export function radRunt(text: string, index: number): { rad: string; iRaden: number } {
  const start = text.lastIndexOf("\n", index - 1) + 1;
  const slut = text.indexOf("\n", index);
  return { rad: text.slice(start, slut === -1 ? text.length : slut), iRaden: index - start };
}

/**
 * Är talet på den här platsen ren numrering?
 *
 * Bedömningen är POSITIONSBEROENDE med flit: femman i "## 5. 51 bilder saknar alt-text" är
 * rubriknumrering, 51 i samma rubrik är ett mätvärde. En regel som bara tittar på raden
 * hade tagit båda.
 */
export function arStrukturtal(rad: string, iRaden: number, tal: string): boolean {
  // 1. Talet är en del av ett datum ("**Datum:** 2026-08-14", "14 augusti 2026").
  if (iDatum(rad, iRaden)) return true;

  // 2. Punkt- och rubriknumrering: "1. ", "  2) ", "### 3. ", "#### 2.1 ".
  const numrering = rad.match(/^(\s*(?:[-*+]\s+)?|#{1,6}\s+)(\d+(?:\.\d+)*)[.)]?\s/);
  if (numrering) {
    const start = numrering[1].length;
    if (iRaden >= start && iRaden < start + numrering[2].length) return true;
  }

  // 3. Namngiven numrering: "**Fråga 4:**", "Steg 2", "Post 7".
  //    ALLA förekomster prövas, inte bara den första: "## Steg 2, vecka 2-3" har två tvåor
  //    på samma rad, och bara den ena är numrering. Orden är få med flit — "Vecka 36-43"
  //    är en kursperiod hos en kund, alltså innehåll, och står därför inte i listan.
  for (const m of rad.matchAll(/(?:^|[\s*(])(?:Fråga|Svar|Steg|Punkt|Post|Rad|Nr)\s*\*{0,2}\s*(\d+)/gi)) {
    if (m.index == null) continue;
    const start = m.index + m[0].length - m[1].length;
    if (iRaden >= start && iRaden < start + m[1].length) return true;
  }

  // 4. Tabellens radnummer: första cellen, och cellen innehåller BARA talet.
  //    "| 7 | Så här mäter du … |" är numrering; "| 59 tecken | … |" är ett mätvärde.
  if (rad.trimStart().startsWith("|")) {
    const forstaSlut = rad.indexOf("|", rad.indexOf("|") + 1);
    const cell = forstaSlut === -1 ? "" : rad.slice(rad.indexOf("|") + 1, forstaSlut);
    if (cell.trim() === tal.trim() && iRaden < forstaSlut) return true;
  }

  return false;
}

// ── R-5b · GENERISK SEO-FAKTA ────────────────────────────────────────────────
//
// ★ MÄTT PÅ MAKZY-RAPPORTEN: "Meta-beskrivning … max cirka 150-160 tecken" blev
//   "max cirka [DIN SIFFRA] tecken" i ordlistan. 150 och 160 är inte Makzys uppgifter,
//   de är Googles gränser — samma sorts allmängods som IP-klassning och nits, alltså
//   klass B. Och eftersom beslutet gäller per tal maskades DESSUTOM "över 150 tyger i
//   provurvalet" längre ned i samma rapport.
//
// Listan är AVSIKTLIGT kort och namngiven. En bred regel ("allt som står nära ordet SEO
// är fakta") hade släppt igenom tenantens egna siffror i samma andetag.

const SEO_TERMER = /meta-?beskrivning|metabeskrivning|meta description|titel(tagg|n|rad)?|title|snippet|alt-?text|h1|h2|laddtid|LCP|INP|CLS|core web vitals|statuskod|redirect|omdirigering|sitemap|robots|tunn(a|t)? (sid|innehåll)|texttäthet|ordantal|tecken\b|ord\b/i;

/** Kända gränsvärden i SEO-världen. Talet ska stå i sällskap med sin egen term. */
const SEO_FAKTA: { term: RegExp; tal: string[]; vad: string }[] = [
  { term: /meta-?beskrivning|metabeskrivning|meta description|snippet/i, tal: ["120", "150", "155", "160", "165"], vad: "Googles längd på meta-beskrivningen" },
  { term: /titel|title/i, tal: ["50", "55", "60", "65", "70"], vad: "Googles längd på sidtiteln" },
  { term: /alt-?text/i, tal: ["125"], vad: "rekommenderad längd på alt-text" },
  { term: /laddtid|LCP|core web vitals/i, tal: ["2.5", "2,5", "4"], vad: "Googles gräns för LCP i sekunder" },
  { term: /INP|core web vitals/i, tal: ["200", "500"], vad: "Googles gräns för INP i millisekunder" },
  { term: /CLS|core web vitals/i, tal: ["0.1", "0,1", "0.25", "0,25"], vad: "Googles gräns för CLS" },
  { term: /statuskod|redirect|omdirigering|felkod/i, tal: ["200", "301", "302", "307", "404", "410", "500", "503"], vad: "HTTP-statuskod" },
  { term: /sitemap/i, tal: ["50000", "50 000"], vad: "sitemapens tak för antal adresser" },
  { term: /h1|h2|rubrik/i, tal: ["1"], vad: "en H1 per sida" },
  { term: /tunn(a|t)? (sid|innehåll)|texttäthet|ordantal/i, tal: ["300"], vad: "vanlig tumregel för tunt innehåll" },
];

/** Generisk SEO-fakta: allmängods som gäller alla sajter, aldrig tenantens egen uppgift. */
export function arSeoFakta(kontext: string, tal: string): string | null {
  if (!SEO_TERMER.test(kontext)) return null;
  const nyckel = talNyckel(tal);
  for (const f of SEO_FAKTA) {
    if (!f.term.test(kontext)) continue;
    if (f.tal.some((t) => talNyckel(t) === nyckel)) return f.vad;
  }
  return null;
}

// ── R-5b · CRAWLENS EGNA MÄTVÄRDEN ───────────────────────────────────────────
//
// ★ MÄTT PÅ MAKZY-RAPPORTEN: "51 av 58 bilder saknar beskrivning" blev "51 av [DIN SIFFRA]
//   bilder". Femtioettan råkade finnas i crawl-JSON:en och slapp igenom; femtioåttan gjorde
//   det inte, eftersom modellen räknade fram totalen själv. Att be kunden fylla i hur många
//   bilder hennes sajt har är att be henne kontrollera vår egen mätning.
//
// Talet passerar därför när meningen handlar om något VI räknat på sajten. Det är en
// medveten uppmjukning: en modell kan räkna fel, men ett fel mätvärde är ett fel vi ska
// hitta i crawlen, inte en lucka vi lägger på kunden.

const CRAWL_MATVARDEN = [
  /\bbilder?\b/i, /\balt-?text/i, /\bord\b/i, /\bordantal\b/i, /\btexttäthet/i,
  /\binterna länkar?\b/i, /\blänkar? per sida\b/i, /\bsid(a|an|or|orna)\b/i, /\brubrik(er)?\b/i,
  /\bH1\b/i, /\bH2\b/i, /\btecken\b/i, /\bmeta-?beskrivning/i, /\btitel/i,
  /\bsitemap\b/i, /\badresser\b/i, /\bschema(typer)?\b/i, /\bindexerade?\b/i,
];

/**
 * Mätte VI det här på kundens sajt? Då är talet belagt per definition.
 *
 * Anropas BARA när meningen saknar tenant-markör (`arTenantTal`). Annars hade "våra priser
 * börjar från 500 kr per sida" räknats som vår mätning, för att ordet "sida" står där.
 */
export function arCrawlMatvarde(kontext: string): boolean {
  return CRAWL_MATVARDEN.some((m) => m.test(kontext));
}

/** Sa meningen UTTRYCKLIGEN att talet är tenantens eget? (T-klassens default räknas inte.) */
export function arTenantTal(kontext: string): boolean {
  return TENANT_MONSTER.some((m) => m.test(kontext));
}

/**
 * ⚠ KLASSNINGEN LÄSER TALETS EGEN MENING, inte ett tecken-fönster runt det.
 *
 * Med ±70 tecken drog "Priset är 45 000 kr" in ordet "kr" i grannmeningen, och
 * "En TV har 300-400 nits" klassades som tenantens pris i stället för branschfakta.
 * En mening är den minsta enhet där ett tal faktiskt betyder något.
 */

/**
 * Klassar ett tal på sitt sammanhang.
 *
 * Ordningen är medveten: Google först (den är entydig), sedan tenant (pris slår
 * branschfakta: "vår panel kostar 45 000" är ingen branschstandard), sedan bransch.
 */
export function klassaTal(kontext: string): Sifferklass {
  if (GSC_MONSTER.some((m) => m.test(kontext))) return "G";
  if (TENANT_MONSTER.some((m) => m.test(kontext))) return "T";
  if (BRANSCHMONSTER.some((m) => m.test(kontext))) return "B";
  return "T"; // okänt sammanhang behandlas som tenantens eget, alltså strängast
}

// ── Sektioner och meningar, så en lucka går att hitta ────────────────────────

/**
 * Styrtecken som aldrig får nå databasen.
 *
 * ⚠ MÄTT PÅ DEN SKARPA KÖRNINGEN 13/8: maskeringsmarkören hamnade i beslutens `mening`,
 *   Postgres vägrar lagra NUL i text, och HELA sparningen föll TYST. Raden stod kvar som
 *   `processing`, finaliseringen körde om samma rapport var 30:e sekund, och rapporten
 *   blev aldrig klar. En sparning utan felkontroll är en sparning man inte vet något om.
 */
const STYRTECKEN = new RegExp("[\\u0000-\\u001f\\u007f]", "g");

export function sektionFor(md: string, index: number): string {
  const fore = md.slice(0, index);
  const rubriker = fore.match(/^#{1,3} .+$/gm);
  return rubriker?.length ? rubriker[rubriker.length - 1].replace(/^#+\s*/, "").trim() : "(inledningen)";
}

/** Meningen ett tal står i, läst ur den sträng som faktiskt skannas. */
export function meningRunt(text: string, index: number, langd: number): string {
  const NY_RAD = "\n";
  const start = Math.max(0, text.lastIndexOf(".", index) + 1, text.lastIndexOf(NY_RAD, index) + 1);
  let slut = text.indexOf(".", index + langd);
  const rad = text.indexOf(NY_RAD, index + langd);
  if (slut === -1 || (rad !== -1 && rad < slut)) slut = rad === -1 ? text.length : rad;
  // Maskeringstoken och styrtecken får ALDRIG följa med in i beslutet: raden sparas i
  // databasen, och en mening med skräptecken fick hela sparningen att falla tyst.
  return text
    .slice(start, slut + 1)
    .replace(MASK_RE, "")
    .replace(STYRTECKEN, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220);
}

export function meningFor(md: string, index: number, langd: number): string {
  const start = Math.max(0, md.lastIndexOf(".", index) + 1, md.lastIndexOf("\n", index) + 1);
  let slut = md.indexOf(".", index + langd);
  const rad = md.indexOf("\n", index + langd);
  if (slut === -1 || (rad !== -1 && rad < slut)) slut = rad === -1 ? md.length : rad;
  return md.slice(start, slut + 1).replace(/\s+/g, " ").trim().slice(0, 220);
}

// ── Grinden ──────────────────────────────────────────────────────────────────

export interface SifferIndata {
  /** Tal med täckning i crawlad sajttext, profil eller mätvärden. */
  belagda: Set<string>;
  /** Tenantens kunskapsfält: branschfakta ägaren själv lagt in. */
  kunskapsfalt: string | null;
  /** Tal ur GSC-datan. Alltid belagda. */
  gscTal: Set<string>;
}

export interface SifferResultat {
  text: string;
  beslut: Sifferbeslut[];
  /** Bara äkta tenant-luckor, med plats och mening. */
  luckor: Sifferbeslut[];
}

/**
 * Maskering av färdigbehandlade intervall, medan andra passet går.
 *
 * ⚠ MÄTT PÅ DEN SKARPA KÖRNINGEN: första versionen använde `` som markör. Tecknet
 *   följde med in i beslutens `mening`, och Postgres VÄGRAR lagra `` i text. Varje
 *   sparning av rapporten föll därför tyst, raden stod kvar som `processing`, och
 *   finaliseringen körde om samma rapport var 30:e sekund i evighet. En tyst misslyckad
 *   sparning är exakt den sortens fel som annars aldrig upptäcks.
 *
 *   Markören är nu vanliga tecken som aldrig förekommer i en rapport, och meningarna
 *   rensas dessutom från styrtecken innan de sparas.
 */
const MASK_START = "«MSK";
const MASK_SLUT = "MSK»";
const MASK_RE = new RegExp(`${MASK_START}(i+)${MASK_SLUT}`, "g");

const LUCKA = "[DIN SIFFRA]";
const RIKTVARDE = " (riktvärde, verifiera mot din leverantör)";

/**
 * Kör grinden på HELA rapporten med ETT beslut per tal.
 *
 * ★ KONSEKVENSKRAVET: samma tal fick tidigare vara omaskat i "Så här gör du" och maskat i
 *   klistra-in-blocket, eftersom grinden bara kördes på den senare delen. Beslutet fattas
 *   nu en gång per talnyckel och tillämpas överallt.
 */
export function grindaSiffror(md: string, indata: SifferIndata): SifferResultat {
  const kunskapstal = indata.kunskapsfalt ? talTokenForKalla(indata.kunskapsfalt) : new Set<string>();
  const beslutPerNyckel = new Map<string, Sifferbeslut>();

  // Kodblock lämnas orörda: schema-JSON och robots-rader är exakta.
  const bitar = md.split(/(```[\s\S]*?```)/g);

  const avgor = (tal: string, kontext: string, kalla: string, index: number, langd: number): Sifferbeslut => {
    const nyckel = talNyckel(tal);
    const befintligt = beslutPerNyckel.get(nyckel);
    if (befintligt) return befintligt;

    let klass = klassaTal(kontext);
    let utfall: Sifferutfall;
    let varifran: string;
    const seoFakta = arSeoFakta(kontext, tal);

    const ejPastaende = ejPastaendeSkal(kontext);
    if (ejPastaende) {
      utfall = "belagt";
      varifran = `inget påstående om storlek: ${ejPastaende}`;
    } else if (klass === "G" || indata.gscTal.has(nyckel)) {
      utfall = "belagt";
      varifran = "Googles sökdata";
    } else if (indata.belagda.has(nyckel)) {
      utfall = "belagt";
      varifran = "sajttext, profil eller mätvärde";
    } else if (kunskapstal.has(nyckel)) {
      utfall = "belagt";
      varifran = "tenantens kunskapsfält";
    } else if (seoFakta) {
      // R-5b punkt 2: generisk SEO-fakta är branschfakta, inte kundens uppgift. Den skrivs
      // ut som den är — en riktvärdesmärkning på Googles egen teckengräns hade varit
      // nonsens ("verifiera mot din leverantör" om något leverantören inte äger).
      klass = "B";
      utfall = "belagt";
      varifran = `generisk SEO-standard: ${seoFakta}`;
    } else if (!arTenantTal(kontext) && arCrawlMatvarde(kontext)) {
      // R-5b punkt 3: våra egna mätvärden om sajten. Maskas aldrig.
      klass = "C";
      utfall = "belagt";
      varifran = "crawlens egen mätning av sajten";
    } else if (klass === "B") {
      // Branschfakta maskas ALDRIG. Utan kunskapsfält skrivs de ut märkta i stället.
      utfall = "riktvarde";
      varifran = "branschfakta utan kunskapsfält";
    } else {
      utfall = "lucka";
      varifran = "saknar täckning i profil och sajttext";
    }

    const b: Sifferbeslut = {
      tal, klass: indata.gscTal.has(nyckel) ? "G" : klass, utfall, kalla: varifran,
      mening: meningRunt(kalla, index, langd),
      sektion: sektionFor(md, Math.max(0, md.indexOf(meningRunt(kalla, index, langd).slice(0, 40)))),
    };
    beslutPerNyckel.set(nyckel, b);
    return b;
  };

  /**
   * Ett steg per bit: intervall först som EN enhet, sedan enskilda tal.
   *
   * ⚠ TVÅ FEL SOM MÄTNINGEN VISADE, båda rättade här:
   *   1. Intervallets delar fick riktvärdesmärkningen två gånger, eftersom andra passet
   *      läste om texten första passet just skrivit. Behandlade intervall maskeras därför
   *      medan andra passet går.
   *   2. Klassningen läste fel mening när texten redan bytt längd. Sammanhanget hämtas nu
   *      ur den sträng som faktiskt skannas, inte ur originalet med en förskjuten position.
   */
  const behandla = (del: string): string => {
    const gomda: string[] = [];

    // R-5b punkt 1: numrering och datum hoppas över PÅ PLATSEN — inget beslut, ingen
    // maskering, ingen rad i beslutstabellen. Kontrollen ligger här och inte i `avgor`,
    // eftersom beslutet gäller per tal för hela rapporten: samma fyra kan vara
    // rubriknumrering på en rad och en leveranstid på en annan.
    const struktur = (text: string, i: number, tal: string): boolean => {
      const { rad, iRaden } = radRunt(text, i);
      return arStrukturtal(rad, iRaden, tal);
    };

    let ut = del.replace(INTERVALL, (traff, a: string, b: string, i: number) => {
      if (struktur(del, i, traff)) return traff;
      const kontext = meningRunt(del, i, traff.length);
      const ba = avgor(a, kontext, del, i, traff.length);
      const bb = avgor(b, kontext, del, i, traff.length);
      const resultat =
        ba.utfall === "lucka" || bb.utfall === "lucka"
          ? LUCKA
          : `${traff}${ba.utfall === "riktvarde" || bb.utfall === "riktvarde" ? RIKTVARDE : ""}`;
      gomda.push(resultat);
      // ⚠ Token får INTE innehålla siffror: andra passet matchade indexsiffran i den
      //   gamla masken och skrev "0 (riktvärde)" mitt i intervallet.
      return `${MASK_START}${"i".repeat(gomda.length)}${MASK_SLUT}`;
    });

    ut = ut.replace(ENSKILT, (tal: string, i: number) => {
      if (struktur(ut, i, tal)) return tal;
      const kontext = meningRunt(ut, i, tal.length);
      const b = avgor(tal, kontext, ut, i, tal.length);
      if (b.utfall === "lucka") return LUCKA;
      if (b.utfall === "riktvarde") return `${tal}${RIKTVARDE}`;
      return tal;
    });

    return ut.replace(MASK_RE, (_, m: string) => gomda[m.length - 1] ?? "");
  };

  const text = bitar
    .map((del) => (del.startsWith("```") ? del : behandla(del)))
    .join("");

  const beslut = Array.from(beslutPerNyckel.values());
  return { text, beslut, luckor: beslut.filter((b) => b.utfall === "lucka") };
}

/** Beslutstabellen, färdig att stickprova. Sparas i metadata (grind_sifferbeslut). */
export function beslutstabell(beslut: Sifferbeslut[]): string {
  const rader = beslut.map((b) =>
    `| ${b.tal} | ${b.klass} | ${b.utfall} | ${b.kalla} | ${b.sektion} |`,
  );
  return [
    "| Tal | Klass | Utfall | Källa | Var i rapporten |",
    "|---|---|---|---|---|",
    ...rader,
  ].join("\n");
}

/**
 * Hela beslutstabellens block med rubrik och förklaring — ENDA stället som formaterar
 * detta, så ägarvyn (app/api/analytics/deep-audit) och kundexporten aldrig kan glida isär.
 *
 * R-5b, fjärde kravet (HELG-1 DEL 0/2, 2026-08-21): blocket bifogas INTE längre den text
 * som sparas som `client_assets.body` (se lib/deep-audit-finalize.ts) — kunden ser bara
 * själva rapporten, som slutar vid Ordlistan. Ägarvyn bygger blocket på nytt vid varje
 * läsning, ur `metadata.grind_sifferbeslut`, som redan sparas oförändrat.
 */
export function beslutstabellBlock(beslut: Sifferbeslut[]): string {
  if (!beslut.length) return "";
  return [
    "", "---", "",
    "### Så här bedömdes varje siffra (syns bara i ägarvyn, aldrig i kundens export)",
    "",
    "T = din egen uppgift, B = branschfakta, G = Googles data, C = vår egen mätning av din sajt.",
    "",
    "Numrering (listor, rubriker, tabellrader) och datum står inte med: de är inga uppgifter att fylla i.",
    "",
    beslutstabell(beslut),
    "",
  ].join("\n");
}

const BESLUTSTABELL_MARKOR = "### Så här bedömdes varje siffra";

/**
 * Kundens säkra text — R-5b, fjärde kravet. Klipper bort allt från och med beslutstabellens
 * rubrik, oavsett om blocket kom med av misstag. Körs vid LÄSNING i kundvägen
 * (app/api/seo/deep-audit), inte bara vid skrivning i lib/deep-audit-finalize.ts — så även de
 * rapporter som redan låg i databasen med tabellen inbakad (sparade före 2026-08-21) blir
 * säkra utan en separat migrering. Kundrapporten slutar därmed vid Ordlistan, som redan är
 * sista sektionen i själva den AI-genererade texten.
 */
export function kundtext(body: string): string {
  const rubrikIdx = body.indexOf(BESLUTSTABELL_MARKOR);
  if (rubrikIdx === -1) return body;
  const separatorIdx = body.lastIndexOf("---", rubrikIdx);
  const grans = separatorIdx !== -1 && rubrikIdx - separatorIdx < 20 ? separatorIdx : rubrikIdx;
  return body.slice(0, grans).trimEnd() + "\n";
}

/** Lucklistan med kontext. En rå taldump går inte att fylla i. */
export function lucklista(luckor: Sifferbeslut[]): string {
  if (!luckor.length) return "";
  return [
    "### Siffror du behöver fylla i",
    "",
    "Följande uppgifter är dina egna, och vi har inte hittat dem på din sajt eller i din profil.",
    "De står som [DIN SIFFRA] i texterna ovan.",
    "",
    ...luckor.map((l) => `- **${l.tal}** i avsnittet "${l.sektion}": "${l.mening}"`),
    "",
  ].join("\n");
}
