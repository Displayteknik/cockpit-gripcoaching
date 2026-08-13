// S-6 — hämtningen ser ut som en webbläsare, och ett 5xx får ett omtag.
//
// FYNDET (Håkan 2026-08-13): djupgranskningen av forbalance.se föll på "Servern svarade
// HTTP 500". Mätt härifrån svarar sajten 200 med 496 KB — med vilken user-agent som helst,
// även vår egen. Felet kom bara från drift.
//
// Skillnaden satt i det som INTE skickades: bara User-Agent, alltså `Accept: */*` och
// ingen `Accept-Language`. En begäran som utger sig för att vara Mozilla men saknar de
// headers varje webbläsare skickar är en känd bot-signatur, och skyddet framför GHL-sajter
// är hårdare mot datacenter-IP:n än mot en vanlig uppkoppling.
//
// ⚠ Härledning, inte återskapat fel — 500:an gick inte att framkalla lokalt. Testerna låser
// därför MEKANIKEN (rätt headers, omtag på rätt statuskoder), inte ett påstående om att
// just den 500:an är borta. Beviset för det är en körd djupgranskning i drift.
import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { hamtaRatt, SEO_USER_AGENT } from "@/lib/seo-hamta";

const las = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

function svar(status: number, kropp = "x".repeat(1000)): Response {
  return new Response(kropp, { status, headers: { "content-type": "text/html" } });
}

afterEach(() => vi.unstubAllGlobals());

describe("S-6 · begäran ser ut som en webbläsare", () => {
  it("skickar Accept och Accept-Language, inte bara user-agent", async () => {
    let sedda: Record<string, string> = {};
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init: RequestInit) => {
      sedda = init.headers as Record<string, string>;
      return svar(200);
    }));
    await hamtaRatt("https://exempel.se/");
    expect(sedda["Accept"]).toContain("text/html");
    expect(sedda["Accept-Language"]).toContain("sv");
  });

  it("user-agenten går fortfarande aldrig att åsidosätta", async () => {
    // S-1:s regel står kvar: EN user-agent på alla kodvägar. Headers-tillägget får inte
    // öppna en väg att presentera sig som något annat.
    let sedda: Record<string, string> = {};
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init: RequestInit) => {
      sedda = init.headers as Record<string, string>;
      return svar(200);
    }));
    await hamtaRatt("https://exempel.se/", { headers: { "User-Agent": "NågotAnnat/9.9" } });
    expect(sedda["User-Agent"]).toBe(SEO_USER_AGENT);
  });
});

describe("S-6 · omtag på det som är värt ett omtag", () => {
  it("500 görs om, och lyckas omtaget används svaret", async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(svar(500))
      .mockResolvedValueOnce(svar(200));
    vi.stubGlobal("fetch", f);
    const r = await hamtaRatt("https://exempel.se/");
    expect(f).toHaveBeenCalledTimes(2);
    expect(r.logg.ok).toBe(true);
    expect(r.logg.status).toBe(200);
  });

  it("404 görs ALDRIG om — det är ett svar, inte ett strul", async () => {
    const f = vi.fn().mockImplementation(async () => svar(404));
    vi.stubGlobal("fetch", f);
    const r = await hamtaRatt("https://exempel.se/");
    expect(f).toHaveBeenCalledTimes(1);
    expect(r.logg.status).toBe(404);
  });

  it("nätverksfel görs om", async () => {
    const f = vi.fn()
      .mockRejectedValueOnce(new Error("socket hang up"))
      .mockResolvedValueOnce(svar(200));
    vi.stubGlobal("fetch", f);
    const r = await hamtaRatt("https://exempel.se/");
    expect(f).toHaveBeenCalledTimes(2);
    expect(r.logg.ok).toBe(true);
  });

  it("håller sig envist 500 bevaras statuskoden — felet får inte bytas mot något vagare", async () => {
    // Färsk Response per anrop: en kropp går bara att läsa en gång, och en återanvänd
    // Response gör andra försöket till ett nätverksfel i stället för en 500.
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => svar(500)));
    const r = await hamtaRatt("https://exempel.se/");
    expect(r.logg.status).toBe(500);
    expect(r.logg.fel).toContain("HTTP 500");
  });

  it("forsok: 1 stänger av omtaget", async () => {
    const f = vi.fn().mockImplementation(async () => svar(500));
    vi.stubGlobal("fetch", f);
    await hamtaRatt("https://exempel.se/", { forsok: 1 });
    expect(f).toHaveBeenCalledTimes(1);
  });
});

describe("S-6 · redirect-proben väntar aldrig", () => {
  it("proben kör med forsok: 1", () => {
    // Den VILL ha sin 3xx och ska aldrig göra om — ett omtag där hade bara lagt en halv
    // sekund per prob utan att kunna ändra svaret.
    expect(las("lib/seo-deep.ts")).toContain('redirect: "manual", timeoutMs: 8000, accepteraIckeOk: true, forsok: 1');
  });
});
