// PRIS2-4 — kabinettkalkylatorn för LED-väggar. Ren logik, portad rakt av från
// mysales-coach (src/lib/offertmotorn/kabinettkalkylator.ts), samma källa/facit.
// Kalibrerad mot Offert_utomhus_LED_Fresh_Air_20260806 (Alternativ 1 och 2).

export const KABINETT_M = 0.96;
export const PIXLAR_PER_KABINETT = 240; // P4, 4 mm pixel pitch: 960 mm / 4 mm = 240 px

export interface KabinettResultat {
  kolumner: number;
  rader: number;
  kabinettPerSida: number;
  kabinettTotalt: number;
  bredd_m: number;
  hojd_m: number;
  ytaPerSidaM2: number;
  ytaTotaltM2: number;
  upplosning: { bredd: number; hojd: number };
  format: string;
  prisPerSida: number;
  prisTotalt: number;
}

function sgn(a: number, b: number): number {
  return b === 0 ? a : sgn(b, a % b);
}

export function snappaTillGrid(onskadBredd_m: number, onskadHojd_m: number): { kolumner: number; rader: number } {
  const kolumner = Math.max(1, Math.round(onskadBredd_m / KABINETT_M));
  const rader = Math.max(1, Math.round(onskadHojd_m / KABINETT_M));
  return { kolumner, rader };
}

export function berakna(onskadBredd_m: number, onskadHojd_m: number, dubbelsidig: boolean, prisKrPerKvm: number): KabinettResultat {
  const { kolumner, rader } = snappaTillGrid(onskadBredd_m, onskadHojd_m);
  const bredd_m = Math.round(kolumner * KABINETT_M * 100) / 100;
  const hojd_m = Math.round(rader * KABINETT_M * 100) / 100;
  const kabinettPerSida = kolumner * rader;
  const ytaPerSidaM2 = Math.round(bredd_m * hojd_m * 100) / 100;
  const g = sgn(kolumner, rader);
  const upplosning = { bredd: kolumner * PIXLAR_PER_KABINETT, hojd: rader * PIXLAR_PER_KABINETT };
  const prisPerSida = Math.round((prisKrPerKvm * ytaPerSidaM2) / 100) * 100;
  return {
    kolumner,
    rader,
    kabinettPerSida,
    kabinettTotalt: dubbelsidig ? kabinettPerSida * 2 : kabinettPerSida,
    bredd_m,
    hojd_m,
    ytaPerSidaM2,
    ytaTotaltM2: dubbelsidig ? ytaPerSidaM2 * 2 : ytaPerSidaM2,
    upplosning,
    format: `${kolumner / g}:${rader / g}`,
    prisPerSida,
    prisTotalt: dubbelsidig ? prisPerSida * 2 : prisPerSida,
  };
}
