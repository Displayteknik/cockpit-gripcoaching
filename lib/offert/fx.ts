// Offertmotorn — valutakurser (importkalkyl). Hämtar SEK-kurs per USD/EUR/CNY från Riksbankens
// SWEA-API (publikt, ingen nyckel). Kalkylkurs = spotkurs × buffert (skyddar mot valutarörelse
// mellan offert och order). Mönster portat från standalone-Offertmotorns om-fx.ts.

export const FX_BUFFER = 1.03; // 3 % buffert på spotkursen (spec §2.5)

// Riksbanken SWEA: SEK per 1 enhet utländsk valuta.
const SERIES: Record<string, string> = { USD: "SEKUSDPMI", EUR: "SEKEURPMI", CNY: "SEKCNYPMI" };

export interface FxRates {
  rates: Record<string, number>; // SEK per enhet, inkl. SEK: 1
  date: string;
  buffer: number;
  /** Valutor vars kurs INTE gick att hämta. calcRate ger då 1 (= räknas som SEK), vilket
   *  underskattar kostnaden kraftigt. Måste synas för användaren, aldrig tyst. */
  saknas: string[];
  /** Dygn mellan Riksbankens observationsdatum och idag. null när datum saknas. */
  alderDagar: number | null;
}

let cache: { data: FxRates; at: number } | null = null;
const TTL = 6 * 3600 * 1000; // 6 h

// Fejkfri: läser Riksbanken. Kastar aldrig — returnerar det som gick att hämta (+ SEK:1).
export async function getRatesToSEK(): Promise<FxRates> {
  if (cache && Date.now() - cache.at < TTL) return cache.data;
  const rates: Record<string, number> = { SEK: 1 };
  let date = "";
  await Promise.all(
    Object.entries(SERIES).map(async ([cur, serie]) => {
      try {
        const r = await fetch(`https://api.riksbank.se/swea/v1/Observations/Latest/${serie}`, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(8000),
        });
        if (!r.ok) return;
        const d = await r.json();
        if (typeof d?.value === "number") {
          rates[cur] = d.value;
          if (d.date && d.date > date) date = d.date;
        }
      } catch {
        /* hoppa valutan */
      }
    }),
  );
  const saknas = Object.keys(SERIES).filter((cur) => !rates[cur]);
  const data: FxRates = { rates, date, buffer: FX_BUFFER, saknas, alderDagar: alderIDagar(date) };
  // Bara ett fullständigt svar får cachas i 6 h. Föll en valuta bort på ett nätfel ska nästa
  // anrop försöka igen, annars ligger en trasig kurs kvar hela arbetsdagen.
  cache = { data, at: saknas.length ? Date.now() - TTL + 60_000 : Date.now() };
  return data;
}

/** Dygn mellan Riksbankens observationsdatum (YYYY-MM-DD) och idag. */
export function alderIDagar(date: string, nu = new Date()): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const dag = 24 * 3600 * 1000;
  const diff = Date.UTC(nu.getUTCFullYear(), nu.getUTCMonth(), nu.getUTCDate()) - Date.parse(`${date}T00:00:00Z`);
  return Math.max(0, Math.round(diff / dag));
}

/** Klartext om kursläget, eller null när allt är färskt. Samma text i UI och i AI-underlaget. */
export function fxVarning(fx: FxRates): string | null {
  if (fx.saknas.length) {
    return `Kursen för ${fx.saknas.join(", ")} gick inte att hämta från Riksbanken. Rader i den valutan räknas som SEK och blir kraftigt fel. Prissätt inte förrän kursen är hämtad.`;
  }
  // Riksbanken noterar inte helger och röda dagar, tre dygn täcker en långhelg utan brus.
  if (fx.alderDagar != null && fx.alderDagar > 3) {
    return `Riksbankens senaste notering är ${fx.alderDagar} dygn gammal (${fx.date}). Stäm av kursen innan du sätter pris.`;
  }
  return null;
}

/** Kalkylkurs (SEK per enhet) för en valuta, inkl. buffert. Okänd valuta → 1 (behandlas som SEK). */
export function calcRate(rates: Record<string, number>, currency: string | null | undefined, buffer = FX_BUFFER): number {
  const cur = (currency || "SEK").toUpperCase();
  const spot = rates[cur];
  if (!spot) return 1;
  return cur === "SEK" ? 1 : spot * buffer;
}
