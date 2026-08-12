// Skyddsnät för röst→text (KVALITET-3 punkt 9).
//
// BAKGRUND (verifierat mot Gemini 2.5 flash 2026-08-01): när ljudet är för kort eller
// saknar tal svarar modellen ibland genom att UPPREPA instruktionen ordagrant i stället
// för att transkribera. Routen läste tidigare `parts[0].text` rakt av, så systeminstruktionen
// ("Transkribera detta tal på svenska, ordagrant men med korrekt interpunktion…") hamnade
// i användarens ämnesfält. Reproducerat med 0,2 s tystnad som wav.
//
// Regeln här är DETERMINISTISK — ingen AI. Den jämför svaret mot den prompt som skickades
// och underkänner ekon. Ett äkta transkript ("transkribera det här mötet åt mig") ska INTE
// fastna: kravet är att svaret ligger nära HELA instruktionen, inte att ett ord matchar.

/**
 * ★ TYSTNADSMARKÖREN (FIX-1/A1).
 *
 * Det gamla skyddsnätet fångade bara ett felläge: att modellen ekar tillbaka instruktionen.
 * Det finns ett andra, farligare läge — modellen HITTAR PÅ ett flytande transkript när
 * ljudet är tyst eller för svagt.
 *
 * Reproducerat 2026-08-07 i Lägg till kontakt: Håkan sa "Anna Andersson vill boka ett
 * möte" och fick tillbaka "Det är ju så att vi har ju en väldigt stor del av vår befolkning
 * som är födda i andra länder." Ingen felhörning — en fabricering. Den passerade eko-grinden
 * utan problem, eftersom den inte liknar instruktionen. Den ser ut som ett giltigt svar.
 *
 * Därför måste modellen få ett SÄTT ATT SÄGA "inget tal". Utan ett sådant utfall tvingas
 * den producera text, och en språkmodell som måste producera text producerar text.
 *
 * Markören är avsiktligt kantig och osvensk: den ska aldrig kunna vara ett äkta transkript.
 */
export const TYSTNADS_MARKOR = "[INGET_TAL]";

/** Prompten som /api/ai/transcribe skickar. Delas med klienten så samma grind kan köras där. */
export const TRANSKRIBERINGS_PROMPT =
  "Transkribera detta tal på svenska, ordagrant men med korrekt interpunktion. " +
  "Returnera ENBART den transkriberade texten — inga rubriker, inga kommentarer. " +
  `Innehåller ljudet inget tydligt tal — tystnad, brus, bakgrundsljud eller för svag röst — svara EXAKT ${TYSTNADS_MARKOR} och ingenting annat. ` +
  "Gissa ALDRIG vad som kan ha sagts, och fyll aldrig ut med en trolig mening.";

/**
 * Minsta rimliga ljudmängd. Fångar avbrutna uppladdningar och nollängdsklipp innan de
 * kostar ett modellanrop. Medvetet LÅGT satt: en sekund tal i opus är ~3 kB, och hellre
 * släppa igenom ett kort klipp till modellen (som nu kan svara [INGET_TAL]) än att avvisa
 * någon som pratade fort. Okomprimerad wav är stor även vid tystnad — därför är golvet
 * ett komplement till markören, aldrig ersättningen för den.
 */
export const MIN_LJUD_BYTES = 1200;

/** Inget tal uppfattades — användaren kan göra om försöket. */
export const ROST_FELMEDDELANDE = "Kunde inte uppfatta rösten, försök igen";

/**
 * ROST-2 (Håkans fynd 2026-08-11): han sa "Eva Andersson via LinkedIn" och fick "Kunde inte
 * uppfatta rösten, försök igen" — och frågade om tokens tagit slut. Det var inte tokens: kvot,
 * betalning och kostnadstak har egna texter sedan 1/8. Men den generiska raden slår ihop TRE
 * olika lägen, och två av dem är inte användarens fel:
 *
 *   tystnad → modellen svarade [INGET_TAL]. Ljudet saknade tydligt tal: för kort klipp, för
 *             låg nivå, eller fel mikrofon vald i webbläsaren. HÄR kan användaren göra något.
 *   eko     → modellen upprepade instruktionen i stället för att transkribera. Internt fel.
 *   tomt    → modellen svarade ingenting alls. Internt fel.
 *
 * Ett meddelande som säger "försök igen" när felet ligger hos oss får användaren att prata
 * tydligare i onödan — och att undra över tokens. Texterna är därför skilda, och orsaken
 * följer med i svaret så loggen kan läsas i efterhand.
 */
export type RostOrsak = "tystnad" | "eko" | "tomt";

