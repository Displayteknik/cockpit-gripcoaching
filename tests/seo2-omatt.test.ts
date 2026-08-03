// SEO-2 / S-2 — skilj noll från okänt.
//
// `null` = INTE mätt. `0` = mätt till noll. Facit ur S-0: for-balance-rapporten fick
// "0 ord, 0 bilder, ingen title, 2 sidor" om en sajt med 678 ord, 75 bilder, title "Hem"
// och 13 sidor — och gav dessutom GRÖNT ljus på "Inga bilder utan alt-text (0 bilder totalt)",
// alltså på sajtens enda riktiga brist.
//
// DoD: mocka hämtningen till 403. INGEN rad i den resulterande datastrukturen får vara
// 0 eller OK — alla ska vara null med orsak.

import { describe, it, expect, vi, afterEach } from "vitest";
import { crawlSite, scoreSignals, omattaSignaler, extractPageSignals, type SitePageSummary } from "@/lib/seo-deep";
import type { HamtLogg } from "@/lib/seo-hamta";

function svar(body: string, status = 200, slutUrl = "", headers: Record<string, string> = {}) {
  return { status, url: slutUrl, headers: new Headers(headers), text: async () => body } as unknown as Response;
}

const SID_HTML = `<html lang="sv"><head><title>Hem</title>
<meta name="description" content="${"d".repeat(140)}">
<link rel="canonical" href="https://exempel.se/">
</head><body><h1>Rubrik</h1>
${'<img src="a.jpg">'.repeat(75)}
<a href="/en">1</a><a href="/tva">2</a><a href="/tre">3</a>
<p>${"ord ".repeat(700)}</p></body></html>`;

/** Alla fält i en sidrad som är MÄTVÄRDEN. url/hämtning/orsak är metadata, inte mätning. */
const MATFALT: (keyof SitePageSummary)[] = [
  "title", "titleLength", "metaLength", "canonical", "canonicalSource", "h1", "h1Count",
  "emptyHeadings", "schemaTypes", "wordCount", "imagesTotal", "imagesNoAlt", "internalLinks",
  "seo", "aeo", "indexerbar",
];

const loggFor = (status: number, bytes: number): HamtLogg => ({
  url: "https://forbalance.se/", status, bytes, slutUrl: "https://forbalance.se/", ms: 12,
  ok: false, orsak: status === 200 ? "for-liten" : "http",
  fel: status === 200 ? `Sidan svarade 200 men kroppen var bara ${bytes} byte` : `Servern svarade HTTP ${status}`,
});

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("S-2 · en omätt sida har null överallt, aldrig noll", () => {
  it("omattaSignaler sätter varje mätvärde till null och bär orsaken", () => {
    const s = omattaSignaler("https://forbalance.se/", loggFor(403, 150));
    expect(s.ejMattOrsak).toContain("403");
    for (const nyckel of ["title", "titleLength", "metaDescription", "metaLength", "canonical", "lang",
      "robots", "ogTags", "schemaTypes", "faqs", "headings", "emptyHeadings", "wordCount",
      "paragraphCount", "listCount", "images", "links", "hasUpdatedDate", "platform", "mainText"] as const) {
      expect(s[nyckel], `${nyckel} ska vara null (inte 0/""/[])`).toBeNull();
    }
    expect(s.canonicalSource).toBe("okand"); // inte "none" — vi VET inte
  });

  it("scoreSignals ger null-poäng och gör VARJE check ej-matt med orsak", () => {
    const sc = scoreSignals(omattaSignaler("https://forbalance.se/", loggFor(403, 150)));
    expect(sc.seo).toBeNull();
    expect(sc.aeo).toBeNull();
    expect(sc.indexerbar).toBeNull();
    expect(sc.checks.length).toBeGreaterThan(0);
    for (const c of sc.checks) {
      expect(c.status, `${c.id} fick status ${c.status}`).toBe("ej-matt");
      expect(c.detail.length, `${c.id} saknar orsak`).toBeGreaterThan(0);
    }
    expect(sc.checks.some((c) => c.status === "ok")).toBe(false);
  });

  it("'Inga bilder utan alt-text' kan ALDRIG sättas när bildantalet är null", () => {
    const sc = scoreSignals(omattaSignaler("https://forbalance.se/", loggFor(403, 150)));
    const bilder = sc.checks.find((c) => c.id === "bilder_alt");
    expect(bilder).toBeDefined();
    expect(bilder!.status).toBe("ej-matt");
    // Samma sak för de tre andra som S-2 pekar ut.
    for (const id of ["indexerbar", "canonical", "title"]) {
      expect(sc.checks.find((c) => c.id === id)!.status).toBe("ej-matt");
    }
  });
});

