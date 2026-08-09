// G-3d DoD — rotationen över tid, skarpt.
//
// VARFÖR SKRIPTET FINNS: enhetstesterna bevisar att hamtaNyligen plockar rätt fält ur en
// mockad rad. De bevisar INTE att en riktig generering fick undvik-listan. Och just det
// felet — lagret finns men listan är tom, så allt SER inkopplat ut — är exakt vad G-0
// hittade hos rotationsregeln från början.
//
// MÄTPUNKTEN: prompt-core sätter `lager.nyligen = true` ENDAST när listan har innehåll,
// och G-1 skriver hela lager-objektet till generation_log. Ett `lager->>'nyligen'` på en
// färsk rad är ett kvitto som inte går att skriva av misstag.
//
// UPPLÄGGET ÄR ETT FÖRE/EFTER, inte en observation. Att bara titta på en tenant som redan
// har historik bevisar inte att det är HISTORIKEN som slår på lagret — det kunde vara
// vad som helst. Därför: kör mot en tenant med TOM historik (lagret ska vara AV), spara
// ETT inlägg, kör igen (lagret ska vara PÅ). Samma kod, samma tenant, enda skillnaden är
// raden vi själva lade in. Sedan en andra tenant för generaliteten.
//
// ⚠ SKRIPTET SKRIVER I RIKTIGA KUNDKONTON. Bevisningen kräver att en historikrad
// faktiskt finns, och den enda ärliga vägen dit är samma spara-endpoint kunden använder.
// Därför städas varje sådd rad bort i slutet (STAMPEL-prefixet), och städningen körs
// även när en kontroll faller. Första versionen av skriptet gjorde det inte och lämnade
// två testinlägg i AluCons och Annas Blommors Studio — kundsynligt skräp ur ett
// granskningsverktyg är precis det granskningen ska hitta, inte skapa.
//
// Kör:  node scripts/g3d-dod.mjs        (kräver dev-servern igång)

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import crypto from "node:crypto";

const BASE = process.env.G1_BASE || "http://localhost:3480";
const PROJEKT = "liunepzrmygiaaibsbni";

