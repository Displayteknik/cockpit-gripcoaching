// KVALITET-3 / punkt 2 — idé-flödet ("Ge mig 3 idéer").
//
// Tre verifierade fel i skarp drift, samma ämne, tre körningar:
//   a) Antalet var intermittent (ibland 2, ibland 3). Ett bortfall i parsning eller
//      i kvalitetsgrindarna ska GENERERA OM, aldrig tyst krympa leveransen.
//   b) Beskrivningarna inleddes med fragment + kolon ("aktuell?:", "gäster.:").
//      ROTORSAK: gränssnittet renderade `{headline2}: {body}` — underrubriken är en
//      hel mening med egen slutpunkt, så kolonet hamnade efter ett avslutat påstående.
//      Raden byggs nu på servern som riktig text (byggBeskrivning).
//   c) Sanningskravet gällde inte idé-pitcharna i praktiken: "dubbelt så många gäster"
//      och "betalar sig själv på tre månader" innehåller ingen SIFFRA och gick därför
//      rakt igenom den teckenbaserade siffergrinden.
//
// iterateGenerate mockas — testet mäter grindarna och loopen, inte modellen.

import { beforeEach, describe, expect, it, vi } from "vitest";

// Profilen som grindarna backar mot. Inga tal alls: då är VARJE siffra i ett förslag
// obackad, och testet kan hålla isär sifferfall från ordformsfall.
const PROFIL = [
  "## Företagsnamn\nDisplayteknik",
  "## USP (det som skiljer oss)\nEgen montage och service i Jämtland",
  "## Tonregler\nRakt och vänligt.",
].join("\n");

const iterateMock = vi.fn();

vi.mock("@/lib/iterate", () => ({ iterateGenerate: (...a: unknown[]) => iterateMock(...a) }));
vi.mock("@/lib/prompt-core", async (importOriginal) => {
  const riktig = await importOriginal<typeof import("@/lib/prompt-core")>();
  return {
    ...riktig,
    byggTextPrompt: vi.fn(async () => ({
      system: "SYSTEM",
      user: "",
      fingerprint: null,
      winning: [] as string[],
      profilText: PROFIL,
      meta: { lager: {}, profilKlippt: [] },
    })),
    // Identitetssanering: testet mäter grindarna, inte skrivreglerna (de har egna tester).
    saneraText: vi.fn(async (t: string) => t),
  };
});

import {
  ANTAL_IDEER,
  byggBeskrivning,
  generateStudioCopyResultat,
  ideerMeddelande,
} from "@/lib/studio/copy";

type Variant = { text: string; score: { total: number } | null };

const v = (o: Record<string, string>, total = 80): Variant => ({ text: JSON.stringify(o), score: { total } });

const OPTS = {
  clientId: "klient-1",
  templateId: "ark-textkort",
  format: "1080x1350",
  topic: "Menyn som ändras varje dag",
  brandName: "Displayteknik",
  industry: "Digital skyltning",
};

// Tre giltiga förslag med var sin hook-typ.
const GILTIG_A = { hookType: "fråga", headline1: "Skriver ni menyn för hand?", headline2: "Varje morgon på nytt.", body: "En skärm visar dagens rätter direkt när köket bestämt dem." };
const GILTIG_B = { hookType: "påstående", headline1: "Menyn hinner före kritan", headline2: "Nyheten syns direkt i fönstret.", body: "Ändringen slår igenom i fönstret så fort köket skrivit in den nya rätten." };
const GILTIG_C = { hookType: "konträr", headline1: "Kritan var aldrig problemet", headline2: "Tiden var boven.", body: "Den som skriver om tavlan varje morgon gör det i stället för att laga mat." };

beforeEach(() => {
  iterateMock.mockReset();
  // Default för rundor testet inte styr uttryckligen: tomt utfall, så loopen inte
  // kraschar på en runda vi inte brydde oss om.
  iterateMock.mockResolvedValue({ all_variants: [] });
});

