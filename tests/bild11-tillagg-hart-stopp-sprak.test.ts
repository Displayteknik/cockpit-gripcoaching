// BILD-11-TILLÄGG (16/8) — Håkans beslut på den öppna frågan från 15/8: hårt stopp på
// läsbara ord gäller nu BÅDA språken, inte bara engelska. Fram till igår släpptes ett
// rättstavat svenskt läsbart ord igenom med bara en logg; det undantaget är borttaget.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROUTE = readFileSync(join(process.cwd(), "app/api/studio/suggest-image/route.ts"), "utf8");

describe("BILD-11-TILLÄGG · läsbar text stoppas oavsett språk", () => {
  it("det gamla fail-open-undantaget för svenska ord finns inte kvar", () => {
    expect(ROUTE).not.toContain('if (lasbart && !engelska)');
    expect(ROUTE).not.toContain("läsbara ord kvar efter");
  });

  it("orsak lasbar-text ger samma 502-stopp som orsak engelska", () => {
    // Efter fixen finns bara EN gren: !grind.utfall.ok -> logga + 502, oavsett orsak.
    const block = ROUTE.slice(ROUTE.indexOf("if (!grind.utfall.ok)"), ROUTE.indexOf("if (!grind.utfall.ok)") + 900);
    expect(block).toContain("status: 502");
    expect(block).not.toMatch(/if \(lasbart/);
  });

  it("felmeddelandet särskiljer fortfarande engelska från allmän läsbar text, för rätt vägledning", () => {
    expect(ROUTE).toContain("engelsk text på en skylt i motivet");
    expect(ROUTE).toContain("läsbar text i motivet");
  });
});