function readVar(fil, namn) {
  try {
    const t = readFileSync(resolve(process.cwd(), fil), "utf8");
    return (t.match(new RegExp(`^\\s*${namn}\\s*=\\s*(.+)\\s*$`, "m"))?.[1] || "").trim().replace(/^["']|["']$/g, "");
  } catch { return ""; }
}
const b64url = (b) => Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const SECRET = readVar(".env.local", "ADMIN_SESSION_SECRET");
const PAT = process.env.SUPABASE_ACCESS_TOKEN || readVar("../.shared-keys.env", "SUPABASE_ACCESS_TOKEN");
if (!SECRET || !PAT) { console.error("Saknar ADMIN_SESSION_SECRET eller SUPABASE_ACCESS_TOKEN"); process.exit(1); }
const exp = Math.floor(Date.now() / 1000) + 3600;
const ADMIN = `admin_session=${exp}.${b64url(crypto.createHmac("sha256", SECRET).update(String(exp)).digest())}`;

async function fraga(sql, forsok = 3) {
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
}
// active_client_id-cookien styr vilken tenant dev-servern kör som (server-only, sätts
// annars av klientväljaren i /dashboard). Utan den mäter skriptet standardklienten och
// säger något om fel kund — precis det som gjorde första körningen missvisande.
const post = async (vag, kropp, tenant) => {
  const r = await fetch(`${BASE}${vag}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: `${ADMIN}; active_client_id=${tenant}` },
    body: JSON.stringify(kropp),
  });
  return { ok: r.ok, status: r.status, data: await r.json().catch(() => ({})) };
};

let fel = 0;
const kolla = (ok, t) => { console.log(`${ok ? "OK  " : "FEL "} ${t}`); if (!ok) fel++; };
const notera = (t) => console.log(`--  ${t}`);
const vila = (ms) => new Promise((k) => setTimeout(k, ms));

const STAMPEL = `G3d ${new Date().toISOString().slice(0, 16)}`;
console.log(`# G-3d DoD — rotationen över tid — ${BASE}\n`);

/** Senaste generationsraden för tenant+syfte. Loggningen sker efter svaret, i samma request. */
async function sisteRad(tenant, syfte) {
  await vila(2500);
  return (await fraga(`
    select id, prompt_version, lager->>'nyligen' as nyligen
    from public.generation_log
    where syfte = '${syfte}' and tenant_id = '${tenant}'
    order by created_at desc limit 1;
  `))[0];
}

/** Sparar ett affischinlägg så tenanten FÅR en historik att rotera mot. */
async function sparaAffisch(tenant, rubrik) {
  return post("/api/studio/posts", {
    title: rubrik,
    payload: { templateId: "ark-textkort", format: "1080x1350", headline1: rubrik, headline2: "", body: "" },
  }, tenant);
}

// ── 1. FÖRE/EFTER på en tenant med tom historik ──────────────────────────────
console.log("## 1. Före/efter — slår historiken PÅ rotationslagret?");
const TOM = (await fraga(`
  select c.id, c.name,
    (select count(*) from public.studio_posts p
      where p.client_id = c.id and coalesce(p.payload->>'headline1','') <> '') as n
  from public.clients c order by n asc, c.name limit 1;
`))[0];
kolla(!!TOM && Number(TOM.n) === 0, `Tenant utan affischhistorik: ${TOM?.name} (${TOM?.n} rader)`);

if (TOM && Number(TOM.n) === 0) {
  const f = await post("/api/studio/suggest-text", { templateId: "ark-textkort", format: "1080x1350", topic: `${STAMPEL} före` }, TOM.id);
  kolla(f.ok, `FÖRE: generering HTTP ${f.status}`);
  const radFore = await sisteRad(TOM.id, "studio-text");
  // Ingen historik → inget att undvika → lagret ska vara AV. Vore det PÅ här hade
  // undvik-listan innehållit något som inte är tenantens egen historik.
  kolla(radFore && radFore.nyligen !== "true", `FÖRE: lager.nyligen = ${radFore?.nyligen ?? "saknas"} (tom historik → ska vara av)`);

  const s = await sparaAffisch(TOM.id, `${STAMPEL} rubriken som ska undvikas`);
  kolla(s.ok, `Sparade ETT inlägg som historik: HTTP ${s.status}`);

  const e = await post("/api/studio/suggest-text", { templateId: "ark-textkort", format: "1080x1350", topic: `${STAMPEL} efter` }, TOM.id);
  kolla(e.ok, `EFTER: generering HTTP ${e.status}`);
  const radEfter = await sisteRad(TOM.id, "studio-text");
  // Detta är hela beviset: samma kod, samma tenant, enda skillnaden är raden vi lade in.
  kolla(radEfter?.nyligen === "true", `EFTER: lager.nyligen = ${radEfter?.nyligen ?? "saknas"} (historik finns → ska vara på)`);
  kolla(radFore?.id !== radEfter?.id, `Två skilda generationsrader jämfördes (${String(radFore?.id).slice(0, 8)} → ${String(radEfter?.id).slice(0, 8)})`);
}

// ── 2. Generalitet: en andra tenant, som redan har historik ──────────────────
console.log("\n## 2. Generalitet — en andra tenant, med befintlig historik");
const HIST = (await fraga(`
  select c.id, c.name,
    (select count(*) from public.studio_posts p
      where p.client_id = c.id and coalesce(p.payload->>'headline1','') <> '') as n
  from public.clients c
  where c.id <> '${TOM?.id ?? "00000000-0000-0000-0000-000000000000"}'
  order by n desc limit 1;
`))[0];
kolla(!!HIST && Number(HIST.n) > 0, `Tenant med affischhistorik: ${HIST?.name} (${HIST?.n} rader)`);
if (HIST && Number(HIST.n) > 0) {
  const r = await post("/api/studio/suggest-text", { templateId: "ark-textkort", format: "1080x1350", topic: `${STAMPEL} generalitet` }, HIST.id);
  kolla(r.ok, `Generering HTTP ${r.status}`);
  const rad = await sisteRad(HIST.id, "studio-text");
  kolla(rad?.nyligen === "true", `lager.nyligen = ${rad?.nyligen ?? "saknas"} utan att något behövde såddas`);
}

// ── 3. Karusellen: egen källa, egen historik ─────────────────────────────────
// Karusellen läser krok-slidens rubrik ur payload->slides, inte affischens headline1.
// En egen kontroll behövs: fel fält här hade gett tyst tom lista.
console.log("\n## 3. Karusellen läser sin egen slide-struktur");
if (HIST) {
  const s = await post("/api/studio/posts", {
    title: `${STAMPEL} karusell`,
    payload: {
      templateId: "ark-karusell", format: "1080x1350",
      slides: [
        { kind: "hook", headline: `${STAMPEL} krok som ska undvikas`, body: "" },
        { kind: "point", headline: "Punkt", body: "" },
        { kind: "cta", headline: "Avslut", body: "" },
      ],
    },
  }, HIST.id);
  kolla(s.ok, `Sparade en karusell som historik: HTTP ${s.status}`);

  const g = await post("/api/studio/carousel/generate", { topic: `${STAMPEL} karusellkörning`, points: 3 }, HIST.id);
  kolla(g.ok, `Karusellgenerering HTTP ${g.status}`);
  const rad = await sisteRad(HIST.id, "karusell");
  kolla(rad?.nyligen === "true", `lager.nyligen = ${rad?.nyligen ?? "saknas"} (krok-sliden plockades ur payload->slides)`);
}

// ── 4. Fail-open — rotationen får aldrig fälla en generering ─────────────────
console.log("\n## 4. Fail-open");
const fo = await post("/api/studio/suggest-text", { templateId: "ark-textkort", format: "1080x1350", topic: `${STAMPEL} fail-open` }, HIST?.id ?? TOM?.id);
kolla(fo.ok && (fo.data?.suggestions?.length ?? 0) > 0,
  `Genereringen ger fortfarande text (${fo.data?.suggestions?.length ?? 0} förslag) — rotationen är ett tillägg, aldrig en grind`);

// ── 5. Redovisning per källa: vad kan INTE bevisas idag? ─────────────────────
// ⚠ SEO-lärdomen: en källa utan historik redovisas som "ingen historik", aldrig som
// godkänd och aldrig som en nolla som ser ut som ett mätvärde.
console.log("\n## 5. Källor: vilka har historik att rotera mot? (per tenant med mest data)");
const kallor = [
  ["social", "hm_social_posts", `coalesce(hook,'') <> ''`],
  ["linkedin", "linkedin_posts", `coalesce(hook,'') <> ''`],
  ["caption", "studio_posts", `coalesce(caption,'') <> ''`],
  ["studio-text", "studio_posts", `coalesce(payload->>'headline1','') <> ''`],
  ["karusell", "studio_posts", `template_id='ark-karusell' and jsonb_typeof(payload->'slides')='array'`],
  ["reel", "studio_reels", `jsonb_typeof(storyboard->'scenes')='array'`],
  ["nyhetsbrev", "newsletters", `coalesce(subject,'') <> ''`],
  ["blogg", "hm_blog", `coalesce(title,'') <> ''`],
  ["veckoplan", "studio_posts", `compass_source='schedule' and coalesce(title,'') <> ''`],
  ["idebank", "ideas_bank", `coalesce(body,'') <> ''`],
];
for (const [namn, tabell, villkor] of kallor) {
  try {
    const r = (await fraga(`
      select coalesce(max(n),0)::int as n, count(*)::int as tenants from (
        select client_id, count(*) n from public.${tabell} where ${villkor} group by client_id
      ) x;
    `))[0];
    if (r.n > 0) console.log(`OK   ${namn.padEnd(12)} finns hos ${r.tenants} tenant(er), mest ${r.n} rader`);
    else notera(`${namn.padEnd(12)} INGEN HISTORIK i någon tenant — inkopplad, men obevisbar tills flödet använts`);
  } catch (e) {
    kolla(false, `${namn}: källan gick inte att läsa — ${String(e.message).slice(0, 90)}`);
  }
}

// ── 6. Städning — inget testinlägg får bli kvar i ett kundkonto ──────────────
console.log("\n## 6. Städning");
try {
  const kvar = (await fraga(`delete from public.studio_posts where title like '${STAMPEL}%' returning id;`)) ?? [];
  kolla(true, `Tog bort ${kvar.length} sådd(a) rad(er) ur studio_posts`);
  const rest = (await fraga(`select count(*)::int n from public.studio_posts where title like 'G3d %';`))[0].n;
  kolla(rest === 0, `Kvar med G3d-prefix efter städning: ${rest}`);
} catch (e) {
  kolla(false, `STÄDNINGEN FÖLL — rader kan ligga kvar i ett kundkonto: ${String(e.message).slice(0, 120)}`);
}

console.log(`\n${fel === 0 ? "ALLA KONTROLLER GRÖNA" : `${fel} KONTROLL(ER) RÖDA`}`);
process.exit(fel === 0 ? 0 : 1);
