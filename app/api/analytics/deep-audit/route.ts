import { NextRequest, NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase-admin";
import { resolveClientId, logActivity } from "@/lib/client-context";
import { crawlSite } from "@/lib/seo-deep";
import { finalizePendingAudits } from "@/lib/deep-audit-finalize";

export const runtime = "nodejs";
export const maxDuration = 300;

const MODEL = "claude-sonnet-4-5";

const SYSTEM_PROMPT = `Du genererar en professionell SEO/AEO-djupgranskning på svenska enligt en specifik mall. Rapporten ska kunna läsas och FÖLJAS av en företagare utan teknisk bakgrund — inga oförklarade förkortningar, och varje föreslagen text skriven ut i sin helhet.

# Stil-mall (följ exakt)

\`\`\`
# SEO & AEO-rapport — [Klientnamn] ([url])

**Datum:** [YYYY-MM-DD]
**Vad jag granskat:** hela sajten ([antal] sidor) + Googles sökdata (senaste 28 dagarna)

> Snabb förklaring: **SEO** = att synas i vanliga Google-sökningar. **AEO/GEO** = att synas, bli rekommenderad och citerad i AI-sökmotorer som ChatGPT, Perplexity och Google Gemini (AEO = bli svaret, GEO = bli källan AI:n återger).

---

## Det viktigaste först — tre saker som ger mest

1. **[Åtgärd 1 i klartext]** — [vad du vinner, helst i besökare/leads]
2. **[Åtgärd 2 i klartext]** — [vad du vinner]
3. **[Åtgärd 3 i klartext]** — [vad du vinner]

---

# Det här fungerar redan (nuläge)

| Område | Status | Kommentar |
|---|---|---|
[10-15 rader med ✅/⚠️/❌ + kort kommentar i klartext]

**Sammanfattning:** [2-3 meningar om grundläget, utan jargong]

---

# Det som hindrar dig i Google

[5-8 punkter. SORTERA efter effekt på kunder — det som ger fler klick/leads FÖRST, ren teknisk hygien sist. Varje punkt EXAKT detta format, i klartext för en företagare:

## [Nr]. [Rubrik i klartext] — [Ger leads | Ger trafik | Teknisk hygien]
- **Vad det är:** problemet i en enda enkel mening (ingen jargong)
- **Varför det spelar roll:** 1 mening
- **Vad du vinner:** effekten KVALITATIVT i klartext (t.ex. "syns för fler som söker fyrhjulingar lokalt"). Skriv ALDRIG ut klick-antal eller procent om inte GSC-data i FAKTA belägger det.
- **Så här gör du:** numrerade steg som beskriver VAD som ska ändras (titel, canonical, schema, text) — plattformsneutralt. Nämn ALDRIG ett specifikt CMS/plugin (WordPress, Yoast, wp-admin, .htaccess) om inte "plattform" angetts i FAKTA. Om ett steg innebär att klistra in en text/tabell/FAQ → skriv "(hela texten finns färdig längst ner under 'Färdiga texter att klistra in')" och skriv ALDRIG ut en halv version i steg-listan.
- **Tid:** ~X min

Förklara varje fackterm i 3-5 ord FÖRSTA gången den används (t.ex. "canonical (lappen som säger åt Google vilken adress som är den riktiga)").]

---

# Det som hindrar dig i AI-sökmotorer (AEO/GEO — ChatGPT, Perplexity, Gemini)

[Inledningsstycke i klartext: allt fler frågar en AI istället för att googla. För att AI:n ska rekommendera dig (AEO) och citera dig som källa (GEO) vill den ha tydliga definitioner, jämförelser, konkreta svar OCH innehåll som är lätt att citera.]

[4-7 punkter med samma struktur som ovan. Samma regel: hänvisa till de färdiga texterna längst ner, skriv aldrig halva exempel i steg-listan. Kolla ALLTID de fyra GEO-hävstängerna (forskningsbelagda — det som mätbart får generativa AI-motorer att lyfta fram en källa) och flagga var de saknas + var de ska läggas in:
1. **Konkreta siffror/statistik** i brödtexten (mått, antal, år i drift) — AI plockar hellre upp text med data
2. **Citat** från klienten som expert eller från nöjda kunder (använd customer_quotes i brand-profilen om de finns)
3. **Källhänvisningar / auktoritet** (egna mätvärden, referensprojekt, branschstandard)
4. **Tydligt expertspråk** ("vi rekommenderar P2-P4 för skyltfönster") i stället för vaga påståenden
Föreslå konkret var på sajten siffror/citat/expertspråk ska in — och lägg färdiga formuleringar under "Färdiga texter att klistra in".]

---

# Övriga tekniska anmärkningar

| # | Punkt | Allvar |
|---|---|---|
[5-8 rader, allvar = Hög/Medel/Låg]

---

# Att göra — i prioritetsordning

## Steg 1 — denna vecka (snabbt + störst effekt) → ~X timmar
[5-6 numrerade punkter]

**Förväntad effekt:** [kvalitativ effekt i klartext — inga påhittade klick-/procentsiffror]

## Steg 2 — vecka 2-3 → ~X timmar
[4-6 punkter]

## Steg 3 — månad 2 → ~X timmar
[4-6 punkter]

## Löpande
[3-4 punkter]

---

# Färdiga texter att klistra in (kompletta)

[HÄR skriver du ut VARJE föreslagen text I SIN HELHET — färdig att kopiera rakt in, inga "[...]", inga halva meningar, inga "och så vidare". Varje block ska ha en tydlig rubrik som säger vilken sida texten ska in på och var. Inkludera allt som nämnts i punkterna ovan, t.ex.:
- Hela definitions-texten (t.ex. "Vad är en LED-skärm?" — full paragraf, färdigskriven)
- Hela jämförelsetabellen med ALLA rader ifyllda
- Hela FAQ-frågorna med fullständiga, färdiga svar
- Eventuell färdig HTML-/schema-kod om det behövs
Använd [DIN SIFFRA] BARA där en riktig siffra saknas (t.ex. pris) — allt annat ska vara komplett. Lista allra sist exakt vilka [DIN SIFFRA] företagaren behöver fylla i, så inget glöms.]

---

# Innehållsplan — bloggrubriker som lyfter ditt toppord

[Identifiera klientens STÖRSTA möjlighet i GSC-datan: sökordet med många visningar men få klick och position på sida 2 (pos 11-25) — det ordet och sidan som rankar för det = "pelarsidan". Föreslå sedan 8-10 färdiga bloggrubriker som bygger ett ämneskluster runt det ordet. Varje rubrik tar ett SMALARE long-tail-ord (lägre konkurrens, köpstarkare) och ska internlänka upp till pelarsidan. Det lär Google att klienten är expert på ämnet → pelarsidan klättrar.

Blanda intentionstyper som i ett riktigt kluster: kostnad ("vad kostar X"), jämförelse ("X eller Y"), segment (klientens RIKTIGA målgrupper), teknik/guide. Sortera störst köp-/lead-potential först. Rubriker ska vara front-laddade med sökordet, konkreta, i klientens ton, inga floskler. Format som tabell:

| # | Bloggrubrik (färdig att använda) | Målsökord | Intention | Internlänk till |
|---|---|---|---|---|

Avsluta med 2-3 rader om hur man maxar effekten: internlänka varje post till pelarsidan med ankartext = sökordet, länka även mellan posterna, publiceringstakt ~1/vecka. Hitta ALDRIG på sökvolym — bygg på GSC-datan och klientens segment.]

---

# Antaganden och öppna frågor

- **Antagande:** [...]
- **Öppen fråga:** [...]

---

# Ordlista — vad orden betyder

[En tabell som förklarar i klartext VARJE förkortning och fackterm som faktiskt förekommer i rapporten (ta bara med de som nämnts). Format:

| Ord | Vad det betyder |
|---|---|
| SEO | Att synas i vanliga Google-sökningar |
| AEO | Att bli svaret i AI-sökmotorer (ChatGPT, Perplexity, Gemini) |
| GEO | Att bli källan en AI citerar/återger i sitt genererade svar |
| Visning (impression) | Antal gånger din sida visades i sökresultatet — inte antal som sökte |
| CTR | Klickfrekvens: andel som klickar av dem som ser dig (klick delat med visningar) |
| ... | ... |
]

---

## Vad jag kan göra åt dig direkt

[3-5 numrerade konkreta saker du kan leverera. Avsluta med: "Säg vilket du vill ha först."]
\`\`\`

# FAKTA-REGLER (bryt aldrig — annars blir rapporten värdelös)

- **Använd ENDAST datan i UPPMÄTT FAKTA + GSC + brand-profil nedan.** Hitta ALDRIG på siffror, priser, leveranstider, specs, trafikvärden, klick-/leads-prognoser eller schema-typer. Saknas en siffra → skriv "[DIN SIFFRA]". Finns ingen GSC-trafikhistorik (ny sajt) → säg det rakt och ange INGA klick-/procenttal alls.
- **Säg ALDRIG att något "saknas" om FAKTA inte belägger det.** canonical/robots/sitemap/schema är redan UPPMÄTTA nedan — använd de värdena exakt. "canonical_kalla: payload" = canonical FINNS (renderas client-side), markera ✅ inte ❌.
- **ANTA ALDRIG plattform/CMS.** Du vet INTE om sajten är WordPress, Next.js, GoHighLevel e.d. Nämn ALDRIG plugins (Yoast/Rank Math), wp-admin, .htaccess eller cPanel. Beskriv VAD som ska ändras (titel, canonical, schema, innehåll), inte VILKET verktyg. Endast om "plattform" uttryckligen står i FAKTA får du ge plattformsspecifika steg (t.ex. GoHighLevel: canonical/schema i sidans Tracking Code, inga plugins).
- **Rich results 2026:** HowTo-rich-results är AVSKAFFADE och FAQ-rich-results visas bara för myndighet/hälsa. Lova ALDRIG FAQ/HowTo-stjärnor i Google (markup är ok för AI-läsbarhet — säg så, inte "Featured Snippet garanterat").
- **Title/meta:** Google har ingen teckengräns; kapning sker på pixelbredd (~50-60 / ~150-160 tecken som tumregel). Flagga för långa som "kapas troligen", inte "fel". å/ä/ö = 1 tecken.
- **Använd RIKTIG GSC-data** för CTR/position-påståenden. Säg aldrig "6000 visningar på X" om det inte står i GSC-datan.
- **VISNINGAR ≠ SÖKNINGAR:** "visningar" (impressions) = antal gånger klientens sida VISADES i sökresultatet — INTE antal personer som sökte (det totala antalet sökningar är ett större, okänt tal). Skriv aldrig "X sökningar" baserat på visningssiffran. Förklara skillnaden första gången: "visningar = antal gånger din sida visades, inte antal som sökte".
- **CTR-LOGIK (håll matten konsekvent):** klick ≈ CTR% × visningar (4 % av 6000 visningar = 240 klick, inte 24 — blanda aldrig ihop). En sida på position >10 (sida 2) ger ~0 % CTR OAVSETT titel/innehåll, eftersom nästan ingen ser sida 2. Lova därför ALDRIG "X % CTR" som direkt effekt av bättre titel/text på en sida-2-sida. Rama in vinsten som RANKING-beroende: konkretare innehåll/relevans → klättra till sida 1 → DÅ omvandlas visningar till klick. CTR-lyft från titel gäller bara sidor som redan ligger på sida 1.
- Konkret framför allmänt. Hög/Medel/Låg-prio per brist. Realistiska timmar. Inga AI-floskler (kraftfull, banbrytande, holistisk, handlar om). Svenska tecken korrekt.

# SPRÅK & LÄSBARHET (lika viktigt som fakta — rapporten ska kunna lämnas rakt till en kund)

- Skriv för en FÖRETAGARE, inte en SEO-konsult. Ingen förkortning eller fackterm får stå oförklarad: förklara i 3-5 ord första gången den nämns OCH samla alla i "Ordlista" sist.
- Använd ALDRIG interna/engelska uttryck som rubrik eller löptext: inte "TL;DR", "baseline", "link juice", "sprint", "low-hanging fruit". Använd de svenska rubrikerna i mallen EXAKT som de står.
- KOMPLETTA EXEMPEL: varje föreslagen text (definition, jämförelsetabell, FAQ, schema) skrivs ut i SIN HELHET under "Färdiga texter att klistra in" — färdig att kopiera rakt in. Aldrig fragment, aldrig "[...]", aldrig "och så vidare". I steg-listorna hänvisar du bara dit. Enda tillåtna lucka är [DIN SIFFRA] för en siffra du faktiskt inte har.
- Korta stycken, vardagliga ord. Förklara alltid en siffra med vad den betyder för kunden ("position 14 = sida 2, syns knappt").

# Vad du far i input

- Klient-namn + URL
- UPPMÄTT FAKTA för HELA sajten: varje sida (från sitemap) med title/canonical/H1/schema/ord/poäng + tvärsides-aggregat (canonical-konsekvens, dubbletter, tunna sidor, internlänkning, alt-täckning)
- Startsidans synliga text
- Brand-profil
- GSC-data (top sokord, position, klick, visningar)
- Eventuella tidigare audits

VIKTIGT: Du granskar HELA sajten, inte en sida. "pages"-listan är alla sidor som finns — föreslå aldrig att skapa sidor som redan finns där.

# Output

Endast markdown-rapporten. Inga inledningar typ "Har ar din rapport". Direkt till "# SEO & AEO-rapport...".`;

interface AuditInput {
  url?: string;
}

interface RawGscRow { query: string; clicks: number; impressions: number; position: number | string; period_start?: string | null }
interface RawProfile { company_name: string | null; tagline: string | null; tone_rules: string | null }

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY saknas" }, { status: 500 });

  const t0 = Date.now();
  const sb = supabaseService(); // client_assets har strikt RLS → kräver service-role
  const clientId = await resolveClientId();
  const body = (await req.json().catch(() => ({}))) as AuditInput;

  // Hamta klientdata
  const [client, profile, gsc, audits] = await Promise.all([
    sb.from("clients").select("name, slug, public_url").eq("id", clientId).maybeSingle(),
    sb.from("hm_brand_profile").select("company_name, tagline, usp, icp_primary, services, tone_rules, customer_quotes, dos, donts").eq("client_id", clientId).maybeSingle(),
    sb.from("gsc_queries").select("query, clicks, impressions, position, period_start").eq("client_id", clientId).order("period_start", { ascending: false }).limit(500),
    sb.from("hm_seo_audits").select("url, seo_score, aeo_score, issues, has_schema, has_faq, has_og, word_count, meta_description, title").eq("client_id", clientId).order("audited_at", { ascending: false }).limit(3),
  ]);

  const c = client.data as { name: string; public_url: string | null } | null;
  if (!c) return NextResponse.json({ error: "Klient saknas" }, { status: 404 });

  const url = body.url || c.public_url;
  if (!url) return NextResponse.json({ error: "URL saknas — lagg till public_url i clients-tabellen" }, { status: 400 });

  // Hel-sajt-crawl: alla sidor i sitemap, render-medvetet (avkodar JS-payload på GHL)
  let site;
  try {
    site = await crawlSite(url, { maxPages: 25 });
  } catch (e) {
    return NextResponse.json({ error: `Kunde inte hamta sajten: ${(e as Error).message}` }, { status: 500 });
  }

  // Sammanfatta GSC-data kompakt. KRITISKT: gsc_queries har flera ÖVERLAPPANDE rullande 28-dagars-mätningar
  // (en per synk). Använd BARA den senaste (max period_start) — annars summeras visningar och blir flerdubblade.
  const gscAll = (gsc.data ?? []) as RawGscRow[];
  const latestPeriod = gscAll[0]?.period_start ?? null;
  const gscRows = (latestPeriod ? gscAll.filter((r) => r.period_start === latestPeriod) : gscAll)
    .sort((a, b) => b.impressions - a.impressions);
  const gscSummary = gscRows.length === 0
    ? "Ingen GSC-data tillganglig."
    : gscRows.slice(0, 25).map((r) => `${r.query} | ${r.clicks} klick / ${r.impressions} visn / pos ${Number(r.position).toFixed(1)}`).join("\n");

  const p = profile.data as RawProfile | null;
  const auditSummary = (audits.data ?? []).map((a) => `${(a as { url: string }).url}: SEO ${(a as { seo_score: number }).seo_score} / AEO ${(a as { aeo_score: number }).aeo_score}`).join("\n") || "Inga tidigare audits.";

  const userPrompt = `Generera djupgranskning for denna klient.

# Klient
Namn: ${c.name}
URL: ${url}
Datum: ${new Date().toISOString().slice(0, 10)}

# Brand-profil
Foretagsnamn: ${p?.company_name ?? c.name}
Tagline: ${p?.tagline ?? "(saknas)"}
USP: ${(p as { usp?: string } | null)?.usp ?? "(saknas)"}
ICP: ${(p as { icp_primary?: string } | null)?.icp_primary ?? "(saknas)"}
Services: ${(p as { services?: string } | null)?.services ?? "(saknas)"}
Tone: ${p?.tone_rules ?? "(saknas)"}

# Topp 25 sokord (GSC, 28d)
${gscSummary}

# Tidigare audits
${auditSummary}

# UPPMÄTT FAKTA — HELA SAJTEN (render-medvetet, deterministiskt — använd EXAKT, hitta inte på)
Alla sidor nedan är hämtade från sitemap och granskade. "pages" = varje sidas mätvärden. "crossPage" = tvärsides-analys.
\`\`\`json
${JSON.stringify(site)}
\`\`\`

# Startsidans synliga text (för innehålls- och E-E-A-T-bedömning)
"""
${site.homepageText}
"""

Generera komplett rapport enligt mallen, för HELA sajten. Regler:
- "pages" är ALLA sidor som finns — föreslå ALDRIG att skapa en sida som redan finns i listan. Föreslå istället internlänkning, förstärkning eller sammanslagning.
- Del 1 (baseline) = översiktstabell per sida (url, title-längd, canonical-källa, H1, schema, ord, seo/aeo-poäng).
- Analysera HELHETEN: canonical-konsekvens (crossPage.canonicalInconsistent), dubbletter, tunna sidor, internlänkning mellan sidor (avgInternalLinks), alt-täckning.
- canonical/robots/sitemap/schema är redan uppmätta — säg aldrig "saknas" om FAKTA visar att de finns.
- DOMÄN-DUBBLETT: kolla "domainRedirect". Om redirectWorks=true (t.ex. www → icke-www 301 finns) → flagga ALDRIG "duplicerad sajt" som HÖG. Det är redan löst på serversidan. Nämn det då bara som klar/hygien. Bara om redirectWorks=false är domän-dubblett ett riktigt HÖG-problem.
- Canonical-taggar som pekar på olika domänvarianter (crossPage.canonicalTagInconsistent) när redirect finns = LÅG hygien, inte HÖG. Rekommendera att ensa till primaryHost (domainRedirect.primaryHost), men säg att effekten är liten eftersom redirecten redan styr Google rätt.
- Använd EXAKT datumet i # Klient → Datum nedan i rapportens rubrik. Hitta inte på årtal.
- Inga påhittade siffror, inga floskler.`;

  // Full uttömmande rapport via Anthropic Batch-API — ingen tidsgräns på själva genereringen,
  // så hela mallen (>14000 tokens) kan skrivas ut i sin helhet. POST submittar batchen (<5s) och
  // sparar en platshållare (status processing). Finaliseringen sker PÅLITLIGT via:
  //   - GET (denna route) när dashboarden pollar, OCH
  //   - /api/scheduler/cron var 5:e minut (även om användaren stängt fönstret).
  try {
    const batchRes = await fetch("https://api.anthropic.com/v1/messages/batches", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        requests: [
          {
            custom_id: "audit",
            params: {
              model: MODEL,
              max_tokens: 20000, // batch har ingen tidsgräns → högt tak så hela mallen (inkl. Ordlista) blir komplett
              system: SYSTEM_PROMPT,
              messages: [{ role: "user", content: userPrompt }],
            },
          },
        ],
      }),
    });
    if (!batchRes.ok) {
      return NextResponse.json({ error: `Kunde inte starta granskningen: ${await batchRes.text()}` }, { status: 500 });
    }
    const batch = (await batchRes.json()) as { id: string };

    const { data: saved } = await sb.from("client_assets").insert({
      client_id: clientId,
      asset_type: "post",
      category: "deep_audit_report",
      subcategory: "seo_aeo",
      body: "",
      status: "processing", // OBS: client_assets_status_check tillåter bara active/archived/processing/failed — INTE "generating"
      metadata: {
        url,
        batch_id: batch.id,
        started_at: new Date().toISOString(),
        gsc_rows: gscRows.length,
      },
    }).select("id").maybeSingle();

    await logActivity(clientId, "deep_audit", `Djupgranskning startad for ${url}`, "/dashboard/seo");

    return NextResponse.json({
      ok: true,
      status: "processing",
      asset_id: saved?.id ?? null,
      batch_id: batch.id,
      duration_ms: Date.now() - t0,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, duration_ms: Date.now() - t0 }, { status: 500 });
  }
}

// Finalisera aktuell klients ev. klara batch-jobb + lista sparade rapporter + pågående.
export async function GET() {
  const sb = supabaseService(); // client_assets har strikt RLS → kräver service-role
  const clientId = await resolveClientId();

  // Finalisera denna klients klara batchar (idempotent, snabbt om inget klart).
  await finalizePendingAudits(clientId).catch(() => 0);

  const { data } = await sb
    .from("client_assets")
    .select("id, body, metadata, created_at, status")
    .eq("client_id", clientId)
    .eq("category", "deep_audit_report")
    .in("status", ["active", "processing"])
    .order("created_at", { ascending: false })
    .limit(10);

  const rows = (data ?? []) as Array<{ id: string; status: string; body?: string }>;
  return NextResponse.json({
    reports: rows.filter((r) => r.status === "active" && r.body?.trim()),
    generating: rows.filter((r) => r.status === "processing").map((r) => r.id),
  });
}
