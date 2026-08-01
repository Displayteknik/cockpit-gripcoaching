import { describe, it, expect } from "vitest";
import {
  arPromptEko,
  rensaTranskription,
  TRANSKRIBERINGS_PROMPT,
  ROST_FELMEDDELANDE,
} from "@/lib/ai/transkription";

// KVALITET-3 punkt 9: systeminstruktionen läckte in i ämnesfältet i bloggverktyget när
// Gemini ekade tillbaka prompten i stället för att transkribera. Testerna nedan låser fast
// att ett eko ALDRIG passerar, och att äkta tal ALLTID gör det.

// Exakt det svar som reproducerades mot gemini-2.5-flash med 0,2 s tystnad (2026-08-01).
const EKO_FRAN_DRIFT =
  "Transkribera detta tal på svenska, ordagrant men med korrekt interpunktion. " +
  "Returnera ENBART den transkriberade texten — inga rubriker, inga kommentarer.";

describe("arPromptEko — promptliknande svar behandlas som fel", () => {
  it("fångar det verkliga ekot från drift (ordagrann prompt)", () => {
    expect(arPromptEko(EKO_FRAN_DRIFT)).toBe(true);
  });

  it("fångar ekot även utan skiljetecken och med annan versalisering", () => {
    expect(
      arPromptEko("transkribera detta tal på svenska ordagrant men med korrekt interpunktion"),
    ).toBe(true);
  });

  it("fångar ett delvis eko — bara instruktionens inledning", () => {
    expect(arPromptEko("Transkribera detta tal på svenska, ordagrant")).toBe(true);
  });

  it("fångar ett eko av instruktionens senare hälft", () => {
    expect(
      arPromptEko("Returnera ENBART den transkriberade texten — inga rubriker, inga kommentarer."),
    ).toBe(true);
  });

  it("fångar eko med inledd fortsättning", () => {
    expect(
      arPromptEko(
        "Transkribera detta tal på svenska, ordagrant men med korrekt interpunktion. Okej, här kommer det.",
      ),
    ).toBe(true);
  });

  it("fångar eko av en ANNAN transkriberingsprompt när den skickas med", () => {
    const annanPrompt =
      "Transkribera detta innehåll ordagrant till svenska. Markera olika talare som [Talare A], " +
      "[Talare B] om flera personer pratar. Returnera ENDAST transkriptet — ingen kommentar.";
    expect(arPromptEko("Transkribera detta innehåll ordagrant till svenska.", annanPrompt)).toBe(true);
    // …och den prompten ska inte fällas av standardprompten enbart för att båda börjar likadant
    expect(arPromptEko("Jag pratar om nya däck till bilen.", annanPrompt)).toBe(false);
  });
});

describe("arPromptEko — äkta tal släpps igenom", () => {
  const akta = [
    "Jag vill skriva ett blogginlägg om hur man väljer rätt vinterdäck till sin bil.",
    "Hon vill ha offert på fredag, ring henne innan lunch.",
    "Kunden heter Anna och driver en blomsteraffär i Uppsala sedan tolv år tillbaka.",
    // Innehåller ordet "transkribera" — får INTE fastna
    "Kan du transkribera det här mötet åt mig och skicka anteckningarna på svenska?",
    "Vi pratade om interpunktion och korrekt svenska i texterna vi skickar ut.",
    "Ja.",
  ];
  for (const t of akta) {
    it(`släpper igenom: "${t.slice(0, 45)}…"`, () => {
      expect(arPromptEko(t)).toBe(false);
      expect(rensaTranskription(t)).toBe(t);
    });
  }
});

describe("rensaTranskription — grinden mot fältet", () => {
  it("returnerar null för eko, så anroparen svarar med felmeddelandet", () => {
    expect(rensaTranskription(EKO_FRAN_DRIFT)).toBeNull();
  });

  it("returnerar null för tomt, blankt och icke-strängar", () => {
    expect(rensaTranskription("")).toBeNull();
    expect(rensaTranskription("   \n  ")).toBeNull();
    expect(rensaTranskription(undefined)).toBeNull();
    expect(rensaTranskription(null)).toBeNull();
    expect(rensaTranskription({ text: "hej" })).toBeNull();
  });

  it("trimmar men ändrar inte innehållet i ett äkta transkript", () => {
    expect(rensaTranskription("  Hej, jag heter Håkan.  ")).toBe("Hej, jag heter Håkan.");
  });

  it("felmeddelandet är på svenska och avslöjar ingen intern prompt", () => {
    expect(ROST_FELMEDDELANDE).toBe("Kunde inte uppfatta rösten, försök igen");
    expect(ROST_FELMEDDELANDE.toLowerCase()).not.toContain("transkribera");
    expect(ROST_FELMEDDELANDE.toLowerCase()).not.toContain("gemini");
    expect(ROST_FELMEDDELANDE.toLowerCase()).not.toContain("prompt");
  });

  it("hela systemprompten fastnar i sin egen grind (självtest)", () => {
    expect(rensaTranskription(TRANSKRIBERINGS_PROMPT)).toBeNull();
  });
});
