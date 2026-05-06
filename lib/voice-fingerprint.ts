// lib/voice-fingerprint.ts
// Bygger en kompakt "voice-fingerprint" per klient som matas in i alla genereringar.
// Källor: client_assets (post/audio/video transkription/testimonial) + brand-profile.

import { supabaseService } from "./supabase-admin";
import { generate } from "./gemini";

export interface VoiceFingerprint {
  client_id: string;
  signature_phrases: string[];
  forbidden_words: string[];
  tone_summary: string;
  rhythm_notes: string;
  pain_words: string[];
  joy_words: string[];
  source_asset_count: number;
  raw_samples: string[]; // 3-8 verkliga inlägg som AI läser direkt
  built_at: string;
}

const STALE_HOURS = 24;

export async function getVoiceFingerprint(clientId: string, opts?: { force?: boolean }): Promise<VoiceFingerprint> {
  const sb = supabaseService();

  if (!opts?.force) {
    const { data: cached } = await sb
      .from("client_voice_profile")
      .select("*")
      .eq("client_id", clientId)
      .maybeSingle();

    if (cached?.last_built_at) {
      const ageMs = Date.now() - new Date(cached.last_built_at as string).getTime();
      if (ageMs < STALE_HOURS * 3600 * 1000) {
        const samples = await fetchRawSamples(clientId);
        return {
          client_id: clientId,
          signature_phrases: cached.signature_phrases || [],
          forbidden_words: cached.forbidden_words || [],
          tone_summary: cached.tone_summary || "",
          rhythm_notes: cached.rhythm_notes || "",
          pain_words: cached.pain_words || [],
          joy_words: cached.joy_words || [],
          source_asset_count: cached.source_asset_count || 0,
          raw_samples: samples,
          built_at: cached.last_built_at as string,
        };
      }
    }
  }

  return await rebuildVoiceFingerprint(clientId);
}

async function fetchRawSamples(clientId: string, limit = 8): Promise<string[]> {
  const sb = supabaseService();
  const { data } = await sb
    .from("client_assets")
    .select("body, asset_type")
    .eq("client_id", clientId)
    .eq("status", "active")
    .in("asset_type", ["post", "audio", "video"])
    .not("body", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data || []).map((d) => (d as { body: string }).body).filter((b) => b && b.length > 30);
}

export async function rebuildVoiceFingerprint(clientId: string): Promise<VoiceFingerprint> {
  const sb = supabaseService();

  const { data: assets } = await sb
    .from("client_assets")
    .select("body, asset_type")
    .eq("client_id", clientId)
    .eq("status", "active")
    .in("asset_type", ["post", "audio", "video", "testimonial"])
    .not("body", "is", null)
    .limit(30);

  const samples = (assets || [])
    .map((a) => (a as { body: string; asset_type: string }))
    .filter((a) => a.body && a.body.length > 20);

  const { data: profile } = await sb
    .from("hm_brand_profile")
    .select("tone_rules, dos, donts, customer_quotes")
    .eq("client_id", clientId)
    .maybeSingle();

  // Med få samples — returnera basversion baserad på brand-profile
  if (samples.length === 0) {
    const fp: VoiceFingerprint = {
      client_id: clientId,
      signature_phrases: [],
      forbidden_words: extractWordsList(profile?.donts || ""),
      tone_summary: profile?.tone_rules || "",
      rhythm_notes: "",
      pain_words: [],
      joy_words: [],
      source_asset_count: 0,
      raw_samples: [],
      built_at: new Date().toISOString(),
    };
    await persistFingerprint(fp);
    return fp;
  }

  // Bygg via Gemini
  const corpus = samples
    .map((s, i) => `--- Exempel ${i + 1} (${s.asset_type}) ---\n${s.body.slice(0, 1500)}`)
    .join("\n\n");

  const prompt = `Du är språkanalytiker. Analysera följande exempel som personen själv har skrivit eller sagt. Extrahera deras språkliga fingeravtryck.

${corpus}

Returnera JSON exakt enligt detta schema (ingen text utanför JSON):
{
  "signature_phrases": ["..."],     // 5-10 typiska fraser/uttryck personen använder
  "tone_summary": "...",            // 2-3 meningar: hur låter de? formell/informell, kort/lång, frågor/påståenden
  "rhythm_notes": "...",            // meningslängd, talspråk, tvekljud, personliga tics
  "pain_words": ["..."],            // ord/uttryck för smärta/frustration som dyker upp
  "joy_words": ["..."],             // ord/uttryck för glädje/tillfredsställelse
  "forbidden_inferred": ["..."]     // ord personen ALDRIG verkar använda (gissa baserat på stil)
}

Skriv på svenska. Var konkret — citera ordagrant från exemplen om möjligt.`;

  let parsed: {
    signature_phrases?: string[];
    tone_summary?: string;
    rhythm_notes?: string;
    pain_words?: string[];
    joy_words?: string[];
    forbidden_inferred?: string[];
  } = {};
  try {
    const raw = await generate({
      model: "gemini-2.5-pro",
      prompt,
      temperature: 0.3,
      maxOutputTokens: 2000,
      jsonMode: true,
    });
    parsed = JSON.parse(raw);
  } catch (e) {
    console.error("[voice-fingerprint] Gemini-fel:", e);
  }

  // Räkna bara klientens egen röst — testimonials är kundröst (annat)
  const ownVoiceCount = samples.filter((s) => s.asset_type !== "testimonial").length;

  const fp: VoiceFingerprint = {
    client_id: clientId,
    signature_phrases: parsed.signature_phrases || [],
    forbidden_words: [
      ...extractWordsList(profile?.donts || ""),
      ...(parsed.forbidden_inferred || []),
    ],
    tone_summary: parsed.tone_summary || profile?.tone_rules || "",
    rhythm_notes: parsed.rhythm_notes || "",
    pain_words: parsed.pain_words || [],
    joy_words: parsed.joy_words || [],
    source_asset_count: ownVoiceCount,
    raw_samples: samples
      .filter((s) => s.asset_type !== "testimonial")
      .slice(0, 6)
      .map((s) => s.body.slice(0, 800)),
    built_at: new Date().toISOString(),
  };

  await persistFingerprint(fp);
  return fp;
}

