import { NextRequest, NextResponse } from "next/server";
import { generateImageForPost, ensurePublicImageUrl } from "@/lib/images";
import { supabaseServer } from "@/lib/supabase-admin";
import { getActiveClient, getActiveClientId, logActivity } from "@/lib/client-context";

export const runtime = "nodejs";
export const maxDuration = 120;

interface GenBody {
  post_id?: string;
  text?: string; // override content
  style?: string;
  mode?: "overlay" | "standalone";
  aspect?: "square" | "portrait" | "landscape";
}

export async function POST(req: NextRequest) {
  const clientId = await getActiveClientId();
  const client = await getActiveClient();
  const body = (await req.json()) as GenBody;
  const sb = supabaseServer();

  let contentText = body.text || "";
  if (body.post_id && !contentText) {
    const { data } = await sb.from("hm_social_posts").select("hook, caption").eq("id", body.post_id).eq("client_id", clientId).maybeSingle();
    contentText = data?.hook ? `${data.hook}\n\n${data.caption || ""}` : data?.caption || "";
  }
  if (!contentText) return NextResponse.json({ error: "text eller post_id (med innehåll) krävs" }, { status: 400 });

  const result = await generateImageForPost({
    contentText,
    niche: client?.industry || undefined,
    styleId: (body.style as Parameters<typeof generateImageForPost>[0]["styleId"]) || "cinematic",
    mode: body.mode || "standalone",
    aspect: body.aspect || "square",
  });

  if (!result.success || !result.image) {
    return NextResponse.json({ error: result.error || "Bildgenerering misslyckades" }, { status: 500 });
  }

  // Ladda upp till Supabase för permanent URL
  const upload = await ensurePublicImageUrl(result.image);
  if (upload.error) return NextResponse.json({ error: upload.error, debug: { engine: result.engine } }, { status: 500 });

  // Spara på post om angivet
  if (body.post_id) {
    await sb.from("hm_social_posts").update({
      image_url: upload.url,
      image_prompt: result.prompt,
      image_engine: result.engine,
      updated_at: new Date().toISOString(),
    }).eq("id", body.post_id).eq("client_id", clientId);
  }

  await logActivity(clientId, "image_generated", `Bild genererad (${result.engine})`, body.post_id ? "/dashboard/social" : undefined);

  return NextResponse.json({ ok: true, image_url: upload.url, prompt: result.prompt, engine: result.engine });
}
