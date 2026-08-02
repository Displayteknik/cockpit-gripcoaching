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

/** Prompten som /api/ai/transcribe skickar. Delas med klienten så samma grind kan köras där. */
export const TRANSKRIBERINGS_PROMPT =
  "Transkribera detta tal på svenska, ordagrant men med korrekt interpunktion. " +
  "Returnera ENBART den transkriberade texten — inga rubriker, inga kommentarer.";

/** Inget tal uppfattades — användaren kan göra om försöket. */
export const ROST_FELMEDDELANDE = "Kunde inte uppfatta rösten, försök igen";

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
  return text;
}
