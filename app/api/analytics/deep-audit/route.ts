import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseServer } from "@/lib/supabase-admin";
import { getActiveClientId, logActivity } from "@/lib/client-context";

export const runtime = "nodejs";
export const maxDuration = 240;

const MODEL = "claude-sonnet-4-5";

const SYSTEM_PROMPT = `Du genererar en proffessionell SEO/AEO-djupgranskning pa svenska enligt en specifik mall.

# Stil-mall (folj exakt)

\`\`\`
# SEO & AEO-rapport — [Klientnamn] ([url])

**Datum:** [YYYY-MM-DD]
**Granskad sida:** [URL] + [vilken extra data fanns: GSC, audit, etc]

---

## TL;DR — tre saker som flyttar mest

1. **[Akut atgard 1]** — [varfor]
2. **[Akut atgard 2]** — [varfor]
3. **[Akut atgard 3]** — [varfor]

---

# Del 1 — Vad som FINNS (baseline)

| Område | Status | Kommentar |
|---|---|---|
[10-15 rader med ✅/⚠️/❌ + kort kommentar]

**Bedömning:** [2-3 meningar om grundlaget]

---

# Del 2 — Kritiska SEO-brister (klassisk Google)

[5-8 punkter, var en med:
- ## 2.X RUBRIK (HOG/MEDEL/LAG)
- Beskrivning
- Effekt
- Atgard (konkret, gärna med kod om relevant)]

---

# Del 3 — Kritiska AEO-brister (svar i ChatGPT/Perplexity/Gemini)

[Inledningsstycke om AEO-skillnaden]

[5-7 punkter med samma struktur som Del 2]

---

# Del 4 — Övriga tekniska anmärkningar

| # | Punkt | Allvar |
|---|---|---|
[5-8 rader]

---

# Del 5 — Action plan i prioritetsordning

## Sprint 1 — Vecka 1 (akut + lättplockat) → ~X timmar
[5-6 numrerade punkter med [referens-id]]

**Estimerad effekt:** [konkret prognos]

## Sprint 2 — Vecka 2-3 → ~X timmar
[4-6 punkter]

## Sprint 3 — Manad 2 → ~X timmar
[4-6 punkter]

## Langsiktigt (lopande)
[3-4 punkter]

---

# Del 6 — Färdiga textförslag att klistra in

[Konkreta kod-snippets eller text som kan klistras direkt:
- Definition-block
- FAQ-block
- Schema-blocks
- Skript-snippets
Endast om det ar relevant for klienten]

---

# Del 7 — Antaganden och öppna frågor

- **Antagande:** [...]
- **Antagande:** [...]
- **Öppen fråga:** [...]
- **Öppen fråga:** [...]

---

## Vad jag kan leverera direkt om vi kör

[5-7 numrerade konkreta artefakter]

Säg vilket du vill ha först så bygger jag det.
\`\`\`

# Skrivregler

- **Konkret framfor allmant.** "Lagg till FAQ-schema med 8 fragor" slar "forbattra schema".
- **Hog/Medel/Lag-prio** pa varje brist.
- **Atgardsforslag inkluderar kod-snippets** dar det ar relevant (HTML, JSON-LD, robots.txt).
- **Rakna timmar** for sprintar (var realistisk: en FAQ-sektion = 2h, schema-template = 1h).
- **Inga AI-floskler.** "kraftfull", "banbrytande", "holistisk", "handlar om" — forbjudet.
- **Svenska tecken korrekt** (a/a/o).
- **Anvand klientens faktiska data** fran GSC, brand-profil och HTML-utdraget. Hitta inte pa siffror.

# Vad du far i input

- Klient-namn + URL
- HTML-utdrag fran sajten (head + body)
- Brand-profil
- GSC-data (top sokord, position, klick, visningar)
- Eventuella tidigare audits
- Voice-fingerprint

# Output

Endast markdown-rapporten. Inga inledningar typ "Har ar din rapport". Direkt till "# SEO & AEO-rapport...".`;

interface AuditInput {
  url?: string;
}

