// CITAT- OCH ANSPRÅKSREGELN — RAPPORT-1 R-4 (Håkans granskning 13/8).
//
// ★ FYNDET: rapporten la ord i kundernas munnar INNANFÖR citattecknen.
//
//   X-Trafiks citat fick tillägget "Skärmarna är vädertåliga (IP66), klarar
//   temperaturväxlingar och har aldrig behövt bytas" och signerades "Henrik Strömberg, fd
//   X-Trafik". Platinum fick "folk stannar och tittar, och flera har kommit in och frågat".
//   Ingen av meningarna finns hos kunden. Dessutom stod det "Våra egna driftmätningar hos
//   Toyota Sweden och X-Trafik visar...", ett auktoritetsanspråk utan täckning i profilen.
//
//   Det är A2-mönstret, och det är värre här än i ett inlägg: texten är märkt "färdig att
//   klistra in", alltså uppmanas kunden att publicera den fabricerade versionen som om
//   en namngiven person sagt den.
//
// REGELN: ett citat är ordagrant eller orört. Kompletterande fakta hör hemma UTANFÖR
// citattecknen, som rapportens egen text, och grindas då som alla andra påståenden.
// Vill rapporten ha mer i citatet ber den kunden om det, i stället för att hitta på det.

/** Citattecken vi accepterar. Modellen blandar raka och typografiska. */
const CITATPAR: [string, string][] = [['"', '"'], ["”", "”"], ["”", "”"], ["«", "»"]];

export interface CitatTraff {
  /** Citatet så som det står i rapporten, utan citattecken. */
  text: string;
  /** Position i rapporten. */
  index: number;
  /** Hela träffen inklusive citattecken. */
  ra: string;
}

/**
 * Plockar ut citat ur rapporten.
 *
 * Bara citat på minst 25 tecken räknas: kortare strängar inom citattecken är nästan alltid
 * en term ("pixel pitch"), en rubrik eller ett exempelord, inte någons yttrande.
 */
export function hittaCitat(md: string, minLangd = 25): CitatTraff[] {
  const ut: CitatTraff[] = [];
  const utanKod = md.replace(/```[\s\S]*?```/g, (m) => " ".repeat(m.length));
  for (const [oppna, stang] of CITATPAR) {
    const re = new RegExp(`${oppna}([^${oppna}${stang}\\n]{${minLangd},400})${stang}`, "g");
    for (const m of utanKod.matchAll(re)) {
      ut.push({ text: m[1], index: m.index ?? 0, ra: m[0] });
    }
  }
  return ut.sort((a, b) => a.index - b.index);
}

/**
 * Är det ett KUNDCITAT, eller bara text inom citattecken?
 *
 * ⚠ MÄTT PÅ DT-RAPPORTEN 13/8, och första versionen var oanvändbar: den hittade 78 "citat"
 *   och ville skriva om 74 av dem. Men en rapport är full av citattecken som inte är
 *   någons yttrande: sidtitlar ("Inomhusskärmar, LED, videovägg"), FAQ-frågor, länktexter,
 *   ordlisteposter ("nits (ljusstyrka)") och föreslagna metabeskrivningar. Att "rätta" dem
 *   mot sajttexten hade förstört rapporten.
 *
 *   Regeln gäller det den handlar om: ord som TILLSKRIVS en person eller ett företag.
 *   Ett citat räknas när det har en attribution i närheten, eller när det matchar ett
 *   kundcitat som redan finns i profilen.
 */
const ATTRIBUTION = /^[\s>*_-]*(?:[-–—]\s*)?([A-ZÅÄÖ][\wÀ-ÿ]+(?:\s+[A-ZÅÄÖ][\wÀ-ÿ]+)?)\s*,\s*(?:fd\s+)?[A-ZÅÄÖ]/;

