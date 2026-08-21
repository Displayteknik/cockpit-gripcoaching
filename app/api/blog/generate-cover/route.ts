import { NextRequest, NextResponse } from "next/server";
import { generateFlux, ensurePublicImageUrl } from "@/lib/images";
import { getActiveClient, getActiveClientId, logActivity } from "@/lib/client-context";
import { byggBildPrompt } from "@/lib/bild/promptbyggare";

export const runtime = "nodejs";
export const maxDuration = 120;

interface Body {
  title?: string;
  excerpt?: string;
  content?: string;
}

// Bildvägskopplingen (HELG-1 DEL 3, steg 2): blogg-maskinen in i lib/bild/promptbyggare.ts.
// Prioriterad framför Reels egentliga ordning eftersom blogginlägget PUBLICERAS UTAN
// GRANSKNING — omslagsbilden var tidigare den enda bildvägen som byggde sin egen prompt
// via en separat AI-craftningsanrop (`generateImageForPost`/`craftImagePromptWithAI` i
// lib/images.ts) i stället för K1–K5. Den funktionen rörs inte — den används fortfarande
// av legacy-vägen (app/api/social/generate-image), som är en separat pensioneringsfråga.
export async function POST(req: NextRequest) {
  const clientId = await getActiveClientId();
  const client = await getActiveClient();
  const body = (await req.json()) as Body;

  if (!body.title && !body.excerpt) {
    return NextResponse.json({ error: "title eller excerpt krävs" }, { status: 400 });
  }

  const byggd = await byggBildPrompt({
    clientId,
    niche: client?.industry || "business",
    syfte: "blogg-omslag",
    rubrik: body.title,
    brodtext: [body.excerpt, (body.content || "").replace(/<[^>]+>/g, " ").slice(0, 800)].filter(Boolean).join(" "),
  });

  const gen = await generateFlux(
    `${byggd.prompt} Beautiful editorial composition for a blog cover, sharp focus, on-brand emotional tone, 4K resolution feel. Avoid: readable words, lettering on signs or posters, watermarks, logos.`,
    "landscape",
  );
  if (!gen.success || !gen.image) {
    return NextResponse.json({ error: gen.error || "Bildgenerering misslyckades" }, { status: 500 });
  }

  const upload = await ensurePublicImageUrl(gen.image);
  if (upload.error) return NextResponse.json({ error: upload.error }, { status: 500 });

  await logActivity(clientId, "blog_cover_generated", "Omslagsbild genererad", "/dashboard/blogg");

  return NextResponse.json({ ok: true, image_url: upload.url, prompt: byggd.prompt });
}
