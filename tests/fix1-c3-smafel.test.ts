// FIX-1-REST grupp C3 — de tre småfelen.
//
// Alla tre är samma familj som karusellen, i mindre skala: gränssnittet påstod något som
// datan inte täckte. En rubrik som lovar tre men listar två, en platshållare skriven för
// en enda kund, och ett veckomål som gällde alla oavsett verksamhet.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const las = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

describe("C3a · rubriken räknar samma lista som visas", () => {
  const kalla = las("components/profile/QualityMeter.tsx");

  it("hårdkodar inte längre 'De tre sakerna'", () => {
    // Åtgärdslistan är .slice(0, 3) — har profilen färre luckor visas färre rader.
    // Rubriken får inte lova ett antal listan inte håller.
    expect(kalla).not.toContain("De tre sakerna som höjer");
  });

  it("räknar ur report.atgarder.length", () => {
    expect(kalla).toMatch(/report\.atgarder\.length/);
  });

  it("har en egen formulering för exakt en åtgärd", () => {
    // "De 1 sakerna" vore värre än felet vi rättade.
    expect(kalla).toContain("Det här höjer textkvaliteten mest just nu.");
  });
});

describe("C3b · veckoplanens platshållare är inte skriven för en enda kund", () => {
  const kalla = las("app/dashboard/(inlagg)/veckoplan/page.tsx");

  it("nämner inte längre vintersäsong och kallt väder", () => {
    expect(kalla).not.toContain("Vintersäsongen, säkerhet och förberedelser");
  });

  it("lär ut formatet i stället för branschen", () => {
    expect(kalla).toContain("en säsong, en tjänst eller en fråga era kunder ofta ställer");
  });
});

describe("C3c · kanaler och veckomål är per tenant", () => {
  const kalla = las("app/api/fokus/inflode/route.ts");

  it("konstanten heter DEFAULT — den är inte längre facit", () => {
    expect(kalla).toContain("KANALER_DEFAULT");
    expect(kalla).not.toMatch(/const KANALER:/);
  });

  it("läser tenantens egna kanaler före standarden", () => {
    expect(kalla).toContain("fokus_kanalmal");
    expect(kalla).toMatch(/kanalerFor\(sb, clientId\)/);
  });

  it("egna rader ERSÄTTER standarden, kompletterar den inte", () => {
    // En kund som tagit bort Facebook ska inte få tillbaka den för att plattformen
    // tycker att den hör hemma där.
    expect(kalla).toMatch(/if \(rader\.length\) return rader\.map/);
  });

  it("är fail-open: går läsningen fel gäller standarden", () => {
    // Inflödet får aldrig bli tomt för att en tabell strular.
    expect(kalla).toMatch(/catch \{ \/\* fail-open till standarden \*\/ \}/);
    expect(kalla).toMatch(/return KANALER_DEFAULT;/);
  });
});