describe("S-2 · DoD: hämtningen mockad till 403", () => {
  it("ingen rad i crawl-resultatet är 0 eller OK — alla är null med orsak", async () => {
    vi.stubGlobal("fetch", vi.fn(async (u: string) => svar("<html><body>403 Forbidden</body></html>", 403, u)));

    const site = await crawlSite("https://forbalance.se/", { maxPages: 25, skipLighthouse: true });

    // Sidan tappas inte tyst — den finns kvar, men utan ett enda mätvärde.
    expect(site.pages.length).toBe(1);
    for (const p of site.pages) {
      expect(p.ejMattOrsak).toBeTruthy();
      expect(p.hamtning.ok).toBe(false);
      expect(p.hamtning.status).toBe(403);
      for (const f of MATFALT) {
        expect(p[f], `${p.url} · ${String(f)} = ${JSON.stringify(p[f])} (ska vara null)`).toBeNull();
      }
    }

    // pageCount räknar sidor som VERKLIGEN lästes, inte hämtningsförsök.
    expect(site.pageCount).toBe(0);
    expect(site.pageCountForsokt).toBe(1);
    expect(site.misslyckade.length).toBe(1);
    expect(site.misslyckade[0].status).toBe(403);
    expect(site.misslyckade[0].fel).toContain("403");

    // Startsidans text: null = kunde inte läsas. Aldrig "".
    expect(site.homepageText).toBeNull();
    expect(site.platform).toBeNull();
    expect(site.robotsTxt).toBeNull();
    expect(site.robotsTxtFel).toBeTruthy();
    expect(site.sitemapUrlCount).toBeNull();
    expect(site.sitemapFel).toBeTruthy();

    // Tvärsides-aggregaten summerar inga fantomer.
    expect(site.crossPage.totalImagesNoAlt).toBeNull();
    expect(site.crossPage.avgInternalLinks).toBeNull();
    expect(site.crossPage.thinPages).toEqual([]);
    expect(site.crossPage.pagesMissingH1).toEqual([]);
    expect(site.crossPage.duplicateTitles).toEqual([]);
    expect(site.crossPage.ejMattaSidor.length).toBe(1);
  });

  it("200 med tom kropp (under 500 byte) ger exakt samma sak — inte 'tom sida'", async () => {
    vi.stubGlobal("fetch", vi.fn(async (u: string) => svar("", 200, u)));

    const site = await crawlSite("https://forbalance.se/", { maxPages: 25, skipLighthouse: true });

    expect(site.pageCount).toBe(0);
    expect(site.misslyckade.length).toBe(1);
    expect(site.misslyckade[0].status).toBe(200);
    expect(site.misslyckade[0].bytes).toBe(0);
    expect(site.misslyckade[0].fel).toContain("byte");
    for (const f of MATFALT) expect(site.pages[0][f], String(f)).toBeNull();
    expect(site.homepageText).toBeNull();
  });

  it("en sida som faller mitt i crawlen försvinner inte spårlöst", async () => {
    vi.stubGlobal("fetch", vi.fn(async (u: string) => {
      if (u.endsWith("/robots.txt")) return svar("User-agent: *\nAllow: /\n", 200, u);
      if (u.endsWith("/sitemap.xml")) return svar("<urlset><loc>https://exempel.se/</loc><loc>https://exempel.se/trasig</loc></urlset>", 200, u);
      if (u.includes("/trasig")) return svar("nope", 500, u);
      return svar(SID_HTML, 200, u);
    }));

    const site = await crawlSite("https://exempel.se/", { maxPages: 25, skipLighthouse: true });

    expect(site.pageCountForsokt).toBe(2);
    expect(site.pageCount).toBe(1);            // bara startsidan lästes
    expect(site.misslyckade.map((m) => m.url)).toEqual(["https://exempel.se/trasig"]);
    expect(site.misslyckade[0].status).toBe(500);
    // Aggregaten bygger BARA på den lästa sidan — den trasiga drar inte ned snittet till noll.
    expect(site.crossPage.totalImagesNoAlt).toBe(75);
    expect(site.crossPage.avgInternalLinks).toBe(3);
    expect(site.crossPage.ejMattaSidor).toEqual(["https://exempel.se/trasig"]);
  });
});

