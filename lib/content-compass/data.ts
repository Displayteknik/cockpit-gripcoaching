// Content Compass — ren data + typer (INGA server-beroenden → säker i klientkomponenter).
import type { FourA } from "@/lib/content-framework";

export type FunnelLevel = "tofu" | "mofu" | "bofu";
export type DiscLetter = "D" | "I" | "S" | "C";
export type Cadence = "7" | "4" | "2-3";
export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export interface CompassDay { four_a: FourA; funnel: FunnelLevel; disc: DiscLetter[] }
export interface CompassSchedule { days: Record<DayKey, CompassDay>; cadence: Cadence }

export const DAY_KEYS: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
export const DAY_LABEL: Record<DayKey, string> = {
  mon: "Måndag", tue: "Tisdag", wed: "Onsdag", thu: "Torsdag", fri: "Fredag", sat: "Lördag", sun: "Söndag",
};

// Håkans standardschema (med DISC-kombos). Seed-default för alla tenants.
export const STANDARD_SCHEDULE: Record<DayKey, CompassDay> = {
  mon: { four_a: "analytical", funnel: "tofu", disc: ["C"] },
  tue: { four_a: "analytical", funnel: "tofu", disc: ["D"] },
  wed: { four_a: "aspirational", funnel: "mofu", disc: ["I"] },
  thu: { four_a: "aspirational", funnel: "bofu", disc: ["D", "I"] },
  fri: { four_a: "actionable", funnel: "tofu", disc: ["C", "S"] },
  sat: { four_a: "actionable", funnel: "mofu", disc: ["D", "C"] },
  sun: { four_a: "authentic", funnel: "tofu", disc: ["S"] },
};

// Aktiva veckodagar per kadens. BOFU varannan vecka på 2-3 hanteras i rules.ts (CC-4).
export const CADENCE_DAYS: Record<Cadence, DayKey[]> = {
  "7": DAY_KEYS,
  "4": ["mon", "wed", "thu", "sun"],
  "2-3": ["mon", "wed", "fri"],
};

export function standardSchedule(cadence: Cadence = "7"): CompassSchedule {
  return { days: { ...STANDARD_SCHEDULE }, cadence };
}

// JS Date.getDay(): 0=sön..6=lör → DayKey.
export function dayKeyOf(date: Date): DayKey {
  return (["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as DayKey[])[date.getDay()];
}

// Profilen för ett datum. null om dagen inte är aktiv i kadensen.
export function profileForDate(schedule: CompassSchedule, date: Date): CompassDay | null {
  const key = dayKeyOf(date);
  if (!CADENCE_DAYS[schedule.cadence].includes(key)) return null;
  return schedule.days[key] || null;
}
