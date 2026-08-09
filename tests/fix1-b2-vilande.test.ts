// FIX-1-REST B2 — Vilande som eget läge.
//
// Mätt 9/8 mot skarp data: Displaytekniks pipeline har ETT steg som heter
// "Förlorad / Paus (nurture)" med 24 affärer i sig, och koden läser ordet "paus" som
// förlorad. Varje parkerad kund räknas alltså som en förlorad affär.
//
// Håkans beslut: facket delas i två i MySales, och Cockpit SPEGLAR det — aldrig en egen
// parallell vokabulär. Det viktigaste testet här är därför inte att vilande fungerar,
// utan att INGENTING ändras förrän det delade steget finns. Att flippa de 24 affärerna
// i förväg vore att gissa vilka som är parkerade och presentera gissningen som fakta.

import { describe, expect, it } from "vitest";
import { arVilande, harledSteglage, harledStatus } from "@/lib/hq/pipeline";

const TOM = new Set<string>();

describe("B2 · ingenting ändras innan facket är delat", () => {
  it("det sammanslagna steget är fortfarande FÖRLORAT", () => {
    // Exakt namnet ur Displaytekniks pipeline, 24 affärer.
    const namn = "Förlorad / Paus (nurture)";
    expect(arVilande(null, namn, TOM)).toBe(false);
    expect(harledSteglage(null, namn, TOM, TOM, TOM)).toBe("lost");
  });

  it("ordet 'paus' ensamt räknas ALDRIG som vilande", () => {
    // Annars hade en gissning om vad "paus" betyder blivit systemets sanning.
    expect(arVilande(null, "Paus", TOM)).toBe(false);
    expect(arVilande(null, "Nurture / paus", TOM)).toBe(false);
  });

  it("ett fack som säger både vilande OCH förlorad är förlorat", () => {
    // Ett delat fack heter bara Vilande. Allt annat är fortfarande det gamla facket.
    expect(arVilande(null, "Förlorad / Paus / Vilande", TOM)).toBe(false);
  });

  it("harledStatus är orörd — de fem befintliga anroparna beter sig som förut", () => {
    expect(harledStatus(null, "Vunnen (order)", TOM, TOM)).toBe("won");
    expect(harledStatus(null, "Förlorad / Paus (nurture)", TOM, TOM)).toBe("lost");
    expect(harledStatus(null, "Offert skickad", TOM, TOM)).toBe("open");
  });
});

describe("B2 · när facket ÄR delat", () => {
  it("ett steg som bara heter Vilande är vilande", () => {
    expect(arVilande(null, "Vilande", TOM)).toBe(true);
    expect(harledSteglage(null, "Vilande", TOM, TOM, TOM)).toBe("vilande");
  });

  it("Håkans utpekade steg-id vinner över alla namn", () => {
    // Speglingen ska följa MySales inställning, inte en tolkning av ett stegnamn.
    const vilande = new Set(["steg-42"]);
    expect(arVilande("steg-42", "vad som helst", vilande)).toBe(true);
    expect(harledSteglage("steg-42", "Offert skickad", TOM, TOM, vilande)).toBe("vilande");
  });

  it("vilande prövas FÖRE förlorad", () => {
    // Ett utpekat vilande-steg får aldrig läsas som förlorat för att fallbacken
    // råkar hitta ett ord i namnet.
    const vilande = new Set(["steg-9"]);
    const forlorare = new Set(["steg-9"]);
    expect(harledSteglage("steg-9", "Förlorad", forlorare, forlorare, vilande)).toBe("vilande");
  });

  it("vunnet och i spel påverkas inte", () => {
    const vilande = new Set(["steg-42"]);
    expect(harledSteglage(null, "Vunnen (order)", TOM, TOM, vilande)).toBe("won");
    expect(harledSteglage(null, "Offert skickad", TOM, TOM, vilande)).toBe("open");
  });
});
