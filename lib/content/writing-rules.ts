// GLOBALA SKRIVREGLER — gäller alla tenants och alla innehållstyper
// (inlägg, captions, blogg, mejl, nyhetsbrev). EN källa för både promptlagret
// och saneringslagret, så reglerna aldrig kan driva isär.
//
// Lager 1 (prompt): WRITING_RULES_BLOCK vävs in i promptbygget, på samma nivå
//   som anatomilagret (röst → anatomi → funnel → 4A → DISC → skrivregler).
// Lager 2 (sanering): sanitizeGenerated() är ett deterministiskt skyddsnät som
//   körs på färdig text innan den visas och innan publicering. Modellen kan slarva,
//   saneringen kan inte.
//
// Per-tenant avstängning: clients.writing_rules_enabled (default true).

// ── Regel 1: tankstreck ───────────────────────────────────────────────────────
// Tankstreck (– en dash, — em dash) får inte användas som paus- eller inskottstecken.
// Bindestreck (-) i sammansatta ord (LED-vägg, före/efter-bilder) är korrekt svenska
// och rörs ALDRIG. Siffer-intervall utan mellanslag (10–12, 2020–2024) rörs inte heller.

// ── Regel 3: hashtags ─────────────────────────────────────────────────────────
export const MAX_HASHTAGS = { instagram: 5, facebook: 5, linkedin: 3, default: 5 } as const;
export type HashtagKanal = keyof typeof MAX_HASHTAGS;

// ── Regel 5: frågeform (2026-08-09) ─────────────────────────────────────────
// Skarpt fall: karusellhooken "Sommaren dödar skärmar?" — ett PÅSTÅENDE med ett
// frågetecken påklistrat. Svenska frågor vänder ordföljden ("Dödar sommaren skärmar?")
// eller inleds med ett frågeord. Påstående-plus-frågetecken är en kvällstidningsteaser
// och en modell-tick, inte ett språkval, och den känns påklistrad i en fackmässig röst.
// Elliptiska frågor utan verb är helt korrekta och rörs inte ("Redo för sommaren?").
export const FRAGEFORM_REGEL =
  "5. FRÅGEFORM: en mening som slutar med frågetecken ska VARA en fråga. Antingen omvänd ordföljd med verbet först (\"Syns din skylt i solljus?\") eller ett frågeord först (vad, hur, när, varför, vilken). Sätt ALDRIG ett frågetecken på ett påstående: \"Sommaren dödar skärmar?\" är fel, \"Dödar sommaren skärmar?\" är rätt. Korta frågor utan verb är korrekta som de är (\"Redo för sommaren?\").";

// ── Regel 6: hooken måste infrias (2026-08-09) ──────────────────────────────
// Samma skarpa fall: hooken lovade "dödar" (dramatik) medan brödtexten landade i
// "ställer högst krav" (mycket mildare). Nyfikenhetsglappet öppnades och punkterades
// direkt. Hook-playbookens gyllene-zon-kedja säger att kroken lovar, brödtexten
// levererar — men playbooken laddas bara av fyra flöden. Regeln hör hemma här, där
// ALLA flöden ser den.
export const HOOKLOFTE_REGEL =
  "6. HOOKEN MÅSTE INFRIAS: det första raden lovar ska texten leverera. Lovar kroken ett dramatiskt utfall (\"dödar\", \"förstör\", \"kostar dig\") måste brödtexten faktiskt handla om det utfallet, inte om något mildare. Kan du inte infria löftet: skriv en krok som stämmer med det du faktiskt har att säga. En krok som punkteras i nästa mening läser som clickbait och kostar mer förtroende än den vinner uppmärksamhet.";

/** Promptblocket. Läggs sist i hierarkin så det vinner över stilinstruktioner ovanför. */
export const WRITING_RULES_BLOCK = [
  "=== GLOBALA SKRIVREGLER (gäller alltid, väger tyngst) ===",
  "1. TANKSTRECK: använd ALDRIG tankstreck (– eller —) som paus eller inskott i löptext.",
  "   Skriv punkt, komma eller kolon, eller formulera om meningen.",
  "   Bindestreck i sammansatta ord är korrekt och ska användas som vanligt: LED-vägg, före/efter-bilder, e-post.",
  "2. HOOK: första raden ska vara en direkt fråga till läsaren eller ett konkret påstående.",
  "   Öppna ALDRIG med en generalisering som \"många företag...\", \"i dagens samhälle...\" eller \"det är viktigt att...\".",
  "   En generalisering får komma tidigast på rad 2, aldrig som hook.",
  "3. HASHTAGS: max 3 till 5 relevanta taggar som faktiskt används och söks på.",
  "   På LinkedIn max 3. Hitta aldrig på slogan-taggar utan sökvolym (t.ex. #vireddarvarlden).",
  "4. CTA: exakt EN uppmaning per inlägg, alltid sist. Aldrig två olika saker att göra.",
  FRAGEFORM_REGEL,
  HOOKLOFTE_REGEL,
].join("\n");

