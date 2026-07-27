// Content Compass — hårda regler + mix-analys som DATA (ren, testbar, server+klient-säker).
// Används av "Skapa veckans innehåll" (bygg en giltig vecka) och balansmätaren (varna).
// Trösklarna ligger som konstanter överst, inte utspridda i logiken.
import {
  CADENCE_DAYS, DAY_KEYS, DAY_LABEL, activeDaysOf,
  type CompassSchedule, type DayKey, type FunnelLevel, type DiscLetter,
} from "./data";
import type { FourA } from "@/lib/content-framework";

// ── Tröskelvärden (finslipa här) ──────────────────────────────────────────────
export const RULES = {
  maxBofuPerWeek: 1, // max ett rent säljinlägg (BOFU) per vecka
  minTofuShare: 0.6, // minst 60 % TOFU över rullande månad
  // Målmix enligt den undervisade modellen. Visas i Balans-panelen.
  // BOFU styrs av maxBofuPerWeek (max 1/vecka), inte av en procentandel.
  targetTofuShare: 0.7,
  targetMofuShare: 0.25,
  authenticGapDays: 21, // varna om ingen personlig (Authentic) post på 3 veckor
  sellWindowDays: 7, // fönster för "för många säljinlägg samma vecka"
} as const;

// Säljinlägg för balansmätaren (analyserar RIKTIGA inlägg där vi inte vet CTA:n):
// BOFU räknas alltid, MOFU räknas som mjukt (ej sälj) om inte annat är känt.
// Håkans beslut: BOFU + MOFU med säljande CTA. Vecko-generatorn skriver MOFU mjukt
// → där är bara BOFU ett säljinlägg.
export function isSellFunnel(funnel: string | null | undefined): boolean {
  return funnel === "bofu";
}

// JS getDay() (0=sön..6=lör) per DayKey.
const JS_DAY: Record<DayKey, number> = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 0 };

// Bästa publiceringstimme per dag (HEURISTIK, branschstandard — inte klientens egen
// data ännu). Vardag kväll, helg förmiddag. Byt här när engagemangsdata finns.
export function bestHourFor(dayKey: DayKey): number {
  return dayKey === "sat" || dayKey === "sun" ? 11 : 18;
}

// ISO-veckonummer (för BOFU-varannan-vecka på kadens 2-3).
function isoWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNr = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const firstDayNr = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNr + 3);
  return 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
}

// Nästa datum >= from vars veckodag matchar dayKey, med bästa-tid-timmen satt.
function nextDateForDay(dayKey: DayKey, from: Date): Date {
  const want = JS_DAY[dayKey];
  const d = new Date(from);
  d.setHours(bestHourFor(dayKey), 0, 0, 0);
  for (let i = 0; i < 8 && d.getDay() !== want; i++) d.setDate(d.getDate() + 1);
  return d;
}

export interface PlannedPost {
  dayKey: DayKey;
  dayLabel: string;
  date: string; // ISO — föreslagen publiceringstid (bästa-tid)
  funnel: FunnelLevel;
  four_a: FourA;
  disc: DiscLetter[];
}

// Bygger en giltig vecka enligt tenantens schema + kadens. Startar imorgon och lägger
// varje aktiv veckodag på sitt nästa datum. Applicerar hårda regler och returnerar
// noteringar i klarspråk om något justerades.
export function planWeek(schedule: CompassSchedule, from: Date = new Date()): { posts: PlannedPost[]; notes: string[] } {
  const active = activeDaysOf(schedule);
  const notes: string[] = [];
  const start = new Date(from);
  start.setDate(start.getDate() + 1); // börja imorgon, aldrig i dåtid
  const oddWeek = isoWeek(start) % 2 === 1;

  let bofuCount = 0;
  const posts: PlannedPost[] = [];
  for (const dk of active) {
    const day = schedule.days[dk];
    if (!day) continue;
    let funnel: FunnelLevel = day.funnel;

    // Kadens 2-3: BOFU bara varannan vecka.
    if (schedule.cadence === "2-3" && funnel === "bofu" && oddWeek) {
      funnel = "mofu";
      notes.push(`${DAY_LABEL[dk]}: säljinlägget flyttas till nästa vecka (BOFU varannan vecka på låg takt).`);
    }
    // Max 1 BOFU per vecka.
    if (funnel === "bofu") {
      if (bofuCount >= RULES.maxBofuPerWeek) {
        funnel = "mofu";
        notes.push(`${DAY_LABEL[dk]}: nedgraderad till MOFU (max ett säljinlägg per vecka).`);
      } else {
        bofuCount++;
      }
    }

    posts.push({
      dayKey: dk,
      dayLabel: DAY_LABEL[dk],
      date: nextDateForDay(dk, start).toISOString(),
      funnel,
      four_a: day.four_a,
      disc: day.disc,
    });
  }
  posts.sort((a, b) => a.date.localeCompare(b.date));
  return { posts, notes };
}

