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
  const data: FxRates = { rates, date, buffer: FX_BUFFER };
  cache = { data, at: Date.now() };
  return data;
}

/** Kalkylkurs (SEK per enhet) för en valuta, inkl. buffert. Okänd valuta → 1 (behandlas som SEK). */
export function calcRate(rates: Record<string, number>, currency: string | null | undefined, buffer = FX_BUFFER): number {
  const cur = (currency || "SEK").toUpperCase();
  const spot = rates[cur];
  if (!spot) return 1;
  return cur === "SEK" ? 1 : spot * buffer;
}