interface RawGscRow { query: string; clicks: number; impressions: number; position: number | string }
interface RawProfile { company_name: string | null; tagline: string | null; tone_rules: string | null }

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY saknas" }, { status: 500 });

  const t0 = Date.now();
  const sb = supabaseServer();
  const clientId = await getActiveClientId();
  const body = (await req.json().catch(() => ({}))) as AuditInput;

  // Hamta klientdata
  const [client, profile, gsc, audits] = await Promise.all([
    sb.from("clients").select("name, slug, public_url").eq("id", clientId).maybeSingle(),
    sb.from("hm_brand_profile").select("company_name, tagline, usp, icp_primary, services, tone_rules, customer_quotes, dos, donts").eq("client_id", clientId).maybeSingle(),
    sb.from("gsc_queries").select("query, clicks, impressions, position").eq("client_id", clientId).order("impressions", { ascending: false }).limit(40),
    sb.from("hm_seo_audits").select("url, seo_score, aeo_score, issues, has_schema, has_faq, has_og, word_count, meta_description, title").eq("client_id", clientId).order("audited_at", { ascending: false }).limit(3),
  ]);

  const c = client.data as { name: string; public_url: string | null } | null;
  if (!c) return NextResponse.json({ error: "Klient saknas" }, { status: 404 });

  const url = body.url || c.public_url;
  if (!url) return NextResponse.json({ error: "URL saknas — lagg till public_url i clients-tabellen" }, { status: 400 });

  // Hamta HTML fran sajten
  let html = "";
  try {
    const r = await fetch(url, { headers: { "User-Agent": "Cockpit-DeepAudit/1.0" } });
    html = await r.text();
    // Trimma till rimlig storlek (head + forsta 30000 tecken av body)
    if (html.length > 60000) {
      const headEnd = html.indexOf("</head>");
      const head = headEnd > 0 ? html.slice(0, headEnd + 7) : html.slice(0, 15000);
      const bodyStart = html.indexOf("<body");
      const body = bodyStart > 0 ? html.slice(bodyStart, bodyStart + 30000) : html.slice(15000, 45000);
      html = head + "\n<!-- ... -->\n" + body;
    }
  } catch (e) {
    return NextResponse.json({ error: `Kunde inte hamta sajten: ${(e as Error).message}` }, { status: 500 });
  }

  // Sammanfatta GSC-data kompakt
  const gscRows = (gsc.data ?? []) as RawGscRow[];
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

# HTML-utdrag
\`\`\`html
${html}
\`\`\`

Generera komplett rapport enligt mallen. Anvand klientens faktiska data. Inga floskler.`;

  try {
    const anthropic = new Anthropic({ apiKey });
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = msg.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();

    // Spara i client_assets sa den finns kvar
    const { data: saved } = await sb.from("client_assets").insert({
      client_id: clientId,
      asset_type: "post",
      category: "deep_audit_report",
      subcategory: "seo_aeo",
      body: text,
      status: "active",
      metadata: {
        url,
        generated_at: new Date().toISOString(),
        gsc_rows: gscRows.length,
        tokens_in: msg.usage?.input_tokens ?? null,
        tokens_out: msg.usage?.output_tokens ?? null,
      },
    }).select("id").maybeSingle();

    await logActivity(clientId, "deep_audit", `Djupgranskning genererad for ${url}`, "/dashboard/seo");

    return NextResponse.json({
      ok: true,
      report: text,
      asset_id: saved?.id ?? null,
      duration_ms: Date.now() - t0,
      tokens_in: msg.usage?.input_tokens ?? null,
      tokens_out: msg.usage?.output_tokens ?? null,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, duration_ms: Date.now() - t0 }, { status: 500 });
  }
}

// Lista sparade rapporter
export async function GET() {
  const sb = supabaseServer();
  const clientId = await getActiveClientId();
  const { data } = await sb
    .from("client_assets")
    .select("id, body, metadata, created_at")
    .eq("client_id", clientId)
    .eq("category", "deep_audit_report")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(10);
  return NextResponse.json({ reports: data ?? [] });
}
