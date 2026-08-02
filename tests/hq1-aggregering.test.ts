import { describe, it, expect } from "vitest";
import { harledStatus } from "@/lib/hq/pipeline";
import { veckansSpann } from "@/app/api/hq/route";

// HQ-1 — de två reglerna som morgonlistan och Displayteknik-korten står och faller med.

describe("harledStatus", () => {
  const vinnare = new Set(["98ae3cff-18a0-4f01-93cc-cc6965a195ce"]);
  const forlorare = new Set(["a6023573-4e6a-4ab4-ae91-f15bace0c36f"]);

  it("litar på Håkans inställda steg-id före stegnamnet", () => {
    expect(harledStatus("98ae3cff-18a0-4f01-93cc-cc6965a195ce", "Vunnen (order)", vinnare, forlorare)).toBe("won");
    expect(harledStatus("a6023573-4e6a-4ab4-ae91-f15bace0c36f", "Förlorad / Paus (nurture)", vinnare, forlorare)).toBe("lost");
  });

  it("faller tillbaka på stegnamnet när inget facit finns", () => {
    const tomt = new Set<string>();
    expect(harledStatus("okänt-id", "Vunnen (order)", tomt, tomt)).toBe("won");
    expect(harledStatus("okänt-id", "Payment Made", tomt, tomt)).toBe("won");
    expect(harledStatus("okänt-id", "Förlorad / Paus (nurture)", tomt, tomt)).toBe("lost");
    expect(harledStatus("okänt-id", "Offert skickad", tomt, tomt)).toBe("open");
  });

  // Rotorsaken till hela regeln: GHL svarar status "open" även för vunna affärer
  // (verifierat live 2026-08-02, alla 51 DT-affärer). Räknar vi på status blir
  // "vunnet denna månad" alltid noll, och pipelinesumman räknar in vunnet och förlorat.
  it("ett kort i vinststeget räknas som vunnet även om GHL kallar det open", () => {
    expect(harledStatus("98ae3cff-18a0-4f01-93cc-cc6965a195ce", "Vunnen (order)", vinnare, forlorare)).not.toBe("open");
  });

  it("saknat steg ger open, aldrig ett gissat utfall", () => {
    expect(harledStatus(null, null, vinnare, forlorare)).toBe("open");
  });
});

describe("veckansSpann", () => {
  it("börjar på måndag och slutar på söndag", () => {
    // Onsdag 2026-08-05
    expect(veckansSpann(new Date("2026-08-05T09:00:00Z"))).toEqual({ start: "2026-08-03", slut: "2026-08-09" });
  });

  it("söndag hör till veckan som började i måndags, inte till nästa", () => {
    expect(veckansSpann(new Date("2026-08-09T09:00:00Z"))).toEqual({ start: "2026-08-03", slut: "2026-08-09" });
  });

  it("måndag är första dagen i sitt eget spann", () => {
    expect(veckansSpann(new Date("2026-08-03T09:00:00Z"))).toEqual({ start: "2026-08-03", slut: "2026-08-09" });
  });

  // Servern kör UTC. Utan tidszonen skulle söndag kväll svensk tid räknas till fel vecka.
  it("sen söndagskväll svensk tid tillhör fortfarande söndagens vecka", () => {
    expect(veckansSpann(new Date("2026-08-09T22:30:00Z"))).toEqual({ start: "2026-08-10", slut: "2026-08-16" });
  });
});