// ── (a) 3-av-3 deterministiskt ────────────────────────────────────────────────
describe("punkt 2a — 3 av 3, aldrig tyst färre än utlovat", () => {
  it("allt överlever första rundan: 3 idéer, ett enda försök", async () => {
    iterateMock.mockResolvedValueOnce({ all_variants: [v(GILTIG_A), v(GILTIG_B), v(GILTIG_C)] });
    const r = await generateStudioCopyResultat(OPTS);
    expect(r.levererat).toBe(3);
    expect(r.begart).toBe(ANTAL_IDEER);
    expect(r.forsok).toBe(1);
    expect(iterateMock).toHaveBeenCalledTimes(1);
  });

  it("bortfall i parsning och filter genererar OM tills löftet är infriat", async () => {
    iterateMock
      .mockResolvedValueOnce({
        all_variants: [
          v(GILTIG_A),
          { text: "{ trasig json", score: { total: 90 } }, // parsningsfall
          v({ ...GILTIG_B, body: "Boka ett möte så fixar vi skärmen." }), // CTA i affischtexten → faller
          v(GILTIG_A), // dubblett → dedup
        ],
      })
      .mockResolvedValueOnce({ all_variants: [v(GILTIG_B), v(GILTIG_C)] });

    const r = await generateStudioCopyResultat(OPTS);
    expect(r.levererat).toBe(3);
    expect(r.forsok).toBe(2);
    expect(iterateMock).toHaveBeenCalledTimes(2);
    // Omtaget ska säga att de förra föll på grindarna, annars upprepar modellen felet.
    const andra = iterateMock.mock.calls[1][0] as { userPrompt: string; temperature: number };
    expect(andra.userPrompt).toContain("OMTAG");
    expect(andra.temperature).toBeGreaterThan(0.9); // samma temp ger samma förslag tillbaka
  });

  it("dedupen håller över rundgränsen: en omgenererad dubblett räknas inte", async () => {
    iterateMock
      .mockResolvedValueOnce({ all_variants: [v(GILTIG_A), v(GILTIG_B)] })
      .mockResolvedValueOnce({ all_variants: [v(GILTIG_A)] }) // samma som runda 1
      .mockResolvedValueOnce({ all_variants: [v(GILTIG_C)] });
    const r = await generateStudioCopyResultat(OPTS);
    expect(r.levererat).toBe(3);
    expect(r.forsok).toBe(3);
  });

  it("når vi inte 3 efter tre rundor levereras det som finns, med räknaren satt", async () => {
    iterateMock.mockResolvedValue({ all_variants: [v(GILTIG_A), v(GILTIG_B)] });
    const r = await generateStudioCopyResultat(OPTS);
    expect(r.levererat).toBe(2);
    expect(r.begart).toBe(3);
    expect(r.forsok).toBe(3);
    expect(iterateMock).toHaveBeenCalledTimes(3);
    expect(ideerMeddelande(r.levererat, r.begart)).toBe("2 av 3 klara, generera fler");
  });

  it("ett kraschat omtag raderar aldrig det som redan lyckats (fail-open)", async () => {
    iterateMock
      .mockResolvedValueOnce({ all_variants: [v(GILTIG_A), v(GILTIG_B)] })
      .mockRejectedValueOnce(new Error("nätverket dog"));
    const r = await generateStudioCopyResultat(OPTS);
    expect(r.levererat).toBe(2);
    expect(ideerMeddelande(r.levererat)).toBe("2 av 3 klara, generera fler");
  });

  it("meddelandet är tomt när löftet hölls", () => {
    expect(ideerMeddelande(3)).toBe("");
    expect(ideerMeddelande(3, 3)).toBe("");
    expect(ideerMeddelande(1)).toBe("1 av 3 klara, generera fler");
  });
});

