import { describe, expect, it } from "vitest";
import { valjLogga } from "@/lib/studio/logo-style";
import { normalizePayload, DEFAULT_OVERRIDES } from "@/lib/studio/payload";

// KVALITET-3/6b — automatik som grund, sista ordet till människan.
const LJUS = "https://x/logo-original.png"; // mörk logga, för ljus bakgrund
const MORK = "https://x/logo-vit.png"; // vit logga, för mörk bakgrund
const FALLBACK = MORK;

const bas = { ljusBakgrundLogga: LJUS, morkBakgrundLogga: MORK, fallback: FALLBACK };

describe("valjLogga — ordningen är val → serverns mätning → mallens fallback", () => {
  it("auto utan hint faller tillbaka på mallens val", () => {
    expect(valjLogga({ val: "", hint: null, ...bas })).toEqual({ url: FALLBACK, plate: null });
  });

  it("auto med hint följer serverns mätning, inklusive plattan", () => {
    expect(valjLogga({ val: "", hint: { url: LJUS, plate: "light" }, ...bas })).toEqual({ url: LJUS, plate: "light" });
  });

  it("manuellt val vinner över serverns mätning", () => {
    // Servern säger vit variant — användaren ser att det blir tunt och väljer ljus bakgrund.
    expect(valjLogga({ val: "ljus", hint: { url: MORK, plate: null }, ...bas })).toEqual({ url: LJUS, plate: null });
    expect(valjLogga({ val: "mork", hint: { url: LJUS, plate: "light" }, ...bas })).toEqual({ url: MORK, plate: null });
  });

  it("platta behåller autovalets variant och lägger plattan på", () => {
    expect(valjLogga({ val: "platta", hint: { url: MORK, plate: null }, ...bas })).toEqual({ url: MORK, plate: "dark" });
    expect(valjLogga({ val: "platta", hint: { url: LJUS, plate: null }, ...bas })).toEqual({ url: LJUS, plate: "light" });
  });

  it("saknas en variant används den som finns — aldrig en tom logga", () => {
    expect(valjLogga({ val: "mork", hint: null, ljusBakgrundLogga: LJUS, morkBakgrundLogga: "", fallback: LJUS }).url).toBe(LJUS);
    expect(valjLogga({ val: "ljus", hint: null, ljusBakgrundLogga: "", morkBakgrundLogga: MORK, fallback: MORK }).url).toBe(MORK);
  });
});

describe("logoVariant i payloaden", () => {
  it("standard är auto", () => {
    expect(DEFAULT_OVERRIDES.logoVariant).toBe("");
    expect(normalizePayload({}).overrides.logoVariant).toBe("");
  });

  it("bara kända värden släpps igenom", () => {
    for (const v of ["ljus", "mork", "platta"]) {
      expect(normalizePayload({ overrides: { logoVariant: v } as never }).overrides.logoVariant).toBe(v);
    }
    expect(normalizePayload({ overrides: { logoVariant: "gul" } as never }).overrides.logoVariant).toBe("");
    expect(normalizePayload({ overrides: { logoVariant: 7 } as never }).overrides.logoVariant).toBe("");
  });

  it("gamla sparade inlägg (utan fältet) öppnas som auto", () => {
    expect(normalizePayload({ overrides: { fontScale: 1.2 } as never }).overrides.logoVariant).toBe("");
  });
});
