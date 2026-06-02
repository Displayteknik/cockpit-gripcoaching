import { NextRequest, NextResponse } from "next/server";
import { generateJSON } from "@/lib/gemini";
import { supabaseServer } from "@/lib/supabase-admin";
import { getActiveClientId } from "@/lib/client-context";

export const runtime = "nodejs";
export const maxDuration = 60;

interface Report {
  betyg: string; // kort omdöme i klartext
  sammanfattning: string; // 2-3 meningar
  poang_forklaring: string; // vad SEO- och AEO-poängen betyder
  styrkor: { rubrik: string; varfor: string }[];
  forbattringar: { rubrik: string; varfor: string; sa_har: string; prioritet: "hög" | "medel" | "låg" }[];
}

export async function POST(req: NextRequest) {
  const { auditId } = await req.json();
  if (!auditId) return NextResponse.json({ error: "auditId krävs" }, { status: 400 });

  const clientId = await getActiveClientId();
  const sb = supabaseServer();
  const { data: a, error } = await sb
    .from("hm_seo_audits")
    .select("*")
    .eq("id", auditId)
    .eq("client_id", clientId) // scoping: bara egen audit
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!a) return NextResponse.json({ error: "Hittade ingen audit" }, { status: 404 });

  const facts = {
    url: a.url,
    titel: a.title,
    titel_langd: a.title?.length ?? 0,
    meta_beskrivning: a.meta_description,
    meta_langd: a.meta_description?.length ?? 0,
    antal_ord: a.word_count,
    har_schema: a.has_schema,
    har_faq: a.has_faq,
    har_og_taggar: a.has_og,
    interna_lankar: a.internal_links,
    bilder_utan_alt: a.images_no_alt,
    seo_poang: a.seo_score,
    aeo_poang: a.aeo_score,
    pagespeed_mobil: a.pagespeed_mobile,
    pagespeed_dator: a.pagespeed_desktop,
    tekniska_anmarkningar: a.issues,
  };

  const system = `Du skriver en kort, begriplig SEO/AEO-rapport till en företagare som INTE är tekniker.
Förklara i klartext vad resultatet betyder, vad som är bra, vad som bör förbättras och VARFÖR det spelar roll för att synas i Google och i AI-sökmotorer (ChatGPT, Perplexity, Google AI).

REGLER:
- Skriv som en människa, kort och konkret. Inga svåra facktermer utan att förklara dem.
- Förbjudna ord: kraftfull, banbrytande, game-changer, handlar om, nästa nivå, holistisk, skalbar.
- Svenska tecken (å ä ö) korrekt.
- Var ärlig men uppmuntrande. Prioritera de förbättringar som ger mest effekt först.
- SEO-poäng = hur väl sidan funkar i vanliga Google. AEO-poäng = hur väl den syns i AI-sökmotorer.

Returnera JSON:
{
  "betyg": "ett kort omdöme i klartext, t.ex. 'Stabil grund i Google, men svår att hitta för AI-sökmotorer'",
  "sammanfattning": "2-3 meningar om läget i stort",
  "poang_forklaring": "1-2 meningar som förklarar vad just dessa SEO- och AEO-poäng innebär",
  "styrkor": [{ "rubrik": "kort", "varfor": "varför det är bra, 1 mening" }],
  "forbattringar": [{ "rubrik": "kort", "varfor": "varför det spelar roll, 1 mening", "sa_har": "konkret vad man gör", "prioritet": "hög|medel|låg" }]
}`;

  try {
    const report = await generateJSON<Report>({
      model: "gemini-2.5-flash",
      systemInstruction: system,
      prompt: `Här är resultatet av sid-auditen (JSON):\n\n${JSON.stringify(facts, null, 2)}`,
      temperature: 0.6,
      maxOutputTokens: 2500,
    });
    return NextResponse.json(report);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
