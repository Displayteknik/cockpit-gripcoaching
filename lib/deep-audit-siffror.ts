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
const TAL = String.raw`\d{1,3}(?:[  ]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?`;
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
  /0\d{1,3}[-\s]?\d{2,3}\s?\d{2}\s?\d{2}/,     // 072 541 01 02, 08-123 45 67
  /\d{6}-\d{4}/,                                  // person-/orgnummer
  /(19|20)\d{2}-\d{2}-\d{2}/,                     // datum
  /\+46\s?\d/,                                         // landsnummer
];

export function arEjPastaende(kontext: string): boolean {
  return EJ_PASTAENDE.some((m) => m.test(kontext));
}

function narmasteOrd(text: string, index: number, langd: number): string {
  return text.slice(Math.max(0, index - 70), Math.min(text.length, index + langd + 70));
}

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

  const avgor = (tal: string, kontext: string, index: number, langd: number): Sifferbeslut => {
    const nyckel = talNyckel(tal);
    const befintligt = beslutPerNyckel.get(nyckel);
    if (befintligt) return befintligt;

    const klass = klassaTal(kontext);
    let utfall: Sifferutfall;
    let kalla: string;

    if (arEjPastaende(kontext)) {
      utfall = "belagt";
      kalla = "telefonnummer, orgnummer eller datum";
    } else if (klass === "G" || indata.gscTal.has(nyckel)) {
      utfall = "belagt";
      kalla = "Googles sökdata";
    } else if (indata.belagda.has(nyckel)) {
      utfall = "belagt";
      kalla = "sajttext, profil eller mätvärde";
    } else if (kunskapstal.has(nyckel)) {
      utfall = "belagt";
      kalla = "tenantens kunskapsfält";
    } else if (klass === "B") {
      // Branschfakta maskas ALDRIG. Utan kunskapsfält skrivs de ut märkta i stället.
      utfall = "riktvarde";
      kalla = "branschfakta utan kunskapsfält";
    } else {
      utfall = "lucka";
      kalla = "saknar täckning i profil och sajttext";
    }

    const b: Sifferbeslut = {
      tal, klass: indata.gscTal.has(nyckel) ? "G" : klass, utfall, kalla,
      mening: meningFor(md, index, langd),
      sektion: sektionFor(md, index),
    };
    beslutPerNyckel.set(nyckel, b);
    return b;
  };

  const behandla = (del: string, offset: number): string => {
    // 1. Intervall först, som EN enhet. Antingen står hela intervallet, eller blir hela
    //    intervallet en lucka. "2500-[DIN SIFFRA] nits" får aldrig uppstå.
    let ut = del.replace(INTERVALL, (traff, a: string, b: string, i: number) => {
      const kontext = narmasteOrd(del, i, traff.length);
      const ba = avgor(a, kontext, offset + i, traff.length);
      const bb = avgor(b, kontext, offset + i, traff.length);
      if (ba.utfall === "lucka" || bb.utfall === "lucka") return LUCKA;
      const marker = ba.utfall === "riktvarde" || bb.utfall === "riktvarde" ? RIKTVARDE : "";
      return `${traff}${marker}`;
    });

    // 2. Enskilda tal. LUCKA-texten innehåller inga siffror, så den kan inte träffas igen.
    ut = ut.replace(ENSKILT, (tal: string, i: number) => {
      const kontext = narmasteOrd(ut, i, tal.length);
      const b = avgor(tal, kontext, offset + i, tal.length);
      if (b.utfall === "lucka") return LUCKA;
      if (b.utfall === "riktvarde") return `${tal}${RIKTVARDE}`;
      return tal;
    });
    return ut;
  };

  let offset = 0;
  const text = bitar
    .map((del) => {
      const ut = del.startsWith("```") ? del : behandla(del, offset);
      offset += del.length;
      return ut;
    })
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
