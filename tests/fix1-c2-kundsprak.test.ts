// FIX-1-REST grupp C2 — språket i kundvyn.
//
// Håkans måttstock: en 55-årig terapeut ska förstå ordet UTAN förklaringen bredvid.
// Fyndet var att förklaringstexterna redan var bra klarspråk medan NAMNEN talade
// fackspråk — "Belagd", "Vinnande exempel", "GÖR INTE". Namnen härleds nu ur
// förklaringarna i stället för tvärtom.
//
// Testet är en grind, inte en åsikt: det listar de ord som fällts och ser till att de
// inte kan smyga tillbaka. Nya fackord ska läggas till i listan när de upptäcks.

import { describe, expect, it } from "vitest";
import { NIVAER, beraknaKvalitet } from "@/lib/profil/kvalitet";

// Ord som kräver att man redan kan systemet för att förstå dem.
const FACKORD = [
  "Belagd",
  "Vinnande exempel",
  "GÖR INTE",
  "Fingerprint",
  "Asset",
  "Tenant",
  "Prompt",
  "Payload",
  "Funnel",
  "TOFU",
  "MOFU",
  "BOFU",
];

// En tom profil ger alla kriterier med sina etiketter — bra yta att granska språket på.
const TOM = {
  profil: null,
  assets: [],
  kundroster: [],
  berattelser: [],
  fingerprint: null,
  klient: { name: "Testklient", industry: "Terapi" },
};

describe("C2 · nivånamnen klarar terapeut-testet", () => {
  it("innehåller inget fackord", () => {
    for (const n of NIVAER) {
      for (const ord of FACKORD) {
        expect(n.namn, `nivå ${n.niva} heter "${n.namn}"`).not.toContain(ord);
      }
    }
  });

  it("varje namn hänger ihop med sin egen förklaring", () => {
    // Namnet ska vara en sammanfattning av konsekvensen, inte ett ord vid sidan av den.
    const somBranschen = NIVAER.find((n) => n.niva === 3)!;
    expect(somBranschen.namn).toBe("Som branschen");
    expect(somBranschen.konsekvens).toContain("branschen");

    const medBevis = NIVAER.find((n) => n.niva === 5)!;
    expect(medBevis.namn).toBe("Med bevis");
    expect(medBevis.konsekvens).toMatch(/siffror.*kunders ord/);
  });

  it("alla fem nivåer har både namn och konsekvens", () => {
    expect(NIVAER).toHaveLength(5);
    for (const n of NIVAER) {
      expect(n.namn.length).toBeGreaterThan(2);
      expect(n.konsekvens.length).toBeGreaterThan(10);
    }
  });
});

describe("C2 · kriteriernas etiketter klarar samma test", () => {
  const rapport = beraknaKvalitet(TOM);

  it("innehåller inget fackord", () => {
    for (const kr of rapport.kriterier) {
      for (const ord of FACKORD) {
        expect(kr.label, `kriteriet "${kr.label}"`).not.toContain(ord);
      }
    }
  });

  it("varje kriterium har en förklaring — namnet ensamt ska aldrig behöva bära allt", () => {
    for (const kr of rapport.kriterier) {
      expect(kr.varfor.length, `kriteriet "${kr.label}" saknar varför`).toBeGreaterThan(20);
    }
  });

  it("åtgärderna talar samma språk som etiketterna", () => {
    // Etiketten säger "Ord du undviker" — då får åtgärden inte säga "GÖR INTE-regler".
    for (const kr of rapport.kriterier) {
      if (!kr.atgard) continue;
      for (const ord of FACKORD) {
        expect(kr.atgard, `åtgärden för "${kr.label}"`).not.toContain(ord);
      }
    }
  });
});