// ── Dialogvarianten (AKUT-DM, 2026-08-09) ────────────────────────────────────
// Regel 2 (hook), 3 (hashtags) och 4 (CTA) är INLÄGGSREGLER. Läggs de på ett svar i en
// inkorg motsäger de dialoganatomin i prompt-core, som förbjuder just en avslutande
// uppmaning. Två regler om samma sak i samma instruktion är precis felet FIX-1 grupp A
// stängde: modellen följer tillståndet, inte förbudet, och utfallet blir slumpmässigt.
// Regel 1 (tankstreck) är språk, inte format, och gäller överallt.
export const WRITING_RULES_DIALOG = [
  "=== GLOBALA SKRIVREGLER (gäller alltid, väger tyngst) ===",
  "1. TANKSTRECK: använd ALDRIG tankstreck (– eller —) som paus eller inskott i löptext.",
  "   Skriv punkt, komma eller kolon, eller formulera om meningen.",
  "   Bindestreck i sammansatta ord är korrekt och ska användas som vanligt: LED-vägg, före/efter-bilder, e-post.",
  "2. INGA HASHTAGS. Det här är ett meddelande till en person, inte ett inlägg.",
  "3. Öppna inte med en generalisering (\"många företag...\", \"i dagens samhälle...\"). Möt det personen skrev.",
  // Frågeformen är SPRÅK, inte inläggsformat — den gäller lika mycket i en inkorg.
  // Hooklöftet gör det inte: ett svar har ingen krok att infria.
  FRAGEFORM_REGEL.replace(/^5\. /, "4. "),
].join("\n");

// ── Saneringslagret ───────────────────────────────────────────────────────────

/** Är raden ett punktlisteobjekt? (\"– punkt\", \"— punkt\", \"- punkt\", \"* punkt\") */
function arListrad(rad: string): boolean {
  return /^\s*[-–—*•]\s+\S/.test(rad);
}

/**
 * Regel 1: ta bort tankstreck som skiljetecken, behåll bindestreck och intervall.
 * - " – " / " — " (omgivet av mellanslag) → ", "
 * - "ord—ord" (em dash utan mellanslag) → ", " (em dash är aldrig korrekt i svenska sammansättningar)
 * - "10–12" (en dash utan mellanslag) → orört, det är ett intervall
 * - "LED-vägg" → orört
 * - Punktlistor med streck → orörda (raden börjar med streck + mellanslag)
 */
export function taBortTankstreck(text: string): string {
  const rader = String(text || "").split("\n");
  // En ensam rad som börjar med tankstreck är ett inskott, flera i rad är en lista.
  const listrader = new Set<number>();
  rader.forEach((r, i) => {
    if (!arListrad(r)) return;
    const foreListrad = i > 0 && arListrad(rader[i - 1]);
    const efterListrad = i < rader.length - 1 && arListrad(rader[i + 1]);
    if (foreListrad || efterListrad) listrader.add(i);
  });

  return rader
    .map((rad, i) => {
      if (listrader.has(i)) return rad; // äkta punktlista, rör inte strecket
      let ut = rad;
      // Inledande tankstreck som inte är en lista: "– Så här gör du" → "Så här gör du"
      ut = ut.replace(/^(\s*)[–—]\s+/, "$1");
      // Tankstreck omgivet av mellanslag → komma (både – och —).
      ut = ut.replace(/\s+[–—]\s+/g, ", ");
      // Em dash utan mellanslag → komma + mellanslag. En dash lämnas (intervall).
      ut = ut.replace(/\s*—\s*/g, ", ");
      // Städa dubbla skiljetecken som kan uppstå: "text, , mer" och ", ." → ", "
      ut = ut.replace(/,\s*,/g, ",").replace(/,\s*([.!?:;])/g, "$1");
      return ut;
    })
    .join("\n");
}

/**
 * Regel 1 för HTML (blogg-brödtext): tankstrecks-saneringen körs ENDAST på
 * textnoderna. Taggar och attribut lämnas orörda — href="x-y", hex-färger i
 * style-attribut och list-markup får aldrig gå genom textsaneringen. Hashtag-
 * städet hör inte hit alls ("#fff" i markup är ingen hashtag) — därför finns
 * det ingen hashtag-väg i den här funktionen.
 */
export function taBortTankstreckHtml(html: string): string {
  return String(html || "")
    .split(/(<[^>]+>)/)
    .map((del, i) => {
      if (i % 2 === 1) return del; // udda index = taggarna (capture-gruppen i split)
      if (!del) return del;
      // Direkt efter en inline-tagg ("</strong> — förklaring") är ett inledande
      // tankstreck ett inskott, aldrig en listmarkör (HTML-listor är <li>): → komma.
      const text = i > 0 ? del.replace(/^[ \t]*[–—][ \t]+/, ", ") : del;
      return taBortTankstreck(text);
    })
    .join("");
}

// ── Terminologi (KVALITET-3/punkt 7) ─────────────────────────────────────────
// Generella språkfixar på plattformsnivå: uttryck som är fel svenska eller fel
// fackterm oavsett bransch. INTE en tenant-ordlista — varje rad här ska vara lika
// riktig för en blomsteraffär som för en bilhandlare eller en coach.
//
// "högt ljus" är ljudteknik-svenska som smugit in i skärmtexter. Rätt term för hur
// starkt en skärm lyser är LJUSSTYRKA, och den böjs som utrum: hög ljusstyrka.
// Ordgränsen skyddar sammansättningar ("högt ljusinsläpp" rörs inte).
const TERMINOLOGI: { re: RegExp; ratt: string }[] = [
  { re: /\bhögt\s+ljus\b/gi, ratt: "hög ljusstyrka" },
  { re: /\bhögre\s+ljus\b/gi, ratt: "högre ljusstyrka" },
  { re: /\bhögsta\s+ljuset\b/gi, ratt: "högsta ljusstyrkan" },
];

