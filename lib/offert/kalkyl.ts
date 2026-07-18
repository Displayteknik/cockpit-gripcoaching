// Offertmotorn — generisk kalkyl. Ren logik, ingen framework-koppling, branschoberoende.
// Landat inpris → utpris ur pålägg → TB/marginal → golvkoll. Portad + generaliserad från
// standalone-Offertmotorns kalkyl.ts.

/** Landad kostnad per enhet = inpris + frakt (valfri valutakurs ×). */
export function landat(purchase: number | null | undefined, freight: number | null | undefined, rate = 1): number {
  return Math.round(((Number(purchase) || 0) + (Number(freight) || 0)) * rate);
}

/** Utpris ur pålägg%: kostnad × (1 + pålägg/100). */
export function prisFranPalagg(cost: number, markupPct: number | null | undefined): number {
  return Math.round(cost * (1 + (Number(markupPct) || 0) / 100));
}

/** Täckningsbidrag: utpris − kostnad, i kr och %. */
export function tb(utpris: number, kostnad: number): { kr: number; pct: number } {
  const kr = Math.round(utpris - kostnad);
  return { kr, pct: utpris > 0 ? Math.round((kr / utpris) * 1000) / 10 : 0 };
}

/** Håller marginalen golvet? (default 30 %, justerbart per verksamhet.) */
export function overGolv(pct: number, golvPct = 30): boolean {
  return pct >= golvPct;
}

export interface Rad {
  qty: number;
  unit_price: number | null;
  cost: number | null;
}

/** Summera en offert: ordervärde (utpris), total kostnad, TB kr/%. */
export function summera(rader: Rad[]): { total: number; costTotal: number; tbKr: number; marginPct: number } {
  let total = 0;
  let costTotal = 0;
  for (const r of rader) {
    const q = Number(r.qty) || 0;
    total += (Number(r.unit_price) || 0) * q;
    costTotal += (Number(r.cost) || 0) * q;
  }
  total = Math.round(total);
  costTotal = Math.round(costTotal);
  const t = tb(total, costTotal);
  return { total, costTotal, tbKr: t.kr, marginPct: t.pct };
}
