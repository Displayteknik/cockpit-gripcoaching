import { NextRequest, NextResponse } from "next/server";
import { generate, type GeminiMessage } from "@/lib/gemini";
import { getKnowledge } from "@/lib/knowledge";
import { supabaseServer } from "@/lib/supabase-admin";
import { getActiveClient, getActiveClientId } from "@/lib/client-context";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ChatBody {
  messages: { role: "user" | "assistant"; content: string }[];
  lead?: { name?: string; phone?: string; email?: string; interest?: string };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ChatBody;
    const sb = supabaseServer();
    const clientId = await getActiveClientId();
    const client = await getActiveClient();
    const isAutomotive = client?.resource_module === "automotive";
    const isArt = client?.resource_module === "art";

    let inventoryBlock = "";
    if (isAutomotive) {
      const { data: vehicles } = await sb
        .from("hm_vehicles")
        .select("slug, title, brand, category, price, price_label, is_featured")
        .eq("client_id", clientId)
        .eq("is_sold", false)
        .order("is_featured", { ascending: false })
        .limit(30);
      const lager = (vehicles || []).map((v) =>
        `- ${v.category}: ${v.title} (${v.brand || "-"}) ${v.price ? v.price + " kr" : v.price_label || "pris på begäran"} — /fordon/${v.slug}`
      ).join("\n");
      inventoryBlock = `## NUVARANDE LAGER (${vehicles?.length || 0} st)\n${lager}\n\nNär du rekommenderar ett fordon: ge slug-länken "/fordon/[slug]" så kunden kan klicka direkt.`;
    } else if (isArt) {
      const { data: works } = await sb
        .from("art_works")
        .select("slug, title, technique, year, price, price_label, status")
        .eq("client_id", clientId)
        .neq("status", "archived")
        .limit(30);
      const lager = (works || []).map((w) =>
        `- ${w.title} (${w.technique || "okänd teknik"}${w.year ? `, ${w.year}` : ""}) ${w.price ? w.price + " kr" : w.price_label || "pris på begäran"} — /verk/${w.slug} [${w.status}]`
      ).join("\n");
      inventoryBlock = `## VERK I PORTFOLIO (${works?.length || 0} st)\n${lager}\n\nNär du rekommenderar ett verk: ge slug-länken "/verk/[slug]" så kunden kan klicka direkt.`;
    }

    const knowledge = await getKnowledge("company", "coach-instructions");

    const system = `${knowledge}

${inventoryBlock}`;

    const contents: GeminiMessage[] = body.messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const reply = await generate({
      model: "gemini-2.5-pro",
      systemInstruction: system,
      messages: contents,
      temperature: 0.7,
      maxOutputTokens: 1000,
    });

    // Lead-detektion + AI-scoring
    const lastUser = [...body.messages].reverse().find((m) => m.role === "user")?.content || "";
    const phoneMatch = lastUser.match(/0[\d\s-]{7,}/);
    if (phoneMatch || body.lead?.phone) {
      // Gemini scorer leadet 1–10 baserat på konversationen
      let score: number | null = null;
      let score_reasoning: string | null = null;
      try {
        const { generateJSON } = await import("@/lib/gemini");
        const conversationText = body.messages.map((m) => `${m.role === "user" ? "Kund" : "Coach"}: ${m.content}`).join("\n");
        const result = await generateJSON<{ score: number; reasoning: string }>({
          model: "gemini-2.5-flash",
          systemInstruction: `Du bedömer hur köp-redo en lead är från en konversation. Skala 1–10:
1–3 = bara nyfiken, ingen avsikt
4–6 = intresserad men osäker, behöver tid
7–8 = seriöst köpläge, bör ringas inom 24h
9–10 = HET — vill köpa nu, ring direkt

Returnera JSON: { "score": 1-10, "reasoning": "1–2 meningar varför" }`,
          prompt: `Konversation:\n${conversationText}\n\nBedöm leadet.`,
          temperature: 0.3,
          maxOutputTokens: 500,
        });
        score = result.score;
        score_reasoning = result.reasoning;
      } catch { /* tyst */ }

      const { data: leadRow } = await sb.from("hm_leads").insert({
        client_id: clientId,
        name: body.lead?.name,
        phone: body.lead?.phone || phoneMatch?.[0],
        email: body.lead?.email,
        interest: body.lead?.interest || lastUser.slice(0, 200),
        source: "coach",
        conversation: body.messages,
        score,
        score_reasoning,
      }).select().single();

      const { logActivity } = await import("@/lib/client-context");
      await logActivity(clientId, "lead_captured", `Nytt lead${score ? ` (score ${score}/10)` : ""}: ${body.lead?.phone || phoneMatch?.[0]}`, "/dashboard/fordon", { lead_id: leadRow?.id, score });
    }

    return NextResponse.json({ reply });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
