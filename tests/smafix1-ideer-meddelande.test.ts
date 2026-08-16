// Småfix 16/8 (1) — "Ge mig 3 idéer" gav ibland 2, tyst. Backend hade redan räkningen och
// meddelandet (lib/studio/copy.ts, KVALITET-3/2a) — StudioMaker.tsx läste bara aldrig ut det.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const VY = readFileSync(join(process.cwd(), "components/StudioMaker.tsx"), "utf8");

describe("Småfix 16/8 (1) · löftesräkningen syns i UI:t", () => {
  it("suggest() läser d.meddelande från API-svaret", () => {
    expect(VY).toContain('setSuggestMeddelande(typeof d.meddelande === "string" ? d.meddelande : "")');
  });

  it("skapaAtMig (Snabbstart) läser också meddelandet, inte bara suggest()", () => {
    const skapaAtMig = VY.slice(VY.indexOf("const skapaAtMig"), VY.indexOf("const skapaAtMig") + 700);
    expect(skapaAtMig).toContain("setSuggestMeddelande(typeof d.meddelande");
  });

  it("meddelandet visas i gränssnittet när det finns", () => {
    expect(VY).toContain("{suggestMeddelande && (");
  });

  it("rubriken lovar aldrig \"tre\" när färre än tre levererades", () => {
    expect(VY).toContain('suggestions.length === 3 ? "tre" : suggestions.length');
    // Den gamla hårdkodade formuleringen ska vara borta.
    expect(VY).not.toContain("Alla tre är skrivna ur ditt ämne och din röst:");
  });

  it("meddelandet nollställs när ett förslag väljs, så det inte ligger kvar felaktigt", () => {
    const applySuggestion = VY.slice(VY.indexOf("const applySuggestion"), VY.indexOf("const applySuggestion") + 400);
    expect(applySuggestion).toContain("setSuggestMeddelande(\"\")");
  });
});
