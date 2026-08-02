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
//      den får bara yttra sig om ord programmatiken INTE känner igen, och kan aldrig
//      underkänna ett ord som ordlistan känner igen.
//
// BILD-8c (2026-08-02, efter DoD-bevisningen): två beteendeändringar.
//   a) Sista utvägen ber om ett TEXTLÖST MOTIV, inte om en tom skylt (kvarleva 2).
//   b) Bakgrundstext som läsriktningarna är OENSE om lämnas odömd (kvarleva 3).
// Grinden garanterar fortfarande INTE rätt stavning — 2 av 20 tog sig igenom i DoD:n.
// Garantin finns bara i fältet "Text i bilden" (B3), och det ska sägas rakt ut i UI:t.
//
// ⚠ FÄLLA 2 (BILD-8 DoD, skarpt fall a1): ordlistan är liten med flit, och korta svenska
// ord ligger tätt i redigeringsavstånd — "FÅ" i "KÖP 2 FÅ 1" är rättstavat men ligger ett
// tecken från "får". Närmiss är därför en MISSTANKE som textmodellen får bekräfta, inte en
// dom. Bara STRUKTURfel (glyfer utanför svenskan, bokstavsgröt) fälls utan att någon
// tillfrågas. Svarar modellen inte alls står misstanken kvar — fail-closed på misstanken.
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
  /** Avläst text (framlängesläsningen), ord separerade med mellanslag. */
  text: string;
  ord: string[];
  /** Baklängesläsningens ord, återvända. Döms tillsammans med `ord` — se FÄLLA 4. */
  ordBak?: string[];
  /** Modellens obearbetade transkriptioner — bevis/felsökning, aldrig grund för domen. */
  raw?: string;
  /** Orden som fälldes (tomt när ok). */
  fel: string[];
  /** BILD-8c: bakgrundsklotter som lämnades odömt (riktningsoenighet, ej huvudskylt). */
  ignorerad?: string[];
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

const FRAGA_FRAMLANGES =
  "Transkribera ALL text som syns i bilden (skyltar, skärmar, tavlor, affischer, etiketter) TECKEN FÖR TECKEN. " +
  "Separera varje tecken med mellanslag, varje ORD med | och varje radbrytning med /. " +
  "Autokorrigera INTE och gissa INTE — återge exakt de glyfer som syns, även om ordet blir felstavat eller obegripligt. " +
  "Svara ENDAST med sekvensen, eller INGEN om ingen text alls syns.";

// ⚠ FÄLLA 4 (BILD-8 DoD, skarpt fall a8): teckenseparationen räcker INTE. Affischen sa
// "HÖSTENS NYHIETER" och den framlängesläsningen svarade "N Y H E T E R" — 4 av 4 gånger,
// temperatur 0. Språkpriorn städar felet innan vi ser det, och att läsa om hjälper inte.
// BAKLÄNGES bryter priorn: modellen kan inte "rätta" ett ord den läser sista bokstaven
// först. Samma prov gav "R E T E I H Y N" (= NYHIETER) 4 av 4.
// Baklängesläsningen kastar om ordföljden och hittar ibland på en extra bokstav — därför
// ersätter den inte framlängesläsningen, den LÄGGS TILL. Ordföljd spelar ingen roll för
// en stavningsdom, och en falsk misstanke kostar ett omtag medan ett missat fel når kunden.
const FRAGA_BAKLANGES =
  "Läs av all text i bilden (skyltar, skärmar, tavlor, affischer, etiketter). " +
  "Skriv ut varje ord BAKLÄNGES, sista bokstaven först, ett tecken i taget separerat med mellanslag. " +
  "Separera varje ORD med | och varje radbrytning med /. " +
  "Läs av de glyfer som FAKTISKT står där, en i taget — rätta inte stavningen och fyll inte i vad du tror att det borde stå. " +
  "Svara ENDAST med sekvensen, eller INGEN om ingen text alls syns.";

