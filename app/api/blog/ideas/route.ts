import { NextResponse } from "next/server";
import { generateJSON } from "@/lib/gemini";
import { getKnowledge } from "@/lib/knowledge";
import { supabaseServer } from "@/lib/supabase-admin";
import { getActiveClient, getActiveClientId } from "@/lib/client-context";

export const runtime = "nodejs";
export const maxDuration = 60;

interface Idea {
  topic: string;
  angle: string;
  keyword: string;
  priority: number;
  why?: string;
}

interface GscRow { query: string; clicks: number; impressions: number; position: number | string; page: string | null }

export async function POST() {
  const clientId = await getActiveClientId();
  const client = await getActiveClient();
  const sb = supabaseServer();
  const isAutomotive = client?.resource_module === "automotive";
  const isArt = client?.resource_module === "art";

  const [
    { data: existingBlog },
    { data: existingQueue },
    vehiclesRes,
    worksRes,
    { data: gsc },
    { data: profile },
    { data: voice },
  ] = await Promise.all([
    sb.from("hm_blog").select("title").eq("client_id", clientId).limit(100),
    sb.from("hm_blog_queue").select("topic").eq("client_id", clientId).limit(100),
    isAutomotive ? sb.from("hm_vehicles").select("category, brand, title").eq("client_id", clientId).eq("is_sold", false).limit(50) : Promise.resolve({ data: [] as { category: string; brand: string; title: string }[] }),
    isArt ? sb.from("art_works").select("title, technique, year").eq("client_id", clientId).neq("status", "archived").limit(50) : Promise.resolve({ data: [] as { title: string; technique: string; year: number }[] }),
    sb.from("gsc_queries").select("query, clicks, impressions, position, page").eq("client_id", clientId).order("impressions", { ascending: false }).limit(60),
    sb.from("hm_brand_profile").select("company_name, tagline, usp, icp_primary, pain_points, services, customer_quotes, tone_rules").eq("client_id", clientId).maybeSingle(),
    sb.from("client_voice_profile").select("signature_phrases, tone_summary").eq("client_id", clientId).maybeSingle(),
  ]);

  const existingTitles = [
    ...(existingBlog?.map((b) => b.title) || []),
    ...(existingQueue?.map((q) => q.topic) || []),
  ];

  const knowledge = await getKnowledge("company", "blog-playbook");

  // Aggregera GSC per query (kan finnas flera page-rader per query)
  const gscRows = (gsc ?? []) as GscRow[];
  const byQuery = new Map<string, { query: string; clicks: number; impressions: number; positionSum: number; positionN: number }>();
  for (const r of gscRows) {
    const k = r.query;
    if (!byQuery.has(k)) byQuery.set(k, { query: k, clicks: 0, impressions: 0, positionSum: 0, positionN: 0 });
    const e = byQuery.get(k)!;
    e.clicks += r.clicks;
    e.impressions += r.impressions;
    const pos = Number(r.position) || 0;
    if (pos > 0) {
      e.positionSum += pos * r.impressions;
      e.positionN += r.impressions;
    }
  }
  const queries = Array.from(byQuery.values()).map((e) => ({
    query: e.query,
    clicks: e.clicks,
    impressions: e.impressions,
    avg_position: e.positionN > 0 ? e.positionSum / e.positionN : 0,
  }));

  // Quick wins: position 4-20, hog impressions
  const quickWins = queries
    .filter((q) => q.avg_position >= 4 && q.avg_position <= 20 && q.impressions >= 30)
    .sort((a, b) => (b.impressions * (21 - b.avg_position)) - (a.impressions * (21 - a.avg_position)))
    .slice(0, 15);

  // Hoga-volym sokord ej redan tackta
  const highVolume = queries
    .filter((q) => q.impressions >= 50)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 20);

  const inventoryBlock = isAutomotive
    ? `NUVARANDE LAGER (anpassa förslag till vad vi faktiskt har):\n${(vehiclesRes.data || []).map((v) => `- ${v.category}: ${v.brand} ${v.title}`).join("\n")}`
    : isArt
    ? `KONSTNÄRSKAP (anpassa förslag till verken och tekniker):\n${(worksRes.data || []).map((w) => `- ${w.title} (${w.technique || "okänd teknik"}${w.year ? `, ${w.year}` : ""})`).join("\n")}`
    : "";

  type Profile = { company_name: string | null; tagline: string | null; usp: string | null; icp_primary: string | null; services: string | null; pain_points: string | null; customer_quotes: string | null; tone_rules: string | null };
  type Voice = { signature_phrases: string[] | null; tone_summary: string | null };
  const p = profile as Profile | null;
  const v = voice as Voice | null;

  const brandBlock = p
    ? `# Klient-profil
Företag: ${p.company_name ?? client?.name ?? "okand"}
Tagline: ${p.tagline ?? "(saknas)"}
USP: ${p.usp ?? "(saknas)"}
ICP (idealkund): ${p.icp_primary ?? "(saknas)"}
Tjänster: ${p.services ?? "(saknas)"}
Smärtor kunden har: ${p.pain_points ?? "(saknas)"}
Ton: ${p.tone_rules ?? v?.tone_summary ?? "(saknas)"}`
    : `# Klient: ${client?.name ?? "okand"}\n(brand-profil saknas — gor generella forslag)`;

  const voiceBlock = v?.signature_phrases && v.signature_phrases.length > 0
    ? `# Klientens egna fraser (anvand i topic/angle dar passande)\n${v.signature_phrases.map((s) => `- "${s}"`).join("\n")}`
    : "";

  const gscBlock = quickWins.length > 0 || highVolume.length > 0
    ? `# Riktig GSC-data fran Google Search Console (senaste 28d)

## Quick wins (position 4-20, hog impressions — DESSA ger mest klick om vi rankar battre)
${quickWins.map((q) => `- "${q.query}" — ${q.impressions.toLocaleString("sv-SE")} visn, pos ${q.avg_position.toFixed(1)}, ${q.clicks} klick`).join("\n")}

## Hog-volym-sokord (alla med 50+ impressions)
${highVolume.map((q) => `- "${q.query}" — ${q.impressions.toLocaleString("sv-SE")} visn, pos ${q.avg_position.toFixed(1)}`).join("\n")}`
    : "# Ingen GSC-data tillganglig (ej GSC-anslutning eller ny klient)";

  const system = `Du foreslar bloggartiklar for ${p?.company_name ?? client?.name ?? "klienten"}.

${brandBlock}

${voiceBlock}

${gscBlock}

${knowledge}

# Strategi
1. **Prioritera quick wins forst.** Sokord pa position 4-20 med hog impressions = enklaste klick-vinster. En artikel som svarar pa fragan klattrar ofta till topp 3.
2. **Tackla hog-volym-sokord nasta.** Stor synlighet = stor potential.
3. **Anpassa till klientens ICP.** En artikel som loser ICP:s smarta drar in ratt typ av kund.
4. **Anvand klientens egna fraser** dar det passar — ger autenticitet.
5. **Inga AI-floskler.** Forbjudna ord: kraftfull, banbrytande, holistisk, handlar om, nasta niva.

UNDVIK dessa amnen (redan gjorda eller koade):
${existingTitles.join("\n") || "(inga an)"}

${inventoryBlock}

# Output
RETURNERA JSON-array med 8 ideer i prioritetsordning:
[{ "topic": "...", "angle": "vinkel", "keyword": "primarsokord", "priority": 1-10, "why": "kort motivering: vilken GSC-data driver detta" }]

Prioritet 9-10 = quick win med direkt GSC-data. 7-8 = hog-volym-sokord med commercial intent. 5-6 = ICP-pain-poster. 1-4 = nice-to-have.`;

  const ideas = await generateJSON<Idea[]>({
    model: "gemini-2.5-flash",
    systemInstruction: system,
    prompt: "Ge 8 artikel-idéer baserat pa klientens GSC-data och brand-profil. Specifika sökord och vinklar — inga generaliteter.",
    temperature: 0.9,
    maxOutputTokens: 2500,
  });

  return NextResponse.json(ideas);
}
