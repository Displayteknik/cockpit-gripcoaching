// Småfix 16/8 (5) — steg 5 lovar "3–5 relevanta hashtags på egen rad sist", men bara CTA
// hade en golv-kontroll (sakerstallCaption). Hashtags hade bara ett TAK (begransaHashtags
// klipper om det är för många) — ingen kontroll om modellen glömde dem helt.
import { describe, it, expect } from "vitest";
import { harHashtags, sakerstallCaption, HASHTAG_SKARPNING } from "../lib/content/writing-rules";

describe("Småfix 16/8 (5) · harHashtags", () => {
  it("upptäcker en hashtag-rad sist", () => {
    expect(harHashtags("Boka en tid idag.\n\n#skyltar #jämtland")).toBe(true);
  });
  it("upptäcker en lös hashtag mitt i texten också", () => {
    expect(harHashtags("Vi älskar #skyltar här.")).toBe(true);
  });
  it("false när det inte finns någon hashtag alls", () => {
    expect(harHashtags("Boka en tid idag.")).toBe(false);
  });
  it("false på tom text", () => {
    expect(harHashtags("")).toBe(false);
  });
});

describe("Småfix 16/8 (5) · sakerstallCaption fäller text utan hashtags", () => {
  it("en text med CTA men utan hashtags omgenereras, inte godkänns tyst", async () => {
    const utanTaggar = "Boka en tid idag så hjälper vi dig.";
    let anropad = false;
    const r = await sakerstallCaption(utanTaggar, new Set(), async (skarpning) => {
      anropad = true;
      expect(skarpning).toContain(HASHTAG_SKARPNING);
      return "Boka en tid idag så hjälper vi dig.\n\n#skyltar #jämtland";
    });
    expect(anropad).toBe(true);
    expect(r.godkand).toBe(true);
    expect(harHashtags(r.text)).toBe(true);
  });

  it("en text med både CTA och hashtags godkänns direkt, ingen omgenerering", async () => {
    const bra = "Boka en tid idag så hjälper vi dig.\n\n#skyltar #jämtland";
    let anropad = false;
    const r = await sakerstallCaption(bra, new Set(), async () => { anropad = true; return ""; });
    expect(anropad).toBe(false);
    expect(r.godkand).toBe(true);
  });
});
