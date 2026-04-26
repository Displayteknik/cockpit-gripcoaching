import { NextRequest, NextResponse } from "next/server";
import { generateJSON } from "@/lib/gemini";
import { getKnowledge } from "@/lib/knowledge";
import { supabaseServer } from "@/lib/supabase-admin";
import { getActiveClientId, logActivity } from "@/lib/client-context";

export const runtime = "nodejs";
export const maxDuration = 180;

interface Generated {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  meta_description: string;
  suggested_image_search: string;
  internal_links_used: string[];
}

export async function POST(req: NextRequest) {
  try {
    const clientId = await getActiveClientId();
    const body = await req.json();
    const topic: string = body.topic;
    const angle: string | undefined = body.angle;
    const keyword: string | undefined = body.keyword;
    const queueId: string | undefined = body.queue_id;
    const outlineHint = body.outline; // optional outline objekt från queue

    if (!topic) return NextResponse.json({ error: "topic krävs" }, { status: 400 });

    const sb = supabaseServer();
    if (queueId) {
      await sb.from("hm_blog_queue").update({ status: "generating" }).eq("id", queueId).eq("client_id", clientId);
    }

    const knowledge = await getKnowledge("blog-playbook", "conversion");

    // Befintliga artiklar för internal linking (per klient)
    const { data: existing } = await sb
      .from("hm_blog")
      .select("title, slug, excerpt")
      .eq("client_id", clientId)
      .eq("published", true)
      .limit(50);
    const existingCtx = (existing || []).map((b) => `- "${b.title}" → /blogg/${b.slug} : ${b.excerpt || ""}`).join("\n");

    const outlineCtx = outlineHint ? `\n\nGODKÄND DISPOSITION (FÖLJ DENNA EXAKT):\n${JSON.stringify(outlineHint, null, 2)}\n` : "";

    const system = `Du är klientens bloggförfattare. SEO-artiklar med Voice-of-Customer-känsla.

${knowledge}

EXISTERANDE ARTIKLAR (länka aktivt till relevanta):
${existingCtx || "(inga än)"}
${outlineCtx}

HÅRDA REGLER:
- ALDRIG AI-språk ("kraftfull", "handlar om", "nästa nivå", "banbrytande", "game-changer", "holistisk").
- Svenska tecken korrekt.
- Skriv som en kunnig granne — inte som en expert på scenen.
- Använd <h2>, <h3>, <ul><li>, <p>, <strong>. INGET <h1> (sätts av sajten).
- Internal links: <a href="/blogg/[slug]">text</a> där det är RELEVANT — ej forcerat.
- 600–1500 ord. FAQ-sektion i slutet med <h3> + <p>.
- Direkta svar i första meningen efter varje H2 (AEO-bonus).
- Inkludera schema-vänliga element: tydliga frågor, listor, definitioner.

RETURNERA JSON:
{
  "title": "Rubrik (utan H1-taggar)",
  "slug": "url-slug-utan-svenska-tecken",
  "excerpt": "1–2 meningar (max 160 tecken)",
  "content": "HTML-innehållet, utan <h1>",
  "meta_description": "SEO-meta 140–160 tecken",
  "suggested_image_search": "Engelskt sökord för bild",
  "internal_links_used": ["/blogg/slug1", "/blogg/slug2"]
}`;

    const prompt = `Ämne: ${topic}
${angle ? `Vinkel: ${angle}` : ""}
${keyword ? `Primärt sökord: ${keyword}` : ""}

Skriv artikeln nu enligt dispositionen + reglerna.`;

    const article = await generateJSON<Generated>({
      model: "gemini-2.5-pro",
      systemInstruction: system,
      prompt,
      temperature: 0.8,
      maxOutputTokens: 8000,
    });

    const slug = (article.slug || topic.toLowerCase())
      .replace(/[åä]/g, "a")
      .replace(/ö/g, "o")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    // Klientens namn för author-default
    const { data: clientRow } = await sb.from("clients").select("name").eq("id", clientId).maybeSingle();
    let blogId: string | null = null;
    const { data: blog, error } = await sb
      .from("hm_blog")
      .insert({
        client_id: clientId,
        slug,
        title: article.title,
        content: article.content,
        excerpt: article.excerpt,
        author: clientRow?.name || "Redaktionen",
        published: false,
        published_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) {
      if (queueId) await sb.from("hm_blog_queue").update({ status: "queued", error: error.message }).eq("id", queueId);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    blogId = blog.id;

    if (queueId) {
      await sb
        .from("hm_blog_queue")
        .update({ status: "draft", blog_post_id: blogId, generated_at: new Date().toISOString() })
        .eq("id", queueId);
    }

    await logActivity(clientId, "blog_generated", `Artikel: ${article.title}`, blogId ? `/blogg/${slug}` : undefined, { word_count: article.content.split(/\s+/).length });

    return NextResponse.json({ blog_id: blogId, slug, article });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
