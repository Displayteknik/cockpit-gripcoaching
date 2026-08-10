// G-6 — bildfeedbacken.
//
// Tummen har funnits i gränssnittet sedan länge och lovar kunden "AI lär sig". Löftet
// var tomt i tre led: bara legacy-vägen läste feedbacken, bara ett betyg sparades (inget
// skäl), och ingenting band omdömet till genereringen det gällde.
//
// Det som bevakas här är att lagret SKILJER beröm från kritik och att kritiken formuleras
// som ett förbud. Ett block som bara radar upp "tidigare bilder" utan att säga vilka som
// underkändes är sämre än inget: modellen kan lika gärna härma det kunden sa nej till.

import { describe, expect, it } from "vitest";
import { bildfeedbackBlock, INGEN_BILDFEEDBACK, type BildfeedbackLage } from "@/lib/bildfeedback";

const lage = (over: Partial<BildfeedbackLage> = {}): BildfeedbackLage => ({
  gillade: [],
  ogillade: [],
  finns: true,
  ...over,
});
const omdome = (p: string, k: string | null = null) => ({ rating: 1, prompt: p, kommentar: k, bildStil: null });

describe("G-6 · utan feedback läggs inget lager alls", () => {
  it("tomt läge ger tom sträng — inte ett block som säger 'ingen feedback'", () => {
    // Ett block som beskriver frånvaron hade tagit plats i prompten utan att styra något.
    expect(bildfeedbackBlock(INGEN_BILDFEEDBACK)).toBe("");
  });

  it("finns=false ger tom sträng även om listorna råkar ha innehåll", () => {
    expect(bildfeedbackBlock(lage({ gillade: [omdome("x")], finns: false }))).toBe("");
  });
});

describe("G-6 · kritiken är ett förbud, inte en notering", () => {
  const medKritik = lage({ ogillade: [{ ...omdome("dark warehouse at night"), rating: -1 }] });

  it("underkänd bild märks som avvisad av kunden", () => {
    expect(bildfeedbackBlock(medKritik)).toContain("CLIENT-REJECTED");
  });

  it("motivet ska bytas helt, inte justeras", () => {
    // "Undvik liknande" hade lämnat modellen att tolka hur nära den får ligga.
    expect(bildfeedbackBlock(medKritik)).toContain("choose a different subject entirely");
  });

  it("kritiken ligger SIST — det kunden sagt nej till väger tyngst", () => {
    const b = bildfeedbackBlock(lage({
      gillade: [omdome("sunny workshop")],
      ogillade: [{ ...omdome("dark warehouse"), rating: -1 }],
    }));
    expect(b.indexOf("CLIENT-REJECTED")).toBeGreaterThan(b.indexOf("CLIENT-APPROVED"));
  });
});

describe("G-6 · berömmet är en riktning, inte en mall", () => {
  it("godkänd bild ska INTE kopieras rakt av", () => {
    // Utan den raden blir varje kommande bild en kopia av den första kunden gillade.
    expect(bildfeedbackBlock(lage({ gillade: [omdome("sunny workshop")] })))
      .toContain("do not copy it literally");
  });
});

describe("G-6 · kundens egna ord följer med", () => {
  it("kommentaren citeras, inte sammanfattas", () => {
    const b = bildfeedbackBlock(lage({ ogillade: [{ ...omdome("people in office"), rating: -1, kommentar: "fel sorts kunder" }] }));
    expect(b).toContain('client said: "fel sorts kunder"');
  });

  it("en rad utan prompt bär ändå sin kommentar", () => {
    const b = bildfeedbackBlock(lage({ ogillade: [{ rating: -1, prompt: null, kommentar: "för mörkt", bildStil: null }] }));
    expect(b).toContain('client said: "för mörkt"');
  });
});

describe("G-6 · rating 0 finns inte", () => {
  it("varken beröm eller kritik — raden hamnar i ingen lista", () => {
    // Routen avvisar 0, men lagret ska inte heller kunna tolka ett nollbetyg som beröm.
    const b = bildfeedbackBlock(lage({ gillade: [], ogillade: [], finns: true }));
    expect(b).not.toContain("CLIENT-APPROVED");
    expect(b).not.toContain("CLIENT-REJECTED");
  });
});
