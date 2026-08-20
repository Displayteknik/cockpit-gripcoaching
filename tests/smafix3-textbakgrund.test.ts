// Småfix 16/8 (3) — textplattan flödade utanför texten. Orsaken: display "inline-block"
// gör spannet till EN odelbar box som aldrig bryts över flera rader av browsern, så
// box-decoration-break: clone (byggd för RIKTIGA inline-element) fick ingen effekt.
import { describe, it, expect } from "vitest";
import { textPlate } from "../lib/studio/overrides";
import type { StudioPayload } from "../lib/studio/payload";

const bas: StudioPayload = {
  clientId: "", templateId: "ark-textkort", format: "1080x1350", customSize: null,
  headline1: "", headline2: "", body: "",
  badge: { enabled: false, line1: "", line2: "" },
  imageUrl: "", imageFocusY: 50, brushColor: "",
  overrides: { fontScale: 1, h1Scale: 1, h2Scale: 1, bodyScale: 1, fontFamily: "", headlineColor: "", bodyColor: "", textBg: "", lineScale: 1, imageScale: 1, imageX: 0, hideBrush: false, hideBadge: false, visaPunktNummer: false, logoVariant: "", h1X: 0, h1Y: 0, h2X: 0, h2Y: 0, bodyX: 0, bodyY: 0, footerText: "", footerScale: 1, imageFit: "beskar" },
  slides: [], videoUrl: "", brief: "", imageEdit: null,
};

describe("Småfix 16/8 (3) · textPlate", () => {
  it("display är inline, inte inline-block — annars bryts plattan aldrig rad för rad", () => {
    const style = textPlate({ ...bas, overrides: { ...bas.overrides, textBg: "#000000" } });
    expect(style.display).toBe("inline");
    expect(style.display).not.toBe("inline-block");
  });

  it("box-decoration-break: clone är satt (klonar bakgrunden per radfragment)", () => {
    const style = textPlate({ ...bas, overrides: { ...bas.overrides, textBg: "#000000" } });
    expect(style.boxDecorationBreak).toBe("clone");
    expect(style.WebkitBoxDecorationBreak).toBe("clone");
  });

  it("\"Ingen\" (tom textBg) släcker plattan helt — inget background-fält alls", () => {
    const style = textPlate(bas);
    expect(style).toEqual({});
    expect(style.background).toBeUndefined();
  });

  it("en satt färg ger bakgrunden exakt det värdet", () => {
    const style = textPlate({ ...bas, overrides: { ...bas.overrides, textBg: "#ff0000" } });
    expect(style.background).toBe("#ff0000");
  });
});
