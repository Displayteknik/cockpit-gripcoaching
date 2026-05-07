import { NextRequest, NextResponse } from "next/server";
import { generateJSON } from "@/lib/gemini";
import { supabaseServer } from "@/lib/supabase-admin";
import { getActiveClient, getActiveClientId } from "@/lib/client-context";

export const runtime = "nodejs";
export const maxDuration = 60;

interface AnalysisResult {
  summary: string;
  top_themes: { theme: string; performance: string; example_hook: string }[];
  hook_patterns: { pattern: string; works: boolean; reason: string }[];
  cadence_insight: string;
  recommendations: string[];
}

export async function POST(_req: NextRequest) {
  try {
    const sb = supabaseServer();
    const clientId = await getActiveClientId();
    const client = await getActiveClient();

    const { data: history } = await sb
      .from("linkedin_history")
      .select("posted_at, post_text, impressions, engagements, reactions, comments, shares")
      .eq("client_id", clientId)
      .order("engagements", { ascending: false, nullsFirst: false })
      .limit(60);

    if (!history?.length) return NextResponse.json({ error: "Importera historik först" }, { status: 400 });

    const top = history.slice(0, 25);
    const sample = top.map((h, i) => `[${i + 1}] (${h.engagements ?? "?"} eng / ${h.impressions ?? "?"} impr) ${h.posted_at?.slice(0, 10) ?? "?"}\n${(h.post_text ?? "").slice(0, 600)}`).join("\n\n---\n\n");

    const system = `Du analyserar ${client?.name || "klientens"} LinkedIn-historik enligt Hakan Grips kursmetodik.

Bedöm topp-25 inläggen efter engagemang och leta mönster: hooks som funkar, teman som drar, format-vinkel, dagar/tider.

RETURNERA JSON:
{
  "summary": "2-3 meningar översikt av vad som funkar",
  "top_themes": [
    { "theme": "Tema/pelare", "performance": "Hur det presterar", "example_hook": "En vinnande hook från historiken" }
  ],
  "hook_patterns": [
    { "pattern": "Mönstret (ex: personliga reflektioner, konkreta siffror, kontraintuitiva insikter)", "works": true, "reason": "Varför" }
  ],
  "cadence_insight": "Vad historiken säger om publiceringstakt eller dagar",
  "recommendations": ["Konkret rekommendation 1", "Rekommendation 2", "Rekommendation 3"]
}`;

    const result = await generateJSON<AnalysisResult>({
      model: "gemini-2.5-pro",
      systemInstruction: system,
      prompt: `Analysera dessa topp-presterande inlägg:\n\n${sample}\n\nReturnera bara JSON.`,
      temperature: 0.6,
      maxOutputTokens: 3000,
    });

    return NextResponse.json({ analysis: result, analyzed_count: top.length });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
