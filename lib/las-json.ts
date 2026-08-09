// Klient-hjälpare: läs ett svar som JSON, men säg vad som HÄNDE när det inte är JSON.
//
// Bakgrund (2026-08-09, skarpt på live): Studio visade
//   «Unexpected token 'A', "An error o"... is not valid JSON»
// Det är JSON.parse som fått Vercels textfelsida i stället för ett svar. Meddelandet säger
// varken vilket anrop som föll, vilken statuskod det gav, eller vad användaren ska göra —
// och mönstret `await r.json()` fanns på 27 ställen i StudioMaker ensam. Vilken route som
// helst som timeoutar eller kraschar ger alltså samma obegripliga rad.
//
// Regeln bakom: ett fel ska peka på sin orsak. Samma princip som felklassningen i
// lib/ai-usage (statuskoden ensam räcker inte — läs kroppen) och som grindarna i Studio
// (en grind som inte förklarar sig är värre än ingen grind).

/** Human-läsbar rad ur ett svar som inte var JSON. */
function beskrivIckeJson(status: number, kropp: string): string {
  const kort = kropp.replace(/\s+/g, " ").trim().slice(0, 120);
  if (status === 504 || /timed? ?out|timeout/i.test(kropp)) {
    return `Anropet tog för lång tid (HTTP ${status}). Prova igen — går det inte, dela upp arbetet i mindre steg.`;
  }
  if (status === 413) return "Filen eller innehållet var för stort för servern.";
  if (status === 401 || status === 403) return "Du är utloggad eller saknar behörighet. Ladda om sidan och logga in igen.";
  if (status >= 500) {
    return `Servern svarade med ett fel (HTTP ${status})${kort ? `: ${kort}` : ""}. Prova igen om en stund.`;
  }
  return `Oväntat svar från servern (HTTP ${status})${kort ? `: ${kort}` : ""}.`;
}

/**
 * Läser svaret som JSON. Är det inte JSON kastas ett fel med en begriplig svensk mening
 * i stället för parserns egen text.
 *
 * Semantiken vid lyckat svar är oförändrad — samma objekt som `r.json()` gav förut.
 */
export async function lasJson<T = unknown>(r: Response): Promise<T> {
  const text = await r.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(beskrivIckeJson(r.status, text));
  }
}
