// KUNDREGISTER-1 DEL 4-tillägget: kundbegripliga taggnamn + delad flervalsfiltrering.
import { describe, it, expect } from "vitest";
import { visningsnamnForTagg, matcharTaggar, matcharKalla } from "@/lib/kundregister/taggar";

describe("visningsnamnForTagg — generisk formatering, ingen hittepå-ordbok", () => {
  it("versaliserar första bokstaven i varje ord", () => {
    expect(visningsnamnForTagg("lead")).toBe("Lead");
    expect(visningsnamnForTagg("offert-lead")).toBe("Offert-lead");
  });
  it("kända förkortningar behåller sin egen skrivning", () => {
    expect(visningsnamnForTagg("mysales coach")).toBe("MySales Coach");
    expect(visningsnamnForTagg("vip")).toBe("VIP");
  });
  it("PROVAD GENOM ATT BRYTAS: en tom sträng ger en tom sträng, kraschar inte", () => {
    expect(visningsnamnForTagg("")).toBe("");
  });
  it("en helt okänd tagg formateras ändå snyggt utan att krascha", () => {
    expect(visningsnamnForTagg("hemlig-kod-42")).toBe("Hemlig-kod-42");
  });
});

describe("matcharTaggar — flerval (OR), delas med ett kommande nyhetsbrevs mottagarurval", () => {
  it("inget val markerat → allt matchar", () => {
    expect(matcharTaggar(["lead"], [])).toBe(true);
    expect(matcharTaggar([], [])).toBe(true);
  });
  it("matchar om kontakten bär MINST EN av de valda taggarna", () => {
    expect(matcharTaggar(["lead", "email"], ["email", "vip"])).toBe(true);
  });
  it("matchar inte om kontakten saknar alla valda taggar", () => {
    expect(matcharTaggar(["lead"], ["vip", "kund"])).toBe(false);
  });
  it("PROVAD GENOM ATT BRYTAS: en kontakt utan taggar matchar bara vid tomt val", () => {
    expect(matcharTaggar([], ["vip"])).toBe(false);
    expect(matcharTaggar([], [])).toBe(true);
  });
});

describe("matcharKalla", () => {
  it("inget val → allt matchar", () => expect(matcharKalla("Cockpit", [])).toBe(true));
  it("matchar exakt källa", () => expect(matcharKalla("Cockpit", ["Cockpit", "GHL"])).toBe(true));
  it("matchar inte annan källa", () => expect(matcharKalla("Cockpit", ["GHL"])).toBe(false));
});
