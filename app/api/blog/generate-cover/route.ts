import { NextRequest, NextResponse } from "next/server";
import { generateImageForPost, ensurePublicImageUrl } from "@/lib/images";
import { getActiveClient, getActiveClientId, logActivity } from "@/lib/client-context";

export const runtime = "nodejs";
export const maxDuration = 120;

interface Body {
  title?: string;
  excerpt?: string;
  content?: string;
  style?: string;
}

export async function POST(req: NextRequest) {
  const clientId = await getActiveClientId();
  const client = await getActiveClient();
  const body = (await req.json()) as Body;

  const seed = [body.title, body.excerpt].filter(Boolean).join(" — ");
  if (!seed) {
    return NextResponse.json({ error: "title eller excerpt krävs" }, { status: 400 });
  }

  // Plocka ~1500 tecken från content som extra kontext utan att blåsa upp prompten
  const contentText = [seed, (body.content || "").replace(/<[^>]+>/g, " ").slice(0, 1500)].join("\n\n");

  const result = await generateImageForPost({
    contentText,
    niche: client?.industry || undefined,
    styleId: (body.style as Parameters<typeof generateImageForPost>[0]["styleId"]) || "cinematic",
    mode: "standalone",
    aspect: "landscape", // 21:9-blogg-omslag
  });

  if (!result.success || !result.image) {
    return NextResponse.json({ error: result.error || "Bildgenerering misslyckades", engine: result.engine }, { status: 500 });
  }

  const upload = await ensurePublicImageUrl(result.image);
  if (upload.error) return NextResponse.json({ error: upload.error }, { status: 500 });

  await logActivity(clientId, "blog_cover_generated", `Omslagsbild genererad (${result.engine})`, "/dashboard/blogg");

  return NextResponse.json({ ok: true, image_url: upload.url, prompt: result.prompt, engine: result.engine });
}
