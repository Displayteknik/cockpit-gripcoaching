// G-2 — formatanatomier som DATA.
//
// Bakgrund (G0-RAPPORT 0.3a): varje formats dramaturgi låg som hårdkod utspridd i
// flödesfilerna. Karusellens anatomi var en fritextsträng inuti lib/studio/carousel.ts,
// reelernas som scenspecar i lib/studio/reels.ts, statisk bild i prompt-core — och
// **story fanns inte alls**: en story var bara "1080×1920 utan video" och fick ett vanligt
// inläggs text i en yta som inte tål det.
//
// Konsekvensen av utspridd hårdkod är inte estetisk. Den är att ingen kan ÄNDRA en
// dramaturgi utan att leta rätt på den, och att två format kan glida isär utan att någon
// märker det. Anatomin hör till formatet, inte till flödet som råkar använda det.
//
// Klientsäker: ingen DB, inga hemligheter, inga server-importer. Både prompt-core (server)
// och Studio-komponenter (klient) läser härifrån.

import type { StudioFormat } from "@/lib/studio/payload";

// ── Karusellens roller ───────────────────────────────────────────────────────
// G-0: "Karusellens anatomi är svagare än G-2 kräver: hook → N × point → cta.
// Ingen insats-slide, ingen bevis-slide."
//
// De två saknade rollerna finns nu som DATA och är valbara per karusell. De är inte
// påslagna som standard: att ändra grundstrukturen på en karusell mitt i en pågående
// kundleverans är ett produktbeslut, inte en teknisk uppstädning. Nu går det att slå på
// utan att någon behöver skriva om en promptsträng.

export type SlideRoll = "hook" | "insats" | "point" | "bevis" | "cta";

export interface SlideRollSpec {
  roll: SlideRoll;
  /** Svenskt namn i gränssnittet. */
  namn: string;
  /** Ingår alltid, eller valbar? */
  obligatorisk: boolean;
  /** Mjuka teckentak — modellen får dem som riktvärden, mallen bryter ändå snyggt. */
  maxRubrik: number;
  maxBrodtext: number;
  /** Vad sliden ska GÖRA. Går rakt in i prompten. */
  uppgift: string;
}

export const KARUSELL_ROLLER: Record<SlideRoll, SlideRollSpec> = {
  hook: {
    roll: "hook",
    namn: "Krok",
    obligatorisk: true,
    maxRubrik: 34,
    maxBrodtext: 70,
    uppgift: "Krok som stoppar scrollen. Hel fras, aldrig ett fragment. Lovar något konkret som resten av karusellen infriar.",
  },
  insats: {
    roll: "insats",
    namn: "Insats",
    obligatorisk: false,
    maxRubrik: 34,
    maxBrodtext: 110,
    // Varför insats-sliden finns: en krok skapar nyfikenhet, men nyfikenhet ensam bär
    // inte sju slides. Insatsen säger vad det KOSTAR att inte veta det här.
    uppgift: "Vad som står på spel. Varför det spelar roll för läsaren just nu — konsekvensen av att inte göra något. Inget säljsnack, ingen lösning här.",
  },
  point: {
    roll: "point",
    namn: "Punkt",
    obligatorisk: true,
    maxRubrik: 34,
    maxBrodtext: 120,
    uppgift: "Punktens kärna. Konkret och användbart. Varje punkt ska ge något nytt, aldrig omformulera den föregående.",
  },
  bevis: {
    roll: "bevis",
    namn: "Bevis",
    obligatorisk: false,
    maxRubrik: 34,
    maxBrodtext: 120,
    // ⚠ Bevis-sliden är den farligaste att slå på: den BER om ett påstående som ska
    // vara sant. Uppgiften säger därför uttryckligen var materialet får komma ifrån,
    // och sanningskravet i prompt-core gäller ändå ovanpå.
    uppgift: "Ett konkret bevis ur varumärkesprofilens VERIFIERADE material: en verifierad siffra, ett kundcitat ur story-banken, ett faktiskt genomfört arbete. Finns inget sådant material — skriv sliden som en generell observation utan siffror, aldrig som ett påhittat case.",
  },
  cta: {
    roll: "cta",
    namn: "Avslut",
    obligatorisk: true,
    maxRubrik: 40,
    maxBrodtext: 90,
    uppgift: "Exakt en uppmaning i imperativ med väg: verb plus hur eller var handlingen görs.",
  },
};

export interface KarusellUppsattning {
  /** Antal punkt-slides. */
  punkter: number;
  /** Slå på insats-sliden (direkt efter kroken). */
  medInsats?: boolean;
  /** Slå på bevis-sliden (sist före avslutet). */
  medBevis?: boolean;
}

/**
 * Rollerna i ordning för en given uppsättning. Ordningen ÄR dramaturgin:
 * krok → insats → punkter → bevis → avslut.
 */
export function karusellRoller(u: KarusellUppsattning): SlideRoll[] {
  const punkter = Math.max(1, u.punkter);
  return [
    "hook" as const,
    ...(u.medInsats ? (["insats"] as const) : []),
    ...Array.from({ length: punkter }, () => "point" as const),
    ...(u.medBevis ? (["bevis"] as const) : []),
    "cta" as const,
  ];
}

