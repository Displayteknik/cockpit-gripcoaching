import { NextRequest, NextResponse } from "next/server";
import { generateJSON } from "@/lib/gemini";
import { getKnowledge } from "@/lib/knowledge";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ContentAudit {
  overall_score: number; // 0–100
  voice_match_score: number; // matchar brand voice?
  ai_smell_score: number; // 100 = inget AI-snack, 0 = full AI-soppa
  conversion_score: number;
  ai_smell_phrases: string[];
  rewrite_priorities: { issue: string; original: string; rewrite: string }[];
  strengths: string[];
  next_actions: string[];
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const url: string = body.url;
  const sample: string | undefined = body.text;

  let text = sample || "";
  if (!text && url) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
      const html = await r.text();
      text = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 8000);
    } catch (e) {
      return NextResponse.json({ error: "Kunde inte hämta URL: " + (e as Error).message }, { status: 500 });
    }
  }

  if (!text) return NextResponse.json({ error: "text eller url krävs" }, { status: 400 });

  const knowledge = await getKnowledge("conversion");
  const system = `Du är en strikt content-granskare. Använd brand-profilen + konverteringsreglerna. Bedöm hårt — inte snällt.

${knowledge}

ANALYSERA TEXTEN:
1. Voice match: stämmer tonen?
2. AI-smell: finns generiska AI-fraser? ("kraftfull", "handlar om", "nästa nivå", "banbrytande" etc — listas som "ai_smell_phrases")
3. Konvertering: leder texten någonstans? Är CTA tydlig?
4. Skrivkvalitet: rytm, korta meningar, konkreta exempel?

RETURNERA JSON:
{
  "overall_score": 0–100,
  "voice_match_score": 0–100,
  "ai_smell_score": 0–100 (100 = ingen AI-känsla),
  "conversion_score": 0–100,
  "ai_smell_phrases": ["fraser hittade"],
  "rewrite_priorities": [
    { "issue": "kort beskrivning", "original": "originalmening", "rewrite": "förbättrad version" }
  ],
  "strengths": ["det som funkar"],
  "next_actions": ["3 konkreta nästa steg"]
}

Var hård. Lögner snäll-poäng = noll värde.`;

  const audit = await generateJSON<ContentAudit>({
    model: "gemini-2.5-pro",
    systemInstruction: system,
    prompt: `TEXT ATT GRANSKA:\n\n${text.slice(0, 8000)}`,
    temperature: 0.5,
    maxOutputTokens: 3000,
  });

  return NextResponse.json(audit);
}
