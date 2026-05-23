import { NextRequest, NextResponse } from "next/server";
import { getActiveClientId } from "@/lib/client-context";
import { getVoiceFingerprint } from "@/lib/voice-fingerprint";
import { scoreOutput, fetchWinningExamples } from "@/lib/voice-score";

export const runtime = "nodejs";

interface Body {
  title?: string;
  content?: string;
  excerpt?: string;
}

export async function POST(req: NextRequest) {
  const clientId = await getActiveClientId();
  const body = (await req.json()) as Body;

  // Strippa HTML-taggar för att score:a själva texten — annars triggar t.ex. "div" på fel sätt.
  const plain = [body.title, body.excerpt, (body.content || "").replace(/<[^>]+>/g, " ")]
    .filter(Boolean)
    .join("\n\n")
    .replace(/\s+/g, " ")
    .trim();

  if (!plain) {
    return NextResponse.json({ error: "Inget innehåll att checka" }, { status: 400 });
  }

  try {
    const fingerprint = await getVoiceFingerprint(clientId);
    const winningExamples = await fetchWinningExamples(clientId, "blog");

    const score = scoreOutput(plain, {
      fingerprint,
      winningExamples,
      targetLength: { min: 300, max: 1500 },
    });

    // Plocka ut topp-issues som UI ska visa
    const topIssues = score.issues.slice(0, 8);

    // Verdict: passes = >= 70, warns = 55-69, blocks = < 55
    const verdict: "pass" | "warn" | "block" =
      score.total >= 70 ? "pass" : score.total >= 55 ? "warn" : "block";

    return NextResponse.json({
      ok: true,
      score: score.total,
      verdict,
      hint: score.score_hint,
      issues: topIssues,
      breakdown: score.breakdown,
      signatures_available: fingerprint.signature_phrases.slice(0, 5),
      pain_words_to_use: fingerprint.pain_words.slice(0, 5),
      joy_words_to_use: fingerprint.joy_words.slice(0, 5),
      winning_examples_count: winningExamples.length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Voice-check misslyckades: " + (err as Error).message },
      { status: 500 }
    );
  }
}
