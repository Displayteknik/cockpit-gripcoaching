// SEO-1 / S-1 — hämtningen ska vara ärlig.
//
// Facit ur S-0-kartläggningen: verktyget läste aldrig statuskoden eller kroppsstorleken,
// och körde fem olika user-agents i samma produkt. Testerna nedan låser fast att
//  1) en enda user-agent används på ALLA kodvägar,
//  2) bara HTTP 200 accepteras,
//  3) ett 200-svar under 500 byte är ett fel,
//  4) statuskod, byte, slutlig URL och tid bevaras,
//  5) nätverksfel och timeout blir fel — aldrig en tom sida.
//
// Ingen riktig nätverkstrafik: global fetch är mockad i varje test.

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  SEO_USER_AGENT, MIN_SIDSTORLEK_BYTE, hamtaSida, hamtaRatt, arSidaEjLast, SidaEjLast,
} from "@/lib/seo-hamta";
import { extractPageSignals, crawlSite } from "@/lib/seo-deep";

const stor = (marker = "hej") =>
  `<html><head><title>Test</title></head><body><h1>${marker}</h1><p>` + "x".repeat(900) + "</p></body></html>";

function svar(body: string | null, status = 200, slutUrl = "", headers: Record<string, string> = {}) {
  return {
    status,
    url: slutUrl,
    headers: new Headers(headers),
    text: async () => body ?? "",
  } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("S-1 · en enda user-agent", () => {
  it("konstanten är exakt den beslutade strängen", () => {
    expect(SEO_USER_AGENT).toBe("Mozilla/5.0 (compatible; CockpitSEO/1.0; +https://cockpit.gripcoaching.se)");
  });

  it("sidhämtaren skickar den — och ingen annan identitet", async () => {
    const anrop: RequestInit[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init: RequestInit) => {
      anrop.push(init);
      return svar(stor(), 200, "https://exempel.se/");
    }));
    await hamtaSida("https://exempel.se/");
    const ua = (anrop[0].headers as Record<string, string>)["User-Agent"];
    expect(ua).toBe(SEO_USER_AGENT);
  });

  it("HELA crawlen — sida, robots.txt, sitemap OCH www-redirect-proben — använder samma UA", async () => {
    const uaPerUrl = new Map<string, string>();
    vi.stubGlobal("fetch", vi.fn(async (u: string, init: RequestInit) => {
      uaPerUrl.set(u, (init.headers as Record<string, string>)["User-Agent"]);
      if (u.endsWith("/robots.txt")) return svar("User-agent: *\nAllow: /\n", 200, u);
      if (u.endsWith("/sitemap.xml")) return svar("<urlset></urlset>", 200, u);
      return svar(stor(), 200, u);
    }));

    await crawlSite("https://exempel.se/", { maxPages: 5, skipLighthouse: true });

    const uas = Array.from(uaPerUrl.values());
    expect(uas.length).toBeGreaterThanOrEqual(4); // prob www + prob icke-www + robots + sitemap + sida
    expect(new Set(uas)).toEqual(new Set([SEO_USER_AGENT]));
    // Redirect-proben är den kodväg som tidigare inte satte någon UA alls.
    const probUrls = Array.from(uaPerUrl.keys()).filter((u) => u === "https://www.exempel.se/");
    expect(probUrls.length).toBe(1);
    expect(uaPerUrl.get("https://www.exempel.se/")).toBe(SEO_USER_AGENT);
  });
});

describe("S-1 · bara 200 accepteras", () => {
  it("403 kastar SidaEjLast med statuskod och URL bevarade — inte ett tomt resultat", async () => {
    // Exakt openrestys 403-kropp som forbalance.se ger en blockerad bot (GPTBot/1.0 m.fl.)
    const kropp = "<html><head><title>403 Forbidden</title></head>\n<body><center><h1>403 Forbidden</h1></center><hr><center>openresty</center></body></html>";
    vi.stubGlobal("fetch", vi.fn(async () => svar(kropp, 403, "https://forbalance.se/")));

    const fel = await hamtaSida("https://forbalance.se/").then(() => null, (e) => e);
    expect(arSidaEjLast(fel)).toBe(true);
    const logg = (fel as SidaEjLast).logg;
    expect(logg.status).toBe(403);
    expect(logg.url).toBe("https://forbalance.se/");
    expect(logg.ok).toBe(false);
    expect(logg.orsak).toBe("http");
    expect(logg.bytes).toBe(kropp.length);
  });

  it("en blockerad bot ger FEL ur extractPageSignals — aldrig title/ord från 403-sidan", async () => {
    // Före S-1 hade 403-kroppen parsats: title "403 Forbidden", h1Count 1, wordCount 3.
    vi.stubGlobal("fetch", vi.fn(async () =>
      svar("<html><head><title>403 Forbidden</title></head><body><h1>403 Forbidden</h1></body></html>", 403, "https://forbalance.se/")));

    const fel = await extractPageSignals("https://forbalance.se/", { skipLighthouse: true, skipRobotsSitemap: true })
      .then(() => null, (e) => e);
    expect(arSidaEjLast(fel)).toBe(true);
    expect((fel as SidaEjLast).logg.status).toBe(403);
  });

  it("500 och 404 kastar också — allt utom 200 är ett fel", async () => {
    for (const status of [301, 404, 429, 500, 503]) {
      vi.stubGlobal("fetch", vi.fn(async () => svar(stor(), status, "https://exempel.se/")));
      const fel = await hamtaSida("https://exempel.se/").then(() => null, (e) => e);
      expect(arSidaEjLast(fel), `status ${status} skulle ge fel`).toBe(true);
      expect((fel as SidaEjLast).logg.status).toBe(status);
    }
  });
});