export const ROST_ORSAKSTEXT: Record<RostOrsak, string> = {
  tystnad:
    "Hörde inget tal i inspelningen. Håll knappen intryckt medan du pratar, och kontrollera att rätt mikrofon är vald i webbläsaren.",
  eko: "Röstavläsningen svarade fel — det är inget du har gjort. Försök igen.",
  tomt: "Röstavläsningen kom tillbaka tom — det är inget du har gjort. Försök igen.",
};

/** Vilket av de tre lägena ett underkänt svar var. Anroparen väljer text ur ROST_ORSAKSTEXT. */
export function rostOrsak(ravar: unknown, prompt: string = TRANSKRIBERINGS_PROMPT): RostOrsak {
  const text = typeof ravar === "string" ? ravar.trim() : "";
  if (!text) return "tomt";
  if (arPromptEko(text, prompt)) return "eko";
  return "tystnad";
}

/** Inspelningen blev för kort för att innehålla tal. */
export const ROST_FOR_KORT = "Inspelningen blev för kort, håll knappen intryckt medan du pratar";

/**
 * Tjänsten svarade inte — fel som användaren INTE kan göra något åt (spärrat konto,
 * nertid, kvot). Egen text så ingen letar efter ett röstfel som inte finns.
 *
 * BAKGRUND (2026-08-01): Googles projekt var betalningsspärrat och svarade 403
 * "Lightning dunning decision is deny". Routen loggade bara statuskoden och visade
 * "Kunde inte uppfatta rösten" — så felet såg ut som en trasig röstfunktion i stället
 * för ett spärrat konto. Ett fel som döljer sin egen orsak kostar mer än felet självt.
 */
export const ROST_TJANSTEFEL = "Tjänsten svarar inte just nu. Försök igen om en stund.";

function normalisera(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function ord(s: string): string[] {
  const n = normalisera(s);
  return n ? n.split(" ") : [];
}

/** Ord som bär instruktionens identitet — korta funktionsord ger falska träffar. */
function barande(s: string): string[] {
  return Array.from(new Set(ord(s).filter((o) => o.length >= 4)));
}

/**
 * true = svaret är ett eko av systeminstruktionen och får ALDRIG skrivas till ett fält.
 * Tre oberoende kriterier, vilket som helst räcker:
 *  1. Svaret är en bit av prompten (modellen upprepade en del av den).
 *  2. Svaret inleds med promptens inledning (modellen upprepade och fortsatte).
 *  3. Minst 60 % av promptens bärande ord finns i svaret.
 */
export function arPromptEko(svar: string, prompt: string = TRANSKRIBERINGS_PROMPT): boolean {
  const s = normalisera(svar);
  const p = normalisera(prompt);
  if (!s || !p) return false;

  // 1. Svaret ryms i prompten
  if (s.length >= 12 && p.includes(s)) return true;

  // 2. Svaret börjar med promptens första ord
  const inledning = ord(prompt).slice(0, 6).join(" ");
  if (inledning.length >= 12 && s.startsWith(inledning)) return true;

  // 3. Täckningsgrad av promptens bärande ord
  const promptOrd = barande(prompt);
  if (promptOrd.length >= 5) {
    const svarsOrd = new Set(ord(svar));
    const traffar = promptOrd.filter((o) => svarsOrd.has(o)).length;
    if (traffar / promptOrd.length >= 0.6) return true;
  }

  return false;
}

/**
 * Returnerar transkriptionen — eller null om den inte duger.
 * null täcker både tomt svar och promptleak; anroparen svarar med ROST_FELMEDDELANDE.
 */
export function rensaTranskription(
  ravar: unknown,
  prompt: string = TRANSKRIBERINGS_PROMPT,
): string | null {
  const text = typeof ravar === "string" ? ravar.trim() : "";
  if (!text) return null;
  if (arPromptEko(text, prompt)) return null;
  if (arTystnad(text)) return null;
  return text;
}

/**
 * Sant när modellen signalerat att ljudet saknar tal.
 *
 * Matchar markören tolerant: modeller lägger till punkt, citattecken eller radbrytning
 * runt en sentinel även när instruktionen säger "svara EXAKT". Ett svar som BARA består
 * av markören plus skiljetecken räknas som tystnad. Ett svar där markören står mitt i en
 * mening gör det INTE — då har modellen transkriberat något och råkat nämna den.
 */
export function arTystnad(text: string): boolean {
  const t = (text || "").trim();
  if (!t) return true;
  const utanSkiljetecken = t.replace(/^[\s"'`*_.:—–-]+|[\s"'`*_.:—–-]+$/g, "");
  if (utanSkiljetecken.toUpperCase() === TYSTNADS_MARKOR) return true;
  // Modellen skriver ibland markören utan klamrar eller med mellanslag i stället för _.
  const kompakt = utanSkiljetecken.toUpperCase().replace(/[[\]\s_]/g, "");
  return kompakt === "INGETTAL";
}
