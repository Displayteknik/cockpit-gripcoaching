// BILD-8 DoD — skarpt bevis för stavningsgrinden (8a) och blickriktningsregeln (8b).
//
// Del A: tio genereringar där avbildad text är själva poängen (skyltfönster, menyskärm,
//        affisch, entréskylt, prislapp) — fem per tenant. Grindens avläsning, dom och
//        omtag redovisas ur routens diagnostik-svar (body.diagnostik = true, ren
//        observabilitet — grindens beteende är oförändrat).
// Del B: tio genereringar där en person syns tillsammans med produkten/skärmen/skylten.
//        Bilderna bedöms visuellt efteråt (blickriktning går inte att mäta i kod).
//
// Körning:
//   BILD8_DEL=a npx tsx --tsconfig scripts/text1/tsconfig.json scripts/studio/bild8-exempel.mts
//   BILD8_DEL=b ...
//   BILD8_FALL=a3,b7  kör om enskilda fall
//
// Bieffekt som städas: routen laddar upp varje bild till studio-images/<clientId>/.
// Bilderna hämtas hem till docs/studio/bild8-exempel/ och objekten raderas ur bucketen —
// kundens mediabibliotek ska inte fyllas av QA (feedback_live_client_no_disruption).

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
for (const line of readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}

const headersShim = (await import("next/headers")) as unknown as {
  __setBatchCookie: (n: string, v: string) => void;
};
const { createAdminSession, ADMIN_COOKIE } = await import("@/lib/admin-auth");
headersShim.__setBatchCookie(ADMIN_COOKIE, await createAdminSession(process.env.ADMIN_SESSION_SECRET!));
const setActiveClient = (id: string) => headersShim.__setBatchCookie("active_client_id", id);

const { supabaseService } = await import("@/lib/supabase-admin");
const bildRoute = await import("@/app/api/studio/suggest-image/route");
const sb = supabaseService();

const UT = path.join(ROOT, "docs/studio/bild8-exempel");
const BUCKET = "studio-images";
const DT = { slug: "displayteknik", id: "a6a33547-5ca7-475f-9a62-43ff2c74d000" };
const AB = { slug: "annas-blommor", id: "7461fa8b-3fcb-4729-9cf6-53e27687656e" };

interface Fall { id: string; del: "a" | "b"; tenant: typeof DT; topic: string }

// Del A — ämnen som LOCKAR FRAM avbildad text. Samma fem mönster i båda branscherna:
// skyltfönster med erbjudande, menyskärm/tavla, affisch i butik, skylt vid entré, prislapp.
const DEL_A: Fall[] = [
  { id: "a1", del: "a", tenant: DT, topic: "Skyltfönstret som visar veckans erbjudande på skärmen" },
  { id: "a2", del: "a", tenant: DT, topic: "Den digitala menyskärmen ovanför disken i lunchrestaurangen" },
  { id: "a3", del: "a", tenant: DT, topic: "Affischen inne i butiken som byts på sekunder" },
  { id: "a4", del: "a", tenant: DT, topic: "Skylten vid entrén som visar öppettider" },
  { id: "a5", del: "a", tenant: DT, topic: "Den digitala prislappen på butikshyllan" },
  { id: "a6", del: "a", tenant: AB, topic: "Skyltfönstret med helgens buketterbjudande" },
  { id: "a7", del: "a", tenant: AB, topic: "Tavlan ovanför disken som visar dagens snittblommor och pris" },
  { id: "a8", del: "a", tenant: AB, topic: "Affischen inne i butiken om vårens nyheter" },
  { id: "a9", del: "a", tenant: AB, topic: "Skylten vid entrén som visar öppettider" },
  { id: "a10", del: "a", tenant: AB, topic: "Prislappen vid buketterna i butiken" },
];

// Del B — ämnen där en PERSON syns tillsammans med produkten/skärmen/skylten.
const DEL_B: Fall[] = [
  { id: "b1", del: "b", tenant: DT, topic: "Butiksbiträdet framför den nya skärmen i butiken" },
  { id: "b2", del: "b", tenant: DT, topic: "Gästen som läser menyskärmen innan hon beställer" },
  { id: "b3", del: "b", tenant: DT, topic: "Receptionisten visar besökaren informationsskärmen i entrén" },
  { id: "b4", del: "b", tenant: DT, topic: "Butiksägaren byter innehållet på skyltfönsterskärmen" },
  { id: "b5", del: "b", tenant: DT, topic: "Kunden stannar upp vid den digitala skylten i köpcentret" },
  { id: "b6", del: "b", tenant: AB, topic: "Floristen binder en bukett vid disken" },
  { id: "b7", del: "b", tenant: AB, topic: "Kunden väljer blommor ur kylen i butiken" },
  { id: "b8", del: "b", tenant: AB, topic: "Floristen visar kunden veckans bukett över disken" },
  { id: "b9", del: "b", tenant: AB, topic: "Kunden läser skylten utanför butiken" },
  { id: "b10", del: "b", tenant: AB, topic: "Medarbetaren ordnar blommorna i skyltfönstret" },
];

