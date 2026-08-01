import { describe, expect, it } from "vitest";
import { dagensStudioPayload, briefFranDag, arKopieradFranCaption } from "@/lib/studio/pa-bild";

// KVALITET-3/3 — en idé/caption är UNDERLAG. Den får aldrig bli texten på bilden.
// Det skarpa felet: veckoplanens caption-hook skrevs rakt in i payload.headline1 och
// caption-brödtexten i payload.body, alltså texten som trycks PÅ bilden.

const CAPTION = [
  "Digitala menyskärmar med högt ljus syns även i skyltfönstret mitt på dagen.",
  "Vi ser det varje vecka hos restauranger som bytt från tryckt meny: gästerna stannar upp, läser och går in.",
  "Skicka en bild på ditt skyltfönster, så får du en offert inom 24 timmar.",
  "#digitalsignage #skyltfönster",
].join("\n\n");

describe("dagensStudioPayload", () => {
  const p = dagensStudioPayload({
    theme: "Vintersäsongen",
    hook: "Digitala menyskärmar med högt ljus syns även i skyltfönstret mitt på dagen.",
    body: "Vi ser det varje vecka hos restauranger som bytt från tryckt meny.",
    caption: CAPTION,
  });

  it("lämnar texten PÅ BILDEN tom — den ska genereras, aldrig ärvas", () => {
    expect(p.headline1).toBe("");
    expect(p.headline2).toBe("");
    expect(p.body).toBe("");
  });

  it("behåller captionen (den är genererad för sitt eget format)", () => {
    expect(p.caption).toBe(CAPTION);
  });

  it("lägger dagens vinkel i brief — underlag, inte publik text", () => {
    expect(p.brief).toContain("Veckotema: Vintersäsongen");
    expect(p.brief).toContain("Dagens vinkel:");
  });

  it("ger ett giltigt bildformat, aldrig veckoplanens innehållsformat", () => {
    expect(dagensStudioPayload({ theme: "", hook: "", body: "", caption: "" }).format).toBe("1080x1350");
  });

  it("inget fält på bilden är en avskrift av captionen", () => {
    for (const falt of [p.headline1, p.headline2, p.body]) {
      expect(arKopieradFranCaption(falt, CAPTION)).toBe(false);
    }
  });
});

describe("arKopieradFranCaption — vakten som fångar det gamla felet", () => {
  it("fångar den ordagranna kopian som blev bildtext skarpt", () => {
    expect(arKopieradFranCaption("Digitala menyskärmar med högt ljus syns även i skyltfönstret mitt på dagen.", CAPTION)).toBe(true);
  });

  it("bryr sig inte om radbrytningar och versaler", () => {
    expect(arKopieradFranCaption("DIGITALA MENYSKÄRMAR MED HÖGT LJUS\nSYNS ÄVEN I SKYLTFÖNSTRET", CAPTION)).toBe(true);
  });

  it("flaggar inte en genererad, egen rubrik", () => {
    expect(arKopieradFranCaption("Syns menyn i solen?", CAPTION)).toBe(false);
    expect(arKopieradFranCaption("Tryckt meny bleknar. Skärmen gör det inte.", CAPTION)).toBe(false);
  });

  it("flaggar inte korta sammanträffanden", () => {
    expect(arKopieradFranCaption("Digitala", CAPTION)).toBe(false);
    expect(arKopieradFranCaption("", CAPTION)).toBe(false);
  });
});

describe("briefFranDag", () => {
  it("hoppar över tomma delar", () => {
    expect(briefFranDag("", "Vinkeln", "")).toBe("Dagens vinkel: Vinkeln");
    expect(briefFranDag("", "", "")).toBe("");
  });
  it("klipper vid 600 tecken (payloadens brief-tak)", () => {
    expect(briefFranDag("t", "x".repeat(900), "").length).toBe(600);
  });
});
