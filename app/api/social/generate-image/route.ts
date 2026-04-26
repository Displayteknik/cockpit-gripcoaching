import { NextRequest, NextResponse } from "next/server";
import { generateImageForPost, ensurePublicImageUrl, type ImageFeedback } from "@/lib/images";
import { supabaseServer } from "@/lib/supabase-admin";
import { getActiveClient, getActiveClientId, logActivity } from "@/lib/client-context";

export const runtime = "nodejs";
export const maxDuration = 120;

interface GenBody {
  post_id?: string;
  text?: string;
  style?: string;
  mode?: "overlay" | "standalone";
  aspect?: "square" | "portrait" | "landscape";
  slide_index?: number; // för carousel-slides
}

export async function POST(req: NextRequest) {
  const clientId = await getActiveClientId();
  const client = await getActiveClient();
  const body = (await req.json()) as GenBody;
  const sb = supabaseServer();

  let contentText = body.text || "";
  let postData: { hook?: string; caption?: string; slides?: { number: number; headline: string; body: string; image_hint: string; image_url?: string }[]; image_url?: string } | null = null;
  if (body.post_id) {
    const { data } = await sb.from("hm_social_posts").select("hook, caption, slides, image_url").eq("id", body.post_id).eq("client_id", clientId).maybeSingle();
    postData = data;
    if (!contentText && data) {
      // Om slide_index → använd den specifika slidens text
      if (typeof body.slide_index === "number" && data.slides?.[body.slide_index]) {
        const sl = data.slides[body.slide_index];
        contentText = `${sl.headline}\n${sl.body}\n${sl.image_hint || ""}`;
      } else {
        contentText = data.hook ? `${data.hook}\n\n${data.caption || ""}` : data.caption || "";
      }
    }
  }
  if (!contentText) return NextResponse.json({ error: "text eller post_id (med innehåll) krävs" }, { status: 400 });

  // Hämta tidigare feedback för denna klient
  const { data: feedbackRows } = await sb.from("image_feedback").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(20);
  const feedback: ImageFeedback[] = (feedbackRows || []).map((f) => ({
    prompt: f.prompt,
    rating: f.rating,
    content_text: f.content_text,
    image_style: f.image_style,
  }));

  const result = await generateImageForPost({
    contentText,
    niche: client?.industry || undefined,
    styleId: (body.style as Parameters<typeof generateImageForPost>[0]["styleId"]) || "cinematic",
    mode: body.mode || "standalone",
    aspect: body.aspect || "square",
    feedback,
  });

  if (!result.success || !result.image) {
    return NextResponse.json({ error: result.error || "Bildgenerering misslyckades" }, { status: 500 });
  }

  // Ladda upp till Supabase för permanent URL
  const upload = await ensurePublicImageUrl(result.image);
  if (upload.error) return NextResponse.json({ error: upload.error, debug: { engine: result.engine } }, { status: 500 });

  // Spara på post om angivet
  if (body.post_id) {
    if (typeof body.slide_index === "number" && postData?.slides) {
      // Per-slide bild
      const slides = [...postData.slides];
      slides[body.slide_index] = { ...slides[body.slide_index], image_url: upload.url || undefined };
      await sb.from("hm_social_posts").update({ slides, updated_at: new Date().toISOString() }).eq("id", body.post_id).eq("client_id", clientId);
    } else {
      // Huvudbild
      await sb.from("hm_social_posts").update({
        image_url: upload.url,
        image_prompt: result.prompt,
        image_engine: result.engine,
        updated_at: new Date().toISOString(),
      }).eq("id", body.post_id).eq("client_id", clientId);
    }
  }

  await logActivity(clientId, "image_generated", `Bild genererad (${result.engine})`, body.post_id ? "/dashboard/social" : undefined);

  return NextResponse.json({ ok: true, image_url: upload.url, prompt: result.prompt, engine: result.engine });
}
