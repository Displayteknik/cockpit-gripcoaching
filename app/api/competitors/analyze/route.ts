import { NextRequest, NextResponse } from "next/server";
import { generateJSON } from "@/lib/gemini";
import { getKnowledge } from "@/lib/knowledge";
import { auditUrl, pageSpeed } from "@/lib/seo-audit";
import { supabaseServer } from "@/lib/supabase-admin";
import { getActiveClientId } from "@/lib/client-context";

export const runtime = "nodejs";
export const maxDuration = 180;

interface CompetitorIntel {
  positioning: string;
  hooks_used: string[];
  unique_angles: string[];
  weaknesses: string[];
  copy_patterns: string[];
  gaps_to_exploit: string[];
  steal_list: { idea: string; how_to_apply: string; priority: number }[];
}

export async function POST(req: NextRequest) {
  const clientId = await getActiveClientId();
  const body = await req.json();
  const { competitor_id, url } = body;
  if (!url) return NextResponse.json({ error: "url krävs" }, { status: 400 });

  const sb = supabaseServer();

  // 1. Hämta konkurrentens HTML-innehåll
  let html = "";
  try {
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 HM-Cockpit-Intel/1.0" }, signal: AbortSignal.timeout(20000) });
    html = await r.text();
  } catch (e) {
    return NextResponse.json({ error: "Kunde inte hämta sidan: " + (e as Error).message }, { status: 500 });
  }

  const text = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 12000);

  // 2. Strukturell SEO-audit + PageSpeed
  const [audit, ps] = await Promise.all([auditUrl(url, url), pageSpeed(url)]);

  // 3. Gemini-analys: vad gör de bra, var är luckor, vad kan vi stjäla
  const knowledge = await getKnowledge("conversion", "viral-hooks");
  const system = `Du är en konkurrent-spaning-analytiker. Använd brand-profilen + konverteringsreglerna för att granska konkurrenten.

${knowledge}

UPPGIFT: Granska konkurrentens text och plocka ut:
- Hur de positionerar sig
- Vilka hooks/öppningar de använder
- Unika vinklar de äger
- Svagheter där VI kan vinna
- Copy-mönster (struktur, ton, längd)
- Innehållsluckor de inte täcker (vår möjlighet)
- "Steal-list" — konkreta idéer vi kan ta och göra bättre, anpassade till vårt brand

RETURNERA JSON:
{
  "positioning": "1–2 meningar om hur de framställer sig",
  "hooks_used": ["hook 1", "hook 2", ...],
  "unique_angles": ["vinkel 1", ...],
  "weaknesses": ["svaghet 1", ...],
  "copy_patterns": ["mönster 1", ...],
  "gaps_to_exploit": ["lucka 1", ...],
  "steal_list": [
    { "idea": "konkret idé", "how_to_apply": "så gör vi den bättre i vårt brand", "priority": 1-10 }
  ]
}

Var konkret. Inte luddigt.`;

  const intel = await generateJSON<CompetitorIntel>({
    model: "gemini-2.5-pro",
    systemInstruction: system,
    prompt: `Konkurrentens URL: ${url}\n\nKonkurrentens text:\n${text}`,
    temperature: 0.6,
    maxOutputTokens: 4000,
  });

  const audit_data = { ...audit, pagespeed_mobile: ps.mobile, pagespeed_desktop: ps.desktop };

  if (competitor_id) {
    await sb.from("competitors").update({ audit_data, intel, last_audited: new Date().toISOString() }).eq("id", competitor_id).eq("client_id", clientId);
  }

  return NextResponse.json({ audit: audit_data, intel });
}
