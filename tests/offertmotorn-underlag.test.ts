// Offertmotorn — det deterministiska underlaget (valutakurs + marknadsbild).
//
// Poängen: modellen får ALDRIG gissa kursen, och en kurs som inte gick att hämta får aldrig
// passera tyst. calcRate returnerar 1 för okänd valuta, vilket räknar 2 300 USD som 2 300 kr.
// Testerna låser fast att det läget alltid syns som en varning.
//
// Inget nät, ingen nyckel: fx-objektet byggs för hand.

import { describe, expect, it } from "vitest";
import { alderIDagar, fxVarning, FX_BUFFER, type FxRates } from "@/lib/offert/fx";
import { fxBlock, marknadsFraga, marknadsBlock } from "@/lib/offert/underlag";

function fx(over: Partial<FxRates> = {}): FxRates {
  return {
    rates: { SEK: 1, USD: 9.6, EUR: 11.2, CNY: 1.32 },
    date: "2026-08-07",
    buffer: FX_BUFFER,
    saknas: [],
    alderDagar: 2,
    ...over,
  };
}

describe("alderIDagar", () => {
  it("räknar dygn mellan notering och idag", () => {
    expect(alderIDagar("2026-08-07", new Date("2026-08-09T12:00:00Z"))).toBe(2);
    expect(alderIDagar("2026-08-09", new Date("2026-08-09T00:30:00Z"))).toBe(0);
  });
  it("ger null när datumet inte är ett datum", () => {
    expect(alderIDagar("")).toBeNull();
    expect(alderIDagar("igår")).toBeNull();
  });
});

describe("fxVarning", () => {
  it("tiger när kursen är färsk och komplett", () => {
    expect(fxVarning(fx())).toBeNull();
  });
  it("varnar när en valuta saknas, och namnger den", () => {
    const v = fxVarning(fx({ saknas: ["USD"] }));
    expect(v).toContain("USD");
    expect(v).toContain("räknas som SEK");
  });
  it("varnar för gammal notering men släpper igenom en långhelg", () => {
    expect(fxVarning(fx({ alderDagar: 3 }))).toBeNull();
    expect(fxVarning(fx({ alderDagar: 4 }))).toContain("4 dygn");
  });
  it("saknad valuta går före gammal notering", () => {
    expect(fxVarning(fx({ saknas: ["USD"], alderDagar: 9 }))).toContain("USD");
  });
});

describe("fxBlock", () => {
  it("skriver ut spot, kalkylkurs och datum så modellen slipper räkna själv", () => {
    const b = fxBlock(fx());
    expect(b).toContain("Riksbanken");
    expect(b).toContain("2026-08-07");
    expect(b).toContain("9,6000"); // spot USD
    expect(b).toContain("9,8880"); // 9,6 × 1,03
    expect(b).toContain("Räkna ALDRIG med en egen kurs");
  });
  it("lyfter in varningen i blocket när kursen saknas", () => {
    const b = fxBlock(fx({ rates: { SEK: 1 }, saknas: ["USD", "EUR", "CNY"] }));
    expect(b).toContain("VARNING:");
    expect(b).not.toContain("Kalkylkurs att räkna med");
  });
});

describe("marknadsFraga", () => {
  it("plockar produktnamnen ur raderna och lämnar kalkyltexten", () => {
    const q = marknadsFraga(
      "- 3 st Utomhusskärm 55 tum · landad kostnad 24 500 kr/st\n- 1 st DT-Player · landad kostnad 900 kr/st\n\nLandad kostnad = EXW plus frakt.",
      "Café Hörnan",
    );
    expect(q).toContain("3 st Utomhusskärm 55 tum");
    expect(q).toContain("Café Hörnan");
    expect(q).not.toContain("24 500");
  });
  it("ger tom sträng när det inte finns någon produkt", () => {
    expect(marknadsFraga("")).toBe("");
  });
});

describe("marknadsBlock", () => {
  it("säger ifrån i klartext när marknadsbilden inte gick att hämta", () => {
    const b = marknadsBlock({ text: "", kallor: [], fel: "GEMINI_API_KEY saknas i env" });
    expect(b).toContain("Kunde inte hämtas");
    expect(b).toContain("Hitta ALDRIG på marknadspriser");
  });
  it("tar med källorna när den gick att hämta", () => {
    const b = marknadsBlock({ text: "Prisspann 20 000 till 30 000 kr.", kallor: [{ title: "Prisguiden", uri: "https://x.se" }], fel: null });
    expect(b).toContain("Prisspann 20 000");
    expect(b).toContain("https://x.se");
    expect(b).toContain("webbfynd, inte offerter");
  });
});
