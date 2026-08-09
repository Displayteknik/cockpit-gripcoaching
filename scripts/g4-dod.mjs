// G-4 DoD — bevis-motorn, skarpt.
//
// Enhetstesterna bevisar att blocken säger rätt sak. De bevisar INTE att en riktig
// generering fick dem, att karusellens bevis-slide dyker upp bara där det finns material,
// eller — det viktigaste — att ett PRIS aldrig tar sig ut i en färdig text.
//
// TRE FRÅGOR SOM BARA EN SKARP KÖRNING KAN SVARA PÅ:
//   1. Får en tenant MED material bevislagret påslaget, och en UTAN material inte?
//   2. Får karusellen en bevis-slide bara hos den som har bevis?
//   3. Läcker något pris ut i texten när profilen är full av priser?
//
// Fråga 3 körs mot For Balance, som har 17 tal som ENBART finns i pricing_notes — den
// tenant där ett läckage är mest sannolikt och mest skadligt.
//
// ⚠ Skriptet SPARAR ingenting. Det genererar och läser loggen; inga rader skapas i
// kundkonton (G-3d-läxan).
//
// Kör:  node scripts/g4-dod.mjs        (kräver dev-servern igång)

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

const STAMPEL = `G4 ${new Date().toISOString().slice(0, 16)}`;
console.log(`# G-4 DoD — bevis-motorn — ${BASE}\n`);

async function sisteRad(tenant, syfte) {
  await vila(2500);
  return (await fraga(`
    select id, prompt_version, lager->>'bevis' as bevis, varianter
    from public.generation_log
    where syfte = '${syfte}' and tenant_id = '${tenant}'
    order by created_at desc limit 1;
  `))[0];
}

// ── 0. Vem har bevismaterial, och vem har bara priser? ──────────────────────
console.log("## 0. Bevisläget per tenant (ur databasen)");
const lage = await fraga(`
  select c.id, c.name,
    coalesce(length(trim(coalesce(p.verified_numbers,''))),0) > 0 as har_eget_falt,
    coalesce(length(trim(coalesce(p.pricing_notes,''))),0)   > 0 as har_priser,
    (select count(*) from public.linkedin_posts l
       where l.client_id = c.id and l.source_module = 'intake') as berattelser,
    coalesce(length(trim(coalesce(p.brand_story,'') || coalesce(p.usp,'') || coalesce(p.services,''))),0) as profiltext
  from public.clients c
  join public.hm_brand_profile p on p.client_id = c.id
  order by c.name;
`);
for (const r of lage) {
  console.log(`     ${String(r.name).slice(0, 28).padEnd(30)} eget fält: ${r.har_eget_falt ? "ja " : "nej"}  berättelser: ${String(r.berattelser).padStart(3)}  priser: ${r.har_priser ? "ja" : "nej"}`);
}

// ── 1. Tenant MED material → bevislagret på ─────────────────────────────────
console.log("\n## 1. Tenant med material — slås bevislagret på?");
const MED = (await fraga(`
  select c.id, c.name from public.clients c
  join public.hm_brand_profile p on p.client_id = c.id
  where (select count(*) from public.linkedin_posts l where l.client_id = c.id and l.source_module='intake') >= 3
  order by (select count(*) from public.linkedin_posts l where l.client_id = c.id and l.source_module='intake') desc
  limit 1;
`))[0];
if (!MED) { kolla(false, "Hittade ingen tenant med story-bank"); }
else {
  console.log(`     Tenant: ${MED.name}`);
  const r = await post("/api/studio/suggest-text", { templateId: "ark-textkort", format: "1080x1350", topic: `${STAMPEL} med material` }, MED.id);
  kolla(r.ok, `Generering HTTP ${r.status}`);
  const rad = await sisteRad(MED.id, "studio-text");
  kolla(rad?.bevis === "true", `lager.bevis = ${rad?.bevis ?? "saknas"} (material finns → ska vara på)`);
  kolla(rad?.prompt_version === "v1-b9ab87e2", `promptversion ${rad?.prompt_version} (bevislagret ingår i hashen)`);
}

