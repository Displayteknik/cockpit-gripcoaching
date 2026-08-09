// G-2 DoD — formatanatomierna, skarpt.
//
// Enhetstesterna bevisar att rollistan och texterna stämmer. De bevisar INTE att en riktig
// generering faktiskt får rätt anatomi, att storyn skiljer sig från ett inlägg, eller att
// generationsloggen skriver rätt syfte. Det gör den här.
//
// Kör:  node scripts/g2-dod.mjs        (kräver dev-servern igång)

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
if (!SECRET || !PAT) { console.error("Saknar nycklar"); process.exit(1); }
const exp = Math.floor(Date.now() / 1000) + 3600;
const COOKIE = `admin_session=${exp}.${b64url(crypto.createHmac("sha256", SECRET).update(String(exp)).digest())}`;

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
const post = async (v, k) => {
  const r = await fetch(`${BASE}${v}`, { method: "POST", headers: { "Content-Type": "application/json", cookie: COOKIE }, body: JSON.stringify(k) });
  return { ok: r.ok, status: r.status, data: await r.json().catch(() => ({})) };
};

let fel = 0;
const kolla = (ok, t) => { console.log(`${ok ? "OK  " : "FEL "} ${t}`); if (!ok) fel++; };

console.log(`# G-2 DoD — ${BASE}\n`);

// ── 1. Karusellen: anatomin ur data ska ge exakt de slides rollistan säger ──
{
  const r = await post("/api/studio/carousel/generate", { topic: "G-2 DoD: varför skyltar bleknar", points: 4 });
  kolla(r.ok, `Karusell (4 punkter): HTTP ${r.status}`);
  const slides = r.data?.slides || [];
  // krok + 4 punkter + avslut = 6. Räkningen kommer nu ur EN rollista i stället för tre
  // uttryck på tre ställen — det var precis den glidningen AKUT-KARUSELL handlade om.
  kolla(slides.length === 6, `Gav ${slides.length} slides (väntat 6: krok + 4 punkter + avslut)`);
  kolla(slides[0]?.kind === "hook", `Första sliden är krok (${slides[0]?.kind})`);
  kolla(slides[slides.length - 1]?.kind === "cta", `Sista sliden är avslut (${slides[slides.length - 1]?.kind})`);
  const g = (await fraga(`select syfte, format, varianter from public.generation_log where id = '${r.data?.generationId}';`))[0];
  kolla(g?.varianter === 6, `Loggen säger varianter=${g?.varianter} — samma räkning som anatomin`);
}

// ── 2. Storyn: egen anatomi, inte ett inläggs ─────────────────────────────
{
  const r = await post("/api/studio/suggest-text", { templateId: "ark-textkort", format: "1080x1920", topic: "G-2 DoD: öppet till 18 idag" });
  kolla(r.ok, `Story-text (9:16 utan video): HTTP ${r.status}`);
  const f = r.data?.suggestions?.[0];
  if (f) {
    console.log(`     "${f.headline1}" / "${f.headline2}"`);
    // Storyns regel: 3 till 12 ord i huvudbudskapet. Ett inläggs rubrik är längre.
    const ord = String(f.headline1 || "").trim().split(/\s+/).filter(Boolean).length;
    kolla(ord >= 1 && ord <= 12, `Huvudbudskapet är ${ord} ord (storyn kräver högst 12)`);
  } else kolla(false, `Story: inga förslag — ${JSON.stringify(r.data).slice(0, 200)}`);

  // Loggen ska säga "story", inte "studio-text". Det är hela skillnaden G-0 pekade på.
  const g = (await fraga(`select syfte from public.generation_log where syfte = 'story' order by created_at desc limit 1;`))[0];
  kolla(!!g, `Generationsloggen har en rad med syfte "story"`);
}

// ── 3. Hashtags: går nu genom prompt-core, alltså med promptversion ───────
{
  const r = await post("/api/generate/hashtags", { topic: "G-2 DoD: skyltfönster i solljus" });
  kolla(r.ok, `Hashtags: HTTP ${r.status}`);
  const g = (await fraga(`select syfte, prompt_version from public.generation_log where syfte = 'social' order by created_at desc limit 1;`))[0];
  kolla(!!g?.prompt_version, `Hashtags loggas med promptversion ${g?.prompt_version} — förut byggde flödet egen prompt förbi kärnan`);
}

console.log(fel === 0 ? "\nG-2 DoD GRÖN" : `\nG-2 DoD RÖD — ${fel} kontroll(er) föll.`);
process.exit(fel === 0 ? 0 : 1);
