// BILD-8a — stavningsgrind för AVBILDAD text. Plattformslager, server-only.
//
// Bakgrund (skarptest 2026-07-31): BILD-7 lät avbildad skyltning bära ett budskap, men
// bildmodellen stavar fel och prompten kan inte fixa det — dokumenterat i
// docs/studio/bild7-exempel/README.md ("NYHIETES", "IDÅG", "VÄKLLOMMEN"). Grinden läser
// den genererade bilden, dömer stavningen PROGRAMMATISKT och begär omtag vid fel.
//
// ⚠ FÄLLAN (project_studio_b_paketet, fälla 1): vision AUTOKORRIGERAR. En holistisk
// avläsning svarar gärna "NYHETER" när bilden säger "NYHIETES" — språkpriorn städar
// felet innan vi ser det. Därför:
//   1. modellen transkriberar TECKEN FÖR TECKEN (ordgränser markerade med |),
//   2. domen faller programmatiskt mot ordlista + morfologi + närmiss-avstånd,
//   3. modellens egen "är detta rättstavat?"-bedömning används ALDRIG som enda grund —
//      den får bara yttra sig om ord programmatiken klassat som OKÄNDA, och kan aldrig
//      underkänna ett ord som ordlistan känner igen.
//
// Fail-open: tekniskt fel (ingen nyckel, nätverk, tomt svar) släpper alltid igenom
// bilden. Grinden får aldrig blockera användarens flöde.
//
// Här bor också de gemensamma vision-avläsningarna som B3 (lib/studio/text-in-image.tsx)
// använder — en källa, inga dubbletter.

export type TextOrsak =
  | "ingen-nyckel"
  | "ingen-text"
  | "godkand"
  | "felstavning"
  | "avviker"
  | "tekniskt-fel";

export interface StavUtfall {
  /** true = bilden får släppas igenom (godkänd text, ingen text, eller fail-open). */
  ok: boolean;
  /** Avläst text, ord separerade med mellanslag. */
  text: string;
  ord: string[];
  /** Orden som fälldes (tomt när ok). */
  fel: string[];
  orsak: TextOrsak;
}

// ── Vision-avläsningar (delas med B3) ──────────────────────────────────────

async function bildTillInline(image: string): Promise<{ mimeType: string; data: string } | null> {
  const m = image.match(/^data:(image\/\w+);base64,(.+)$/);
  if (m) return { mimeType: m[1], data: m[2] };
  try {
    const r = await fetch(image);
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    return { mimeType: r.headers.get("content-type") || "image/jpeg", data: buf.toString("base64") };
  } catch {
    return null;
  }
}

// Nyckeln läses vid anrop (inte vid modulladdning) så testerna kan styra fail-open.
function geminiNyckel(): string {
  return process.env.GEMINI_API_KEY || "";
}

async function visionFraga(
  inline: { mimeType: string; data: string },
  fraga: string,
  maxOutputTokens = 300,
): Promise<string> {
  const key = geminiNyckel();
  if (!key) return "";
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ inlineData: inline }, { text: fraga }] }],
        generationConfig: { temperature: 0, maxOutputTokens, thinkingConfig: { thinkingBudget: 0 } },
      }),
    });
    if (!r.ok) return "";
    const data = await r.json();
    return (data?.candidates?.[0]?.content?.parts?.find((p: { text?: string }) => p.text)?.text || "").trim();
  } catch {
    return "";
  }
}