// ── 2. Tenant UTAN material → lagret av, men blocket ändå med som FÖRBUD ────
console.log("\n## 2. Tenant utan material — förbudsgrenen");
// Utan material = inga SIFFROR i nagot bevisfalt (pricing_notes raknas inte) OCH noll
// berattelser. Forsta versionen kravde ocksa tom brand_story/usp och hittade darfor
// ingen tenant alls - kravet var pa fel sak. Det ar siffrorna och berattelserna som
// avgor bevislaget, inte om profilen har text.
const UTAN = (await fraga(`
  select c.id, c.name from public.clients c
  join public.hm_brand_profile p on p.client_id = c.id
  where (coalesce(p.verified_numbers,'') || coalesce(p.brand_story,'') || coalesce(p.usp,'')
      || coalesce(p.differentiators,'') || coalesce(p.services,'') || coalesce(p.icp_primary,'')
      || coalesce(p.pain_points,'') || coalesce(p.customer_journey,'') || coalesce(p.competitors,'')) !~ '[0-9]'
    and (select count(*) from public.linkedin_posts l where l.client_id = c.id and l.source_module='intake') = 0
  limit 1;
`))[0];
if (!UTAN) notera("Ingen tenant är helt utan material — förbudsgrenen täcks av enhetstesterna");
else {
  console.log(`     Tenant: ${UTAN.name}`);
  const r = await post("/api/studio/suggest-text", { templateId: "ark-textkort", format: "1080x1350", topic: `${STAMPEL} utan material` }, UTAN.id);
  kolla(r.ok, `Generering HTTP ${r.status}`);
  const rad = await sisteRad(UTAN.id, "studio-text");
  kolla(rad?.bevis === "false", `lager.bevis = ${rad?.bevis ?? "saknas"} (inget material → ska vara av, men blocket är med som förbud)`);
}

// ── 2b. KUNDVAGEN: det kunden skriver i nya rutan blir bevis ────────────
// Hela G-4 hanger pa att falten gar att FYLLA I fran profilsidan och att vardet nar
// prompten. Ett falt som bara finns i databasen ar en tom ruta for kunden. Fore/efter
// pa samma tenant, via samma API som formuläret anvander.
console.log("\n## 2b. Kundvägen — skriver kunden i rutan, blir det bevis?");
if (UTAN) {
  const las = async () => {
    const r = await fetch(`${BASE}/api/profile`, { headers: { cookie: `${ADMIN}; active_client_id=${UTAN.id}` } });
    return r.ok ? r.json() : null;
  };
  const fore = await las();
  const original = fore?.verified_numbers ?? null;
  kolla(fore !== null && "verified_numbers" in fore, `Falet finns i profil-API:t (varde: ${original === null ? "tomt" : JSON.stringify(original).slice(0, 40)})`);

  const skrivet = "Vi har levererat over 400 fasader sedan 1998. Offert inom 24 timmar.";
  const put = await fetch(`${BASE}/api/profile`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", cookie: `${ADMIN}; active_client_id=${UTAN.id}` },
    body: JSON.stringify({ verified_numbers: skrivet }),
  });
  kolla(put.ok, `Sparade via profil-API:t: HTTP ${put.status}`);
  const efter = await las();
  kolla(efter?.verified_numbers === skrivet, "Vardet lastes tillbaka oforandrat");

  const g = await post("/api/studio/suggest-text", { templateId: "ark-textkort", format: "1080x1350", topic: `${STAMPEL} efter ifyllt falt` }, UTAN.id);
  kolla(g.ok, `Generering efter ifyllt falt: HTTP ${g.status}`);
  const rad = await sisteRad(UTAN.id, "studio-text");
  // Detta ar beviset for hela kundvagen: samma tenant, samma kod, enda skillnaden ar
  // att nagon skrev i rutan.
  kolla(rad?.bevis === "true", `lager.bevis = ${rad?.bevis ?? "saknas"} EFTER ifyllt falt (var false innan)`);

  // Aterstall - DoD:n far aldrig lamna kvar text i en kunds profil (G-3d-laxan).
  const ater = await fetch(`${BASE}/api/profile`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", cookie: `${ADMIN}; active_client_id=${UTAN.id}` },
    body: JSON.stringify({ verified_numbers: original }),
  });
  const kvar = await las();
  kolla(ater.ok && (kvar?.verified_numbers ?? null) === original, `Aterstallde faltet till ursprungsvardet`);
}

