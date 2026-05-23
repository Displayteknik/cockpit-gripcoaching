import { NextRequest, NextResponse } from "next/server";
import { getActiveClientId } from "@/lib/client-context";
import { getVoiceFingerprint } from "@/lib/voice-fingerprint";
import { scoreOutput, fetchWinningExamples } from "@/lib/voice-score";

export const runtime = "nodejs";

/**
 * Generisk voice-check för ALLA texttyper i Cockpit.
 * Används av blogg, social, mejl, LinkedIn, sidor, specialist-output etc.
 *
 * Behöver bara: text (sträng). Hämtar aktiv klients röst-profil automatiskt.
 * Returnerar score 0-100 + verdict pass/warn/block + issues.
 *
 * Se feedback_language_review_everywhere.md.
 */
interface Body {
  text?: string;
  surface?: "blog" | "social" | "email" | "linkedin" | "page" | "specialist" | "other";
  // Optional: explicit klient-id (annars cookie)
  client_id?: string;
  // Optional: längdmål (annars defaults per surface)
  target_length?: { min: number; max: number };
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

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Body;
  const clientId = body.client_id || await getActiveClientId();
  const surface = body.surface || "other";

  if (!body.text || body.text.trim().length < 10) {
    return NextResponse.json({ error: "text krävs (min 10 tecken)" }, { status: 400 });
  }

  // Strippa HTML-taggar för korrekt scoring
  const plain = body.text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  try {
    const fingerprint = await getVoiceFingerprint(clientId);
    const winningExamples = await fetchWinningExamples(clientId, surface === "blog" ? "blog" : undefined);
    const targetLength = body.target_length || DEFAULT_LENGTHS[surface];

    const score = scoreOutput(plain, { fingerprint, winningExamples, targetLength });
    const verdict: "pass" | "warn" | "block" =
      score.total >= 70 ? "pass" : score.total >= 55 ? "warn" : "block";

    return NextResponse.json({
      ok: true,
      surface,
      score: score.total,
      verdict,
      hint: score.score_hint,
      issues: score.issues.slice(0, 10),
      breakdown: score.breakdown,
      signatures_available: fingerprint.signature_phrases.slice(0, 5),
      forbidden_words: fingerprint.forbidden_words.slice(0, 8),
      pain_words: fingerprint.pain_words.slice(0, 5),
      joy_words: fingerprint.joy_words.slice(0, 5),
      winning_examples_count: winningExamples.length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Voice-check misslyckades: " + (err as Error).message },
      { status: 500 }
    );
  }
}
