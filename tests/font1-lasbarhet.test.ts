// FONT-1 — ingen text under 12 px, och typskalan höjs på ETT ställe.
//
// Håkans användarfeedback 2026-08-11: "det är på tok för onödigt små fonter på många ställen
// i systemet, användarna ser inte".
//
// Kodbasen har ~1670 `text-xs` och ~1670 `text-sm`. Att byta klass på 3 300 ställen är både
// riskabelt (badges och täta tabeller spränger) och omöjligt att granska. Skalan höjs därför i
// `app/globals.css`: text-xs 12 → 13 px, text-sm 14 → 15 px, med radavstånd. En ändring, hela
// systemet, ingen layoutändring per komponent.
//
// Grinden bevakar två saker som annars glider tillbaka:
//   1. Inget i koden får sätta en storlek UNDER golvet (12 px) med en egen pixelklass.
//   2. Skalan i globals.css får inte sänkas tillbaka.

import { describe, expect, it } from "vitest";
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

describe("FONT-1 · golvet är 12 px och ingen går under", () => {
  it("filsökningen träffar — annars mäter testet ingenting", () => {
    expect(FILER.length).toBeGreaterThan(100);
  });

  it("ingen text-[Npx] under 12 px finns i koden", () => {
    // 23 sådana fanns 11/8: text-[10px] (6) och text-[11px] (17), bland annat i kalendern,
    // sidomenyn, profilens kundmaterial och bildredigeraren.
    const traffar: string[] = [];
    for (const { fil, kod } of FILER) {
      for (const m of kod.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)) {
        if (Number(m[1]) < 12) traffar.push(`${fil}: ${m[0]}`);
      }
    }
    expect(traffar, `Under golvet: ${traffar.join(" | ")}`).toEqual([]);
  });

  it("inga rem-storlekar under 0.75rem heller", () => {
    const traffar: string[] = [];
    for (const { fil, kod } of FILER) {
      for (const m of kod.matchAll(/text-\[(\d(?:\.\d+)?)rem\]/g)) {
        if (Number(m[1]) < 0.75) traffar.push(`${fil}: ${m[0]}`);
      }
    }
    expect(traffar, `Under golvet: ${traffar.join(" | ")}`).toEqual([]);
  });
});

describe("FONT-1 · skalan är höjd, på ett ställe", () => {
  const css = readFileSync(new URL("app/globals.css", ROT), "utf8");

  it("text-xs är minst 13 px (0.8125rem)", () => {
    const m = /--text-xs:\s*([\d.]+)rem/.exec(css);
    expect(m, "--text-xs saknas i @theme").toBeTruthy();
    expect(Number(m![1]) * 16).toBeGreaterThanOrEqual(13);
  });

  it("text-sm är minst 15 px (0.9375rem)", () => {
    const m = /--text-sm:\s*([\d.]+)rem/.exec(css);
    expect(m, "--text-sm saknas i @theme").toBeTruthy();
    expect(Number(m![1]) * 16).toBeGreaterThanOrEqual(15);
  });

  it("radavståndet höjs med — större text i samma trånga rad blir inte läsbarare", () => {
    expect(css).toContain("--text-xs--line-height");
    expect(css).toContain("--text-sm--line-height");
  });

  it("text-base och uppåt lämnas orörda — rubrikhierarkin ska inte flytta sig", () => {
    expect(css).not.toContain("--text-base:");
    expect(css).not.toContain("--text-lg:");
  });

  it("skälet står i filen, inte bara i en commit", () => {
    expect(css).toContain("FONT-1");
    expect(css).toContain("användarna ser inte");
  });
});
