import { NextRequest, NextResponse } from "next/server";
import { generateJSON } from "@/lib/gemini";
import { supabaseServer } from "@/lib/supabase-admin";
import { getActiveClientId } from "@/lib/client-context";
import { extractPageSignals, scoreSignals, schemaRichEligibility } from "@/lib/seo-deep";

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
  // Deterministisk hård data (sätts av servern, ej av AI:n)
  teknik?: {
    plattform: string;
    indexerbar: boolean;
    canonical: string | null;
    canonical_kalla: string;
    lighthouse_seo: number | null;
    sitemap_urls: number | null;
    cwv: { lcp: { value: number; category: string } | null; inp: { value: number; category: string } | null; cls: { value: number; category: string } | null } | null;
    checkar: { label: string; pass: boolean; detail: string }[];
  };
  sokord?: { query: string; clicks: number; impressions: number; ctr: number | null; position: number | null }[];
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

  // Djup-extraktion av den FAKTISKA sidan (render-medveten)
  let signals;
  try {
    signals = await extractPageSignals(url);
  } catch (e) {
    return NextResponse.json({ error: "Kunde inte läsa sidan: " + (e as Error).message }, { status: 502 });
  }

  // Render-medveten deterministisk poängsättning — ersätter ev. gamla rå-HTML-poäng
  const scored = scoreSignals(signals);
  seoScore = scored.seo;
  aeoScore = scored.aeo;
  const schemaEligibility = schemaRichEligibility(signals.schemaTypes);

  // GSC: riktiga sökord/positioner för DENNA sida (ej gissade)
  let gscRows: { query: string; clicks: number; impressions: number; ctr: number | null; position: number | null }[] = [];
  try {
    const { data } = await sb
      .from("gsc_queries")
      .select("query, clicks, impressions, ctr, position, page")
      .eq("client_id", clientId)
      .eq("page", url)
      .order("impressions", { ascending: false })
      .limit(15);
    gscRows = (data as typeof gscRows) || [];
  } catch { /* GSC valfritt */ }

  const facts = {
    url,
    plattform: signals.platform,
    seo_poang_uppmatt: seoScore,
    aeo_poang_uppmatt: aeoScore,
    lighthouse_seo_renderad: signals.lighthouseSeo,
    pagespeed_mobil: psMobile,
    pagespeed_dator: psDesktop,
    core_web_vitals_faltdata: signals.cwv,
    titel: signals.title,
    titel_langd_tecken: signals.titleLength,
    meta_beskrivning: signals.metaDescription,
    meta_langd_tecken: signals.metaLength,
    canonical: signals.canonical,
    canonical_kalla: signals.canonicalSource, // "static" | "payload" | "none"
    sprak: signals.lang,
    robots_meta: signals.robots,
    robots_txt: signals.robotsTxt,
    sitemap: signals.sitemap,
    og_taggar: signals.ogTags,
    schema_typer: signals.schemaTypes,
    schema_rich_result: schemaEligibility, // eligible = ger rich result; valid_no_rich = giltigt men ingen visuell snippet (t.ex. FAQPage/HowTo)
    lighthouse_checkar: signals.lighthouseAudits, // renderade Google-checkar: score 1=pass, 0=fail
    gsc_sokord_for_sidan: gscRows, // RIKTIGA sökord/positioner (tomt = ingen GSC-data importerad för sidan)
    faq_pa_sidan: signals.faqs,
    rubrik_hierarki: signals.headings,
    tomma_rubriker: signals.emptyHeadings,
    antal_ord: signals.wordCount,
    antal_stycken: signals.paragraphCount,
    antal_listor: signals.listCount,
    bilder: signals.images,
    lankar: signals.links,
    har_uppdaterat_datum: signals.hasUpdatedDate,
    render_not: signals.renderNote,
  };

  const system = `Du är en senior SEO/AEO-konsult som skriver en proffsig, grundlig men begriplig analys till en företagare (ej tekniker).

ABSOLUTA REGLER OM FAKTA (bryt aldrig):
- Använd ENDAST datan i FAKTA och SIDANS TEXT nedan. Hitta ALDRIG på siffror, priser, leveranstider, trafikvärden, schema-typer eller rubriker. Saknas en siffra → skriv "[DIN SIFFRA]" som platshållare, gissa aldrig.
- Säg ALDRIG att något "saknas" om det inte är belagt i datan. "canonical_kalla": "payload" betyder att canonical FINNS (renderas client-side) — påstå då aldrig att den saknas. Är ett fält null men kunde inte verifieras → skriv "[EJ VERIFIERAT]".
- Plattformsbundna råd: anpassa varje teknisk åtgärd efter "plattform". På GoHighLevel finns INGEN .htaccess/nginx — canonical/redirect sköts i sidans Tracking Code + domäninställningar. Föreslå aldrig server-config plattformen inte har.
- Title/meta: Google har ingen teckengräns — kapning sker på pixelbredd. Tumregel ~50–60 / ~150–160 tecken. Flagga för långa som "kapas troligen", inte "fel". å/ä/ö = 1 tecken.
- Strukturerad data: HowTo-rich-results är avskaffade och FAQ-rich-results visas bara för myndighets-/hälsosajter. Lova ALDRIG FAQ/HowTo-stjärnor i Google för en vanlig sajt (markup är ändå bra för AI-läsbarhet — säg så).
- Core Web Vitals (om faltdata finns): LCP bra ≤2,5s/dålig >4,0s · INP bra ≤200ms/dålig >500ms · CLS bra ≤0,1/dålig >0,25. Finns ingen faltdata → påstå inget om CWV-utfall.
- AEO-citerbarhet: de bevisade hävstängerna är direkta citat, konkret statistik, källhänvisningar och flytande prosa. Keyword-stuffing skadar. llms.txt ger aldrig poängavdrag.
- "gsc_sokord_for_sidan" = RIKTIG Search Console-data för sidan. Finns rader: använd dem för konkreta råd (t.ex. "rankar pos X på 'fras' men låg CTR"). Är listan tom: säg att GSC-data saknas — gissa ALDRIG trafik/positioner.
- "lighthouse_checkar" = Googles renderade checkar (score 1 = pass, 0 = fel, null = ej tillämpligt). Lita på dessa före egna gissningar om teknik.
- "schema_rich_result.valid_no_rich" innehåller schema som är giltigt men INTE ger rich result (t.ex. FAQPage). Lova inte snippets för dem.
- "seo_poang_uppmatt" och "aeo_poang_uppmatt" är uppmätta — återanvänd exakt i scorecard.seo.poang resp scorecard.aeo.poang. Hitta inte på egna.
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
    // Hård, deterministisk data direkt från mätningen (aldrig via AI:n)
    report.teknik = {
      plattform: signals.platform,
      indexerbar: scored.indexerbar,
      canonical: signals.canonical,
      canonical_kalla: signals.canonicalSource,
      lighthouse_seo: signals.lighthouseSeo,
      sitemap_urls: signals.sitemap?.found ? signals.sitemap.urlCount : null,
      cwv: signals.cwv
        ? {
            lcp: signals.cwv.lcp ? { value: signals.cwv.lcp.value, category: signals.cwv.lcp.category } : null,
            inp: signals.cwv.inp ? { value: signals.cwv.inp.value, category: signals.cwv.inp.category } : null,
            cls: signals.cwv.cls ? { value: signals.cwv.cls.value, category: signals.cwv.cls.category } : null,
          }
        : null,
      checkar: (signals.lighthouseAudits || []).map((a) => ({
        label: a.title,
        pass: a.score === 1,
        detail: a.displayValue || (a.score === 1 ? "ok" : a.score === 0 ? "åtgärda" : "—"),
      })),
    };
    report.sokord = gscRows;
    return NextResponse.json(report);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