// BILD-8c: avläsning av vad som står på bildens HUVUDsakliga skylt. Används BARA för att
// avgöra om ett ord riktningarna är oense om hör till motivet eller är bakgrundsklotter —
// aldrig som stavningsdom (den här läsningen autokorrigerar som alla andra holistiska).
const FRAGA_HUVUDTEXT =
  "Vilken text i bilden står på bildens HUVUDSAKLIGA skylt, skärm, affisch, tavla eller prislapp — den som är stor, i fokus och en del av bildens motiv? " +
  "Text som står smått i bakgrunden, på fasader eller skyltar längre bort, på förbipasserande föremål, eller som är suddig och svårläst räknas INTE med. " +
  "Svara ENDAST med orden som står på huvudskylten, separerade med | . Finns ingen tydlig huvudskylt: svara INGEN.";

const vandOrd = (s: string) => Array.from(s.normalize("NFC")).reverse().join("");

/**
 * Orden på bildens huvudskylt. `null` = tekniskt fel eller inget svar → anroparen ska
 * döma som förut (ingen filtrering), `[]` = ingen tydlig huvudskylt finns.
 */
export async function lasHuvudskyltOrd(bild: string): Promise<string[] | null> {
  const inline = await bildTillInline(bild);
  if (!inline) return null;
  const svar = await visionFraga(inline, FRAGA_HUVUDTEXT, 200);
  if (!svar) return null;
  if (svar.trim().toUpperCase() === "INGEN") return [];
  return svar.split(/[|/\n]+/).map((o) => o.trim()).filter(Boolean);
}

/**
 * Teckenvis transkription MED ordgränser, läst BÅDE framlänges och baklänges.
 * Ordgränserna behövs för att kunna slå upp varje ord i ordlistan; teckenseparationen och
 * baklängesläsningen behövs för att bryta autokorrigeringen (se FÄLLA 4 ovan).
 */
export async function lasOrdTeckenvis(image: string): Promise<{ raw: string; ord: string[]; ordBak: string[] }> {
  const inline = await bildTillInline(image);
  if (!inline) return { raw: "", ord: [], ordBak: [] };
  const [fram, bak] = await Promise.all([
    visionFraga(inline, FRAGA_FRAMLANGES, 600),
    visionFraga(inline, FRAGA_BAKLANGES, 600),
  ]);
  // "INGEN" = sentinel för ingen text. Modellen skriver den ibland teckenseparerat
  // ("I N G E N") och den föll då igenom som ett vanligt ord — därför prövas sentinelen
  // både på råsvaret och på det tolkade resultatet.
  const tolka = (r: string) => {
    if (!r || r.trim().toUpperCase() === "INGEN") return [];
    const o = parsaTeckenTranskription(r);
    return o.length === 1 && o[0].toUpperCase() === "INGEN" ? [] : o;
  };
  return {
    raw: `fram: ${fram} || bak: ${bak}`,
    ord: tolka(fram),
    ordBak: tolka(bak).map(vandOrd),
  };
}

/**
 * Tolka svaret från den teckenvisa transkriptionen till en ordlista.
 * Tolerant: modellen följer inte alltid formatet.
 *
 * ⚠ FÄLLA 3 (BILD-8 DoD, skarpt fall a1/a3): modellen använder ibland | mellan VARJE
 * TECKEN i stället för mellan orden — `N | Y | H | E | T | ! / E | N | D | A | S | T | | 8 …`.
 * Tolkas | då som ordgräns blir varje BOKSTAV ett "ord", och enstaka bokstäver ligger
 * ett redigeringssteg från riktiga ord → grinden fällde en helt korrekt skylt och brände
 * ett omtag. Vilken roll | har avgörs därför per rad: är de flesta |-segmenten ETT tecken
 * långa är | en teckenavgränsare, och ordgränsen är i stället den tomma luckan (| |).
 */
