import { NextRequest, NextResponse } from "next/server";
import { generateImageForPost, ensurePublicImageUrl } from "@/lib/images";
import { getActiveClient, getActiveClientId, logActivity } from "@/lib/client-context";
import { getProfileAsMarkdown } from "@/lib/knowledge";

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

  // Hämta brand-profil + voice så bilden vet klientens tonalitet
  let brandContext = "";
  try {
    brandContext = await getProfileAsMarkdown();
  } catch {
    // tyst — utan brand-context faller vi tillbaka på industri-reglerna
  }

  const result = await generateImageForPost({
    contentText,
    niche: client?.industry || undefined,
    // Ingen styleId → låt defaultStyleForNiche välja smart per bransch
    styleId: body.style as Parameters<typeof generateImageForPost>[0]["styleId"] | undefined,
    mode: "standalone",
    aspect: "landscape",
    brandContext,
  });

  if (!result.success || !result.image) {
    return NextResponse.json({ error: result.error || "Bildgenerering misslyckades", engine: result.engine }, { status: 500 });
  }

  const upload = await ensurePublicImageUrl(result.image);
  if (upload.error) return NextResponse.json({ error: upload.error }, { status: 500 });

  await logActivity(clientId, "blog_cover_generated", `Omslagsbild genererad (${result.engine})`, "/dashboard/blogg");

  return NextResponse.json({ ok: true, image_url: upload.url, prompt: result.prompt, engine: result.engine });
}
