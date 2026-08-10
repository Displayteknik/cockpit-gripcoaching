// G-5 — CTA-motorn: typens EXISTENS är hård även när funnel-nivån är mjukt satt.
//
// G-0 0.3d: FUNNEL_CTA och CTA_GOLV finns men når nästan aldrig fram. Orsaken satt i en
// parentes: mjukningen "(väg in den bara om inget annat framgår)" lades efter HELA
// compass-blocket, som bär både nivån och CTA-typen. Nivån skulle vara mjuk, typen inte.
//
// Två saker bevakas:
//   1. PROMPTSIDAN — mjukningen träffar nivåns tyngd, aldrig typkravet.
//   2. GRINDEN — "Hör av dig gärna" passerar CTA-golvet (verbet står i den godkända
//      listan) men saknar väg. Den nya grinden ska fånga det UTAN att fälla texter
//      som redan fungerar. Falskt utslag kostar ett anrop; falskt godkännande kostar
//      en text som inte leder någonstans.

import { describe, expect, it } from "vitest";
import { anatomiBlock } from "@/lib/prompt-core";
import { harCtaVag, harCtaISlutet, CTA_VAG_SKARPNING } from "@/lib/content/writing-rules";

describe("G-5 · promptsidan: typen kan inte mjukas upp", () => {
  const mjuk = anatomiBlock("full", undefined, "tofu");

  it("den mjuka grenen bär typkravet", () => {
    expect(mjuk).toContain("HÅRD REGEL (CTA-TYP)");
  });

  it("mjukningen gäller uttryckligen nivåns TYNGD, inte typen", () => {
    // Den gamla lydelsen ("väg in den bara om inget annat framgår av ämnet") stod
    // efter hela blocket och tog CTA-typen med sig.
    expect(mjuk).toContain("Uppmaningens TYP är däremot inte förhandlingsbar");
    expect(mjuk).not.toContain("väg in den bara om inget annat framgår av ämnet");
  });

  it("typkravet ligger EFTER mjukningen — sist väger tyngst", () => {
    expect(mjuk.indexOf("HÅRD REGEL (CTA-TYP)")).toBeGreaterThan(mjuk.indexOf("förvald"));
  });

  it("de tomma fraserna är namngivna som underkända", () => {
    for (const fras of ["Hör av dig gärna", "Vi finns här för dig", "Kontakta oss vid frågor"]) {
      expect(mjuk).toContain(fras);
    }
  });

  it("BOFU smyger inte in som default — säljande uppmaning kräver att ämnet handlar om köp", () => {
    // Håkans beslut 31/7 står fast och får inte urholkas av typkravet.
    expect(mjuk).toContain("ALDRIG till en säljande uppmaning om inte ämnet uttryckligen handlar om att köpa");
  });

  it("varianten UTAN funnel får också typkravet — den var svagast av alla", () => {
    expect(anatomiBlock("full")).toContain("HÅRD REGEL (CTA-TYP)");
  });

  it("text på bild och dialog får det ALDRIG — de ska inte ha någon CTA", () => {
    expect(anatomiBlock("pa-bild")).not.toContain("HÅRD REGEL (CTA-TYP)");
    expect(anatomiBlock("dialog")).not.toContain("HÅRD REGEL (CTA-TYP)");
    expect(anatomiBlock("story")).not.toContain("HÅRD REGEL (CTA-TYP)");
  });
});

describe("G-5 · grinden fångar den typlösa uppmaningen", () => {
  // Alla dessa passerar CTA-golvet: verben står i den godkända listan.
  const typlosa = [
    "Vi bygger skyltar som syns.\n\nHör av dig gärna.",
    "Vi bygger skyltar som syns.\n\nKontakta oss.",
    "Vi bygger skyltar som syns.\n\nTveka inte att höra av dig.",
    // Gränsfallet: verbet ensamt är ingen väg. Utvidgningen för "Skicka en bild"
    // får inte släppa in det här.
    "Vi bygger skyltar som syns.\n\nKontakta oss för att prata om dina idéer.",
  ];

  it("golvet släpper igenom dem — det är hela problemet", () => {
    for (const t of typlosa) expect(harCtaISlutet(t)).toBe(true);
  });

  it("men vägen saknas", () => {
    for (const t of typlosa) expect(harCtaVag(t)).toBe(false);
  });

  it("skärpningen ger konkreta exempel att byta till", () => {
    expect(CTA_VAG_SKARPNING).toContain("Skriv JA i kommentarerna");
    expect(CTA_VAG_SKARPNING).toContain("Byt INTE budskap");
  });
});

describe("G-5 · grinden fäller INTE texter som redan fungerar", () => {
  // Den här listan är grindens verkliga risk. En falsk träff skickar en fungerande
  // text på omgenerering och kan göra den sämre.
  const godkanda = [
    ["kommentar", "Vi bygger skyltar.\n\nSkriv JA i kommentarerna om du känner igen dig."],
    ["DM med nyckelord", "Vi bygger skyltar.\n\nSkicka ordet GUIDE i DM så får du den."],
    ["länk i profilen", "Vi bygger skyltar.\n\nBoka en tid via länken i profilen."],
    ["ring", "Vi bygger skyltar.\n\nRing oss så tittar vi på det ihop."],
    ["mejl", "Vi bygger skyltar.\n\nMejla en bild på fasaden så återkommer vi."],
    ["besök", "Vi bygger skyltar.\n\nKom förbi butiken och känn på materialet."],
    ["klarläggare i samma mening", "Vi bygger skyltar.\n\nBoka en digital fika, ingen säljpitch."],
    ["hashtags efter CTA", "Vi bygger skyltar.\n\nSkriv JA i kommentarerna.\n\n#skylt #ljus"],
    ["dela", "Vi bygger skyltar.\n\nDela med någon som står inför samma val."],
    // ⚠ REGRESSIONERNA UR G-5:s DoD MOT ENGENS TRÄD. Grinden underkände fyra fullt
    // fungerande avslut i rad — handlingens OBJEKT är vägen, även utan utpekad kanal.
    // Utan de här raderna kan samma falska utslag smyga tillbaka.
    ["skicka en bild", "Vi tar hand om träd.\n\nSkicka en bild på trädet så tittar vi på det ihop."],
    ["skicka bild + plats", "Vi tar hand om träd.\n\nSkicka en bild på trädet och var det står, så återkommer vi."],
    ["ställ din fråga", "Vi tar hand om träd.\n\nStäll din fråga så svarar vi."],
    ["visa oss", "Vi bygger skyltar.\n\nVisa oss din fasad så föreslår vi något."],
  ] as const;

  for (const [namn, text] of godkanda) {
    it(`godkänner: ${namn}`, () => {
      expect(harCtaVag(text)).toBe(true);
    });
  }

  it("text HELT utan CTA lämnas till CTA-golvet, inte till den här grinden", () => {
    // Två grindar som larmar om samma brist ger texten två skärpningar för ett fel.
    const utanCta = "Vi bygger skyltar som syns. Det har vi gjort länge.";
    expect(harCtaISlutet(utanCta)).toBe(false);
    expect(harCtaVag(utanCta)).toBe(true);
  });

  it("tom text fäller ingenting", () => {
    expect(harCtaVag("")).toBe(true);
    expect(harCtaVag("   ")).toBe(true);
  });
});
