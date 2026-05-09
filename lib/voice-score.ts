// lib/voice-score.ts
// Scoring av AI-output mot kundens voice-fingerprint + winning examples + anti-AI-regler.
// Returnerar 0-100 + issues. Anvands av iterate.ts for att valja basta variant.

import type { VoiceFingerprint } from "./voice-fingerprint";
import { supabaseService } from "./supabase-admin";

export interface VoiceScore {
  total: number; // 0-100
  breakdown: {
    forbidden_word_hits: number; // ord som inte far finnas
    ai_cliche_hits: number;      // generiska AI-fraser
    signature_phrase_hits: number; // typiska uttryck som BOR finnas
    length_fit: number;          // 0-1, matchar rytm-noteringar
    winning_example_similarity: number; // 0-1
  };
  issues: string[];
  score_hint: string; // kort feedback for prompt-iteration
}

// Forbjudna AI-floskler (svensk lista, fran CLAUDE.md + utvidgad)
const AI_CLICHES = [
  "kraftfull", "banbrytande", "game-changer", "game changer",
  "handlar om", "nasta niva", "nasta niva",
  "holistisk", "skalbar",
  "i dagens snabba", "i dagens snabbrorliga",
  "synergier", "synergi",
  "ekosystem", "ecosystem",
  "transformativ", "revolutionerande",
  "djupgaende", "robust",
  "leverera vardefulla insikter", "vardefulla insikter",
  "for att summera", "sammanfattningsvis",
  "lat oss dyka in", "lat oss utforska",
  "i en tid dar", "i en varld dar",
  "det ar viktigt att notera", "viktigt att namna",
  "i sin essens", "i grunden handlar det om",
  "navigera utmaningarna", "navigera landskapet",
];

export interface ScoreOptions {
  fingerprint: VoiceFingerprint;
  winningExamples?: string[]; // Hakan-godkanda exempel
  targetLength?: { min: number; max: number }; // ord
}

export function scoreOutput(text: string, opts: ScoreOptions): VoiceScore {
  const lower = text.toLowerCase();
  const issues: string[] = [];

  // 1. Forbjudna ord (fran fingerprint)
  let forbidden_word_hits = 0;
  for (const w of opts.fingerprint.forbidden_words) {
    if (!w || w.length < 2) continue;
    const re = new RegExp(`\\b${escapeRegex(w.toLowerCase())}\\b`, "g");
    const hits = (lower.match(re) || []).length;
    if (hits > 0) {
      forbidden_word_hits += hits;
      issues.push(`Anvander forbjudet ord "${w}" (${hits}x)`);
    }
  }

  // 2. AI-flosklen
  let ai_cliche_hits = 0;
  for (const c of AI_CLICHES) {
    if (lower.includes(c)) {
      ai_cliche_hits++;
      issues.push(`AI-floskel: "${c}"`);
    }
  }

  // 3. Signature-phrases (positivt)
  let signature_phrase_hits = 0;
  for (const p of opts.fingerprint.signature_phrases) {
    if (!p || p.length < 3) continue;
    if (lower.includes(p.toLowerCase())) signature_phrase_hits++;
  }

  // 4. Langd-fit
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  let length_fit = 1;
  if (opts.targetLength) {
    if (wordCount < opts.targetLength.min) {
      length_fit = wordCount / opts.targetLength.min;
      issues.push(`For kort (${wordCount} ord, mal ${opts.targetLength.min}+)`);
    } else if (wordCount > opts.targetLength.max) {
      length_fit = Math.max(0, 1 - (wordCount - opts.targetLength.max) / opts.targetLength.max);
      issues.push(`For lang (${wordCount} ord, mal max ${opts.targetLength.max})`);
    }
  }

  // 5. Winning-example-similarity (enkel jaccard pa ordmangd)
  let winning_example_similarity = 0;
  if (opts.winningExamples && opts.winningExamples.length > 0) {
    const sims = opts.winningExamples.map((ex) => jaccardSimilarity(text, ex));
    winning_example_similarity = Math.max(...sims);
  }

  // Vikta ihop till total 0-100
  // - forbidden: -15 per traff (max -45)
  // - cliche: -8 per traff (max -40)
  // - signature: +3 per traff (max +15)
  // - length_fit: 0-15 poang
  // - winning_sim: 0-15 poang
  // Bas: 70
  let total = 70;
  total -= Math.min(45, forbidden_word_hits * 15);
  total -= Math.min(40, ai_cliche_hits * 8);
  total += Math.min(15, signature_phrase_hits * 3);
  total += Math.round(length_fit * 15);
  total += Math.round(winning_example_similarity * 15);
  total = Math.max(0, Math.min(100, total));

  const score_hint = buildHint({ forbidden_word_hits, ai_cliche_hits, signature_phrase_hits, length_fit, winning_example_similarity });

  return {
    total,
    breakdown: {
      forbidden_word_hits,
      ai_cliche_hits,
      signature_phrase_hits,
      length_fit,
      winning_example_similarity,
    },
    issues,
    score_hint,
  };
}

function buildHint(b: VoiceScore["breakdown"]): string {
  const parts: string[] = [];
  if (b.ai_cliche_hits > 0) parts.push(`Ta bort ${b.ai_cliche_hits} AI-floskler.`);
  if (b.forbidden_word_hits > 0) parts.push(`Ta bort ${b.forbidden_word_hits} forbjudna ord.`);
  if (b.signature_phrase_hits === 0) parts.push("Anvand minst en signatur-fras fran kunden.");
  if (b.length_fit < 0.7) parts.push("Anpassa langden.");
  if (b.winning_example_similarity < 0.2) parts.push("Skriv mer som winning examples.");
  return parts.join(" ");
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function jaccardSimilarity(a: string, b: string): number {
  const wa = new Set(tokens(a));
  const wb = new Set(tokens(b));
  if (wa.size === 0 || wb.size === 0) return 0;
  let inter = 0;
  for (const w of wa) if (wb.has(w)) inter++;
  const union = wa.size + wb.size - inter;
  return union === 0 ? 0 : inter / union;
}

function tokens(s: string): string[] {
  return s.toLowerCase().replace(/[^\p{L}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 3);
}

export async function fetchWinningExamples(clientId: string, category?: string, limit = 3): Promise<string[]> {
  const sb = supabaseService();
  let q = sb
    .from("client_assets")
    .select("body, voice_score, category")
    .eq("client_id", clientId)
    .eq("status", "active")
    .eq("category", "winning_example")
    .not("body", "is", null)
    .order("voice_score", { ascending: false })
    .limit(limit);
  if (category) q = q.eq("subcategory", category);
  const { data } = await q;
  return (data || []).map((d) => (d as { body: string }).body).filter((b) => b && b.length > 30);
}
