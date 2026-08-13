// TÄCKNINGSGRINDEN — RAPPORT-1, beslut 2 (Håkan 2026-08-13).
//
// Kärnprincipen, mekanisk och inte bara en mening i en prompt: en rapport får aldrig dra
// slutsatser ur data som saknas. Grinden jämför vad crawlen FÖRSÖKTE läsa med vad den
// FAKTISKT läste, och avgör vilken sorts leverans som är sann.
//
// ★ TRE UTFALL, INTE TVÅ. Att bara avbryta vore fegt: en konsult som upptäcker att kundens
//   server är trasig säger det som fynd nummer ett, hen säger inte "kan ej leverera".
//
//   full      → vanlig rapport
//   partiell  → BLOCKERINGSRAPPORT: bara verifierade fynd plus det tekniska felet som
//               huvudfynd. Inga innehållsrekommendationer, inga klistra-in-texter, ingen
//               innehållsplan — de hade byggts på sidor vi inte läst.
//   totalfel  → internt fel till oss. Ingen kundrapport alls.
//
// ⚠ Taket (maxPages) är INTE ett täckningsfel. En sajt med 200 sidor och ett tak på 25 är
//   avkortad med flit, och det redovisas i rapporten i stället för att fälla den. Det som
//   fäller är sidor vi FÖRSÖKTE läsa och inte fick.

import type { SiteAudit } from "@/lib/seo-deep";

export type TackningsUtfall = "full" | "partiell" | "totalfel";

export interface TackningsDom {
  utfall: TackningsUtfall;
  /** URL:er som försöktes men inte kunde läsas, med statuskod. */
  ejLasta: { url: string; status: number | null; fel: string | null }[];
  /**
   * 404/410 från meny eller sitemap. Det är ett FYND om kundens sajt (en död länk),
   * inte ett hål i vår läsning, och fäller därför aldrig körningen.
   */
  dodaLankar: { url: string; status: number | null }[];
  /** 5xx, timeout och blockering. Det är HÄR täckningen brister. */
  serverfel: { url: string; status: number | null }[];
  /** Sidor som lästes. */
  lasta: number;
  /** Sidor som försöktes. */
  forsokta: number;
  /** URL:er som föll utanför taket — redovisas, fäller inte. */
  overTaket: string[];
  /** Klartext på svenska. Alltid ifylld, även vid full täckning. */
  varfor: string;
  /** Det dominerande felet, när ett sådant går att peka ut (t.ex. 500 på alla). */
  huvudfel: { status: number | null; antal: number; monster: string } | null;
}

/** Under så här många tecken startsidetext är sajten inte läst, den är oläsbar. */
export const MIN_HOMEPAGE_TECKEN = 200;

function beskrivHuvudfel(ejLasta: TackningsDom["ejLasta"]): TackningsDom["huvudfel"] {
  if (!ejLasta.length) return null;
  const perStatus = new Map<number | null, number>();
  for (const e of ejLasta) perStatus.set(e.status, (perStatus.get(e.status) ?? 0) + 1);
  const [status, antal] = Array.from(perStatus.entries()).sort((a, b) => b[1] - a[1])[0];
  const monster =
    status === null
      ? "Servern svarade inte alls (timeout eller nätverksfel)."
      : status >= 500
        ? `Servern svarade med fel (HTTP ${status}) på ${antal} av ${ejLasta.length} sidor.`
        : status === 403
          ? "Servern nekade oss åtkomst (HTTP 403)."
          : status === 404
            ? "Sidorna finns inte längre (HTTP 404) trots att de står i sitemap eller meny."
            : `Servern svarade HTTP ${status}.`;
  return { status, antal, monster };
}

/**
 * Avgör vad crawlen ger rätt att leverera.
 *
 * Ersätter `underlagDuger`: samma tre spärrar finns kvar som `totalfel`, men utfallet är
 * numera tredelat i stället för ja/nej.
 */
/**
 * Hur stor andel serverfel som gör hela leveransen otillförlitlig.
 *
 * ★ Håkans beställning skiljer på två saker som båda är "sidor vi inte fick läsa":
 *   "Serverfel på enstaka sidor i en i övrigt lyckad crawl redovisas som eget fyndkapitel
 *   i den vanliga rapporten." Först när felet dominerar är det sajten som är trasig, och
 *   då ska hela rapporten bytas mot blockeringsrapporten.
 *
 *   Mätt 13/8: forbalance i sitt 500-läge gav 1 läst sida av 17 (94 procent fel), medan
 *   samma sajt från cachen gav 17 av 21 med tre döda menylänkar (0 procent serverfel).
 *   Gränsen 30 procent skiljer de två lägena med god marginal åt båda håll.
 */
export const SERVERFEL_ANDEL_FOR_BLOCKERING = 0.3;

