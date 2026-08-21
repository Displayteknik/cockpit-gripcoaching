// KALIBRERING-2 — DoD för de tre byggda punkterna ur DEL 9-granskningen:
//  1. Alla AEO-avdrag syns i åtgärdslistan med sin poängeffekt (inte bara schema).
//  2. Åtgärdslistan sorteras efter poängvikt, tyngsta avdraget överst.
//  3. H1/textmängd/bilder/länkar är render-medvetna (rå HTML + avkodad JS-payload),
//     samma skydd som canonical/schema redan hade — utan att dubbelräkna en sajt
//     som redan serverar allt i rå HTML (omvänt test).

import { describe, it, expect, vi, afterEach } from "vitest";
import { scoreSignals, omattaSignaler, extractPageSignals } from "@/lib/seo-deep";
import { auditUrlRendered } from "@/lib/seo-audit";
import type { HamtLogg } from "@/lib/seo-hamta";

function svar(body: string, status = 200, slutUrl = "", headers: Record<string, string> = {}) {
  return { status, url: slutUrl, headers: new Headers(headers), text: async () => body } as unknown as Response;
}

const loggFor = (status: number, bytes: number): HamtLogg => ({
  url: "https://exempel.se/", status, bytes, slutUrl: "https://exempel.se/", ms: 12,
  ok: status === 200, orsak: status === 200 ? null : "http",
  fel: status === 200 ? null : `Servern svarade HTTP ${status}`,
});

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("KALIBRERING-2 punkt 1 · alla AEO-avdrag syns i checks med poäng", () => {
  it("FAQ, textdjup, frågerubriker, listor och färskhet skriver egna 'fel'-rader", () => {
    const bas = omattaSignaler("https://exempel.se/", loggFor(200, 9999));
    const sc = scoreSignals({
      ...bas,
      ejMattOrsak: null,
      sajtHamtFel: { robots: null, sitemap: null },
      title: "Hem", titleLength: 3, metaDescription: "x", metaLength: 1,
      canonical: "https://exempel.se/", canonicalSource: "static",
      ogTags: {}, schemaTypes: ["LocalBusiness"], faqs: [],
      headings: [{ level: 1, text: "Välkommen" }], emptyHeadings: 0,
      wordCount: 300, paragraphCount: 3, listCount: 0,
      images: { total: 0, withoutAlt: 0 }, links: { internal: 5, external: 1 },
      hasUpdatedDate: false, platform: "WordPress", mainText: "text",
    });
    expect(sc.aeo).toBe(62); // 100 - 12 (faq) - 8 (djup) - 8 (frågor) - 5 (listor) - 5 (färskhet)
    const felIds = sc.checks.filter((c) => c.status === "fel").map((c) => c.id);
    expect(felIds).toEqual(expect.arrayContaining(["aeo_faq", "aeo_djup", "aeo_fragerubriker", "aeo_listor", "aeo_farskhet"]));
    expect(sc.checks.find((c) => c.id === "aeo_faq")!.poang).toBe(-12);
    expect(sc.checks.find((c) => c.id === "aeo_djup")!.poang).toBe(-8);
    expect(sc.checks.find((c) => c.id === "aeo_fragerubriker")!.poang).toBe(-8);
    expect(sc.checks.find((c) => c.id === "aeo_listor")!.poang).toBe(-5);
    expect(sc.checks.find((c) => c.id === "aeo_farskhet")!.poang).toBe(-5);
  });

  it("titel över 65 tecken och meta över 170 tecken visas som 'fel' med poäng, inte som tyst 'ok'", () => {
    const bas = omattaSignaler("https://exempel.se/", loggFor(200, 9999));
    const langTitel = "X".repeat(80);
    const langMeta = "Y".repeat(200);
    const sc = scoreSignals({
      ...bas,
      ejMattOrsak: null,
      sajtHamtFel: { robots: null, sitemap: null },
      title: langTitel, titleLength: langTitel.length, metaDescription: langMeta, metaLength: langMeta.length,
      canonical: "https://exempel.se/", canonicalSource: "static",
      ogTags: {}, schemaTypes: ["LocalBusiness"], faqs: [{ question: "Q", answer: "A" }],
      headings: [{ level: 1, text: "Vad kostar det?" }], emptyHeadings: 0,
      wordCount: 700, paragraphCount: 3, listCount: 3,
      images: { total: 0, withoutAlt: 0 }, links: { internal: 5, external: 1 },
      hasUpdatedDate: true, platform: "WordPress", mainText: "text",
    });
    const titleCheck = sc.checks.find((c) => c.id === "title")!;
    const metaCheck = sc.checks.find((c) => c.id === "meta")!;
    expect(titleCheck.status).toBe("fel");
    expect(titleCheck.poang).toBe(-4);
    expect(metaCheck.status).toBe("fel");
    expect(metaCheck.poang).toBe(-4);
  });
});

