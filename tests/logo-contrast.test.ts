// Enhetstester för loggvalets rena beslutslogik (BILD-6b). Skarpt fall som testerna
// vaktar: DT-bild med blandad toppzon (mörkt parti + ljus solbelyst fasad) — medel
// ~0.5 valde vit logga som blev tunn över det ljusa. Regeln: blandad/tveksam zon →
// hellre mörk originallogga (+ ev. platta) än tunn vit.

import { describe, expect, it } from "vitest";
import { arBlandadZon, plattBeslut, valjLjusVariant, type ZonStats } from "@/lib/studio/logo-contrast";

// Uppmätt på den verkliga DT-bilden (ai-1785445752746): medel 0.52, p05 0.18, p95 0.80.
const DT_BLANDAD: ZonStats = { mean: 0.52, p05: 0.18, p95: 0.8 };
const SOLID_LJUS: ZonStats = { mean: 0.8, p05: 0.8, p95: 0.8 };
const SOLID_MORK: ZonStats = { mean: 0.2, p05: 0.2, p95: 0.2 };
const JAMN_MELLANMORK: ZonStats = { mean: 0.45, p05: 0.38, p95: 0.55 };

const FOTO_TROSKEL = 0.55;

describe("arBlandadZon — varians/max, inte bara medel", () => {
  it("DT-fallet (mörkt + ljus fasad) är blandad trots medel ~0.5", () => {
    expect(arBlandadZon(DT_BLANDAD)).toBe(true);
  });

  it("solida och jämna zoner är inte blandade", () => {
    expect(arBlandadZon(SOLID_LJUS)).toBe(false);
    expect(arBlandadZon(SOLID_MORK)).toBe(false);
    expect(arBlandadZon(JAMN_MELLANMORK)).toBe(false);
  });

  it("ljusa partier över tröskel trots mörkt snitt → blandad", () => {
    expect(arBlandadZon({ mean: 0.42, p05: 0.35, p95: 0.72 })).toBe(true);
  });
});

describe("valjLjusVariant — blandad zon väljer aldrig tunn vit logga", () => {
  it("DT-fallet: blandad → ljus-bakgrundsvarianten (mörk originallogga)", () => {
    expect(valjLjusVariant(DT_BLANDAD, FOTO_TROSKEL)).toBe(true);
  });

  it("solid ljus → originallogga, solid mörk → vit variant", () => {
    expect(valjLjusVariant(SOLID_LJUS, FOTO_TROSKEL)).toBe(true);
    expect(valjLjusVariant(SOLID_MORK, FOTO_TROSKEL)).toBe(false);
  });

  it("jämn mellanmörk zon under tröskeln → vit variant (som förr)", () => {
    expect(valjLjusVariant(JAMN_MELLANMORK, FOTO_TROSKEL)).toBe(false);
  });
});

describe("plattBeslut — mot zonens värsta parti, inte medel", () => {
  it("mörk logga i blandad zon: mörkaste partiet (p05) hotar → ljus platta", () => {
    // DT logo-black lum ≈ 0.01; |0.01 − 0.18| = 0.17 < 0.30 → platta.
    expect(plattBeslut(0.01, DT_BLANDAD)).toBe("light");
  });

  it("vit logga mot solid mörk zon: god kontrast → ingen platta", () => {
    expect(plattBeslut(0.97, SOLID_MORK)).toBeNull();
  });

  it("mörk logga mot solid ljus zon: god kontrast → ingen platta", () => {
    expect(plattBeslut(0.17, SOLID_LJUS)).toBeNull();
  });

  it("vit logga hotas av LJUSASTE partiet även när medel är mörkt", () => {
    // medel 0.45 ser ok ut, men p95 0.85: |0.97 − 0.85| = 0.12 → platta (mörk).
    expect(plattBeslut(0.97, { mean: 0.45, p05: 0.1, p95: 0.85 })).toBe("dark");
  });

  it("okänd logg-luminans → inget plattbeslut (fail-open som förr)", () => {
    expect(plattBeslut(null, DT_BLANDAD)).toBeNull();
  });
});
