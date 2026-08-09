import { NextRequest, NextResponse } from "next/server";
import { getActiveClientId } from "@/lib/client-context";
import { generateWithUsage } from "@/lib/gemini";
import { byggTextPrompt } from "@/lib/prompt-core";

export const runtime = "nodejs";
export const maxDuration = 30;

// POST /api/generate/hashtags
// { topic, hook?, count? }
// Returnerar klustrade hashtags: branded, lokala, nischade, breda
export async function POST(req: NextRequest) {
  try {
    const clientId = await getActiveClientId();
    const body = await req.json();
    const topic = String(body.topic || "").trim();
    if (!topic) return NextResponse.json({ error: "topic krävs" }, { status: 400 });

    // G-2: flödet byggde sin EGEN prompt och hämtade profilen själv (G0/STATUS:
    // "generate/hashtags/route.ts:59 bygger egen prompt"). Det gjorde att röstprofil,
    // klientens förbjudna ord och sanningskravet aldrig nådde hashtaggarna — och en
    // hashtag är kundsynlig text som vilken annan. Nu går den genom kärnan som resten.
    const uppdrag = `Du är hashtag-specialist för svenska Instagram-konton. Du skapar STRATEGISKA hashtag-kluster, inte slumpvisa listor.

REGLER:
- Branded (1-2): kundens egna märkesnamn
- Lokala (2-3): plats + region — lätta att hitta lokal publik
- Nischade (3-5): specifik tjänst/situation — låg konkurrens, hög relevans
- Breda (2-3): större paraply-taggar — når ut bredare
- ALLA på svenska om målgrupp är svensk
- Inga "dussinhashtags" som #love #instagood
- Inga hashtags längre än 25 tecken
- Inga mellanslag
- Bygg på varumärkesprofilens plats, tjänster och befintliga hashtags ovan. Hitta aldrig på en ort eller en tjänst som inte står där.`;

    // ⚠ G-3d: INGEN rotation här, med flit. Hashtags ska vara KONSEKVENTA över tid —
    // det är så en lokal tagg byggs upp och blir sökbar. En undvik-lista hade tvingat
    // fram nya taggar varje gång och motverkat hela poängen med ett hashtag-kluster.
    const bygg = await byggTextPrompt({
      clientId,
      syfte: "social",
      kanal: "instagram",
      uppdrag,
      underlag: `Ämne för inlägget: ${topic}
${body.hook ? `Hook: ${body.hook}` : ""}

Skapa hashtag-strategi. Returnera enbart JSON.`,
      anvandarText: topic,
      jsonSchema: `{
  "branded": ["..."],
  "local": ["..."],
  "niche": ["..."],
  "broad": ["..."],
  "all_combined": ["..."],
  "strategy_note": "1-2 meningar om varför dessa kluster passar"
}`,
    });

    const svar = await generateWithUsage({
      model: "gemini-2.5-flash",
      systemInstruction: bygg.system,
      prompt: bygg.user,
      temperature: 0.7,
      maxOutputTokens: 1500,
      jsonMode: true,
      skrivregler: false, // prompt-core äger skrivregler-flaggan (TEXT-1)
      generering: {
        syfte: "social",
        promptVersion: bygg.meta.promptVersion,
        funnel: bygg.meta.funnel,
        lager: bygg.meta.lager,
      },
    });
    const raw = svar.text;

    let parsed: {
      branded?: string[];
      local?: string[];
      niche?: string[];
      broad?: string[];
      all_combined?: string[];
      strategy_note?: string;
    } = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    }

    const clean = (arr: string[] | undefined) =>
      (arr || [])
        .map((h) => String(h).replace(/^#+/, "").replace(/\s+/g, "").slice(0, 25))
        .filter((h) => h.length > 1);

    return NextResponse.json({
      branded: clean(parsed.branded),
      local: clean(parsed.local),
      niche: clean(parsed.niche),
      broad: clean(parsed.broad),
      all_combined: parsed.all_combined?.length
        ? clean(parsed.all_combined)
        : [...clean(parsed.branded), ...clean(parsed.local), ...clean(parsed.niche), ...clean(parsed.broad)],
      strategy_note: parsed.strategy_note || "",
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
