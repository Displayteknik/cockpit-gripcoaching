import { NextRequest, NextResponse } from "next/server";
import { getActiveClientId } from "@/lib/client-context";
import { supabaseService } from "@/lib/supabase-admin";
import { generate } from "@/lib/gemini";

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

    const sb = supabaseService();
    const { data: profile } = await sb
      .from("hm_brand_profile")
      .select("company_name, location, hashtags_base, icp_primary, services")
      .eq("client_id", clientId)
      .maybeSingle();

    const system = `Du är en hashtag-specialist för svenska Instagram-konton. Du skapar STRATEGISKA hashtag-kluster, inte slumpvisa listor.

KUND: ${profile?.company_name || "(saknas)"}
PLATS: ${profile?.location || "(saknas)"}
TJÄNSTER: ${profile?.services || "(saknas)"}
MÅLGRUPP: ${profile?.icp_primary || "(saknas)"}
BEFINTLIGA HASHTAGS: ${profile?.hashtags_base || "(inga)"}

REGLER:
- Branded (1-2): kundens egna märkesnamn
- Lokala (2-3): plats + region — lätta att hitta lokal publik
- Nischade (3-5): specifik tjänst/situation — låg konkurrens, hög relevans
- Breda (2-3): större paraply-taggar — når ut bredare
- ALLA på svenska om målgrupp är svensk
- Inga "dussinhashtags" som #love #instagood
- Inga hashtags längre än 25 tecken
- Inga mellanslag

OUTPUT JSON:
{
  "branded": ["..."],
  "local": ["..."],
  "niche": ["..."],
  "broad": ["..."],
  "all_combined": ["..."],
  "strategy_note": "1-2 meningar om varför dessa kluster passar"
}`;

    const prompt = `Ämne för inlägget: ${topic}
${body.hook ? `Hook: ${body.hook}` : ""}

Skapa hashtag-strategi. Returnera enbart JSON.`;

    const raw = await generate({
      model: "gemini-2.5-flash",
      systemInstruction: system,
      prompt,
      temperature: 0.7,
      maxOutputTokens: 1500,
      jsonMode: true,
    });

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
