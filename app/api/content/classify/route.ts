import { NextRequest, NextResponse } from "next/server";
import { getActiveClientId } from "@/lib/client-context";
import { supabaseService } from "@/lib/supabase-admin";
import { requireAdminOrCustomer } from "@/lib/api-auth";
import { generateJSON } from "@/lib/gemini";
import { getProfileAsMarkdown } from "@/lib/knowledge";
import { DISC_GUIDE, FOURA_GUIDE, FUNNEL_GUIDE } from "@/lib/content-framework";

export const runtime = "nodejs";

// CC-3 auto-klassning: fritt skrivet inlägg → funnel/4A/DISC + confidence.
// Sätter compass_source='auto'. Användaren kan rätta (blir då 'manual' via posts-routen).
// Källa → tabell för valfri persist.
const SOURCE_TABLE: Record<string, string> = {
  studio: "studio_posts",
  social: "hm_social_posts",
  linkedin: "linkedin_posts",
  blog: "hm_blog",
};

const FUNNELS = ["tofu", "mofu", "bofu"];
const FOURAS = ["analytical", "aspirational", "actionable", "authentic"];
const DISCS = ["D", "I", "S", "C"];

// POST /api/content/classify — { text, id?, source? }
export async function POST(req: NextRequest) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;

  try {
    const clientId = await getActiveClientId();
    const body = await req.json().catch(() => ({}));
    const text = String(body.text || "").trim();
    if (text.length < 20) return NextResponse.json({ error: "För kort text att klassa (minst 20 tecken)" }, { status: 400 });

    const profileMd = await getProfileAsMarkdown().catch(() => "");

    const system = `Du klassar ett socialt inlägg på tre axlar enligt Content Compass. Svara ENDAST med JSON.

FUNNEL (var i tratten):
${Object.entries(FUNNEL_GUIDE).map(([k, v]) => `- ${k.toLowerCase()}: ${v}`).join("\n")}

4A (berättarform):
${Object.entries(FOURA_GUIDE).map(([k, v]) => `- ${k}: ${v}`).join("\n")}

DISC (ton, kan vara flera):
${Object.entries(DISC_GUIDE).map(([k, v]) => `- ${k}: ${v}`).join("\n")}
${profileMd ? `\nKUNDKONTEXT:\n${profileMd}` : ""}

Bedöm hur säker du är (confidence 0.0 till 1.0). Returnera:
{ "funnel": "tofu|mofu|bofu", "four_a": "analytical|aspirational|actionable|authentic", "disc": ["D"], "confidence": 0.0, "motivering": "kort svensk mening" }`;

    const parsed = await generateJSON<{ funnel?: string; four_a?: string; disc?: unknown; confidence?: number; motivering?: string }>({
      model: "gemini-2.5-flash",
      systemInstruction: system,
      prompt: `Inlägg att klassa:\n\n${text.slice(0, 4000)}`,
      temperature: 0.2,
      maxOutputTokens: 500,
    });

    const funnel = FUNNELS.includes(String(parsed.funnel)) ? String(parsed.funnel) : null;
    const four_a = FOURAS.includes(String(parsed.four_a)) ? String(parsed.four_a) : null;
    const disc = Array.isArray(parsed.disc) ? (parsed.disc as unknown[]).map(String).filter((d) => DISCS.includes(d)) : [];
    const confidence = typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : null;
    const result = { funnel, four_a, disc, confidence, motivering: String(parsed.motivering || "") };

    // Valfri persist på en befintlig rad (tenant-lås via client_id).
    let saved = false;
    const table = body.source ? SOURCE_TABLE[String(body.source)] : null;
    if (body.id && table && (funnel || four_a)) {
      const sb = supabaseService();
      const { error } = await sb
        .from(table)
        .update({ funnel_level: funnel, four_a, disc: disc.length ? disc : null, compass_source: "auto", compass_confidence: confidence })
        .eq("id", body.id)
        .eq("client_id", clientId);
      if (!error) saved = true;
    }

    return NextResponse.json({ ...result, saved });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
