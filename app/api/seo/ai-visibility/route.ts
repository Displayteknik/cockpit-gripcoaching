import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-admin";
import { resolveClientId } from "@/lib/client-context";
import { groundedGenerate, generateJSON } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 300;

// AEO-grader: ställer relevanta frågor till en AI med live webb-grounding och kollar
// om klienten faktiskt nämns/citeras — och vilka konkurrenter som nämns i stället.
export async function POST() {
  try {
    const sb = supabaseServer();
    const clientId = await resolveClientId();

    const [{ data: client }, { data: profile }] = await Promise.all([
      sb.from("clients").select("name, public_url, industry").eq("id", clientId).maybeSingle(),
      sb.from("hm_brand_profile").select("company_name").eq("client_id", clientId).maybeSingle(),
    ]);
    const clientName = (profile?.company_name || client?.name || "").trim();
    if (!clientName) return NextResponse.json({ error: "Klienten saknar namn/brand-profil" }, { status: 400 });
    const firstWord = clientName.split(/\s+/)[0].toLowerCase();
    const host = (() => { try { return new URL(client?.public_url || "").hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; } })();
    const domainRoot = host.split(".")[0];

    // Mest relevanta sökordet (senaste GSC-mätningen, högst visningar, icke-brand) för skarpare frågor.
    let primaryKeyword = "";
    try {
      const { data: gsc } = await sb.from("gsc_queries").select("query, impressions, period_start").eq("client_id", clientId).order("period_start", { ascending: false }).limit(1000);
      const rows = (gsc ?? []) as { query: string; impressions: number; period_start: string }[];
      const latest = rows[0]?.period_start;
      const pick = rows
        .filter((r) => r.period_start === latest && !r.query.toLowerCase().includes(firstWord) && (!domainRoot || !r.query.toLowerCase().includes(domainRoot)))
        .sort((a, b) => b.impressions - a.impressions)[0];
      if (pick) primaryKeyword = pick.query;
    } catch {}

    const niche = client?.industry || primaryKeyword || "tjänsten";
    const kw = primaryKeyword || niche;
    const questions = [
      `Vilka företag erbjuder ${niche} i Sverige? Lista företagsnamn.`,
      `Vad bör man tänka på när man köper ${kw} i Sverige, och vilka leverantörer rekommenderas?`,
      `Bästa leverantören av ${kw} för företag i Sverige — vilka aktörer finns?`,
    ];

    const results = await Promise.all(questions.map(async (question) => {
      try {
        const { text, sources } = await groundedGenerate(question, { maxOutputTokens: 1400 });
        const low = text.toLowerCase();
        const mentioned = !!((domainRoot && low.includes(domainRoot)) || (firstWord.length > 2 && low.includes(firstWord)));
        let competitors: string[] = [];
        try {
          const ext = await generateJSON<{ companies: string[] }>({
            model: "gemini-2.5-flash",
            temperature: 0,
            prompt: `Ur AI-svaret nedan, lista FÖRETAGSNAMN (svenska leverantörer/aktörer) som nämns. Exkludera "${clientName}". Returnera JSON {"companies": []} med max 8 riktiga företagsnamn, inga beskrivningar.\n\nSVAR:\n${text.slice(0, 3000)}`,
          });
          competitors = (ext.companies ?? []).filter((c) => c && !c.toLowerCase().includes(firstWord)).slice(0, 8);
        } catch {}
        return { question, mentioned, competitors, answer_excerpt: text.slice(0, 500), sources: sources.slice(0, 5) };
      } catch (e) {
        return { question, mentioned: false, competitors: [], answer_excerpt: "", sources: [], error: (e as Error).message };
      }
    }));

    const mentionedCount = results.filter((r) => r.mentioned).length;
    return NextResponse.json({
      client_name: clientName,
      summary: { mentioned: mentionedCount, total: results.length },
      results,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Kunde inte köra AI-synlighetstest" }, { status: 500 });
  }
}
