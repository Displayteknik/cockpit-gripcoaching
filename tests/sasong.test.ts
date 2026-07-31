// Enhetstester för lib/content/sasong (BILD-5b). Ren modul — inga mockar, inget nät.
// Fasta datum överallt: testerna får aldrig bli tidsberoende.

import { describe, expect, it } from "vitest";
import {
  arstidFor,
  hittaSasongsord,
  markorerForAr,
  paskdagen,
  sasongsInfo,
  sasongsPromptRad,
  seasonPromptLineEn,
} from "@/lib/content/sasong";

describe("paskdagen (computus)", () => {
  it("beräknar kända påskdagar rätt", () => {
    expect(paskdagen(2026).getMonth()).toBe(3); // 5 april 2026
    expect(paskdagen(2026).getDate()).toBe(5);
    expect(paskdagen(2025).getMonth()).toBe(3); // 20 april 2025
    expect(paskdagen(2025).getDate()).toBe(20);
    expect(paskdagen(2027).getMonth()).toBe(2); // 28 mars 2027
    expect(paskdagen(2027).getDate()).toBe(28);
  });
});

describe("arstidFor", () => {
  it("mappar månad → årstid", () => {
    expect(arstidFor(new Date(2026, 0, 10))).toBe("vinter");
    expect(arstidFor(new Date(2026, 3, 10))).toBe("vår");
    expect(arstidFor(new Date(2026, 6, 10))).toBe("sommar");
    expect(arstidFor(new Date(2026, 9, 10))).toBe("höst");
    expect(arstidFor(new Date(2026, 11, 10))).toBe("vinter");
  });
});

describe("sasongsInfo — markörfönstret", () => {
  it("juli: kräftskiva/skolstart nära, INGEN semla", () => {
    const i = sasongsInfo(new Date(2026, 6, 15));
    expect(i.arstid).toBe("sommar");
    expect(i.datumStr).toBe("15 juli 2026");
    expect(i.narmasteMarkorer.join(", ")).toContain("kräftskivesäsongen");
    expect(i.narmasteMarkorer.join(", ")).toContain("skolstart");
    expect(i.narmasteMarkorer.join(", ")).not.toContain("seml");
  });

  it("februari: fettisdagen (semmeldags) finns i fönstret", () => {
    const i = sasongsInfo(new Date(2026, 1, 5));
    // Påsk 2026 = 5 april → fettisdagen = 17 februari.
    expect(i.narmasteMarkorer.join(", ")).toContain("fettisdagen (semmeldags) (17 februari)");
  });

  it("december: jul och nyår i fönstret; tidig januari ser nyss passerat nyår", () => {
    const dec = sasongsInfo(new Date(2026, 11, 10));
    expect(dec.narmasteMarkorer.join(", ")).toContain("lucia");
    expect(dec.narmasteMarkorer.join(", ")).toContain("jul (24 december)");
    expect(dec.narmasteMarkorer.join(", ")).toContain("nyår");
    // 2 januari: nyår (31 dec föregående år) ligger inom −7-fönstret, trettondedag jul framför.
    const jan = sasongsInfo(new Date(2027, 0, 2));
    expect(jan.narmasteMarkorer.join(", ")).toContain("nyår");
    expect(jan.narmasteMarkorer.join(", ")).toContain("trettondedag jul");
  });

  it("markorerForAr beräknar rörliga helger", () => {
    const m = markorerForAr(2026);
    const mids = m.find((x) => x.namn === "midsommar")!;
    expect(mids.datum.getDay()).toBe(5); // alltid fredag
    expect(mids.datum.getMonth()).toBe(5);
    expect(mids.datum.getDate()).toBeGreaterThanOrEqual(19);
    expect(mids.datum.getDate()).toBeLessThanOrEqual(25);
    const allhelgona = m.find((x) => x.namn === "alla helgons dag")!;
    expect(allhelgona.datum.getDay()).toBe(6); // alltid lördag
  });
});

describe("promptrader", () => {
  it("svensk rad har datum, årstid och hård säsongsregel", () => {
    const rad = sasongsPromptRad(new Date(2026, 6, 15));
    expect(rad).toContain("AKTUELL TID: 15 juli 2026, sommar");
    expect(rad).toContain("föreslå ALDRIG produkter/motiv ur fel säsong");
  });

  it("engelsk rad kräver säsongskonsistens i HELA scenen (kläder/ljus/växtlighet/väder)", () => {
    const line = seasonPromptLineEn(new Date(2026, 6, 15));
    expect(line).toContain("CURRENT TIME: 15 July 2026, summer in Sweden");
    expect(line).toContain("Season consistency applies to the ENTIRE scene");
    expect(line).toContain("clothing");
    expect(line).toContain("vegetation");
    expect(line).toContain("weather");
  });
});

describe("hittaSasongsord — detekteringen bakom bildredigeringens villkorade tillägg", () => {
  it("säsongs-/tidsord i redigeringsinstruktion → träff", () => {
    expect(hittaSasongsord("anpassa bilden till juli")).toContain("juli");
    expect(hittaSasongsord("gör den mer vintrig, vinterkänsla")).toContain("vinter");
    expect(hittaSasongsord("julstämning i skyltfönstret")).toContain("jul");
    expect(hittaSasongsord("lägg till semlor på fatet")).toContain("semla/fettisdagen");
    expect(hittaSasongsord("våren är här — visa det")).toContain("vår (årstiden)");
  });

  it("vanliga redigeringar utan säsongsord → tomt (inget tillägg)", () => {
    expect(hittaSasongsord("byt bakgrundsfärg")).toEqual([]);
    expect(hittaSasongsord("visa bara barnet, inte optikern")).toEqual([]);
    expect(hittaSasongsord("")).toEqual([]);
  });

  it("fällorna: 'juli' är inte 'jul', possessivt 'vår' triggar inte, 'hjul' triggar inte", () => {
    expect(hittaSasongsord("anpassa till juli")).not.toContain("jul");
    expect(hittaSasongsord("visa vår butik utifrån")).toEqual([]);
    expect(hittaSasongsord("byt hjul på bilen")).toEqual([]);
  });
});
