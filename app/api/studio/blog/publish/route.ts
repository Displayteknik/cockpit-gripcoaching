import { NextRequest, NextResponse } from "next/server";
import { getActiveClientId } from "@/lib/client-context";
import { getGhlConfig, ghlCreateBlogDraft } from "@/lib/studio/ghl";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/studio/blog/publish — skapar ett bloggutkast i GHL Blogs (status DRAFT).
// { blogId, title, html, description, urlSlug, author, categories[], imageUrl }
export async function POST(req: NextRequest) {
  try {
    const clientId = await getActiveClientId();
    const b = await req.json().catch(() => ({}));
    const blogId = (b.blogId || "").toString();
    const title = (b.title || "").toString().trim();
    const html = (b.html || "").toString();
    if (!blogId) return NextResponse.json({ error: "Välj en bloggsajt" }, { status: 400 });
    if (!title || !html) return NextResponse.json({ error: "Titel och innehåll krävs" }, { status: 400 });

    const cfg = await getGhlConfig(clientId);
    if (!cfg) return NextResponse.json({ error: "GHL är inte kopplat för den här klienten." }, { status: 400 });

    const { postId, error } = await ghlCreateBlogDraft(cfg, {
      blogId, title, html,
      description: b.description || "",
      urlSlug: b.urlSlug || "",
      author: b.author || undefined,
      categories: Array.isArray(b.categories) ? b.categories.filter(Boolean) : [],
      imageUrl: b.imageUrl || undefined,
      imageAltText: b.imageAltText || title,
    });
    if (error || !postId) return NextResponse.json({ error: error || "GHL skapade inget utkast" }, { status: 500 });
    return NextResponse.json({ ok: true, postId, status: "draft" });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
