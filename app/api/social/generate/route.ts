import { NextRequest, NextResponse } from "next/server";
import { generateJSON } from "@/lib/gemini";
import { byggTextPrompt, saneraText } from "@/lib/prompt-core";
import { supabaseServer } from "@/lib/supabase-admin";
import { getActiveClient, getActiveClientId, logActivity } from "@/lib/client-context";

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

    // TEXT-1 T-2: prompten byggs av prompt-core (kunskap, brand-profil, röst, winning,
    // anatomi/compass och skrivregler ägs av kärnan). Uppdraget = flödets hårda regler.
    const uppdrag = `Du är ${client?.name || "klientens"} egna content-producent. Du skriver konverterande inlägg för Instagram och Facebook på svenska.

FORMAT-INSTRUKTION: ${formatGuide}

HÅRDA REGLER:
- Skriv ALDRIG AI-språk: "kraftfull", "nästa nivå", "banbrytande", "game-changer", "holistisk", "skalbar".
- ALDRIG någon form av "handla om" — varken "handlar om", "handlade om", "handlat om", "det handlar om", "det handlade om". INGA TEMPUS. Skriv om till konkret formulering.
- Svenska tecken (å/ä/ö) ALLTID korrekta.
- En CTA per inlägg.
- Följ 3-sekundersregeln i hooken.
- Inte "i denna artikel" eller "vi kommer att" — skriv direkt.
- Skriv ALDRIG strukturella etiketter ("Hook:", "Caption:", "CTA:", "Hashtags:", "Format note:") inuti fält-värdena. Varje fält ska vara ENBART det copy-paste-färdiga innehållet.
- INGEN emoji-prefix på hook (🎣, 🚨, 💡 etc) — Ingela skriver inte med scroll-stop-emojis.
- INGA hashtags i caption — hashtags hör endast hemma i hashtags-fältet. Aldrig dubbla.`;

    const jsonSchema = `{
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

    // T-6c (rotation): de senaste genererade hookarna → "NYLIGEN ANVÄNT" i kärnan,
    // så nästa inlägg inte återanvänder samma ingång/öppning.
    const { data: senaste } = await sb
      .from("hm_social_posts")
      .select("hook")
      .eq("client_id", clientId)
      .not("hook", "is", null)
      .order("created_at", { ascending: false })
      .limit(5);
    const nyligen = (senaste ?? []).map((p) => String(p.hook || "")).filter(Boolean);

    const bygg = await byggTextPrompt({
      clientId,
      syfte: "social",
      kanal: body.platform,
      uppdrag,
      underlag: userPrompt,
      knowledge: ["viral-hooks", "conversion"],
      nyligen,
      jsonSchema,
    });

    const post = await generateJSON<GeneratedPost>({
      model: "gemini-2.5-pro",
      systemInstruction: bygg.system,
      prompt: bygg.user,
      temperature: 0.9,
      maxOutputTokens: isCarousel ? 4000 : 2000,
      skrivregler: false, // prompt-core äger skrivregler-flaggan (TEXT-1)
    });

    // Strukturell städning (etiketter, emoji-prefix, hashtag-läckage) — formatfix,
    // inte språksanering. Språket saneras enhetligt av saneraText (TEXT-1) nedan.
    const stripLabels = (s: string | undefined): string => {
      if (!s) return "";
      let t = s.trim();
      t = t.replace(/^\s*(?:HOOK|Hook|hook|BODY|Body|body|CAPTION|Caption|caption|CTA|Cta|cta|HASHTAGS?|Hashtags?|hashtags?|FORMAT[\s_]?NOTE?|Format[\s_]?Note?|format[\s_]?note?)\s*[:\-–—]\s*/i, "");
      t = t.replace(/^\s*(?:HOOK|BODY|CAPTION|CTA|HASHTAGS|FORMAT[\s_]NOTE)\s*[:\-–—].*$/gim, "");
      t = t.replace(/\n{3,}/g, "\n\n").trim();
      return t;
    };
    const stripEmojiPrefix = (s: string): string => s.replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}]+\s*/u, "").trim();
    const stripHashtagBlock = (s: string): string => {
      let t = s.trim();
      t = t.replace(/\n+\s*(?:#\S+\s*){2,}\s*$/g, "");
      t = t.replace(/\n+\s*(?:#\S+\s*){2,}\s*$/g, "");
      return t.trim();
    };
    // TEXT-1: den egna stripForbidden-funktionen ersatt av enhetlig saneraText.
    const kanal = body.platform === "facebook" ? "facebook" : "instagram";
    [post.hook, post.caption, post.cta, post.hashtags] = await Promise.all([
      saneraText(stripEmojiPrefix(stripLabels(post.hook)), clientId, kanal),
      saneraText(stripHashtagBlock(stripLabels(post.caption)), clientId, kanal),
      saneraText(stripLabels(post.cta), clientId, kanal),
      saneraText(stripLabels(post.hashtags), clientId, kanal),
    ]);
    // T-5 (2): slides är också kundtext — samma sanering som huvudfälten.
    if (Array.isArray(post.slides)) {
      for (const s of post.slides) {
        [s.headline, s.body] = await Promise.all([
          saneraText(stripLabels(s.headline), clientId, kanal),
          saneraText(stripLabels(s.body), clientId, kanal),
        ]);
      }
    }

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
