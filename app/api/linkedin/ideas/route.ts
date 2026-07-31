import { NextRequest, NextResponse } from "next/server";
import { generateJSON } from "@/lib/gemini";
import { byggTextPrompt, saneraText, VARIANTREGEL } from "@/lib/prompt-core";
import { supabaseService } from "@/lib/supabase-admin";
import { getActiveClient, getActiveClientId, logActivity } from "@/lib/client-context";
import { requireAdminOrCustomer } from "@/lib/api-auth";

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
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;
  try {
    const body = (await req.json()) as { count?: number; pillar?: string; mode?: string };
    const count = Math.min(Math.max(body.count ?? 10, 1), 20);
    const clientId = await getActiveClientId();
    const client = await getActiveClient();
    const sb = supabaseService();

    const { data: pillarsData } = await sb
      .from("linkedin_pillars")
      .select("name, description")
      .eq("client_id", clientId)
      .eq("archived", false)
      .order("sort_order", { ascending: true });
    const pillars = (pillarsData ?? []).map((p) => `- ${p.name}${p.description ? `: ${p.description}` : ""}`).join("\n");

    // T-6c (rotation): historiken skickas via kärnans nyligen-param och renderas som
    // "NYLIGEN ANVÄNT — undvik dessa ingångar/öppningar" (förr ett eget block i uppdraget).
    const { data: recentPosts } = await sb
      .from("linkedin_posts")
      .select("hook, pillar")
      .eq("client_id", clientId)
      .in("status", ["posted", "approved", "draft"])
      .order("created_at", { ascending: false })
      .limit(20);
    const recentHooks = (recentPosts ?? [])
      .filter((p) => p.hook)
      .map((p) => `(${p.pillar ?? "—"}) ${p.hook}`);

    const pillarFilter = body.pillar
      ? `\n\nFOKUSPELARE: Generera ALLA idéer kring pelaren "${body.pillar}".`
      : `\n\nFÖRDELA idéerna mellan pelarna ovan så jämnt som möjligt.`;

    // TEXT-1 T-2: prompten byggs av prompt-core (kunskap, brand-profil, röst, winning,
    // anatomi/compass och skrivregler ägs av kärnan). Uppdraget = pelare/trust-gate-logiken.
    const uppdrag = `Du är ${client?.name || "klientens"} egna LinkedIn-strateg.

Du följer Hakan Grips kursmetodik "Från Okänd till Kund" och de hårda principerna nedan.

KLIENTENS PELARE (content-teman):
${pillars || "(inga definierade — använd brand-profilens pain points som proxy)"}

UPPGIFT: Generera ${count} skarpa idéer för LinkedIn-inlägg som låter EXAKT som denna klient. Varje idé ska:
- Ha en hook som följer Triple S (Stop, Specify, Sell the read)
- Vara konkret nog att kunna skrivas direkt utan extra research
- Variera mellan format (text dominerar, men minst 1-2 karuseller och 1 poll)
- Variera mellan trust-portar (mestadels know/like/trust för fritt content; max 20% try/buy)
- Aldrig återanvända en hook eller öppning ur "NYLIGEN ANVÄNT" nedan${pillarFilter}

${VARIANTREGEL}`;

    const jsonSchema = `{
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

    const b = await byggTextPrompt({
      clientId,
      syfte: "linkedin",
      kanal: "linkedin",
      uppdrag,
      underlag: `Generera ${count} idéer nu. Returnera bara JSON.`,
      knowledge: ["linkedin-foundation", "linkedin-formats", "linkedin-advanced"],
      nyligen: recentHooks,
      jsonSchema,
    });

    const result = await generateJSON<GenResponse>({
      model: "gemini-2.5-pro",
      systemInstruction: b.system,
      prompt: b.user,
      temperature: 0.95,
      maxOutputTokens: 4000,
      skrivregler: false, // prompt-core äger skrivregler-flaggan (TEXT-1)
    });

    // TEXT-1: enhetlig sanering — flödet saknade sanering helt före migreringen.
    for (const i of result.ideas ?? []) {
      [i.hook, i.angle] = await Promise.all([
        saneraText(i.hook, clientId, "linkedin"),
        saneraText(i.angle, clientId, "linkedin"),
      ]);
    }

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
