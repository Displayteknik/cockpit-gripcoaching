// AKUT-KARUSELL — ordningen och fullständigheten i en karusellexport.
//
// Bakgrund (G-0, 2026-08-09): gränssnittet lovade "{n} slides · exporteras som {n} bilder"
// men fångsten läste EN dold nod. Löftet fanns i UI:t, inte i koden.
//
// Logiken bor HÄR och inte i en React-callback av ett enda skäl: den ska gå att bevisa.
// En loop inne i en komponent går bara att verifiera med ögat, och "en slide försvann"
// är precis den sortens fel som inte syns förrän en kund publicerat sex sjundedelar av
// sitt inlägg. StudioMaker skickar in noderna och sin fångstfunktion; reglerna om
// ordning, fullständighet och felmeddelande ligger kvar här.

/** Fångar N noder till N blobbar, i ordning. Kastar om någon nod inte gick att rita. */
export async function fangaAllaSlides<T>(
  antal: number,
  hamtaNod: (i: number) => T | null,
  fanga: (nod: T | null) => Promise<Blob | null>,
): Promise<Blob[]> {
  const ut: Blob[] = [];
  for (let i = 0; i < antal; i++) {
    // Sekventiellt med flit: ordningen ÄR karusellen. Parallella fångster som svarar i
    // annan takt hade gett slide 3 före slide 2 i det publicerade inlägget.
    const blob = await fanga(hamtaNod(i));
    if (!blob) throw new Error(slideFelText(i, antal));
    ut.push(blob);
  }
  return ut;
}

/** Felet namnger vilken slide som föll — "kunde inte skapa bilden" går inte att agera på. */
export function slideFelText(index: number, antal: number): string {
  return `Slide ${index + 1} av ${antal} kunde inte skapas. Prova igen om en stund.`;
}

/** Filnamn vid nedladdning. En ensam bild får inget nummer, en karusell får 1av7, 2av7 … */
export function slideFilnamn(bas: string, index: number, antal: number): string {
  return antal > 1 ? `${bas}-${index + 1}av${antal}.png` : `${bas}.png`;
}
