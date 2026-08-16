// PUBLICERA-1 (16/8) — "Publicera nu på Facebook" gav media.0.Invalid media format type.
// Orsak, bekräftad mot GHL:s officiella API-referens (Create post): media[]-objekt kräver
// ett eget `type` (MIME-typ, t.ex. "image/jpeg"), inte bara { url }. Draft-vägen validerar
// inte media alls ("Draft posts skip most validations") — därför var bara direktvägen trasig
// trots att båda vägarna alltid gått genom samma ghlCreateDraft-funktion.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const las = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const GHL = las("lib/studio/ghl.ts");
const PUBLISH = las("lib/publish/index.ts");

describe("PUBLICERA-1 · media[] bär ett eget type-fält", () => {
  it("buildGhlMedia sätter type: image/jpeg per objekt", () => {
    expect(GHL).toContain('type: "image/jpeg"');
  });

  it("ghlCreateDraft bygger media via den delade funktionen, inte en egen .map", () => {
    expect(GHL).toContain("const { media, error: mediaFel } = await buildGhlMedia(bildUrls)");
    // Den gamla, trasiga byggaren ({ url } utan type) ska vara borta.
    expect(GHL).not.toContain(".map((url) => ({ url }))");
  });

  it("en trasig bild stoppar posten med fel, i stället för att skicka ett ofullständigt media-objekt", () => {
    expect(GHL).toContain("if (mediaFel) return { error: mediaFel }");
  });

  it("bilden säkras till JPEG innan den skickas (samma helper som Instagram-vägen litar på)", () => {
    expect(GHL).toContain("ensureJpegUrl(u)");
  });
});

describe("PUBLICERA-1 · samma funktion, båda vägarna (utkast och direkt)", () => {
  it("ghlCreateDraft har inte grenat sig i två media-byggare", () => {
    // Ett enda anrop till buildGhlMedia i hela filen — annars har draft och publicera
    // tyst fått olika kod igen, precis det beställningen bad om att undvika.
    const antal = (GHL.match(/buildGhlMedia\(/g) || []).length;
    expect(antal).toBe(2); // definitionen + det enda anropet
  });
});

describe("PUBLICERA-1 · svenska felmeddelanden, aldrig rå API-text till kund", () => {
  it("fail() loggar råtexten internt", () => {
    expect(PUBLISH).toContain("console.error(`[publish:${channel}]`, error)");
  });

  it("fail() returnerar en översatt text, inte råtexten", () => {
    expect(PUBLISH).toContain("error: oversattFel(error, channel)");
  });

  it("ett media/bild-relaterat fel ger exakt det klarspråksmeddelande beställningen bad om", () => {
    expect(PUBLISH).toContain("Bilden kunde inte skickas till");
    expect(PUBLISH).toContain("försök igen eller spara som utkast");
  });

  it("ett nyckel/auth-fel ger ett eget klarspråksmeddelande, inte samma text som bildfelet", () => {
    expect(PUBLISH).toContain("Kopplingen till");
    expect(PUBLISH).toContain("verkar bruten");
  });
});
