import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const KNOWLEDGE_DIR = path.join(process.cwd(), "knowledge");

let cache: Map<string, string> | null = null;

async function loadAll(): Promise<Map<string, string>> {
  if (cache) return cache;
  const map = new Map<string, string>();
  try {
    const files = await readdir(KNOWLEDGE_DIR);
    for (const f of files) {
      if (!f.endsWith(".md")) continue;
      const content = await readFile(path.join(KNOWLEDGE_DIR, f), "utf8");
      map.set(f.replace(/\.md$/, ""), content);
    }
  } catch (e) {
    console.error("knowledge load error", e);
  }
  cache = map;
  return map;
}

export async function getKnowledge(...names: string[]): Promise<string> {
  const all = await loadAll();
  const staticPart = names
    .map((n) => {
      const c = all.get(n);
      return c ? `# ═══ ${n} ═══\n\n${c}` : "";
    })
    .filter(Boolean)
    .join("\n\n");

  const profile = await getProfileAsMarkdown();
  return profile ? `${profile}\n\n${staticPart}` : staticPart;
}

export async function getProfileAsMarkdown(): Promise<string> {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const { getActiveClientId } = await import("./client-context");
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    );
    const clientId = await getActiveClientId();
    const { data } = await sb.from("hm_brand_profile").select("*").eq("client_id", clientId).maybeSingle();
    if (!data) return "";

    const sections: [string, string | null][] = [
      ["Företagsnamn", data.company_name],
      ["Tagline", data.tagline],
      ["Plats", data.location],
      ["Grundare", data.founder_name],
      ["Kontakt", [data.founder_phone, data.founder_email].filter(Boolean).join(" · ")],
      ["Brand story", data.brand_story],
      ["USP (det som skiljer oss)", data.usp],
      ["Tonregler", data.tone_rules],
      ["Primär ICP", data.icp_primary],
      ["Sekundär ICP", data.icp_secondary],
      ["Smärtpunkter kunden har", data.pain_points],
      ["Voice of Customer (kundord)", data.customer_quotes],
      ["Konkurrenter", data.competitors],
      ["Kundresa", data.customer_journey],
      ["GÖR", data.dos],
      ["GÖR INTE", data.donts],
      ["Hashtag-bas", data.hashtags_base],
    ];

    const body = sections
      .filter(([, v]) => v && String(v).trim())
      .map(([k, v]) => `## ${k}\n${v}`)
      .join("\n\n");

    // Customer Voice — exakta kund-fraser per kategori (delas av ALLA generatorer)
    let customerVoiceBlock = "";
    try {
      const { data: cv } = await sb
        .from("customer_voice")
        .select("phrase, category, context")
        .eq("client_id", clientId)
        .eq("archived", false)
        .order("created_at", { ascending: false })
        .limit(40);
      if (cv && cv.length > 0) {
        const grouped: Record<string, { phrase: string; context: string | null }[]> = {};
        for (const row of cv) {
          const k = row.category || "vocabulary";
          (grouped[k] ||= []).push({ phrase: row.phrase, context: row.context });
        }
        const order = ["pain", "desire", "objection", "transformation", "catchphrase", "vocabulary"];
        const labels: Record<string, string> = {
          pain: "Smärtformuleringar (kundens egna ord)",
          desire: "Drömformuleringar",
          objection: "Invändningar",
          transformation: "Transformationscitat",
          catchphrase: "Catchphrases / signaturuttryck",
          vocabulary: "Övriga ord/fraser",
        };
        const parts: string[] = [];
        for (const k of order) {
          if (!grouped[k]) continue;
          parts.push(`## ${labels[k] ?? k}\n` + grouped[k].map((r) => `- "${r.phrase}"${r.context ? ` _(${r.context.slice(0, 80)})_` : ""}`).join("\n"));
        }
        if (parts.length > 0) customerVoiceBlock = `\n\n# ═══ Customer Voice (exakta kundord — använd dem ordagrant där de passar) ═══\n\n${parts.join("\n\n")}`;
      }
    } catch {}

    // Story-bank — konkreta berättelser från intake (delas av ALLA generatorer)
    let storyBlock = "";
    try {
      const { data: stories } = await sb
        .from("linkedin_posts")
        .select("hook, idea_seed, notes, pillar")
        .eq("client_id", clientId)
        .eq("source_module", "intake")
        .in("status", ["idea", "draft", "approved", "posted"])
        .order("created_at", { ascending: false })
        .limit(15);
      if (stories && stories.length > 0) {
        const items = stories
          .map((s) => `- **${s.hook ?? ""}**${s.pillar ? ` _(pelare: ${s.pillar})_` : ""}\n  ${s.idea_seed ?? ""}`)
          .join("\n\n");
        storyBlock = `\n\n# ═══ Story-bank (konkreta berättelser från Zoom/intervjuer — bryggor till alla format) ═══\n\n${items}`;
      }
    } catch {}

    // Voice fingerprint som inline-block (om finns) — delas av ALLA generatorer
    let voiceBlock = "";
    try {
      const { data: voice } = await sb
        .from("client_voice_profile")
        .select("signature_phrases, forbidden_words, pain_words, joy_words, tone_summary, rhythm_notes")
        .eq("client_id", clientId)
        .maybeSingle();
      if (voice) {
        const lines: string[] = [];
        if (voice.tone_summary) lines.push(`**Ton:** ${voice.tone_summary}`);
        if (voice.rhythm_notes) lines.push(`**Rytm:** ${voice.rhythm_notes}`);
        if (voice.signature_phrases?.length) lines.push(`**Signaturfraser (använd dessa ordagrant där det passar):** ${voice.signature_phrases.join(" · ")}`);
        if (voice.forbidden_words?.length) lines.push(`**Förbjudna ord (skriv ALDRIG):** ${voice.forbidden_words.join(" · ")}`);
        if (voice.pain_words?.length) lines.push(`**Smärt-ord:** ${voice.pain_words.join(" · ")}`);
        if (voice.joy_words?.length) lines.push(`**Glädje-ord:** ${voice.joy_words.join(" · ")}`);
        if (lines.length) voiceBlock = `\n\n# ═══ Voice fingerprint ═══\n\n${lines.join("\n\n")}`;
      }
    } catch {}

    return body ? `# ═══ brand-profile (live från dashboard) ═══\n\n${body}${voiceBlock}${customerVoiceBlock}${storyBlock}` : `${voiceBlock}${customerVoiceBlock}${storyBlock}`.trim();
  } catch {
    return "";
  }
}

export async function getAllKnowledge(): Promise<string> {
  const all = await loadAll();
  return Array.from(all.entries())
    .map(([name, content]) => `# ═══ ${name} ═══\n\n${content}`)
    .join("\n\n");
}
