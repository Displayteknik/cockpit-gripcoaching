import { NextRequest, NextResponse } from "next/server";
import { generateJSON } from "@/lib/gemini";
import { getKnowledge } from "@/lib/knowledge";
import { supabaseServer } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 60;

interface GeneratedPost {
  hook: string;
  caption: string;
  hashtags: string;
  cta: string;
  format_note: string;
}

interface GenerateBody {
  platform: "instagram" | "facebook";
  format: string;
  vehicle_id?: string | null;
  angle?: string;
  extra?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as GenerateBody;
    const sb = supabaseServer();

    let vehicleCtx = "";
    if (body.vehicle_id) {
      const { data: v } = await sb
        .from("hm_vehicles")
        .select("title, brand, model, category, description, price, price_label, badge, specs")
        .eq("id", body.vehicle_id)
        .single();
      if (v) vehicleCtx = `\n## FORDONSKONTEXT\n${JSON.stringify(v, null, 2)}\n`;
    }

    const knowledge = await getKnowledge("company", "viral-hooks", "conversion");
    const system = `Du är HM Motors egna content-producent. Du skriver konverterande inlägg för Instagram och Facebook på svenska med jämtländsk ton.

${knowledge}

HÅRDA REGLER:
- Skriv ALDRIG AI-språk: "kraftfull", "handlar om", "nästa nivå", "banbrytande", "game-changer", "holistisk", "skalbar".
- Svenska tecken (å/ä/ö) ALLTID korrekta.
- En CTA per inlägg, inte flera.
- Inlägget ska kunna publiceras direkt utan efterarbete.
- Följ 3-sekundersregeln i hooken.
- Inte "i denna artikel" eller "vi kommer att" — skriv direkt.

RETURNERA JSON i exakt detta format:
{
  "hook": "3 sekunder — texten som stoppar scrollen",
  "caption": "Hela inläggstexten (inklusive hooken upprepad först om det passar)",
  "hashtags": "#hashtag1 #hashtag2 ...",
  "cta": "Vilken CTA som används",
  "format_note": "Praktisk regianvisning för bild/video"
}`;

    const userPrompt = `Plattform: ${body.platform}
Format: ${body.format}
${body.angle ? `Vinkel: ${body.angle}` : ""}
${body.extra ? `Extra info: ${body.extra}` : ""}
${vehicleCtx}

Skriv ett konverterande inlägg enligt reglerna. Kort, rakt, svensk-jämtländskt.`;

    const post = await generateJSON<GeneratedPost>({
      model: "gemini-2.5-pro",
      systemInstruction: system,
      prompt: userPrompt,
      temperature: 0.9,
      maxOutputTokens: 2000,
    });

    const { data: saved, error } = await sb
      .from("hm_social_posts")
      .insert({
        platform: body.platform,
        format: body.format,
        hook: post.hook,
        caption: post.caption,
        hashtags: post.hashtags,
        cta: post.cta,
        vehicle_id: body.vehicle_id ?? null,
        status: "draft",
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ post: saved, generated: post });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