export function bedomTackning(site: SiteAudit): TackningsDom {
  const ejLasta = site.misslyckade.map((m) => ({ url: m.url, status: m.status, fel: m.fel }));
  const dodaLankar = ejLasta.filter((m) => m.status === 404 || m.status === 410).map((m) => ({ url: m.url, status: m.status }));
  const serverfel = ejLasta.filter((m) => m.status !== 404 && m.status !== 410).map((m) => ({ url: m.url, status: m.status }));
  const bas = {
    ejLasta,
    dodaLankar,
    serverfel,
    lasta: site.pageCount,
    forsokta: site.pageCountForsokt,
    overTaket: site.upptackt?.overTaket ?? [],
    huvudfel: beskrivHuvudfel(serverfel.length ? ejLasta.filter((m) => m.status !== 404 && m.status !== 410) : ejLasta),
  };

  // 1. Ingen enda sida lästes.
  if (site.pageCount === 0) {
    const orsaker = ejLasta.slice(0, 3).map((m) => `${m.url} (${m.status ?? "inget svar"})`).join("; ");
    return {
      ...bas,
      utfall: "totalfel",
      varfor:
        `Ingen av de ${site.pageCountForsokt} sidorna gick att läsa. ` +
        (orsaker ? `Först i listan: ${orsaker}. ` : "") +
        `Det är nästan alltid ett fel i hämtningen, inte på sajten.`,
    };
  }

  // 2. Startsidan gick inte att läsa. null = kunde inte läsas, "" = lästes och var tom.
  if (site.homepageText == null) {
    const h = ejLasta.find((m) => m.url === site.root) ?? ejLasta[0];
    return {
      ...bas,
      utfall: "totalfel",
      varfor:
        `Startsidan (${site.root}) kunde inte läsas` +
        (h ? ` — ${h.status ?? "inget svar"}` : "") +
        `. Utan den finns inget innehålls- eller E-E-A-T-underlag alls.`,
    };
  }

  if (site.homepageText.trim().length < MIN_HOMEPAGE_TECKEN) {
    return {
      ...bas,
      utfall: "totalfel",
      varfor:
        `Startsidan svarade men innehöll bara ${site.homepageText.trim().length} tecken läsbar text. ` +
        `Vanligaste orsaken är en sida som byggs med JavaScript vi inte kom åt, en parkerad domän, ` +
        `eller ett skal som kräver inloggning.`,
    };
  }

  // 3. Serverfel som DOMINERAR → sajten är trasig, inte vår läsning.
  const andelServerfel = site.pageCountForsokt > 0 ? serverfel.length / site.pageCountForsokt : 0;
  if (serverfel.length > 0 && (andelServerfel >= SERVERFEL_ANDEL_FOR_BLOCKERING || site.pageCount <= 1)) {
    return {
      ...bas,
      utfall: "partiell",
      varfor:
        `${site.pageCount} av ${site.pageCountForsokt} sidor kunde läsas. ` +
        `${serverfel.length} sidor föll på serverfel. ${bas.huvudfel?.monster ?? ""}`.trim(),
    };
  }

  // 4. Full täckning. Sitemapfel räknas ändå som partiellt: en sitemap vi inte kunde läsa
  //    kan dölja sidor vi aldrig ens försökte hämta, och då vet vi inte att vi såg allt.
  if (site.sitemapFel) {
    return {
      ...bas,
      utfall: "partiell",
      varfor:
        `Alla ${site.pageCount} hittade sidor lästes, men sitemapen kunde inte läsas ` +
        `(${site.sitemapFel}). Det kan finnas sidor vi aldrig fick veta om.`,
    };
  }

  // 5. Full täckning. Döda länkar och enstaka serverfel följer med som FYND i rapporten,
  //    de fäller den inte. En 404 från menyn är information om kundens sajt.
  const noter: string[] = [];
  if (dodaLankar.length) noter.push(`${dodaLankar.length} länk${dodaLankar.length === 1 ? "" : "ar"} pekar på sidor som inte finns (404)`);
  if (serverfel.length) noter.push(`${serverfel.length} sida gav serverfel men resten lästes`);
  return {
    ...bas,
    utfall: "full",
    varfor: `Alla ${site.pageCount} sidor som gick att läsa lästes.` + (noter.length ? ` Noterat: ${noter.join(", ")}.` : ""),
  };
}

/**
 * Intern konsistens: refererar rapporttexten till sidor eller innehåll som crawlen samtidigt
 * påstår inte finns?
 *
 * ★ 13/8-rapporten gjorde exakt det: den hänvisade till "bloggposterna" och länken
 *   "Klienten berättar" i sina instruktioner, medan den i samma dokument påstod att sajten
 *   bara har tre sidor. Läsaren kan inte avgöra vilken av utsagorna som gäller.
 */
export function hittaInkonsistens(
  rapport: string,
  crawladeUrler: string[],
): { fras: string; rad: string }[] {
  const kanda = new Set(
    crawladeUrler.map((u) => {
      try { return new URL(u).pathname.replace(/\/+$/, "").toLowerCase(); } catch { return u.toLowerCase(); }
    }),
  );
  const harBlogg = Array.from(kanda).some((p) => /(^|\/)(blogg?|blog|nyheter|artiklar)(\/|$)/.test(p));

  const traffar: { fras: string; rad: string }[] = [];
  const rader = rapport.split(/\r?\n/);
  for (const rad of rader) {
    const l = rad.toLowerCase();
    // Bara påståenden som förutsätter att innehållet FINNS. "skapa en blogg" är inget brott.
    if (!harBlogg && /(bloggpost|blogginlägg|dina blogginlägg|era blogginlägg|befintliga blogg)/i.test(l)) {
      traffar.push({ fras: "hänvisar till bloggposter som inte finns i sidlistan", rad: rad.trim().slice(0, 200) });
    }
  }
  return traffar;
}