/** Behåll versal begynnelsebokstav när ett uttryck byts ut mitt i en text. */
function medSammaVersal(original: string, ersattning: string): string {
  if (!original || !ersattning) return ersattning;
  const forsta = original[0];
  if (forsta !== forsta.toLowerCase() && forsta === forsta.toUpperCase()) {
    return ersattning[0].toUpperCase() + ersattning.slice(1);
  }
  return ersattning;
}

/**
 * Generella terminologifixar. Körs ALLTID (ingår i taBortFloskler, som är plattformens
 * kvalitetsgolv och inte kan stängas av per tenant) — en felaktig fackterm är lika fel
 * oavsett om klienten kört sina egna skrivregler eller inte.
 */
export function fixaTerminologi(text: string): string {
  let ut = String(text || "");
  for (const t of TERMINOLOGI) ut = ut.replace(t.re, (m) => medSammaVersal(m, t.ratt));
  return ut;
}

/** AI-floskler som aldrig får nå kundtext (befintlig grind, nu global). */
export function taBortFloskler(text: string): string {
  return fixaTerminologi(String(text || ""))
    .replace(/\bhandlar\s+inte\s+om\b/gi, "gäller inte")
    .replace(/\bhandlar\s+om\b/gi, "gäller")
    .replace(/\bkraftfullt\b/gi, "starkt").replace(/\bkraftfulla\b/gi, "starka").replace(/\bkraftfull\b/gi, "stark")
    .replace(/\bbanbrytande\b/gi, "nyskapande")
    .replace(/\bgame[-\s]?changer\b/gi, "avgörande")
    .replace(/\bnästa\s+nivå\b/gi, "längre")
    .replace(/\bholistiskt?\b/gi, "helhet").replace(/\bholistiska\b/gi, "helhets")
    .replace(/\bskalbar[t]?\b/gi, "lätt att växa");
}

/**
 * Regel 3: begränsa antal hashtags. Behåller ordningen och de första N (modellen
 * lägger de mest relevanta först). Rör bara fristående taggar, inte text.
 */
