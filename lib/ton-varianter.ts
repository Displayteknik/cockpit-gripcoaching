// TON-1 — varje variant får sitt EGNA tonläge. Håkans fynd 2026-08-12.
//
// Fyndet, i hans ord: "DISC etc ska ju variras och hänga med här, allt är hela tiden lika."
// Innehållsprofilen visade samma tre inställningar hela dagen, och alla tre captionvarianterna
// delade dem. Kroken och vägen framåt delades ut per variant (CTA-2) — tonen gjorde det inte.
// Tre "olika" förslag skrevs alltså i exakt samma tonläge, och då syns varken variationen
// eller att systemet kan skilja ett tilltal från ett annat.
//
// Orsaken är densamma som i CTA-2: `compass` skickas EN gång till prompt-core och hamnar i
// SYSTEMprompten, som är gemensam för alla varianter. Varianterna körs dessutom parallellt
// och kan inte se varandra. Tonen måste därför DELAS UT, inte önskas.
//
// ⚠ Dagens profil körs aldrig över. Den är utgångspunkten: variant 0 får tonen som står i
// innehållsprofilen, resten fortsätter runt i DISC-ordning. Har användaren själv klickat i
// flera bokstäver används de först, i tur och ordning. Förslaget för dagen får alltså
// sällskap — det ersätts inte.
//
// ⚠ Tonen styr HUR texten skrivs, aldrig VAD som är sant. D:s hook är "rak siffra" och C:s
// är "överraskande fakta" — utan ett uttryckligt förbehåll blir tonen en beställning på ett
// tal som inte finns. Exakt den fällan fångade testet i G-3 när hook-typerna tappade sitt
// "endast verifierad ur profilen". Förbehållet följer därför med tonen själv, inte med
// flödet som råkar använda den.
//
// ⚠ Betydelsen av en bokstav bor på ETT ställe: `lib/content-compass/prompt.ts` och
// `lib/content-framework.ts`, samma källa som den delade prompten läser. En egen formulering
// här hade blivit en andra sanning som glider isär vid första finslipningen.

import { DISC_HOOK, DISC_TONE } from "@/lib/content-compass/prompt";
import { DISC_GUIDE } from "@/lib/content-framework";
import type { DiscLetter } from "@/lib/content-compass/data";

/** DISC i fast ordning. Determinismen vilar på den — samma variantnummer ger samma ton. */
export const DISC_ORDNING: DiscLetter[] = ["D", "I", "S", "C"];

/**
 * Ordningen tonerna delas ut i, med de valda bokstäverna först (i DISC-ordning) och resten
 * efter. Resultatet är alltid alla fyra bokstäverna exakt en gång, så tre varianter kan
 * aldrig råka få samma ton.
 */
export function tonOrdning(valda?: DiscLetter[] | null): DiscLetter[] {
  const rena = (valda || []).filter((d) => DISC_ORDNING.includes(d));
  const forst = DISC_ORDNING.filter((d) => rena.includes(d));
  return [...forst, ...DISC_ORDNING.filter((d) => !forst.includes(d))];
}

/** Tonen för variant nummer `i` (0-baserat). Samma determinism som CTA-vägarna. */
export function tonForVariant(i: number, valda?: DiscLetter[] | null): DiscLetter {
  const ordning = tonOrdning(valda);
  return ordning[((i % ordning.length) + ordning.length) % ordning.length];
}

/**
 * Instruktionen som talar om vilket tonläge varianten ska skrivas i. Läggs på krok-vinkeln
 * tillsammans med perspektivet och vägen framåt.
 *
 * Sista meningen är inte utsmyckning: den är grinden som hindrar tonen från att bli ett
 * mandat att hitta på ett tal. Tas den bort blir "rak siffra" en beställning.
 */
export function tonInstruktion(ton: DiscLetter): string {
  return [
    `TONLÄGE (obligatoriskt, och det ska skilja sig från de andra varianternas): skriv HELA texten i tonläge ${ton} — ${DISC_TONE[ton]}.`,
    `Kroken formas därefter: ${DISC_HOOK[ton]}.`,
    DISC_GUIDE[ton],
    "Tonen styr HUR du skriver, aldrig VAD som är sant. Den får aldrig motivera en siffra, ett påstående eller en berättelse som inte finns i underlaget: saknas talet skriver du iakttagelsen utan siffra, i det här tonläget.",
  ].join(" ");
}
