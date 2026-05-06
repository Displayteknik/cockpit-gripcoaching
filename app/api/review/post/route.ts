import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getActiveClientId } from "@/lib/client-context";
import { supabaseService } from "@/lib/supabase-admin";
import { getVoiceFingerprint, fingerprintToPromptBlock } from "@/lib/voice-fingerprint";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ReviewInput {
  hook: string;
  body: string;
  cta?: string;
  hashtags?: string[];
  format?: string;
  funnel?: string;
}

interface ReviewResult {
  scores: {
    hook_strength: number;       // 0-100
    voice_match: number;         // 0-100
    conversion_potential: number;// 0-100
    overall: number;             // 0-100
  };
  verdict: "publicera" | "behov_av_mindre_justering" | "skriv_om";
  strengths: string[];
  weaknesses: string[];
  rewrite_suggestion: string | null;  // konkret omskrivning om verdict != publicera
  reviewer_notes: string;
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY saknas — granskning kräver Claude" },
        { status: 500 }
      );
    }

    const clientId = await getActiveClientId();
    const input = (await req.json()) as ReviewInput;

    if (!input.hook && !input.body) {
      return NextResponse.json({ error: "hook eller body krävs" }, { status: 400 });
    }

    const sb = supabaseService();
    const { data: profile } = await sb
      .from("hm_brand_profile")
      .select("*")
      .eq("client_id", clientId)
      .maybeSingle();

    const fp = await getVoiceFingerprint(clientId);
    const voiceBlock = fingerprintToPromptBlock(fp);

    const system = `Du är specialist på svenskt social-media-content och konvertering. Du granskar inlägg innan publicering och ger ärlig, kvalificerad feedback. Du är inte snäll — du är direkt och hjälpsam.

═══ KUND ═══
Företag: ${profile?.company_name || "(saknas)"}
USP: ${profile?.usp || "(saknas)"}
Differentiatorer: ${profile?.differentiators || "(saknas)"}
Primär ICP: ${profile?.icp_primary || "(saknas)"}
Smärtpunkter: ${profile?.pain_points || "(saknas)"}

${voiceBlock}

═══ DIN UPPGIFT ═══
Granska inlägget på tre dimensioner:

1. HOOK-STRENGTH (0-100): Stoppar hooken scrollen? Klarar 3-sekundersregeln? Är den specifik eller generisk? Använder den ett bra hook-format (fråga, statistik, kontrast, story, påstående)?

2. VOICE-MATCH (0-100): Låter detta som personen själv hade skrivit? Använder typiska uttryck? Undviker AI-språk ("kraftfull", "banbrytande", "skalbar", "handlar om")? Korrekt svenska och kundens röst?

3. CONVERSION-POTENTIAL (0-100): Driver inlägget mot ett mål? Är CTA:n tydlig och en sak? Skapar det förtroende eller driver handling beroende på funnel-läge?

Ge konkret feedback. Om något är dåligt — säg det. Om något är bra — säg det. Aldrig svamla.

═══ OUTPUT JSON ═══
{
  "scores": {
    "hook_strength": <0-100>,
    "voice_match": <0-100>,
    "conversion_potential": <0-100>,
    "overall": <medelvärde 0-100>
  },
  "verdict": "publicera" | "behov_av_mindre_justering" | "skriv_om",
  "strengths": ["styrka 1", "styrka 2"],
  "weaknesses": ["svaghet 1", "svaghet 2"],
  "rewrite_suggestion": "konkret omskriven version med hook + body + cta — bara om verdict inte är 'publicera', annars null",
  "reviewer_notes": "1-3 meningar om helhetsintrycket"
}`;

    const userPrompt = `Granska detta inlägg:

HOOK:
${input.hook || "(saknas)"}

BODY:
${input.body || "(saknas)"}

CTA:
${input.cta || "(saknas)"}

${input.hashtags?.length ? `HASHTAGS: ${input.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")}` : ""}
${input.format ? `FORMAT: ${input.format}` : ""}
${input.funnel ? `FUNNEL: ${input.funnel}` : ""}

Returnera enbart JSON.`;

    const anthropic = new Anthropic({ apiKey });
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 3000,
      system,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = msg.content
      .map((c) => (c.type === "text" ? c.text : ""))
      .join("")
      .trim();

    let parsed: Partial<ReviewResult> = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    }

    if (!parsed.scores) {
      return NextResponse.json({ error: "Granskaren returnerade inget resultat" }, { status: 500 });
    }

    return NextResponse.json(parsed as ReviewResult);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
