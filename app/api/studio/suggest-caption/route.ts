import { NextRequest, NextResponse } from "next/server";
import { getActiveClient } from "@/lib/client-context";
import { generate } from "@/lib/gemini";
import { getProfileAsMarkdown } from "@/lib/knowledge";

export const runtime = "nodejs";
export const maxDuration = 30;

// POST /api/studio/suggest-caption — { headline, body, topic }
// Genererar en färdig social-caption (INTE affisch-text) grundad i varumärkesröst.
// Admin-grindad av proxy.ts.
export async function POST(req: NextRequest) {
  try {
    const client = await getActiveClient();
    const b = await req.json().catch(() => ({}));
    const headline = (b.headline || "").toString().slice(0, 200);
    const body = (b.body || "").toString().slice(0, 300);
    const topic = (b.topic || "").toString().slice(0, 200);
    const profile = await getProfileAsMarkdown().catch(() => "");

    const system = [
      `Du skriver en bildtext (caption) till ett socialt inlägg (Instagram/Facebook) för ${client?.name || "kunden"}.`,
      "Detta är caption UNDER bilden — inte text på bilden. Skriv som en människa, varmt och konkret.",
      profile ? `\n=== VARUMÄRKESPROFIL — grunda röst, målgrupp och ord på denna ===\n${profile.slice(0, 5000)}` : "",
      "\n=== REGLER ===",
      "- 2–4 korta meningar. Inled med en krok, ge konkret nytta, avsluta med en tydlig uppmaning att boka.",
      "- Svenska tecken å/ä/ö korrekt. Naturligt språk.",
      "- FÖRBJUDNA ord: kraftfull, banbrytande, game-changer, handlar om, nästa nivå, holistisk, skalbar.",
      "- Max 1–3 relevanta hashtags på slutet (valfritt). Inga telefonnummer/URL:er.",
      "- Returnera ENDAST själva captionen, ingen förklaring.",
    ].join("\n");

    const prompt = [
      topic ? `Ämne: ${topic}.` : "",
      headline ? `Rubrik på bilden: ${headline}.` : "",
      body ? `Text på bilden: ${body}.` : "",
      "Skriv captionen nu.",
    ].filter(Boolean).join("\n");

    const caption = (await generate({ model: "gemini-2.5-flash", systemInstruction: system, prompt, temperature: 0.85, maxOutputTokens: 400 })).trim();
    return NextResponse.json({ caption });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
