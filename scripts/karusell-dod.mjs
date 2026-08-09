// AKUT-KARUSELL — DoD: 7 slides i Studio ska ge 7 NEDLADDADE filer, namngivna -1av7 … -7av7.
//
// Bakgrund: publiceringskedjan är testad (tests/akut-karusell.test.ts, 15 tester), men
// själva NEDLADDNINGEN hade aldrig körts. Enhetstestet bevisar fångstloopen och
// filnamnsregeln — det bevisar INTE att webbläsaren faktiskt skriver sju filer till disk.
// Sju synkrona a.click() på blob-URL:er som revokas direkt efteråt är precis den sortens
// mekanik som kan tappa filer utan att koden märker något.
//
// Kör:  node scripts/karusell-dod.mjs
// Env:  KARUSELL_BASE (default https://cockpit.gripcoaching.se), KARUSELL_UT (utmapp)
//
// Mintar admin-cookie ur ADMIN_SESSION_SECRET i .env.local — samma mönster som
// scripts/qa-screens.mjs. Inga hemligheter lämnar maskinen, inget skrivs i databasen:
// exporten är ren klient-render + nedladdning.
import { chromium } from "playwright";
import { readFileSync, mkdirSync, readdirSync, statSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import crypto from "node:crypto";

const BASE = process.env.KARUSELL_BASE || "https://cockpit.gripcoaching.se";
const HOST = new URL(BASE).hostname;
const SECURE = new URL(BASE).protocol === "https:";
const OUT = resolve(process.cwd(), process.env.KARUSELL_UT || "karusell-dod");
const ANTAL = 7;

function readVar(file, name) {
  try {
    const t = readFileSync(resolve(process.cwd(), file), "utf8");
    return (t.match(new RegExp(`^\\s*${name}\\s*=\\s*(.+)\\s*$`, "m"))?.[1] || "").trim().replace(/^["']|["']$/g, "");
  } catch { return ""; }
}

// Samma HMAC som lib/admin-auth.ts — en riktig session, inte en förbikoppling av grinden.
function b64url(buf) { return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function mintAdmin(secret) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const sig = b64url(crypto.createHmac("sha256", secret).update(String(exp)).digest());
  return `${exp}.${sig}`;
}

// Live har en EGEN ADMIN_SESSION_SECRET (Vercel) — den i .env.local duger bara mot localhost.
// Kör mot live med: ADMIN_SESSION_SECRET=<prod-hemligheten> node scripts/karusell-dod.mjs
const SECRET = process.env.ADMIN_SESSION_SECRET || readVar(".env.local", "ADMIN_SESSION_SECRET");
if (!SECRET) { console.error("Saknar ADMIN_SESSION_SECRET (env eller .env.local)"); process.exit(1); }

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const rader = [];
const logg = (s) => { rader.push(s); console.log(s); };
let fel = 0;
function kolla(ok, text) {
  logg(`${ok ? "OK  " : "FEL "} ${text}`);
  if (!ok) fel++;
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
await ctx.addCookies([{ name: "admin_session", value: mintAdmin(SECRET), domain: HOST, path: "/", httpOnly: true, secure: SECURE, sameSite: "Lax" }]);
const page = await ctx.newPage();

// Varje nedladdning fångas när den STARTAR; filen sparas och mäts efteråt.
const nedladdningar = [];
page.on("download", (d) => {
  nedladdningar.push(
    d.saveAs(resolve(OUT, d.suggestedFilename()))
      .then(() => ({ namn: d.suggestedFilename(), ok: true }))
      .catch((e) => ({ namn: d.suggestedFilename(), ok: false, fel: String(e.message || e) })),
  );
});

try {
  logg(`# AKUT-KARUSELL DoD — ${BASE}/dashboard/studio`);

  // Vänta in den aktiva klienten INNAN något klickas. Filnamnet börjar med klientens slug,
  // och den sätts av en fetch som tystnar vid fel — klickar man för tidigt får filerna
  // heta "-ark-karusell-…" utan att något syns i gränssnittet.
  const klientSvar = page.waitForResponse((r) => r.url().includes("/api/clients/active"), { timeout: 60000 });
  await page.goto(`${BASE}/dashboard/studio`, { waitUntil: "domcontentloaded", timeout: 60000 });
  const klient = await klientSvar.then((r) => r.json()).catch(() => null);
  kolla(!!klient?.slug, `Aktiv klient: ${klient?.name || "OKÄND"} (slug ${klient?.slug || "SAKNAS"})`);

  await page.getByRole("button", { name: /Mallar & guide/ }).first().click({ timeout: 30000 });
  await page.getByRole("button", { name: /^Karusell/ }).first().click({ timeout: 30000 });

  // Karusell-mallen seedar krok + 3 punkter + avslut = 5 slides.
  await page.getByText(/^5 slides · exporteras som 5 bilder/).waitFor({ timeout: 20000 });
  logg("Karusell-mallen vald, 5 slides seedade.");

  const plus = page.getByRole("button", { name: "+ Slide" });
  await plus.click();
  await page.getByText(/^6 slides/).waitFor({ timeout: 10000 });
  await plus.click();
  await page.getByText(/^7 slides · exporteras som 7 bilder/).waitFor({ timeout: 10000 });
  kolla(true, "Gränssnittet säger: 7 slides · exporteras som 7 bilder");

  // Egen rubrik per slide → de sju PNG:erna MÅSTE bli olika. Utan det skulle sju kopior
  // av samma bild räknas som godkänt, och just "alla blev slide 1" var ursprungsfelet.
  // Flikraden är den som bär "+ Slide" — steg 4 har en egen slide-lista som inte får träffas.
  const flikRad = plus.locator("xpath=..");
  const rubrikFalt = page.locator('xpath=//label[normalize-space()="Rubrik"]/following::input[1]');
  for (let i = 0; i < ANTAL; i++) {
    await flikRad.getByRole("button").nth(i).click();
    await rubrikFalt.fill(`DOD SLIDE ${i + 1} AV ${ANTAL}`);
  }
  logg("Sju slides har var sin unika rubrik.");

  const fore = Date.now();
  await page.getByRole("button", { name: /Ladda ner bilden/ }).click({ timeout: 15000 });

  // Fångsten är sekventiell (150 ms + toBlob per slide) → ge den gott om tid, och vänta
  // sedan tills det slutat komma nya filer innan räkningen görs.
  let sett = 0;
  for (let i = 0; i < 120; i++) {
    await page.waitForTimeout(1000);
    if (nedladdningar.length === sett && sett >= ANTAL) break;
    sett = nedladdningar.length;
  }
  const resultat = await Promise.all(nedladdningar);
  logg(`Exporten tog ${Math.round((Date.now() - fore) / 1000)} s.`);

  const felruta = await page.locator("text=/kunde inte skapas|Kunde inte skapa/").first().textContent().catch(() => null);
  kolla(!felruta, felruta ? `Studio visade fel: ${felruta}` : "Studio visade inget fel");

  // ── Räkningen ──
  const filer = readdirSync(OUT).sort();
  kolla(resultat.length === ANTAL, `Webbläsaren startade ${resultat.length} nedladdningar (väntat ${ANTAL})`);
  const trasiga = resultat.filter((r) => !r.ok);
  kolla(trasiga.length === 0, `Alla nedladdningar slutfördes${trasiga.length ? ` — misslyckades: ${trasiga.map((t) => `${t.namn}: ${t.fel}`).join("; ")}` : ""}`);
  kolla(filer.length === ANTAL, `${filer.length} filer på disk (väntat ${ANTAL}): ${filer.join(", ")}`);

  // Namnen ska bära ordningen: -1av7 … -7av7, och börja med klientens slug.
  for (let i = 1; i <= ANTAL; i++) {
    const vantat = `${klient?.slug || ""}-ark-karusell-1080x1350-${i}av${ANTAL}.png`;
    kolla(filer.includes(vantat), `Filen ${vantat} finns`);
  }

  // Varje fil ska vara en riktig, icke-tom PNG — och de sju ska vara OLIKA.
  const hashar = new Map();
  for (const f of filer) {
    const p = resolve(OUT, f);
    const bytes = readFileSync(p);
    const arPng = bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    kolla(arPng && statSync(p).size > 5000, `${f}: ${arPng ? "PNG" : "EJ PNG"}, ${statSync(p).size} byte`);
    hashar.set(f, crypto.createHash("sha256").update(bytes).digest("hex").slice(0, 12));
  }
  kolla(new Set(hashar.values()).size === filer.length, `Alla ${filer.length} bilderna är olika (${[...hashar.values()].join(" ")})`);
} catch (e) {
  fel++;
  logg(`FEL  Körningen avbröts: ${e.message || e}`);
  await page.screenshot({ path: resolve(OUT, "avbrott.png"), fullPage: false }).catch(() => {});
} finally {
  await browser.close();
}

logg(fel === 0 ? `\nDoD GRÖN — ${ANTAL} slides gav ${ANTAL} filer.` : `\nDoD RÖD — ${fel} kontroll(er) föll.`);
process.exit(fel === 0 ? 0 : 1);