describe("S-2 · en MÄTT sida ger riktiga siffror och riktiga fynd", () => {
  it("75 bilder utan alt-text blir ett FEL, inte ett grönt 'inga bilder utan alt-text'", async () => {
    vi.stubGlobal("fetch", vi.fn(async (u: string) => svar(SID_HTML, 200, u)));
    const s = await extractPageSignals("https://exempel.se/", { skipLighthouse: true, skipRobotsSitemap: true });

    expect(s.ejMattOrsak).toBeNull();
    expect(s.images).toEqual({ total: 75, withoutAlt: 75 });
    expect(s.wordCount).toBeGreaterThan(600);
    expect(s.title).toBe("Hem");

    const sc = scoreSignals(s);
    const bilder = sc.checks.find((c) => c.id === "bilder_alt")!;
    expect(bilder.status).toBe("fel");
    expect(bilder.detail).toContain("75");
    expect(typeof sc.seo).toBe("number");
  });

  it("0 bilder som VERKLIGEN mättes får fortfarande vara grönt — noll är ett mätvärde", () => {
    const matt = omattaSignaler("https://exempel.se/", loggFor(200, 9999));
    const sc = scoreSignals({
      ...matt,
      ejMattOrsak: null,
      sajtHamtFel: { robots: null, sitemap: null },
      title: "Hem", titleLength: 3, metaDescription: "x", metaLength: 1,
      canonical: "https://exempel.se/", canonicalSource: "static",
      ogTags: {}, schemaTypes: [], faqs: [], headings: [{ level: 1, text: "H" }], emptyHeadings: 0,
      wordCount: 700, paragraphCount: 3, listCount: 2,
      images: { total: 0, withoutAlt: 0 }, links: { internal: 5, external: 1 },
      hasUpdatedDate: true, platform: "WordPress", mainText: "text",
    });
    const bilder = sc.checks.find((c) => c.id === "bilder_alt")!;
    expect(bilder.status).toBe("ok");
    expect(bilder.detail).toBe("0 bilder totalt");
    expect(sc.seo).not.toBeNull();
  });

  it("robots.txt som inte gick att läsa gör indexerbarheten okänd — inte grön", () => {
    const bas = omattaSignaler("https://exempel.se/", loggFor(200, 9999));
    const sc = scoreSignals({
      ...bas,
      ejMattOrsak: null,
      sajtHamtFel: { robots: "robots.txt gav HTTP 503", sitemap: null },
      title: "Hem", titleLength: 3, metaDescription: "x", metaLength: 1,
      canonical: "https://exempel.se/", canonicalSource: "static",
      ogTags: {}, schemaTypes: [], faqs: [], headings: [{ level: 1, text: "H" }], emptyHeadings: 0,
      wordCount: 700, paragraphCount: 3, listCount: 2,
      images: { total: 1, withoutAlt: 0 }, links: { internal: 5, external: 1 },
      hasUpdatedDate: true, platform: "WordPress", mainText: "text",
    });
    expect(sc.indexerbar).toBeNull();
    const check = sc.checks.find((c) => c.id === "indexerbar")!;
    expect(check.status).toBe("ej-matt");
    expect(check.detail).toContain("503");
  });
});
