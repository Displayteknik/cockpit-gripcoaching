// KLARSPRÅK-1 — inga krångelord i det användaren ser. Håkans fynd 2026-08-12,
// efter mötet med Gitte: "jag läste ordet konträr någonstans och fattar inte ens vad det
// betyder, ta bort sådana konstiga ord, använd vanligt språk i hela systemet."
//
// ⚠ Skillnaden testet vilar på: DATANYCKLAR är inte gränssnittstext. `lib/hook-typer` har
// `namn: "konträr"` som nyckel, och den nyckeln skriver AI-flödena i sin JSON — byter man
// den slutar uppslagningen fungera och varje hook blir "okänd". Det som ska vara begripligt
// är ETIKETTEN som ritas på skärmen. Testet bevakar därför etikettkartorna, inte nycklarna.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";

const ROT = new URL("../", import.meta.url);

function allaTsx(): string[] {
  const ut: string[] = [];
  const ga = (rel: string) => {
    for (const post of readdirSync(new URL(rel, ROT))) {
      if (post === "node_modules" || post.startsWith(".")) continue;
      const barn = `${rel}/${post}`;
      if (statSync(new URL(barn, ROT)).isDirectory()) ga(barn);
      else if (post.endsWith(".tsx")) ut.push(barn);
    }
  };
  for (const m of ["app", "components"]) ga(m);
  return ut;
}
const FILER = allaTsx().map((fil) => ({ fil, kod: readFileSync(new URL(fil, ROT), "utf8") }));

// Ord som inte hör hemma i text en företagare utan teknisk bakgrund ska läsa. Listan är
// medvetet kort och konkret — den ska fånga verkliga fynd, inte bli en ordpolis.
const KRANGELORD = [
  "konträr",
  "konverterande",
  "iterativ",
  "deterministisk",
  "granularitet",
  "entitet",
  "kadens",
  "paritet",
  "tonalitet",
  "inkrementell",
];

/**
 * Text som faktiskt ritas: JSX-text mellan taggar, plus title/placeholder/aria-label.
 *
 * ⚠ Ingen radbrytning i träffen. Första versionen tillät det, och då svalde regexet kod
 * mellan två taggar på olika rader — `useState("1080x1350")` rapporterades som
 * gränssnittstext. Ett test som fäller fel rad är värre än inget test.
 */
function synligText(kod: string): string[] {
  const ut: string[] = [];
  for (const m of kod.matchAll(/>\s*([^<>{}\n][^<>{}\n]{2,})\s*</g)) ut.push(m[1]);
  for (const m of kod.matchAll(/(?:title|placeholder|aria-label)=\{?"([^"\n]{3,})"/g)) ut.push(m[1]);
  return ut;
}

/**
 * Hela ord, inte delsträngar. "entitet" finns inuti "Identitet", och att fälla ordet
 * Identitet vore att göra språket sämre, inte bättre.
 */
function harOrd(rad: string, ord: string): boolean {
  return new RegExp(`(^|[^a-zåäöA-ZÅÄÖ])${ord}[a-zåäö]*([^a-zåäöA-ZÅÄÖ]|$)`, "i").test(rad);
}

describe("KLARSPRÅK-1 · inga krångelord i gränssnittet", () => {
  it("filsökningen träffar — annars mäter testet ingenting", () => {
    expect(FILER.length).toBeGreaterThan(100);
  });

  it("ingen synlig text innehåller ett ord ur listan", () => {
    const traffar: string[] = [];
    for (const { fil, kod } of FILER) {
      for (const rad of synligText(kod)) {
        for (const ord of KRANGELORD) {
          if (harOrd(rad, ord)) traffar.push(`${fil}: "${rad.trim().slice(0, 60)}" (${ord})`);
        }
      }
    }
    expect(traffar, `Krångelord i gränssnittet: ${traffar.join(" | ")}`).toEqual([]);
  });
});

describe("KLARSPRÅK-1 · hook-etiketterna är begripliga, nycklarna orörda", () => {
  const studio = readFileSync(new URL("components/StudioMaker.tsx", ROT), "utf8");
  const hookTyper = readFileSync(new URL("lib/hook-typer.ts", ROT), "utf8");

  it("etiketten säger Tvärtom, inte Konträr", () => {
    expect(studio).toContain('"konträr": "Tvärtom"');
  });

  it("etiketten säger Siffra, inte Statistik", () => {
    expect(studio).toContain('"statistik": "Siffra"');
  });

  it("datanyckeln står kvar — annars slutar uppslagningen fungera", () => {
    // Det här är skyddet ÅT ANDRA HÅLLET: en välmenande städning av lib/hook-typer
    // skulle tysta bryta varje flöde som skriver "konträr" i sin JSON.
    expect(hookTyper).toContain('namn: "konträr"');
    expect(hookTyper).toContain('namn: "statistik"');
  });

  it("varje nyckel i hook-typer har en etikett i gränssnittet", () => {
    const namn = [...hookTyper.matchAll(/namn:\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(namn.length).toBe(5);
    for (const n of namn) {
      expect(studio, `saknar etikett för "${n}"`).toContain(`"${n}":`);
    }
  });
});

describe("FONT-2 · skalan höjd ett steg till efter mötet med Gitte", () => {
  const css = readFileSync(new URL("app/globals.css", ROT), "utf8");

  it("text-xs är minst 14 px", () => {
    const m = /--text-xs:\s*([\d.]+)rem/.exec(css);
    expect(Number(m![1]) * 16).toBeGreaterThanOrEqual(14);
  });

  it("text-sm är minst 16 px", () => {
    const m = /--text-sm:\s*([\d.]+)rem/.exec(css);
    expect(Number(m![1]) * 16).toBeGreaterThanOrEqual(16);
  });

  it("skälet står i filen, med vem det gäller", () => {
    expect(css).toContain("FONT-2");
    expect(css).toContain("Gitte");
  });
});
