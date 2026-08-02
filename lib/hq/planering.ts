// PLAN-1 — den rena logiken bakom planeringsvyn. Ingen databas, inga anrop, inget nu().
// Allt tar datum som argument, så varje regel går att testa mot en handräknad vecka.
//
// Modellen: tisdag och torsdag är arbetsdagar, måndag, onsdag och fredag är white space.
// Vyn mäter hur veckan FAKTISKT ligger mot den modellen. Den dömer aldrig, den redovisar.

import type { Handelse } from "@/lib/hq/kalender";

export const TZ = "Europe/Stockholm";

/** Arbetsdagar i modellen (ISO: 1 = måndag). */
export const ARBETSDAGAR = [2, 4];
/** White space-dagar i modellen. */
export const WHITE_SPACE = [1, 3, 5];

export interface Tidstyp {
  id: string;
  namn: string;
  farg_ramp: string;
  nyckelord: string[];
  sortering: number;
}

// ── Tid i svensk tidszon ───────────────────────────────────────────────────
// Servern kör UTC. Utan tidszonen hamnar ett block klockan 08:00 på fel dag halva året,
// och hela veckoräkningen glider.

function delar(iso: string): { ar: number; man: number; dag: number; timme: number; minut: number } {
  const f = new Intl.DateTimeFormat("sv-SE", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date(iso));
  const v = (t: string) => Number(f.find((p) => p.type === t)?.value || 0);
  return { ar: v("year"), man: v("month"), dag: v("day"), timme: v("hour"), minut: v("minute") };
}

/** ÅÅÅÅ-MM-DD i svensk tid. */
export function svensktDatum(iso: string): string {
  const d = delar(iso);
  return `${d.ar}-${String(d.man).padStart(2, "0")}-${String(d.dag).padStart(2, "0")}`;
}

/** Minuter sedan midnatt i svensk tid. */
export function svenskMinut(iso: string): number {
  const d = delar(iso);
  return d.timme * 60 + d.minut;
}

