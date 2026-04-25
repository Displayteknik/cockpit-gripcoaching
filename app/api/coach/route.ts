import { NextRequest, NextResponse } from "next/server";
import { generate, type GeminiMessage } from "@/lib/gemini";
import { getKnowledge } from "@/lib/knowledge";
import { supabaseServer } from "@/lib/supabase-admin";

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

    const { data: vehicles } = await sb
      .from("hm_vehicles")
      .select("slug, title, brand, category, price, price_label, is_featured")
      .eq("is_sold", false)
      .order("is_featured", { ascending: false })
      .limit(30);

    const lager = (vehicles || [])
      .map(
        (v) =>
          `- ${v.category}: ${v.title} (${v.brand || "-"}) ${
            v.price ? v.price + " kr" : v.price_label || "pris på begäran"
          } — /fordon/${v.slug}`
      )
      .join("\n");

    const knowledge = await getKnowledge("company", "coach-instructions");

    const system = `${knowledge}

## NUVARANDE LAGER (${vehicles?.length || 0} st)
${lager}

När du rekommenderar ett fordon: ge slug-länken "/fordon/[slug]" så kunden kan klicka direkt.`;

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

    // Enkel lead-detektion: om senaste user-meddelande innehåller telefonnummer → spara
    const lastUser = [...body.messages].reverse().find((m) => m.role === "user")?.content || "";
    const phoneMatch = lastUser.match(/0[\d\s-]{7,}/);
    if (phoneMatch || body.lead?.phone) {
      await sb.from("hm_leads").insert({
        name: body.lead?.name,
        phone: body.lead?.phone || phoneMatch?.[0],
        email: body.lead?.email,
        interest: body.lead?.interest || lastUser.slice(0, 200),
        source: "coach",
        conversation: body.messages,
      });
    }

    return NextResponse.json({ reply });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
