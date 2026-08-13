// SEO-1 / S-1 — EN hämtningsväg för hela SEO/AEO-produkten.
//
// Bakgrunden: S-0-kartläggningen hittade FEM olika user-agents i samma verktyg
// (`Cockpit-SEO-DeepAudit/2.0`, `node`, `HM-Motor-SEO-Auditor/1.0`, `Mozilla/5.0`,
// `Mozilla/5.0 HM-Cockpit-Intel/1.0`) plus en www-redirect-prob som inte satte någon alls.
// Delar av samma rapport kunde alltså beskriva olika sajter. Värre: ingen kodväg läste
// statuskoden eller kroppsstorleken, så en tom kropp eller en 403-sida parsades som
// "sidans HTML" och blev till nollor som AI:n fick som uppmätta fakta.
//
// Reglerna här är avsiktligt hårda:
//   1. EN user-agent (SEO_USER_AGENT) på ALLA kodvägar.
//   2. Bara HTTP 200 accepteras. Allt annat är ett fel med bevarad statuskod och URL.
//   3. En HTML-sida under MIN_SIDSTORLEK_BYTE byte är en misslyckad hämtning, även vid 200.
//   4. Varje hämtning loggas: statuskod, byte-storlek, slutlig URL efter redirects, tid.
//   5. Nätverksfel och timeout blir fel — aldrig en tom sida.
//
// ⚠ Avgränsning som är MEDVETEN: 500-bytesgolvet gäller bara HTML-sidor (`hamtaSida`).
// robots.txt är ofta 30 byte och forbalance.se:s sitemap.xml är 365 byte — ett golv där
// hade gjort giltiga filer till fel. Redirect-proben (`redirect: "manual"`) VILL ha 3xx
// och går därför via `hamtaRatt` med `accepteraIckeOk`. Alla tre använder samma UA.

/** Enda user-agent som produkten får presentera sig med. Ändras här, ingen annanstans. */
export const SEO_USER_AGENT = "Mozilla/5.0 (compatible; CockpitSEO/1.0; +https://cockpit.gripcoaching.se)";

/** Under detta antal byte är ett 200-svar inte en sida — det är en misslyckad hämtning. */
export const MIN_SIDSTORLEK_BYTE = 500;

export type HamtOrsak = "http" | "for-liten" | "natverk" | "timeout";

/** Bevis på vad EN hämtning faktiskt gav. Utan detta går nästa fel inte att felsöka. */
export interface HamtLogg {
  url: string;
  /** HTTP-status. null = svaret nådde aldrig fram (nätverksfel/timeout). */
  status: number | null;
  /** Kroppens storlek i byte (UTF-8). null = ingen kropp lästes. */
  bytes: number | null;
  /** Slutlig URL efter redirects. null = okänd. */
  slutUrl: string | null;
  /** Svarstid i millisekunder. */
  ms: number;
  ok: boolean;
  orsak: HamtOrsak | null;
  /** Klartext på svenska, redo att visas för en människa. */
  fel: string | null;
}

/** Kastas när en sida INTE kunde läsas. Bär hela hämtningsloggen vidare. */
export class SidaEjLast extends Error {
  readonly logg: HamtLogg;
  constructor(logg: HamtLogg) {
    super(logg.fel || `Sidan kunde inte läsas: ${logg.url}`);
    this.name = "SidaEjLast";
    this.logg = logg;
  }
}

export function arSidaEjLast(e: unknown): e is SidaEjLast {
  return e instanceof SidaEjLast || (typeof e === "object" && e !== null && (e as { name?: string }).name === "SidaEjLast");
}

const byteLangd = (s: string): number => {
  try { return new TextEncoder().encode(s).length; } catch { return s.length; }
};

const tyst = () => process.env.VITEST === "true" || process.env.NODE_ENV === "test";

/** Skriver hämtningsraden. En rad per URL, alltid samma fält — går att gröpa i loggen. */
export function loggaHamtning(logg: HamtLogg): void {
  if (tyst()) return;
  const rad =
    `[seo-hamt] ${logg.ok ? "OK " : "FEL"} ${logg.url}` +
    ` | status=${logg.status ?? "-"} | byte=${logg.bytes ?? "-"}` +
    ` | slutUrl=${logg.slutUrl ?? "-"} | ms=${logg.ms}` +
    (logg.orsak ? ` | orsak=${logg.orsak}` : "") +
    (logg.fel ? ` | ${logg.fel}` : "");
  if (logg.ok) console.info(rad);
  else console.warn(rad);
}

function klassaKast(e: unknown): { orsak: HamtOrsak; fel: string } {
  const namn = (e as { name?: string })?.name || "";
  const meddelande = (e as { message?: string })?.message || String(e);
  if (namn === "TimeoutError" || /timeout|timed out/i.test(meddelande)) {
    return { orsak: "timeout", fel: "Hämtningen hann inte klart innan tidsgränsen." };
  }
  if (namn === "AbortError") {
    return { orsak: "timeout", fel: "Hämtningen avbröts innan svaret kom." };
  }
  return { orsak: "natverk", fel: `Nätverksfel: ${meddelande}` };
}

