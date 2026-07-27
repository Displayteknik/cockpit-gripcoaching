import { NextRequest, NextResponse } from "next/server";
import { getActiveClient, getActiveClientId } from "@/lib/client-context";
import { requireAdminOrCustomer } from "@/lib/api-auth";
import { hasModule } from "@/lib/entitlements";
import { supabaseService } from "@/lib/supabase-admin";
import { generateNewsletter, renderNewsletterHtml, renderNewsletterText } from "@/lib/newsletter";
import { sanitizeGenerated, skrivreglerPa } from "@/lib/content/writing-rules";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/newsletter/generate — { blogId?, title?, articleText?, compass? }
// Blogg (eller fritext) → nyhetsbrev i klientens röst. Returnerar content + färdig HTML.
export async function POST(req: NextRequest) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;
  try {
    const clientId = await getActiveClientId();
    if (!(await hasModule(clientId, "newsletter").catch(() => false))) {
      return NextResponse.json({ error: "Nyhetsbrev ingår inte i ditt paket" }, { status: 403 });
    }
    const client = await getActiveClient();
    const b = await req.json().catch(() => ({}));
    const sb = supabaseService();

    let title = String(b.title || "").trim();
    let articleText = String(b.articleText || "").trim();

    // Från befintligt blogginlägg (tenant-låst).
    if (b.blogId) {
      const { data: blog } = await sb
        .from("hm_blog")
        .select("title, content, excerpt")
        .eq("id", b.blogId)
        .eq("client_id", clientId)
        .maybeSingle();
      if (!blog) return NextResponse.json({ error: "Hittade inte blogginlägget" }, { status: 404 });
      title = title || String(blog.title || "");
      articleText = String(blog.content || blog.excerpt || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    }

    if (articleText.length < 50) {
      return NextResponse.json({ error: "För lite innehåll att göra nyhetsbrev av (välj ett blogginlägg eller klistra in text)" }, { status: 400 });
    }

    const { data: prof } = await sb.from("hm_brand_profile").select("booking_url").eq("client_id", clientId).maybeSingle();
    const ctaUrl = (prof?.booking_url as string) || undefined;

    const content = await generateNewsletter({
      clientId,
      title,
      articleText,
      brandName: client?.name || undefined,
      compass: b.compass && typeof b.compass === "object" ? b.compass : null,
    });

    const subject = content.subjects[0] || title || "Nyhetsbrev";
    const brandName = client?.name || "";
    const html = renderNewsletterHtml(content, { brandName, primaryColor: client?.primary_color, ctaUrl });
    const text = renderNewsletterText(content, { brandName, ctaUrl });

    // Skyddsnät: skrivreglerna gäller även nyhetsbrev (inga hashtags i mejl).
    const pa = await skrivreglerPa(clientId);
    const r = (x: string) => (pa ? sanitizeGenerated(x, { hashtags: false }) : x);
    return NextResponse.json({ content, subject: r(subject), html: r(html), text: r(text), ctaUrl: ctaUrl || null, sourceBlogId: b.blogId || null });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
