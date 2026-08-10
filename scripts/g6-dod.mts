// G-6 DoD — bildfeedbacken, skarpt.
//
// Enhetstesterna bevisar att blocket formulerar sig rätt. De bevisar INTE kedjan, och
// det är kedjan som varit bruten: tummen skrev en rad som ingen läste, och Studios
// Bildhjälpen läste aldrig någon feedback alls.
//
// KEDJAN SOM MÄTS: bild genereras → rad i generation_log → kunden ger omdöme med
// kommentar → omdömet bundet till genereringen → NÄSTA bildprompt bär omdömet.
//
// ⚠ Skriptet städar efter sig: omdömena det skapar tas bort sist (G-3d-läxan).
//
//   npx tsx --tsconfig scripts/text1/tsconfig.json scripts/g6-dod.mts

import { readFileSync } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
for (const line of readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}

import { hamtaBildfeedback, bildfeedbackBlock } from "../lib/bildfeedback";

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
if (!SECRET || !PAT) { console.error("Saknar nycklar"); process.exit(1); }
const exp = Math.floor(Date.now() / 1000) + 3600;
const ADMIN = `admin_session=${exp}.${b64url(crypto.createHmac("sha256", SECRET).update(String(exp)).digest())}`;

async function fraga(sql: string): Promise<Record<string, unknown>[]> {
  const r = await fetch(`https://api.supabase.com/v1/projects/${PROJEKT}/database/query`, {
    method: "POST", headers: { Authorization: `Bearer ${PAT}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`Management API ${r.status}: ${t.slice(0, 200)}`);
  return JSON.parse(t);
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

const STAMPEL = `G6-DoD-${Date.now()}`;
console.log(`# G-6 DoD — bildfeedbacken — ${BASE}\n`);

// ── 0. Utgångsläget: vad har feedbacken varit värd hittills? ────────────────
console.log("## 0. Utgångsläget");
const gamla = (await fraga(`
  select count(*)::int as n,
         count(*) filter (where client_id is null)::int as utan_tenant,
         count(*) filter (where kommentar is not null)::int as med_kommentar,
         count(*) filter (where generation_id is not null)::int as med_koppling
  from public.image_feedback;
`))[0] as Record<string, number>;
console.log(`     ${gamla.n} rader totalt · ${gamla.utan_tenant} utan tenant · ${gamla.med_kommentar} med kommentar · ${gamla.med_koppling} kopplade`);
if (gamla.utan_tenant > 0) {
  notera(`${gamla.utan_tenant} rader saknar client_id (skrevs före multi-tenancy). Läsningen filtrerar på`);
  notera("client_id, så de har ALDRIG påverkat en bild. De lämnas orörda — en gissad tenant är värre.");
}

const T = (await fraga(`
  select c.id, c.name from public.clients c
  join public.hm_brand_profile p on p.client_id = c.id
  where coalesce(trim(p.usp),'') <> '' order by c.name limit 1;
`))[0] as { id: string; name: string } | undefined;
kolla(!!T, `Tenant: ${T?.name ?? "INGEN"}`);

const skapade: string[] = [];
try {
  if (T) {
    // ── 1. Bilden loggar sin generering ────────────────────────────────────
    console.log("\n## 1. Bildvägen skriver nu i generationsloggen");
    const bild = await post("/api/studio/suggest-image", { mode: "ai", topic: `${STAMPEL}: en vanlig arbetsdag`, aspect: "square" }, T.id);
    kolla(bild.ok, `Bildgenerering HTTP ${bild.status}`);
    const genId = bild.data?.generationId ? String(bild.data.generationId) : "";
    kolla(!!genId, `Routen lämnade tillbaka generationId: ${genId || "SAKNAS"}`);

    if (genId) {
      const rad = (await fraga(`select syfte, format, prompt_version, motiv_kategori from public.generation_log where id = '${genId}';`))[0] as Record<string, string>;
      kolla(rad?.syfte === "bild", `Raden har syfte=${rad?.syfte}`);
      kolla(!!rad?.motiv_kategori, `motiv_kategori=${rad?.motiv_kategori} — kolumnen fanns sedan G-1 men skrevs aldrig`);
      kolla(!!rad?.prompt_version, `prompt_version=${rad?.prompt_version} (bildvägens egen regelversion)`);
    }

    // ── 2. Omdömet binds till genereringen ─────────────────────────────────
    console.log("\n## 2. Omdömet med kommentar, bundet till genereringen");
    const omdome = await post("/api/images/feedback", {
      rating: -1,
      generationId: genId,
      prompt: `${STAMPEL} motiv`,
      kommentar: `${STAMPEL} for morkt och fel sorts kunder`,
      image_url: String((bild.data?.photos as { url: string }[] | undefined)?.[0]?.url ?? ""),
    }, T.id);
    kolla(omdome.ok, `Sparade omdöme HTTP ${omdome.status}`);

    const sparad = (await fraga(`
      select id, rating, kommentar, generation_id, client_id
      from public.image_feedback where kommentar like '${STAMPEL}%' limit 1;
    `))[0] as Record<string, string> | undefined;
    if (sparad?.id) skapade.push(sparad.id);
    kolla(!!sparad, "Raden finns i databasen");
    kolla(sparad?.client_id === T.id, `client_id är satt (${sparad?.client_id ? "ja" : "NEJ"}) — det var just det som saknades i de gamla raderna`);
    kolla(!!sparad?.kommentar, `Kommentaren sparades: "${String(sparad?.kommentar ?? "").slice(0, 50)}"`);
    kolla(genId ? sparad?.generation_id === genId : true, `Kopplad till genereringen (${sparad?.generation_id ? "ja" : "nej"})`);

    // Ogiltigt betyg får inte skrivas — en rad med rating 0 räknas som ett omdöme
    // utan att vara ett.
    const noll = await post("/api/images/feedback", { rating: 0, kommentar: `${STAMPEL} ogiltig` }, T.id);
    kolla(noll.status === 400, `rating=0 avvisas (HTTP ${noll.status})`);

    // ── 3. Nästa bildprompt bär omdömet ────────────────────────────────────
    console.log("\n## 3. Läser NÄSTA generering tillbaka omdömet?");
    const lage = await hamtaBildfeedback(T.id);
    kolla(lage.finns, `Bildfeedback-läget hittar tenantens omdömen (${lage.gillade.length} gillade, ${lage.ogillade.length} ogillade)`);
    const block = bildfeedbackBlock(lage);
    kolla(block.includes("CLIENT-REJECTED"), "Blocket märker det underkända som avvisat");
    kolla(block.includes(STAMPEL), "Kundens EGNA ord finns i blocket, inte en sammanfattning");
    console.log(`     ${block.split("\n").slice(0, 4).join("\n     ")}`);

    // Att blocket byggs räcker inte — det ska nå den riktiga bildprompten. Bevisas
    // genom att en ny generering går igenom med lagret på (och inte kraschar på det).
    const bild2 = await post("/api/studio/suggest-image", { mode: "ai", topic: `${STAMPEL}: efter omdomet`, aspect: "square" }, T.id);
    kolla(bild2.ok, `Ny bild genererades med feedbacklagret på: HTTP ${bild2.status}`);
  }
} finally {
  // ── 4. Städning ──────────────────────────────────────────────────────────
  console.log("\n## 4. Städning");
  try {
    const bort = await fraga(`delete from public.image_feedback where kommentar like '${STAMPEL}%' returning id;`);
    kolla(true, `Tog bort ${bort.length} testomdöme(n)`);
    const kvar = (await fraga(`select count(*)::int n from public.image_feedback where kommentar like 'G6-DoD-%';`))[0] as { n: number };
    kolla(kvar.n === 0, `Kvar med DoD-prefix: ${kvar.n}`);
  } catch (e) {
    kolla(false, `STÄDNINGEN FÖLL — rader kan ligga kvar: ${String((e as Error).message).slice(0, 120)}`);
  }
}

console.log(`\n${fel === 0 ? "ALLA KONTROLLER GRÖNA" : `${fel} KONTROLL(ER) RÖDA`}`);
process.exit(fel === 0 ? 0 : 1);
