import { NextRequest, NextResponse } from "next/server";
import { generateJSON } from "@/lib/gemini";
import { getKnowledge } from "@/lib/knowledge";
import { supabaseServer } from "@/lib/supabase-admin";
import { getActiveClient, getActiveClientId, logActivity } from "@/lib/client-context";

export const runtime = "nodejs";
export const maxDuration = 60;

interface DraftBody {
  post_id?: string;
  hook?: string;
  angle?: string;
  pillar?: string;
  format?: "text" | "carousel" | "video" | "poll" | "document";
  trust_gate?: string;
  length?: "short" | "medium" | "long";
}

interface DraftResult {
  hook: string;
  body: string;
  hashtags: string;
  cta: string;
  word_count: number;
  notes: string;
  slides?: { number: number; headline: string; body: string }[];
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as DraftBody;
    const clientId = await getActiveClientId();
    const client = await getActiveClient();
    const sb = supabaseServer();

    let seed: DraftBody = body;
    if (body.post_id) {
      const { data: post } = await sb
        .from("linkedin_posts")
        .select("*")
        .eq("id", body.post_id)
        .eq("client_id", clientId)
        .single();
      if (post) {
        seed = {
          ...body,
          hook: post.hook ?? body.hook,
          angle: post.idea_seed ?? body.angle,
          pillar: post.pillar ?? body.pillar,
          format: post.format ?? body.format,
          trust_gate: post.trust_gate ?? body.trust_gate,
        };
      }
    }

    const length = body.length ?? "medium";
    const lengthGuide =
      length === "short"
        ? "100-150 ord. Korta meningar. En tydlig poäng. Hook + 2-3 stycken + soft CTA."
        : length === "long"
        ? "350-500 ord. Story-inlägg eller fördjupning. Hook + scen + insikt + 4-5 punkter + sammanfattning + soft CTA."
        : "200-300 ord. Hook + igenkänning + insikt + 3-4 punkter + soft CTA.";

    const knowledge = await getKnowledge("linkedin-foundation", "linkedin-formats", "linkedin-advanced");
    const isCarousel = (seed.format ?? "text") === "carousel";

    const slideSchema = isCarousel
      ? `,
  "slides": [
    { "number": 1, "headline": "Hook (max 7 ord)", "body": "Kort body" },
    { "number": 2, "headline": "...", "body": "..." }
  ]`
      : "";

    const carouselGuide = isCarousel
      ? "\n\nDETTA ÄR EN KARUSELL: 6-9 slides. Slide 1 = hook + 'Swipe →'. Slide 2 = problemramning. Slides 3-7 = en princip per slide (5-7 ord rubrik, 1-2 meningar body). Sista slide = soft CTA. Body-fältet ovan ska sammanfatta hela karusellens budskap i 80-120 ord (det som postas ovanför karusellen)."
      : "";

    const system = `Du är ${client?.name || "klientens"} egna LinkedIn-skribent.

Du följer Hakan Grips kursmetodik "Från Okänd till Kund" och dessa hårda regler:

${knowledge}

INSTRUKTION FÖR DETTA INLÄGG:
- Längd: ${lengthGuide}
- Pelare: ${seed.pillar ?? "(välj fritt utifrån brand-profil)"}
- Trust-port: ${seed.trust_gate ?? "know"}
- Format: ${seed.format ?? "text"}${carouselGuide}

KRITISKT:
- Skriv på svenska. Korrekta å/ä/ö ALLTID.
- Aldrig: "kraftfull", "banbrytande", "game-changer", "handlar om", "nästa nivå", "holistisk", "skalbar".
- Inga säljiga CTA. Använd soft CTA (fråga, inbjudan).
- Max 3-4 hashtags, alla relevanta.
- Hook MÅSTE klara Triple S-testet.
- Skriv direkt — inte "i detta inlägg" eller "vi kommer att".
- Använd radbrytningar generöst — varje 1-2 meningar = ny rad.

RETURNERA JSON:
{
  "hook": "Den första raden — det som stoppar scrollen",
  "body": "HELA inlägget som det ska klistras in på LinkedIn (inkl hook). Behåll radbrytningar.",
  "hashtags": "#tag1 #tag2 #tag3",
  "cta": "Vilken CTA-typ användes (soft/engagement/lead/direct)",
  "word_count": 234,
  "notes": "1 mening om vinkel/intention för Hakans referens"${slideSchema}
}`;

    const userPrompt = `${seed.hook ? `Hook-utgångspunkt: ${seed.hook}` : ""}
${seed.angle ? `Vinkel: ${seed.angle}` : ""}

Skriv inlägget nu. Returnera bara JSON.`;

    const draft = await generateJSON<DraftResult>({
      model: "gemini-2.5-pro",
      systemInstruction: system,
      prompt: userPrompt,
      temperature: 0.92,
      maxOutputTokens: isCarousel ? 4000 : 2500,
    });

    const updatePayload: Record<string, unknown> = {
      hook: draft.hook,
      body: draft.body,
      hashtags: draft.hashtags,
      cta: draft.cta,
      length,
      status: "draft",
      notes: draft.notes,
      updated_at: new Date().toISOString(),
    };

    let saved: unknown = null;
    if (body.post_id) {
      const { data } = await sb
        .from("linkedin_posts")
        .update(updatePayload)
        .eq("id", body.post_id)
        .eq("client_id", clientId)
        .select()
        .single();
      saved = data;
    } else {
      const { data } = await sb
        .from("linkedin_posts")
        .insert({
          client_id: clientId,
          status: "draft",
          pillar: seed.pillar ?? null,
          format: seed.format ?? "text",
          trust_gate: seed.trust_gate ?? null,
          hook: draft.hook,
          body: draft.body,
          hashtags: draft.hashtags,
          cta: draft.cta,
          length,
          idea_seed: seed.angle ?? null,
          notes: draft.notes,
        })
        .select()
        .single();
      saved = data;
    }

    await logActivity(clientId, "linkedin_draft", `Skrev LinkedIn-inlägg (${length}): ${draft.hook?.slice(0, 60)}`, "/dashboard/linkedin");
    return NextResponse.json({ post: saved, draft });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
