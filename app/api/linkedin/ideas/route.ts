import { NextRequest, NextResponse } from "next/server";
import { generateJSON } from "@/lib/gemini";
import { getKnowledge } from "@/lib/knowledge";
import { supabaseServer } from "@/lib/supabase-admin";
import { getActiveClient, getActiveClientId, logActivity } from "@/lib/client-context";

export const runtime = "nodejs";
export const maxDuration = 60;

interface IdeaSeed {
  hook: string;
  angle: string;
  pillar: string;
  trust_gate: "know" | "like" | "trust" | "try" | "buy" | "repeat";
  format: "text" | "carousel" | "video" | "poll" | "document";
  why_it_works: string;
}

interface GenResponse {
  ideas: IdeaSeed[];
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { count?: number; pillar?: string; mode?: string };
    const count = Math.min(Math.max(body.count ?? 10, 1), 20);
    const clientId = await getActiveClientId();
    const client = await getActiveClient();
    const sb = supabaseServer();

    const { data: pillarsData } = await sb
      .from("linkedin_pillars")
      .select("name, description")
      .eq("client_id", clientId)
      .eq("archived", false)
      .order("sort_order", { ascending: true });
    const pillars = (pillarsData ?? []).map((p) => `- ${p.name}${p.description ? `: ${p.description}` : ""}`).join("\n");

    const { data: recentPosts } = await sb
      .from("linkedin_posts")
      .select("hook, pillar")
      .eq("client_id", clientId)
      .in("status", ["posted", "approved", "draft"])
      .order("created_at", { ascending: false })
      .limit(20);
    const recentHooks = (recentPosts ?? []).map((p) => `- (${p.pillar ?? "—"}) ${p.hook ?? ""}`).join("\n");

    const knowledge = await getKnowledge("linkedin-foundation", "linkedin-formats", "linkedin-advanced");

    const pillarFilter = body.pillar
      ? `\n\nFOKUSPELARE: Generera ALLA idéer kring pelaren "${body.pillar}".`
      : `\n\nFÖRDELA idéerna mellan pelarna ovan så jämnt som möjligt.`;

    const system = `Du är ${client?.name || "klientens"} egna LinkedIn-strateg.

Du följer Hakan Grips kursmetodik "Från Okänd till Kund" och de hårda principerna nedan.

${knowledge}

KLIENTENS PELARE (content-teman):
${pillars || "(inga definierade — använd brand-profilens pain points som proxy)"}

SENASTE ${recentPosts?.length ?? 0} HOOKS (undvik att upprepa):
${recentHooks || "(inga ännu)"}

UPPGIFT: Generera ${count} skarpa idéer för LinkedIn-inlägg som låter EXAKT som denna klient. Varje idé ska:
- Ha en hook som följer Triple S (Stop, Specify, Sell the read)
- Vara konkret nog att kunna skrivas direkt utan extra research
- Variera mellan format (text dominerar, men minst 1-2 karuseller och 1 poll)
- Variera mellan trust-portar (mestadels know/like/trust för fritt content; max 20% try/buy)
- Aldrig återanvända en hook från senaste inläggen${pillarFilter}

RETURNERA JSON exakt så här:
{
  "ideas": [
    {
      "hook": "Konkret hook-mening (max 12 ord)",
      "angle": "1-2 meningar som beskriver vad inlägget driver — den sammanfattande poängen",
      "pillar": "Vilken pelare den hör till",
      "trust_gate": "know|like|trust|try|buy|repeat",
      "format": "text|carousel|video|poll|document",
      "why_it_works": "1 mening om varför hooken stoppar scrollen och varför den är rätt för denna klient"
    }
  ]
}`;

    const result = await generateJSON<GenResponse>({
      model: "gemini-2.5-pro",
      systemInstruction: system,
      prompt: `Generera ${count} idéer nu. Returnera bara JSON.`,
      temperature: 0.95,
      maxOutputTokens: 4000,
    });

    const inserts = (result.ideas ?? []).map((i) => ({
      client_id: clientId,
      status: "idea" as const,
      pillar: i.pillar,
      format: i.format,
      trust_gate: i.trust_gate,
      hook: i.hook,
      idea_seed: i.angle,
      notes: i.why_it_works,
    }));

    let saved: unknown[] = [];
    if (inserts.length) {
      const { data } = await sb.from("linkedin_posts").insert(inserts).select();
      saved = data ?? [];
    }

    await logActivity(clientId, "linkedin_ideas", `Genererade ${saved.length} LinkedIn-idéer`, "/dashboard/linkedin");
    return NextResponse.json({ ideas: saved });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
