// TON-1 — varje captionvariant får sitt egna tonläge. Håkans fynd 2026-08-12:
// "DISC etc ska ju variras och hänga med här, allt är hela tiden lika."
//
// Testerna låser tre saker: att tonerna faktiskt SKILJER sig mellan varianterna, att dagens
// profil är utgångspunkt i stället för att köras över, och att tonen aldrig blir ett mandat
// att hitta på en siffra. Den tredje är den som betyder något — D:s hook är ordagrant
// "rak siffra" och C:s "överraskande fakta".
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DISC_ORDNING, tonForVariant, tonInstruktion, tonOrdning } from "@/lib/ton-varianter";
import { DISC_LABEL_SV } from "@/lib/content-compass/labels";
import type { DiscLetter } from "@/lib/content-compass/data";

const las = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("TON-1 · tonen delas ut, den önskas inte", () => {
  it("tre varianter får tre OLIKA tonlägen", () => {
    const tre = [0, 1, 2].map((i) => tonForVariant(i));
    expect(new Set(tre).size).toBe(3);
  });

  it("fyra varianter täcker alla fyra tonlägen, ingen dubblett", () => {
    const fyra = [0, 1, 2, 3].map((i) => tonForVariant(i));
    expect(new Set(fyra)).toEqual(new Set(DISC_ORDNING));
  });

  it("dagens profil körs aldrig över — den blir variant 0", () => {
    expect(tonForVariant(0, ["I"])).toBe("I");
    expect(tonForVariant(0, ["C"])).toBe("C");
    // ...och de andra får sällskap, inte samma ton.
    const tre = [0, 1, 2].map((i) => tonForVariant(i, ["I"]));
    expect(tre[0]).toBe("I");
    expect(new Set(tre).size).toBe(3);
  });

  it("har användaren klickat i flera bokstäver används de först, i tur och ordning", () => {
    const ordning = tonOrdning(["C", "I"]);
    // DISC-ordning inom de valda: I före C. Båda före de ovalda.
    expect(ordning.slice(0, 2)).toEqual(["I", "C"]);
    expect(new Set(ordning)).toEqual(new Set(DISC_ORDNING));
  });

  it("utan val gäller DISC-ordningen", () => {
    expect(tonOrdning([])).toEqual(DISC_ORDNING);
    expect(tonOrdning(null)).toEqual(DISC_ORDNING);
    expect(tonOrdning(["X" as DiscLetter])).toEqual(DISC_ORDNING);
  });

  it("determinism: samma variantnummer och samma val ger alltid samma ton", () => {
    for (const i of [0, 1, 2, 3, 7]) {
      expect(tonForVariant(i, ["S"])).toBe(tonForVariant(i, ["S"]));
    }
  });

  it("negativa och för höga variantnummer ger ändå ett giltigt tonläge", () => {
    for (const i of [-1, -4, 9, 40]) {
      expect(DISC_ORDNING).toContain(tonForVariant(i));
    }
  });
});

describe("TON-1 · tonen får aldrig bli en beställning på en påhittad siffra", () => {
  // G-3 fångade exakt detta i hook-typerna: förbehållet "endast verifierad ur profilen"
  // föll bort och regeln blev en uppmaning att hitta på ett tal. Tonen bär samma risk,
  // eftersom D och C uttryckligen ber om siffror och fakta.
  it("varje tonläge bär förbehållet om vad som är sant", () => {
    for (const d of DISC_ORDNING) {
      const t = tonInstruktion(d);
      expect(t, d).toContain("Tonen styr HUR du skriver, aldrig VAD som är sant");
      expect(t, d).toMatch(/aldrig motivera en siffra/);
    }
  });

  it("ingen toninstruktion innehåller ett eget tal", () => {
    for (const d of DISC_ORDNING) {
      expect(tonInstruktion(d), d).not.toMatch(/\d+\s*(%|kr|nits|timmar|gånger)/i);
    }
  });

  it("instruktionen namnger tonläget och skiljer sig mellan bokstäverna", () => {
    const alla = DISC_ORDNING.map((d) => tonInstruktion(d));
    expect(new Set(alla).size).toBe(4);
    for (const d of DISC_ORDNING) expect(tonInstruktion(d)).toContain(`tonläge ${d}`);
  });
});

describe("TON-1 · captionvägen kopplar in tonen på riktigt", () => {
  const route = las("app/api/studio/suggest-caption/route.ts");

  it("tonen delas ut per variant med innehållsprofilen som utgångspunkt", () => {
    expect(route).toContain("tonForVariant(i, valdaDisc)");
  });

  it("tonen följer med i svaret så gränssnittet kan visa den", () => {
    expect(route).toContain("ton,");
  });

  // Det viktigaste låset i filen. Ligger DISC kvar i den delade prompten säger
  // systemprompten ETT tonläge medan variantinstruktionen säger ett annat — en
  // självmotsägelse i samma prompt, och då följer modellen tillståndet, inte förbudet.
  it("DISC lyfts UR den delade prompten i A/B-läget", () => {
    expect(route).toContain("const compassForPrompt = abLage && inCompass ? { ...inCompass, disc: [] } : inCompass");
    expect(route).toContain("compass: compassForPrompt,");
  });

  it("steg i kundresan och berättarform ligger kvar delade — de säger vad inlägget ÄR", () => {
    // Bara disc nollställs. Skulle funnel eller four_a tömmas vore det inte tre varianter
    // av ett inlägg, utan tre olika inlägg.
    expect(route).not.toContain("funnel: null }");
    expect(route).not.toContain("four_a: null }");
  });

  it("enskild caption rör inte tonen — en text, dagens tonläge", () => {
    // abLage är falskt när variants < 2, och då skickas inCompass orörd vidare.
    expect(route).toContain("const abLage = n >= 2");
  });
});

describe("TON-1 · tonen syns i gränssnittet", () => {
  const studio = las("components/StudioMaker.tsx");

  it("variantkortet visar tonläget i klarspråk", () => {
    expect(studio).toContain("DISC_LABEL_SV[v.ton]");
  });

  it("vald variant flyttar upp sin ton i innehållsprofilen", () => {
    // Annars säger raden ett tonläge medan texten under är skriven i ett annat — samma
    // sorts tomma UI-löfte som resten av granskningen handlat om.
    expect(studio).toContain("if (v.ton) setCompass((c) => ({ ...c, disc: [v.ton as DiscLetter] }))");
  });

  it("etiketterna är klarspråk, inga systemord", () => {
    for (const d of DISC_ORDNING) {
      const etikett = DISC_LABEL_SV[d];
      expect(etikett, d).toBeTruthy();
      expect(etikett.toLowerCase(), d).not.toMatch(/disc|tofu|mofu|bofu|prompt/);
    }
  });
});
