// Djuplänkar till MySales (Håkans white-label av GoHighLevel).
//
// ★ FORMEN ÄR INTE SAMMA SOM VANLIGA GHL. MySales använder
//     /location/<loc>/customers/detail/<contactId>
//   och INTE GHL:s egna
//     /v2/location/<loc>/contacts/detail/<contactId>
//
// Formen är verifierad mot en riktig kund-URL (Fokusmotorn 2026-07-06). Den andra
// varianten låg parallellt i HQ, Tystnadslistan och FokusClient och var aldrig
// verifierad mot MySales — den kom från GHL:s standardadress och ledde fel.
// FokusClient hade dessutom BÅDA formerna, på två rader i samma fil.
//
// Därför bor formen numera bara här. Ska en tenant köra på en egen domän är det den här
// filen som ändras, inte sju anropsplatser.

export const MYSALES_BAS = "https://app.mysales.se";

/**
 * Länk till kontaktkortet i MySales. Därifrån når man affären.
 * Returnerar null när location eller kontakt saknas — en halv länk leder alltid fel,
 * och anroparen ska dölja knappen i stället för att visa en trasig.
 */
export function mysalesKontaktUrl(
  locationId: string | null | undefined,
  ghlContactId: string | null | undefined,
): string | null {
  if (!locationId || !ghlContactId) return null;
  return `${MYSALES_BAS}/location/${locationId}/customers/detail/${ghlContactId}`;
}
