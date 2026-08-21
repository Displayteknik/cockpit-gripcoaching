// KOSTNAD-2 (HELG-1 DEL 8): saldoskyddet — absolut kronorgräns, 200/100 kr, max ett mail
// per nivå, eskalering ska alltid ut, förbättring ska inte trigga ett nytt mildare mail.
import { describe, it, expect } from "vitest";
import {
  saldolarmniva, skaLarma, byggSaldolarmAtgard, SALDO_TROSKLAR_STANDARD,
} from "@/lib/inkop/saldolarm";

describe("saldolarmniva — de exakta tröskelvärdena, 200/100 kr", () => {
  it("över 200 kr är grönt", () => expect(saldolarmniva(201)).toBe("gron"));
  it("exakt 200 kr är fortfarande grönt (< 200, inte <=)", () => expect(saldolarmniva(200)).toBe("gron"));
  it("199 kr är varning", () => expect(saldolarmniva(199)).toBe("varning"));
  it("exakt 100 kr är fortfarande varning", () => expect(saldolarmniva(100)).toBe("varning"));
  it("99 kr är akut", () => expect(saldolarmniva(99)).toBe("akut"));
  it("noll eller negativt saldo är akut", () => {
    expect(saldolarmniva(0)).toBe("akut");
    expect(saldolarmniva(-5)).toBe("akut");
  });
  it("PROVAD GENOM ATT BRYTAS: null-saldo (aldrig hämtat, eller hämtningen gick fel) larmar INGET — gissar aldrig att saknad data betyder noll kronor", () => {
    expect(saldolarmniva(null)).toBe("gron");
  });
  it("egna trösklar går att skicka in (ägarstyrt, som resten av inkop_konfig)", () => {
    expect(saldolarmniva(250, { varningSek: 300, akutSek: 150 })).toBe("varning");
    expect(saldolarmniva(250, SALDO_TROSKLAR_STANDARD)).toBe("gron");
  });
});

describe("skaLarma — max ett mail per nivå, eskalering ska alltid ut", () => {
  it("första gången ett konto blir gult larmar", () => expect(skaLarma("varning", null)).toBe(true));
  it("PROVAD GENOM ATT BRYTAS: samma nivå igen larmar INTE en andra gång", () => {
    expect(skaLarma("varning", "varning")).toBe(false);
    expect(skaLarma("akut", "akut")).toBe(false);
  });
  it("eskalering (varning → akut) larmar alltid, det är en ny, allvarligare händelse", () => {
    expect(skaLarma("akut", "varning")).toBe(true);
  });
  it("ett saldo som faller rakt igenom till akut (mätningen missade varningssteget) larmar", () => {
    expect(skaLarma("akut", null)).toBe(true);
  });
  it("PROVAD GENOM ATT BRYTAS: en FÖRBÄTTRING (akut → varning) ska INTE ge ett nytt, mildare mail direkt efter det akuta", () => {
    expect(skaLarma("varning", "akut")).toBe(false);
  });
  it("grönt larmar aldrig, oavsett vad som skickats förut", () => {
    expect(skaLarma("gron", "akut")).toBe(false);
    expect(skaLarma("gron", null)).toBe(false);
  });
});

describe("byggSaldolarmAtgard — DEL 8 punkt 3: exakt åtgärdslista och direktlänkar", () => {
  it("akut-nivån säger vad som konkret stannar och har en riktig påfyllningslänk", () => {
    const a = byggSaldolarmAtgard("fal", "Fal.ai", 87, "akut", "/dashboard/ekonomi");
    expect(a.rubrik).toContain("AKUT");
    expect(a.rubrik).toContain("87");
    expect(a.atgardstext).toContain("bilder och video");
    expect(a.paffyllningslank).toMatch(/^https:\/\//);
    expect(a.ekonomiLank).toBe("/dashboard/ekonomi");
  });
  it("46elks-varningen nämner SMS/2FA specifikt, inte en generisk text", () => {
    const a = byggSaldolarmAtgard("elks46", "46elks", 150, "varning", "/dashboard/ekonomi");
    expect(a.atgardstext).toContain("SMS");
  });
});