/**
 * S-6 — headers en riktig webbläsare alltid skickar.
 *
 * FYNDET (Håkan 2026-08-13): djupgranskningen av forbalance.se föll på "Servern svarade
 * HTTP 500". Sajten svarar 200 med 496 KB från en vanlig uppkoppling — med vilken
 * user-agent som helst, även vår egen. Felet kom bara från drift.
 *
 * Skillnaden satt i det vi INTE skickade. Hämtningen satte enbart User-Agent, alltså gick
 * begäran ut med ett tomt Accept-värde (allt-tillåtet) och utan `Accept-Language`. En begäran som utger sig för
 * att vara Mozilla men saknar de headers varje webbläsare skickar är en känd bot-signatur,
 * och skyddet framför GHL-sajter är märkbart hårdare mot ett datacenter-IP än mot en
 * vanlig bredbandslinje. Därav 200 lokalt och 500 från Vercel.
 *
 * ⚠ Det här är fortfarande en HÄRLEDNING, inte ett återskapat fel: 500:an gick inte att
 * framkalla härifrån. Headers gör begäran ärligare och kan inte göra något sämre, men
 * beviset är att djupgranskningen går igenom i drift.
 */
const WEBBLASAR_HEADERS: Record<string, string> = {
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "sv-SE,sv;q=0.9,en;q=0.8",
};

export interface HamtOpts {
  timeoutMs?: number;
  redirect?: RequestRedirect;
  /** true = returnera svaret även när status inte är 200 (redirect-prob, robots-404). */
  accepteraIckeOk?: boolean;
  /** Extra headers. User-Agent går aldrig att åsidosätta. */
  headers?: Record<string, string>;
  /**
   * Antal försök totalt. Default 2 = ett omtag.
   *
   * Bara 5xx, nätverksfel och timeout görs om — 4xx är ett svar, inte ett strul, och att
   * göra om en 404 är att låtsas att den kan bli något annat. Redirect-proben skickar 1:
   * den VILL ha sin 3xx och ska aldrig vänta.
   */
  forsok?: number;
}

/** 5xx, nätverksfel och timeout är värda ett omtag. Allt annat är sajtens svar. */
function vardOmtag(status: number | null): boolean {
  return status === null || status >= 500;
}

export interface HamtSvar {
  logg: HamtLogg;
  /** Kroppen. null när svaret inte gick att läsa. */
  text: string | null;
  headers: Headers | null;
}

/**
 * Rå hämtning. Kastar ALDRIG — allt hamnar i loggen. Används av robots.txt, sitemap
 * och redirect-proben, som har egna regler om vilka statuskoder som är meningsfulla.
 */
export async function hamtaRatt(url: string, opts?: HamtOpts): Promise<HamtSvar> {
  const forsok = Math.max(1, opts?.forsok ?? 2);
  let sista: HamtSvar | null = null;
  for (let n = 1; n <= forsok; n++) {
    const svar = await hamtaEnGang(url, opts);
    if (svar.logg.ok || !vardOmtag(svar.logg.status)) return svar;
    sista = svar;
    if (n < forsok) {
      // Kort paus. Ett omtag i samma andetag träffar samma överbelastning eller samma
      // spärr; en halv sekund räcker för att komma förbi ett tillfälligt strul utan att
      // göra crawlen märkbart långsammare.
      await new Promise((r) => setTimeout(r, 500 * n));
    }
  }
  return sista!;
}

async function hamtaEnGang(url: string, opts?: HamtOpts): Promise<HamtSvar> {
  const t0 = Date.now();
  const timeoutMs = opts?.timeoutMs ?? 20000;
  try {
    const res = await fetch(url, {
      headers: { ...WEBBLASAR_HEADERS, ...(opts?.headers || {}), "User-Agent": SEO_USER_AGENT },
      signal: AbortSignal.timeout(timeoutMs),
      ...(opts?.redirect ? { redirect: opts.redirect } : {}),
    });
    // Redirect-proben ska aldrig läsa kroppen — den vill bara ha status + location.
    const laserKropp = opts?.redirect !== "manual";
    const text = laserKropp ? await res.text() : null;
    const bytes = text == null ? null : byteLangd(text);
    const ejOk = res.status !== 200 && !opts?.accepteraIckeOk;
    const logg: HamtLogg = {
      url,
      status: res.status,
      bytes,
      slutUrl: res.url || url,
      ms: Date.now() - t0,
      ok: !ejOk,
      orsak: ejOk ? "http" : null,
      fel: ejOk ? `Servern svarade HTTP ${res.status} för ${url}` : null,
    };
    loggaHamtning(logg);
    return { logg, text, headers: res.headers };
  } catch (e) {
    const { orsak, fel } = klassaKast(e);
    const logg: HamtLogg = { url, status: null, bytes: null, slutUrl: null, ms: Date.now() - t0, ok: false, orsak, fel };
    loggaHamtning(logg);
    return { logg, text: null, headers: null };
  }
}

/**
 * Hämtar en HTML-sida. Returnerar bara när hämtningen VERKLIGEN lyckades:
 * HTTP 200 och en kropp på minst MIN_SIDSTORLEK_BYTE byte. I alla andra lägen
 * kastas `SidaEjLast` med statuskod, byte-storlek, slutlig URL och tid bevarade.
 */
export async function hamtaSida(
  url: string,
  opts?: { timeoutMs?: number },
): Promise<{ text: string; headers: Headers; logg: HamtLogg }> {
  const svar = await hamtaRatt(url, { timeoutMs: opts?.timeoutMs ?? 20000 });

  if (!svar.logg.ok || svar.text == null || svar.headers == null) {
    throw new SidaEjLast(svar.logg);
  }

  const bytes = svar.logg.bytes ?? 0;
  if (bytes < MIN_SIDSTORLEK_BYTE) {
    const logg: HamtLogg = {
      ...svar.logg,
      ok: false,
      orsak: "for-liten",
      fel: `Sidan svarade 200 men kroppen var bara ${bytes} byte (minst ${MIN_SIDSTORLEK_BYTE} krävs) — inget innehåll att mäta.`,
    };
    loggaHamtning(logg);
    throw new SidaEjLast(logg);
  }

  return { text: svar.text, headers: svar.headers, logg: svar.logg };
}
