// TEXT-1 FÖRE-BATCH — genererar testtexter mot DAGENS kod (före promptmigrering).
// Mätning, inte förbättring. Ingen produktionskod ändras; "next/headers" shimmas via
// scripts/text1/tsconfig.json så lib-koden kan köras utanför Next-runtime med en
// riktig (HMAC-signerad) admin-session + active_client_id-kaka per profil.
//
// Körning:  npx tsx --tsconfig scripts/text1/tsconfig.json scripts/text1-batch.mts
//
// Bieffekter som städas efteråt (loggas + raderas + verifieras):
//   - linkedin_posts   (linkedin-flödet sparar utkast)
//   - hm_social_posts  (social-flödet sparar utkast)
//   - agent_experiments (iterateGenerate loggar experiment per studio-text-körning)
//   - client_activity   (logActivity i linkedin/social-flödet)
//   - client_voice_profile snapshotas före och återställs om getVoiceFingerprint
//     hann bygga om en >24h gammal fingerprint (upsert i dagens kod).

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

// ── 1. Env ────────────────────────────────────────────────────────────────────
const ROOT = process.cwd();
for (const line of readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}

// ── 2. Shim-kakor (admin-session + aktiv klient) ─────────────────────────────
const headersShim = (await import("next/headers")) as unknown as {
  __setBatchCookie: (n: string, v: string) => void;
};
const { createAdminSession, ADMIN_COOKIE } = await import("@/lib/admin-auth");
const ADMIN_TOKEN = await createAdminSession(process.env.ADMIN_SESSION_SECRET!);
headersShim.__setBatchCookie(ADMIN_COOKIE, ADMIN_TOKEN);

function setActiveClient(id: string) {
  headersShim.__setBatchCookie("active_client_id", id);
}

// ── 3. Beroenden ur kodbasen (dagens kod — inget dupliceras) ─────────────────
const { supabaseService } = await import("@/lib/supabase-admin");
const { raknaCta, harSvagHook } = await import("@/lib/content/writing-rules");
const { generateStudioCopy } = await import("@/lib/studio/copy");
const { generateCarousel } = await import("@/lib/studio/carousel");
const { generateNewsletter } = await import("@/lib/newsletter");
const { generateBlogArticle } = await import("@/lib/studio/blog");
const captionRoute = await import("@/app/api/studio/suggest-caption/route");
const linkedinRoute = await import("@/app/api/linkedin/draft/route");
const socialRoute = await import("@/app/api/social/generate/route");
const weekRoute = await import("@/app/api/generate/week/route");
const postRoute = await import("@/app/api/generate/post/route");

const sb = supabaseService();

// ── 4. Matris ────────────────────────────────────────────────────────────────
interface Profil { slug: string; name: string; id: string; industry: string }
const PROFILER: Profil[] = [
  { slug: "displayteknik", name: "Displayteknik", id: "a6a33547-5ca7-475f-9a62-43ff2c74d000", industry: "Digital signage & storformatsdisplayer" },
  { slug: "engens-trad", name: "Engens Träd & Trädgård", id: "e9e9e9e9-7e2d-4a2b-9c1f-e1ce115da001", industry: "Trädfällning & trädgårdstjänster" },
  { slug: "hm-motor", name: "HM Motor Krokom", id: "00000000-0000-0000-0000-000000000001", industry: "Bilhandel" },
  { slug: "annas-blommor", name: "Annas Blommor", id: "7461fa8b-3fcb-4729-9cf6-53e27687656e", industry: "Florist, bröllop & event" },
];

const amnenFil = JSON.parse(readFileSync(path.join(ROOT, "docs/text1/amnen.json"), "utf8")) as {
  amnen: { id: string; tema: string; underlag_artikel: string }[];
};
let AMNEN = amnenFil.amnen;

// Testläge: --test kör 1 profil × 1 ämne × alla flöden (validering före full batch).
const TEST_MODE = process.argv.includes("--test");
if (TEST_MODE) {
  AMNEN = AMNEN.slice(0, 1);
  PROFILER.splice(1);
  console.log("TESTLÄGE: 1 profil × 1 ämne × alla flöden");
}

// T-4: TEXT1_UT=docs/text1/efter för efter-batchen; TEXT1_SKIP=flöde1,flöde2 hoppar flöden.
const OUT_DIR = path.join(ROOT, process.env.TEXT1_UT || "docs/text1/fore");
const SKIP = new Set((process.env.TEXT1_SKIP || "").split(",").map((s) => s.trim()).filter(Boolean));
const SCRATCH = "C:/Users/hakan/AppData/Local/Temp/claude/C--Users-hakan-OneDrive-Dokument-Antigravity/69f20a37-dcf3-4038-aa77-5c740de668f9/scratchpad";

