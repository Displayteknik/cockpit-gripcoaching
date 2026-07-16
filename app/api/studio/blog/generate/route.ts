import { NextRequest, NextResponse } from "next/server";
import { getActiveClient, getActiveClientId } from "@/lib/client-context";
import { generateBlogArticle, buildFaqJsonLd, type InternalLink } from "@/lib/studio/blog";
import { getGhlConfig, ghlBlogMeta, ghlListBlogPosts, resolveBlogPostBase } from "@/lib/studio/ghl";
import { generateImagen, searchStockPhotos } from "@/lib/images";
import { supabaseService } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 120;

const BUCKET = "studio-images";

// POST /api/studio/blog/generate — { topic, wordCount, withImage } →
// stark SEO-artikel med interna länkar (klientens egna inlägg) + omslagsbild + FAQ-schema.
export async function POST(req: NextRequest) {
  try {
    const client = await getActiveClient();
    const clientId = await getActiveClientId();
    const b = await req.json().catch(() => ({}));
    const topic = (b.topic || "").toString().trim();
    if (!topic) return NextResponse.json({ error: "Ange ett ämne" }, { status: 400 });
    const withImage = b.withImage !== false;

    // 1) Interna länkar från klientens egna publicerade inlägg (om GHL kopplat).
    let internalLinks: InternalLink[] = [];
    let blogId = "";
    const cfg = await getGhlConfig(clientId);
    if (cfg) {
      const { meta } = await ghlBlogMeta(cfg);
      blogId = meta?.sites?.[0]?.id || "";
      if (blogId) {
        const [posts, base] = await Promise.all([
          ghlListBlogPosts(cfg, blogId, 40),
          resolveBlogPostBase(client?.public_url || ""),
        ]);
        if (base) {
          internalLinks = posts.slice(0, 12).map((p) => ({ title: p.title, url: `${base}${p.urlSlug}` }));
        }
      }
    }

    // 2) Artikeln.
    const article = await generateBlogArticle({
      clientId,
      topic,
      wordCount: Number(b.wordCount) || 900,
      brandName: client?.name || undefined,
      industry: client?.industry || undefined,
      internalLinks,
    });

    // 3) Omslagsbild (Nano Banana → studio-images; stock-fallback).
    let coverImageUrl = "";
    if (withImage) {
      coverImageUrl = await makeCoverImage(clientId, article.coverImagePrompt || topic, client?.industry || "");
    }

    // 4) Sätt ihop body: FAQ-schema (best-effort) i slutet.
    const html = article.html + buildFaqJsonLd(article.faq);

    return NextResponse.json({
      article: { ...article, html, coverImageUrl, blogId },
      internalLinksCount: internalLinks.length,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

async function makeCoverImage(clientId: string, prompt: string, industry: string): Promise<string> {
  try {
    const gen = await generateImagen(
      `${prompt}. Editorial photo for a ${industry || "business"} blog. Realistic, natural light, no text, no letters, no logos.`,
      "16:9",
    );
    const m = gen.image?.match(/^data:image\/(\w+);base64,(.+)$/);
    if (m) {
      const sb = supabaseService();
      const { data: buckets } = await sb.storage.listBuckets();
      if (!buckets?.some((x) => x.name === BUCKET)) await sb.storage.createBucket(BUCKET, { public: true });
      const path = `${clientId}/blog-${Date.now()}.png`;
      const up = await sb.storage.from(BUCKET).upload(path, Buffer.from(m[2], "base64"), { contentType: "image/png" });
      if (!up.error) return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    }
    // Fallback: riktigt stockfoto.
    const stock = await searchStockPhotos(prompt, industry, 1);
    return stock.photos?.[0]?.src || "";
  } catch {
    return "";
  }
}
