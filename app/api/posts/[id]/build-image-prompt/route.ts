/**
 * /api/posts/[id]/build-image-prompt
 *
 * Bygger en smart bild-prompt baserat på HELA inläggets kontext:
 * hook + body + cta + klientens brand-profil + voice + customer_voice +
 * pelare. Returnerar en strukturerad prompt som är optimerad för
 * Imagen/FLUX/Nano Banana — och som UNDVIKER svensk text i bilden
 * (eftersom å/ä/ö renderas trasigt i alla bildmodeller idag).
 */
import { NextRequest, NextResponse } from "next/server";
import { generateJSON } from "@/lib/gemini";
import { getKnowledge, getProfileAsMarkdown } from "@/lib/knowledge";
import { supabaseService } from "@/lib/supabase-admin";
import { getActiveClient, getActiveClientId } from "@/lib/client-context";

export const runtime = "nodejs";
export const maxDuration = 60;

interface BuildResult {
  english_prompt: string;
  scene_description: string;
  visual_style: string;
  composition: string;
  mood: string;
  text_overlay: string;
  avoid: string;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const sb = supabaseService();
    const clientId = await getActiveClientId();
    const client = await getActiveClient();

    // Hämta posten — kan vara hm_social_posts ELLER linkedin_posts
    let post: { hook?: string; body?: string; caption?: string; cta?: string; pillar?: string; format?: string } | null = null;

    const { data: socialPost } = await sb
      .from("hm_social_posts")
      .select("hook, caption, cta, format")
      .eq("id", id)
      .eq("client_id", clientId)
      .maybeSingle();
    if (socialPost) post = socialPost;

    if (!post) {
      const { data: liPost } = await sb
        .from("linkedin_posts")
        .select("hook, body, cta, format, pillar")
        .eq("id", id)
        .eq("client_id", clientId)
        .maybeSingle();
      if (liPost) post = liPost;
    }

    // Tillåt också att skicka hook + body direkt i body (fallback)
    if (!post) {
      const fb = await req.json().catch(() => ({}));
      if (fb.hook || fb.body) post = { hook: fb.hook, body: fb.body, cta: fb.cta };
    }

    if (!post) return NextResponse.json({ error: "Post saknas" }, { status: 404 });

    const profileMd = await getProfileAsMarkdown();
    const imageSkills = await getKnowledge("image-generation", "image-anti-cliches", "image-by-industry");

    const system = `Du är en expert på bild-prompts för AI-bildmodeller (Imagen, FLUX, Nano Banana / Gemini 2.5 Flash Image).

Du följer ALLA principer i image-generation playbook + anti-klyschor + per-bransch-guide nedan.

${imageSkills}



Du tar ett SVENSKT social-media-inlägg och bygger en ENGELSK bild-prompt som är optimerad för dessa modeller. Engelska för att modellerna förstår engelska bäst, OCH för att svenska tecken (å, ä, ö) renderas trasigt om de hamnar i text-overlay.

DIN UPPGIFT:
1. Förstå inläggets EMOTIONELLA + TEMATISKA kärna (inte bara hooken — hela meningen)
2. Bygg en konkret visuell scen som speglar känslan/temat
3. Sätt rätt visuell stil för klienten
4. Lägg in komposition + ljus + känsla
5. Var EXPLICIT om vad som ska UNDVIKAS (text overlay, generic stock-look, klyschor)

VIKTIGA REGLER:
- INGEN svensk text i bilden. Inga skyltar, inga ord på skärmar, ingen overlay-text på svenska. Modellen klarar inte å/ä/ö.
- Om text BEHÖVS i bilden — bara klientens varumärkesnamn på engelska/symboliskt vis (t.ex. "OPTICUR" som logotyp).
- INGA klyschor: handslag, glödlampor, pussel-bitar, riktningspilar mot framgång, generiska business-personer.
- Naturligt ljus, candid-känsla, dokumentärfoto-stil när möjligt.
- Konkret människa eller scen — inte abstraktion. Ingela vill se igenkänning hos läsaren.

KLIENTENS KONTEXT (brand-profil + voice + customer voice + winning examples):
${profileMd}

KLIENT-NAMN: ${client?.name || "okänd"}
PRIMARY COLOR: ${client?.primary_color || "#1A6B3C"}

RETURNERA JSON:
{
  "english_prompt": "EN long-form prompt på engelska som täcker HELA scenen, stil, komposition, ljus, mood. Detta skickas DIREKT till bildmodellen.",
  "scene_description": "Vad scenen visar (1-2 meningar svenska — för Hakans förståelse)",
  "visual_style": "Stil: dokumentär / cinematisk / minimalistisk / etc",
  "composition": "Komposition: porträtt / wide / närbild / etc",
  "mood": "Känsla: hopp / igenkänning / lugn / etc",
  "text_overlay": "EITHER 'none' OR very short brand-text in safe English chars",
  "avoid": "Klyschor + AI-tells att specifikt undvika i denna bild"
}`;

    const userPrompt = `## INLÄGGET

HOOK: ${post.hook ?? "(saknas)"}
${post.body ? `BODY: ${post.body}` : post.caption ? `CAPTION: ${post.caption}` : ""}
${post.cta ? `CTA: ${post.cta}` : ""}
${post.pillar ? `PELARE: ${post.pillar}` : ""}
${post.format ? `FORMAT: ${post.format}` : ""}

Bygg den smarta bild-prompten nu. Returnera bara JSON.`;

    const result = await generateJSON<BuildResult>({
      model: "gemini-2.5-pro",
      systemInstruction: system,
      prompt: userPrompt,
      temperature: 0.7,
      maxOutputTokens: 2500,
    });

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
