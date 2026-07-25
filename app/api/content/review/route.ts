import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrCustomer } from "@/lib/api-auth";
import { generateJSON } from "@/lib/gemini";
import { POST_ANATOMY, FUNNEL_CTA } from "@/lib/content-compass/prompt";
import type { FunnelLevel } from "@/lib/content-compass/data";

export const runtime = "nodejs";

// CC-3 granskning mot inläggsanatomin: hook? känsla? kund-nytta (inte tjänsten)?
// exakt EN CTA? matchar CTA:n funnel-nivån? Returnerar konkreta brister i klarspråk.
const FUNNELS = ["tofu", "mofu", "bofu"];

// POST /api/content/review — { text, funnel? }
export async function POST(req: NextRequest) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;

  try {
    const body = await req.json().catch(() => ({}));
    const text = String(body.text || "").trim();
    if (text.length < 20) return NextResponse.json({ error: "För kort text att granska (minst 20 tecken)" }, { status: 400 });
    const funnel = FUNNELS.includes(String(body.funnel)) ? (String(body.funnel) as FunnelLevel) : null;

    const system = `Du granskar ett socialt inlägg mot en fast anatomi. Var sträng men konstruktiv. Svara ENDAST med JSON, på svenska, utan tankstreck.

ANATOMIN varje inlägg ska följa:
1. ${POST_ANATOMY.hook}
2. ${POST_ANATOMY.story}
3. ${POST_ANATOMY.nytta}
4. ${POST_ANATOMY.cta}
${funnel ? `\nInläggets funnel-nivå är ${funnel.toUpperCase()}. CTA:n ska vara: ${FUNNEL_CTA[funnel]}.` : ""}

Bedöm varje punkt (true/false) och skriv konkreta brister:
{
  "har_hook": true,
  "har_kansla": true,
  "nytta_ar_kundens_resultat": true,
  "antal_cta": 1,
  "cta_matchar_funnel": true,
  "brister": ["kort konkret mening per brist"],
  "sammanfattning": "en mening"
}
Om antal_cta inte är exakt 1, lägg det som en brist. Om nyttan handlar om ER tjänst istället för kundens resultat, lägg det som en brist.`;

    const parsed = await generateJSON<{
      har_hook?: boolean; har_kansla?: boolean; nytta_ar_kundens_resultat?: boolean;
      antal_cta?: number; cta_matchar_funnel?: boolean; brister?: unknown; sammanfattning?: string;
    }>({
      model: "gemini-2.5-flash",
      systemInstruction: system,
      prompt: `Inlägg att granska:\n\n${text.slice(0, 4000)}`,
      temperature: 0.2,
      maxOutputTokens: 700,
    });

    const brister = Array.isArray(parsed.brister) ? (parsed.brister as unknown[]).map(String).filter(Boolean) : [];
    const checks = {
      har_hook: !!parsed.har_hook,
      har_kansla: !!parsed.har_kansla,
      nytta_ar_kundens_resultat: !!parsed.nytta_ar_kundens_resultat,
      antal_cta: typeof parsed.antal_cta === "number" ? parsed.antal_cta : null,
      cta_matchar_funnel: funnel ? !!parsed.cta_matchar_funnel : null,
    };
    const passed = checks.har_hook && checks.har_kansla && checks.nytta_ar_kundens_resultat && checks.antal_cta === 1 && (funnel ? checks.cta_matchar_funnel === true : true);

    return NextResponse.json({ passed, checks, brister, sammanfattning: String(parsed.sammanfattning || "") });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
