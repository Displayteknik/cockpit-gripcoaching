// A2-skärpningen — riktad omkörning av ETT ämne, caption × alla fyra profiler.
//
// Bakgrund: T-6-delbatchen visade att sanningskravet läckte när ÄMNET självt bad om
// en kundberättelse. Ämnet "tvekade" gav "Jag minns en kund som tvekade länge..."
// (HM Motor) och "Jag minns ett brudpar som tvekade länge..." (Annas Blommor) —
// fabricerade minnen. Skriptet kör om exakt det ämnet mot den skärpta SANNINGSKRAV-
// regeln och rapporterar vilka fabrikatmarkörer som finns kvar.
//
// Körning:
//   npx tsx --tsconfig scripts/text1/tsconfig.json scripts/text1/a2-tvekade.mts
//   TEXT1_UT=docs/text1/t6-a2 npx tsx ... (annan utkatalog; default docs/text1/t6-a2)
//
// Bieffekter: caption-flödet skriver INGET i DB. Enda möjliga skrivningen är att
// getVoiceFingerprint bygger om en >24 h gammal fingerprint (upsert i
// client_voice_profile) — den snapshotas före och återställs efter, exakt som
// text1-batch.mts. studio_posts kontrolleras också (läses av rotationslagret).

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
// CRLF-säker env-parsning (lesson_env_crlf_key_parsing): \r i nyckeln ger falskt 401.
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
const captionRoute = await import("@/app/api/studio/suggest-caption/route");
const sb = supabaseService();

const PROFILER = [
  { slug: "displayteknik", name: "Displayteknik", id: "a6a33547-5ca7-475f-9a62-43ff2c74d000" },
  { slug: "engens-trad", name: "Engens Träd & Trädgård", id: "e9e9e9e9-7e2d-4a2b-9c1f-e1ce115da001" },
  { slug: "hm-motor", name: "HM Motor Krokom", id: "00000000-0000-0000-0000-000000000001" },
  { slug: "annas-blommor", name: "Annas Blommor", id: "7461fa8b-3fcb-4729-9cf6-53e27687656e" },
];
const IDS = PROFILER.map((p) => p.id);

const AMNE_ID = process.env.TEXT1_AMNE || "tvekade";
const AMNEN = (JSON.parse(readFileSync(path.join(ROOT, "docs/text1/amnen.json"), "utf8")) as {
  amnen: { id: string; tema: string; underlag_artikel: string }[];
}).amnen;
const AMNE = AMNEN.find((a) => a.id === AMNE_ID);
if (!AMNE) throw new Error(`Ämnet "${AMNE_ID}" finns inte i docs/text1/amnen.json`);

const OUT_DIR = path.join(ROOT, process.env.TEXT1_UT || "docs/text1/t6-a2");
const SCRATCH = "C:/Users/hakan/AppData/Local/Temp/claude/C--Users-hakan-OneDrive-Dokument-Antigravity/69f20a37-dcf3-4038-aa77-5c740de668f9/scratchpad";

