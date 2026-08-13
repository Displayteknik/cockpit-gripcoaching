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

export type Sifferklass = "T" | "B" | "G";
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
const EJ_PASTAENDE = [
  /0\d{1,3}[-\s]?\d{2,3}\s?\d{2}\s?\d{2}/,   // 072 541 01 02, 08-123 45 67
  /\d{6}-\d{4}/,                                // person- eller orgnummer
  /(19|20)\d{2}-\d{2}-\d{2}/,                   // datum
  /\+46\s?\d/,                                       // landsnummer
];

export function arEjPastaende(kontext: string): boolean {
  return EJ_PASTAENDE.some((m) => m.test(kontext));
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
  return text.slice(start, slut + 1).replace(/\s+/g, " ").trim().slice(0, 220);
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

    const klass = klassaTal(kontext);
    let utfall: Sifferutfall;
    let varifran: string;

    if (arEjPastaende(kontext)) {
      utfall = "belagt";
      varifran = "telefonnummer, orgnummer eller datum";
    } else if (klass === "G" || indata.gscTal.has(nyckel)) {
      utfall = "belagt";
      varifran = "Googles sökdata";
    } else if (indata.belagda.has(nyckel)) {
      utfall = "belagt";
      varifran = "sajttext, profil eller mätvärde";
    } else if (kunskapstal.has(nyckel)) {
      utfall = "belagt";
      varifran = "tenantens kunskapsfält";
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

    let ut = del.replace(INTERVALL, (traff, a: string, b: string, i: number) => {
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
      return ` ${"i".repeat(gomda.length)} `;
    });

    ut = ut.replace(ENSKILT, (tal: string, i: number) => {
      const kontext = meningRunt(ut, i, tal.length);
      const b = avgor(tal, kontext, ut, i, tal.length);
      if (b.utfall === "lucka") return LUCKA;
      if (b.utfall === "riktvarde") return `${tal}${RIKTVARDE}`;
      return tal;
    });

    return ut.replace(/ (i+) /g, (_, m: string) => gomda[m.length - 1] ?? "");
  };

  const text = bitar
    .map((del) => (del.startsWith("```") ? del : behandla(del)))
    .join("");

  const beslut = Array.from(beslutPerNyckel.values());
  return { text, beslut, luckor: beslut.filter((b) => b.utfall === "lucka") };
}

/** Beslutstabellen, färdig att stickprova. Bifogas rapporten och sparas i metadata. */
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
