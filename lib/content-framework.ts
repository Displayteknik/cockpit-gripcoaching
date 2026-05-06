// lib/content-framework.ts
// Hakans Content Compass — 4A × DISC × funnel-mappning som styr varje generering.

export type FourA = "analytical" | "aspirational" | "actionable" | "authentic";
export type Disc = "D" | "I" | "S" | "C";
export type Funnel = "TOFU" | "MOFU" | "BOFU";
export type Format =
  | "single"        // Enstaka bild + text
  | "carousel"      // 5-8 slides
  | "reel"          // Videoscript
  | "story"         // 1080×1920
  | "big_quote"     // Solid bakgrund, stort citat
  | "before_after"  // Split-screen
  | "big_stat"      // En siffra dominerar
  | "photo_overlay" // Kundfoto + text
  | "long_form";    // Facebook-långinlägg

export interface DayRole {
  day: string;
  fourA: FourA;
  disc: Disc;
  funnel: Funnel;
  intent: string;
  recommended_formats: Format[];
}

// Veckorytmen — Hakans Content Compass
export const WEEK_ROLES: DayRole[] = [
  {
    day: "Måndag",
    fourA: "analytical",
    disc: "C",
    funnel: "TOFU",
    intent: "Compliance/data — väck nyfikenhet med faktum, statistik, expertis. Bygg auktoritet.",
    recommended_formats: ["big_stat", "carousel", "single"],
  },
  {
    day: "Tisdag",
    fourA: "analytical",
    disc: "D",
    funnel: "TOFU",
    intent: "Driver/snabba vinster — '3 saker du kan göra direkt'. Praktiskt, resultatfokuserat.",
    recommended_formats: ["carousel", "single", "reel"],
  },
  {
    day: "Onsdag",
    fourA: "aspirational",
    disc: "I",
    funnel: "MOFU",
    intent: "Influence/transformation — kundens 'före → efter'. Drömlägen och möjligheter.",
    recommended_formats: ["before_after", "photo_overlay", "reel"],
  },
  {
    day: "Torsdag",
    fourA: "aspirational",
    disc: "D",
    funnel: "BOFU",
    intent: "Story+CTA — kundcase eller personlig story som leder till tydlig handling.",
    recommended_formats: ["photo_overlay", "long_form", "carousel"],
  },
  {
    day: "Fredag",
    fourA: "actionable",
    disc: "S",
    funnel: "TOFU",
    intent: "Compliance+Steadiness — checklistor, sammanfattningar, 'spara detta'.",
    recommended_formats: ["carousel", "single", "big_quote"],
  },
  {
    day: "Lördag",
    fourA: "actionable",
    disc: "D",
    funnel: "MOFU",
    intent: "Driver+Compliance — visa er metod/process. Bakom kulisserna med struktur.",
    recommended_formats: ["carousel", "photo_overlay", "reel"],
  },
  {
    day: "Söndag",
    fourA: "authentic",
    disc: "S",
    funnel: "TOFU",
    intent: "Steadiness/personlig — människan bakom företaget. Värderingar, vardag, varför.",
    recommended_formats: ["photo_overlay", "big_quote", "long_form"],
  },
];

export const FORMAT_LABELS: Record<Format, string> = {
  single: "Enstaka bild",
  carousel: "Carousel (5–8 slides)",
  reel: "Reel (15–30 sek)",
  story: "Story (9:16)",
  big_quote: "Stort citat",
  before_after: "Före/Efter",
  big_stat: "Stor siffra",
  photo_overlay: "Foto + text",
  long_form: "Lång berättelse",
};

export const DISC_GUIDE: Record<Disc, string> = {
  D: "Dominant — direkt, resultatfokuserat, korta meningar, befallande verb. 'Få det gjort.'",
  I: "Influence — energi, social proof, känslor, utropstecken sparsamt, framtidsbild.",
  S: "Steadiness — varmt, tryggt, ingen press, lugnt språk, vi-känsla, kontinuitet.",
  C: "Compliance — fakta, siffror, källor, struktur, försiktighet, 'enligt forskning'.",
};

export const FOURA_GUIDE: Record<FourA, string> = {
  analytical: "Logik. Siffror, fakta, expertis, beprövade samband. Inga känsloargument.",
  aspirational: "Vision. Drömläge, transformation, möjligheter — visa vart resan leder.",
  actionable: "Handling. Konkreta steg, checklistor, något läsaren KAN GÖRA idag.",
  authentic: "Människa. Personlig, ärlig, sårbar. Värderingar och vardag — inte säljpitch.",
};

export const FUNNEL_GUIDE: Record<Funnel, string> = {
  TOFU: "Bygg medvetenhet. Värde först. Inget hårt sälj — fånga uppmärksamhet och bygg förtroende.",
  MOFU: "Bygg förtroende. Visa att ni förstår problemet på djupet. Kundcase, processer, FAQ.",
  BOFU: "Driv handling. Tydlig CTA, lite friktion, hjälp läsaren ta nästa steg.",
};

export function getDayRole(dayIndex: number): DayRole {
  return WEEK_ROLES[((dayIndex % 7) + 7) % 7];
}

// Brendan Kane-format som hooks bör följa
export const HOOK_FORMATS = {
  question: "Fråge-hook — börja med en specifik fråga målgruppen känner i magen",
  contrast: "Kontrast — '95% gör X, men det funkar inte. Här är vad som funkar:'",
  statistic: "Statistik-hook — en siffra som chockerar eller förvånar",
  story: "Story-opening — 'Igår satt en kund framför mig och...'",
  bold_claim: "Djärvt påstående — kontroversiellt men sant",
  curiosity: "Nyfikenhetsglapp — hint om något läsaren vill veta",
  before_after: "Före/efter — 'Innan ____. Nu ____.'",
} as const;

export const KANE_HOOK_RULES = `
1. Få ord — under 12 om möjligt. En andning.
2. Trogen brand — låter som personen, inte som copy.
3. Subverterar förväntningar — säger inte det läsaren tror du ska säga.
4. Universell sanning — något ALLA i målgruppen känner igen.
5. Curiosity gap — hintar om mer utan att avslöja allt.
`.trim();
