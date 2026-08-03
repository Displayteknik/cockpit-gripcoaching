// Färskhet på lånad data — en enda källa för hur gammal en spegel får vara och hur
// åldern sägs i klarspråk.
//
// VARFÖR DEN HÄR FILEN FINNS: en vy som visar tre dygn gammal pipeline utan att säga
// det ser precis lika trovärdig ut som en som visar dagens. Användaren har ingen chans
// att se skillnaden. Tyst gammal data är därför ett fel i sig, inte en skönhetsfläck —
// samma familj som en nolla i ett SEO-mått som egentligen betyder "vi kunde inte mäta".
//
// Regeln: ingen vy får visa data som hämtats från ett annat system utan att också visa
// när den hämtades.

export type Farskhetsniva = "farsk" | "gammal" | "okand";

export interface Farskhet {
  niva: Farskhetsniva;
  /** Klarspråk, färdig att skriva ut: "Synkad för 3 dagar sedan". */
  text: string;
  /** Hela minuter sedan hämtningen. null = aldrig hämtad eller obegripligt datum. */
  minuter: number | null;
}

/** Efter så här länge räknas speglad data som gammal och ska flaggas i vyn. */
export const GAMMAL_EFTER_MS = 2 * 60 * 60 * 1000;

/** Hur ofta en sidladdning som mest får trigga en ny hämtning från källsystemet. */
export const SYNK_INTERVALL_MS = 10 * 60 * 1000;

function sedan(minuter: number): string {
  if (minuter < 1) return "just nu";
  if (minuter < 60) return `för ${minuter} ${minuter === 1 ? "minut" : "minuter"} sedan`;
  const timmar = Math.floor(minuter / 60);
  if (timmar < 24) return `för ${timmar} ${timmar === 1 ? "timme" : "timmar"} sedan`;
  const dagar = Math.floor(timmar / 24);
  return `för ${dagar} ${dagar === 1 ? "dag" : "dagar"} sedan`;
}

/**
 * "för 3 dagar sedan" — bara tidsuttrycket, för texter som har ett eget verb
 * ("Mätt …", "Hämtad …"). null när tidpunkten saknas eller inte går att tolka; då ska
 * anropande vy säga det med ord i stället för att utelämna åldern.
 */
export function sedanText(iso: string | null | undefined, nu: number = Date.now()): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return sedan(Math.floor(Math.max(0, nu - t) / 60000));
}

/**
 * Beskriv hur färsk en hämtning är.
 *
 * ⚠ Ett saknat eller trasigt datum ger ALDRIG "färsk". Vi vet då inte hur gammal datan
 * är, och okänd ålder ska behandlas som ett problem att visa — inte tigas ihjäl.
 * Framtida tidsstämplar (klockskillnad mellan servrar) räknas som noll minuter i stället
 * för att bli negativa och läsas som "färsk om -3 minuter".
 */
export function beskrivFarskhet(iso: string | null | undefined, nu: number = Date.now()): Farskhet {
  if (!iso) return { niva: "okand", text: "Aldrig hämtad från MySales", minuter: null };
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return { niva: "okand", text: "Okänd ålder på datan", minuter: null };
  const diff = Math.max(0, nu - t);
  const minuter = Math.floor(diff / 60000);
  return {
    niva: diff > GAMMAL_EFTER_MS ? "gammal" : "farsk",
    text: `Synkad ${sedan(minuter)}`,
    minuter,
  };
}

/** Är spegeln så gammal att en sidladdning ska försöka hämta på nytt? */
export function borSynkaOm(iso: string | null | undefined, nu: number = Date.now()): boolean {
  if (!iso) return true;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return true;
  return nu - t >= SYNK_INTERVALL_MS;
}