describe("S-1 · svar under 500 byte är en misslyckad hämtning", () => {
  it("200 med tom kropp kastar med orsak for-liten och bytes 0", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => svar("", 200, "https://forbalance.se/")));
    const fel = await hamtaSida("https://forbalance.se/").then(() => null, (e) => e);
    expect(arSidaEjLast(fel)).toBe(true);
    const logg = (fel as SidaEjLast).logg;
    expect(logg.status).toBe(200);
    expect(logg.bytes).toBe(0);
    expect(logg.orsak).toBe("for-liten");
  });

  it("200 med 499 byte kastar, 500 byte släpps igenom — gränsen ligger där den ska", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => svar("a".repeat(MIN_SIDSTORLEK_BYTE - 1), 200, "https://exempel.se/")));
    await expect(hamtaSida("https://exempel.se/")).rejects.toThrow();

    vi.stubGlobal("fetch", vi.fn(async () => svar("a".repeat(MIN_SIDSTORLEK_BYTE), 200, "https://exempel.se/")));
    const ok = await hamtaSida("https://exempel.se/");
    expect(ok.logg.bytes).toBe(MIN_SIDSTORLEK_BYTE);
    expect(ok.logg.ok).toBe(true);
  });

  it("byte räknas i UTF-8, inte i tecken — å ä ö är två byte", async () => {
    const kropp = "ö".repeat(400); // 800 byte, 400 tecken
    vi.stubGlobal("fetch", vi.fn(async () => svar(kropp, 200, "https://exempel.se/")));
    const ok = await hamtaSida("https://exempel.se/");
    expect(ok.logg.bytes).toBe(800);
  });
});

describe("S-1 · loggen per URL", () => {
  it("bär statuskod, byte-storlek, slutlig URL efter redirects och tid", async () => {
    const kropp = stor();
    vi.stubGlobal("fetch", vi.fn(async () => svar(kropp, 200, "https://forbalance.se/")));
    const { logg } = await hamtaSida("https://www.forbalance.se/");
    expect(logg.url).toBe("https://www.forbalance.se/");
    expect(logg.status).toBe(200);
    expect(logg.bytes).toBe(kropp.length);
    expect(logg.slutUrl).toBe("https://forbalance.se/"); // 301 följd
    expect(typeof logg.ms).toBe("number");
    expect(logg.ms).toBeGreaterThanOrEqual(0);
  });

  it("extractPageSignals bär loggen vidare på signalobjektet", async () => {
    const kropp = stor();
    vi.stubGlobal("fetch", vi.fn(async () => svar(kropp, 200, "https://exempel.se/")));
    const s = await extractPageSignals("https://exempel.se/", { skipLighthouse: true, skipRobotsSitemap: true });
    expect(s.hamtning.status).toBe(200);
    expect(s.hamtning.bytes).toBe(kropp.length);
    expect(s.hamtning.slutUrl).toBe("https://exempel.se/");
    expect(s.ejMattOrsak).toBeNull();
    expect(s.renderNote).toContain("HTTP 200");
  });
});

describe("S-1 · nätverksfel och timeout blir fel, aldrig en tom sida", () => {
  it("nätverksfel klassas som natverk och kastar", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
    const fel = await hamtaSida("https://exempel.se/").then(() => null, (e) => e);
    expect(arSidaEjLast(fel)).toBe(true);
    const logg = (fel as SidaEjLast).logg;
    expect(logg.orsak).toBe("natverk");
    expect(logg.status).toBeNull();
    expect(logg.bytes).toBeNull();
  });

  it("timeout klassas som timeout och kastar", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      const e = new Error("The operation was aborted due to timeout");
      e.name = "TimeoutError";
      throw e;
    }));
    const fel = await hamtaSida("https://exempel.se/").then(() => null, (e) => e);
    expect(arSidaEjLast(fel)).toBe(true);
    expect((fel as SidaEjLast).logg.orsak).toBe("timeout");
  });

  it("hamtaRatt kastar aldrig — allt hamnar i loggen (robots/sitemap/prob-vägen)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
    const r = await hamtaRatt("https://exempel.se/robots.txt", { accepteraIckeOk: true });
    expect(r.logg.ok).toBe(false);
    expect(r.logg.orsak).toBe("natverk");
    expect(r.text).toBeNull();
  });
});
