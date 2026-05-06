import { NextRequest, NextResponse } from "next/server";
import { getActiveClientId } from "@/lib/client-context";
import { supabaseService } from "@/lib/supabase-admin";
import { generate } from "@/lib/gemini";
import { getVoiceFingerprint, fingerprintToPromptBlock } from "@/lib/voice-fingerprint";

export const runtime = "nodejs";
export const maxDuration = 30;

// POST /api/generate/regenerate
// { hook, body, cta, instruction }  — instruction = "djärvare", "varmare", "kortare", fritext
export async function POST(req: NextRequest) {
  try {
    const clientId = await getActiveClientId();
    const body = await req.json();
    const { hook, body: postBody, cta, instruction } = body;

    if (!instruction || instruction.trim().length < 2) {
      return NextResponse.json({ error: "Instruktion krävs" }, { status: 400 });
    }

    const sb = supabaseService();
    const { data: profile } = await sb
      .from("hm_brand_profile")
      .select("*")
      .eq("client_id", clientId)
      .maybeSingle();

    const fp = await getVoiceFingerprint(clientId);
    const voiceBlock = fingerprintToPromptBlock(fp);

    const system = `Du redigerar ett befintligt socialt-medie-inlägg på instruktion. Behåll grundidén men förändra enligt anvisningen.

KUND: ${profile?.company_name || "(saknas)"}
USP: ${profile?.usp || "(saknas)"}

${voiceBlock}

REGLER:
- ALDRIG AI-språk
- Behåll svenska och kundens röst
- Returnera JSON: { "hook": "...", "body": "...", "cta": "...", "hashtags": [...], "notes": "vad du ändrade och varför" }`;

    const prompt = `BEFINTLIGT INLÄGG:
Hook: ${hook || "(tom)"}
Body: ${postBody || "(tom)"}
CTA: ${cta || "(tom)"}

INSTRUKTION: ${instruction}

Generera om enligt instruktionen. Returnera bara JSON.`;

    const raw = await generate({
      model: "gemini-2.5-pro",
      systemInstruction: system,
      prompt,
      temperature: 0.85,
      maxOutputTokens: 2500,
      jsonMode: true,
    });

    let parsed: { hook?: string; body?: string; cta?: string; hashtags?: string[]; notes?: string } = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    }

    return NextResponse.json({
      hook: parsed.hook || hook,
      body: parsed.body || postBody,
      cta: parsed.cta || cta,
      hashtags: parsed.hashtags || [],
      notes: parsed.notes || "",
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
