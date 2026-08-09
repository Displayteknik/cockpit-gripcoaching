// G-3 — hooktypologin som ETT styrbart lager.
//
// Bakgrund (G0-RAPPORT 0.3b): tre osammanhängande listor levde parallellt.
//   1. Fem hooktyper som prosa i `knowledge/hook-playbook.md`, laddad av fyra flöden.
//   2. Åtta retoriska ingångar i `VARIANTREGEL` — gällde bara INOM ett enda anrop.
//   3. Fyra DISC-hookar i content-compass — bara om DISC är satt, vilket det aldrig är
//      som default.
// "Ingen är valbar, roterande över tid eller loggad."
//
// De tre listorna var inte bara tre. De var tre olika INDELNINGAR av samma sak: fem
// typer, åtta ingångar och fyra tonlägen som delvis överlappade och delvis motsade
// varandra. En modell som får alla tre samtidigt får inte mer vägledning, den får mindre.
//
// Här finns en lista. Playbookens fem typer är stommen — de är de enda som redan är
// nedskrivna med exempel och som flödena faktiskt namnger i sin JSON (`hookType`).
// VARIANTREGELNS extra ingångar blir VINKLAR inom en typ, inte konkurrerande typer.
//
// Klientsäker: ingen DB, inga server-importer.

export type HookTypId = "fraga" | "siffra" | "kontrar" | "berattelse" | "pastaende";

export interface HookTyp {
  id: HookTypId;
  /** Namnet flödena redan använder i sin JSON och i UI:t. Ändras inte lättvindigt. */
  namn: string;
  /** Hur ingången formuleras i variantregeln — prosa, inte nyckel. */
  ingang: string;
  /** Vad hooken GÖR med läsaren. Går rakt in i prompten. */
  uppgift: string;
  /** Retoriska ingångar inom typen — det VARIANTREGELN förut listade som egna typer. */
  vinklar: string[];
  /**
   * Kräver typen material som måste vara sant?
   * Ingen = fri. "siffror" = verifierade tal i profilen. "berattelser" = story-bank.
   *
   * ⚠ Det här fältet är hela skälet att listan är data och inte prosa: grinden i
   * lib/studio/copy.ts filtrerar redan bort statistik- och berättelsehookar när
   * profilen saknar täckning, men den kunskapen låg i en egen funktion där. Nu bor
   * kravet hos typen själv, så varje flöde kan ställa samma fråga.
   */
  kraver: "siffror" | "berattelser" | null;
}

export const HOOK_TYPER: HookTyp[] = [
  {
    id: "fraga",
    ingang: "rak fråga",
    namn: "fråga",
    uppgift: "Ställ en rak fråga som träffar läsarens vardag och som hen inte kan svara på direkt.",
    vinklar: ["läsarens oro", "målgruppsvinkel", "en fråga hen ställt sig själv"],
    kraver: null,
  },
  {
    id: "siffra",
    ingang: "konkret siffra",
    namn: "statistik",
    uppgift: "Öppna med ett konkret tal som skapar nyfikenhet.",
    vinklar: ["jämförelse", "andel eller kvot", "tidsspann"],
    // Sanningskravet gäller ovanpå, men typen ska inte ens FÖRESLÅS utan täckning:
    // att be om en siffra man inte har är att be om en påhittad siffra.
    kraver: "siffror",
  },
  {
    id: "kontrar",
    ingang: "konträrt påstående",
    namn: "konträr",
    uppgift: "Bryt ett mönster: säg emot ett vanligt råd och peka på vad man ska göra i stället.",
    vinklar: ["mytkrossning", "vanligt råd som inte håller", "före/efter"],
    kraver: null,
  },
  {
    id: "berattelse",
    ingang: "berättelseöppning",
    namn: "berättelse",
    uppgift: "Öppna en loop med en verklig händelse — en scen som läsaren vill veta slutet på.",
    vinklar: ["kundscenario", "hantverksstolthet", "en vändpunkt"],
    // A2-skärpningen: utan story-bank blir berättelsehooken ett påhittat minne.
    kraver: "berattelser",
  },
  {
    id: "pastaende",
    ingang: "djärvt påstående",
    namn: "påstående",
    uppgift: "Utmana en vedertagen sanning med ett djärvt, konkret påstående.",
    vinklar: ["det du tror stämmer inte", "resultatet först", "en sanning ur branschen"],
    kraver: null,
  },
];

const PER_NAMN = new Map(HOOK_TYPER.map((h) => [h.namn, h]));
const PER_ID = new Map(HOOK_TYPER.map((h) => [h.id, h]));

/** Slår upp en hooktyp ur det namn flödena skriver i sin JSON. null = okänt. */
export function hookTyp(namnEllerId: string | null | undefined): HookTyp | null {
  const n = (namnEllerId || "").trim().toLowerCase();
  return PER_NAMN.get(n) ?? PER_ID.get(n as HookTypId) ?? null;
}

/**
 * Vilka typer som får FÖRESLÅS för en tenant just nu.
 *
 * Grinden är densamma som lib/studio/copy.ts redan körde, men flyttad hit så alla
 * flöden kan ställa den. En typ vars krav inte är uppfyllt föreslås aldrig — den ska
 * inte ens frestas fram.
 */
export function tillatnaHookTyper(opts: { harSiffror: boolean; harBerattelser: boolean }): HookTyp[] {
  return HOOK_TYPER.filter((h) => {
    if (h.kraver === "siffror") return opts.harSiffror;
    if (h.kraver === "berattelser") return opts.harBerattelser;
    return true;
  });
}

/**
 * Variantregelns text, byggd ur listan i stället för en fast mening.
 *
 * Förut räknade regeln upp åtta ingångar som om de vore likvärdiga val — men tre av dem
 * krävde material som tenanten kanske saknar, och regeln nämnde det inte. Nu innehåller
 * texten bara det tenanten faktiskt kan leverera.
 */
export function variantregelText(tillatna: HookTyp[] = HOOK_TYPER): string {
  // ⚠ Förbehållet följer med typen, alltid. Den gamla handskrivna raden sa "konkret
  // siffra (endast verifierad ur profilen)" — tappas den parentesen blir regeln en
  // uppmaning att hitta på ett tal. Samma sak för berättelsen: A2-skärpningen finns
  // för att en ombedd berättelse utan material blir ett påhittat minne.
  const forbehall: Record<string, string> = {
    siffror: " (endast verifierad ur profilen)",
    berattelser: " (endast verklig händelse ur profilen)",
  };
  const ingangar = tillatna.flatMap((h) => [
    `${h.ingang}${h.kraver ? forbehall[h.kraver] : ""}`,
    ...h.vinklar,
  ]);
  return [
    "=== VARIANTREGEL (när flera idéer/varianter genereras) ===",
    `Varje variant ska ha en EGEN RETORISK INGÅNG — inte bara olika format. Välj olika ingångar ur listan: ${ingangar.join(", ")}.`,
    "Två varianter får ALDRIG dela tankefigur eller öppningsfras. Läser man bara första raden av varje ska de kännas som olika ingångar till samma budskap.",
  ].join("\n");
}
