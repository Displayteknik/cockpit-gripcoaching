// CTA-2 — varje variant får sin EGNA väg framåt. Håkans fynd 2026-08-10.
//
// Fyndet, i hans egen verifiering: han bad om tre captions att välja mellan och fick tre
// olika ÖPPNINGAR (fråga, påstående, berättelse) — men samma avslut i alla tre:
// "Skicka en bild på platsen så får du en offert inom 24 timmar." Två av dem hade dessutom
// samma avslutande fråga. Tre varianter som slutar likadant är inte tre val.
//
// Orsaken: `ANGLAR` i captionvägen varierade bara kroken. Ingenting varierade vägen framåt,
// och profilens starkaste CTA vinner då varje gång. Varianterna genereras dessutom
// PARALLELLT — de kan inte se varandra, så "välj en egen vinkel" räcker inte. Vägen måste
// DELAS UT, inte önskas.
//
// ⚠ Vägarna ligger INOM CTA-golvet (G-5), aldrig utanför: sista meningen är fortfarande en
// uppmaning i imperativ som NAMNGER en väg. Det som varierar är VILKEN väg — inte om det
// finns en. En avslutande fråga i stället för en uppmaning hade fällts av golvet, och då
// hade variationen bara blivit ett extra omtag.
//
// ⚠ Ingen väg får hitta på en kanal. Telefonnummer och URL:er är redan förbjudna i
// captionen, och en väg som kräver något kunden kanske inte har (bokningslänk, nyhetsbrev)
// pekar tillbaka på profilen — finns det inte där används kommentarsfältet i stället.

export interface CtaVag {
  /** Kort namn, används i loggning och i variantens etikett. */
  namn: string;
  /** Instruktionen som läggs på krok-vinkeln. Talar om VAR uppmaningen ska landa. */
  instruktion: string;
  /**
   * CTA-3: hur STORT steg vägen begär av läsaren.
   *   litet  — kostar ingenting: svara, spara, skicka vidare.
   *   mellan — kostar ett klick eller en minut: läs, hämta, besök.
   *   stort  — kostar kontakt: skriv till oss, boka, begär offert.
   *
   * Håkans fynd 10/8: ett TOFU-inlägg om ångest slutade "Boka ett första samtal via länken
   * i profilen". Ett steg som är större än nivån läser som sälj på första mötet — motsatsen
   * till det vi lär ut. Nivån väljer därför vilka vägar som ens får delas ut.
   */
  steg: "litet" | "mellan" | "stort";
}

export const CTA_VAGAR: CtaVag[] = [
  {
    namn: "kommentar",
    steg: "litet",
    instruktion:
      "VÄG FRAMÅT (obligatorisk, och den ska skilja sig från de andra varianternas): led läsaren till KOMMENTARSFÄLTET. " +
      "Sista meningen är en uppmaning i imperativ som säger exakt vad hon ska skriva där — 'Skriv vilken av dem du känner igen i kommentaren', 'Berätta i kommentaren hur ni löser det idag'. " +
      "Be aldrig om ett meddelande, en offert eller ett besök i den här varianten.",
  },
  {
    namn: "meddelande",
    steg: "stort",
    instruktion:
      "VÄG FRAMÅT (obligatorisk, och den ska skilja sig från de andra varianternas): led läsaren till ett DIREKTMEDDELANDE med något konkret i handen. " +
      "Sista meningen är en uppmaning i imperativ som namnger vad hon skickar och vad hon får tillbaka — 'Skicka en bild på din plats, så säger vi vad som går att göra'. " +
      "Nämn ingen tid eller siffra som inte står i varumärkesprofilen, och be inte om en kommentar i den här varianten.",
  },
  {
    namn: "spara-dela",
    steg: "litet",
    instruktion:
      "VÄG FRAMÅT (obligatorisk, och den ska skilja sig från de andra varianternas): led läsaren till att SPARA eller SKICKA VIDARE inlägget. " +
      "Sista meningen är en uppmaning i imperativ som säger när det blir användbart eller vem det hör hemma hos — 'Spara det här till nästa gång solen ställer till det', 'Skicka det vidare till den som äger skyltfönstret'. " +
      "Be inte om kontakt, meddelande eller kommentar i den här varianten.",
  },
  {
    namn: "egen-kanal",
    steg: "mellan",
    instruktion:
      "VÄG FRAMÅT (obligatorisk, och den ska skilja sig från de andra varianternas): led läsaren till verksamhetens EGEN kanal — men bara en som faktiskt står i varumärkesprofilen (hemsidan, adressen, mottagningen, showroomet). " +
      "Sista meningen är en uppmaning i imperativ som namnger den — 'Läs mer på hemsidan', 'Kom in i showroomet och se skillnaden i verkligheten'. " +
      "Skriv ALDRIG ut en URL eller ett telefonnummer, och hittar du ingen sådan kanal i profilen: led till kommentarsfältet i stället.",
  },
];

