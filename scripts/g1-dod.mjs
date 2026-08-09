// G-1 DoD — bevisar att en SKARP generering faktiskt landar i generation_log.
//
// Varför det här scriptet finns och inte bara enhetstesterna: enhetstesterna bevisar
// att loggaren skriver rätt fält mot en attrapp. De bevisar inte att raden når databasen,
// att kopplingen till ai_usage_events håller, eller att promptversionen är den som
// faktiskt byggde texten. Dagens två fynd var båda av sorten "koden påstod något den
// inte gjort" — den här etappen får inte bli det tredje.
//
// Kör:  node scripts/g1-dod.mjs
// Env:  G1_BASE (default http://localhost:3480)
//
// Gör ETT riktigt karusellanrop (kostar några ören) och läser sedan raden.

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
function mintAdmin(secret) {
  const exp = Math.floor(Date.now() / 1000) + 900;
  return `${exp}.${b64url(crypto.createHmac("sha256", secret).update(String(exp)).digest())}`;
}

const SECRET = readVar(".env.local", "ADMIN_SESSION_SECRET");
const PAT = process.env.SUPABASE_ACCESS_TOKEN || readVar("../.shared-keys.env", "SUPABASE_ACCESS_TOKEN");
if (!SECRET || !PAT) { console.error("Saknar ADMIN_SESSION_SECRET eller SUPABASE_ACCESS_TOKEN"); process.exit(1); }

// Management API svarar då och då 503 (upstream timeout). Ett tillfälligt nätverksfel
// får inte se ut som ett misslyckat DoD — då blir bevisningen otillförlitlig åt fel håll.
async function fraga(sql, forsok = 3) {
  for (let i = 1; i <= forsok; i++) {
    const r = await fetch(`https://api.supabase.com/v1/projects/${PROJEKT}/database/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${PAT}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: sql }),
    });
    const t = await r.text();
    if (r.ok) return JSON.parse(t);
    if (i === forsok || (r.status < 500 && r.status !== 429)) {
      throw new Error(`Management API ${r.status}: ${t.slice(0, 300)}`);
    }
    await new Promise((k) => setTimeout(k, 2000 * i));
  }
}

// --las: hoppa över genereringen och läs bara det som redan finns. För omkörning när
// avläsningen föll på ett nätverksfel — ett nytt AI-anrop ska inte behövas för det.
const BARA_LAS = process.argv.includes("--las");

let fel = 0;
const kolla = (ok, text) => { console.log(`${ok ? "OK  " : "FEL "} ${text}`); if (!ok) fel++; };

const fore = (await fraga("select count(*)::int as n from public.generation_log"))[0].n;
console.log(`# G-1 DoD — ${BASE}. Rader i generation_log före: ${fore}`);

if (!BARA_LAS) {
  const AMNE = `DoD-korning ${new Date().toISOString().slice(0, 16)}`;
  const r = await fetch(`${BASE}/api/studio/carousel/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: `admin_session=${mintAdmin(SECRET)}` },
    body: JSON.stringify({ topic: AMNE, points: 3 }),
  });
  const svar = await r.json().catch(() => ({}));
  kolla(r.ok, `Karusellanropet svarade HTTP ${r.status}${r.ok ? ` med ${svar.slides?.length ?? 0} slides` : `: ${JSON.stringify(svar).slice(0, 200)}`}`);
  // Loggningen sker efter svaret men i samma request — ge den ett ögonblick.
  await new Promise((k) => setTimeout(k, 2500));
}

const rader = await fraga(`
  select g.id, g.syfte, g.format, g.prompt_version, g.funnel, g.varianter, g.status,
         g.tenant_id is not null            as har_tenant,
         g.ai_usage_event_id is not null    as har_kostnadskoppling,
         g.lager is not null                as har_lager,
         u.provider, u.model, u.status      as usage_status
  from public.generation_log g
  left join public.ai_usage_events u on u.id = g.ai_usage_event_id
  order by g.created_at desc limit 1;
`);

const efter = (await fraga("select count(*)::int as n from public.generation_log"))[0].n;
if (!BARA_LAS) kolla(efter === fore + 1, `Exakt en ny rad skrevs (${fore} → ${efter})`);
else kolla(efter > 0, `${efter} rader finns (läsläge — ingen ny generering gjordes)`);

const g = rader[0];
if (!g) {
  kolla(false, "Ingen rad att läsa — genereringen loggades inte");
} else {
  console.log(`\nRaden:\n${JSON.stringify(g, null, 2)}\n`);
  kolla(g.syfte === "karusell", `syfte = ${g.syfte} (väntat karusell)`);
  // Kärnan i G0 0.4 punkt 2: karusell får inte bli samma rad som en statisk bild.
  kolla(g.format === "karusell", `format = ${g.format} (väntat karusell, INTE bildstorleken)`);
  kolla(/^v\d+-[0-9a-f]{8}$/.test(g.prompt_version || ""), `prompt_version = ${g.prompt_version}`);
  kolla(g.funnel === "tofu", `funnel = ${g.funnel} (syftets mjuka default, inte null)`);
  kolla(g.varianter === 5, `varianter = ${g.varianter} (hook + 3 punkter + cta)`);
  kolla(g.har_tenant, "tenant_id skrivet");
  kolla(g.har_lager, "lager (promptlagren) skrivet");
  // Hela poängen med att tabellen PEKAR på ledgern i stället för att duplicera den.
  kolla(g.har_kostnadskoppling, `ai_usage_event_id kopplat → ${g.provider}/${g.model}, usage-status ${g.usage_status}`);
  kolla(g.status === "ok", `status = ${g.status}`);
}

// Vyn ska kunna svara på frågan hela etappen finns för.
const vy = await fraga("select prompt_version, syfte, antal, publicerade, utan_kostnadskoppling from public.generation_per_promptversion order by antal desc limit 5;");
console.log("Vyn generation_per_promptversion:");
console.log(JSON.stringify(vy, null, 2));
kolla(vy.length > 0, "Vyn returnerar rader");

console.log(fel === 0 ? "\nG-1 DoD GRÖN" : `\nG-1 DoD RÖD — ${fel} kontroll(er) föll.`);
process.exit(fel === 0 ? 0 : 1);
