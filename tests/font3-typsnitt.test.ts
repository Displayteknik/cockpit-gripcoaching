// FONT-3 — ett typsnitt måste stå på FEM ställen för att fungera. Står det på fyra
// fallerar det tyst, och bara i det ena flödet där listan saknas.
//
// De fem:
//   1. public/fonts/<fil>.ttf                  filen måste finnas på disk
//   2. app/studio/render/studio-fonts.css      @font-face, annars ritas inget i renderingen
//   3. lib/studio/brand.ts ALLOWED_FONTS       annars kastas valet bort när kitet läses
//   4. lib/studio/payload.ts STUDIO_FONTS      annars går det inte att välja per textruta
//   5. lib/studio/text-in-image.tsx            annars ritas text-i-bild med reservtypsnitt
//   (+ app/dashboard/brand-kit/page.tsx FONTS  annars syns det inte i väljaren)
//
// Upptäckt när Kalnia lades till för For Balance (FÄRG-2): `caveat-700.ttf` låg redan på
// disk sedan juli utan att stå på ett enda av ställena. En fil som ingen kan välja är
// varken ett fel som syns eller en funktion som finns.
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const las = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

const CSS = las("app/studio/render/studio-fonts.css");
const BRAND = las("lib/studio/brand.ts");
const PAYLOAD = las("lib/studio/payload.ts");
const BILDTEXT = las("lib/studio/text-in-image.tsx");
const KITSIDA = las("app/dashboard/brand-kit/page.tsx");

/** Namnen ur en JS-array-literal, t.ex. ALLOWED_FONTS = [...] */
function listaUr(kod: string, namn: string): string[] {
  const m = new RegExp(`${namn}\\s*=\\s*\\[([^\\]]+)\\]`).exec(kod);
  if (!m) return [];
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}

const TILLATNA = listaUr(BRAND, "ALLOWED_FONTS");

describe("FONT-3 · listorna hänger ihop", () => {
  it("hittar listan över tillåtna typsnitt", () => {
    expect(TILLATNA.length).toBeGreaterThan(4);
  });

  it("varje tillåtet typsnitt är deklarerat med @font-face", () => {
    const saknas = TILLATNA.filter((f) => !CSS.includes(`font-family: "${f}"`));
    expect(saknas, `Utan @font-face ritas ingenting i renderingen: ${saknas.join(", ")}`).toEqual([]);
  });

  it("varje tillåtet typsnitt går att välja per textruta", () => {
    const iPayload = listaUr(PAYLOAD, "STUDIO_FONTS");
    const saknas = TILLATNA.filter((f) => !iPayload.includes(f));
    expect(saknas, `Saknas i STUDIO_FONTS: ${saknas.join(", ")}`).toEqual([]);
  });

  it("varje tillåtet typsnitt syns i väljaren i brand-kit", () => {
    const iSidan = listaUr(KITSIDA, "FONTS");
    const saknas = TILLATNA.filter((f) => !iSidan.includes(f));
    expect(saknas, `Går inte att välja i gränssnittet: ${saknas.join(", ")}`).toEqual([]);
  });

  it("varje tillåtet typsnitt har en fil för text-i-bild", () => {
    // Det tystaste felet av alla: saknas namnet här ritas texten med reservtypsnittet,
    // och bara i bildflödet. Allt annat ser rätt ut.
    const saknas = TILLATNA.filter((f) => !new RegExp(`["']?${f}["']?:\\s*"`).test(BILDTEXT));
    expect(saknas, `Saknas i PROFILFONT_FIL: ${saknas.join(", ")}`).toEqual([]);
  });

  it("varje fil som CSS:en pekar på finns faktiskt på disk", () => {
    const filer = [...CSS.matchAll(/url\("\/fonts\/([^"]+)"\)/g)].map((m) => m[1]);
    expect(filer.length).toBeGreaterThan(5);
    const saknas = filer.filter((f) => !existsSync(join(process.cwd(), "public", "fonts", f)));
    expect(saknas, `Filer som saknas: ${saknas.join(", ")}`).toEqual([]);
  });

  it("ingen typsnittsfil ligger oanvänd på disk", () => {
    // Caveat låg så i en månad. En fil ingen kan välja är varken fel eller funktion.
    const påDisk = readFileSync; // (används inte — vi listar via CSS nedan)
    void påDisk;
    const iCss = new Set([...CSS.matchAll(/url\("\/fonts\/([^"]+)"\)/g)].map((m) => m[1]));
    const alla = ["anton.ttf", "caveat-700.ttf", "kalnia.ttf", "playfair-900.ttf"];
    const oanvanda = alla.filter((f) => existsSync(join(process.cwd(), "public", "fonts", f)) && !iCss.has(f));
    expect(oanvanda, `Ligger på disk men är inte deklarerade: ${oanvanda.join(", ")}`).toEqual([]);
  });
});

describe("FONT-3 · Kalnia, For Balances eget rubriktypsnitt", () => {
  it("filen finns", () => {
    expect(existsSync(join(process.cwd(), "public", "fonts", "kalnia.ttf"))).toBe(true);
  });

  it("licensen ligger bredvid filen — kravet är OFL", () => {
    const lic = join(process.cwd(), "public", "fonts", "kalnia-OFL.txt");
    expect(existsSync(lic)).toBe(true);
    expect(readFileSync(lic, "utf8")).toContain("Kalnia Project Authors");
  });

  it("deklarerad som variabelt snitt, inte en enda vikt", () => {
    expect(CSS).toMatch(/font-family: "Kalnia"[\s\S]*?font-weight: 100 700/);
  });
});
