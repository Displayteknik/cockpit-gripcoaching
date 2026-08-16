// Kalkylformlerna, portade rakt av från mysales-coach (src/lib/offertmotorn/kalkyl.ts).
// Samma facit på båda ställena — ändra aldrig ett tal här utan att ändra det andra.

export function landatSek(unitPrice: number, freight: number, calcRate: number): number {
  return Math.round((unitPrice + freight) * calcRate);
}

export function tb(utpris: number, kostnad: number): { kr: number; pct: number } {
  const kr = Math.round(utpris - kostnad);
  return { kr, pct: utpris > 0 ? Math.round((kr / utpris) * 1000) / 10 : 0 };
}

export function overGolv(pct: number, golvPct = 30): boolean {
  return pct >= golvPct;
}
