// G-1c DoD — kedjan generering → inlägg för de fyra resterande kundtextflödena.
//
// Karusellen bevisades i scripts/g1-dod.mjs. Den här kör LinkedIn, caption, reels och
// nyhetsbrev SKARPT och läser sedan raden i generation_log för var och en. Skälet är
// dagens återkommande fynd: koden påstod att den gjorde något den inte gjorde, och det
// upptäcktes bara när någon faktiskt körde den.
//
// Kör:  node scripts/g1c-flodena-dod.mjs
// Env:  G1_BASE (default http://localhost:3480)
//
// Gör fyra riktiga AI-anrop (några ören) och städar sina egna rader efteråt.

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
function b64url(buf) { return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }

const SECRET = readVar(".env.local", "ADMIN_SESSION_SECRET");
const PAT = process.env.SUPABASE_ACCESS_TOKEN || readVar("../.shared-keys.env", "SUPABASE_ACCESS_TOKEN");
if (!SECRET || !PAT) { console.error("Saknar ADMIN_SESSION_SECRET eller SUPABASE_ACCESS_TOKEN"); process.exit(1); }

const exp = Math.floor(Date.now() / 1000) + 3600;
const COOKIE = `admin_session=${exp}.${b64url(crypto.createHmac("sha256", SECRET).update(String(exp)).digest())}`;

async function fraga(sql, forsok = 3) {
  for (let i = 1; i <= forsok; i++) {
    const r = await fetch(`https://api.supabase.com/v1/projects/${PROJEKT}/database/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${PAT}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: sql }),
    });
    const t = await r.text();
    if (r.ok) return JSON.parse(t);
    if (i === forsok || (r.status < 500 && r.status !== 429)) throw new Error(`Management API ${r.status}: ${t.slice(0, 300)}`);
    await new Promise((k) => setTimeout(k, 2000 * i));
  }
}

const post = async (vag, kropp) => {
  const r = await fetch(`${BASE}${vag}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: COOKIE },
    body: JSON.stringify(kropp),
  });
  return { status: r.status, ok: r.ok, data: await r.json().catch(() => ({})) };
};

let fel = 0;
const oprovat = [];
const kolla = (ok, text) => { console.log(`${ok ? "OK  " : "FEL "} ${text}`); if (!ok) fel++; };
// Eget läge för det som inte GICK att köra. Att räkna det som ett fel läser som en bugg;
// att tiga om det läser som godkänt. Båda är osanna — därför en tredje rad.
const ejProvat = (text) => { console.log(`??  ${text}`); oprovat.push(text); };

/** Läser generationsraden för ett givet id och kontrollerar kopplingen. */
async function kollaKoppling(namn, generationId, vantadTabell, vantatId) {
  if (!generationId) { kolla(false, `${namn}: inget generationId kom tillbaka`); return; }
  const rad = (await fraga(`
    select syfte, format, prompt_version, anvand_i_tabell, anvand_i_id,
           ai_usage_event_id is not null as har_kostnad
    from public.generation_log where id = '${generationId}';
  `))[0];
  if (!rad) { kolla(false, `${namn}: raden ${generationId} finns inte`); return; }
  kolla(rad.anvand_i_tabell === vantadTabell, `${namn}: anvand_i_tabell = ${rad.anvand_i_tabell} (väntat ${vantadTabell})`);
  kolla(String(rad.anvand_i_id) === String(vantatId), `${namn}: anvand_i_id = ${rad.anvand_i_id} (väntat ${vantatId})`);
  kolla(rad.har_kostnad, `${namn}: kopplad till kostnadsraden`);
  console.log(`     syfte=${rad.syfte} format=${rad.format ?? "-"} version=${rad.prompt_version}`);
}

const STADA = [];
console.log(`# G-1c DoD — fyra flöden mot ${BASE}\n`);

// ── 1. LinkedIn: genererar OCH sparar i samma request ──────────────────────
{
  const r = await post("/api/linkedin/draft", { angle: "DoD-korning G-1c", length: "short" });
  kolla(r.ok, `LinkedIn: HTTP ${r.status}`);
  const postId = r.data?.post?.id;
  if (postId) {
    STADA.push(["linkedin_posts", postId]);
    const g = (await fraga(`select id from public.generation_log where anvand_i_tabell='linkedin_posts' and anvand_i_id='${postId}' limit 1;`))[0];
    await kollaKoppling("LinkedIn", g?.id, "linkedin_posts", postId);
  } else kolla(false, `LinkedIn: inget inlägg sparades — ${JSON.stringify(r.data).slice(0, 200)}`);
}

