import { NextRequest, NextResponse } from "next/server";
import { generateJSON } from "@/lib/gemini";
import { supabaseServer } from "@/lib/supabase-admin";
import { getActiveClientId } from "@/lib/client-context";
import { extractPageSignals } from "@/lib/seo-deep";

export const runtime = "nodejs";
export const maxDuration = 120;

interface DeepReport {
  betyg: string;
  sammanfattning: string;
  scorecard: {
    seo: { poang: number; kommentar: string };
    aeo: { poang: number; kommentar: string };
    innehall: { poang: number; kommentar: string };
    eeat: { poang: number; kommentar: string };
  };
  styrkor: { rubrik: string; varfor: string }[];
  forbattringar: {
    rubrik: string;
    varfor: string;
    sa_har: string;
    exempel: string;
    prioritet: "hög" | "medel" | "låg";
    effekt: "stor" | "medel" | "liten";
  }[];
  citerbarhet: { omdome: string; motivering: string; forslag: string };
  eeat: { omdome: string; saknas: string[] };
}

export async function POST(req: NextRequest) {
  const { auditId, url: urlInput } = await req.json();

  const clientId = await getActiveClientId();
  const sb = supabaseServer();

  // Hämta URL + de deterministiska poängen (korrekta siffror) från auditen om den finns
  let url = urlInput as string | undefined;
  let seoScore: number | null = null;
  let aeoScore: number | null = null;
  let psMobile: number | null = null;
  let psDesktop: number | null = null;

  if (auditId) {
    const { data: a } = await sb
      .from("hm_seo_audits")
      .select("url, seo_score, aeo_score, pagespeed_mobile, pagespeed_desktop")
      .eq("id", auditId)
      .eq("client_id", clientId)
      .maybeSingle();
    if (a) {
      url = a.url as string;
      seoScore = a.seo_score as number;
      aeoScore = a.aeo_score as number;
      psMobile = a.pagespeed_mobile as number | null;
      psDesktop = a.pagespeed_desktop as number | null;
    }
  }

  if (!url) return NextResponse.json({ error: "url eller auditId krävs" }, { status: 400 });

  // Djup-extraktion av den FAKTISKA sidan
  let signals;
  try {
    signals = await extractPageSignals(url);
  } catch (e) {
    return NextResponse.json({ error: "Kunde inte läsa sidan: " + (e as Error).message }, { status: 502 });
  }

  const facts = {
    url,
    seo_poang_uppmatt: seoScore,
    aeo_poang_uppmatt: aeoScore,
    pagespeed_mobil: psMobile,
    pagespeed_dator: psDesktop,
    titel: signals.title,
    titel_langd: signals.titleLength,
    meta_beskrivning: signals.metaDescription,
    meta_langd: signals.metaLength,
    canonical: signals.canonical,
    sprak: signals.lang,
    robots: signals.robots,
    og_taggar: signals.ogTags,
    schema_typer: signals.schemaTypes,
    faq_pa_sidan: signals.faqs,
    rubrik_hierarki: signals.headings,
    antal_ord: signals.wordCount,
    antal_stycken: signals.paragraphCount,
    antal_listor: signals.listCount,
    bilder: signals.images,
    lankar: signals.links,
    har_uppdaterat_datum: signals.hasUpdatedDate,
  };

  const system = `Du är en senior SEO/AEO-konsult som skriver en proffsig, grundlig men begriplig analys till en företagare (ej tekniker).

ABSOLUTA REGLER OM FAKTA:
- Använd ENDAST datan i FAKTA och SIDANS TEXT nedan. Hitta ALDRIG på siffror, schema-typer, rubriker eller påståenden.
- När du föreslår en omskrivning: citera den FAKTISKA texten/rubriken ord för ord i "exempel" och visa din förbättrade version.
- "seo_poang_uppmatt" och "aeo_poang_uppmatt" är uppmätta — återanvänd dem exakt i scorecard.seo.poang resp scorecard.aeo.poang. Hitta inte på egna.
- Poäng för "innehall" och "eeat" sätter DU (0-100) baserat på den faktiska texten — motivera kort.

SPRÅK & TON:
- Svenska, klartext. Förklara facktermer kort. Svenska tecken (å ä ö) korrekt.
- Förbjudna ord: kraftfull, banbrytande, game-changer, handlar om, nästa nivå, holistisk, skalbar.
- Var konkret och ärlig. Prioritera det som ger störst effekt.

VAD DU BEDÖMER PÅ DJUPET:
- Innehållskvalitet: är texten konkret, specifik, trovärdig? Eller tunn/generisk?
- E-E-A-T: syns erfarenhet (förstaperson, konkreta exempel), expertis, källor, förtroende?
- Citerbarhet för AI-sökmotorer: ger sidan direkta, faktaspäckade svar som ChatGPT/Perplexity kan citera? Är rubriker formulerade som frågor? Finns tydliga definitioner?
- Rubrikhierarki: logisk H1→H2→H3? Matchar rubrikerna vad folk söker?

Returnera EXAKT denna JSON:
{
  "betyg": "ett kort, träffande omdöme i klartext",
  "sammanfattning": "3-4 meningar om läget i stort",
  "scorecard": {
    "seo": { "poang": <seo_poang_uppmatt>, "kommentar": "1 mening" },
    "aeo": { "poang": <aeo_poang_uppmatt>, "kommentar": "1 mening" },
    "innehall": { "poang": 0-100, "kommentar": "1 mening om innehållskvaliteten" },
    "eeat": { "poang": 0-100, "kommentar": "1 mening om trovärdighet/erfarenhet" }
  },
  "styrkor": [{ "rubrik": "kort", "varfor": "varför det är bra, grundat i sidan" }],
  "forbattringar": [{
    "rubrik": "kort åtgärd",
    "varfor": "varför det spelar roll för Google/AI",
    "sa_har": "konkret vad man gör",
    "exempel": "citera faktisk text + visa förbättrad version (eller '' om ej tillämpligt)",
    "prioritet": "hög|medel|låg",
    "effekt": "stor|medel|liten"
  }],
  "citerbarhet": { "omdome": "kort omdöme om hur citerbar sidan är för AI", "motivering": "1-2 meningar grundat i texten", "forslag": "1 konkret sak som gör sidan mer citerbar" },
  "eeat": { "omdome": "kort omdöme", "saknas": ["det som saknas för högre trovärdighet"] }
}

Ge 3-6 styrkor och 3-7 förbättringar (viktigast först).`;

  const prompt = `FAKTA (deterministiskt uppmätt — använd exakt):
${JSON.stringify(facts, null, 2)}

SIDANS TEXT (för innehålls- och E-E-A-T-bedömning):
"""
${signals.mainText}
"""`;

  try {
    const report = await generateJSON<DeepReport>({
      model: "gemini-2.5-pro",
      systemInstruction: system,
      prompt,
      temperature: 0.4,
      maxOutputTokens: 8192,
    });
    // Säkra att de uppmätta poängen alltid är korrekta (skriv över ev. AI-avvikelse)
    if (report.scorecard) {
      if (seoScore != null) report.scorecard.seo.poang = seoScore;
      if (aeoScore != null) report.scorecard.aeo.poang = aeoScore;
    }
    return NextResponse.json(report);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
