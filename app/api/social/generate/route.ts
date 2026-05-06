import { NextRequest, NextResponse } from "next/server";
import { generateJSON } from "@/lib/gemini";
import { getKnowledge } from "@/lib/knowledge";
import { supabaseServer } from "@/lib/supabase-admin";
import { getActiveClient, getActiveClientId, logActivity } from "@/lib/client-context";
import { getVoiceFingerprint, fingerprintToPromptBlock } from "@/lib/voice-fingerprint";

export const runtime = "nodejs";
export const maxDuration = 60;

interface CarouselSlide {
  number: number;
  headline: string;
  body: string;
  image_hint: string;
}

interface GeneratedPost {
  hook: string;
  caption: string;
  hashtags: string;
  cta: string;
  format_note: string;
  slides?: CarouselSlide[];
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
    const clientId = await getActiveClientId();
    const client = await getActiveClient();
    const sb = supabaseServer();

    // Resurs-kontext baserat på klientens module
    let resourceCtx = "";
    if (body.vehicle_id && client?.resource_module === "automotive") {
      const { data: v } = await sb
        .from("hm_vehicles")
        .select("title, brand, model, category, description, price, price_label, badge, specs")
        .eq("client_id", clientId)
        .eq("id", body.vehicle_id)
        .single();
      if (v) resourceCtx = `\n## FORDONSKONTEXT\n${JSON.stringify(v, null, 2)}\n`;
    } else if (body.vehicle_id && client?.resource_module === "art") {
      const { data: w } = await sb
        .from("art_works")
        .select("title, artist, year, technique, medium, width_cm, height_cm, description, price, price_label, status, tags")
        .eq("client_id", clientId)
        .eq("id", body.vehicle_id)
        .single();
      if (w) resourceCtx = `\n## VERK-KONTEXT\n${JSON.stringify(w, null, 2)}\n`;
    }

    const knowledge = await getKnowledge("viral-hooks", "conversion");
    const fp = await getVoiceFingerprint(clientId).catch(() => null);
    const voiceBlock = fp ? fingerprintToPromptBlock(fp) : "";
    const isCarousel = body.format === "carousel";

    const slideSchema = isCarousel
      ? `,
  "slides": [
    { "number": 1, "headline": "Slide 1 hook", "body": "Kort text för slide 1", "image_hint": "Bildidé för slide 1" },
    { "number": 2, "headline": "...", "body": "...", "image_hint": "..." }
  ]`
      : "";

    const formatGuide = isCarousel
      ? `Detta är en CAROUSEL — generera 6–8 slides. Slide 1 = hook + "swipe →". Slide 2–7 = en poäng/slide. Sista slide = CTA. Headlines korta (max 5–7 ord). Body 1–2 meningar/slide.`
      : body.format === "reel"
      ? `Detta är ett REEL (15–30 sek). Hook i första 3 sek måste stoppa scroll. Skriv som voiceover-script.`
      : body.format === "story"
      ? `Detta är en STORY. Kort, personlig, känns spontan. Inkludera engagement-trigger (poll/fråga/sticker).`
      : `Standard inlägg. Hook först, värde sen, CTA sist.`;

    const system = `Du är ${client?.name || "klientens"} egna content-producent. Du skriver konverterande inlägg för Instagram och Facebook på svenska.

${knowledge}

${voiceBlock}

FORMAT-INSTRUKTION: ${formatGuide}

HÅRDA REGLER:
- Skriv ALDRIG AI-språk: "kraftfull", "handlar om", "nästa nivå", "banbrytande", "game-changer", "holistisk", "skalbar".
- Svenska tecken (å/ä/ö) ALLTID korrekta.
- En CTA per inlägg.
- Följ 3-sekundersregeln i hooken.
- Inte "i denna artikel" eller "vi kommer att" — skriv direkt.

RETURNERA JSON:
{
  "hook": "3 sekunder — texten som stoppar scrollen",
  "caption": "Hela inläggstexten",
  "hashtags": "#hashtag1 #hashtag2 ...",
  "cta": "Vilken CTA används",
  "format_note": "Praktisk regianvisning för bild/video"${slideSchema}
}`;

    const userPrompt = `Plattform: ${body.platform}
Format: ${body.format}
${body.angle ? `Vinkel: ${body.angle}` : ""}
${body.extra ? `Extra info: ${body.extra}` : ""}
${resourceCtx}

Skriv det konverterande inlägget enligt reglerna nu.`;

    const post = await generateJSON<GeneratedPost>({
      model: "gemini-2.5-pro",
      systemInstruction: system,
      prompt: userPrompt,
      temperature: 0.9,
      maxOutputTokens: isCarousel ? 4000 : 2000,
    });

    const { data: saved, error } = await sb
      .from("hm_social_posts")
      .insert({
        client_id: clientId,
        platform: body.platform,
        format: body.format,
        hook: post.hook,
        caption: post.caption,
        hashtags: post.hashtags,
        cta: post.cta,
        slides: post.slides || null,
        vehicle_id: body.vehicle_id ?? null,
        status: "draft",
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await logActivity(clientId, "social_generated", `${body.platform} ${body.format}: ${post.hook?.slice(0, 60)}`, "/dashboard/social");
    return NextResponse.json({ post: saved, generated: post });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
