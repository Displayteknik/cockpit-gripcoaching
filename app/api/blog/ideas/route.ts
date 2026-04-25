import { NextResponse } from "next/server";
import { generateJSON } from "@/lib/gemini";
import { getKnowledge } from "@/lib/knowledge";
import { supabaseServer } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 60;

interface Idea {
  topic: string;
  angle: string;
  keyword: string;
  priority: number;
}

export async function POST() {
  const sb = supabaseServer();

  const [{ data: existingBlog }, { data: existingQueue }, { data: vehicles }] = await Promise.all([
    sb.from("hm_blog").select("title").limit(100),
    sb.from("hm_blog_queue").select("topic").limit(100),
    sb.from("hm_vehicles").select("category, brand, title").eq("is_sold", false).limit(50),
  ]);

  const existingTitles = [
    ...(existingBlog?.map((b) => b.title) || []),
    ...(existingQueue?.map((q) => q.topic) || []),
  ];

  const knowledge = await getKnowledge("company", "blog-playbook");

  const system = `Du föreslår bloggartiklar för HM Motor. SEO-fokus, lokal Jämtland-vinkel, köp-relevant.

${knowledge}

UNDVIK dessa ämnen (redan gjorda eller köade):
${existingTitles.join("\n") || "(inga än)"}

NUVARANDE LAGER (anpassa förslag till vad vi faktiskt har):
${(vehicles || []).map((v) => `- ${v.category}: ${v.brand} ${v.title}`).join("\n")}

RETURNERA JSON-array med 8 idéer:
[{ "topic": "...", "angle": "...", "keyword": "SEO-nyckelord", "priority": 1-10 }]

Prioritet 8-10 = köp-heta (folk söker & köper direkt). 5-7 = trust-byggande. 1-4 = nice-to-have.`;

  const ideas = await generateJSON<Idea[]>({
    model: "gemini-2.5-flash",
    systemInstruction: system,
    prompt: "Ge 8 artikel-idéer nu.",
    temperature: 1.0,
    maxOutputTokens: 2000,
  });

  return NextResponse.json(ideas);
}
