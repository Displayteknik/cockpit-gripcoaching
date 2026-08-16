// MARKETPLACE-1 / MP-1 — bevisar tokenkedjan för den privata GHL-appen.
//
// Körs EFTER att appen installerats på byrån (annars finns inget byråtoken sparat).
//   npx tsx scripts/mp1-bevisa.mts
//
// Skriptet är läsande. Enda skrivningen är tokens till `ghl_app_tokens`, vilket är
// hela poängen. Inget rörs i något kundkonto.
//
// ★ INGA HEMLIGHETER SKRIVS UT. Tokens visas som längd, aldrig som värde.

import { readFileSync } from "node:fs";
import path from "node:path";
import { ghlAppKonfig, byraToken, locationToken, installeradeLocations } from "../lib/ghl-app";
import { supabaseService } from "../lib/supabase-admin";

// ⚠ Importerna ligger statiskt och extensionslöst med flit, trots att env laddas nedanför.
//
//   - Extensionslöst: den committade `tsconfig.json` har INTE
//     `allowImportingTsExtensions`, så `../lib/ghl-app.ts` bygger inte. Att det ändå
//     typkollade lokalt berodde på en ostagad ändring i arbetskopian som exkluderar
//     `scripts/`. Se [[lesson-tsc-lokalt-racker-inte]].
//   - Statiskt: ESM kör importerna före koden nedan, men varken `ghl-app` eller
//     `supabase-admin` läser process.env i modulskopet — bara inuti funktioner. Env
//     hinner därför laddas före första anropet.
const ROOT = process.cwd();
for (const line of readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}

const BAS = "https://services.leadconnectorhq.com";
const MALL = (process.env.GHL_MALL_LOCATION_ID || "").trim();
const APP_ID = (process.env.GHL_APP_ID || "").trim();

/** De 17 scopes appen begärdes med. Facit för mätning 2. */
const BEGARDA = [
  "oauth.write", "oauth.readonly",
  "locations.write", "locations.readonly",
  "snapshots.readonly", "snapshots.write",
  "locations/customValues.write", "locations/customValues.readonly",
  "locations/customFields.write", "locations/customFields.readonly",
  "locations/tags.write", "locations/tags.readonly",
  "workflows.readonly",
  "opportunities.write", "opportunities.readonly",
  "contacts.readonly", "contacts.write",
];

let fel = 0;
function ok(rubrik: string, text: string) { console.log(`  OK    ${rubrik}: ${text}`); }
function nej(rubrik: string, text: string) { fel++; console.log(`  FEL   ${rubrik}: ${text}`); }
function info(text: string) { console.log(`        ${text}`); }

// ── 1. Konfiguration ────────────────────────────────────────────────────────────────
console.log("\n1. Konfiguration");
const k = ghlAppKonfig();
if (!k) { nej("env", "GHL_APP_CLIENT_ID / GHL_APP_CLIENT_SECRET / GHL_COMPANY_ID saknas"); process.exit(1); }
ok("env", `client_id ${k.clientId.length} tecken, secret ${k.clientSecret.length} tecken, company ${k.companyId}`);
if (!MALL) nej("mall", "GHL_MALL_LOCATION_ID saknas — mätning 4 och 5 kan inte köras");
if (!APP_ID) info("GHL_APP_ID saknas — mätning 3 hoppas över");

// ── 2. Byråtoken och FAKTISKA scopes ────────────────────────────────────────────────
console.log("\n2. Byråtoken och scopes (mätningen MP-0 inte kunde göra)");
let byra = "";
try {
  byra = await byraToken();
  ok("byråtoken", `giltigt, ${byra.length} tecken`);
} catch (e) {
  nej("byråtoken", (e as Error).message);
  console.log("\nAppen är troligen inte installerad än. Kör om efter installationen.\n");
  process.exit(1);
}

const sb = supabaseService();
const { data: rad } = await sb.from("ghl_app_tokens").select("scopes, expires_at")
  .eq("id", `company:${k.companyId}`).maybeSingle();
const fick = String((rad as { scopes?: string } | null)?.scopes ?? "").split(/\s+/).filter(Boolean);
if (!fick.length) {
  nej("scopes", "GHL returnerade inget scope-fält — går inte att verifiera");
} else {
  const saknas = BEGARDA.filter((s) => !fick.includes(s));
  const extra = fick.filter((s) => !BEGARDA.includes(s));
  if (saknas.length) nej("scopes", `${fick.length} av ${BEGARDA.length}. SAKNAS: ${saknas.join(", ")}`);
  else ok("scopes", `alla ${BEGARDA.length} beviljade`);
  if (extra.length) info(`GHL gav dessutom: ${extra.join(", ")}`);
  for (const kritisk of ["oauth.write", "snapshots.readonly"]) {
    if (fick.includes(kritisk)) ok(kritisk, "beviljat — taket från Private Integrations är borta");
    else nej(kritisk, "INTE beviljat — hela bygget står på detta");
  }
}