// ── 5. Autochecks ────────────────────────────────────────────────────────────
// Floskellistan = exakt orden som taBortFloskler ersätter.
const FLOSKLER: { namn: string; re: RegExp }[] = [
  { namn: "kraftfull", re: /\bkraftfull\w*\b/i },
  { namn: "banbrytande", re: /\bbanbrytande\b/i },
  { namn: "game-changer", re: /\bgame[-\s]?changer\b/i },
  { namn: "handlar om", re: /\bhandlar\s+om\b/i },
  { namn: "nästa nivå", re: /\bnästa\s+nivå\b/i },
  { namn: "holistisk", re: /\bholistisk\w*\b/i },
  { namn: "skalbar", re: /\bskalbar\w*\b/i },
];

interface VoiceMarkers { forbidden: string[]; markers: string[] }
const voiceByClient = new Map<string, VoiceMarkers>();

function tankstreckILoptext(text: string): boolean {
  for (const rad of String(text || "").split("\n")) {
    if (/^\s*[-–—*•]\s+\S/.test(rad)) continue; // punktlista — tillåten
    const utanIntervall = rad.replace(/(\d)\s?[–-]\s?(\d)/g, "$1$2"); // 10–12, 2020–2024
    if (/\s[–—]\s/.test(utanIntervall)) return true; // " – " / " — " som paus
    if (/—/.test(utanIntervall)) return true; // em-dash är aldrig korrekt i löptext
  }
  return false;
}

