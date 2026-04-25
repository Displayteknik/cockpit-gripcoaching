import { NextRequest, NextResponse } from "next/server";
import { generateJSON } from "@/lib/gemini";
import { getKnowledge } from "@/lib/knowledge";
import { supabaseServer } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 120;

interface Generated {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  meta_description: string;
  suggested_image_search: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const topic: string = body.topic;
    const angle: string | undefined = body.angle;
    const keyword: string | undefined = body.keyword;
    const queueId: string | undefined = body.queue_id;

    if (!topic) return NextResponse.json({ error: "topic krävs" }, { status: 400 });

    const sb = supabaseServer();
    if (queueId) {
      await sb.from("hm_blog_queue").update({ status: "generating" }).eq("id", queueId);
    }

    const knowledge = await getKnowledge("company", "blog-playbook", "conversion");

    const system = `Du är HM Motors bloggförfattare. Du skriver SEO-artiklar för en lokal bilhandlare i Krokom, Jämtland.

${knowledge}

HÅRDA REGLER:
- ALDRIG AI-språk ("kraftfull", "handlar om", "nästa nivå", "banbrytande", "game-changer", "holistisk").
- Svenska tecken korrekt.
- Skriv som en kunnig granne — inte som en expert på scenen.
- Artikeln ska vara klar att publicera.
- Använd <h2> och <h3> för rubriker, <ul><li> för listor, <p> för stycken, <strong> för betoning.
- INGET <h1>, det sätts av sajten.
- Intern länk: skriv [kontakta oss](/kontakt) eller länka till /fordon/[slug] där relevant.
- 600–1200 ord normalt.
- Inkludera en kort FAQ-sektion i slutet (3–5 frågor) med <h3> + <p>.

RETURNERA JSON:
{
  "title": "Rubrik (utan H1-taggar)",
  "slug": "url-slug-med-bindestreck-utan-a-a-o",
  "excerpt": "1–2 meningar som förhandsvisning (max 160 tecken)",
  "content": "HTML-innehållet, utan <h1>",
  "meta_description": "SEO-meta 140–160 tecken",
  "suggested_image_search": "Engelskt sökord för bild"
}`;

    const prompt = `Ämne: ${topic}
${angle ? `Vinkel: ${angle}` : ""}
${keyword ? `Primärt sökord: ${keyword}` : ""}

Skriv artikeln nu. Lokal Jämtland-vinkel där det passar.`;

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

    const { data: blog, error } = await sb
      .from("hm_blog")
      .insert({
        slug,
        title: article.title,
        content: article.content,
        excerpt: article.excerpt,
        author: "HM Motor",
        published: false,
        published_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      if (queueId) await sb.from("hm_blog_queue").update({ status: "queued", error: error.message }).eq("id", queueId);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (queueId) {
      await sb
        .from("hm_blog_queue")
        .update({ status: "draft", blog_post_id: blog.id, generated_at: new Date().toISOString() })
        .eq("id", queueId);
    }

    return NextResponse.json({ blog, article });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
