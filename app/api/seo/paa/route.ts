import { NextRequest, NextResponse } from "next/server";
import { generateJSON } from "@/lib/gemini";
import { getKnowledge } from "@/lib/knowledge";

export const runtime = "nodejs";
export const maxDuration = 60;

// "People Also Ask"-style frågor för ett sökord — för AEO-content
interface PAA {
  questions: { question: string; short_answer: string; intent: string }[];
  related_keywords: string[];
  long_tail: string[];
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const keyword: string = body.keyword;
  if (!keyword) return NextResponse.json({ error: "keyword krävs" }, { status: 400 });

  const knowledge = await getKnowledge();
  const system = `Du genererar "People Also Ask"-style frågor som riktiga svenska användare söker på Google för ett givet sökord.

${knowledge}

RETURNERA JSON:
{
  "questions": [
    { "question": "Vanlig svensk fråga?", "short_answer": "Kort direkt svar 1–2 meningar", "intent": "informational|transactional|commercial" }
  ],
  "related_keywords": ["nära besläktade sökord (5–10)"],
  "long_tail": ["långa specifika fraser (5–10)"]
}

Generera 8–12 frågor som folk faktiskt söker. Inkludera "varför", "hur", "vad kostar", "vilken är bäst", "när".`;

  const result = await generateJSON<PAA>({
    model: "gemini-2.5-pro",
    systemInstruction: system,
    prompt: `Sökord: ${keyword}\n\nGenerera nu.`,
    temperature: 0.7,
    maxOutputTokens: 3000,
  });
  return NextResponse.json(result);
}