export function arKundcitat(md: string, traff: CitatTraff, profilcitat: string[]): boolean {
  const efter = md.slice(traff.index + traff.ra.length, traff.index + traff.ra.length + 120);
  // ⚠ En rubrik som råkar följas av ett namn är ingen replik. Ett yttrande är en mening:
  //   minst åtta ord. "Riktpriser för digitala skärmar 2026" fastnade utan det kravet, och
  //   att skriva om en tabellrubrik mot sajttexten vore lika illa som att låta ett
  //   fabricerat citat passera.
  const ordantal = traff.text.trim().split(/\s+/).length;
  if (ordantal >= 8 && ATTRIBUTION.test(efter)) return true;
  // "säger Henrik på X-Trafik", "enligt Anna hos kunden"
  if (/\b(säger|berättar|enligt|menar)\s+[A-ZÅÄÖ]/.test(efter.slice(0, 60))) return true;
  const n = normalisera(traff.text);
  return profilcitat.some((p) => {
    const np = normalisera(p);
    if (!np || !n) return false;
    if (np.includes(n) || n.includes(np)) return true;
    const po = new Set(ord(p));
    const to = ord(traff.text);
    return to.length > 4 && to.filter((o) => po.has(o)).length / to.length >= 0.6;
  });
}

const normalisera = (s: string) =>
  s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();

const ord = (s: string) => normalisera(s).split(" ").filter((o) => o.length > 2);

/**
 * Är citatet ordagrant hämtat ur källan?
 *
 * Jämförelsen är normaliserad (skiljetecken och versaler bort) eftersom en rapport gärna
 * byter ut ett bindestreck eller ett citattecken. Innebörden får däremot inte röras, och
 * det fångas av att hela citatet måste finnas som en sammanhängande sträng i källan.
 */
export function arOrdagrant(citat: string, kallor: string[]): boolean {
  const n = normalisera(citat);
  if (!n) return false;
  return kallor.some((k) => normalisera(k).includes(n));
}

export interface CitatDom {
  citat: CitatTraff;
  utfall: "ordagrant" | "utokat" | "okant";
  /** Källans egen formulering när citatet är en utökning av den. */
  kalltext: string | null;
  /** Hur stor andel av citatets ord som finns i den bästa källan. */
  tackning: number;
}

/**
 * Diffar ett citat mot källorna.
 *
 * "utokat" = källan finns och citatet innehåller den, men rapporten har lagt till ord.
 * Det är exakt X-Trafik-fallet, och det farligaste utfallet: det ser trovärdigt ut.
 */
export function diffaCitat(citat: CitatTraff, kallor: string[]): CitatDom {
  if (arOrdagrant(citat.text, kallor)) {
    return { citat, utfall: "ordagrant", kalltext: null, tackning: 1 };
  }
  const citatOrd = ord(citat.text);
  let bast: { text: string; andel: number } | null = null;
  for (const k of kallor) {
    const kallOrd = new Set(ord(k));
    if (!citatOrd.length) continue;
    const andel = citatOrd.filter((o) => kallOrd.has(o)).length / citatOrd.length;
    if (!bast || andel > bast.andel) bast = { text: k, andel };
  }
  // Halva citatet eller mer ur källan = rapporten har byggt vidare på ett verkligt citat.
  if (bast && bast.andel >= 0.5) {
    return { citat, utfall: "utokat", kalltext: bast.text, tackning: bast.andel };
  }
  return { citat, utfall: "okant", kalltext: null, tackning: bast?.andel ?? 0 };
}

// ── Auktoritetsanspråk ───────────────────────────────────────────────────────
//
// "Våra egna driftmätningar visar", "baserat på våra tester", "vi vet efter 15 år".
// Ett anspråk på egen mätning är ett faktapåstående om verksamheten, och kräver samma
// täckning som en siffra. Utan täckning skrivs det generellt, enligt A2.

const ANSPRAKSMONSTER: RegExp[] = [
  /\bvåra egna (mätningar|driftmätningar|tester|studier|siffror)\b/gi,
  /\bbaserat på våra (tester|mätningar|erfarenheter av)\b/gi,
  /\bvi (vet|har sett) efter \d+ års?\b/gi,
  /\bvår (statistik|data|mätning) visar\b/gi,
  /\bi våra (installationer|projekt) ser vi\b/gi,
];