export function parsaTeckenTranskription(raw: string): string[] {
  const rensad = raw.normalize("NFC").replace(/^["'`]+|["'`]+$/g, "").trim();
  if (!rensad || rensad.toUpperCase() === "INGEN") return [];
  const ord: string[] = [];
  for (const rad of rensad.split(/[/\n]+/)) {
    if (!rad.trim()) continue;
    const segment = rad.split("|"); // tomma segment BEHÅLLS — de bär ordgränsen
    const ickeTomma = segment.map((s) => s.trim()).filter(Boolean);
    if (!ickeTomma.length) continue;
    const enteckensSegment = ickeTomma.filter((s) => s.length === 1).length;

    if (ickeTomma.length > 1 && enteckensSegment / ickeTomma.length >= 0.6) {
      // | är TECKENavgränsare → orden skiljs av tomma luckor.
      let bygge = "";
      for (const s of segment) {
        const t = s.trim();
        if (!t) {
          if (bygge) ord.push(bygge);
          bygge = "";
          continue;
        }
        bygge += t.split(/\s+/).join("");
      }
      if (bygge) ord.push(bygge);
      continue;
    }

    // | är ORDavgränsare → varje segment är ett ord (teckenseparerat inuti).
    for (const s of segment) {
      const tokens = s.trim().split(/\s+/).filter(Boolean);
      if (!tokens.length) continue;
      const enteckens = tokens.filter((t) => t.length === 1).length;
      if (tokens.length > 1 && enteckens / tokens.length >= 0.6) ord.push(tokens.join(""));
      else ord.push(...tokens);
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
 * Klassa ETT ord. Bara "otillaten" och "dubblering" är felstavning i sig — "narmiss" är
 * en MISSTANKE (bekräftas av textmodellen) och "okant" är ett ord vi inte känner igen,
 * som aldrig fälls av programmatiken.
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

/**
 * Ord med en STRUKTUR som inget svenskt ord har — otillåtna glyfer eller
 * bokstavsgröt. Fälls utan att någon tillfrågas.
 */
export function strukturfel(ord: string[]): string[] {
  return ord.filter((o) => {
    const s = ordStatus(o);
    return s === "otillaten" || s === "dubblering";
  });
}

/**
 * MISSTÄNKTA ord: ligger nära ett känt ord utan att vara det.
 *
 * ⚠ Skarpt fall (BILD-8 DoD, fall a1): "FÅ" i "KÖP 2 FÅ 1" är rättstavat men ligger ett
 * teckens avstånd från "får" → grinden fällde en korrekt skylt och tvingade fram tomma
 * skyltar. Korta svenska ord ligger tätt i redigeringsavstånd — närmiss är därför en
 * MISSTANKE som ska bekräftas, inte en dom. Ordlistan är avsiktligt liten och kan aldrig
 * ensam veta att ett ord utanför den är felstavat.
 */
export function misstanktaOrd(ord: string[]): string[] {
  return ord.filter((o) => ordStatus(o) === "narmiss");
}

/** Ord programmatiken inte känner igen — endast dessa får modellen yttra sig om. */
export function okandaOrd(ord: string[]): string[] {
  return ord.filter((o) => ordStatus(o) === "okant");
}

/**
 * BILD-8c, steg 1: ord som (a) bara EN av läsriktningarna såg och (b) skulle kunna fällas.
 *
 * ⚠ Skarpt fall (BILD-8 DoD, kvarleva 3): i a1 fälldes uppfunna butiksnamn på fasader i
 * BAKGRUNDEN (`BRYGGARI`, `DELBRAUCH`, `SLOGEUM`) — text som varken var läsbar i
 * sammanhanget eller en del av budskapet. Riktningarna var helt oense om vad som stod
 * där, vilket är signalen att texten är för liten för att bedöma. Kostnaden blev ett
 * omtag och till sist en tömd skylt på en bild vars poäng var att skylten sa något.
 *
 * Oenighet ensam får ALDRIG frikänna: i a8 sa framlänges `NYHETER` och baklänges
 * `NYHIETER` om huvudmotivets affisch, och det är exakt det felet grinden finns för.
 * Därför är det här bara steg 1 — steg 2 (`ordAttIgnorera`) kräver att ordet inte hör
 * till huvudskylten.
 */
export function oenigaRiskord(bedomda: string[], ord: string[], ordBak: string[]): string[] {
  if (!ord.length || !ordBak.length) return []; // en riktning saknas → ingen oenighet att mäta
  const iFram = new Set(ord.map(normaliseraTecken));
  const iBak = new Set(ordBak.map(normaliseraTecken));
  return bedomda.filter((o) => {
    const n = normaliseraTecken(o);
    if (iFram.has(n) && iBak.has(n)) return false; // båda riktningarna såg ordet
    const s = ordStatus(o);
    return s === "otillaten" || s === "dubblering" || s === "narmiss" || s === "okant";
  });
}

/**
 * Hör ordet till huvudskylten? Jämförelsen är LUDD med flit: huvudskyltsavläsningen är
 * holistisk och autokorrigerar, så den svarar gärna `NYHETER` där bilden säger `NYHIETER`.
 * Ett exakt medlemskapstest hade då klassat själva felstavningen som bakgrund och släppt
 * igenom den — precis det fel BILD-8 byggdes för att fånga.
 */
export function tillhorHuvudtext(ord: string, huvud: string[]): boolean {
  const n = rensaOrd(ord);
  if (!n) return true;
  const tak = narmissTak(n.length);
  return huvud.some((h) => {
    const hn = rensaOrd(h);
    if (!hn) return false;
    if (hn === n) return true;
    return Math.abs(hn.length - n.length) <= tak && avstand(hn, n) <= tak;
  });
}

/** BILD-8c, steg 2: vilka av riskorden som ska lämnas odömda (bakgrundsklotter). */
export function ordAttIgnorera(kandidater: string[], huvud: string[]): string[] {
  return kandidater.filter((o) => !tillhorHuvudtext(o, huvud));
}

/**
 * Andra åsikt om ord programmatiken INTE känner igen (okända + närmissar). Ren TEXT-fråga
 * (ingen bild) — autokorrigeringsfällan gäller bildavläsning, inte textbedömning. Modellen
 * får bara yttra sig om de ord som skickas in, aldrig om ord ordlistan redan känner igen
 * eller som fällts på struktur.
 *
 * Returnerar `null` vid TEKNISKT fel (ingen nyckel, nätverk, ogiltigt svar) så anroparen
 * kan skilja "modellen hittade inga fel" från "modellen svarade inte" — misstänkta ord
 * ska fällas i det senare fallet, inte frikännas.
 */
export async function bedomOkandaOrd(ord: string[]): Promise<string[] | null> {
  const key = geminiNyckel();
  if (!ord.length) return [];
  if (!key) return null;
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
    if (!r.ok) return null;
    const data = await r.json();
    const raw = data?.candidates?.[0]?.content?.parts?.find((p: { text?: string }) => p.text)?.text || "";
    const lista = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || "{}").felstavade;
    if (!Array.isArray(lista)) return null;
    const tillatna = new Set(ord.map((o) => rensaOrd(o)));
    // Modellen får bara fälla ord som faktiskt skickades in som okända.
    return lista.map(String).filter((o) => tillatna.has(rensaOrd(o)));
  } catch {
    return null;
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
    /** false = hoppa över BILD-8c:s bakgrundsfilter (test/offline). */
    huvudskylt?: boolean;
    /** Injicerbar huvudskyltsavläsning för test. */
    lasHuvudskylt?: (bild: string) => Promise<string[] | null>;
  },
): Promise<StavUtfall> {
  if (!geminiNyckel()) return { ok: true, text: "", ord: [], fel: [], orsak: "ingen-nyckel" };
  let ord: string[];
  let ordBak: string[];
  let raw = "";
  try {
    const avlast = await lasOrdTeckenvis(bild);
    ord = avlast.ord;
    ordBak = avlast.ordBak;
    raw = avlast.raw;
  } catch {
    return { ok: true, text: "", ord: [], fel: [], orsak: "tekniskt-fel" };
  }
  const text = ord.join(" ");
  if (!ord.length && !ordBak.length) return { ok: true, text: "", ord: [], ordBak, raw, fel: [], orsak: "ingen-text" };

  // Känd förväntad sträng → exakt jämförelse går före ordlistan (B3:s logik).
  if (opts?.forvantad?.trim()) {
    const stammer = normaliseraTecken(text) === normaliseraTecken(opts.forvantad);
    return stammer
      ? { ok: true, text, ord, raw, fel: [], orsak: "godkand" }
      : { ok: false, text, ord, raw, fel: ord, orsak: "avviker" };
  }

  // Båda läsriktningarna döms. Dubbletter (samma ord i båda) faller bort; skiljer de sig
  // åt bedöms BÅDA formerna — den felstavade fälls då även om den andra läsningen städat
  // felet (skarpt fall a8: fram "NYHETER", bak "NYHIETER", affischen sa NYHIETER).
  const sedda = new Set<string>();
  let bedomda = [...ord, ...ordBak].filter((o) => {
    const n = normaliseraTecken(o);
    if (!n || sedda.has(n)) return false;
    sedda.add(n);
    // B3-vägen har redan verifierat sin egen text bokstav för bokstav — bara ÖVRIG text
    // i bilden ska dömas här (annars underkänner vi det andra lagret redan godkänt).
    return !opts?.ignorera?.trim() || !normaliseraTecken(opts.ignorera).includes(n);
  });

  // BILD-8c (Håkans beslut 2/8): bakgrundstext IGNORERAS när läsriktningarna är oense om
  // den. Avläsningen av huvudskylten hämtas bara när det faktiskt finns ett riskord att
  // avgöra — kostar inget i det vanliga fallet. Svarar den inte (null) döms allt som förut:
  // en falsk misstanke kostar ett omtag, ett missat fel når kunden.
  let ignorerad: string[] = [];
  const riskord = opts?.huvudskylt === false ? [] : oenigaRiskord(bedomda, ord, ordBak);
  if (riskord.length) {
    const huvud = await (opts?.lasHuvudskylt || lasHuvudskyltOrd)(bild);
    if (huvud) {
      const bort = new Set(ordAttIgnorera(riskord, huvud).map(normaliseraTecken));
      if (bort.size) {
        ignorerad = bedomda.filter((o) => bort.has(normaliseraTecken(o)));
        bedomda = bedomda.filter((o) => !bort.has(normaliseraTecken(o)));
      }
    }
  }
  const medIgnorerad = ignorerad.length ? { ignorerad } : {};

  // 1. Strukturfel fälls direkt — otillåtna glyfer och bokstavsgröt finns inte i svenska.
  const struktur = strukturfel(bedomda);
  if (struktur.length) return { ok: false, text, ord, ordBak, raw, ...medIgnorerad, fel: struktur, orsak: "felstavning" };

  // 2. Misstänkta (närmiss) + okända ord avgörs av textmodellen. Ordlistan är för liten
  //    för att ensam fälla ett ord den inte har ("FÅ" i "KÖP 2 FÅ 1" — skarpt fall).
  const misstankta = misstanktaOrd(bedomda);
  const okanda = okandaOrd(bedomda);
  if (opts?.fragaModellenOmOkanda === false) {
    // Programmatiskt läge (test/offline): misstanken står kvar som dom.
    return misstankta.length
      ? { ok: false, text, ord, ordBak, raw, ...medIgnorerad, fel: misstankta, orsak: "felstavning" }
      : { ok: true, text, ord, ordBak, raw, ...medIgnorerad, fel: [], orsak: "godkand" };
  }
  if (misstankta.length || okanda.length) {
    const dom = await bedomOkandaOrd([...misstankta, ...okanda]);
    // Svarade modellen inte alls: närmissarna fälls (fail-closed på misstanken),
    // helt okända ord släpps (fail-open — de har aldrig haft någon grund).
    const fel = dom === null ? misstankta : dom;
    if (fel.length) return { ok: false, text, ord, ordBak, raw, ...medIgnorerad, fel, orsak: "felstavning" };
  }
  return { ok: true, text, ord, ordBak, raw, ...medIgnorerad, fel: [], orsak: "godkand" };
}

// ── Promptskärpningar (centrala, samma text i alla flöden) ─────────────────

export const SPELLING_REINFORCEMENT_EN =
  " SPELLING CORRECTION: the previous attempt rendered misspelled Swedish text on a sign in the scene. " +
  "Every Swedish word that appears on a screen, sign, board, poster, label or packaging must be spelled correctly, " +
  "letter by letter: use å, ä and ö only in words that actually have them, and never double, drop, reorder or invent letters. " +
  "Keep it to two to five short, ordinary Swedish words. If you cannot render the words correctly, keep the sign out of the frame entirely — never show it blank.";

// ── Sista utvägen: TEXTLÖST MOTIV, inte tom skylt ──────────────────────────
// ⚠ Skarpt fall (BILD-8 DoD, kvarleva 2): den gamla sista utvägen bad om TOM skylt och
// gav vita skärmar och tomma etikettrutor i 6 av 20 bilder — precis det BILD-7a byggdes
// för att få bort. Kravet "rätt stavat eller blankt" var uppfyllt, men blankt är ett
// sämre inlägg: en tom skylt läses som trasig, inte som ren.
// Håkans beslut 2/8: be om ett motiv UTAN textbärande yta i bild i stället.
export const TEXTFRITT_MOTIV_EN =
  " LAST RESORT, RECOMPOSE THE SCENE: show this subject from an angle where NO text-bearing surface is in the frame at all. " +
  "Do NOT show a blank or empty sign, screen, board, poster, menu or price tag — an empty sign reads as broken, not as clean. " +
  "Instead build the picture around the people, their hands at work, the product itself, the room and the light, " +
  "and leave signs and screens out of frame or naturally absent. No letters, no words and no numbers anywhere in the image.";

export const SPELLING_REINFORCEMENT_SV =
  " STAVNING: förra försöket skrev felstavad svenska på en skylt i bilden. Varje svenskt ord på skärmar, " +
  "skyltar, tavlor, affischer, etiketter och förpackningar ska vara rättstavat, bokstav för bokstav: " +
  "å, ä och ö bara i ord som verkligen har dem, aldrig dubblerade, tappade, omkastade eller påhittade bokstäver. " +
  "Håll det till två till fem korta, vanliga svenska ord. Går det inte att stava rätt: håll skylten utanför bild i stället, visa den aldrig tom.";

export const TEXTFRITT_MOTIV_SV =
  " SISTA UTVÄGEN, KOMPONERA OM SCENEN: visa motivet från ett håll där ingen textbärande yta alls är i bild. " +
  "Visa INTE en tom skylt, skärm, tavla, affisch, meny eller prislapp — en tom skylt läses som trasig, inte som ren. " +
  "Bygg bilden kring människorna, händerna som arbetar, produkten, rummet och ljuset, och låt skyltar och skärmar " +
  "hamna utanför bild eller saknas naturligt. Inga bokstäver, inga ord och inga siffror någonstans i bilden.";

export interface GrindResultat {
  /** Bilden som ska användas (alltid satt när ingångsbilden var satt). */
  image: string;
  utfall: StavUtfall;
  /** Antal omtag som gjordes med skärpt stavningsinstruktion. */
  omtag: number;
  /** true = sista försöket bad om ett TEXTLÖST MOTIV (ingen textbärande yta i bild). */
  blank: boolean;
}

/**
 * BILD-8a-grinden runt en redan genererad bild. Samma mönster som motivPassar: kontrollera
 * → omtag med förstärkt instruktion → hellre ett textlöst motiv än felstavad text.
 * Fail-open i varje riktning: går genereringen eller vision-anropet fel behålls bilden.
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
  /** false = sista utvägen (textlöst motiv) är förbjuden — texten ÄR poängen med bilden. */
  tillatBlank?: boolean;
  /** Injicerbart för test. */
  kontrollera?: (bild: string, o?: { forvantad?: string; ignorera?: string }) => Promise<StavUtfall>;
  nu?: () => number;
}): Promise<GrindResultat> {
  const kontrollera = opts.kontrollera || kontrolleraAvbildadText;
  const nu = opts.nu || Date.now;
  const maxOmtag = Math.max(0, Math.min(3, opts.maxOmtag ?? 2));
  const tidsbudget = opts.tidsbudgetMs ?? 30000;
  // Med känd förväntad text får motivet inte göras textfritt — då äger B3-vägen fallbacken.
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
    const gen = await opts.generera({ omtag: omtag + 1, skarpning: TEXTFRITT_MOTIV_EN, blank: true });
    if (gen.image) {
      const blankUtfall = await kontrollera(gen.image, {});
      return { image: gen.image, utfall: blankUtfall, omtag, blank: true };
    }
  }
  return { image: bild, utfall, omtag, blank: false };
}