async function persistFingerprint(fp: VoiceFingerprint) {
  const sb = supabaseService();
  await sb.from("client_voice_profile").upsert(
    {
      client_id: fp.client_id,
      signature_phrases: fp.signature_phrases,
      forbidden_words: fp.forbidden_words,
      tone_summary: fp.tone_summary,
      rhythm_notes: fp.rhythm_notes,
      pain_words: fp.pain_words,
      joy_words: fp.joy_words,
      source_asset_count: fp.source_asset_count,
      last_built_at: fp.built_at,
    },
    { onConflict: "client_id" }
  );
}

function extractWordsList(text: string): string[] {
  return text
    .split(/[\n,;]+/)
    .map((s) => s.trim().replace(/^["'-]+|["']+$/g, ""))
    .filter((s) => s.length > 1 && s.length < 50);
}

// Bygger en prompt-sektion som matas in i generator-anrop
export function fingerprintToPromptBlock(fp: VoiceFingerprint): string {
  const lines: string[] = [];
  lines.push("=== KUNDENS RÖST (måste imiteras) ===");

  if (fp.tone_summary) {
    lines.push(`TON: ${fp.tone_summary}`);
  }
  if (fp.rhythm_notes) {
    lines.push(`RYTM: ${fp.rhythm_notes}`);
  }
  if (fp.signature_phrases.length > 0) {
    lines.push(`TYPISKA UTTRYCK (använd där det passar): ${fp.signature_phrases.join(" · ")}`);
  }
  if (fp.pain_words.length > 0) {
    lines.push(`SMÄRTORD (när du beskriver problem): ${fp.pain_words.join(", ")}`);
  }
  if (fp.joy_words.length > 0) {
    lines.push(`GLÄDJEORD (när du beskriver lösning): ${fp.joy_words.join(", ")}`);
  }
  if (fp.forbidden_words.length > 0) {
    lines.push(`ANVÄND ALDRIG: ${fp.forbidden_words.join(", ")}`);
  }

  if (fp.raw_samples.length > 0) {
    lines.push("");
    lines.push("=== VERKLIGA INLÄGG SOM PERSONEN SJÄLV SKRIVIT (skriv som dessa) ===");
    fp.raw_samples.slice(0, 4).forEach((s, i) => {
      lines.push(`Exempel ${i + 1}:\n${s}`);
      lines.push("");
    });
  }

  if (fp.source_asset_count === 0) {
    lines.push(
      "VARNING: Kunden har INTE laddat in egna inlägg/inspelningar än. " +
        "Skriv neutralt och försiktigt — undvik att hitta på en röst som inte är deras."
    );
  }

  return lines.join("\n");
}