/** ISO-veckodag för ett ÅÅÅÅ-MM-DD: 1 = måndag … 7 = söndag. */
export function veckodag(datum: string): number {
  const d = new Date(`${datum}T12:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

/** Måndag till söndag runt ett datum, som ÅÅÅÅ-MM-DD. */
export function veckoSpann(datum: string): { start: string; slut: string; dagar: string[] } {
  const bas = new Date(`${datum}T12:00:00Z`).getTime();
  const steg = veckodag(datum) - 1;
  const dagar: string[] = [];
  for (let i = 0; i < 7; i++) dagar.push(new Date(bas + (i - steg) * 864e5).toISOString().slice(0, 10));
  return { start: dagar[0], slut: dagar[6], dagar };
}

// ── Klassificering ─────────────────────────────────────────────────────────

/**
 * Ordningen är hela poängen:
 *   1. manuell override (ägaren har sagt sitt, det överskrivs aldrig)
 *   2. nyckelord i titeln, skiftlägesokänsligt
 *   3. Egen tid
 * ⚠ Steg 3 är ett medvetet val: en händelse utan känd typ är hellre Egen tid än att
 * tyst räknas som arbete. Annars skulle Lifestyle-siffran se sämre ut än verkligheten.
 */
export function klassificera(
  h: Pick<Handelse, "google_event_id" | "titel">,
  overrides: Record<string, string>,
  tidstyper: Tidstyp[],
): Tidstyp | null {
  const manuell = overrides[h.google_event_id];
  if (manuell) {
    const t = tidstyper.find((x) => x.id === manuell);
    if (t) return t;
  }
  const titel = (h.titel || "").toLowerCase();
  if (titel) {
    // ⚠ LÄNGSTA träffen vinner, inte den första. "Kundcontent-batch, publicering 20:00"
    // innehåller både "kund" (Coaching) och "publicering" (Inlägg). Vinner den första
    // typen i sorteringen blir batchen ett kundmöte, och både fördelningen och flaggan
    // om saknad batch blir fel. Det längre nyckelordet är alltid det mer specifika.
    // Lika långa träffar avgörs av sorteringen, så utfallet aldrig beror på radordningen.
    let bast: { t: Tidstyp; langd: number } | null = null;
    for (const t of tidstyper) {
      for (const n of t.nyckelord || []) {
        if (!n || !titel.includes(n.toLowerCase())) continue;
        if (!bast || n.length > bast.langd || (n.length === bast.langd && t.sortering < bast.t.sortering)) {
          bast = { t, langd: n.length };
        }
      }
    }
    if (bast) return bast.t;
  }
  return tidstyper.find((t) => t.namn === "Egen tid") || tidstyper[0] || null;
}

// ── Timmar ─────────────────────────────────────────────────────────────────

/** Längd i timmar. Heldagshändelser saknar klockslag och bidrar med noll timmar. */
export function timmar(h: Handelse): number {
  if (h.heldag || !h.start_tid || !h.slut_tid) return 0;
  const ms = new Date(h.slut_tid).getTime() - new Date(h.start_tid).getTime();
  return ms > 0 ? ms / 3600000 : 0;
}

export interface KlassadHandelse extends Handelse {
  tidstyp: Tidstyp | null;
  datum: string;
  dag: number;
  startMinut: number;
  slutMinut: number;
  langd: number;
}

export function klassa(handelser: Handelse[], overrides: Record<string, string>, tidstyper: Tidstyp[]): KlassadHandelse[] {
  return handelser.map((h) => {
    const datum = h.heldag ? h.start_datum || "" : svensktDatum(h.start_tid || "");
    return {
      ...h,
      tidstyp: klassificera(h, overrides, tidstyper),
      datum,
      dag: datum ? veckodag(datum) : 0,
      startMinut: h.heldag ? 0 : svenskMinut(h.start_tid || ""),
      slutMinut: h.heldag ? 0 : svenskMinut(h.slut_tid || ""),
      langd: timmar(h),
    };
  });
}

// ── Fördelningen ───────────────────────────────────────────────────────────

export interface FordelningsRad { id: string; namn: string; farg: string; timmar: number; procent: number }

export function fordelning(handelser: KlassadHandelse[], tidstyper: Tidstyp[]): FordelningsRad[] {
  const total = handelser.reduce((s, h) => s + h.langd, 0);
  return [...tidstyper]
    .sort((a, b) => a.sortering - b.sortering)
    .map((t) => {
      const tim = handelser.filter((h) => h.tidstyp?.id === t.id).reduce((s, h) => s + h.langd, 0);
      return { id: t.id, namn: t.namn, farg: t.farg_ramp, timmar: tim, procent: total > 0 ? (tim / total) * 100 : 0 };
    })
    .filter((r) => r.timmar > 0);
}

// ── Nyckeltalen ────────────────────────────────────────────────────────────

export interface Nyckeltal {
  bokadeTimmar: number;
  timmarWhiteSpace: number;
  antalMoten: number;
  lifestyle: number | null;
  arbetstimmar: number;
}

/**
 * ⚠ Definitioner, medvetet valda och synliga i vyn:
 * - "Egen tid" är INTE arbete. Den räknas i bokade timmar men aldrig i Lifestyle-talet,
 *   annars skulle en ledig vecka se ut som ett misslyckande.
 * - "timmarWhiteSpace" = arbete som ligger PÅ måndag, onsdag eller fredag. Det är den
 *   siffra flaggan bygger på, så vyn och flaggan kan aldrig säga emot varandra.
 * - "möte" = block i tidstypen Coaching och kunder. Ett produktionsblock är inget möte.
 *   Ägaren byter typ med ett klick, så definitionen är hans att justera.
 * - Lifestyle = andel av ARBETSTIDEN som ligger på tisdag eller torsdag. Utan arbetstid
 *   alls returneras null, aldrig 0 eller 100. En tom vecka har ingen efterlevnad att mäta.
 */
export function nyckeltal(handelser: KlassadHandelse[]): Nyckeltal {
  const tidsatta = handelser.filter((h) => !h.heldag && h.langd > 0);
  const arbete = tidsatta.filter((h) => h.tidstyp?.namn !== "Egen tid");
  const arbetstimmar = arbete.reduce((s, h) => s + h.langd, 0);
  const paArbetsdag = arbete.filter((h) => ARBETSDAGAR.includes(h.dag)).reduce((s, h) => s + h.langd, 0);
  return {
    bokadeTimmar: tidsatta.reduce((s, h) => s + h.langd, 0),
    timmarWhiteSpace: arbete.filter((h) => WHITE_SPACE.includes(h.dag)).reduce((s, h) => s + h.langd, 0),
    antalMoten: tidsatta.filter((h) => h.tidstyp?.namn === "Coaching och kunder").length,
    lifestyle: arbetstimmar > 0 ? (paArbetsdag / arbetstimmar) * 100 : null,
    arbetstimmar,
  };
}

// ── Flaggorna ──────────────────────────────────────────────────────────────

export interface Flagga { id: string; text: string }

const DAGNAMN = ["", "måndag", "tisdag", "onsdag", "torsdag", "fredag", "lördag", "söndag"];

function timtext(n: number): string {
  const avrundat = Math.round(n * 10) / 10;
  const tal = avrundat.toLocaleString("sv-SE", { maximumFractionDigits: 1 });
  return `${tal} ${avrundat === 1 ? "timme" : "timmar"}`;
}

/**
 * Mjuka, aldrig blockerande. Formuleringarna konstaterar, de tillrättavisar aldrig:
 * "3 timmar arbete ligger på white space-dagar", inte "du har brutit mot modellen".
 * En flagga som skäller läses en gång och stängs sedan av i huvudet.
 */
export function flaggor(
  handelser: KlassadHandelse[],
  kt: Nyckeltal,
  mallHarInlagg: boolean,
): Flagga[] {
  const ut: Flagga[] = [];

  if (kt.timmarWhiteSpace > 0) {
    ut.push({
      id: "white-space",
      text: `${timtext(kt.timmarWhiteSpace)} arbete ligger på white space-dagar denna vecka.`,
    });
  }

  const moten = handelser.filter((h) => !h.heldag && h.tidstyp?.namn === "Coaching och kunder");
  const perDag = new Map<number, number>();
  for (const m of moten) perDag.set(m.dag, (perDag.get(m.dag) || 0) + 1);
  for (const [dag, antal] of [...perDag.entries()].sort((a, b) => a[0] - b[0])) {
    if (antal > 4) ut.push({ id: `motestathet-${dag}`, text: `${DAGNAMN[dag]} har ${antal} möten.` });
  }

  const harEgenTid = handelser.some((h) => h.tidstyp?.namn === "Egen tid");
  if (!harEgenTid && handelser.length > 0) {
    ut.push({ id: "ingen-egen-tid", text: "Veckan har inget block för egen tid." });
  }

  if (mallHarInlagg && !handelser.some((h) => h.tidstyp?.namn === "Inlägg")) {
    ut.push({ id: "ingen-batch", text: "Kundcontent-batchen saknas den här veckan." });
  }

  return ut;
}

// ── Mallveckan ─────────────────────────────────────────────────────────────

export interface MallRad {
  id: string;
  titel: string;
  veckodag: number;
  starttid: string;   // HH:MM:SS
  sluttid: string;
  tidstyp_id: string | null;
  aktiv: boolean;
}

export interface MallForslag {
  mallId: string;
  titel: string;
  datum: string;
  start: string;      // HH:MM
  slut: string;
  finnsRedan: boolean;
  krockar: string[];  // titlar på händelser som överlappar
}

const hhmm = (t: string) => t.slice(0, 5);

/** Minuter sedan midnatt ur HH:MM eller HH:MM:SS. */
function minut(t: string): number {
  const [h, m] = t.split(":");
  return Number(h) * 60 + Number(m);
}

/**
 * Vad "Lägg ut mallveckan" skulle göra på en given vecka. Bara ett förslag, inget skrivs.
 * `finnsRedan` = samma titel samma dag med samma starttid finns i kalendern. Den posten
 * skapas aldrig igen, annars fylls veckan med dubbletter varje gång knappen trycks.
 * `krockar` listar överlappande händelser så ägaren ser priset innan han bekräftar.
 */
export function mallForslag(mall: MallRad[], handelser: KlassadHandelse[], vecka: { dagar: string[] }): MallForslag[] {
  return mall
    .filter((m) => m.aktiv)
    .map((m) => {
      const datum = vecka.dagar[m.veckodag - 1];
      const start = hhmm(m.starttid);
      const slut = hhmm(m.sluttid);
      const s = minut(start);
      const e = minut(slut);
      const denDagen = handelser.filter((h) => h.datum === datum && !h.heldag);
      return {
        mallId: m.id,
        titel: m.titel,
        datum,
        start,
        slut,
        // ⚠ Titeln i kalendern är sällan ordagrant mallens. Håkans återkommande block
        // heter "Fokus idag (white space-dag)" medan mallraden heter "Fokus idag".
        // Krävs exakt lika skapas en dubblett bredvid den som redan ligger där, varje
        // gång knappen trycks. Samma starttid plus att den ena titeln rymmer den andra
        // är tillräckligt: två olika saker börjar sällan på minuten samtidigt.
        finnsRedan: denDagen.some((h) => {
          if (h.startMinut !== s) return false;
          const a = (h.titel || "").trim().toLowerCase();
          const b = m.titel.trim().toLowerCase();
          return !!a && !!b && (a.includes(b) || b.includes(a));
        }),
        krockar: denDagen
          .filter((h) => h.startMinut < e && h.slutMinut > s)
          .map((h) => h.titel || "Namnlös händelse"),
      };
    })
    .sort((a, b) => a.datum.localeCompare(b.datum) || a.start.localeCompare(b.start));
}

/** Svensk tidszons avvikelse från UTC i minuter vid en given tidpunkt. */
function offsetMinuter(ts: number): number {
  const d = new Date(ts);
  const utc = new Date(d.toLocaleString("en-US", { timeZone: "UTC" }));
  const lokal = new Date(d.toLocaleString("en-US", { timeZone: TZ }));
  return (lokal.getTime() - utc.getTime()) / 60000;
}

/**
 * ISO-tidpunkt för ett datum plus klockslag i svensk tid.
 * ⚠ Offseten hämtas ur zonen, aldrig antas: Sverige växlar mellan +01:00 och +02:00, och
 * en hårdkodad offset ger fel halva året. Två varv behövs för att landa rätt även när
 * gissningen hamnar på andra sidan en sommartidsväxling.
 */
export function svenskTidpunkt(datum: string, klocka: string): Date {
  const [h, m] = hhmm(klocka).split(":").map(Number);
  const [ar, man, dag] = datum.split("-").map(Number);
  const onskat = Date.UTC(ar, man - 1, dag, h, m);
  let ts = onskat - offsetMinuter(onskat) * 60000;
  ts = onskat - offsetMinuter(ts) * 60000;
  return new Date(ts);
}
