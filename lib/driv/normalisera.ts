// DRIV-1 — normalisering för identitetsmatchningen (1A). Rena funktioner, inga anrop.

/** Gemener, trimmad. Samma adress i olika skiftläge ska räknas som samma nyckel. */
export function normaliseraEpost(e: string | null | undefined): string | null {
  const v = (e || "").trim().toLowerCase();
  return v && v.includes("@") ? v : null;
}

/**
 * Till +46-format. Samma lärdom som ONBOARD-2 (+46725410102 mot 0725410102 larmade i
 * onödan): siffrorna jämförs, inte skrivsättet.
 */
export function normaliseraTelefon(t: string | null | undefined): string | null {
  if (!t) return null;
  const siffror = t.replace(/[^\d+]/g, "");
  if (!siffror) return null;
  if (siffror.startsWith("+46")) return siffror;
  if (siffror.startsWith("0046")) return `+46${siffror.slice(4)}`;
  if (siffror.startsWith("0")) return `+46${siffror.slice(1)}`;
  if (siffror.startsWith("46")) return `+${siffror}`;
  return null; // okänt landsnummer — ingen gissning
}