// ── 2. Caption: id:t reser till klienten och tillbaka vid sparning ─────────
{
  const r = await post("/api/studio/suggest-caption", { headline: "DoD-korning G-1c", topic: "DoD-korning G-1c", postType: "post" });
  kolla(r.ok && !!r.data?.caption, `Caption: HTTP ${r.status}`);
  kolla(!!r.data?.generationId, `Caption: routen lämnade tillbaka generationId`);
  const s = await post("/api/studio/posts", {
    title: "DoD-korning G-1c caption",
    payload: { templateId: "ark-textkort", format: "1080x1350", caption: r.data?.caption },
    generationIds: [r.data?.generationId],
  });
  const postId = s.data?.post?.id;
  if (postId) {
    STADA.push(["studio_posts", postId]);
    await kollaKoppling("Caption", r.data?.generationId, "studio_posts", postId);
  } else kolla(false, `Caption: inlägget sparades inte — ${JSON.stringify(s.data).slice(0, 200)}`);
}

// ── 3. Reels: id:t åker med INUTI storyboarden ─────────────────────────────
{
  const r = await post("/api/studio/reels/generate", { ide: "DoD-korning G-1c", templateKey: "fakta" });
  kolla(r.ok, `Reels: HTTP ${r.status}`);
  kolla(!!r.data?.generationId, `Reels: generationId följde med i storyboarden`);
  const s = await post("/api/studio/reels", { storyboard: r.data });
  const reelId = s.data?.id;
  if (reelId) {
    STADA.push(["studio_reels", reelId]);
    await kollaKoppling("Reels", r.data?.generationId, "studio_reels", reelId);
  } else kolla(false, `Reels: reelen sparades inte — ${JSON.stringify(s.data).slice(0, 200)}`);
}

// ── 4. Nyhetsbrev: samma mönster, id:t inuti innehållsobjektet ─────────────
{
  const r = await post("/api/newsletter/generate", {
    title: "DoD-korning G-1c",
    articleText: "Det här är en testartikel för att bevisa att generationsloggen kopplar nyhetsbrevet till genereringen som skrev det. Den behöver vara tillräckligt lång för att passera minimigränsen på femtio tecken, vilket den nu är.",
  });
  if (r.status === 403) {
    // Ingen klient i plattformen har nyhetsbrevsmodulen på (kontrollerat). Att slå på
    // den åt en kund för ett test vore att ändra hennes paket — det gör vi inte.
    ejProvat("Nyhetsbrev: EJ PROVAT — modulen är av för samtliga klienter (HTTP 403). Kopplingen är kodmässigt identisk med reels men OBEVISAD.");
  } else {
    kolla(r.ok, `Nyhetsbrev: HTTP ${r.status}`);
    kolla(!!r.data?.content?.generationId, `Nyhetsbrev: generationId följde med i innehållet`);
    const s = await post("/api/newsletter", { subject: r.data?.subject, content: r.data?.content, html: r.data?.html });
    const nlId = s.data?.newsletter?.id;
    if (nlId) {
      STADA.push(["newsletters", nlId]);
      await kollaKoppling("Nyhetsbrev", r.data?.content?.generationId, "newsletters", nlId);
    } else kolla(false, `Nyhetsbrev: sparades inte — ${JSON.stringify(s.data).slice(0, 200)}`);
  }
}

// ── Städning: bara raderna det här scriptet självt skapade ─────────────────
for (const [tabell, id] of STADA) {
  await fraga(`delete from public.${tabell} where id = '${id}';`);
}
console.log(`\nStädat: ${STADA.length} testrader borttagna (${STADA.map(([t]) => t).join(", ")}).`);
console.log("Generationsraderna behålls — de ÄR mätdatan.");

if (fel === 0) {
  console.log(`\nG-1c DoD GRÖN — de körda flödena binder sin generering.`);
} else {
  console.log(`\nG-1c DoD RÖD — ${fel} kontroll(er) föll.`);
}
if (oprovat.length) {
  console.log(`\n⚠ ${oprovat.length} flöde(n) gick INTE att köra och är alltså obevisade:`);
  for (const o of oprovat) console.log(`   - ${o}`);
}
process.exit(fel === 0 ? 0 : 1);
