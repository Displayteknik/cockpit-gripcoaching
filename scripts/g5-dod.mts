// G-5 DoD — CTA-motorn, skarpt.
//
// Enhetstesterna bevisar att promptblocket säger rätt sak och att grinden klassar rätt
// på handskrivna exempel. De bevisar INTE det som spelar roll: att RIKTIGA genereringar
// slutar med en uppmaning som leder någonstans.
//
// ⚠ VARFÖR .mts OCH INTE .mjs: första versionen var .mjs och kunde inte importera
// writing-rules (TypeScript). Den hoppade då över hela mätningen och rapporterade ändå
// "ALLA KONTROLLER GRÖNA" — ett ihåligt grönt av exakt den sort granskningsserien finns
// för att hitta. Klassningen IMPORTERAS nu från produktionskoden i stället för att
// skrivas av: en kopia av regeln hade kunnat glida isär med koden och ge falskt godkänt.
//
// ⚠ Skriptet SPARAR ingenting i kundkonton (G-3d-läxan).
//
//   npx tsx --tsconfig scripts/text1/tsconfig.json scripts/g5-dod.mts

import { readFileSync } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
for (const line of readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}

import { harCtaISlutet, harCtaVag } from "../lib/content/writing-rules";
import { anatomiBlock } from "../lib/prompt-core";

const BASE = process.env.G1_BASE || "http://localhost:3480";
const PROJEKT = "liunepzrmygiaaibsbni";

