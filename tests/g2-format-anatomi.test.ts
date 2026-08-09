// G-2 — formatanatomier som data.
//
// Fyra hål ur G0-RAPPORT 0.2/0.3 stängs här, och testerna är skrivna så att de faller om
// någon öppnar dem igen:
//   1. Story fanns inte som syfte — fick ett vanligt inläggs text i en yta som inte tål den.
//   2. Karusellanatomin var en fritextsträng inuti flödesfilen; slides räknades på tre
//      ställen med tre uttryck som kunde glida isär.
//   3. Reelmallen "Före och efter" saknade hook-scen helt.
//   4. Ingen säkerhetszon fanns för statiska format, trots att beskärningen äter ~6 %.

import { describe, expect, it } from "vitest";
import {
  KARUSELL_ROLLER,
  SAKER_ZON,
  STORY_ANATOMI,
  karusellAnatomiText,
  karusellAntalSlides,
  karusellRoller,
  sakerZonBildrad,
} from "@/lib/format-anatomi";
import { REEL_TEMPLATES } from "@/lib/studio/reels";
import { rattaSkenfragor } from "@/lib/content/writing-rules";

describe("G-2 · karusellens roller är data, inte fritext", () => {
  it("grundstrukturen är oförändrad: krok → punkter → avslut", () => {
    // Medvetet val: G-2 flyttar anatomin till data UTAN att ändra vad kunderna ser.
    // Faller det här testet har någon ändrat grundstrukturen — det ska vara ett beslut.
    expect(karusellRoller({ punkter: 3 })).toEqual(["hook", "point", "point", "point", "cta"]);
    expect(karusellAntalSlides({ punkter: 3 })).toBe(5);
  });

  it("insats ligger direkt efter kroken, bevis sist före avslutet", () => {
    expect(karusellRoller({ punkter: 2, medInsats: true, medBevis: true }))
      .toEqual(["hook", "insats", "point", "point", "bevis", "cta"]);
  });

  it("de nya rollerna är AV som standard", () => {
    const r = karusellRoller({ punkter: 3 });
    expect(r).not.toContain("insats");
    expect(r).not.toContain("bevis");
  });

  it("anatomitexten och slide-räkningen kommer ur SAMMA rollista", () => {
    // Rotorsaken bakom hela AKUT-KARUSELL var att löftet och koden räknade olika.
    const u = { punkter: 4, medBevis: true };
    const text = karusellAnatomiText(u);
    expect(text).toContain(`${karusellAntalSlides(u)} slides`);
    expect(karusellAntalSlides(u)).toBe(7);
  });

  it("bevis-sliden ber om verifierat material, aldrig om ett påhittat case", () => {
    // Den farligaste rollen att slå på: den BER om ett påstående som ska vara sant.
    const u = KARUSELL_ROLLER.bevis.uppgift;
    expect(u).toMatch(/verifierad/i);
    expect(u).toMatch(/story-bank/i);
    expect(u).toMatch(/aldrig som ett påhittat case/i);
  });

  it("varje roll har ett teckentak — annars är anatomin bara en åsikt", () => {
    for (const spec of Object.values(KARUSELL_ROLLER)) {
      expect(spec.maxRubrik).toBeGreaterThan(0);
      expect(spec.maxBrodtext).toBeGreaterThan(spec.maxRubrik);
    }
  });
});

describe("G-2 · storyn är inte ett inlägg i annan storlek", () => {
  it("kräver EN tanke och ett läsbart antal ord", () => {
    expect(STORY_ANATOMI).toMatch(/EN tanke/);
    expect(STORY_ANATOMI).toMatch(/3 till 12 ord/);
  });

  it("avslutet är en tumhandling, inte ett möte", () => {
    // Ett inläggs CTA fungerar inte i en yta där svaret sker med en tumme.
    expect(STORY_ANATOMI).toMatch(/svara på den här storyn/i);
    expect(STORY_ANATOMI).toMatch(/Aldrig 'boka ett möte'/);
  });

  it("förbjuder hashtags och brödtext", () => {
    expect(STORY_ANATOMI).toMatch(/Inga hashtags/);
  });
});

