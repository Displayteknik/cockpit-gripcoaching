// PROFIL-1/F-intake — diff-grinden som stänger HM Motor-rotorsaken.
// Skarpt fall: en Ikigai-körning mot standardtenanten skrev över bilhandelns usp,
// icp_primary och services med coachingtext. Ingen fick se vad som försvann.

import { describe, expect, it } from "vitest";
import { berakraIdentitetsDiff, IDENTITETSFALT } from "@/lib/intake/identitet";

const HM = {
  usp: "Vi säljer begagnade bilar i Krokom med garanti och egen verkstad.",
  icp_primary: "Bilköpare i Jämtland som vill ha en trygg begagnatbil.",
  services: "Bilförsäljning, service, däckhotell.",
  tagline: "",
};

describe("berakraIdentitetsDiff", () => {
  it("HM Motor-fallet: coachingtext över bilhandelns identitetsfält flaggas", () => {
    const diff = berakraIdentitetsDiff(
      HM,
      {
        usp: "Till skillnad från rena teknikkonsulter kombinerar vi implementation och coaching.",
        icp_primary: "Etablerade soloföretagare som saknar ett förutsägbart kundflöde.",
        services: "Kundflöde & Klarhet (6-veckors program).",
      },
      new Set(["usp", "icp_primary", "services"]),
    );
    expect(diff.map((d) => d.field).sort()).toEqual(["icp_primary", "services", "usp"]);
    expect(diff[0].current).toContain("Krokom");
    expect(diff[0].proposed).toContain("teknikkonsulter");
    expect(diff[0].label).toBe(IDENTITETSFALT.usp);
  });

  it("tomt fält → ifyllt är ingen förlust och kräver ingen bekräftelse", () => {
    const diff = berakraIdentitetsDiff(HM, { tagline: "Trygga bilar i Krokom" }, new Set(["tagline"]));
    expect(diff).toEqual([]);
  });

  it("saknad profil (ny klient) kräver ingen bekräftelse", () => {
    expect(berakraIdentitetsDiff(null, { usp: "Nytt" }, new Set(["usp"]))).toEqual([]);
  });

  it("tillägg (appendUnique) räknas aldrig som överskrivning", () => {
    const diff = berakraIdentitetsDiff(HM, { usp: `${HM.usp}\nOckså däckhotell.` }, new Set());
    expect(diff).toEqual([]);
  });

  it("samma värde med annan blankradsformatering är ingen ändring", () => {
    const diff = berakraIdentitetsDiff(HM, { usp: `  ${HM.usp.replace(/ /g, "  ")}  ` }, new Set(["usp"]));
    expect(diff).toEqual([]);
  });

  it("fält utanför identitetslistan (t.ex. tonregler) grindas inte", () => {
    const diff = berakraIdentitetsDiff({ tone_rules: "Rakt och vänligt." }, { tone_rules: "Formellt." }, new Set(["tone_rules"]));
    expect(diff).toEqual([]);
  });

  it("långa värden klipps i förhandsvisningen", () => {
    const langt = "a".repeat(2000);
    const diff = berakraIdentitetsDiff({ usp: langt }, { usp: "b".repeat(2000) }, new Set(["usp"]));
    expect(diff[0].current.length).toBeLessThanOrEqual(601);
    expect(diff[0].current.endsWith("…")).toBe(true);
  });
});
