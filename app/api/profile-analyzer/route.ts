import { NextRequest, NextResponse } from "next/server";
import { generateJSON } from "@/lib/gemini";
import { getKnowledge } from "@/lib/knowledge";
import { publicProfileSnapshot } from "@/lib/instagram";
import { getActiveClient } from "@/lib/client-context";

export const runtime = "nodejs";
export const maxDuration = 90;

interface Analysis {
  positioning: string;
  bio_score: number;
  bio_feedback: string;
  content_strategy_guess: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: { priority: number; action: string; expected_impact: string }[];
  hooks_to_test: string[];
}

export async function POST(req: NextRequest) {
  const { handle, recent_posts_text } = await req.json();
  if (!handle) return NextResponse.json({ error: "handle krävs" }, { status: 400 });

  const snapshot = await publicProfileSnapshot(handle);
  if (snapshot.error) return NextResponse.json({ error: snapshot.error }, { status: 400 });

  const client = await getActiveClient();
  const knowledge = await getKnowledge("viral-hooks", "engagement", "profile", "hashtags", "conversion");

  const system = `Du är en Instagram-konsult som granskar konton och ger ärlig återkoppling. Svenska. Ingen AI-jargong.

${knowledge}

Du har data från publika profilen. Bedöm hårt — visa både vad som funkar och vad som inte gör det.

Returnera JSON:
{
  "positioning": "1-2 meningar om hur kontot framställer sig",
  "bio_score": 0-100,
  "bio_feedback": "konkret feedback på bion",
  "content_strategy_guess": "vad de verkar göra utifrån kontots namn/bio",
  "strengths": ["styrka 1", "styrka 2", ...],
  "weaknesses": ["svaghet 1", ...],
  "recommendations": [
    { "priority": 1-10, "action": "konkret åtgärd", "expected_impact": "vad det ger" }
  ],
  "hooks_to_test": ["3-5 konkreta hook-idéer för deras nisch"]
}`;

  const prompt = `KONTO: @${handle.replace(/^@/, "")}
Namn: ${snapshot.full_name || "—"}
Verifierad: ${snapshot.verified ? "ja" : "nej"}
Följare: ${snapshot.followers}
Följer: ${snapshot.following}
Antal inlägg: ${snapshot.posts}
Bio: "${snapshot.bio || "(tom)"}"

${recent_posts_text ? `\nSenaste inläggens texter:\n${recent_posts_text}` : ""}

${client ? `MIN KLIENT (för jämförelse om relevant): ${client.name} — ${client.industry}` : ""}

Analysera nu.`;

  const analysis = await generateJSON<Analysis>({
    model: "gemini-2.5-pro",
    systemInstruction: system,
    prompt,
    temperature: 0.5,
    maxOutputTokens: 4000,
  });

  return NextResponse.json({ snapshot, analysis });
}
