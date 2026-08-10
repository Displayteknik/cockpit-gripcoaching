// G-9 — kvalitetssidan.
//
// Beställningens hårda krav: "Visa aldrig en nolla som ett mätvärde. Saknas data ska det
// stå att den saknas — SEO-verktyget gick ut till kund med nollor som såg ut som
// mätningar, det upprepas inte."
//
// Det är exakt den regeln som bevakas här. Sidan har tre lägen och får aldrig blanda ihop
// dem:
//   MÄTT    — tillräckligt många genereringar för att en andel ska betyda något
//   FÖR FÅ  — det finns rader, men en procentsats ur dem lurar ögat
//   SAKNAS  — ingen data alls, och det ska stå rakt ut
//
// Testerna kör mot routens egen logik via en mockad databas, inte mot en kopia av
// reglerna — en avskrift hade kunnat glida isär med koden.

import { beforeEach, describe, expect, it, vi } from "vitest";

let svar: { data: unknown; error: unknown } = { data: [], error: null };

vi.mock("@/lib/supabase-admin", () => ({
  supabaseService: () => ({
    from: () => ({ select: () => Promise.resolve(svar) }),
  }),
}));
vi.mock("@/lib/api-auth", () => ({ requireAdmin: async () => null }));

const { GET } = await import("@/app/api/kvalitet/route");

const rad = (over: Record<string, unknown> = {}) => ({
  prompt_version: "v1-abc12345",
  syfte: "caption",
  antal: 100,
  kasserade: 10,
  publicerade: 40,
  utan_kostnadskoppling: 0,
  forsta: "2026-08-01T10:00:00Z",
  senaste: "2026-08-09T10:00:00Z",
  ...over,
});

beforeEach(() => { svar = { data: [], error: null }; });

describe("G-9 · en nolla är aldrig ett mätvärde", () => {
  it("för få genereringar ger andel = null, inte 0", async () => {
    // Det farliga fallet: 0 publicerade av 3 skulle visas som "0 %" och läsas som
    // att regeluppsättningen producerar oanvändbar text. Den slutsatsen finns inte
    // i datan.
    svar = { data: [rad({ antal: 3, publicerade: 0, kasserade: 0 })], error: null };
    const d = await (await GET()).json();
    expect(d.rader[0].andelPublicerade).toBeNull();
    expect(d.rader[0].andelKasserade).toBeNull();
    // Råsiffrorna finns kvar — det är tolkningen som hålls tillbaka, inte mätningen.
    expect(d.rader[0].antal).toBe(3);
    expect(d.rader[0].publicerade).toBe(0);
  });

  it("tillräckligt många ger en riktig andel", async () => {
    svar = { data: [rad({ antal: 100, publicerade: 40 })], error: null };
    const d = await (await GET()).json();
    expect(d.rader[0].andelPublicerade).toBeCloseTo(0.4);
  });

  it("noll publicerade av MÅNGA är ett äkta mätvärde och räknas", async () => {
    // Skillnaden mot fallet ovan: här finns underlag. 0 av 100 betyder något.
    svar = { data: [rad({ antal: 100, publicerade: 0 })], error: null };
    const d = await (await GET()).json();
    expect(d.rader[0].andelPublicerade).toBe(0);
  });

  it("gränsen går vid det tal routen själv uppger", async () => {
    svar = { data: [rad({ antal: 20, publicerade: 5 })], error: null };
    const d = await (await GET()).json();
    expect(d.minForAndel).toBe(20);
    expect(d.rader[0].andelPublicerade).not.toBeNull();
  });
});

describe("G-9 · saknad data säger att den saknas", () => {
  it("inga rader ger en tom lista, aldrig påhittade nollrader", async () => {
    svar = { data: [], error: null };
    const d = await (await GET()).json();
    expect(d.rader).toEqual([]);
    expect(d.totalt).toBe(0);
  });

  it("databasfel ger 500 och rader = null — inte en tom lista", async () => {
    // En tom lista hade renderats som "inga genereringar", vilket är en annan sak
    // än "vi kunde inte läsa".
    svar = { data: null, error: { message: "relation saknas" } };
    const r = await GET();
    expect(r.status).toBe(500);
    const d = await r.json();
    expect(d.rader).toBeNull();
  });
});

describe("G-9 · luckan i kostnadskopplingen redovisas", () => {
  it("summeras separat så den inte försvinner i totalen", async () => {
    svar = {
      data: [rad({ utan_kostnadskoppling: 2 }), rad({ syfte: "bild", utan_kostnadskoppling: 5 })],
      error: null,
    };
    const d = await (await GET()).json();
    expect(d.utanKostnadskoppling).toBe(7);
  });
});

describe("G-9 · sorteringen sätter det färskaste först", () => {
  it("senaste körningen hamnar överst", async () => {
    svar = {
      data: [
        rad({ prompt_version: "v1-gammal", senaste: "2026-08-01T10:00:00Z" }),
        rad({ prompt_version: "v1-ny", senaste: "2026-08-09T10:00:00Z" }),
      ],
      error: null,
    };
    const d = await (await GET()).json();
    expect(d.rader[0].promptVersion).toBe("v1-ny");
  });
});

describe("G-9 · sidan sätter inget betyg", () => {
  it("svaret innehåller inga värderande fält", async () => {
    // Vyn räknar det som gick att räkna. Vad som är BRA är Håkans bedömning, inte
    // sidans — ett "score" här hade varit ett kvalitetsvärde utan täckning.
    svar = { data: [rad()], error: null };
    const d = await (await GET()).json();
    const nycklar = Object.keys(d.rader[0]).join(" ").toLowerCase();
    for (const forbjudet of ["score", "betyg", "kvalitet", "rating", "grade"]) {
      expect(nycklar).not.toContain(forbjudet);
    }
  });
});