/** Antal slides uppsättningen ger. Samma räkning som UI:t visar och exporten producerar. */
export function karusellAntalSlides(u: KarusellUppsattning): number {
  return karusellRoller(u).length;
}

/**
 * Karusellanatomin som prompttext. Ersätter fritextsträngen som låg i
 * lib/studio/carousel.ts — samma innehåll, men nu genererad ur rollistan, så en ändrad
 * roll slår igenom i prompten, i räkningen och i gränssnittet samtidigt.
 */
export function karusellAnatomiText(u: KarusellUppsattning): string {
  const roller = karusellRoller(u);
  const unika = [...new Set(roller)];
  return [
    `=== KARUSELLENS ANATOMI (${roller.length} slides, i denna ordning) ===`,
    roller.map((r, i) => `${i + 1}. ${KARUSELL_ROLLER[r].namn}`).join(" → "),
    "",
    ...unika.map((r) => {
      const s = KARUSELL_ROLLER[r];
      return `${s.namn} (kind "${s.roll}"): ${s.uppgift} Rubrik max ~${s.maxRubrik} tecken, text max ~${s.maxBrodtext} tecken.`;
    }),
    "",
    "Bygg en logisk båge: kroken lovar, mitten levererar, avslutet leder vidare.",
  ].join("\n");
}

// ── Storyns anatomi ──────────────────────────────────────────────────────────
// G-0: "Story finns inte i TextSyfte. En story är bara format 1080×1920 utan video och
// får samma text som ett vanligt inlägg."
//
// En story är inte ett inlägg i en annan storlek. Den ses i helskärm, i några sekunder,
// oftast med ljudet av, och den försvinner efter ett dygn. Ett inläggs textmängd i den
// ytan blir oläsbar — och ett inläggs CTA fungerar inte när svaret sker med en tumme.
export const STORY_ANATOMI = [
  "=== STORYNS ANATOMI (helskärm, några sekunder, försvinner efter ett dygn) ===",
  "1. EN tanke. En story bär ett budskap, aldrig två. Har du två — gör två stories.",
  "2. Läsbart på under tre sekunder: 3 till 12 ord totalt i huvudbudskapet. Detta är inte ett inlägg i annan storlek.",
  "3. Skriv i presens och direkt till en person: 'du', aldrig 'våra kunder'.",
  "4. Avslutet är en handling som görs MED TUMMEN där och då: svara på den här storyn, svep upp, tryck på länken, rösta i omröstningen. Aldrig 'boka ett möte' eller 'läs mer på hemsidan'.",
  "5. Inga hashtags, inga stycken, ingen brödtext. Det som inte får plats hör inte hemma i en story.",
].join("\n");

// ── Säkerhetszon för statiska format ─────────────────────────────────────────
// G-0 0.2, punkt 2: "Ingen säkerhetszon är definierad för statiska format; SAFE_ZONE
// finns bara för reels." Kanvasen är 4:5 men AI-bilden begärs som 3:4 eftersom Imagen
// saknar 4:5 — täckbeskärningen äter cirka 6 % i höjd, precis där en hook-rad eller ett
// ansikte hamnar.
//
// Zonen är alltså inte en layoutregel utan en BESKÄRNINGSMARGINAL: den säger hur mycket
// av bilden som kan försvinna, så bildprompten kan be om luft just där.

export interface SakerZon {
  /** Pixlar som kan falla bort i över- respektive underkant vid täckbeskärning. */
  topp: number;
  botten: number;
  /** Sidmarginal där text aldrig ska ligga. */
  sida: number;
}

export const SAKER_ZON: Record<StudioFormat, SakerZon> = {
  // 3:4 (0,750) beskuret till 4:5 (0,800): höjden kapas ~6 %, jämnt fördelat = ~40 px per kant.
  "1080x1350": { topp: 48, botten: 48, sida: 64 },
  // 1:1 begärs som 1:1 — ingen beskärning, bara typografisk marginal.
  "1080x1080": { topp: 32, botten: 32, sida: 64 },
  // 9:16: plattformens egna gränssnitt (avsändare uppe, svarsfält nere) äter mest.
  "1080x1920": { topp: 220, botten: 450, sida: 48 },
};

/**
 * Raden som går in i BILDprompten. Talar om var motivet måste ha luft, i klartext och
 * på engelska (bildmodellerna svarar bäst på det), utan att beskriva ljus eller stil —
 * det ägs av den grafiska profilen och krockar annars.
 */
export function sakerZonBildrad(format: StudioFormat): string {
  const z = SAKER_ZON[format] ?? SAKER_ZON["1080x1350"];
  const procentTopp = Math.round((z.topp / matt(format).h) * 100);
  const procentBotten = Math.round((z.botten / matt(format).h) * 100);
  return [
    `Composition: keep the subject fully inside the central area.`,
    `The top ${procentTopp}% and bottom ${procentBotten}% of the frame may be cropped away — no faces, no key objects and no text there.`,
  ].join(" ");
}

/** Måtten per format. Speglar FORMAT_DIMENSIONS men utan att dra in payload-modulen. */
function matt(format: StudioFormat): { w: number; h: number } {
  if (format === "1080x1080") return { w: 1080, h: 1080 };
  if (format === "1080x1920") return { w: 1080, h: 1920 };
  return { w: 1080, h: 1350 };
}
