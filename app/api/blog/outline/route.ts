import { NextRequest, NextResponse } from "next/server";
import { generateJSON } from "@/lib/gemini";
import { getKnowledge } from "@/lib/knowledge";
import { supabaseServer } from "@/lib/supabase-admin";
import { getActiveClientId } from "@/lib/client-context";

export const runtime = "nodejs";
export const maxDuration = 60;

interface OutlineSection {
  heading: string;
  type: "intro" | "h2" | "h3" | "faq";
  key_points: string[];
  word_target: number;
}

interface Outline {
  title: string;
  meta_description: string;
  primary_keyword: string;
  secondary_keywords: string[];
  intent: string;
  word_target: number;
  sections: OutlineSection[];
  faq: { question: string; short_answer: string }[];
}

export async function POST(req: NextRequest) {
  const clientId = await getActiveClientId();
  const body = await req.json();
  const queueId: string | undefined = body.queue_id;
  const topic: string = body.topic;
  const angle: string | undefined = body.angle;
  const keyword: string | undefined = body.keyword;

  if (!topic) return NextResponse.json({ error: "topic krävs" }, { status: 400 });

  const knowledge = await getKnowledge("blog-playbook", "conversion");
  const sb = supabaseServer();

  // Hämta befintliga publicerade artiklar för internal-linking-kontext (per klient)
  const { data: existing } = await sb
    .from("hm_blog")
    .select("title, slug, excerpt")
    .eq("client_id", clientId)
    .eq("published", true)
    .limit(50);
  const existingCtx = (existing || []).map((b) => `- ${b.title} (/blogg/${b.slug})`).join("\n");

  const system = `Du är SEO-strateg och bygger en konverteringsgrundad disposition för en bloggartikel. Svenska. Utan AI-språk.

${knowledge}

EXISTERANDE ARTIKLAR (för internal linking-medvetenhet):
${existingCtx || "(inga än)"}

RETURNERA JSON:
{
  "title": "SEO-optimerad titel (utan H1)",
  "meta_description": "140–160 tecken, börja med primärt sökord om möjligt",
  "primary_keyword": "huvudsökord",
  "secondary_keywords": ["sökord2", "sökord3"],
  "intent": "informational | commercial | transactional | navigational",
  "word_target": 800,
  "sections": [
    { "heading": "Intro (2–3 meningar)", "type": "intro", "key_points": ["vem artikeln är för", "vad de får ut"], "word_target": 60 },
    { "heading": "H2-rubrik 1", "type": "h2", "key_points": ["punkt 1", "punkt 2"], "word_target": 200 }
  ],
  "faq": [
    { "question": "Vanlig fråga 1?", "short_answer": "Kort direkt svar 1–2 meningar" }
  ]
}

Krav:
- 5–8 sektioner inklusive intro
- 3–5 FAQ
- H2-rubriker som FRÅGOR där det passar (AEO-vinst)
- Koppla minst 1 internal-link-möjlighet i key_points till befintlig artikel`;

  const prompt = `Ämne: ${topic}
${angle ? `Vinkel: ${angle}` : ""}
${keyword ? `Primärt sökord: ${keyword}` : ""}

Bygg dispositionen nu.`;

  const outline = await generateJSON<Outline>({
    model: "gemini-2.5-pro",
    systemInstruction: system,
    prompt,
    temperature: 0.6,
    maxOutputTokens: 4000,
  });

  if (queueId) {
    await sb.from("hm_blog_queue").update({ outline, outline_approved: false }).eq("id", queueId).eq("client_id", clientId);
  }

  return NextResponse.json(outline);
}