export interface Ansprak { fras: string; index: number; mening: string }

export function hittaAnsprak(md: string): Ansprak[] {
  const ut: Ansprak[] = [];
  for (const re of ANSPRAKSMONSTER) {
    for (const m of md.matchAll(re)) {
      const i = m.index ?? 0;
      ut.push({
        fras: m[0],
        index: i,
        mening: md.slice(Math.max(0, i - 80), i + m[0].length + 120).replace(/\s+/g, " ").trim(),
      });
    }
  }
  return ut.sort((a, b) => a.index - b.index);
}

/** Har anspråket täckning i profilens verifierade siffror eller story-bank? */
export function ansprakTackt(ansprak: Ansprak, tackningstext: string | null): boolean {
  if (!tackningstext) return false;
  const n = normalisera(tackningstext);
  return ord(ansprak.mening).filter((o) => n.includes(o)).length / Math.max(1, ord(ansprak.mening).length) >= 0.6;
}

// ── Grinden ──────────────────────────────────────────────────────────────────

export interface CitatIndata {
  /** Crawlad sajttext och profilens kundcitat. Enda tillåtna citatkällor. */
  kallor: string[];
  /** Profilens kundcitat var för sig. Avgör VAD som är ett kundcitat att grinda. */
  profilcitat?: string[];
  /** Verifierade siffror och story-bank. Täckning för auktoritetsanspråk. */
  tackningstext: string | null;
}

export interface CitatResultat {
  text: string;
  domar: CitatDom[];
  ansprak: { ansprak: Ansprak; tackt: boolean }[];
}

/** Frågorna rapporten ska ställa i stället för att skriva citatet åt kunden. */
const FRAGEFORSLAG = [
  "Vad var det konkreta problemet innan?",
  "Vad märkte ni först efter att det var på plats?",
  "Finns det något ni kan sätta en siffra på, till exempel tid, antal eller kostnad?",
];

/**
 * Ersätter utökade citat med källans egen formulering och lägger till uppmaningen att be
 * kunden om resten. Okända citat markeras men skrivs inte om: vi vet inte vad de borde ha
 * varit, och att gissa vore samma fel en gång till.
 */
export function grindaCitat(md: string, indata: CitatIndata): CitatResultat {
  // Bara riktiga kundcitat grindas. Se `arKundcitat`: en rapport är full av citattecken
  // som inte är någons yttrande, och att "rätta" en sidtitel mot sajttexten vore vandalism.
  const domar = hittaCitat(md)
    .filter((c) => arKundcitat(md, c, indata.profilcitat ?? []))
    .map((c) => diffaCitat(c, indata.kallor));
  let text = md;

  for (const d of domar) {
    if (d.utfall === "ordagrant") continue;
    const ersattning =
      d.utfall === "utokat" && d.kalltext
        ? `"${d.kalltext.trim()}"\n\n> ⚠ CITATET ÄR KORTAT TILL KUNDENS EGNA ORD. Rapportens första version hade lagt till ` +
          `meningar som kunden aldrig sagt. Vill du ha ett fylligare citat: be om det, till exempel med frågorna ` +
          `"${FRAGEFORSLAG.join('" "')}". Kundens ord ska komma från kunden.`
        : `${d.citat.ra}\n\n> ⚠ OVERIFIERAT CITAT. Vi hittar det inte på din sajt eller i din profil. ` +
          `Kontrollera att personen sagt exakt så, eller be om ett nytt citat innan du publicerar.`;
    text = text.replace(d.citat.ra, ersattning);
  }

  const ansprak = hittaAnsprak(text).map((a) => ({ ansprak: a, tackt: ansprakTackt(a, indata.tackningstext) }));
  for (const a of ansprak) {
    if (a.tackt) continue;
    text = text.replace(
      a.ansprak.fras,
      `${a.ansprak.fras} [⚠ SAKNAR TÄCKNING: skriv om generellt, eller lägg in mätningen i din profil först]`,
    );
  }

  return { text, domar, ansprak };
}