// ── (b) interpunktion ─────────────────────────────────────────────────────────
describe("punkt 2b — beskrivningen är 1–2 fullständiga meningar, aldrig kolonfragment", () => {
  it("underrubrik + brödtext blir två hela meningar, utan kolon emellan", () => {
    const ut = byggBeskrivning("Skriver ni menyn för hand?", "Är skylten fortfarande aktuell?", "Vi byter innehållet åt er varje vecka.");
    expect(ut).toBe("Är skylten fortfarande aktuell? Vi byter innehållet åt er varje vecka.");
    expect(ut).not.toContain("?:");
    expect(ut).not.toContain(".:");
  });

  it("de verifierade fragmenten kan inte längre uppstå", () => {
    // "aktuell?:" och "gäster.:" — exakt de symptom Håkan såg i drift.
    for (const [h2, body] of [
      ["Är skylten aktuell?", "Innehållet uppdateras när ni vill."],
      ["Fler gäster ser menyn.", "Skärmen står där blicken redan är."],
    ]) {
      const ut = byggBeskrivning("En rubrik", h2, body);
      expect(ut).not.toMatch(/[.?!]\s*:/);
      expect(ut).not.toMatch(/:\s*$/);
    }
  });

  it("saknad slutpunkt läggs till, släpande kolon städas bort", () => {
    expect(byggBeskrivning("Rubrik", "Så här gör ni:", "Ni skriver in dagens rätt")).toBe("Så här gör ni. Ni skriver in dagens rätt.");
  });

  it("hooken är rubriken och upprepas inte i beskrivningen", () => {
    const ut = byggBeskrivning("Kritan var aldrig problemet", "Kritan var aldrig problemet.", "Tiden var det som kostade.");
    expect(ut).toBe("Tiden var det som kostade.");
  });

  it("aldrig fler än två meningar", () => {
    const ut = byggBeskrivning("Rubrik", "Ett. Två.", "Tre. Fyra.");
    expect(ut).toBe("Ett. Två.");
    expect(ut.split(/[.!?]/).filter((d) => d.trim()).length).toBe(2);
  });

  it("tom underrubrik ger en enda hel mening ur brödtexten", () => {
    expect(byggBeskrivning("Rubrik", "", "Skärmen visar dagens rätt")).toBe("Skärmen visar dagens rätt.");
    expect(byggBeskrivning("Rubrik", "", "")).toBe("");
  });

  it("förslagen ur flödet bär en färdig beskrivning", async () => {
    iterateMock.mockResolvedValueOnce({ all_variants: [v(GILTIG_A), v(GILTIG_B), v(GILTIG_C)] });
    const r = await generateStudioCopyResultat(OPTS);
    for (const s of r.suggestions) {
      expect(s.beskrivning.length).toBeGreaterThan(0);
      expect(s.beskrivning).not.toMatch(/[.?!]\s*:/);
      expect(s.beskrivning.trim()).toMatch(/[.!?…]$/); // hel mening, aldrig avhugget
      expect(s.beskrivning).not.toContain(s.headline1); // hooken upprepas inte
    }
  });
});

// ── (c) sanningskravet gäller även idé-pitcharna ──────────────────────────────
describe("punkt 2c — kvantifierade löften i ordform faller", () => {
  const medLofte = (lofte: string) => v({ hookType: "påstående", headline1: "Menyn som säljer", headline2: "Kort och tydligt.", body: lofte });

  it('"dubbelt så många gäster" och "betalar sig själv på tre månader" släpps inte igenom', async () => {
    iterateMock.mockResolvedValue({
      all_variants: [
        medLofte("Skärmen ger dubbelt så många gäster i lunchrusningen."),
        medLofte("Skärmen betalar sig själv på tre månader."),
        v(GILTIG_A),
      ],
    });
    const r = await generateStudioCopyResultat(OPTS);
    const text = r.suggestions.map((s) => `${s.headline1} ${s.headline2} ${s.body}`).join(" ");
    expect(text).not.toContain("dubbelt så många");
    expect(text).not.toContain("betalar sig själv");
    expect(r.suggestions.some((s) => s.headline1 === GILTIG_A.headline1)).toBe(true);
  });

  it("fler ordformer fälls: halva tiden, tre gånger fler, redan efter en vecka", async () => {
    iterateMock.mockResolvedValue({
      all_variants: [
        medLofte("Ni gör jobbet på halva tiden."),
        medLofte("Tre gånger fler ser erbjudandet i fönstret."),
        medLofte("Skylten lönar sig redan efter en vecka."),
        v(GILTIG_A),
      ],
    });
    const r = await generateStudioCopyResultat(OPTS);
    expect(r.levererat).toBe(1);
    expect(r.suggestions[0].headline1).toBe(GILTIG_A.headline1);
  });

  it("utfall UTAN storlek går igenom — det är formuleringen regeln pekar mot", async () => {
    iterateMock.mockResolvedValueOnce({
      all_variants: [
        medLofte("Fler gäster ser menyn, och ni sparar tryckkostnader."),
        v(GILTIG_A),
        v(GILTIG_C),
      ],
    });
    const r = await generateStudioCopyResultat(OPTS);
    expect(r.levererat).toBe(3);
    expect(r.suggestions.some((s) => s.body.includes("sparar tryckkostnader"))).toBe(true);
  });

  it("löftet släpps igenom när EXAKT frasen står i profilen (fail-closed, inte fail-blind)", async () => {
    iterateMock.mockResolvedValueOnce({ all_variants: [medLofte("Skylten betalar sig på ett år hos de flesta.")] });
    const utanTackning = await generateStudioCopyResultat(OPTS);
    expect(utanTackning.levererat).toBe(0);

    iterateMock.mockReset();
    iterateMock.mockResolvedValue({ all_variants: [] });
    iterateMock.mockResolvedValueOnce({ all_variants: [medLofte("Skylten betalar sig på ett år hos de flesta.")] });
    const { byggTextPrompt } = await import("@/lib/prompt-core");
    (byggTextPrompt as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      system: "SYSTEM",
      user: "",
      fingerprint: null,
      winning: [],
      profilText: `${PROFIL}\n## Erbjudande\nSkylten betalar sig på ett år hos de flesta kunder.`,
      meta: { lager: {}, profilKlippt: [] },
    });
    const medTackning = await generateStudioCopyResultat(OPTS);
    expect(medTackning.levererat).toBe(1);
  });
});

