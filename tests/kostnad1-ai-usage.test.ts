// KOSTNAD-1 — felklassningen och kostnadsberäkningen. De två delar som avgör om
// larmet blir rätt och om siffran går att lita på.
//
// Rå-strängarna nedan är verkliga svarskroppar: 403:an är Gemini-projektets
// betalningsspärr 2026-08-01, 400:an är Anthropics tomma plånbok (LESSONS.md).

import { describe, expect, it } from "vitest";
import { klassaFel, beraknaKostnad, felklassText, felklassTeknisk, ROD_FELKLASS } from "@/lib/ai-usage";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const GEMINI_DUNNING = '{"error":{"code":403,"message":"Lightning dunning decision is deny for project: projects/773740289261","status":"PERMISSION_DENIED"}}';
const ANTHROPIC_TOM_PLANBOK = '{"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API."}}';
const OGILTIG_NYCKEL = '{"error":{"message":"API key not valid. Please pass a valid API key.","status":"INVALID_ARGUMENT"}}';

describe("KOSTNAD-1 · felklassning: statuskoden ensam räcker inte", () => {
  it("403 med betalningsspärr är BILLING, inte auth (skarpt fall 2026-08-01)", () => {
    // Hela poängen med etappen: samma statuskod som en trasig nyckel, helt annan åtgärd.
    // Utan kroppen hade det här felet klassats som "fel nyckel" och skickat felsökningen
    // åt fel håll — precis det som kostade en timme.
    expect(klassaFel(403, GEMINI_DUNNING)).toBe("billing");
  });

  it("403 utan betalningsord är AUTH", () => {
    expect(klassaFel(403, OGILTIG_NYCKEL)).toBe("auth");
  });

  it("400 med tom plånbok är BILLING, inte ett trasigt anrop (Anthropic)", () => {
    expect(klassaFel(400, ANTHROPIC_TOM_PLANBOK)).toBe("billing");
  });

  it("402 är alltid billing, oavsett kropp", () => {
    expect(klassaFel(402, "")).toBe("billing");
  });

  it("429 och resource exhausted är kvot", () => {
    expect(klassaFel(429, "")).toBe("quota");
    expect(klassaFel(400, '{"error":{"status":"RESOURCE_EXHAUSTED"}}')).toBe("quota");
  });

  it("401 är nyckel, 404 är modell, resten är övrigt", () => {
    expect(klassaFel(401, "invalid x-api-key")).toBe("auth");
    expect(klassaFel(404, "models/gemini-9 is not found")).toBe("model");
    expect(klassaFel(500, "internal")).toBe("other");
  });

  it("bara betalning och nyckel gör en tjänst RÖD — kvoten löser sig själv", () => {
    expect(ROD_FELKLASS).toContain("billing");
    expect(ROD_FELKLASS).toContain("auth");
    expect(ROD_FELKLASS).not.toContain("quota");
    expect(ROD_FELKLASS).not.toContain("model");
  });

  // Håkans beslut 13/8: leverantörsfel ska inte stå i klartext framför en kund. Texten
  // delades därför i två — `felklassText` är den kundsynliga, `felklassTeknisk` bär
  // diagnosen vidare till loggar och adminvyer.
  it("kundtexten avslöjar aldrig vår leverantörs faktura eller nyckel", () => {
    for (const f of ["billing", "auth", "model", "other"] as const) {
      const t = felklassText(f, "anthropic");
      expect(t).toBe("Funktionen kommer inom kort.");
      expect(t.toLowerCase()).not.toMatch(/faktura|betalning|nyckel|api|modell/);
    }
  });

  it("kvot står kvar i klartext — den löser sig själv och är värd att veta", () => {
    expect(felklassText("quota", "gemini")).toContain("hastighetsgräns");
  });

  it("den tekniska texten pekar fortfarande ut åtgärden", () => {
    // Utan den här hade beslutet ovan kostat oss diagnosen, och DÅ vore det en tyst nolla.
    expect(felklassTeknisk("billing", "gemini")).toContain("betalningsfel");
    expect(felklassTeknisk("auth", "gemini")).toContain("nyckeln");
  });

  it("inga tankstreck i någon av texterna (skrivreglerna)", () => {
    for (const f of ["billing", "auth", "quota", "model", "other"] as const) {
      expect(felklassText(f, "gemini")).not.toMatch(/[–—]/);
      expect(felklassTeknisk(f, "gemini")).not.toMatch(/[–—]/);
    }
  });

  it("djupgranskningen visar aldrig leverantörssvaret för kunden", () => {
    const kod = readFileSync(join(process.cwd(), "lib/deep-audit-generate.ts"), "utf8");
    expect(kod).toContain('error: "Funktionen kommer inom kort."');
    // ...men loggar hela svaret, annars går felet inte att felsöka.
    expect(kod).toContain("[djupgranskning] kunde inte starta batchen");
  });
});

describe("KOSTNAD-1 · kostnadsberäkning", () => {
  const flash = { provider: "gemini", model: "gemini-2.5-flash", pris_in_per_mtoken: 0.3, pris_ut_per_mtoken: 2.5, pris_per_media: null, vaxelkurs: 10.5 };
  const flux = { provider: "fal", model: "fal-ai/flux/schnell", pris_in_per_mtoken: null, pris_ut_per_mtoken: null, pris_per_media: 0.003, vaxelkurs: 10.5 };

  it("tokens räknas per miljon och växlas till kronor", () => {
    // 1M in + 1M ut = (0,30 + 2,50) USD × 10,5 = 29,40 kr
    expect(beraknaKostnad(flash, 1_000_000, 1_000_000, 0)).toBeCloseTo(29.4, 5);
  });

  it("en typisk caption kostar ören, inte kronor", () => {
    const kostnad = beraknaKostnad(flash, 4000, 600, 0);
    expect(kostnad).toBeGreaterThan(0);
    expect(kostnad).toBeLessThan(0.1);
  });

  it("mediapris går före tokenpris när enheten är bilder", () => {
    expect(beraknaKostnad(flux, 0, 0, 2)).toBeCloseTo(0.063, 5);
  });

  it("okänd modell kostar noll i stället för att kasta — mätningen får aldrig fälla flödet", () => {
    expect(beraknaKostnad(undefined, 5000, 5000, 1)).toBe(0);
  });

  it("noll tokens ger noll kronor", () => {
    expect(beraknaKostnad(flash, 0, 0, 0)).toBe(0);
  });
});
