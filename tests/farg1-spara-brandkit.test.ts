// FARG-1 + DM-4e — Håkans två akuta fynd 2026-08-11, sent.
//
// 1. "det går ju för fasen inte att spara en ändrad färg, jag bytte ut den gula mot en grå men
//    finns ingen spara knapp". Knappen FANNS — i hjälmen, tre skärmhöjder upp från färgrutorna.
//    Och ingenting sa att han hade osparade ändringar, så sidan såg ut att sakna sparning helt.
//    Två fel i samma upplevelse: åtgärden var utom synhåll, och tillståndet var osynligt.
//
// 2. "för i helvete vad fult" — kontaktnamnet radbröts bokstav för bokstav i kundportalens
//    DM-tavla. Orsaken var min egen fix en halvtimme tidigare: `2xl:grid-cols-7` mäter
//    FÖNSTRET, men tavlan får bara den yta sidan ger den. I portalen är ytan smalare än
//    fönstret, så sju kolumner blev ~110 px breda fastän skärmen var stor.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const kit = readFileSync(new URL("../app/dashboard/brand-kit/page.tsx", import.meta.url), "utf8");
const dm = readFileSync(new URL("../app/dashboard/(inlagg)/dm/page.tsx", import.meta.url), "utf8");

describe("FARG-1 · osparade ändringar syns, och går att spara där man står", () => {
  it("sidan minns vad som är SPARAT, inte bara vad som visas", () => {
    // En egen dirty-flagga kan glömmas att nollas. Skillnaden mot serverns kopia kan inte ljuga.
    expect(kit).toContain("const [sparatKit, setSparatKit] = useState<Kit>({});");
    expect(kit).toContain("JSON.stringify(kit) !== JSON.stringify(sparatKit)");
  });

  it("snapshoten flyttas fram FÖRST när servern svarat ok", () => {
    // Gör man det vid klicket försvinner "osparat" fastän ändringen aldrig kom fram.
    const i = kit.indexOf('if (!r.ok) throw new Error(d.error || "Kunde inte spara")');
    const j = kit.indexOf("setSparatKit(structuredClone(kit));");
    expect(i).toBeGreaterThan(0);
    expect(j).toBeGreaterThan(i);
  });

  it("listen finns bara när något är osparat", () => {
    // En knapp som alltid syns blir en knapp man slutar se.
    expect(kit).toContain("{harOsparat && (");
    expect(kit).toContain("Du har ändringar som inte är sparade.");
  });

  it("listen sitter fast längst ner, så den syns nere vid färgrutorna", () => {
    expect(kit).toContain("sticky bottom-0");
  });

  it("det går att ångra tillbaka till det sparade", () => {
    expect(kit).toContain("onClick={() => setKit(structuredClone(sparatKit))}");
    expect(kit).toContain("Ångra ändringarna");
  });

  it("webbläsaren frågar innan fliken stängs med osparat", () => {
    expect(kit).toContain('window.addEventListener("beforeunload", varna)');
    expect(kit).toContain('window.removeEventListener("beforeunload", varna)');
  });

  it("hjälmens knapp säger att något väntar", () => {
    expect(kit).toContain('harOsparat ? "Spara ändringar" : "Spara"');
  });
});

describe("DM-4e · tavlan mäter sin EGEN yta, inte fönstret", () => {
  it("ingen fönsterbaserad brytpunkt för sju kolumner", () => {
    // `2xl:` är fönstret. I kundportalen är ytan smalare än fönstret — och det var där det
    // blev 110 px per fack och ett namn per bokstav.
    expect(dm).not.toContain("2xl:grid-cols-7");
  });

  it("container-query i stället, mätt på sidans egen bredd", () => {
    expect(dm).toContain('<div className="@container space-y-4">');
    expect(dm).toContain("@[1400px]:grid-cols-7");
  });

  it("grundläget är fyra per rad — värsta utfallet är två rader, aldrig 110 px", () => {
    expect(dm).toContain("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 @[1400px]:grid-cols-7 gap-4");
  });
});