// ── 3. Installerade underkonton ─────────────────────────────────────────────────────
console.log("\n3. Installerade underkonton (oauth.readonly)");
if (APP_ID) {
  try {
    const l = await installeradeLocations(APP_ID);
    ok("installedLocations", `${l.length} underkonto(n)`);
    for (const x of l.slice(0, 10)) info(`${x._id}${x.name ? ` — ${x.name}` : ""}`);
    if (MALL) {
      if (l.some((x) => x._id === MALL)) ok("mallen", "appen sitter på MALL MySales Pro");
      else nej("mallen", `MALL ${MALL} finns INTE bland de installerade — växlingen nedan lär ge 401`);
    }
  } catch (e) { nej("installedLocations", (e as Error).message); }
}

// ── 4. Tokenväxlingen — den bärande mätningen ───────────────────────────────────────
console.log("\n4. POST /oauth/locationToken mot MALL MySales Pro");
let mallToken = "";
if (MALL) {
  // Rått anrop först, enbart för att se svarets FORM. Den gamla koden läste `accessToken`,
  // dokumentationen anger `access_token`, och båda kan inte ha varit rätt.
  try {
    const r = await fetch(`${BAS}/oauth/locationToken`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${byra}`,
        Version: "2021-07-28",
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ companyId: k.companyId, locationId: MALL }).toString(),
    });
    const rå = await r.text();
    if (!r.ok) {
      nej("locationToken", `HTTP ${r.status}: ${rå.slice(0, 300)}`);
    } else {
      const j = JSON.parse(rå) as Record<string, unknown>;
      ok("locationToken", `HTTP 200. Fält i svaret: ${Object.keys(j).join(", ")}`);
      info(`stavning: access_token=${"access_token" in j ? "JA" : "nej"}  accessToken=${"accessToken" in j ? "JA" : "nej"}`);
      info(`userType=${String(j.userType)}  locationId=${String(j.locationId)}`);
    }
  } catch (e) { nej("locationToken (rått)", (e as Error).message); }

  try {
    mallToken = await locationToken(MALL, true);
    ok("lib/ghl-app", `location-token sparat, ${mallToken.length} tecken`);
  } catch (e) { nej("lib/ghl-app", (e as Error).message); }
}

// ── 5. Kundscopen genom den nya nyckeln ─────────────────────────────────────────────
console.log("\n5. Läsning i underkontot med location-token (det byråtoken aldrig fick göra)");
if (mallToken) {
  for (const [namn, vag] of [
    ["customValues", `/locations/${MALL}/customValues`],
    ["tags", `/locations/${MALL}/tags`],
    ["customFields", `/locations/${MALL}/customFields`],
  ] as const) {
    try {
      const r = await fetch(`${BAS}${vag}`, {
        headers: { Authorization: `Bearer ${mallToken}`, Version: "2021-07-28", Accept: "application/json" },
      });
      const rå = await r.text();
      if (!r.ok) { nej(namn, `HTTP ${r.status}: ${rå.slice(0, 200)}`); continue; }
      const j = JSON.parse(rå || "{}") as Record<string, unknown[]>;
      const nyckel = Object.keys(j).find((x) => Array.isArray(j[x]));
      ok(namn, `${nyckel ? j[nyckel].length : 0} poster`);
    } catch (e) { nej(namn, (e as Error).message); }
  }
}

// ── 6. Snapshots — 401:an från 7/8 ──────────────────────────────────────────────────
console.log("\n6. GET /snapshots/ med appens byråtoken (gav 401 med Private Integration)");
try {
  const r = await fetch(`${BAS}/snapshots/?companyId=${encodeURIComponent(k.companyId)}`, {
    headers: { Authorization: `Bearer ${byra}`, Version: "2021-07-28", Accept: "application/json" },
  });
  const rå = await r.text();
  if (!r.ok) nej("snapshots", `HTTP ${r.status}: ${rå.slice(0, 200)} (blockerar inte MP-2 — skapande via snapshotId fungerar ändå)`);
  else {
    const j = JSON.parse(rå || "{}") as { snapshots?: { id: string; name: string }[] };
    ok("snapshots", `${j.snapshots?.length ?? 0} snapshots listade`);
    const mål = (process.env.GHL_SNAPSHOT_ID || "").trim();
    if (mål) {
      const träff = j.snapshots?.find((s) => s.id === mål);
      if (träff) ok("snapshot-id", `${mål} = "${träff.name}"`);
      else nej("snapshot-id", `${mål} finns inte i listan — kontrollera GHL_SNAPSHOT_ID`);
    }
  }
} catch (e) { nej("snapshots", (e as Error).message); }

console.log(fel === 0 ? "\nAllt gick igenom.\n" : `\n${fel} mätning(ar) misslyckades.\n`);
process.exit(fel === 0 ? 0 : 1);