/**
 * CTA-3: vilka steg nivån tillåter. TOFU får aldrig be om kontakt — inte ens kostnadsfritt,
 * inte ens "om du vill veta mer". Samma regel står i prompt-core (STEGETS STORLEK FÖLJER
 * NIVÅN); här är den dessutom byggd i urvalet, så en tofu-variant inte KAN få den vägen.
 */
const TILLATNA_STEG: Record<"tofu" | "mofu" | "bofu", CtaVag["steg"][]> = {
  tofu: ["litet", "mellan"],
  mofu: ["litet", "mellan", "stort"],
  bofu: ["mellan", "stort"],
};

/** Vägarna som får delas ut på en nivå. Utan känd nivå: alla utom det stora steget. */
export function vagarForFunnel(funnel?: string | null): CtaVag[] {
  const niva = funnel === "mofu" || funnel === "bofu" ? funnel : funnel === "tofu" ? "tofu" : null;
  // Okänd nivå behandlas som tofu i FRÅGAN OM STEGETS STORLEK — den försiktiga vägen är
  // den som inte skadar. En för liten uppmaning är ett tappat steg; en för stor är sälj i
  // ansiktet på någon som just fick syn på företaget.
  const tillatna = TILLATNA_STEG[niva ?? "tofu"];
  const urval = CTA_VAGAR.filter((v) => tillatna.includes(v.steg));
  return urval.length ? urval : CTA_VAGAR;
}

/**
 * Vägen för variant nummer `i` (0-baserat), inom det nivån tillåter. Deterministisk: samma
 * variantnummer och nivå ger alltid samma väg, och tre varianter kan därför aldrig råka
 * landa i samma avslut.
 */
export function ctaVagForVariant(i: number, funnel?: string | null): CtaVag {
  const urval = vagarForFunnel(funnel);
  return urval[((i % urval.length) + urval.length) % urval.length];
}

/**
 * Krok-vinkeln och vägen framåt som EN instruktion. Kroken styr öppningen, vägen styr
 * avslutet — utan detta styrde kroken bara öppningen och avslutet blev likadant i alla.
 */
export function vinkelMedVag(vinkelInstruktion: string, vag: CtaVag, perspektiv?: string): string {
  return [vinkelInstruktion, perspektiv, vag.instruktion].filter(Boolean).join("\n");
}

/**
 * Håkans fynd hade TVÅ halvor. Den andra: alla tre varianter ställde i praktiken samma
 * fråga, för de såg samma sak i ämnet — solen som gör skylten svart. Krok-typen styr HUR
 * texten öppnar (fråga, påstående, berättelse), men inte VAD den tittar på. Utan en delad
 * ut perspektivriktning landar tre parallella varianter på samma iakttagelse, och då är
 * tre "olika" krokar tre formuleringar av samma mening.
 *
 * Perspektiven är medvetet grova och branschneutrala — de säger vart blicken ska riktas,
 * aldrig vad svaret är. Sanningskravet och prisregeln gäller oförändrat: ett perspektiv får
 * aldrig bli en ursäkt för ett tal som inte står i profilen.
 */
export const VINKEL_PERSPEKTIV: string[] = [
  "PERSPEKTIV: titta på KOSTNADEN av att låta det vara som det är — vad som går förlorat, i kunder, tid eller besvär. Beskriv den utan att sätta en siffra som inte står i profilen.",
  "PERSPEKTIV: titta på hur det KÄNNS i vardagen för den som har problemet, och för hennes kunder. Konkret situation, inte känslosnack.",
  "PERSPEKTIV: titta på SKILLNADEN före och efter — samma plats, samma dag, med och utan lösningen. Jämför läge mot läge, inte produkt mot produkt.",
  "PERSPEKTIV: titta på vad som FAKTISKT KRÄVS — steget, arbetet, valet som ska göras. Avdramatisera: säg vad man börjar med.",
  "PERSPEKTIV: titta på en vanlig MISSUPPFATTNING i branschen och vad som gäller i stället. Peka aldrig ut en konkurrent.",
];

/** Perspektivet för variant nummer `i`. Samma determinism som vägarna. */
export function perspektivForVariant(i: number): string {
  return VINKEL_PERSPEKTIV[((i % VINKEL_PERSPEKTIV.length) + VINKEL_PERSPEKTIV.length) % VINKEL_PERSPEKTIV.length];
}

/**
 * Kundsynlig etikett per väg — visas i variantkortet så skillnaden syns FÖRE man läser
 * texten. Klarspråk, inga systemord: "svar i kommentaren", inte "cta_kommentar".
 */
export const CTA_VAG_ETIKETT: Record<string, string> = {
  kommentar: "svar i kommentaren",
  meddelande: "meddelande till er",
  "spara-dela": "spara eller skicka vidare",
  "egen-kanal": "er egen kanal",
};