describe("G-2 · alla reelmallar börjar med en krok", () => {
  it("varje mall har hook som FÖRSTA scen", () => {
    // G0: "Tre av fyra mallar har hook, en har inte." Nu fyra av fyra.
    for (const [key, mall] of Object.entries(REEL_TEMPLATES)) {
      expect(mall.scenes[0]?.kind, `mallen ${key} börjar med ${mall.scenes[0]?.kind}`).toBe("hook");
    }
  });

  it("kroken är kort nog att fånga innan tittaren swipar", () => {
    // 1,7-sekundersregeln: en krok på tre sekunder är ingen krok.
    for (const [key, mall] of Object.entries(REEL_TEMPLATES)) {
      expect(mall.scenes[0].durationMs, `mallen ${key}`).toBeLessThanOrEqual(3000);
    }
  });

  it("Före och efter behöll sitt problem-steg — kroken ersatte det inte", () => {
    const kinds = REEL_TEMPLATES["fore-efter"].scenes.map((s) => s.kind);
    expect(kinds).toEqual(["hook", "problem", "losning", "cta"]);
  });
});

describe("G-2 · säkerhetszon för statiska format", () => {
  it("finns för alla tre formaten", () => {
    for (const f of ["1080x1350", "1080x1080", "1080x1920"] as const) {
      expect(SAKER_ZON[f].topp).toBeGreaterThan(0);
      expect(SAKER_ZON[f].sida).toBeGreaterThan(0);
    }
  });

  it("4:5 har marginal i höjd — det är där beskärningen äter", () => {
    // Kanvas 4:5 (0,800), AI-bilden begärs som 3:4 (0,750): ~6 % av höjden försvinner.
    expect(SAKER_ZON["1080x1350"].topp).toBeGreaterThanOrEqual(40);
    // 1:1 begärs som 1:1 → ingen beskärning, alltså mindre marginal.
    expect(SAKER_ZON["1080x1080"].topp).toBeLessThan(SAKER_ZON["1080x1350"].topp);
  });

  it("bildraden säger var motivet INTE får ligga, utan att beskriva ljus eller stil", () => {
    const rad = sakerZonBildrad("1080x1350");
    expect(rad).toMatch(/cropped away/);
    expect(rad).toMatch(/no faces/);
    // BILD-6/7: ljus, färgton och stil ägs av den grafiska profilen och krockar annars.
    expect(rad).not.toMatch(/lighting|cinematic|color grade/i);
  });
});

describe("G-2 · skenfrågegrinden utanför captionvägen", () => {
  it("påstående med frågetecken blir påstående med punkt", () => {
    const r = rattaSkenfragor("Sommaren dödar skärmar? Vi byter dem åt dig.");
    expect(r.text).toBe("Sommaren dödar skärmar. Vi byter dem åt dig.");
    expect(r.rattade).toHaveLength(1);
  });

  it("äkta frågor rörs ALDRIG", () => {
    // Omvänd ordföljd och frågeord = riktig fråga. Att "rätta" den vore att förstöra text.
    for (const t of ["Dödar sommaren skärmar?", "Vad kostar en skylt?", "Ett bättre skyltfönster?"]) {
      expect(rattaSkenfragor(t).text).toBe(t);
    }
  });

  it("orden rörs inte — bara skiljetecknet", () => {
    const fore = "Din skylt syns inte i solen?";
    const efter = rattaSkenfragor(fore).text;
    expect(efter.replace(/[.?]/g, "")).toBe(fore.replace(/[.?]/g, ""));
  });

  it("text utan skenfrågor lämnas orörd och rapporterar inget", () => {
    const t = "Vi byter skyltar. Ring oss idag.";
    expect(rattaSkenfragor(t)).toEqual({ text: t, rattade: [] });
  });
});