// ── Mix-analys + varningar (balansmätaren) ────────────────────────────────────
export interface MixInput {
  funnel_level: string | null;
  four_a: string | null;
  when: string | null;
}
export interface MixResult {
  total: number;
  tofu: number;
  mofu: number;
  bofu: number;
  tofuShare: number; // 0..1
  byFourA: Record<FourA, number>;
}

function withinDays(when: string | null, days: number, now: number): boolean {
  if (!when) return false;
  const t = new Date(when).getTime();
  if (Number.isNaN(t)) return false;
  return t <= now && t >= now - days * 24 * 3600 * 1000;
}

// Räknar mixen för inlägg inom fönstret (default rullande 30 dagar bakåt).
export function analyzeMix(items: MixInput[], windowDays = 30, now: number = Date.now()): MixResult {
  const inWindow = items.filter((i) => withinDays(i.when, windowDays, now));
  const byFourA: Record<FourA, number> = { analytical: 0, aspirational: 0, actionable: 0, authentic: 0 };
  let tofu = 0, mofu = 0, bofu = 0;
  for (const i of inWindow) {
    if (i.funnel_level === "tofu") tofu++;
    else if (i.funnel_level === "mofu") mofu++;
    else if (i.funnel_level === "bofu") bofu++;
    if (i.four_a && i.four_a in byFourA) byFourA[i.four_a as FourA]++;
  }
  const classified = tofu + mofu + bofu;
  return {
    total: inWindow.length,
    tofu, mofu, bofu,
    tofuShare: classified > 0 ? tofu / classified : 0,
    byFourA,
  };
}

// Varningar i klarspråk (svenska, inga tankstreck). Bara när det finns underlag.
export function warningsFor(items: MixInput[], now: number = Date.now()): string[] {
  const warnings: string[] = [];
  const mix = analyzeMix(items, 30, now);
  const classified = mix.tofu + mix.mofu + mix.bofu;

  // För lite TOFU denna månad.
  if (classified >= 4 && mix.tofuShare < RULES.minTofuShare) {
    warnings.push(`För lite toppinnehåll denna månad (${Math.round(mix.tofuShare * 100)} % TOFU). Sikta på minst ${Math.round(RULES.minTofuShare * 100)} % så du bygger räckvidd innan du säljer.`);
  }

  // Två eller fler säljinlägg samma vecka (rullande 7 dagar).
  const sells = items
    .filter((i) => isSellFunnel(i.funnel_level) && withinDays(i.when, RULES.sellWindowDays, now))
    .length;
  if (sells >= 2) {
    warnings.push(`${sells} säljinlägg samma vecka. Lägg värde emellan så det inte blir för säljigt.`);
  } else {
    // Två säljinlägg tätt inpå varandra (inom 2 dagar) — "i rad".
    const sellDates = items
      .filter((i) => isSellFunnel(i.funnel_level) && i.when)
      .map((i) => new Date(i.when as string).getTime())
      .filter((t) => !Number.isNaN(t))
      .sort((a, b) => a - b);
    for (let i = 1; i < sellDates.length; i++) {
      if (sellDates[i] - sellDates[i - 1] <= 2 * 24 * 3600 * 1000) {
        warnings.push("Två säljinlägg i rad. Sprid ut dem så publiken hinner värma upp.");
        break;
      }
    }
  }

  // Ingen personlig (Authentic) post på 3 veckor.
  if (mix.total >= 3) {
    const hasAuthentic = items.some((i) => i.four_a === "authentic" && withinDays(i.when, RULES.authenticGapDays, now));
    if (!hasAuthentic) {
      warnings.push("Ingen personlig post (Authentic) på 3 veckor. Människan bakom bygger förtroende, lägg in en snart.");
    }
  }

  return warnings;
}
