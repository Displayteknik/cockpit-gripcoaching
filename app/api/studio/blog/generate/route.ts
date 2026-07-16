import { NextRequest, NextResponse } from "next/server";
import { getActiveClient, getActiveClientId } from "@/lib/client-context";
import { generateBlogArticle } from "@/lib/studio/blog";

export const runtime = "nodejs";
export const maxDuration = 90;

// POST /api/studio/blog/generate — { topic, wordCount } → SEO-artikel (brand-röst).
export async function POST(req: NextRequest) {
  try {
    const client = await getActiveClient();
    const clientId = await getActiveClientId();
    const b = await req.json().catch(() => ({}));
    const topic = (b.topic || "").toString().trim();
    if (!topic) return NextResponse.json({ error: "Ange ett ämne" }, { status: 400 });

    const article = await generateBlogArticle({
      clientId,
      topic,
      wordCount: Number(b.wordCount) || 800,
      brandName: client?.name || undefined,
      industry: client?.industry || undefined,
    });
    return NextResponse.json({ article });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