const ALLA = [...DEL_A, ...DEL_B];
const VALDA = (process.env.BILD8_FALL || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
const DEL = (process.env.BILD8_DEL || "").toLowerCase();
const KOR = VALDA.length ? ALLA.filter((f) => VALDA.includes(f.id)) : DEL ? ALLA.filter((f) => f.del === DEL) : ALLA;

function req(url: string, body: unknown): Request {
  return new Request(`http://localhost${url}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

mkdirSync(UT, { recursive: true });
const RUN_START = new Date().toISOString();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const uppladdade: { url: string }[] = [];
const resultat: Record<string, unknown>[] = [];

console.log(`BILD-8-bevis, fall: ${KOR.map((f) => f.id).join(", ")}`);
for (const f of KOR) {
  setActiveClient(f.tenant.id);
  let url = "";
  let description = "";
  let stavning: Record<string, unknown> | undefined;
  let fel = "";
  const t0 = Date.now();
  for (let forsok = 1; forsok <= 3 && !url; forsok++) {
    try {
      const res = await bildRoute.POST(req("/api/studio/suggest-image", {
        mode: "ai",
        topic: f.topic,
        aspect: "square",
        diagnostik: true,
      }) as never);
      const json = (await res.json()) as { photos?: { url: string }[]; description?: string; error?: string; stavning?: Record<string, unknown> };
      if (res.status !== 200 || !json.photos?.[0]?.url) throw new Error(json.error || `HTTP ${res.status}`);
      url = json.photos[0].url;
      description = json.description || "";
      stavning = json.stavning;
    } catch (e) {
      fel = (e as Error).message?.slice(0, 200) || "okänt fel";
      console.log(`  [försök ${forsok}/3] ${f.id} (${f.tenant.slug}): ${fel}`);
      if (forsok < 3) await sleep(forsok === 1 ? 4000 : 10000);
    }
  }

  const filnamn = `${f.id}-${f.tenant.slug}.png`;
  if (url) {
    uppladdade.push({ url });
    const bin = await fetch(url);
    writeFileSync(path.join(UT, filnamn), Buffer.from(await bin.arrayBuffer()));
    console.log(`  ${f.id} (${f.tenant.slug}): OK → ${filnamn}  [${Math.round((Date.now() - t0) / 1000)} s]`);
    console.log(`    scen: ${description.slice(0, 180)}`);
    if (stavning) {
      console.log(`    grind: orsak=${stavning.orsak} omtag=${stavning.omtag} blank=${stavning.blank}`);
      console.log(`    avläst: ${JSON.stringify(stavning.ord)}`);
      console.log(`    fel:    ${JSON.stringify(stavning.fel)}`);
      for (const [i, a] of ((stavning.avlasningar as Record<string, unknown>[]) || []).entries()) {
        console.log(`      avläsning ${i + 1}: ${a.orsak} · fram=${JSON.stringify(a.ord)} · bak=${JSON.stringify(a.ordBak)} · fel=${JSON.stringify(a.fel)}`);
        console.log(`         raw: ${JSON.stringify(String(a.raw || "").replace(/\s+/g, " ").slice(0, 400))}`);
      }
    }
  } else {
    console.log(`  ${f.id} (${f.tenant.slug}): FEL — ${fel}`);
  }
  resultat.push({ id: f.id, del: f.del, slug: f.tenant.slug, client_id: f.tenant.id, topic: f.topic, fil: url ? filnamn : null, scen: description, stavning, sekunder: Math.round((Date.now() - t0) / 1000), fel: url ? undefined : fel });
  await sleep(1500);
}

// Delkörning: slå ihop med befintlig metafil så bevisfilen alltid har alla fall.
const metaFil = path.join(UT, "resultat.json");
let tidigare: Record<string, unknown>[] = [];
try {
  tidigare = (JSON.parse(readFileSync(metaFil, "utf8")) as { fall: Record<string, unknown>[] }).fall || [];
} catch {}
const korda = new Set(resultat.map((r) => r.id));
const ordning = ALLA.map((f) => f.id);
const samlade = [...tidigare.filter((t) => !korda.has(t.id)), ...resultat].sort((a, b) => ordning.indexOf(String(a.id)) - ordning.indexOf(String(b.id)));
writeFileSync(metaFil, JSON.stringify({ kord: RUN_START, fall: samlade }, null, 2), "utf8");
console.log(`\n→ ${metaFil}`);

// ── Städ: ta bort testbilderna ur kundens mediabibliotek ────────────────────
let raderade = 0;
for (const u of uppladdade) {
  const nyckel = u.url.split(`/${BUCKET}/`)[1];
  if (!nyckel) continue;
  const { error } = await sb.storage.from(BUCKET).remove([decodeURIComponent(nyckel)]);
  if (!error) raderade++;
  else console.log(`  städfel ${nyckel}: ${error.message}`);
}
console.log(`Städat studio-images: ${raderade}/${uppladdade.length} objekt raderade.`);
console.log("KLART.");
