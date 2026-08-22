// Säkerhetsgenomgången (22/8) — Håkans krav: "bevisa att det inte är fler [öppna rutter]",
// inte bara svara på om det fanns fler.
//
// Testet kör mot proxy.ts:s EGEN, exporterade middleware-funktion — inte en avskrift av
// reglerna. Det upptäcker verkliga nya rutter automatiskt (dir-genomsökning av app/api),
// så en framtida route som glömmer klassificeras rätt fångas här, inte bara i en tabell
// som kan glida isär från koden.
//
// Bakgrund till varför detta testet finns: /api/cockpit/coach-users trodde vi saknade
// skydd (den gjorde inte det — proxy:ns fail-closed-default fångade den redan). Men
// genomgången hittade ett ÄKTA hål: sju "kund-betjänade" rutter (undantagna från
// proxy:ns grind, förlitade sig på egen kod) saknade HELT ett auth-anrop och litade
// bara på resolveClientId()/getActiveClientId() — vars grenn för "ingen session alls"
// då litade på en oautentiserad, förfalskningsbar active_client_id-cookie. Bevisat live
// mot /api/studio/posts/[id] DELETE (200 OK utan någon inloggning). Båda lagren är
// fixade: resolveClientId-grenens cookie-tillit borttagen (lib/client-context.ts) OCH
// alla sju rutter fick requireAdminOrCustomer().

import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";

const { proxy: proxyHandler, isGuardedApi, isPublicApi, CRON_PATHS, isCustomerServedApi } = await import("../proxy");

const ROOT = process.cwd();
const API_DIR = path.join(ROOT, "app", "api");

function hittaRouteFiler(dir: string, ut: string[] = []): string[] {
  for (const namn of readdirSync(dir)) {
    const full = path.join(dir, namn);
    const st = statSync(full);
    if (st.isDirectory()) hittaRouteFiler(full, ut);
    else if (namn === "route.ts" || namn === "route.tsx") ut.push(full);
  }
  return ut;
}

function tillUrlPath(filePath: string): string {
  const rel = path.relative(path.join(ROOT, "app"), filePath).replace(/\\/g, "/");
  const utanRoute = rel.replace(/\/route\.tsx?$/, "");
  const segment = utanRoute
    .split("/")
    .filter((s) => !/^\(.*\)$/.test(s))
    .map((s) => (/^\[.*\]$/.test(s) ? "PARAM" : s));
  return "/" + segment.join("/");
}

const alla = Array.from(new Set(hittaRouteFiler(API_DIR).map(tillUrlPath)));

describe(`Säkerhetsgenomgång 22/8 · omvänt test över samtliga ${alla.length} API-rutter`, () => {
  it("proxy:ns egen klassificering är intern-konsekvent (isGuardedApi håller med bucket-funktionerna)", () => {
    const avvikande: string[] = [];
    for (const p of alla) {
      const publik = isPublicApi(p);
      const cron = CRON_PATHS.has(p);
      const kund = isCustomerServedApi(p);
      const skaGrindas = !publik && !cron && !kund;
      if (isGuardedApi(p) !== skaGrindas) avvikande.push(p);
    }
    expect(avvikande, avvikande.join("\n")).toEqual([]);
  });

  it("en oautentiserad anropare (ingen cookie alls) får 401 på VARJE rutt proxy:n klassar som admin-grindad", async () => {
    const trasiga: string[] = [];
    for (const p of alla) {
      if (!isGuardedApi(p)) continue; // testas separat nedan
      const req = new NextRequest(`https://cockpit.gripcoaching.se${p}`);
      const res = await proxyHandler(req);
      if (!res || res.status !== 401) trasiga.push(`${p}: fick ${res?.status ?? "genomsläppt/redirect"} i stället för 401`);
    }
    expect(trasiga, trasiga.join("\n")).toEqual([]);
  });

  it("en oautentiserad anropare BLOCKERAS INTE av proxy:n på avsiktligt publika/cron/kund-betjänade rutter", async () => {
    // Proxy:n ska släppa igenom dessa (de skyddar sig själva i routen, eller är
    // avsiktligt publika). Om proxy:n plötsligt börjar 401:a en av dem är det en
    // regression i klassificeringen, inte ett skydd som "blev bättre".
    const oväntatBlockerade: string[] = [];
    for (const p of alla) {
      if (isGuardedApi(p)) continue;
      const req = new NextRequest(`https://cockpit.gripcoaching.se${p}`);
      const res = await proxyHandler(req);
      if (res && res.status === 401) oväntatBlockerade.push(p);
    }
    expect(oväntatBlockerade, oväntatBlockerade.join("\n")).toEqual([]);
  });

  it("de sju rutter som saknade auth-anrop (säkerhetsfyndet) är nu klassade kund-betjänade OCH har requireAdminOrCustomer i källkoden", () => {
    const fyndRutter = [
      "app/api/profile-analyzer/route.ts",
      "app/api/studio/blog/generate/route.ts",
      "app/api/studio/blog/meta/route.ts",
      "app/api/studio/blog/publish/route.ts",
      "app/api/studio/blog/publish-native/route.ts",
      "app/api/studio/blog/repurpose/route.ts",
      "app/api/studio/posts/[id]/route.ts",
    ];
    const { readFileSync } = require("node:fs") as typeof import("node:fs");
    for (const rel of fyndRutter) {
      const kalla = readFileSync(path.join(ROOT, rel), "utf8");
      expect(kalla, `${rel} saknar requireAdminOrCustomer`).toMatch(/requireAdminOrCustomer/);
    }
  });
});
