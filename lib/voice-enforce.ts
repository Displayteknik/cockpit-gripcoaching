// lib/voice-enforce.ts
//
// Server-side automatisk voice-enforcement för AI-genererad text.
// ALLA AI-generator-endpoints bör wrapa sin output genom enforceVoice() istället
// för att returnera rå AI-output. Se feedback_brand_voice_always_pull.md.
//
// Iterations-loop:
//   1. Generera text (callback)
//   2. Voice-check mot client_voice_profile + winning examples
//   3. Om score < threshold — gör om med feedback ("undvik X, använd Y")
//   4. Max N iterationer, returnera bästa
//
// Inspirerat av lib/iterate.ts men generaliserat för all text-generering.

import { getVoiceFingerprint } from "./voice-fingerprint";
import { scoreOutput, fetchWinningExamples, type VoiceScore } from "./voice-score";

export interface EnforceOptions {
  clientId: string;
  surface?: "blog" | "social" | "email" | "linkedin" | "page" | "specialist" | "other";
  threshold?: number; // default 70 — under detta = iterera
  maxIterations?: number; // default 2 — total 1 + 2 = 3 försök
  targetLength?: { min: number; max: number };
}

export interface EnforceResult {
  text: string;
  score: VoiceScore;
  iterations: number; // 0 = passerade första försöket
  enforced: boolean; // false = kunde inte nå threshold, returnerar bästa
}

const DEFAULT_LENGTHS: Record<string, { min: number; max: number }> = {
  blog: { min: 300, max: 2000 },
  social: { min: 30, max: 400 },
  email: { min: 80, max: 800 },
  linkedin: { min: 40, max: 600 },
  page: { min: 100, max: 2500 },
  specialist: { min: 30, max: 2000 },
  other: { min: 20, max: 3000 },
};

/**
 * Generera + voice-enforce text. Callback får feedback-hint från forra
 * iterationen (eller tom sträng vid första). Den ansvarar för att använda
 * feedbacken i sin AI-prompt.
 */
export async function enforceVoice(
  generate: (feedbackHint: string, attempt: number) => Promise<string>,
  opts: EnforceOptions,
): Promise<EnforceResult> {
  const threshold = opts.threshold ?? 70;
  const maxIter = opts.maxIterations ?? 2;
  const surface = opts.surface ?? "other";
  const targetLength = opts.targetLength ?? DEFAULT_LENGTHS[surface];

  const fingerprint = await getVoiceFingerprint(opts.clientId);
  const winningExamples = await fetchWinningExamples(opts.clientId, surface === "blog" ? "blog" : undefined);

  let bestText = "";
  let bestScore: VoiceScore | null = null;
  let feedback = "";

  for (let attempt = 0; attempt <= maxIter; attempt++) {
    const text = await generate(feedback, attempt);
    const plain = (text || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!plain) continue;

    const score = scoreOutput(plain, { fingerprint, winningExamples, targetLength });

    if (!bestScore || score.total > bestScore.total) {
      bestText = text;
      bestScore = score;
    }

    if (score.total >= threshold) {
      return { text: bestText, score: bestScore, iterations: attempt, enforced: true };
    }

    // Bygg feedback för nästa iteration
    feedback = score.score_hint || "Skriv mer i klientens röst.";
    if (fingerprint.signature_phrases.length) {
      feedback += ` Inkludera en av: ${fingerprint.signature_phrases.slice(0, 3).join(", ")}.`;
    }
    if (fingerprint.forbidden_words.length) {
      feedback += ` Undvik orden: ${fingerprint.forbidden_words.slice(0, 5).join(", ")}.`;
    }
  }

  // Nådde inte threshold — returnera bästa försöket
  if (!bestScore) {
    return {
      text: "",
      score: { total: 0, breakdown: { forbidden_word_hits: 0, ai_cliche_hits: 0, signature_phrase_hits: 0, length_fit: 0, winning_example_similarity: 0 }, issues: ["Inget AI-svar producerades"], score_hint: "" },
      iterations: maxIter,
      enforced: false,
    };
  }
  return { text: bestText, score: bestScore, iterations: maxIter, enforced: false };
}

/**
 * Lättare variant: bara scoreas (utan iteration). Returnera text + score.
 * För endpoints där du inte kan/vill iterera, men vill ändå visa scoren.
 */
export async function scoreText(text: string, clientId: string, surface: EnforceOptions["surface"] = "other"): Promise<VoiceScore> {
  const fingerprint = await getVoiceFingerprint(clientId);
  const winningExamples = await fetchWinningExamples(clientId, surface === "blog" ? "blog" : undefined);
  const targetLength = DEFAULT_LENGTHS[surface || "other"];
  const plain = (text || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return scoreOutput(plain, { fingerprint, winningExamples, targetLength });
}
