import { describe, expect, it } from "vitest";
import { guardrailsFor, SPECIALIST_GUARDRAILS } from "@/lib/specialists";

describe("guardrailsFor", () => {
  it("offert far bygga pristabeller men aldrig hitta pa inpris", () => {
    const o = guardrailsFor("offert");
    expect(o).toContain("prissattning sjalva uppdraget");
    expect(o).not.toContain("bygg ALDRIG pristabeller");
    expect(o).toContain("Hitta ALDRIG pa ett inpris");
  });
  it("ovriga kategorier behaller prisforbudet", () => {
    const c = guardrailsFor("copy");
    expect(c).toContain("bygg ALDRIG pristabeller");
    expect(SPECIALIST_GUARDRAILS).toBe(c);
  });
  it("floskler och klarsprak galler bada", () => {
    for (const g of [guardrailsFor("offert"), guardrailsFor("copy")]) {
      expect(g).toContain("FORBJUDNA AI-FLOSKLER");
      expect(g).toContain("KLARSPRAK");
    }
  });
});
