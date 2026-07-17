// FAS 6 — Playwright QA-svep. Loopar owner-dashboardens sidor + kundvyns sidor i
// desktop (1440) och mobil (390) och dumpar PNG:er till qa-screens/.
// Kör mot prod. Mintar admin-cookie ur ADMIN_SESSION_SECRET (.env.local) och läser
// en kund-token via service-role (.shared-keys.env). Inga hemligheter i repo.
//
// Kör:  node scripts/qa-screens.mjs
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import crypto from "node:crypto";

const BASE = process.env.QA_BASE || "https://cockpit.gripcoaching.se";
const HOST = new URL(BASE).hostname;
const SECURE = new URL(BASE).protocol === "https:";
const OUT = resolve(process.cwd(), "qa-screens");
mkdirSync(OUT, { recursive: true });

function readVar(file, name) {
  try {
    const t = readFileSync(resolve(process.cwd(), file), "utf8");
    return (t.match(new RegExp(`^\\s*${name}\\s*=\\s*(.+)\\s*$`, "m"))?.[1] || "").trim().replace(/^["']|["']$/g, "");
  } catch { return ""; }
}

// ── Minta admin-session (samma HMAC som lib/admin-auth.ts) ──
function b64url(buf) { return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function mintAdmin(secret) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const payload = String(exp);
  const sig = b64url(crypto.createHmac("sha256", secret).update(payload).digest());
  return `${payload}.${sig}`;
}

const ADMIN_SECRET = readVar(".env.local", "ADMIN_SESSION_SECRET");
const SERVICE = readVar("../.shared-keys.env", "SUPABASE_SERVICE_ROLE_KEY");
if (!ADMIN_SECRET || !SERVICE) { console.error("Saknar ADMIN_SESSION_SECRET eller SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }
const adminToken = mintAdmin(ADMIN_SECRET);

// Full-access kund (alla moduler) för kundvy-svepet.
const cRes = await fetch("https://liunepzrmygiaaibsbni.supabase.co/rest/v1/clients?slug=eq.engens-trad&select=customer_token,name", {
  headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
});
const custToken = (await cRes.json())[0]?.customer_token;

const DASH = [
  "/dashboard", "/dashboard/hq", "/dashboard/mysales-kunder", "/dashboard/profil", "/dashboard/brand-kit",
  "/dashboard/konkurrenter", "/dashboard/analysator", "/dashboard/innehall", "/dashboard/studio", "/dashboard/skapa",
  "/dashboard/studio/blogg", "/dashboard/studio/kalender", "/dashboard/linkedin", "/dashboard/mejl", "/dashboard/agents",
  "/dashboard/seo", "/dashboard/sidor", "/dashboard/blogg", "/dashboard/godkannande", "/dashboard/rapport",
  "/dashboard/paket", "/dashboard/kund-access", "/dashboard/ikigai", "/dashboard/setup", "/dashboard/specialister",
  "/dashboard/handbok", "/dashboard/installningar",
];
const KUND = ["/k", "/k/seo", "/k/besokare", "/k/profil", "/k/skapa", "/k/ideer", "/k/veckoplan", "/k/dm", "/k/ej-i-paket?m=linkedin"];
const VIEWPORTS = [{ tag: "desktop", w: 1440, h: 900 }, { tag: "mobil", w: 390, h: 844 }];

function slug(p) { return p.replace(/[/?=&]+/g, "_").replace(/^_|_$/g, "") || "root"; }

const browser = await chromium.launch();
let done = 0, failed = 0;

async function sweep(label, paths, cookie) {
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1 });
    await ctx.addCookies([{ name: cookie.name, value: cookie.value, domain: HOST, path: "/", httpOnly: true, secure: SECURE, sameSite: "Lax" }]);
    const page = await ctx.newPage();
    for (const p of paths) {
      const file = `${OUT}/${label}_${slug(p)}_${vp.tag}.png`;
      try {
        await page.goto(`${BASE}${p}`, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.addStyleTag({ content: "nextjs-portal{display:none !important}" }).catch(() => {}); // dölj dev-indikator
        await page.waitForTimeout(2500); // låt data/animationer sätta sig
        await page.screenshot({ path: file, fullPage: true });
        done++; console.log(`  ✅ ${label}_${slug(p)}_${vp.tag}.png`);
      } catch (e) {
        failed++; console.log(`  ❌ ${p} (${vp.tag}): ${(e.message || "").slice(0, 80)}`);
      }
    }
    await ctx.close();
  }
}

console.log(`\n── Owner-dashboard (${DASH.length} sidor × 2) ──`);
await sweep("dashboard", DASH, { name: "admin_session", value: adminToken });

if (custToken) {
  console.log(`\n── Kundvy (${KUND.length} sidor × 2) ──`);
  await sweep("kund", KUND, { name: "customer_token", value: custToken });
} else {
  console.log("\n⚠️ Ingen kund-token — hoppar kundvy-svepet.");
}

await browser.close();
console.log(`\n🟢 Klart: ${done} skärmbilder i qa-screens/${failed ? ` · ${failed} misslyckades` : ""}`);
