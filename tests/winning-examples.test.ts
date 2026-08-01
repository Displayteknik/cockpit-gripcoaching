// PROFIL-1/F2 — urvalet av vinnande exempel (lager 5).
// Fyndet: subcategory-filtret stängde av hela lagret eftersom alla winning_example-
// rader på plattformen saknar subcategory. Testerna låser den nya regeln: rätt kanal
// först, oklassade som fallback, ANNAN kanal aldrig.

import { describe, expect, it } from "vitest";
import { valjWinningExamples, type WinningRad } from "@/lib/voice-score";

const lang = (t: string) => t.padEnd(120, ".");

const RADER: WinningRad[] = [
  { body: lang("Linkedin-exempel"), subcategory: "linkedin" },
  { body: lang("Oklassat exempel A"), subcategory: null },
  { body: lang("Mejlexempel"), subcategory: "newsletter" },
  { body: lang("Oklassat exempel B"), subcategory: "" },
];

describe("valjWinningExamples", () => {
  it("oklassade rader (subcategory saknas) når prompten — annars är lagret avstängt", () => {
    const ut = valjWinningExamples([{ body: lang("Oklassat"), subcategory: null }], "caption");
    expect(ut).toHaveLength(1);
    expect(ut[0]).toContain("Oklassat");
  });

  it("rätt kanal väljs före oklassade", () => {
    const ut = valjWinningExamples(RADER, "linkedin", 2);
    expect(ut[0]).toContain("Linkedin-exempel");
    expect(ut[1]).toContain("Oklassat exempel A");
  });

  it("en ANNAN kanals exempel väljs aldrig", () => {
    const ut = valjWinningExamples(RADER, "caption", 5).join("\n");
    expect(ut).not.toContain("Mejlexempel");
    expect(ut).not.toContain("Linkedin-exempel");
    expect(ut).toContain("Oklassat exempel A");
    expect(ut).toContain("Oklassat exempel B");
  });

  it("utan kategori gäller allt (kanal-anpassning) — som förut", () => {
    expect(valjWinningExamples(RADER, undefined, 10)).toHaveLength(4);
  });

  it("för korta rader (<30 tecken) och tomma bodies räknas inte", () => {
    const ut = valjWinningExamples([{ body: "Kort", subcategory: null }, { body: null, subcategory: null }], "caption");
    expect(ut).toEqual([]);
  });

  it("limit respekteras", () => {
    expect(valjWinningExamples(RADER, "linkedin", 1)).toHaveLength(1);
  });

  it("kategorimatchningen är okänslig för skiftläge och mellanslag", () => {
    const ut = valjWinningExamples([{ body: lang("Caption-exempel"), subcategory: " Caption " }], "caption");
    expect(ut[0]).toContain("Caption-exempel");
  });
});
