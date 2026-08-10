import { describe, expect, it } from "vitest";
import { utkastNyckel, tolkaUtkast, utkastTid } from "@/lib/studio/useUtkast";

describe("UTKAST-1 — nyckeln är tenant-låst", () => {
  it("bygger en nyckel med klient-id i sig", () => {
    expect(utkastNyckel("studio", "abc-123")).toBe("cockpit-utkast:studio:abc-123");
  });

  it("ger TOM nyckel utan klient — då varken läses eller skrivs något", () => {
    // Rotorsaken bakom den gamla studio-draften: nyckeln byggdes på slug, som är tom
    // sträng innan klienten laddats → alla tenants delade samma "studio-draft:"-hink.
    expect(utkastNyckel("studio", "")).toBe("");
    expect(utkastNyckel("studio", null)).toBe("");
    expect(utkastNyckel("studio", undefined)).toBe("");
  });

  it("två klienter får aldrig samma nyckel på samma yta", () => {
    expect(utkastNyckel("studio", "klient-a")).not.toBe(utkastNyckel("studio", "klient-b"));
  });

  it("två ytor för samma klient krockar inte", () => {
    expect(utkastNyckel("studio", "k1")).not.toBe(utkastNyckel("blogg", "k1"));
  });
});

describe("UTKAST-1 — kuvertet tolkas defensivt", () => {
  it("läser tillbaka data och tidpunkt", () => {
    const raw = JSON.stringify({ v: 2, sparatVid: 1700000000000, klient: "abc-123", data: { topic: "höstkampanj" } });
    const ut = tolkaUtkast<{ topic: string }>(raw);
    expect(ut?.data.topic).toBe("höstkampanj");
    expect(ut?.sparatVid).toBe(1700000000000);
  });

  it("avvisar trasig JSON, fel version och tom data i stället för att krascha ytan", () => {
    expect(tolkaUtkast(null)).toBeNull();
    expect(tolkaUtkast("{inte json")).toBeNull();
    expect(tolkaUtkast(JSON.stringify({ v: 99, sparatVid: 1, data: { a: 1 } }))).toBeNull();
    // Kuvert från VERSION 1 (utan klientstämpel) kastas — de kunde bära fel kunds text.
    expect(tolkaUtkast(JSON.stringify({ v: 1, sparatVid: 1, data: { a: 1 } }))).toBeNull();
    expect(tolkaUtkast(JSON.stringify({ v: 2, sparatVid: 1, data: null }))).toBeNull();
  });

  it("saknad tidsstämpel ger null, inte NaN", () => {
    const ut = tolkaUtkast<{ a: number }>(JSON.stringify({ v: 2, data: { a: 1 } }));
    expect(ut?.sparatVid).toBeNull();
  });
});

describe("UTKAST-2 — kuvertet bär klienten, inte bara nyckeln", () => {
  // Håkans fynd 10/8: han bytte läge i Studio och fick upp Displaytekniks förslag medan
  // AluCon var vald. Nyckeln bar redan AluCons id — alltså kan nyckeln ensam inte
  // upptäcka ett utkast som skrivits under fel kund. Kuvertet stämplas därför med
  // klienten, och läses det för någon annan kastas det.
  const kuvert = (klient: string | undefined) => JSON.stringify({ v: 2, sparatVid: 1, klient, data: { topic: "skyltar i solljus" } });

  it("rätt klient får sitt utkast", () => {
    expect(tolkaUtkast<{ topic: string }>(kuvert("displayteknik"), "displayteknik")?.data.topic).toBe("skyltar i solljus");
  });

  it("en ANNAN klients kuvert kastas, även när nyckeln ser rätt ut", () => {
    expect(tolkaUtkast(kuvert("displayteknik"), "alucon")).toBeNull();
  });

  it("kuvert utan klientstämpel kastas — det är de gamla, opålitliga", () => {
    expect(tolkaUtkast(kuvert(undefined), "alucon")).toBeNull();
  });

  it("utan klientfråga (bakåtkompatibelt anrop) döms bara version och data", () => {
    expect(tolkaUtkast(kuvert("displayteknik"))).not.toBeNull();
  });
});

describe("UTKAST-1 — tidsetiketten", () => {
  it("är tom när tid saknas", () => {
    expect(utkastTid(null)).toBe("");
  });
  it("visar klockslag", () => {
    expect(utkastTid(new Date(2026, 7, 1, 14, 32).getTime())).toBe("14:32");
  });
});
