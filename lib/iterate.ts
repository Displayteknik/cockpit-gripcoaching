// lib/iterate.ts
// Iterations-loop: generera N varianter parallellt, scorea, behall basta.
// Anvands av specialist-run och alla AI-generatorer som vill ha "djupet".

import Anthropic from "@anthropic-ai/sdk";
import { scoreOutput, fetchWinningExamples, type VoiceScore } from "./voice-score";
import { getVoiceFingerprint, type VoiceFingerprint } from "./voice-fingerprint";
import { supabaseService } from "./supabase-admin";

export interface IterateOptions {
  systemPrompt: string;
  userPrompt: string;
  clientId?: string | null;
  model?: string;
  maxTokens?: number;
  variants?: number; // default 3
  temperature?: number; // default 0.8 for spridning
  category?: string; // for winning-example-fetch
  targetLength?: { min: number; max: number };
  // Om inget clientId: kor utan voice-score, returnera forsta varianten
}

export interface IterateResult {
  output: string;
  score: VoiceScore | null;
  all_variants: { text: string; score: VoiceScore | null }[];
  variant_count: number;
  total_tokens_in: number;
  total_tokens_out: number;
}

const DEFAULT_MODEL = "claude-sonnet-4-5";

export async function iterateGenerate(opts: IterateOptions): Promise<IterateResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY saknas");

  const variants = Math.max(1, Math.min(7, opts.variants ?? 3));
  const model = opts.model ?? DEFAULT_MODEL;
  const temp = opts.temperature ?? 0.8;
  const maxTokens = opts.maxTokens ?? 2048;

  const anthropic = new Anthropic({ apiKey });

  // Hamta voice + winning examples om clientId finns
  let fingerprint: VoiceFingerprint | null = null;
  let winning: string[] = [];
  if (opts.clientId) {
    try {
      fingerprint = await getVoiceFingerprint(opts.clientId);
      winning = await fetchWinningExamples(opts.clientId, opts.category);
    } catch (e) {
      console.error("[iterate] kunde inte hamta voice/winning:", e);
    }
  }

  // Bygg ihop systemprompt med voice-block + winning examples
  let fullSystem = opts.systemPrompt;
  if (fingerprint) {
    const { fingerprintToPromptBlock } = await import("./voice-fingerprint");
    fullSystem += "\n\n" + fingerprintToPromptBlock(fingerprint);
  }
  if (winning.length > 0) {
    fullSystem += "\n\n=== VINNANDE EXEMPEL (matcha denna kvalitet) ===\n";
    winning.forEach((w, i) => {
      fullSystem += `\nExempel ${i + 1}:\n${w}\n`;
    });
  }
  fullSystem += "\n\n=== FORBJUDNA AI-FLOSKLER (anvand ALDRIG) ===\nkraftfull, banbrytande, holistisk, skalbar, handlar om, nasta niva, synergier, ekosystem, transformativ, navigera utmaningarna. Skriv som manniska, inte som AI.";

  // Generera N varianter parallellt
  const calls = Array.from({ length: variants }, () =>
    anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      temperature: temp,
      system: fullSystem,
      messages: [{ role: "user", content: opts.userPrompt }],
    })
  );

  const results = await Promise.allSettled(calls);

  let total_tokens_in = 0;
  let total_tokens_out = 0;
  const variantsScored: { text: string; score: VoiceScore | null }[] = [];

  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    const msg = r.value;
    const text = msg.content
      .map((c) => (c.type === "text" ? c.text : ""))
      .join("")
      .trim();
    if (!text) continue;
    total_tokens_in += msg.usage?.input_tokens ?? 0;
    total_tokens_out += msg.usage?.output_tokens ?? 0;

    const score = fingerprint
      ? scoreOutput(text, {
          fingerprint,
          winningExamples: winning,
          targetLength: opts.targetLength,
        })
      : null;

    variantsScored.push({ text, score });
  }

  if (variantsScored.length === 0) {
    throw new Error("Inga varianter genererades");
  }

  // Valj basta: hogst score, eller forsta om ingen scoring
  variantsScored.sort((a, b) => {
    const sa = a.score?.total ?? 0;
    const sb = b.score?.total ?? 0;
    return sb - sa;
  });

  const winner = variantsScored[0];

  // Logga experiment
  if (opts.clientId && variantsScored.length > 1) {
    try {
      const sb = supabaseService();
      await sb.from("agent_experiments").insert({
        client_id: opts.clientId,
        type: opts.category ?? "generic",
        variants: variantsScored.length,
        winner_score: winner.score?.total ?? null,
        runner_up_score: variantsScored[1]?.score?.total ?? null,
        spread: (winner.score?.total ?? 0) - (variantsScored[variantsScored.length - 1]?.score?.total ?? 0),
        model,
      });
    } catch {
      // tabellen kan saknas innan migration kors — sla av tyst
    }
  }

  return {
    output: winner.text,
    score: winner.score,
    all_variants: variantsScored,
    variant_count: variantsScored.length,
    total_tokens_in,
    total_tokens_out,
  };
}