// ── Fabrikatmarkörer: formuleringar som PÅSTÅR ett specifikt minne ───────────
// Mätningen ska vara oberoende av prompten — samma lista oavsett tenant/bransch.
const FABRIKAT: { namn: string; re: RegExp }[] = [
  { namn: "jag minns", re: /\bjag minns\b/i },
  { namn: "jag kommer ihåg", re: /\bjag kommer ihåg\b/i },
  { namn: "en av våra kunder (berättade/hörde av sig)", re: /\ben av (våra|mina) kunder\b/i },
  { namn: "häromdagen/häromveckan", re: /\bhärom(dagen|veckan)\b/i },
  { namn: "förra veckan kom/ringde", re: /\bförra veckan (kom|ringde|hörde|satt)\b/i },
  { namn: "en kund som (specifikt minne)", re: /\b(en|ett) (kund|brudpar|par|familj|företagare|kille|tjej|man|kvinna) som (tvekade|hörde|ringde|kom)\b/i },
  { namn: "kundcitat i talstreck", re: /["“][^"”]{15,}["”]\s*,?\s*(sa|sade|berättade)\b/i },
];

// Tillåtna generella observationer — för att visa att texten valde rätt väg.
// (Mönstren måste tåla att målgruppsordet varierar per bransch: "många brudpar
// tvekar", "många soloföretagare väntar" — annars mäter vi bara vissa branscher.)
const GENERELLT: RegExp[] = [
  /\bvi (möter|träffar|hör|ser) ofta\b/i,
  /\bmånga\b[^.!?\n]{0,40}\b(kunder|hör av sig|väntar|tvekar|funderar|drar sig)\b/i,
  /\bdet är (en|den) (reaktion|känsla|fråga|mening)[^.!?\n]{0,30}\b(vi|jag) (hör|får|möter)\b/i,
  /\bden (meningen|tveksamheten|frågan|känslan)[^.!?\n]{0,20}\bhör (jag|vi)\b/i,
  /\b(oftast|nästan alltid|vanligaste|en vanlig känsla)\b/i,
];

function analysera(text: string) {
  const t = String(text || "");
  return {
    oppning: (t.split("\n").find((r) => r.trim()) || "").trim(),
    fabrikat: FABRIKAT.filter((f) => f.re.test(t)).map((f) => f.namn),
    generell_observation: GENERELLT.some((re) => re.test(t)),
  };
}

// FÖRE-texten ur T-6-delbatchen (docs/text1/t6/<slug>/caption.json) — så bevisfilen
// är självbärande: före och efter i samma dokument, mätta med samma mönster.
function foreText(slug: string): string {
  try {
    const j = JSON.parse(readFileSync(path.join(ROOT, "docs/text1/t6", slug, "caption.json"), "utf8")) as {
      poster: { amne_id: string; output: string | null }[];
    };
    return String(j.poster.find((p) => p.amne_id === AMNE!.id)?.output || "");
  } catch {
    return "";
  }
}

// ── Omanalys-läge: räkna om analysen på REDAN genererade texter ─────────────
// TEXT1_OMANALYS=1 → ingen generering, inga API-anrop, ingen DB. Används när
// mätmönstren ovan justeras — bevisfilen ska aldrig behöva en ny AI-körning för
// att spegla den mätning som skriptet faktiskt gör.
if (process.env.TEXT1_OMANALYS) {
  const fil = path.join(ROOT, process.env.TEXT1_UT || "docs/text1/t6-a2", `a2-${AMNE.id}.json`);
  const gammal = JSON.parse(readFileSync(fil, "utf8")) as { poster: Record<string, unknown>[] };
  for (const p of gammal.poster) {
    p.fore_output = foreText(String(p.slug));
    p.fore_analys = analysera(String(p.fore_output || ""));
    p.analys = analysera(String(p.output || ""));
  }
  (gammal as Record<string, unknown>).fabrikat_totalt = gammal.poster.reduce(
    (n, p) => n + (p.analys as { fabrikat: string[] }).fabrikat.length, 0);
  writeFileSync(fil, JSON.stringify(gammal, null, 2), "utf8");
  for (const p of gammal.poster) {
    const a = p.analys as { fabrikat: string[]; generell_observation: boolean };
    console.log(`  ${p.slug}: fabrikat [${a.fabrikat.join(", ") || "inga"}] generellt: ${a.generell_observation}`);
  }
  console.log(`OMANALYS KLAR → ${fil}`);
  process.exit(0);
}

// ── Snapshot av client_voice_profile (återställs efteråt) ───────────────────
const { data: voiceFore } = await sb.from("client_voice_profile").select("*").in("client_id", IDS);
mkdirSync(SCRATCH, { recursive: true });
const SNAP_FIL = path.join(SCRATCH, "a2_voice_profile_snapshot.json");
writeFileSync(SNAP_FIL, JSON.stringify(voiceFore || [], null, 2), "utf8");

const RUN_START = new Date().toISOString();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function req(url: string, body: unknown): Request {
  return new Request(`http://localhost${url}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

console.log(`A2-omkörning: ämne "${AMNE.id}" — ${AMNE.tema}`);
const poster: Record<string, unknown>[] = [];
for (const p of PROFILER) {
  setActiveClient(p.id);
  const t0 = Date.now();
  let caption = "";
  let fel = "";
  for (let f = 1; f <= 3 && !caption; f++) {
    try {
      const res = await captionRoute.POST(req("/api/studio/suggest-caption", {
        topic: AMNE.tema,
        postType: "post",
      }) as never);
      const json = (await res.json()) as { caption?: string; error?: string };
      if (res.status !== 200 || !json.caption) throw new Error(json.error || `HTTP ${res.status}`);
      caption = json.caption;
    } catch (e) {
      fel = (e as Error).message?.slice(0, 200) || "okänt fel";
      console.log(`  [försök ${f}/3] ${p.slug}: ${fel}`);
      if (f < 3) await sleep(f === 1 ? 3000 : 8000);
    }
  }
  const analys = analysera(caption);
  const fore = foreText(p.slug);
  poster.push({
    profil: p.name,
    slug: p.slug,
    client_id: p.id,
    amne_id: AMNE.id,
    tema: AMNE.tema,
    fore_output: fore,
    fore_analys: analysera(fore),
    output: caption || null,
    fel: caption ? undefined : fel,
    duration_ms: Date.now() - t0,
    analys,
  });
  console.log(`  ${p.slug}: ${caption ? "OK" : "FEL"} — fabrikat: [${analys.fabrikat.join(", ") || "inga"}] generellt: ${analys.generell_observation}`);
  console.log(`    öppning: ${analys.oppning.slice(0, 160)}`);
}

mkdirSync(OUT_DIR, { recursive: true });
const fil = path.join(OUT_DIR, `a2-${AMNE.id}.json`);
writeFileSync(fil, JSON.stringify({
  amne_id: AMNE.id,
  tema: AMNE.tema,
  flode: "caption",
  genererad: new Date().toISOString(),
  fabrikat_totalt: poster.reduce((n, p) => n + ((p.analys as { fabrikat: string[] }).fabrikat.length), 0),
  poster,
}, null, 2), "utf8");
console.log(`\n→ ${fil}`);

// ── Städ ────────────────────────────────────────────────────────────────────
// 1. studio_posts: caption-flödet ska INTE skriva. Verifiera, radera annars.
const { data: nyaPoster } = await sb.from("studio_posts").select("id").in("client_id", IDS).gte("created_at", RUN_START);
console.log(`Städ studio_posts: ${(nyaPoster || []).length} nya rader (förväntat 0)`);
if ((nyaPoster || []).length) {
  await sb.from("studio_posts").delete().in("client_id", IDS).gte("created_at", RUN_START);
  const { data: kvar } = await sb.from("studio_posts").select("id").in("client_id", IDS).gte("created_at", RUN_START);
  console.log(`  raderade → ${(kvar || []).length} kvar (ska vara 0)`);
}
// 2. client_voice_profile: återställ om en fingerprint-ombyggnad hann skriva.
const snapshot = JSON.parse(readFileSync(SNAP_FIL, "utf8")) as Record<string, unknown>[];
const { data: voiceEfter } = await sb.from("client_voice_profile").select("*").in("client_id", IDS);
let aterstallda = 0;
for (const snap of snapshot) {
  const nu = (voiceEfter || []).find((r) => r.client_id === snap.client_id);
  if (nu && nu.last_built_at !== snap.last_built_at) {
    const { error } = await sb.from("client_voice_profile").upsert(snap, { onConflict: "client_id" });
    if (!error) aterstallda++;
    console.log(`  client_voice_profile ${snap.client_id} ombyggd → återställd${error ? ` (FEL: ${error.message})` : ""}`);
  }
}
console.log(`Städ client_voice_profile: ${aterstallda} återställda`);
console.log("KLART.");
