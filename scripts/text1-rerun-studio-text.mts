// TEXT-1 — riktad omkörning av studio-text för profiler vars Anthropic-anrop föll
// under före-batchen (nätverksavbrott). Samma anropsväg och filformat som
// scripts/text1-batch.mts, bara flödet studio-text × angivna profiler.
//
// Körning: npx tsx --tsconfig scripts/text1/tsconfig.json scripts/text1-rerun-studio-text.mts

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
for (const line of readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}

const headersShim = (await import("next/headers")) as unknown as {
  __setBatchCookie: (n: string, v: string) => void;
};
const { createAdminSession, ADMIN_COOKIE } = await import("@/lib/admin-auth");
headersShim.__setBatchCookie(ADMIN_COOKIE, await createAdminSession(process.env.ADMIN_SESSION_SECRET!));

const { supabaseService } = await import("@/lib/supabase-admin");
const { raknaCta, harSvagHook } = await import("@/lib/content/writing-rules");
const { generateStudioCopy } = await import("@/lib/studio/copy");
const sb = supabaseService();

const PROFILER = [
  { slug: "engens-trad", name: "Engens Träd & Trädgård", id: "e9e9e9e9-7e2d-4a2b-9c1f-e1ce115da001", industry: "Trädfällning & trädgårdstjänster" },
  { slug: "hm-motor", name: "HM Motor Krokom", id: "00000000-0000-0000-0000-000000000001", industry: "Bilhandel" },
  { slug: "annas-blommor", name: "Annas Blommor", id: "7461fa8b-3fcb-4729-9cf6-53e27687656e", industry: "Florist, bröllop & event" },
];
const AMNEN = (JSON.parse(readFileSync(path.join(ROOT, "docs/text1/amnen.json"), "utf8")) as {
  amnen: { id: string; tema: string; underlag_artikel: string }[];
}).amnen;
const OUT_DIR = path.join(ROOT, "docs/text1/fore");

// Autochecks — identiska med text1-batch.mts (batchskriptet kan inte importeras: det kör matrisen vid import).
const FLOSKLER: { namn: string; re: RegExp }[] = [
  { namn: "kraftfull", re: /\bkraftfull\w*\b/i },
  { namn: "banbrytande", re: /\bbanbrytande\b/i },
  { namn: "game-changer", re: /\bgame[-\s]?changer\b/i },
  { namn: "handlar om", re: /\bhandlar\s+om\b/i },
  { namn: "nästa nivå", re: /\bnästa\s+nivå\b/i },
  { namn: "holistisk", re: /\bholistisk\w*\b/i },
  { namn: "skalbar", re: /\bskalbar\w*\b/i },
];
function tankstreckILoptext(text: string): boolean {
  for (const rad of String(text || "").split("\n")) {
    if (/^\s*[-–—*•]\s+\S/.test(rad)) continue;
    const utanIntervall = rad.replace(/(\d)\s?[–-]\s?(\d)/g, "$1$2");
    if (/\s[–—]\s/.test(utanIntervall)) return true;
    if (/—/.test(utanIntervall)) return true;
  }
  return false;
}
const voiceByClient = new Map<string, { forbidden: string[]; markers: string[] }>();
const { data: voiceRows } = await sb.from("client_voice_profile").select("*").in("client_id", PROFILER.map((p) => p.id));
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
function autochecks(text: string, clientId: string) {
  const t = String(text || "");
  const low = t.toLowerCase();
  const v = voiceByClient.get(clientId) || { forbidden: [], markers: [] };
  return {
    cta_count: raknaCta(t),
    svag_hook: harSvagHook(t),
    forbjudna_ord: [...new Set(v.forbidden.filter((w) => w && low.includes(w.toLowerCase())))],
    floskler: FLOSKLER.filter((f) => f.re.test(t)).map((f) => f.namn),
    tankstreck_i_loptext: tankstreckILoptext(t),
    hashtags: (t.match(/#[\p{L}\p{N}_]+/gu) || []).length,
    rostmarkorer_traffade: [...new Set(v.markers.filter((w) => w && low.includes(w.toLowerCase())))].length,
    rostmarkorer_totalt: v.markers.length,
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const joinDelar = (delar: (string | undefined | null)[]) => delar.filter((d) => d && String(d).trim()).join("\n\n");
const RUN_START = new Date().toISOString();

for (const p of PROFILER) {
  headersShim.__setBatchCookie("active_client_id", p.id);
  mkdirSync(path.join(OUT_DIR, p.slug), { recursive: true });
  console.log(`\n=== ${p.name} — studio-text ===`);
  const poster: Record<string, unknown>[] = [];
  for (const amne of AMNEN) {
    const t0 = Date.now();
    let post: Record<string, unknown>;
    let lastErr = "";
    let done = false;
    for (let f = 1; f <= 3 && !done; f++) {
      try {
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
        const text = joinDelar([vinnare.headline1, vinnare.headline2, vinnare.body]);
        post = {
          amne_id: amne.id,
          tema: amne.tema,
          output: JSON.stringify(vinnare),
          duration_ms: Date.now() - t0,
          autochecks: autochecks(text, p.id),
          extra: { voice_score_vinnare: score, alla_forslag: forslag, omkord: RUN_START },
        };
        done = true;
      } catch (e) {
        lastErr = (e as Error).message?.slice(0, 200) || "okänt fel";
        console.log(`  [försök ${f}/3] ${amne.id}: ${lastErr}`);
        if (f < 3) await sleep(f === 1 ? 3000 : 8000);
      }
    }
    if (!done) post = { amne_id: amne.id, tema: amne.tema, output: null, duration_ms: Date.now() - t0, fel: lastErr };
    poster.push(post!);
    console.log(`  ${amne.id}: ${done ? "OK" : "FEL: " + lastErr} (${post!.duration_ms} ms)`);
  }
  const fil = path.join(OUT_DIR, p.slug, "studio-text.json");
  writeFileSync(fil, JSON.stringify({ profil: p.name, client_id: p.id, flode: "studio-text", genererad: new Date().toISOString(), poster }, null, 2));
  console.log(`  → ${fil}`);
}

// Städ: iterateGenerate loggar agent_experiments per körning — radera det som skapades nu.
const { data: exp } = await sb
  .from("agent_experiments")
  .delete()
  .in("client_id", PROFILER.map((p) => p.id))
  .gte("created_at", RUN_START)
  .select("id");
console.log(`\nStädat agent_experiments: ${exp?.length ?? 0} rader raderade.`);
const { data: kvar } = await sb
  .from("agent_experiments")
  .select("id")
  .in("client_id", PROFILER.map((p) => p.id))
  .gte("created_at", RUN_START);
console.log(`Verifiering: ${kvar?.length ?? 0} rader kvar (ska vara 0).`);
console.log("KLART.");
