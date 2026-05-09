import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { TOOLS } from "@/lib/setup-tools";

export const runtime = "nodejs";
export const maxDuration = 120;

const MODEL = "claude-sonnet-4-5";

const SYSTEM_PROMPT = `Du ar Cockpits Setup-agent. Du hjalper Hakan Grip att konfigurera och underhalla sin multi-tenant Cockpit-plattform.

# Vad du vet om plattformen

**Cockpit** ar en Next.js 16-app pa Vercel (cockpit.gripcoaching.se) for Hakan att hantera AI-genererat innehall at sina klienter.

**Klienter idag:** Darek Uhrberg, Displayteknik, GripCoaching, HM Motor Krokom, Ledarskapskultur (Zetterman), Opticur.

**Karnan:**
- **Brand-profil** (hm_brand_profile) = klientens ton, dos, donts, kundrost
- **client_assets** = inlagg, transkriptioner, testimonials, winning examples
- **Voice-fingerprint** (client_voice_profile) = automatiskt byggd sprakprofil per klient (24h cache, kraver 5+ assets)
- **Winning examples** = client_assets med category='winning_example' + subcategory ('linkedin', 'email', 'saljbrev'). Hojer voice-score genom jaccard-similarity i iterations-loopen.

**Iterations-loopen** (lib/iterate.ts):
- Specialister med iterate:true genererar 3 varianter parallellt
- Scorar mot voice-fingerprint + winning examples + AI-floskel-detektor
- Returnerar basta variant
- Loggar i agent_experiments-tabellen

**Natt-loopen** (/api/agents/night-iterate, cron 02:30):
- Genererar 5 LinkedIn + 5 mejl per klient med 5+ voice-assets
- Sparar topp 3 till ideas_bank
- Hakan godkanner i /dashboard/agents

**Specialister** (16 st):
- /dashboard/specialister/<id>
- 5 SEO/AEO/GEO + 6 mejl + 5 ovriga
- iterate:true: geo-aeo-optimizer, newsletter-sekvens

**Tabeller du bryr dig om:**
- clients, hm_brand_profile, client_voice_profile, client_assets
- specialist_runs, agent_experiments, ideas_bank
- hm_visits (trafik-pixel), hm_seo_audits, hm_seo_keywords

# Onboarding-checklista (de 5 hinkarna)
For att en klient ska "leva" i systemet:
1. **Brand-profil** ifylld (tone_rules, dos, donts)
2. **Voice-fingerprint** byggd (>= 5 client_assets)
3. **Winning examples** markerade (3-5 per kanal)
4. **Trafik-pixel** installerad pa klientens sajt
5. **Pelare + ideer** fyllda (LinkedIn-motorn)

# Hur du svarar
- **Svenska, kort och konkret.** Inga AI-floskler.
- **Anvand tools** for att hamta data och utfora actions. Gissa aldrig.
- **Foreslag actions** istallet for att bara forklara.
- **Ge Hakan val** nar det finns flera vagar.
- **Visa siffror** nar du har dem (count assets, score, etc.).
- **Kopplas trafik-pixel** = generera snippet, sag "klistra in i <head>", inte mer.

# Nar du inte vet client_id
Anvand list_clients-tool forst.

# Forbjudet
- Generella AI-rad ("se till att", "kom ihag att")
- Lange forklaringar utan handling
- Att kalla det "kraftfullt", "enkelt", "smidigt"`;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY saknas" }), { status: 500 });

  const body = await req.json();
  const messages: ChatMessage[] = body.messages ?? [];
  if (messages.length === 0) return new Response(JSON.stringify({ error: "messages krävs" }), { status: 400 });

  const anthropic = new Anthropic({ apiKey });

  // Bygg tools-array enligt Anthropic SDK
  const anthropicTools = TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema as { type: "object"; properties: Record<string, unknown>; required?: string[] },
  }));

  // Streaming via SSE
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const conversationMessages: Anthropic.MessageParam[] = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        let iterations = 0;
        const MAX_ITERATIONS = 6;

        while (iterations < MAX_ITERATIONS) {
          iterations++;

          const response = await anthropic.messages.create({
            model: MODEL,
            max_tokens: 4096,
            system: SYSTEM_PROMPT,
            tools: anthropicTools,
            messages: conversationMessages,
          });

          // Streama text-delar
          for (const block of response.content) {
            if (block.type === "text" && block.text) {
              send("text", { text: block.text });
            }
          }

          // Om inga tool-calls -> klart
          const toolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
          if (toolUses.length === 0 || response.stop_reason !== "tool_use") {
            send("done", { stop_reason: response.stop_reason });
            controller.close();
            return;
          }

          // Lagg till assistant-meddelandet
          conversationMessages.push({ role: "assistant", content: response.content });

          // Kor varje tool, samla resultat
          const toolResults: Anthropic.ToolResultBlockParam[] = [];
          for (const tu of toolUses) {
            send("tool_use", { name: tu.name, input: tu.input });
            const tool = TOOLS.find((t) => t.name === tu.name);
            if (!tool) {
              toolResults.push({
                type: "tool_result",
                tool_use_id: tu.id,
                content: JSON.stringify({ ok: false, summary: `Okant tool: ${tu.name}` }),
              });
              continue;
            }
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const result = await (tool.handler as (i: any) => Promise<unknown>)(tu.input ?? {});
              send("tool_result", { name: tu.name, result });
              toolResults.push({
                type: "tool_result",
                tool_use_id: tu.id,
                content: JSON.stringify(result),
              });
            } catch (e) {
              const err = (e as Error).message;
              send("tool_result", { name: tu.name, result: { ok: false, summary: err } });
              toolResults.push({
                type: "tool_result",
                tool_use_id: tu.id,
                content: JSON.stringify({ ok: false, summary: err }),
              });
            }
          }

          // Lagg till user-meddelande med tool-resultat
          conversationMessages.push({ role: "user", content: toolResults });
        }

        send("done", { stop_reason: "max_iterations" });
        controller.close();
      } catch (e) {
        send("error", { message: (e as Error).message });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
