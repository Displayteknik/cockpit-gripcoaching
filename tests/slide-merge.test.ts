// Karusellens sammanslagning — två avslut får aldrig kunna uppstå.
//
// Skarpt fall (Håkan 2026-08-09, ANDRA gången samma symptom): en karusell fick två
// "Avslut" efter att han lagt till en slide och kört Generera karusell igen.
//
// Rotorsak: sammanslagningen parade plats mot plats. Lägger man till en slide hamnar den
// nya punkten före avslutet, som flyttas ett steg ned. AI:t svarar med sitt avslut på den
// gamla platsen. Användarens tomma punkt övertog då avslutets roll, och det riktiga
// avslutet följde med orört på nästa plats.

import { describe, expect, it } from "vitest";
import { slaIhopSlides } from "@/lib/studio/slide-merge";
import type { StudioSlide } from "@/lib/studio/payload";

const s = (kind: StudioSlide["kind"], headline = "", body = "", imageUrl = ""): StudioSlide =>
  ({ kind, headline, body, imageUrl });

const roller = (l: StudioSlide[]) => l.map((x) => x.kind);

describe("slaIhopSlides — Håkans repro", () => {
  it("en tillagd slide ger INTE två avslut", () => {
    // Seedad karusell där användaren lagt till en punkt före avslutet.
    const gamla = [s("hook", "Krok"), s("point", "P1"), s("point", "P2"), s("point", "P3"), s("point"), s("cta", "Vill du synas bättre i sommar?")];
    // Motorn svarar med sin egen femslides-karusell.
    const nya = [s("hook", "AI-krok"), s("point", "A1"), s("point", "A2"), s("point", "A3"), s("cta", "AI-avslut")];

    const { merged } = slaIhopSlides(gamla, nya);

    expect(merged.filter((x) => x.kind === "cta")).toHaveLength(1);
    expect(merged.filter((x) => x.kind === "hook")).toHaveLength(1);
    expect(roller(merged)).toEqual(["hook", "point", "point", "point", "point", "cta"]);
    // Avslutet ligger sist och bär användarens egen text.
    expect(merged[merged.length - 1].headline).toBe("Vill du synas bättre i sommar?");
  });

  it("den tomma punkten fylls med AI-text men förblir en punkt", () => {
    const gamla = [s("hook", "K"), s("point", "P1"), s("point"), s("cta", "Avslut")];
    const nya = [s("hook", "AK"), s("point", "A1"), s("point", "A2"), s("cta", "AAvslut")];
    const { merged } = slaIhopSlides(gamla, nya);
    const tom = merged[2];
    expect(tom.kind).toBe("point");
    expect(tom.headline).toBe("A2");
  });
});

describe("slaIhopSlides — vad som aldrig får gå förlorat", () => {
  it("användarens bild överlever alltid", () => {
    const gamla = [s("hook", "", "", "bild-hook.png"), s("point", "P1", "", "bild-p1.png"), s("cta", "Avslut")];
    const nya = [s("hook", "AK"), s("point", "A1"), s("cta", "AAvslut")];
    const { merged } = slaIhopSlides(gamla, nya);
    expect(merged[0].imageUrl).toBe("bild-hook.png");
    expect(merged[1].imageUrl).toBe("bild-p1.png");
  });

  it("egen text skrivs aldrig över — den blir en diff att välja", () => {
    const gamla = [s("hook", "Min krok"), s("point", "Min punkt"), s("cta", "Mitt avslut")];
    const nya = [s("hook", "AI-krok"), s("point", "AI-punkt"), s("cta", "AI-avslut")];
    const { merged, diffs } = slaIhopSlides(gamla, nya);
    expect(merged.map((x) => x.headline)).toEqual(["Min krok", "Min punkt", "Mitt avslut"]);
    expect(diffs).toHaveLength(3);
    expect(diffs.every((d) => d.anvand === false)).toBe(true);
    // Diff-indexen ska peka in i RESULTATET, annars byts fel slide ut när man godkänner.
    expect(diffs.map((d) => d.index)).toEqual([0, 1, 2]);
  });

  it("fler egna punkter än motorn föreslår försvinner inte", () => {
    const gamla = [s("hook", "K"), s("point", "P1"), s("point", "P2"), s("point", "P3"), s("point", "P4"), s("cta", "Avslut")];
    const nya = [s("hook", "AK"), s("point", "A1"), s("cta", "AAvslut")];
    const { merged } = slaIhopSlides(gamla, nya);
    expect(merged.filter((x) => x.kind === "point")).toHaveLength(4);
    expect(merged.filter((x) => x.kind === "cta")).toHaveLength(1);
  });

  it("en gammal karusell som REDAN har två avslut läks", () => {
    // Håkans deck 9/8 hade avslut på både plats 5 och 8 efter tidigare körningar.
    const gamla = [s("hook", "K"), s("point", "P1"), s("cta", "Avslut A"), s("point", "P2"), s("cta", "Avslut B")];
    const nya = [s("hook", "AK"), s("point", "A1"), s("cta", "AAvslut")];
    const { merged } = slaIhopSlides(gamla, nya);
    expect(merged.filter((x) => x.kind === "cta")).toHaveLength(1);
    expect(roller(merged)).toEqual(["hook", "point", "point", "cta"]);
  });

  it("ordningen är alltid krok först, avslut sist", () => {
    const gamla = [s("cta", "Avslut"), s("point", "P1"), s("hook", "K")];
    const nya: StudioSlide[] = [];
    const { merged } = slaIhopSlides(gamla, nya);
    expect(roller(merged)).toEqual(["hook", "point", "cta"]);
  });

  it("tom motor-respons rör inte användarens karusell", () => {
    const gamla = [s("hook", "K"), s("point", "P1"), s("cta", "Avslut")];
    const { merged, diffs } = slaIhopSlides(gamla, []);
    expect(merged.map((x) => x.headline)).toEqual(["K", "P1", "Avslut"]);
    expect(diffs).toEqual([]);
  });
});