function readVar(fil: string, namn: string): string {
  try {
    const t = readFileSync(path.resolve(ROOT, fil), "utf8");
    return (t.match(new RegExp(`^\\s*${namn}\\s*=\\s*(.+)\\s*$`, "m"))?.[1] || "").trim().replace(/^["']|["']$/g, "");
  } catch { return ""; }
}
const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const SECRET = process.env.ADMIN_SESSION_SECRET || "";
const PAT = process.env.SUPABASE_ACCESS_TOKEN || readVar("../.shared-keys.env", "SUPABASE_ACCESS_TOKEN");
if (!SECRET || !PAT) { console.error("Saknar ADMIN_SESSION_SECRET eller SUPABASE_ACCESS_TOKEN"); process.exit(1); }
const exp = Math.floor(Date.now() / 1000) + 3600;
const ADMIN = `admin_session=${exp}.${b64url(crypto.createHmac("sha256", SECRET).update(String(exp)).digest())}`;

async function fraga(sql: string, forsok = 3): Promise<Record<string, unknown>[]> {
  for (let i = 1; i <= forsok; i++) {
    const r = await fetch(`https://api.supabase.com/v1/projects/${PROJEKT}/database/query`, {
      method: "POST", headers: { Authorization: `Bearer ${PAT}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: sql }),
    });
    const t = await r.text();
    if (r.ok) return JSON.parse(t);
    if (i === forsok || (r.status < 500 && r.status !== 429)) throw new Error(`Management API ${r.status}: ${t.slice(0, 200)}`);
    await new Promise((k) => setTimeout(k, 2000 * i));
  }
  return [];
}
const post = async (vag: string, kropp: unknown, tenant: string) => {
  const r = await fetch(`${BASE}${vag}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: `${ADMIN}; active_client_id=${tenant}` },
    body: JSON.stringify(kropp),
  });
  return { ok: r.ok, status: r.status, data: (await r.json().catch(() => ({}))) as Record<string, unknown> };
};

let fel = 0;
const kolla = (ok: boolean, t: string) => { console.log(`${ok ? "OK  " : "FEL "} ${t}`); if (!ok) fel++; };
const notera = (t: string) => console.log(`--  ${t}`);

const STAMPEL = `G5 ${new Date().toISOString().slice(0, 16)}`;
console.log(`# G-5 DoD — CTA-motorn — ${BASE}\n`);

// ── 1. Promptsidan: typkravet överlever mjukningen ─────────────────────────
console.log("## 1. Typkravet i den byggda anatomin");
{
  const mjuk = anatomiBlock("full", undefined, "tofu");
  kolla(mjuk.includes("HÅRD REGEL (CTA-TYP)"), "Mjuka grenen (förvald funnel) bär typkravet");
  kolla(
    mjuk.indexOf("HÅRD REGEL (CTA-TYP)") > mjuk.indexOf("förvald"),
    "Typkravet ligger EFTER mjukningen — sist väger tyngst",
  );
  kolla(!mjuk.includes("väg in den bara om inget annat framgår av ämnet"), "Den gamla lydelsen som mjukade upp typen är borta");
  kolla(anatomiBlock("full").includes("HÅRD REGEL (CTA-TYP)"), "Grenen helt utan funnel bär det också");
  kolla(!anatomiBlock("pa-bild").includes("HÅRD REGEL (CTA-TYP)"), "Text på bild får det ALDRIG (den ska sakna CTA)");
}

// ── 2. Skarp mätning: leder avsluten någonstans? ───────────────────────────
console.log("\n## 2. Skarp mätning — leder avsluten någonstans?");
// TVA tenants: generalitetsregeln. En CTA-grind som bara fungerar for en bransch ar
// ingen plattformsregel. Olika branscher lockar fram olika avslut.
const tenants = (await fraga(`
  select c.id, c.name from public.clients c
  join public.hm_brand_profile p on p.client_id = c.id
  where coalesce(trim(p.usp),'') <> '' order by length(p.usp) desc limit 2;
`)) as { id: string; name: string }[];
kolla(tenants.length === 2, `Tenants: ${tenants.map((t) => t.name).join(", ") || "INGA"}`);

for (const T of tenants) {
  console.log(`  -- ${T.name}`);
  const AMNEN = [
    "varför skyltar bleknar i solen",
    "vad kunder brukar ångra i efterhand",
    "så väljer du rätt material",
    "en vanlig missuppfattning i branschen",
    "det här får vi flest frågor om",
    "så går ett jobb till hos oss",
  ];
  let medCta = 0;
  const typlosa: string[] = [];
  let körda = 0;

  for (const amne of AMNEN) {
    const r = await post("/api/studio/suggest-caption", { topic: `${STAMPEL}: ${amne}`, postType: "post" }, T.id);
    const text = String(r.data?.caption ?? (r.data?.captions as string[] | undefined)?.[0] ?? "").trim();
    if (!text) { notera(`"${amne}" gav ingen text (HTTP ${r.status})`); continue; }
    körda++;
    const cta = harCtaISlutet(text);
    const vag = harCtaVag(text);
    if (cta) medCta++;
    const sista = text.split("\n").filter((rad) => rad.trim() && !rad.trim().startsWith("#")).pop() || "";
    console.log(`     ${cta ? (vag ? "VÄG   " : "TYPLÖS") : "INGEN "} "${sista.slice(0, 88)}"`);
    if (cta && !vag) typlosa.push(sista);
  }

  // Mätningen måste faktiskt ha körts. Utan den här raden kan skriptet rapportera
  // grönt på noll genereringar — samma ihåliga grönt som .mjs-versionen gav.
  kolla(körda === AMNEN.length, `${körda} av ${AMNEN.length} genereringar gav text`);
  kolla(medCta === körda, `${medCta} av ${körda} slutar med en uppmaning (CTA-golvet)`);
  // G-5:s egna mått: grinden i sakerstallCaption omgenererar vid typlöst avslut, så en
  // typlös text som ändå tar sig hit har överlevt både promptregeln och grinden.
  kolla(typlosa.length === 0, `Typlösa avslut kvar efter prompt + grind: ${typlosa.length}`);
  for (const t of typlosa) console.log(`     KVAR TYPLÖS: "${t}"`);
}

// ── 3. BOFU smyger inte in ─────────────────────────────────────────────────
console.log("\n## 3. BOFU är fortfarande aldrig default (Håkans beslut 31/7)");
const funnelrader = await fraga(`
  select funnel, count(*)::int n from public.generation_log
  where created_at > now() - interval '1 hour' group by 1 order by n desc;
`) as { funnel: string | null; n: number }[];
for (const r of funnelrader) console.log(`     ${String(r.funnel ?? "null").padEnd(6)} ${r.n}`);
const bofu = funnelrader.find((r) => r.funnel === "bofu");
kolla(!bofu, `Ingen generering i senaste timmen fick funnel=bofu${bofu ? ` (${bofu.n} st!)` : ""}`);

// ── 4. Känd lucka som medvetet INTE byggs ──────────────────────────────────
console.log("\n## 4. Känd lucka (noteras, byggs inte — Håkans beslut)");
notera("Nyckelords-CTA:n i BOFU_CTA_MALL har ingen mottagarsida: /api/lobby/* kan inte");
notera("registrera en kommentator som lead. Hanterbart eftersom bofu aldrig är default.");
notera("Slås bofu på brett måste mottagarsidan byggas FÖRE — annars lovar texten en väg");
notera("in som inte finns. Kommentar ligger vid BOFU_CTA_MALL i content-compass/prompt.ts.");

console.log(`\n${fel === 0 ? "ALLA KONTROLLER GRÖNA" : `${fel} KONTROLL(ER) RÖDA`}`);
process.exit(fel === 0 ? 0 : 1);
