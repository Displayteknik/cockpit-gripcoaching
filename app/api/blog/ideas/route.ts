import { NextResponse } from "next/server";
import { generateJSON } from "@/lib/gemini";
import { getKnowledge } from "@/lib/knowledge";
import { supabaseServer } from "@/lib/supabase-admin";
import { getActiveClient, getActiveClientId } from "@/lib/client-context";

export const runtime = "nodejs";
export const maxDuration = 60;

interface Idea {
  topic: string;
  angle: string;
  keyword: string;
  priority: number;
}

export async function POST() {
  const clientId = await getActiveClientId();
  const client = await getActiveClient();
  const sb = supabaseServer();
  const isAutomotive = client?.resource_module === "automotive";
  const isArt = client?.resource_module === "art";

  const [{ data: existingBlog }, { data: existingQueue }, vehiclesRes, worksRes] = await Promise.all([
    sb.from("hm_blog").select("title").eq("client_id", clientId).limit(100),
    sb.from("hm_blog_queue").select("topic").eq("client_id", clientId).limit(100),
    isAutomotive ? sb.from("hm_vehicles").select("category, brand, title").eq("client_id", clientId).eq("is_sold", false).limit(50) : Promise.resolve({ data: [] as { category: string; brand: string; title: string }[] }),
    isArt ? sb.from("art_works").select("title, technique, year").eq("client_id", clientId).neq("status", "archived").limit(50) : Promise.resolve({ data: [] as { title: string; technique: string; year: number }[] }),
  ]);

  const existingTitles = [
    ...(existingBlog?.map((b) => b.title) || []),
    ...(existingQueue?.map((q) => q.topic) || []),
  ];

  const knowledge = await getKnowledge("company", "blog-playbook");

  const inventoryBlock = isAutomotive
    ? `NUVARANDE LAGER (anpassa förslag till vad vi faktiskt har):\n${(vehiclesRes.data || []).map((v) => `- ${v.category}: ${v.brand} ${v.title}`).join("\n")}`
    : isArt
    ? `KONSTNÄRSKAP (anpassa förslag till verken och tekniker):\n${(worksRes.data || []).map((w) => `- ${w.title} (${w.technique || "okänd teknik"}${w.year ? `, ${w.year}` : ""})`).join("\n")}`
    : "";

  const system = `Du föreslår bloggartiklar för ${client?.name || "klienten"}. SEO-fokus, ${isArt ? "konstnärlig och berättande vinkel" : "köp-relevant lokal vinkel"}.

${knowledge}

UNDVIK dessa ämnen (redan gjorda eller köade):
${existingTitles.join("\n") || "(inga än)"}

${inventoryBlock}

RETURNERA JSON-array med 8 idéer:
[{ "topic": "...", "angle": "...", "keyword": "SEO-nyckelord", "priority": 1-10 }]

Prioritet 8-10 = ${isArt ? "samlare-heta (de som köper konst söker)" : "köp-heta (folk söker & köper direkt)"}. 5-7 = trust-byggande. 1-4 = nice-to-have.`;

  const ideas = await generateJSON<Idea[]>({
    model: "gemini-2.5-flash",
    systemInstruction: system,
    prompt: "Ge 8 artikel-idéer nu.",
    temperature: 1.0,
    maxOutputTokens: 2000,
  });

  return NextResponse.json(ideas);
}