export function begransaHashtags(text: string, kanal: HashtagKanal = "default"): string {
  const max = MAX_HASHTAGS[kanal] ?? MAX_HASHTAGS.default;
  const traffar = String(text || "").match(/#[\p{L}\p{N}_]+/gu);
  if (!traffar || traffar.length <= max) return text;
  let n = 0;
  return String(text)
    .replace(/#[\p{L}\p{N}_]+/gu, (m) => (++n <= max ? m : ""))
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Hela skyddsnätet i ett anrop. Körs på all genererad text innan den visas i
 * Studio och innan publicering (även schemalagda inlägg som redan ligger i kön).
 */
export function sanitizeGenerated(text: string, opts: { kanal?: HashtagKanal; hashtags?: boolean } = {}): string {
  if (!text) return text;
  let ut = taBortTankstreck(text);
  ut = taBortFloskler(ut);
  if (opts.hashtags !== false) ut = begransaHashtags(ut, opts.kanal || "default");
  return ut;
}

/**
 * Per-tenant avstängning. Default PÅ: en klient som inte sagt något ska följa reglerna.
 * Fel vid läsning → på, skyddsnätet ska aldrig försvinna av ett databasfel.
 */
export async function skrivreglerPa(clientId: string | null | undefined): Promise<boolean> {
  if (!clientId) return true;
  try {
    const { supabaseService } = await import("@/lib/supabase-admin");
    const { data } = await supabaseService()
      .from("clients")
      .select("writing_rules_enabled")
      .eq("id", clientId)
      .maybeSingle();
    return data?.writing_rules_enabled !== false;
  } catch {
    return true;
  }
}

/**
 * T-5 (3): hitta klientens förbjudna ord/uttryck i en text (ordgräns, ej delsträng —
 * "AI" ska inte träffa "maj"). KONTROLL, inte fix: godtyckliga klientord kan inte
 * ersättas mekaniskt utan att grammatiken bryts, så träffar loggas i stället för
 * att gissas bort. Används också för att filtrera röst-exempel i prompten.
 */
export function hittaForbjudnaOrd(text: string, ord: string[]): string[] {
  const t = String(text || "");
  if (!t) return [];
  const traffar: string[] = [];
  for (const o of ord || []) {
    const w = String(o || "").trim();
    if (w.length < 2) continue;
    const esc = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(^|[^\\p{L}\\p{N}])${esc}(?=$|[^\\p{L}\\p{N}])`, "iu");
    if (re.test(t)) traffar.push(w);
  }
  return traffar;
}

/** Regel 2 (kontroll, inte fix): öppnar texten med en generalisering? */
export function harSvagHook(text: string): boolean {
  const forsta = String(text || "").split("\n").find((r) => r.trim())?.trim() || "";
  return /^(många|de flesta|alla|i dagens|i en värld|det är viktigt|numera|nuförtiden|allt fler)\b/i.test(forsta);
}

/**
 * Regel 4 (kontroll): fler än en uppmaning? Grov heuristik för granskning.
 *
 * KVALITET-3/punkt 7: ordlistan saknade "skicka" och "mejla", så CTA-golvets egna
 * exempelverb ("Skicka en bild på platsen...") räknades som NOLL CTA:er. Mätningen
 * underskattade därför varje korrekt imperativ-CTA. Listan ska spegla verben som
 * CTA-golvet i prompt-core faktiskt föreskriver.
 */
export function raknaCta(text: string): number {
  const m = String(text || "").match(
    /\b(svara|skriv|skicka|mejla|maila|dm:?a|boka|ring|klicka|läs mer|anmäl dig|kommentera|dela|följ)\b/gi,
  );
  return m ? m.length : 0;
}

// ── CTA-golvets efterhandskontroll (KVALITET-3/punkt 11) ─────────────────────
// Bakgrund: CTA-golvet i lib/prompt-core skärptes i T-6a till "imperativ med väg", men
// skarp drift visade att golvet är INTERMITTENT: en caption fick "Boka en digital fika,
// ingen säljpitch", nästa slutade i ett konstaterande följt av hashtags. En promptregel
// är ett förstahandsförsvar, inte en garanti. Därför en deterministisk kontroll på
// UTDATAN som kan utlösa exakt EN omgenerering.
//
// Skillnaden mot raknaCta(): raknaCta räknar FÖREKOMSTER av CTA-ord var som helst i
// texten ("du kan boka tid hos oss" räknas). CTA-golvet kräver något strängare — en
// UPPMANING I IMPERATIV: verbet ska stå först i sin sats. Det är exakt den skillnaden
// som skiljer "vi ser till att du får en offert" (konstaterande) från "Skicka en bild,
// få en offert inom 24 timmar" (uppmaning).
//
// Metoden: dela texten i satser, normalisera bort emoji/pilar/inledande bindeord, och
// kolla om satsen BÖRJAR med ett imperativverb. Sentence-initial-kravet gör hela
// grovjobbet gratis: "Vi hjälper dig att boka tid" har "boka" mitt i satsen efter "att"
// och faller, medan "Boka tid via länken" träffar. Ingen AI inblandad.

/** Enordsimperativ som i kundtext i praktiken alltid inleder en uppmaning. */
const CTA_VERB_ENKLA = [
  "boka", "beställ", "ring", "mejla", "maila", "messa", "skicka", "svara", "skriv",
  "kommentera", "dela", "tagga", "följ", "prenumerera", "anmäl", "registrera", "ansök",
  "besök", "kika", "testa", "prova", "hämta", "klicka", "tryck", "swipa", "spara",
  "läs", "lyssna", "kontakta", "hojta", "berätta", "välj", "dma",
];

// Verb vars stam är för tvetydig för att räknas ensam ("ta med dig det här" är en
// slutkläm, "ta kontakt" är en uppmaning). De kräver sin väg utskriven.
// ⚠ Ordslut skrivs som (?![\p{L}\p{N}]) med u-flaggan, ALDRIG \b. JS:s \b är
// ASCII-baserat: efter ett å/ä/ö finns ingen ordgräns, så /passa\s+på\b/ matchar aldrig
// "Passa på nu i augusti". Fällan kostade en röd testrad innan den syntes.
const SLUT = "(?![\\p{L}\\p{N}])";
const flerord = (kropp: string) => new RegExp(`^${kropp}${SLUT}`, "iu");

const CTA_MONSTER_FLERORD: RegExp[] = [
  flerord("dm:a"),
  flerord("hör\\s+(gärna\\s+)?av\\s+(dig|er)"),
  flerord("ta\\s+(kontakt|en\\s+titt|steget|första\\s+steget|chansen)"),
  flerord("kom\\s+(förbi|in|igång|hit|och)"),
  flerord("titta\\s+(in|förbi|här|på)"),
  flerord("kolla\\s+(in|här|gärna)"),
  flerord("spana\\s+in"),
  flerord("sväng\\s+förbi"),
  flerord("häng\\s+med"),
  flerord("hoppa\\s+in"),
  flerord("slå\\s+(oss\\s+)?en\\s+signal"),
  flerord("låt\\s+oss"),
  flerord("fyll\\s+i"),
  flerord("ladda\\s+(ner|hem)"),
  flerord("passa\\s+på"),
  flerord("(missa|glöm)\\s+inte"),
  flerord("tveka\\s+inte"),
  flerord("fråga\\s+(oss|gärna|på|vad)"),
  flerord("säg\\s+till"),
  flerord("se\\s+(mer|hur|hela|filmen|resultatet|själv)"),
  flerord("gå\\s+in\\s+på"),
  flerord("prata\\s+med\\s+oss"),
  flerord("använd\\s+(koden|rabattkoden|länken)"),
];

// Satser som BÖRJAR med ett imperativverb men aldrig är en CTA. "Kom ihåg att vattna"
// är en påminnelse, "Fråga dig själv" ett retoriskt grepp mitt i texten.
const CTA_UNDANTAG: RegExp[] = [flerord("kom\\s+ihåg"), flerord("fråga\\s+dig\\s+själv")];

/**
 * Tar bort hashtags så de aldrig stör satsanalysen. Rader som BARA är hashtags plockas
 * bort helt (det är hashtag-blocket sist i captionen), och lösa taggar mitt i texten
 * ersätts med blanksteg. Poängen: en korrekt CTA följd av "#skyltar #jämtland" ska
 * fortfarande läsas som en CTA.
 */
export function utanHashtags(text: string): string {
  return String(text || "")
    .split("\n")
    .filter((rad) => !/^\s*(?:#[\p{L}\p{N}_]+\s*)+$/u.test(rad))
    .join("\n")
    .replace(/#[\p{L}\p{N}_]+/gu, " ");
}

/** Skalar bort emoji, pilar, citattecken och inledande bindeord ur en sats. */
function normaliseraKlausul(klausul: string): string {
  return String(klausul || "")
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .replace(/^(?:så|och|men|eller|sen|sedan|därför|alltså|ps|p\.s\.|nu|idag|i\s+dag|här)\s+/iu, "")
    .trim();
}

/**
 * Alla satser i texten som är en uppmaning i imperativ. Returnerar satserna i den
 * ordning de står, så anroparen kan se BÅDE om golvet är uppfyllt och var CTA:n hamnade.
 */
export function hittaImperativCta(text: string): string[] {
  const ren = utanHashtags(text);
  if (!ren.trim()) return [];
  const traffar: string[] = [];
  // Satsgräns: skiljetecken, radbrytning eller komma följt av blanksteg. Kommat behövs
  // för mönstret "Boka en digital fika, ingen säljpitch" — och för det omvända,
  // "Är du nyfiken, hör av dig".
  for (const raa of ren.split(/[.!?:;\n]+|,\s+/)) {
    const k = normaliseraKlausul(raa);
    if (!k) continue;
    if (CTA_UNDANTAG.some((re) => re.test(k))) continue;
    const forstaOrd = (k.match(/^[\p{L}]+/u)?.[0] || "").toLowerCase();
    const enkelTraff = forstaOrd.length > 1 && CTA_VERB_ENKLA.includes(forstaOrd);
    if (enkelTraff || CTA_MONSTER_FLERORD.some((re) => re.test(k))) traffar.push(k);
  }
  return traffar;
}

/** Finns minst EN uppmaning i imperativ någonstans i texten? */
export function harImperativCta(text: string): boolean {
  return hittaImperativCta(text).length > 0;
}

/** Sista stycket (block skilt med tomrad), utan hashtag-rader. */
function slutstycke(text: string): string {
  const ren = utanHashtags(text).replace(/\n{3,}/g, "\n\n").trim();
  if (!ren) return "";
  const stycken = ren.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
  return stycken[stycken.length - 1] || "";
}

/** Sista MENINGEN i texten (hashtag-rader borträknade). */
function sistaMening(text: string): string {
  const styckeText = slutstycke(text);
  if (!styckeText) return "";
  const meningar = styckeText
    .split(/(?<=[.!?…])\s+/)
    .map((m) => m.trim())
    .filter(Boolean);
  return meningar[meningar.length - 1] || styckeText;
}

/**
 * CTA-golvet fullt ut: uppmaningen står i textens SISTA MENING.
 *
 * HÅKANS BESLUT 2026-08-01 (skärpning): golvet gäller BOKSTAVLIGT — CTA:n kommer sist,
 * platsrader, löften och annat läggs FÖRE den. Kontrollen mätte tidigare sista STYCKET,
 * vilket släppte igenom DoD-beviset caption 7: "Skicka en bild på trädet och var det
 * står, så återkommer vi. Vi finns i Roslagen och norra Stockholm." — uppmaningen fanns,
 * men läsaren lämnades i ett konstaterande.
 *
 * En klarläggare i SAMMA mening är fortfarande tillåten, eftersom meningen då slutar i
 * uppmaningen: "Boka en digital fika, ingen säljpitch." Däremot underkänns en ny mening
 * efter CTA:n, oavsett hur kort och vänlig den är.
 */
export function harCtaISlutet(text: string): boolean {
  return harImperativCta(sistaMening(text));
}

/** Skärpningen som skickas med vid omgenereringen. Exporterad för test och granskning. */
export const CTA_SKARPNING = [
  "=== RÄTTELSE: CTA-GOLVET BRÖTS (väger tyngst i den här körningen) ===",
  "Föregående version saknade en uppmaning. Skriv om texten så att den AVSLUTAS med exakt EN uppmaning i imperativ.",
  "Uppmaningen ska BÖRJA med ett verb i imperativform (Boka, Skicka, Ring, Mejla, Svara, Skriv, Kommentera, Dela, Läs, Kika, Testa, Kontakta, Besök, Anmäl dig, Hör av dig, Ta kontakt) och säga HUR eller VAR handlingen görs.",
  "Ett konstaterande är INTE en uppmaning. Dessa är alla FEL: \"vi hjälper dig gärna\", \"vi ser till att du får en offert\", \"du är välkommen att höra av dig\", \"det är bara att kontakta oss\", \"länk i bion\".",
  "Behåll budskapet, rösten och längden. Byt bara ut avslutet mot en riktig uppmaning.",
  "Uppmaningen ska vara textens SISTA MENING. Platsrader (\"Vi finns i Roslagen\"), löften (\"Vi hör av oss samma dag\") och annat placeras FÖRE den — aldrig efter.",
  "Finns hashtags ligger de kvar EFTER uppmaningen, på egen rad sist.",
].join("\n");

export interface CtaGolvUtfall {
  text: string;
  /** Kördes omgenereringen? (Sker högst EN gång, aldrig i loop.) */
  omgenererad: boolean;
  /** Uppfyller den returnerade texten golvet? false = fail-open, texten levereras ändå. */
  godkand: boolean;
}

/**
 * Efterhandskontrollen. Saknar texten en imperativ CTA görs EXAKT EN omgenerering med
 * CTA_SKARPNING som extra systeminstruktion.
 *
 * FAIL-OPEN är en hård regel: användaren ska aldrig bli utan text. Kastar omgenereringen,
 * svarar tomt eller misslyckas den också, returneras det bästa försöket och brottet loggas.
 * Ingen andra omgenerering sker någonsin — en loop mot en modell som inte lyder kostar
 * bara tid och pengar.
 */
export async function sakerstallCta(
  text: string,
  omgenerera: (skarpning: string) => Promise<string>,
  etikett = "caption",
): Promise<CtaGolvUtfall> {
  if (harCtaISlutet(text)) return { text, omgenererad: false, godkand: true };
  let ny = "";
  try {
    ny = String((await omgenerera(CTA_SKARPNING)) || "").trim();
  } catch (e) {
    console.warn(`[cta-golv] omgenerering kastade (${etikett}): ${(e as Error).message}`);
  }
  if (!ny) {
    console.warn(`[cta-golv] ${etikett}: ingen imperativ CTA och omgenereringen gav inget svar — levererar första försöket`);
    return { text, omgenererad: true, godkand: false };
  }
  if (harCtaISlutet(ny)) return { text: ny, omgenererad: true, godkand: true };
  console.warn(`[cta-golv] ${etikett}: ingen imperativ CTA ens efter omgenerering — levererar bästa försöket`);
  return { text: ny, omgenererad: true, godkand: false };
}

// ── Prisgrind (KVALITET-3/punkt 5) ───────────────────────────────────────────
// Plattformsregel: genererade inlägg, captions och bildtexter skriver inte ut priser
// på klientens egna produkter och tjänster. Värdet beskrivs i texten, priset tas i
// samtalet eller offerten dit uppmaningen leder.
//
// Här ligger BARA detektering — ingen mekanisk borttagning. Att klippa bort ett tal
// ur en färdig mening bryter grammatiken, och undantaget (användaren skrev själv in
// priset) kan inte avgöras av en regex på utdatan. Prompten är förstahandsförsvaret,
// den här funktionen är kvittot: flöden med flera kandidater kan välja bort, och
// saneringen loggar det som ändå slinker igenom.
//
// Mönstret kräver en VALUTAMARKÖR intill talet ("21 000 kr", "1 850:-", "SEK 400",
// "995 kr/mån"). Ett ensamt tal är inte ett pris — annars hade "43 tum" och "2026"
// fällts, och grinden hade blivit brus i stället för signal.
// "sek" i gemener är UTESLUTET som efterställd markör: "3 sek" är en videolängd, inte
// ett pris (reels-flödet är fullt av dem). Versalt SEK är däremot alltid valuta.
// Hårt blanksteg tas med i teckenklassen: profilernas tusenavgränsare är ofta just det.
const PRIS_MONSTER: RegExp[] = [
  /\d[\d\s\u00a0.,]*\s*(?::-|(?:kr|kronor)\b)/gi,
  /\d[\d\s\u00a0.,]*\s*SEK\b/g,
  /\b(?:kr|sek)\s*\d[\d\s\u00a0.,]*\d|\b(?:kr|sek)\s*\d/gi,
];

/** Alla prisuppgifter i texten (råa träffar, för logg och granskning). */
export function hittaPrisuppgifter(text: string): string[] {
  const t = String(text || "");
  if (!t) return [];
  const traffar: string[] = [];
  for (const re of PRIS_MONSTER) {
    for (const m of t.matchAll(re)) traffar.push(m[0].trim());
  }
  return [...new Set(traffar)];
}

/** Innehåller texten en prisuppgift? Används både för grind och för undantaget. */
export function harPrisuppgift(text: string): boolean {
  return hittaPrisuppgifter(text).length > 0;
}

// ── Siffergrind för färdig text (KVALITET-3/p11, Håkans beslut 2026-08-01) ────
// Den fail-closed siffergrinden i lib/studio/copy.ts skyddar bara studio-texten: där
// finns sju varianter att filtrera bland. En caption har bara en text, så samma krav
// måste bäras av en efterhandskontroll med EN omgenerering — samma mönster som CTA-golvet.
//
// BESLUTET: kravet gäller VARJE siffra, även jämförelser med omvärlden. DoD-beviset för
// p11 innehöll "en vanlig TV klarar sällan mer än 400 nits" — ett tal om andras produkter,
// lika obackat som ett tal om klienten. Finns siffran inte i profilen (eller i det
// användaren själv skrev) ska påståendet skrivas generellt i stället.

/** Alla tal i en text som jämförbara tokens ("3 500" och "3500" blir samma). */
export function talTokens(text: string): Set<string> {
  const ut = new Set<string>();
  for (const m of String(text || "").matchAll(/\d[\d\s.,]*\d|\d/g)) ut.add(m[0].replace(/[\s.,]/g, ""));
  return ut;
}

/**
 * Tal i texten som saknar täckning. Årtal och klockslag räknas inte som påståenden om
 * storlek — de är tidsangivelser och backas av säsongslagret/användarens egen text.
 */
export function obackadeSiffror(text: string, tillatna: Set<string>): string[] {
  const ut: string[] = [];
  for (const m of String(text || "").matchAll(/\d[\d\s.,]*\d|\d/g)) {
    const token = m[0].replace(/[\s.,]/g, "");
    if (tillatna.has(token)) continue;
    if (/^(?:19|20)\d{2}$/.test(token)) continue; // årtal
    if (/^\d{1,2}$/.test(token) && /(?:kl|klockan)\s*$/i.test(String(text).slice(0, m.index ?? 0))) continue; // klockslag
    ut.push(m[0]);
  }
  return ut;
}

export const SIFFER_SKARPNING = [
  "=== RÄTTELSE: OBACKAD SIFFRA (väger tyngst i den här körningen) ===",
  "Föregående version innehöll ett tal som inte finns i varumärkesprofilen. Skriv om texten UTAN det talet.",
  "Kravet gäller varje siffra, även jämförelser med omvärlden: konkurrenters produkter, branschsnitt och 'vad de flesta gör'.",
  "Skriv påståendet GENERELLT i stället — 'en vanlig skärm blir en svart spegel i solljus' i stället för ett påhittat antal enheter.",
  "Behåll budskapet, rösten, längden och avslutets uppmaning. Byt bara ut sifferpåståendet.",
].join("\n");

export interface TextGolvUtfall {
  text: string;
  omgenererad: boolean;
  godkand: boolean;
  /** Vad som fällde första försöket — för loggning och bevis. */
  brott: string[];
}

/**
 * Efterhandskontroll för färdig caption-text: CTA-golvet OCH siffergrinden i ETT svep.
 * Bryter någon av dem görs EXAKT EN omgenerering med de skärpningar som behövs.
 * FAIL-OPEN: användaren blir aldrig utan text.
 */
// ── Skenfrågor: påstående med frågetecken ────────────────────────────────────
// Deterministisk motsvarighet till FRAGEFORM_REGEL. Samma mönster som CTA-golvet och
// siffergrinden: prompten är första försvaret, den här är spärren.
//
// Metod, medvetet konservativ:
//   1. Slutar meningen med "?" och börjar med ett FRÅGEORD eller ett verb → korrekt fråga.
//   2. Saknar meningen finit verb helt → elliptisk fråga, helt korrekt ("Redo för sommaren?").
//   3. Finns ett troligt finit verb tidigt EFTER subjektet → rak ordföljd → skenfråga.
//
// Verbgissningen bygger på att svenska presensverb nästan alltid slutar på -r eller -s
// (dödar, ställer, kostar, syns, känns). Det är en heuristik, inte en parser: den missar
// verb som "vet" och "kan" mitt i satsen, och kan fälla en elliptisk fras med ett
// r-slutande substantiv. Fällan är billig — utfallet är EN omgenerering, aldrig ett
// stopp — medan missarna bara betyder att prompten får sköta jobbet ensam.
const FRAGEORD = new Set([
  "vad", "vem", "vems", "vilken", "vilket", "vilka", "var", "vart", "varifrån", "varför",
  "hur", "när", "huruvida",
]);

// Verb som naturligt inleder en svensk ja/nej-fråga (omvänd ordföljd = korrekt fråga).
const FRAGEVERB = new Set([
  "är", "var", "har", "hade", "kan", "kunde", "ska", "skall", "skulle", "vill", "ville",
  "gör", "gjorde", "blir", "blev", "finns", "fanns", "vet", "visste", "tror", "trodde",
  "behöver", "behövde", "känner", "kändes", "känns", "syns", "syntes", "kostar", "kostade",
  "hinner", "hann", "orkar", "orkade", "måste", "får", "fick", "går", "gick", "ligger",
  "sitter", "kommer", "kom", "låter", "lät", "fungerar", "funkar", "passar", "räcker",
  "stämmer", "händer", "hände", "betyder", "verkar", "ser", "såg", "hör", "hörde",
  "tar", "tog", "ger", "gav", "står", "stod", "vågar", "klarar", "klarade", "hänger",
  "undrar", "saknar", "saknas", "tänker", "önskar", "orkade", "vågade",
]);

function ordAv(mening: string): string[] {
  return mening
    .replace(/[«»"'"'()[\]{}]/g, " ")
    .split(/\s+/)
    .map((o) => o.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "").toLowerCase())
    .filter(Boolean);
}

// Vanliga funktionsord som slutar på -r eller -s men ALDRIG är verb. Utan dem läste
// heuristiken "för" i "Redo för sommaren?" som ett verb och fällde en korrekt elliptisk
// fråga. Listan är kort med flit: bara ord som är frekventa OCH omöjliga som predikat.
const ICKE_VERB = new Set([
  "för", "eller", "efter", "under", "över", "mellan", "genom", "utanför", "innanför",
  "framför", "hos", "ur", "vars", "dess", "oss", "hans", "hennes", "deras", "eras",
  "mer", "mindre", "flers", "alltför", "därför", "eftersom", "annars", "utom", "trots",
]);

/** Ser ordet ut som ett finit presensverb? (svenska presens slutar nästan alltid på -r/-s) */
function troligtVerb(ord: string): boolean {
  if (ord.length < 3) return false;
  if (FRAGEVERB.has(ord)) return true;
  // Frågeord är aldrig predikat. "hur" slutar på -r och fällde "Eller hur?" utan detta.
  if (ICKE_VERB.has(ord) || FRAGEORD.has(ord)) return false;
  return /(r|s)$/.test(ord);
}

/**
 * Meningar som slutar med "?" men är formulerade som påståenden.
 * Returnerar de fällda meningarna (ordagrant) — tom lista = inget brott.
 */
export function skenfragor(text: string): string[] {
  const rensad = utanHashtags(String(text || ""));
  // Dela på meningsslut men behåll skiljetecknet, så vi vet vilka som är frågor.
  const meningar = rensad.match(/[^.!?\n]+[.!?]/g) || [];
  const fallda: string[] = [];
  for (const rå of meningar) {
    const mening = rå.trim();
    if (!mening.endsWith("?")) continue;
    const ord = ordAv(mening);
    if (ord.length < 2) continue; // "Va?" och liknande
    // Äkta fråga: frågeord först, ELLER verb först (omvänd ordföljd). Verbet prövas med
    // samma heuristik som nedan — en handskriven verblista kan aldrig bli komplett, och
    // "Dödar sommaren skärmar?" föll på just det innan regeln blev symmetrisk.
    if (FRAGEORD.has(ord[0]) || troligtVerb(ord[0])) continue;
    // Rak ordföljd: subjekt först, verbet strax efter. Utan verb är frasen elliptisk.
    //
    // ⚠ Kandidaten får ALDRIG vara sista ordet. Svenska substantiv slutar ofta på -r
    // (skyltfönster, skärmar) och heuristiken kan inte skilja dem från verb — men ett
    // finit verb följs alltid av något. Utan den avgränsningen fälldes den fullt korrekta
    // elliptiska frasen "Ett bättre skyltfönster?".
    const sista = ord.length - 1;
    const harVerbEfterSubjekt = ord
      .slice(1, 4)
      .some((o, n) => n + 1 < sista && troligtVerb(o));
    if (harVerbEfterSubjekt) fallda.push(mening);
  }
  return fallda;
}

export const FRAGEFORM_SKARPNING = [
  "SKÄRPNING (frågeform): en eller flera meningar slutar med frågetecken men är skrivna som påståenden.",
  "Gör om VARJE sådan mening till en riktig fråga med omvänd ordföljd — verbet först: \"Sommaren dödar skärmar?\" blir \"Dödar sommaren skärmar?\".",
  "Eller skriv om den till ett rakt påstående med punkt, om budskapet är starkare så.",
  "Behåll innebörd, röst och längd. Rör inte de meningar som redan är korrekta frågor.",
].join("\n");

export async function sakerstallCaption(
  text: string,
  tillatnaTal: Set<string>,
  omgenerera: (skarpning: string) => Promise<string>,
  etikett = "caption",
): Promise<TextGolvUtfall> {
  const brottFor = (t: string): string[] => {
    const b: string[] = [];
    if (!harCtaISlutet(t)) b.push("cta");
    const siffror = obackadeSiffror(utanHashtags(t), tillatnaTal);
    if (siffror.length) b.push(`siffror:${siffror.join("|")}`);
    const sken = skenfragor(t);
    if (sken.length) b.push(`frageform:${sken.join("|")}`);
    return b;
  };
  const brott = brottFor(text);
  if (!brott.length) return { text, omgenererad: false, godkand: true, brott: [] };

  const skarpning = [
    brott.some((b) => b === "cta") ? CTA_SKARPNING : "",
    brott.some((b) => b.startsWith("siffror")) ? SIFFER_SKARPNING : "",
    brott.some((b) => b.startsWith("frageform")) ? FRAGEFORM_SKARPNING : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  let ny = "";
  try {
    ny = String((await omgenerera(skarpning)) || "").trim();
  } catch (e) {
    console.warn(`[textgolv] omgenerering kastade (${etikett}): ${(e as Error).message}`);
  }
  if (!ny) {
    console.warn(`[textgolv] ${etikett}: ${brott.join(", ")} — omgenereringen gav inget svar, levererar första försöket`);
    return { text, omgenererad: true, godkand: false, brott };
  }
  const kvar = brottFor(ny);
  if (!kvar.length) return { text: ny, omgenererad: true, godkand: true, brott };
  console.warn(`[textgolv] ${etikett}: ${kvar.join(", ")} kvarstår efter omgenerering — levererar bästa försöket`);
  return { text: ny, omgenererad: true, godkand: false, brott };
}