// Normalisering för jämförelse: gemener, whitespace → ett mellanslag, citattecken bort.
// å/ä/ö är SIGNIFIKANTA — det är hela poängen.
export function normaliseraText(s: string): string {
  return s
    .normalize("NFC") // vision kan svara dekomponerat (O + kombinerande prickar)
    .toLowerCase()
    .replace(/["'”„“‘’«»]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[.,!?:;\-–—\s]+|[.,!?:;\-–—\s]+$/g, "");
}

// Teckenvis jämförelse: allt whitespace ignoreras (teckenseparationen gör ordgränser
// omöjliga att skilja från teckenmellanrum), skiljetecken kvar.
export function normaliseraTecken(s: string): string {
  return s.normalize("NFC").toLowerCase().replace(/[|/]/g, "").replace(/\s+/g, "").replace(/["'”„“‘’«»]/g, "");
}

/** Läs av exakt synlig text i en bild (URL eller data-URL) via vision, temp 0. */
export async function lasTextIBild(image: string): Promise<string> {
  const inline = await bildTillInline(image);
  if (!inline) return "";
  const t = await visionFraga(inline, "Läs av EXAKT den text som syns i bilden (skylt, lapp, etikett). Återge varje bokstav precis som den ser ut, även felstavningar. Svara ENDAST med texten, inget annat. Om ingen text syns: svara INGEN.");
  return t === "INGEN" ? "" : t;
}

/**
 * Bokstav-för-bokstav-avläsning. Holistisk läsning AUTOKORRIGERAR ("Öıpet" läses som
 * "Öppet") — teckenvis transkription bryter språkpriorn och fångar felstavningen.
 */
export async function lasTeckenForTecken(image: string): Promise<string> {
  const inline = await bildTillInline(image);
  if (!inline) return "";
  return visionFraga(inline, "Transkribera texten i bilden TECKEN FÖR TECKEN, separera varje tecken med mellanslag och varje radbrytning med / . Autokorrigera INTE — återge exakt de glyfer som syns även om ordet blir felstavat. Svara ENDAST med teckensekvensen, eller INGEN om ingen text syns.");
}

/**
 * Teckenvis transkription MED ordgränser. Ordgränserna behövs för att kunna slå upp
 * varje ord i ordlistan; teckenseparationen behövs för att bryta autokorrigeringen.
 */
export async function lasOrdTeckenvis(image: string): Promise<string[]> {
  const inline = await bildTillInline(image);
  if (!inline) return [];
  const raw = await visionFraga(
    inline,
    "Transkribera ALL text som syns i bilden (skyltar, skärmar, tavlor, affischer, etiketter) TECKEN FÖR TECKEN. " +
      "Separera varje tecken med mellanslag, varje ORD med | och varje radbrytning med /. " +
      "Autokorrigera INTE och gissa INTE — återge exakt de glyfer som syns, även om ordet blir felstavat eller obegripligt. " +
      "Svara ENDAST med sekvensen, eller INGEN om ingen text alls syns.",
    600,
  );
  if (!raw || raw.trim().toUpperCase() === "INGEN") return [];
  return parsaTeckenTranskription(raw);
}

/**
 * Tolka svaret från den teckenvisa transkriptionen till en ordlista.
 * Tolerant: modellen följer inte alltid formatet. Ett segment där de flesta tokens är
 * ETT tecken långa limmas ihop till ett ord; ett segment med vanliga ord splittas på
 * mellanslag i stället.
 */
export function parsaTeckenTranskription(raw: string): string[] {
  const rensad = raw.normalize("NFC").replace(/^["'`]+|["'`]+$/g, "").trim();
  if (!rensad || rensad.toUpperCase() === "INGEN") return [];
  const ord: string[] = [];
  for (const segment of rensad.split(/[|/\n]+/)) {
    const tokens = segment.trim().split(/\s+/).filter(Boolean);
    if (!tokens.length) continue;
    const enteckens = tokens.filter((t) => t.length === 1).length;
    if (tokens.length > 1 && enteckens / tokens.length >= 0.6) {
      // Teckenseparerat segment → limma ihop till ett ord.
      ord.push(tokens.join(""));
    } else {
      ord.push(...tokens);
    }
  }
  return ord.map((o) => o.trim()).filter(Boolean);
}

// ── Programmatisk stavningsdom ─────────────────────────────────────────────

// Branschneutral svensk skyltvokabulär. Ordlistan är AVSIKTLIGT allmän — den ska funka
// lika bra för blomsteraffär, bilhandlare och coach. Den är inte en fullständig svensk
// ordlista och ska inte vara det: okända ord fälls aldrig av listan ensam (se ordStatus).
const ORDLISTA = new Set(
  `
  erbjudande erbjudanden kampanj kampanjer rabatt rea pris priser prislapp nyhet nyheter nytt ny nya
  veckans dagens månadens årets helgens säsongens special fynd paket paketpris medlem medlemspris
  ordinarie från endast gäller giltig giltigt spara köp köper köpa sälj säljer säljes sålt slut
  uthyrning hyra hyr beställ beställning boka bokning bokas prova testa hämta hämtas leverans frakt
  fri gratis ingår inkl exkl moms styck st kr sek procent
  idag imorgon ikväll nu snart öppet öppnar öppna stängt stänger stängd tider öppettider vardagar
  helg helger måndag tisdag onsdag torsdag fredag lördag söndag kl klockan vecka veckan månad år
  januari februari mars april maj juni juli augusti september oktober november december
  vår våren sommar sommaren höst hösten vinter vintern jul påsk midsommar nyår
  välkommen välkomna hej tack grattis vi du dig ni er oss alla här hos med och för till på av
  en ett den det de som är har får kan vill ska mer mest bäst bättre se läs ring mejla maila
  hitta fråga info information kontakt adress telefon hemsida webb besök besöka
  butik butiken salong verkstad kontor mottagning showroom lager entré ingång utgång kassa
  kund kunder team personal service kvalitet garanti utvalt handplockat färskt hemlagat lokalt
  vi hos oss om nya våra vårt min mitt din ditt era
  lunch middag frukost fika meny rätt rätter dryck kaffe
  bukett buketter blommor blomma krukväxt växt snitt
  bil bilar däck service verkstad besiktning
  coach coaching kurs kurser workshop föreläsning samtal tid tider plats platser
  gruppträning träning behandling konsultation rådgivning
  digital skärm skärmar display skylt skyltar
  `
    .split(/\s+/)
    .map((o) => o.trim())
    .filter(Boolean),
);

// Vanliga svenska böjningsändelser. Längsta först.
const ANDELSER = ["ernas", "arnas", "erna", "arna", "orna", "ens", "ets", "ers", "ars", "en", "et", "er", "ar", "or", "na", "ns", "ts", "s", "n", "t"];

// Tillåtna tecken i svensk skylttext. Allt utanför = modellen har ritat en glyf som inte
// finns i svenskan (skarpt fall: "Öıpet" med turkiskt punktlöst i).
const TILLATNA_TECKEN = /^[a-zåäöéèüáàóòíìúùïëæø0-9.,:;!?%&/'’+()\-–—°"#@ ]+$/i;

/** Rent tal/pris/klockslag/procent — dömer vi aldrig som stavfel. */
function arTal(ord: string): boolean {
  return /^[0-9]+([.,:.][0-9]+)*$/.test(ord) || /^[0-9]+(kr|kr\.|%|:-|st|ml|cl|dl|l|kg|g|mm|cm|m)$/i.test(ord);
}

function rensaOrd(ord: string): string {
  return ord
    .normalize("NFC")
    .toLowerCase()
    .replace(/^[^a-zåäöéèüáàóòíìúùïë0-9]+|[^a-zåäöéèüáàóòíìúùïë0-9]+$/g, "");
}

/** Levenshtein-avstånd (utan transposition — räcker för glyffelen vi ser). */
export function avstand(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let rad = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const ny = [i];
    for (let j = 1; j <= b.length; j++) {
      ny[j] = Math.min(
        rad[j] + 1,
        ny[j - 1] + 1,
        rad[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    rad = ny;
  }
  return rad[b.length];
}

/** Hur långt ifrån ett känt ord ett okänt ord får ligga innan vi kallar det felstavning. */
function narmissTak(len: number): number {
  if (len <= 4) return 1;
  if (len <= 8) return 2;
  return 3;
}

function iListan(ord: string): boolean {
  if (ORDLISTA.has(ord)) return true;
  for (const a of ANDELSER) {
    if (ord.length > a.length + 2 && ord.endsWith(a) && ORDLISTA.has(ord.slice(0, -a.length))) return true;
  }
  return false;
}

/** Sammansättning: "helgbukett" = helg + bukett. Svenska bildar dem fritt. */
function arSammansatt(ord: string, djup = 2): boolean {
  if (djup <= 0) return false;
  for (let i = 3; i <= ord.length - 3; i++) {
    const forsta = ord.slice(0, i);
    if (!ORDLISTA.has(forsta)) continue;
    const rest = ord.slice(i);
    const restUtanS = rest.startsWith("s") && rest.length > 4 ? rest.slice(1) : rest; // fogesammansättning
    for (const kandidat of new Set([rest, restUtanS])) {
      if (iListan(kandidat) || arSammansatt(kandidat, djup - 1)) return true;
    }
  }
  return false;
}

export type OrdStatus = "tal" | "kant" | "sammansatt" | "otillaten" | "dubblering" | "narmiss" | "okant";

/**
 * Klassa ETT ord. Endast "otillaten", "dubblering" och "narmiss" är felstavning —
 * "okant" är ett ord vi inte känner igen och som därför aldrig fälls av programmatiken.
 */
export function ordStatus(rattOrd: string): OrdStatus {
  const ord = rensaOrd(rattOrd);
  if (!ord) return "tal";
  if (arTal(ord)) return "tal";
  if (!TILLATNA_TECKEN.test(rattOrd)) return "otillaten";
  // Tre identiska tecken i rad finns inte i svenska ord (sammansättningar drar ihop dem).
  if (/(.)\1\1/.test(ord)) return "dubblering";
  if (/^[bcdfghjklmnpqrstvwxz]{5,}$/i.test(ord)) return "dubblering"; // konsonantgröt utan vokal
  if (iListan(ord)) return "kant";
  if (arSammansatt(ord)) return "sammansatt";
  const tak = narmissTak(ord.length);
  for (const kant of ORDLISTA) {
    if (Math.abs(kant.length - ord.length) > tak) continue;
    const d = avstand(ord, kant);
    if (d > 0 && d <= tak) return "narmiss";
  }
  return "okant";
}

/** Ord som programmatiken fäller direkt. */
export function stavfel(ord: string[]): string[] {
  return ord.filter((o) => {
    const s = ordStatus(o);
    return s === "otillaten" || s === "dubblering" || s === "narmiss";
  });
}

/** Ord programmatiken inte känner igen — endast dessa får modellen yttra sig om. */
export function okandaOrd(ord: string[]): string[] {
  return ord.filter((o) => ordStatus(o) === "okant");
}

/**
 * Andra åsikt om ord programmatiken INTE känner igen. Ren TEXT-fråga (ingen bild) —
 * autokorrigeringsfällan gäller bildavläsning, inte textbedömning. Modellen kan bara
 * LÄGGA TILL fel bland okända ord, aldrig frikänna eller fälla ett ord ordlistan
 * redan dömt. Fail-open: tomt svar = inga fel.
 */
export async function bedomOkandaOrd(ord: string[]): Promise<string[]> {
  const key = geminiNyckel();
  if (!key || !ord.length) return [];
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text:
          "Nedan är ord som lästs av från en skylt i en bild. Avgör för varje ord om det är KORREKT STAVAD SVENSKA. " +
          "Sammansatta ord, böjningar, egennamn, varumärken och förkortningar räknas som korrekta. " +
          "Ord med omkastade, dubblerade eller saknade bokstäver, eller med å/ä/ö på fel plats, räknas som FELSTAVADE.\n" +
          `Ord: ${ord.join(", ")}\n` +
          'Svara ENDAST med strikt JSON: {"felstavade":["..."]}' }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 200, thinkingConfig: { thinkingBudget: 0 }, responseMimeType: "application/json" },
      }),
    });
    if (!r.ok) return [];
    const data = await r.json();
    const raw = data?.candidates?.[0]?.content?.parts?.find((p: { text?: string }) => p.text)?.text || "";
    const lista = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || "{}").felstavade;
    if (!Array.isArray(lista)) return [];
    const tillatna = new Set(ord.map((o) => rensaOrd(o)));
    // Modellen får bara fälla ord som faktiskt skickades in som okända.
    return lista.map(String).filter((o) => tillatna.has(rensaOrd(o)));
  } catch {
    return [];
  }
}

/**
 * Grindens kärna: läs av bilden teckenvis och döm stavningen programmatiskt.
 * Fail-open vid tekniskt fel.
 */
export async function kontrolleraAvbildadText(
  bild: string,
  opts?: {
    forvantad?: string;
    /** Ord som redan är verifierade av ett annat lager (B3:s exakta text) — döms inte om. */
    ignorera?: string;
    fragaModellenOmOkanda?: boolean;
  },
): Promise<StavUtfall> {
  if (!geminiNyckel()) return { ok: true, text: "", ord: [], fel: [], orsak: "ingen-nyckel" };
  let ord: string[];
  try {
    ord = await lasOrdTeckenvis(bild);
  } catch {
    return { ok: true, text: "", ord: [], fel: [], orsak: "tekniskt-fel" };
  }
  const text = ord.join(" ");
  if (!ord.length) return { ok: true, text: "", ord: [], fel: [], orsak: "ingen-text" };

  // Känd förväntad sträng → exakt jämförelse går före ordlistan (B3:s logik).
  if (opts?.forvantad?.trim()) {
    const stammer = normaliseraTecken(text) === normaliseraTecken(opts.forvantad);
    return stammer
      ? { ok: true, text, ord, fel: [], orsak: "godkand" }
      : { ok: false, text, ord, fel: ord, orsak: "avviker" };
  }

  // B3-vägen har redan verifierat sin egen text bokstav för bokstav — bara ÖVRIG text
  // i bilden ska dömas här (annars underkänner vi det andra lagret redan godkänt).
  const bedomda = opts?.ignorera?.trim()
    ? ord.filter((o) => !normaliseraTecken(opts.ignorera!).includes(normaliseraTecken(o)))
    : ord;

  const fel = stavfel(bedomda);
  if (fel.length) return { ok: false, text, ord, fel, orsak: "felstavning" };

  if (opts?.fragaModellenOmOkanda !== false) {
    const okanda = okandaOrd(bedomda);
    if (okanda.length) {
      const extra = await bedomOkandaOrd(okanda);
      if (extra.length) return { ok: false, text, ord, fel: extra, orsak: "felstavning" };
    }
  }
  return { ok: true, text, ord, fel: [], orsak: "godkand" };
}

// ── Promptskärpningar (centrala, samma text i alla flöden) ─────────────────

export const SPELLING_REINFORCEMENT_EN =
  " SPELLING CORRECTION: the previous attempt rendered misspelled Swedish text on a sign in the scene. " +
  "Every Swedish word that appears on a screen, sign, board, poster, label or packaging must be spelled correctly, " +
  "letter by letter: use å, ä and ö only in words that actually have them, and never double, drop, reorder or invent letters. " +
  "Keep it to two to five short, ordinary Swedish words. If you cannot render the words correctly, leave the sign blank instead.";

export const BLANK_SIGN_EN =
  " IMPORTANT: leave every sign, screen, board, poster and label in the scene completely BLANK — " +
  "no letters, no words, no numbers anywhere in the image. Show the product, the people and the environment only. " +
  "A blank sign is required; misspelled text is not acceptable.";

export const SPELLING_REINFORCEMENT_SV =
  " STAVNING: förra försöket skrev felstavad svenska på en skylt i bilden. Varje svenskt ord på skärmar, " +
  "skyltar, tavlor, affischer, etiketter och förpackningar ska vara rättstavat, bokstav för bokstav: " +
  "å, ä och ö bara i ord som verkligen har dem, aldrig dubblerade, tappade, omkastade eller påhittade bokstäver. " +
  "Håll det till två till fem korta, vanliga svenska ord. Går det inte att stava rätt — lämna skylten tom i stället.";

export const BLANK_SIGN_SV =
  " VIKTIGT: lämna varje skylt, skärm, tavla, affisch och etikett i scenen HELT TOM — inga bokstäver, " +
  "inga ord, inga siffror någonstans i bilden. Visa bara produkten, människorna och miljön.";

export interface GrindResultat {
  /** Bilden som ska användas (alltid satt när ingångsbilden var satt). */
  image: string;
  utfall: StavUtfall;
  /** Antal omtag som gjordes med skärpt stavningsinstruktion. */
  omtag: number;
  /** true = sista försöket bad uttryckligen om TOM skylt. */
  blank: boolean;
}

/**
 * BILD-8a-grinden runt en redan genererad bild. Samma mönster som motivPassar: kontrollera
 * → omtag med förstärkt instruktion → hellre tom skylt än felstavad text. Fail-open i
 * varje riktning: går genereringen eller vision-anropet fel behålls den bild vi har.
 *
 * `generera` får skärpningen som ska läggas SIST i anroparens egen prompt — grinden
 * äger aldrig prompten, bara tillägget.
 */
export async function stavningsgrind(opts: {
  bild: string;
  generera: (v: { omtag: number; skarpning: string; blank: boolean }) => Promise<{ image?: string; error?: string }>;
  forvantad?: string;
  /** Text som ett annat lager redan verifierat (B3) — döms inte om här. */
  ignorera?: string;
  maxOmtag?: number;
  /** Tak för hur länge omtagen får hålla på (routens maxDuration är hård). */
  tidsbudgetMs?: number;
  /** false = sista utvägen "tom skylt" är förbjuden (texten ÄR poängen med bilden). */
  tillatBlank?: boolean;
  /** Injicerbart för test. */
  kontrollera?: (bild: string, o?: { forvantad?: string; ignorera?: string }) => Promise<StavUtfall>;
  nu?: () => number;
}): Promise<GrindResultat> {
  const kontrollera = opts.kontrollera || kontrolleraAvbildadText;
  const nu = opts.nu || Date.now;
  const maxOmtag = Math.max(0, Math.min(3, opts.maxOmtag ?? 2));
  const tidsbudget = opts.tidsbudgetMs ?? 30000;
  // Med känd förväntad text får skylten inte tömmas — då äger B3-vägen fallbacken.
  const tillatBlank = (opts.tillatBlank ?? true) && !opts.forvantad?.trim() && !opts.ignorera?.trim();
  const start = nu();
  const kvar = () => tidsbudget - (nu() - start);
  const kontrollOpts = { forvantad: opts.forvantad, ignorera: opts.ignorera };

  let bild = opts.bild;
  let utfall = await kontrollera(bild, kontrollOpts);
  if (utfall.ok) return { image: bild, utfall, omtag: 0, blank: false };

  let omtag = 0;
  while (omtag < maxOmtag && kvar() > 0) {
    omtag++;
    const gen = await opts.generera({ omtag, skarpning: SPELLING_REINFORCEMENT_EN, blank: false });
    if (!gen.image) break; // generering nere → behåll bästa bilden, blockera aldrig
    bild = gen.image;
    utfall = await kontrollera(bild, kontrollOpts);
    if (utfall.ok) return { image: bild, utfall, omtag, blank: false };
  }

  if (tillatBlank && kvar() > 0) {
    const gen = await opts.generera({ omtag: omtag + 1, skarpning: BLANK_SIGN_EN, blank: true });
    if (gen.image) {
      const blankUtfall = await kontrollera(gen.image, {});
      return { image: gen.image, utfall: blankUtfall, omtag, blank: true };
    }
  }
  return { image: bild, utfall, omtag, blank: false };
}