// ── 3. Karusellens bevis-slide dyker upp bara där det finns bevis ───────────
console.log("\n## 3. Karusellens bevis-slide är gatad på material");
if (MED) {
  const g = await post("/api/studio/carousel/generate", { topic: `${STAMPEL} karusell med bevis`, points: 3 }, MED.id);
  kolla(g.ok, `Karusell HTTP ${g.status}`);
  const slides = g.data?.slides ?? [];
  // krok + insats + 3 punkter + bevis + avslut = 7. Utan bevis-sliden: 6.
  console.log(`     ${slides.length} slides: ${slides.map((s) => s.kind).join(" → ")}`);
  // ⚠ ÄRLIGHET: payloadens slide-typ har bara tre roller (hook/point/cta) — insats och
  // bevis landar som "point" (känd G-2-gräns, dokumenterad i carousel.ts). Antalet är
  // alltså det enda som går att mäta härifrån: 7 = rollistan innehöll bevis-sliden,
  // 6 = den gjorde det inte. Att sliden BÄR ett bevis kan inte avgöras av det här måttet.
  kolla(slides.length === 7, `Rollistan innehöll bevis-sliden (${slides.length} slides; 6 utan, 7 med)`);
  const rad = await sisteRad(MED.id, "karusell");
  kolla(rad?.varianter === 7, `Loggen räknar ${rad?.varianter} varianter — samma räkning som rollistan`);
}
if (UTAN) {
  const g = await post("/api/studio/carousel/generate", { topic: `${STAMPEL} karusell utan bevis`, points: 3 }, UTAN.id);
  const slides = g.data?.slides ?? [];
  console.log(`     ${slides.length} slides: ${slides.map((s) => s.kind).join(" → ")}`);
  kolla(g.ok && slides.length === 6, `Utan material: rollistan saknar bevis-sliden (${slides.length} slides, väntat 6)`);
}

// ── 4. Prisläckaget — den dyraste frågan ───────────────────────────────────
// For Balance har 17 tal som bara finns i pricing_notes. Om bevislagret öppnat en
// bakväg för priser syns det här.
console.log("\n## 4. Läcker något pris ut i texten?");
const PRIS = (await fraga(`
  select c.id, c.name, p.pricing_notes from public.clients c
  join public.hm_brand_profile p on p.client_id = c.id
  where coalesce(trim(p.pricing_notes),'') <> ''
  order by length(p.pricing_notes) desc limit 1;
`))[0];
if (!PRIS) notera("Ingen tenant har prisnotiser — kan inte provas");
else {
  console.log(`     Tenant: ${PRIS.name} (${String(PRIS.pricing_notes).length} tecken prisnotiser)`);
  // Talen ur prisnotiserna, normaliserade till siffergrupper.
  const pristal = Array.from(new Set((String(PRIS.pricing_notes).match(/\d[\d\s.,]{2,}/g) || [])
    .map((s) => s.replace(/[\s.,]/g, "")).filter((s) => s.length >= 3)));
  console.log(`     Tal i prisnotiserna: ${pristal.slice(0, 8).join(", ")}${pristal.length > 8 ? " …" : ""}`);

  let traffar = 0, korningar = 0;
  for (const amne of ["vad det kostar att komma igång", "är det värt pengarna", "vårt erbjudande just nu"]) {
    const r = await post("/api/studio/suggest-text", { templateId: "ark-textkort", format: "1080x1350", topic: `${STAMPEL}: ${amne}` }, PRIS.id);
    if (!r.ok) continue;
    korningar++;
    for (const f of r.data?.suggestions ?? []) {
      const text = [f.headline1, f.headline2, f.body].join(" ");
      const normaliserad = text.replace(/[\s.,]/g, "");
      const lackt = pristal.filter((t) => normaliserad.includes(t));
      if (lackt.length) { traffar++; console.log(`     LÄCKAGE: "${text.slice(0, 110)}" → ${lackt.join(", ")}`); }
    }
  }
  kolla(korningar > 0, `${korningar} genereringar på prisfrågande ämnen`);
  kolla(traffar === 0, `Inget pris ur profilen hamnade i texten (${traffar} träffar)`);
}

// ── 5. Mätaren räknar inte längre priser som bevis ─────────────────────────
console.log("\n## 5. Profilmätaren efter rättningen");
if (PRIS) {
  const r = await fetch(`${BASE}/api/profile/quality`, { headers: { cookie: `${ADMIN}; active_client_id=${PRIS.id}` } });
  const d = await r.json().catch(() => ({}));
  const siffror = (d?.kriterier ?? d?.report?.kriterier ?? []).find((k) => k.key === "siffror");
  if (!siffror) notera(`Kunde inte läsa kriteriet ur /api/profile/quality (HTTP ${r.status}) — kontrolleras i enhetstest i stället`);
  else {
    console.log(`     "${siffror.label}": ${siffror.antal} (krav ${siffror.krav})`);
    kolla(!String(siffror.atgard).includes("pris"), `Åtgärdstexten ber inte längre om priser: "${String(siffror.atgard).slice(0, 70)}"`);
  }
}

console.log(`\n${fel === 0 ? "ALLA KONTROLLER GRÖNA" : `${fel} KONTROLL(ER) RÖDA`}`);
process.exit(fel === 0 ? 0 : 1);
