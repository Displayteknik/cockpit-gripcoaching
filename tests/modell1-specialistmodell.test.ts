// MODELL-1 — specialistens `model:` ska faktiskt användas. Håkans fynd 2026-08-12.
//
// Fyndet: han körde offertmotorn i en chatt med Fable 5 och fick ett resultat han var nöjd
// med, sedan i Cockpit och tyckte den var värdelös. Orsaken var inte prompten — routen körde
// `const MODEL = "claude-sonnet-4-5"` hårdkodat och läste aldrig specialistens `model:`.
// Fältet fanns i varje .md-fil, parsades in i SpecialistMeta, och användes ingenstans.
//
// Sex specialister deklarerade `claude-sonnet-4-6` och fick något annat utan att något sa
// ifrån. Ett fält i konfigurationen utan kodväg är samma tomma löfte som karusellen var.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";

const las = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const ROUTE = "app/api/specialist/[id]/run/route.ts";
const PROMPTS = join(process.cwd(), "prompts", "specialists");

function frontmatter(fil: string): Record<string, unknown> {
  return matter(readFileSync(join(PROMPTS, fil), "utf8")).data as Record<string, unknown>;
}
const alla = readdirSync(PROMPTS).filter((f) => f.endsWith(".md"));

describe("MODELL-1 · specialistens modell har en kodväg", () => {
  const route = las(ROUTE);

  it("routen läser specialistens model i stället för en hårdkodad konstant", () => {
    expect(route).toContain("specialist.model || STANDARD_MODEL");
    // Den gamla hårdkodningen får inte komma tillbaka.
    expect(route).not.toContain('const MODEL = "claude-sonnet-4-5"');
  });

  it("standarden finns kvar som fallback — ingen specialist kan bli modellös", () => {
    expect(route).toContain('const STANDARD_MODEL = "claude-sonnet-4-5"');
  });

  it("en modell utan pris faller tillbaka i stället för att loggas som 0 kr", () => {
    // Utan den här grinden blir ett dyrare val osynligt dyrt: kostnadstaket reagerar
    // aldrig på en modell som saknar rad i ai_pricing.
    expect(route).toContain('await harPris("anthropic", onskadModell)');
    expect(route).toContain("MODEL = STANDARD_MODEL");
  });

  it("fallbacken är tyst mot användaren men skriker i loggen", () => {
    expect(route).toMatch(/console\.error\([\s\S]*saknar rad i ai_pricing/);
  });
});

describe("MODELL-1 · varje deklarerad modell går att mäta", () => {
  // Låset som gör att nästa modellbyte inte kan smyga förbi kostnadsmätningen: lägger
  // någon in en ny modell i en .md-fil måste priset läggas in i samma veva.
  const PRISSATTA = [
    "claude-sonnet-4-5",
    "claude-sonnet-4-6",
    "claude-haiku-4-5-20251001",
    "claude-fable-5",
  ];

  it("alla specialisters modeller finns i prislistan", () => {
    const saknar = alla
      .map((f) => ({ fil: f, model: frontmatter(f).model as string | undefined }))
      .filter((s) => s.model && !PRISSATTA.includes(s.model));
    expect(saknar.map((s) => `${s.fil}: ${s.model}`)).toEqual([]);
  });

  it("offertmotorn kör Fable 5 — Håkans uttryckliga val 12/8", () => {
    expect(frontmatter("17-offertmotorn.md").model).toBe("claude-fable-5");
  });

  it("migrationen för priserna finns i repot", () => {
    const sql = las("migrations/modell1_fable_pris.sql");
    expect(sql).toContain("claude-fable-5");
    expect(sql).toContain("10.00");
    expect(sql).toContain("50.00");
    // Sonnet 4.6 måste med, annars faller de sex specialisterna tillbaka igen.
    expect(sql).toContain("claude-sonnet-4-6");
  });
});

describe("MODELL-1 · taket rymmer ett helt offertsvar", () => {
  const route = las(ROUTE);

  it("offertkategorin får ett eget, större tak", () => {
    expect(route).toContain('specialist.category === "offert" ? 32000 : 8192');
  });

  it("anropet strömmar, så ett stort tak inte ger timeout", () => {
    expect(route).toContain("anthropic.messages.stream(");
    expect(route).toContain(".finalMessage()");
  });
});