describe("KALIBRERING-2 punkt 2 · åtgärdslistan sorteras efter poängvikt", () => {
  it("auditUrlRendered lägger tyngsta avdraget överst — schema (-20) före title (-15)", async () => {
    const html = `<html lang="sv"><head><title></title></head><body>
      <p>${"kort text ".repeat(60)}</p>
    </body></html>`;
    vi.stubGlobal("fetch", vi.fn(async (u: string) => {
      if (typeof u === "string" && u.includes("robots.txt")) return svar("", 404, u);
      if (typeof u === "string" && u.includes("sitemap")) return svar("", 404, u);
      return svar(html, 200, "https://exempel.se/");
    }));
    const result = await auditUrlRendered("https://exempel.se/");
    // Tyngsta möjliga verkliga avdrag i det här fallet är schema (-20 AEO). Indexerbar
    // (sentinel) skulle gå före OM den var fel — här är sidan indexerbar, så schema ska
    // vara den första posten.
    expect(result.issues.length).toBeGreaterThan(1);
    expect(result.issues[0].field).toBe("schema");
    // Poängen ska synas i klartext för kunden.
    expect(result.issues[0].message).toContain("-20 poäng");
    // Listan är faktiskt fallande i vikt (varje post minst lika tung som nästa).
    const poangUrFalt = (field: string) => {
      const m = result.issues.find((i) => i.field === field)?.message.match(/(-\d+) poäng/);
      return m ? parseInt(m[1]) : 0;
    };
    for (let i = 1; i < result.issues.length; i++) {
      const forra = poangUrFalt(result.issues[i - 1].field);
      const denna = poangUrFalt(result.issues[i].field);
      if (forra !== 0 && denna !== 0) expect(forra).toBeLessThanOrEqual(denna);
    }
  });
});

describe("KALIBRERING-2 punkt 3 · render-medveten extraktion (H1/textmängd/bilder/länkar)", () => {
  it("H1 som bara finns i den avkodade JS-payloaden hittas nu (tidigare: falskt 'saknas')", async () => {
    const html = `<html lang="sv"><head><title>Hem</title></head><body>
      <div id="root"></div>
      <script>window.__DATA__ = "\\u003Ch1\\u003EV\\u00e4lkommen\\u003C/h1\\u003E\\u003Cp\\u003E${"text ".repeat(150)}\\u003C/p\\u003E"</script>
    </body></html>`;
    vi.stubGlobal("fetch", vi.fn(async (u: string) => svar(html, 200, typeof u === "string" ? u : "https://exempel.se/")));
    const s = await extractPageSignals("https://exempel.se/", { skipLighthouse: true, skipRobotsSitemap: true });
    expect(s.headings?.some((h) => h.level === 1)).toBe(true);
    expect(s.wordCount).toBeGreaterThan(100);
  });

  it("omvänt test: en sajt som serverar allt i rå HTML räknas identiskt (ingen dubbelräkning)", async () => {
    const html = `<html lang="sv"><head><title>Hem</title></head><body>
      <h1>Rubrik</h1>
      <img src="a.jpg" alt="a"><img src="b.jpg" alt="b">
      <a href="/en">1</a><a href="/tva">2</a><a href="/tre">3</a>
      <ul><li>x</li></ul>
      <p>${"riktig text ".repeat(100)}</p>
    </body></html>`;
    vi.stubGlobal("fetch", vi.fn(async (u: string) => svar(html, 200, typeof u === "string" ? u : "https://exempel.se/")));
    const s = await extractPageSignals("https://exempel.se/", { skipLighthouse: true, skipRobotsSitemap: true });
    // Om raw+decoded konkatenerades skulle dessa dubblas (decoded(raw) == raw här, ingen
    // \u-escaping i denna HTML, så decodePayload lämnar den i praktiken oförändrad).
    expect(s.images?.total).toBe(2);
    expect(s.links?.internal).toBe(3);
    expect(s.headings?.filter((h) => h.level === 1).length).toBe(1);
  });
});