function autochecks(text: string, clientId: string) {
  const t = String(text || "");
  const low = t.toLowerCase();
  const v = voiceByClient.get(clientId) || { forbidden: [], markers: [] };
  const forbjudna = v.forbidden.filter((w) => w && low.includes(w.toLowerCase()));
  const traffade = v.markers.filter((w) => w && low.includes(w.toLowerCase()));
  return {
    cta_count: raknaCta(t),
    svag_hook: harSvagHook(t),
    forbjudna_ord: [...new Set(forbjudna)],
    floskler: FLOSKLER.filter((f) => f.re.test(t)).map((f) => f.namn),
    tankstreck_i_loptext: tankstreckILoptext(t),
    hashtags: (t.match(/#[\p{L}\p{N}_]+/gu) || []).length,
    rostmarkorer_traffade: [...new Set(traffade)].length,
    rostmarkorer_totalt: v.markers.length,
  };
}

// ── 6. Hjälpare ──────────────────────────────────────────────────────────────
function jsonReq(url: string, body: unknown): Request {
  return new Request(`http://localhost${url}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function callRoute(
  handler: (req: never) => Promise<Response>,
  url: string,
  body: unknown,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const res = await handler(jsonReq(url, body) as never);
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, json };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// 2 omtag vid fel (totalt 3 försök), sedan kastas felet vidare till loggning.
async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      console.log(`  [retry ${attempt}/3 misslyckades] ${label}: ${(e as Error).message?.slice(0, 200)}`);
      if (attempt < 3) await sleep(attempt === 1 ? 3000 : 8000);
    }
  }
  throw lastErr;
}

// Kör en lista uppgifter med begränsad parallellism.
async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return results;
}

const stripHtml = (h: string) => String(h || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const joinDelar = (delar: (string | undefined | null)[]) => delar.filter((d) => d && String(d).trim()).join("\n\n");

// ── 7. Flödesdefinitioner ────────────────────────────────────────────────────
interface FlowResult { output: string; text: string; extra?: Record<string, unknown> }
interface Flow {
  namn: string;
  concurrency: number;
  run: (p: Profil, amne: { id: string; tema: string; underlag_artikel: string }) => Promise<FlowResult>;
}

// Bieffektsspårning
const skapadeLinkedinIds: string[] = [];
const skapadeSocialIds: string[] = [];

const FLOWS: Flow[] = [
  {
    namn: "studio-text",
    concurrency: 1, // varje anrop kör 7 Anthropic-varianter internt
    run: async (p, amne) => {
      const fore = new Date().toISOString();
      const forslag = await generateStudioCopy({
        clientId: p.id,
        templateId: "ark-textkort",
        format: "1080x1350",
        topic: amne.tema,
        brandName: p.name,
        industry: p.industry,
      });
      if (!forslag.length) throw new Error("Inga förslag överlevde kvalitetsfiltren");
      // Vinnarens score loggas av iterateGenerate i agent_experiments — läs senaste raden.
      let score: number | null = null;
      try {
        const { data } = await sb
          .from("agent_experiments")
          .select("winner_score")
          .eq("client_id", p.id)
          .eq("type", "studio_copy")
          .gte("created_at", fore)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        score = (data?.winner_score as number | null) ?? null;
      } catch {}
      const vinnare = forslag[0];
      return {
        output: JSON.stringify(vinnare),
        text: joinDelar([vinnare.headline1, vinnare.headline2, vinnare.body]),
        extra: { voice_score_vinnare: score, alla_forslag: forslag },
      };
    },
  },
  {
    namn: "caption",
    concurrency: 3,
    run: async (_p, amne) => {
      const { status, json } = await callRoute(captionRoute.POST, "/api/studio/suggest-caption", {
        topic: amne.tema,
        postType: "post",
      });
      if (status !== 200 || !json.caption) throw new Error(`HTTP ${status}: ${JSON.stringify(json).slice(0, 200)}`);
      const caption = String(json.caption);
      return { output: caption, text: caption };
    },
  },
  {
    namn: "karusell",
    concurrency: 3,
    run: async (p, amne) => {
      const { slides } = await generateCarousel({ clientId: p.id, topic: amne.tema, brandName: p.name, industry: p.industry });
      if (!slides.length) throw new Error("Tom slide-array");
      return {
        output: JSON.stringify(slides),
        text: slides.map((s) => joinDelar([s.headline, s.body])).join("\n\n"),
      };
    },
  },
  {
    namn: "linkedin",
    concurrency: 2,
    run: async (_p, amne) => {
      const { status, json } = await callRoute(linkedinRoute.POST, "/api/linkedin/draft", {
        angle: amne.tema,
        length: "medium",
        format: "text",
      });
      if (status !== 200 || !json.draft) throw new Error(`HTTP ${status}: ${JSON.stringify(json).slice(0, 200)}`);
      const post = json.post as { id?: string } | null;
      if (post?.id) skapadeLinkedinIds.push(post.id);
      const d = json.draft as { hook?: string; body?: string; cta?: string; hashtags?: string };
      return {
        output: JSON.stringify(json.draft),
        text: joinDelar([d.hook, d.body, d.cta, d.hashtags]),
        extra: { voice_score: json.voice_score ?? null, sparad_rad_id: post?.id ?? null },
      };
    },
  },
  {
    namn: "social",
    concurrency: 2,
    run: async (_p, amne) => {
      const { status, json } = await callRoute(socialRoute.POST, "/api/social/generate", {
        platform: "instagram",
        format: "post",
        angle: amne.tema,
      });
      if (status !== 200 || !json.generated) throw new Error(`HTTP ${status}: ${JSON.stringify(json).slice(0, 200)}`);
      const post = json.post as { id?: string } | null;
      if (post?.id) skapadeSocialIds.push(post.id);
      const g = json.generated as { hook?: string; caption?: string; cta?: string; hashtags?: string };
      return {
        output: JSON.stringify(json.generated),
        text: joinDelar([g.hook, g.caption, g.cta, g.hashtags]),
        extra: { sparad_rad_id: post?.id ?? null },
      };
    },
  },
  {
    namn: "nyhetsbrev",
    concurrency: 2,
    run: async (p, amne) => {
      const nb = await generateNewsletter({
        clientId: p.id,
        title: amne.tema,
        articleText: amne.underlag_artikel,
        brandName: p.name,
      });
      if (!nb.intro && !nb.sections.length) throw new Error("Tomt nyhetsbrev");
      return {
        output: JSON.stringify(nb),
        text: joinDelar([nb.greeting, nb.intro, ...nb.sections.map((s) => joinDelar([s.heading, s.body])), nb.cta_text, nb.signoff]),
      };
    },
  },
  {
    namn: "blogg",
    concurrency: 2,
    run: async (p, amne) => {
      const art = await generateBlogArticle({ clientId: p.id, topic: amne.tema, brandName: p.name, industry: p.industry });
      if (!art.html) throw new Error("Tom artikel-HTML");
      return {
        output: JSON.stringify(art),
        text: joinDelar([art.title, stripHtml(art.html)]),
      };
    },
  },
  {
    namn: "veckoplan",
    concurrency: 2,
    run: async (_p, amne) => {
      // Klassiska vägen (ingen body.compass) — sparar INGET i databasen.
      const { status, json } = await callRoute(weekRoute.POST, "/api/generate/week", { theme: amne.tema });
      if (status !== 200 || !Array.isArray(json.days)) throw new Error(`HTTP ${status}: ${JSON.stringify(json).slice(0, 200)}`);
      const days = json.days as { day?: string; hook?: string; body?: string; cta?: string; hashtags?: string[] }[];
      // Alla 7 dagarnas texter som EN post.
      const text = days
        .map((d) => joinDelar([d.day ? `${d.day}:` : "", d.hook, d.body, d.cta, (d.hashtags || []).map((h) => `#${h}`).join(" ")]))
        .join("\n\n---\n\n");
      return { output: JSON.stringify(json), text };
    },
  },
  {
    namn: "enskilt",
    concurrency: 2,
    run: async (_p, amne) => {
      const { status, json } = await callRoute(postRoute.POST, "/api/generate/post", {
        topic: amne.tema,
        format: "single",
        platform: "instagram",
      });
      if (status !== 200 || !Array.isArray(json.variants) || !(json.variants as unknown[]).length) {
        throw new Error(`HTTP ${status}: ${JSON.stringify(json).slice(0, 200)}`);
      }
      const v = (json.variants as { hook?: string; body?: string; cta?: string; hashtags?: string[] }[])[0];
      // Autochecks på bästa (först sorterade) variantens sammanfogade kundtext.
      const text = joinDelar([v.hook, v.body, v.cta, (v.hashtags || []).map((h) => `#${h}`).join(" ")]);
      return { output: JSON.stringify(json), text };
    },
  },
];

// ── 8. Förberedelser: voice-markörer + snapshot ──────────────────────────────
const ids = PROFILER.map((p) => p.id);
const { data: voiceRows } = await sb
  .from("client_voice_profile")
  .select("*")
  .in("client_id", ids);
for (const row of voiceRows || []) {
  voiceByClient.set(row.client_id as string, {
    forbidden: ((row.forbidden_words as string[]) || []).filter(Boolean),
    markers: [
      ...((row.signature_phrases as string[]) || []),
      ...((row.pain_words as string[]) || []),
      ...((row.joy_words as string[]) || []),
    ].filter(Boolean),
  });
}
// Snapshot (utanför repot) — återställs om en fingerprint-ombyggnad hann skriva.
writeFileSync(path.join(SCRATCH, "voice_profile_snapshot.json"), JSON.stringify(voiceRows || [], null, 2));

const RUN_START = new Date().toISOString();
console.log(`TEXT-1 FÖRE-BATCH startar ${RUN_START} — ${PROFILER.length} profiler × ${FLOWS.length} flöden × ${AMNEN.length} ämnen`);

// ── 9. Kör matrisen ──────────────────────────────────────────────────────────
interface PostResult {
  amne_id: string;
  tema: string;
  output: string | null;
  duration_ms: number;
  fel?: string;
  autochecks?: ReturnType<typeof autochecks>;
  extra?: Record<string, unknown>;
}

const summering: { profil: string; flode: string; ok: number; fel: number }[] = [];
const batchStartMs = Date.now();
let totalOutputChars = 0;

for (const profil of PROFILER) {
  setActiveClient(profil.id);
  mkdirSync(path.join(OUT_DIR, profil.slug), { recursive: true });
  console.log(`\n=== PROFIL: ${profil.name} (${profil.id}) ===`);

  for (const flow of FLOWS) {
    if (SKIP.has(flow.namn)) { console.log(`  [hoppar ${flow.namn} — TEXT1_SKIP]`); continue; }
    const t0 = Date.now();
    const poster: PostResult[] = await pool(AMNEN, flow.concurrency, async (amne) => {
      const start = Date.now();
      try {
        const r = await withRetry(() => flow.run(profil, amne), `${profil.slug}/${flow.namn}/${amne.id}`);
        totalOutputChars += r.output.length;
        return {
          amne_id: amne.id,
          tema: amne.tema,
          output: r.output,
          duration_ms: Date.now() - start,
          autochecks: autochecks(r.text, profil.id),
          ...(r.extra ? { extra: r.extra } : {}),
        };
      } catch (e) {
        return {
          amne_id: amne.id,
          tema: amne.tema,
          output: null,
          duration_ms: Date.now() - start,
          fel: (e as Error).message?.slice(0, 500) || "okänt fel",
        };
      }
    });

    const ok = poster.filter((p) => p.output !== null).length;
    summering.push({ profil: profil.slug, flode: flow.namn, ok, fel: poster.length - ok });
    const fil = path.join(OUT_DIR, profil.slug, `${flow.namn}.json`);
    writeFileSync(
      fil,
      JSON.stringify(
        { profil: profil.name, client_id: profil.id, flode: flow.namn, genererad: new Date().toISOString(), poster },
        null,
        2,
      ),
      "utf8",
    );
    console.log(`  ${flow.namn}: ${ok}/${poster.length} ok (${Math.round((Date.now() - t0) / 1000)}s) → ${path.relative(ROOT, fil)}`);
  }
}

// ── 10. Städa bieffekter ─────────────────────────────────────────────────────
console.log("\n=== STÄDNING AV BIEFFEKTER ===");
const stadning: string[] = [];

async function deleteAndVerify(tabell: string, filter: (q: any) => any, beskrivning: string) {
  try {
    const del = filter(sb.from(tabell).delete()).select("id");
    const { data: raderade, error } = await del;
    if (error) throw error;
    const { data: kvar } = await filter(sb.from(tabell).select("id"));
    const rader = (raderade || []).map((r: { id: string }) => r.id);
    stadning.push(`${tabell}: ${rader.length} raderade (${beskrivning}) — kvar efter verifiering: ${(kvar || []).length}. Ids: ${rader.join(", ") || "-"}`);
    console.log(`  ${tabell}: raderade ${rader.length}, kvar ${(kvar || []).length}`);
  } catch (e) {
    stadning.push(`${tabell}: FEL vid städning — ${(e as Error).message}`);
    console.log(`  ${tabell}: FEL — ${(e as Error).message}`);
  }
}

if (skapadeLinkedinIds.length) {
  await deleteAndVerify("linkedin_posts", (q: any) => q.in("id", skapadeLinkedinIds), "linkedin-flödets utkast");
} else stadning.push("linkedin_posts: inga rader skapades");

if (skapadeSocialIds.length) {
  await deleteAndVerify("hm_social_posts", (q: any) => q.in("id", skapadeSocialIds), "social-flödets utkast");
} else stadning.push("hm_social_posts: inga rader skapades");

await deleteAndVerify("agent_experiments", (q: any) => q.in("client_id", ids).gte("created_at", RUN_START), "iterateGenerate-loggar under körningen");
await deleteAndVerify(
  "client_activity",
  (q: any) => q.in("client_id", ids).gte("created_at", RUN_START).in("type", ["linkedin_draft", "social_generated"]),
  "logActivity under körningen",
);

// Verifiera att veckoplan-klassiska vägen inte sparade något
const { data: veckoRester } = await sb.from("studio_posts").select("id").in("client_id", ids).gte("created_at", RUN_START);
stadning.push(`studio_posts: ${(veckoRester || []).length} nya rader under körningen (förväntat 0)`);
if ((veckoRester || []).length) {
  await deleteAndVerify("studio_posts", (q: any) => q.in("client_id", ids).gte("created_at", RUN_START), "oväntade veckoplan-rader");
}

// Återställ client_voice_profile om en fingerprint-ombyggnad hann skriva
const snapshot = JSON.parse(readFileSync(path.join(SCRATCH, "voice_profile_snapshot.json"), "utf8")) as Record<string, unknown>[];
const { data: nuRows } = await sb.from("client_voice_profile").select("*").in("client_id", ids);
let aterstallda = 0;
for (const snap of snapshot) {
  const nu = (nuRows || []).find((r) => r.client_id === snap.client_id);
  if (nu && nu.last_built_at !== snap.last_built_at) {
    const { error } = await sb.from("client_voice_profile").upsert(snap, { onConflict: "client_id" });
    if (!error) aterstallda++;
    stadning.push(`client_voice_profile: ${snap.client_id} ombyggd under körningen → återställd till snapshot${error ? ` (FEL: ${error.message})` : ""}`);
  }
}
if (!aterstallda) stadning.push("client_voice_profile: oförändrad under körningen (ingen återställning behövdes)");
console.log(`  client_voice_profile: ${aterstallda} återställda`);

// ── 11. Spara körmetadata för SAMMANFATTNING ─────────────────────────────────
const meta = {
  run_start: RUN_START,
  run_slut: new Date().toISOString(),
  total_korntid_s: Math.round((Date.now() - batchStartMs) / 1000),
  total_output_tecken: totalOutputChars,
  token_uppskattning_ut: Math.round(totalOutputChars / 4),
  summering,
  stadning,
};
writeFileSync(path.join(SCRATCH, "text1-run-meta.json"), JSON.stringify(meta, null, 2), "utf8");
console.log("\nKLART. Metadata → scratchpad/text1-run-meta.json");
console.log(JSON.stringify(summering, null, 2));