describe("punkt 2c — sanningskravet säger uttryckligen att ordformen räknas", () => {
  it("regeln namnger ordformerna och anvisar vägen ut", async () => {
    const { SANNINGSKRAV } = await import("@/lib/prompt-core");
    expect(SANNINGSKRAV).toContain("SIFFERPÅSTÅENDEN GÄLLER ÄVEN I ORDFORM");
    for (const fras of ["Dubbelt så många gäster", "tre gånger fler", "halva tiden", "betalar sig själv på tre månader"]) {
      expect(SANNINGSKRAV, fras).toContain(fras);
    }
    // Vägen ut: skriv utfallet utan storlek — Håkans egna exempel.
    expect(SANNINGSKRAV).toContain("fler gäster ser menyn");
    expect(SANNINGSKRAV).toContain("sparar tryckkostnader");
    // Och skälet: idén är ett löfte som följer med in i texten.
    expect(SANNINGSKRAV).toContain("även idéer, rubrikförslag och korta pitchar");
  });

  it("regeln når idé-flödets prompt (samma kärna som alla andra flöden)", async () => {
    const { SANNINGSKRAV, PERSPEKTIVREGEL, PRISREGEL } = await import("@/lib/prompt-core");
    // Idé-flödet bygger sin prompt med syfte "studio-text" via byggTextPrompt, och
    // kärnan lägger blocken för ALLA syften — verifierat i tests/prisregel.test.ts
    // och tests/perspektivregel.test.ts. Här räcker det att blocken finns och är
    // skilda från varandra, så ingen av dem kan tappas i en framtida sammanslagning.
    for (const block of [SANNINGSKRAV, PERSPEKTIVREGEL, PRISREGEL]) {
      expect(block.length).toBeGreaterThan(200);
    }
  });
});

// ── punkt 5: prisgrinden i samma flöde ────────────────────────────────────────
describe("punkt 5 — prisuppgift i affischtexten faller, undantaget släpper igenom", () => {
  const medPris = v({ hookType: "påstående", headline1: "Paketet ni frågat om", headline2: "Allt ingår.", body: "Startpaketet kostar från 21 000 kr." });

  it("utan användarens pris faller förslaget", async () => {
    iterateMock.mockResolvedValue({ all_variants: [medPris, v(GILTIG_A)] });
    const r = await generateStudioCopyResultat(OPTS);
    expect(r.suggestions.map((s) => s.body).join(" ")).not.toContain("21 000 kr");
  });

  it("skrev användaren själv in priset i ämnet gäller undantaget", async () => {
    iterateMock.mockResolvedValueOnce({ all_variants: [medPris, v(GILTIG_A), v(GILTIG_C)] });
    const r = await generateStudioCopyResultat({ ...OPTS, topic: "Kampanjen där startpaketet går på 21 000 kr" });
    expect(r.suggestions.some((s) => s.body.includes("21 000 kr"))).toBe(true);
  });
});
