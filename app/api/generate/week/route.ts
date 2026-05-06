import { NextRequest, NextResponse } from "next/server";
import { getActiveClientId } from "@/lib/client-context";
import { supabaseService } from "@/lib/supabase-admin";
import { generate } from "@/lib/gemini";
import { getVoiceFingerprint, fingerprintToPromptBlock } from "@/lib/voice-fingerprint";
import {
  WEEK_ROLES,
  DISC_GUIDE,
  FOURA_GUIDE,
  FUNNEL_GUIDE,
  KANE_HOOK_RULES,
  FORMAT_LABELS,
  type Format,
} from "@/lib/content-framework";

export const runtime = "nodejs";
export const maxDuration = 240;

interface DayPlan {
  day: string;
  fourA: string;
  disc: string;
  funnel: string;
  format: Format;
  hook: string;
  body: string;
  cta: string;
  hashtags: string[];
}

// POST /api/generate/week
// { theme: string, week_starts?: ISO-date, formats?: { [day: string]: Format } }
export async function POST(req: NextRequest) {
  try {
    const clientId = await getActiveClientId();
    const body = await req.json();
    const theme = String(body.theme || "").trim();
    if (!theme || theme.length < 5) {
      return NextResponse.json({ error: "Veckotema krävs (minst 5 tecken)" }, { status: 400 });
    }

    const sb = supabaseService();
    const { data: profile } = await sb
      .from("hm_brand_profile")
      .select("*")
      .eq("client_id", clientId)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ error: "Brand-profil saknas" }, { status: 400 });
    }

    const fp = await getVoiceFingerprint(clientId);
    const voiceBlock = fingerprintToPromptBlock(fp);

    // Bygg en kombinerad prompt som genererar 7 inlägg i en JSON-call
    const dayLines = WEEK_ROLES.map((role, i) => {
      const overrideFormat = body.formats?.[role.day] as Format | undefined;
      const format = overrideFormat || role.recommended_formats[0];
      return `Dag ${i + 1} (${role.day}): 4A=${role.fourA}, DISC=${role.disc}, Funnel=${role.funnel}, Format=${FORMAT_LABELS[format]} (${format}). Intent: ${role.intent}`;
    }).join("\n");

    const system = `Du är världsklass copywriter. Du genererar 7 inlägg för en hel vecka — ETT inlägg per dag enligt veckorytmen. Varje dag har sin egen roll i 4A × DISC × Funnel.

═══ KUND ═══
Företag: ${profile.company_name || "(saknas)"}
Plats: ${profile.location || "(saknas)"}
USP: ${profile.usp || "(saknas)"}
Differentiatorer: ${profile.differentiators || "(saknas)"}
ICP primär: ${profile.icp_primary || "(saknas)"}
Smärtpunkter: ${profile.pain_points || "(saknas)"}
Tjänster: ${profile.services || "(saknas)"}
Bokningslänk: ${profile.booking_url || "(saknas)"}

═══ VECKO-ROLLER ═══
${dayLines}

4A-guide:
${Object.entries(FOURA_GUIDE).map(([k, v]) => `- ${k}: ${v}`).join("\n")}

DISC-guide:
${Object.entries(DISC_GUIDE).map(([k, v]) => `- ${k}: ${v}`).join("\n")}

Funnel-guide:
${Object.entries(FUNNEL_GUIDE).map(([k, v]) => `- ${k}: ${v}`).join("\n")}

═══ HOOK-REGLER ═══
${KANE_HOOK_RULES}

${voiceBlock}

═══ KVALITETSKRAV ═══
- Veckan ska ha PROGRESSION — söndag ska kännas annorlunda från måndag
- Variera HOOK-FORMAT över veckan: fråga, statistik, kontrast, story, påstående
- ALDRIG AI-språk: "kraftfull", "banbrytande", "game-changer", "skalbar"
- Skriv på svenska som personen själv hade skrivit
- Varje CTA är EN sak att göra — varierande över veckan

═══ OUTPUT JSON ═══
{
  "days": [
    {
      "day": "Måndag",
      "hook": "...",
      "body": "...",
      "cta": "...",
      "hashtags": ["..."]
    },
    ... 7 dagar totalt, i ordning Måndag→Söndag
  ]
}`;

    const userPrompt = `Veckotema: ${theme}

Producera 7 inlägg som tillsammans tar målgruppen från medvetenhet till handling över veckan. Varje inlägg står på egna ben men de ska kännas som en serie. Returnera enbart JSON.`;

    const raw = await generate({
      model: "gemini-2.5-pro",
      systemInstruction: system,
      prompt: userPrompt,
      temperature: 0.85,
      maxOutputTokens: 8000,
      jsonMode: true,
    });

    let parsed: { days?: { day: string; hook: string; body: unknown; cta: string; hashtags: string[] }[] } = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    }

    if (!parsed.days || !Array.isArray(parsed.days) || parsed.days.length === 0) {
      return NextResponse.json({ error: "AI returnerade inga dagar" }, { status: 500 });
    }

    const toStr = (v: unknown): string => {
      if (typeof v === "string") return v;
      if (Array.isArray(v)) return v.map(toStr).join("\n\n");
      if (v && typeof v === "object") return JSON.stringify(v);
      return v == null ? "" : String(v);
    };

    const days: DayPlan[] = WEEK_ROLES.map((role, i) => {
      const aiDay = parsed.days![i] || ({} as { hook?: string; body?: unknown; cta?: string; hashtags?: string[] });
      const overrideFormat = body.formats?.[role.day] as Format | undefined;
      const format = overrideFormat || role.recommended_formats[0];
      return {
        day: role.day,
        fourA: role.fourA,
        disc: role.disc,
        funnel: role.funnel,
        format,
        hook: toStr(aiDay.hook),
        body: toStr(aiDay.body),
        cta: toStr(aiDay.cta),
        hashtags: Array.isArray(aiDay.hashtags) ? aiDay.hashtags.map((h) => String(h).replace(/^#/, "")) : [],
      };
    });

    return NextResponse.json({
      theme,
      voice_source_count: fp.source_asset_count,
      days,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
