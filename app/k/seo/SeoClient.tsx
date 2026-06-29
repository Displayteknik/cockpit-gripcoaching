"use client";

import { useEffect, useState } from "react";
import { TrendingUp, FileSearch, Loader2, AlertCircle, CheckCircle2, Plus, Trash2, ExternalLink, Sparkles, Lightbulb, Bot } from "lucide-react";
import { SeoReportBlock } from "@/components/SeoReport";
import { FunctionGuide } from "@/components/FunctionGuide";

interface Audit {
  id: string;
  url: string;
  title: string | null;
  meta_description: string | null;
  word_count: number;
  has_schema: boolean;
  has_faq: boolean;
  has_og: boolean;
  internal_links: number;
  images_no_alt: number;
  pagespeed_mobile: number | null;
  pagespeed_desktop: number | null;
  seo_score: number;
  aeo_score: number;
  issues: { level: string; field: string; message: string }[];
  audited_at: string;
}

interface Keyword {
  id: string;
  keyword: string;
  target_url: string | null;
  intent: string | null;
  current_rank: number | null;
  best_rank: number | null;
  search_volume: number | null;
  last_checked: string | null;
  gsc_position?: number | null;
  gsc_clicks?: number;
  gsc_impressions?: number;
  gsc_related_query?: string | null;
  gsc_related_position?: number | null;
}

interface ContentAudit {
  overall_score: number;
  voice_match_score: number;
  ai_smell_score: number;
  conversion_score: number;
  ai_smell_phrases: string[];
  rewrite_priorities: { issue: string; original: string; rewrite: string }[];
  strengths: string[];
  next_actions: string[];
}

// Orienterande flöde överst på sidan — vad som görs för din synlighet och VEM som gör vad.
// Ärligt: "Du gör" = kunden själv här på sidan, "Vi gör" = byrån hjälper till.
const FLOW: { n: number; who: "du" | "vi" | "duvi"; title: string; desc: string; what: string; how: string; tips: string[] }[] = [
  {
    n: 1, who: "du", title: "Analysera din sida",
    desc: "Kör sid-analysen och se hur välbyggd sidan är — plus de viktigaste fixarna.",
    what: "Verktyget hämtar din sida och läser hur den är byggd: titel, rubriker, om den har FAQ, interna länkar, bilder utan alt-text och laddtid (Googles PageSpeed).",
    how: "Klistra in sidans adress i \"Sid-analys\" nedan och kör. Du får två tekniska poäng 0–100 (SEO + AEO) och en lista på vad som kan förbättras.",
    tips: ["Poängen mäter sidans uppbyggnad — inte hur högt du rankar.", "Börja med din viktigaste sida.", "Följ åtgärdslistan uppifrån; de översta ger mest effekt."],
  },
  {
    n: 2, who: "du", title: "Hitta dina sökord",
    desc: "Få förslag på sökord dina kunder söker på, och lägg dem i din bevakning.",
    what: "Utifrån din profil föreslår verktyget korta, vassa sökord du borde synas på. I Sökords-trackern följer du sen hur dina placeringar utvecklas över tid.",
    how: "Klicka \"Vad ska du ranka på?\" för förslag och lägg till dem med ett klick. Skriv in var du ligger på Google i trackern, så ser du utvecklingen.",
    tips: ["Ju mer ifylld din profil är, desto bättre förslag.", "Sök i inkognitoläge så resultatet inte påverkas av din historik.", "Uppdatera positionerna ungefär en gång i månaden."],
  },
  {
    n: 3, who: "duvi", title: "Skriv så du syns",
    desc: "Kvalitetskolla texten och skriv så att Google och AI-sökmotorer citerar dig. Vi hjälper vid behov.",
    what: "En AI bedömer din text (ton, AI-känsla, om den får läsaren att höra av sig) och pekar ut vad som kan bli bättre. Plus konkreta tips för att synas i AI-sökmotorer som ChatGPT och Perplexity.",
    how: "Kör \"AI-granskning av text\" och skriv om det den flaggar. Följ AI-tipsen längst ner på sidan — eller hör av dig så hjälper vi till med omskrivningen.",
    tips: ["Skriv rubriker som frågor dina kunder faktiskt ställer.", "Ge ett direkt svar i första meningen efter varje rubrik — det är det AI citerar.", "Skriv i din egen röst; kör granskningen igen och jämför."],
  },
  {
    n: 4, who: "du", title: "Följ resultatet",
    desc: "Se i Statistik om du klättrar — besök, placeringar och synlighet i AI-sök.",
    what: "Statistik visar din riktiga synlighet: besök på sajten, vilka sökord du syns på, var du rankar i Google och om AI-sökmotorer börjar skicka besök.",
    how: "Öppna Statistik och titta vecka för vecka. \"Var rankar du på Google\" och \"Dina snabbaste möjligheter\" visar var nästa insats ger mest.",
    tips: ["Sökdatan kommer från Google Search Console — riktiga siffror, inga gissningar.", "Kolla \"sida 2\"-orden — de är närmast att nå sida 1.", "Jämför perioder (7 / 28 / 90 dagar) för att se trenden."],
  },
];

export default function SeoClient({ primaryColor, clientName, publicUrl, showKeywordIdeas = false }: { primaryColor: string; clientName: string; publicUrl: string; showKeywordIdeas?: boolean }) {
  const [audits, setAudits] = useState<Audit[]>([]);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [auditUrl, setAuditUrl] = useState(publicUrl);
  const [skipPagespeed, setSkipPagespeed] = useState(false);
  const [auditing, setAuditing] = useState(false);
  const [newKw, setNewKw] = useState({ keyword: "", target_url: "", intent: "informational", search_volume: "" });
  const [showAiAudit, setShowAiAudit] = useState(false);
  const [ideas, setIdeas] = useState<{ groups: { title: string; note: string; keywords: { keyword: string; why: string; intent: string }[] }[] } | null>(null);
  const [ideasLoading, setIdeasLoading] = useState(false);
  const [focus, setFocus] = useState("");
  const [addedKw, setAddedKw] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  async function reload() {
    const [ad, kw] = await Promise.all([
      fetch("/api/seo/audit").then((r) => r.json()).catch(() => []),
      fetch("/api/seo/keywords").then((r) => r.json()).catch(() => []),
    ]);
    setAudits(Array.isArray(ad) ? ad : []);
    setKeywords(Array.isArray(kw) ? kw : []);
  }

  useEffect(() => { reload(); }, []);

  // "Hämta mina sökord från Google" — importerar orden du faktiskt syns på (GSC) till trackern.
  async function importFromGsc() {
    setImporting(true);
    setImportMsg(null);
    try {
      const r = await fetch("/api/seo/keywords/import-gsc", { method: "POST" });
      const d = await r.json();
      if (!r.ok) { setImportMsg(d.error || "Något gick fel."); return; }
      if (d.added > 0) { setImportMsg(`La till ${d.added} sökord du redan syns på i Google.`); await reload(); }
      else { setImportMsg(d.reason || "Inget nytt att hämta just nu."); }
    } catch { setImportMsg("Något gick fel. Försök igen om en stund."); }
    finally { setImporting(false); }
  }

  async function runAudit() {
    if (!auditUrl.trim()) return;
    setAuditing(true);
    try {
      const r = await fetch("/api/seo/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: auditUrl, skip_pagespeed: skipPagespeed }),
      });
      if (!r.ok) {
        const err = await r.json();
        alert("Fel: " + (err.error || "okänt"));
      } else {
        reload();
      }
    } finally {
      setAuditing(false);
    }
  }

  async function addKeyword() {
    if (!newKw.keyword.trim()) return;
    await fetch("/api/seo/keywords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        keyword: newKw.keyword,
        target_url: newKw.target_url || null,
        intent: newKw.intent,
        search_volume: newKw.search_volume ? parseInt(newKw.search_volume) : null,
      }),
    });
    setNewKw({ keyword: "", target_url: "", intent: "informational", search_volume: "" });
    reload();
  }

  async function generateIdeas() {
    setIdeasLoading(true);
    setIdeas(null);
    try {
      const r = await fetch("/api/seo/keyword-ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ focus }),
      });
      const raw = await r.text();
      let d: { groups?: { title: string; note: string; keywords: { keyword: string; why: string; intent: string }[] }[]; error?: string };
      try { d = JSON.parse(raw); } catch { throw new Error("Det tog för lång tid. Försök igen om en stund."); }
      if (!r.ok) throw new Error(d?.error || "Kunde inte föreslå sökord.");
      setIdeas({ groups: d.groups || [] });
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setIdeasLoading(false);
    }
  }

  async function addSuggested(keyword: string, intent: string) {
    setAddedKw((s) => new Set(s).add(keyword));
    await fetch("/api/seo/keywords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword, intent, target_url: null, search_volume: null }),
    });
    reload();
  }

  async function updateRank(id: string, rank: number | null) {
    await fetch("/api/seo/keywords", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, current_rank: rank }),
    });
    reload();
  }

  async function deleteKeyword(id: string) {
    if (!confirm("Ta bort sökord?")) return;
    await fetch(`/api/seo/keywords?id=${id}`, { method: "DELETE" });
    reload();
  }

  return (
    <div className="space-y-6 pb-12">
      <div>
        <span
          className="text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded"
          style={{ background: `${primaryColor}15`, color: primaryColor }}
        >
          SEO &amp; AEO
        </span>
        <h1 className="font-display text-2xl font-bold text-gray-900 flex items-center gap-2 mt-1">
          <TrendingUp className="w-6 h-6" style={{ color: primaryColor }} />
          Syns du i Google + AI-sökmotorer?
        </h1>
        <p className="text-gray-600 text-sm mt-1 max-w-2xl">
          Analysera dina sidor och se hur välbyggda de är för Google och AI-sökmotorer som
          ChatGPT, Perplexity och Google AI Overviews. Få konkreta förbättringar. Din faktiska
          synlighet (placering, klick) ser du under Statistik.
        </p>
      </div>

      {/* FLÖDET — orienterande överblick: vad som görs för din synlighet och vem som gör vad */}
      <div className="rounded-2xl border p-5" style={{ background: `${primaryColor}08`, borderColor: `${primaryColor}20` }}>
        <h2 className="font-display font-bold text-gray-900 text-lg flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${primaryColor}1a` }}>
            <Bot className="w-[18px] h-[18px]" style={{ color: primaryColor }} />
          </span>
          Så jobbar vi med din synlighet
        </h2>
        <p className="text-sm text-gray-600 mt-1 mb-4 max-w-2xl">
          Fyra steg — allt finns här på sidan. Så syns du bättre i både Google och AI-sökmotorer. Behöver du hjälp med en omskrivning är vi ett mejl bort.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {FLOW.map((s) => (
            <div key={s.n} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-lg font-bold font-display tabular-nums" style={{ color: primaryColor }}>{s.n}</span>
                <div className="flex items-center gap-0.5">
                  <FunctionGuide primaryColor={primaryColor} title={s.title} what={s.what} how={s.how} tips={s.tips} />
                  <WhoBadge who={s.who} primaryColor={primaryColor} />
                </div>
              </div>
              <div className="font-semibold text-gray-900 text-sm leading-tight">{s.title}</div>
              <div className="text-xs text-gray-500 mt-1 leading-relaxed">{s.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Sid-audit */}
      <Card title="Sid-analys (teknisk SEO + AEO)" subtitle="Klistra in en URL. Vi analyserar sidans uppbyggnad (titel, struktur, schema, laddtid) och ger en poäng + åtgärdslista. OBS: poängen mäter hur välbyggd sidan är — INTE hur högt den rankar i Google."
        guide={<FunctionGuide primaryColor={primaryColor} title="Sid-analys (teknisk SEO + AEO)"
          what="Granskar en enskild sida och ger en teknisk poäng (0–100) för både vanlig Google-sök (SEO) och AI-sökmotorer (AEO), plus en lista på vad som kan förbättras."
          how="Klistra in sidans adress. Vi hämtar sidan, läser dess uppbyggnad (sidtitel, rubriker, text, schema, bilder) och kör Googles PageSpeed. Poängen säger hur välbyggd sidan är — inte hur högt den rankar (det ser du under Statistik)."
          tips={["Kör en sida i taget — börja med din viktigaste.", "Följ åtgärdslistan uppifrån; de översta ger mest effekt.", "Hög poäng = tekniskt redo. Ranking byggs sen med innehåll och tid."]} />}>
        <div className="flex gap-2 mb-4 flex-wrap">
          <input
            value={auditUrl}
            onChange={(e) => setAuditUrl(e.target.value)}
            placeholder="https://din-sajt.se/sida"
            className="flex-1 min-w-[260px] px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-gray-400"
          />
          <label className="flex items-center gap-2 text-xs text-gray-600 px-2">
            <input type="checkbox" checked={skipPagespeed} onChange={(e) => setSkipPagespeed(e.target.checked)} className="rounded" />
            Hoppa PageSpeed (snabbt)
          </label>
          <button
            onClick={runAudit}
            disabled={auditing || !auditUrl.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: primaryColor }}
          >
            {auditing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSearch className="w-4 h-4" />}
            Auditera
          </button>
        </div>

        {audits.length === 0 ? (
          <Empty text="Ingen audit än. Klistra in en URL ovan och kör." />
        ) : (
          <div className="space-y-3">
            {audits.slice(0, 10).map((a) => (
              <details key={a.id} className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
                <summary className="cursor-pointer px-4 py-3 hover:bg-gray-100 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{a.title || a.url}</div>
                    <div className="text-xs text-gray-500 truncate">{a.url}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <ScoreBadge label="Teknisk SEO" value={a.seo_score} />
                    <ScoreBadge label="Teknisk AEO" value={a.aeo_score} />
                    {a.pagespeed_mobile != null && <ScoreBadge label="📱" value={a.pagespeed_mobile} />}
                  </div>
                </summary>
                <div className="px-4 py-3 border-t border-gray-200 bg-white space-y-3">
                  {/* Klartext-rapport (delad komponent) */}
                  <SeoReportBlock auditId={a.id} url={a.url} auditedAt={a.audited_at} clientName={clientName} primaryColor={primaryColor} />


                  {/* Tekniska detaljer */}
                  <details className="group">
                    <summary className="cursor-pointer text-xs font-medium text-gray-500 hover:text-gray-700 select-none">
                      Tekniska detaljer
                    </summary>
                    <div className="mt-2 space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <Mini label="Title" value={a.title ? `${a.title.length} tecken` : "saknas"} ok={!!a.title && a.title.length >= 30 && a.title.length <= 60} />
                    <Mini label="Meta-desc" value={a.meta_description ? `${a.meta_description.length} tecken` : "saknas"} ok={!!a.meta_description && a.meta_description.length >= 120 && a.meta_description.length <= 160} />
                    <Mini label="Ord" value={a.word_count} ok={a.word_count >= 600} />
                    <Mini label="Schema" value={a.has_schema ? "ja" : "nej"} ok={a.has_schema} />
                    <Mini label="FAQ" value={a.has_faq ? "ja" : "nej"} ok={a.has_faq} />
                    <Mini label="OG-taggar" value={a.has_og ? "ja" : "nej"} ok={a.has_og} />
                    <Mini label="Interna länkar" value={a.internal_links} ok={a.internal_links >= 3} />
                    <Mini label="Bilder utan alt" value={a.images_no_alt} ok={a.images_no_alt === 0} />
                  </div>
                  {a.issues && a.issues.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-gray-700 mb-1.5">Förbättringar:</div>
                      <ul className="space-y-1">
                        {a.issues.map((i, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-xs">
                            {i.level === "error" ? <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" /> :
                             i.level === "warn" ? <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" /> :
                             <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />}
                            <span className={i.level === "error" ? "text-red-700" : i.level === "warn" ? "text-amber-700" : "text-gray-600"}>
                              <strong>{i.field}:</strong> {i.message}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="text-xs text-gray-400">Auditerad {new Date(a.audited_at).toLocaleString("sv-SE")}</div>
                    </div>
                  </details>
                </div>
              </details>
            ))}
          </div>
        )}
      </Card>

      {/* AI-granskning */}
      <Card title="AI-granskning av text" subtitle="Klistra in en text eller URL — AI:n bedömer kvalitet, ton, AI-känsla och om texten leder till handling. Hård men ärlig."
        guide={<FunctionGuide primaryColor={primaryColor} title="AI-granskning av text"
          what="Låter en AI läsa din text och ge en ärlig bedömning: är den välskriven, har den rätt ton, känns den AI-genererad, och får den läsaren att göra något (boka, höra av sig)?"
          how="Klistra in texten eller en sidadress. AI:n läser och poängsätter, pekar ut svaga formuleringar och 'AI-klyschor', och föreslår hur du skriver om dem. Den är medvetet hård för att höja kvaliteten."
          tips={["Använd den innan du publicerar ny text.", "Fokusera på det den flaggar som AI-känsla och svaga avslut.", "Skriv om i din egen röst — kör igen och jämför."]} />}>
        <button
          onClick={() => setShowAiAudit(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
          style={{ background: primaryColor }}
        >
          <Sparkles className="w-4 h-4" />
          Granska en text
        </button>
      </Card>

      {/* Sökords-förslag — föreslår VAD man ska ranka på. Påslaget per klient. */}
      {showKeywordIdeas && (
      <Card title="Vad ska du ranka på?" subtitle="Vet du inte vilka sökord du ska synas på? Vi läser din verksamhet och föreslår sökord som dina kunder faktiskt söker på. Lägg till dem i trackern med ett klick."
        guide={<FunctionGuide primaryColor={primaryColor} title="Vad ska du ranka på?"
          what="Föreslår sökord du borde synas på i Google — korta, vassa ord som dina kunder faktiskt skriver, grupperade efter köp, jämför och info."
          how="Den läser din Brand-profil (vad du erbjuder, dina kunder, din röst) och låter AI:n föreslå relevanta sökord. Du kan också skriva något särskilt du vill synas för. Varje förslag lägger du till i Sökords-trackern med ett klick."
          tips={["Ju mer ifylld din Brand-profil är, desto bättre förslag.", "Fyll i fältet om du vill styra mot ett visst tema.", "Lägg till de mest relevanta i trackern och följ dem över tid."]} />}>
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <input
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            placeholder="Något särskilt du vill synas för? (valfritt)"
            className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-gray-400"
          />
          <button
            onClick={generateIdeas}
            disabled={ideasLoading}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: primaryColor }}
          >
            {ideasLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {ideasLoading ? "Tar fram förslag…" : "Föreslå sökord"}
          </button>
        </div>

        {ideas && ideas.groups.length === 0 && (
          <Empty text="Inga förslag den här gången — fyll i fältet ovan och försök igen." />
        )}

        {ideas && ideas.groups.length > 0 && (
          <div className="space-y-4">
            {ideas.groups.map((g, gi) => (
              <div key={gi}>
                <div className="font-semibold text-gray-900 text-sm">{g.title}</div>
                {g.note && <div className="text-xs text-gray-500 mb-2">{g.note}</div>}
                <div className="space-y-1.5">
                  {g.keywords.map((k, ki) => {
                    const added = addedKw.has(k.keyword);
                    return (
                      <div key={ki} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 text-sm">{k.keyword}</div>
                          {k.why && <div className="text-xs text-gray-500">{k.why}</div>}
                        </div>
                        <button
                          onClick={() => addSuggested(k.keyword, k.intent)}
                          disabled={added}
                          className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-md whitespace-nowrap disabled:opacity-60"
                          style={added ? { background: "#ecfdf5", color: "#059669" } : { background: `${primaryColor}15`, color: primaryColor }}
                        >
                          {added ? <><CheckCircle2 className="w-3.5 h-3.5" /> Tillagd</> : <><Plus className="w-3.5 h-3.5" /> Lägg till</>}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
      )}

      {/* Sökords-tracker */}
      <Card title="Sökords-tracker" subtitle="Lägg in de sökord du vill ranka på. Placeringen hämtas automatiskt från Google (Search Console) för de ord du redan syns på — du behöver inte fylla i den själv."
        guide={<FunctionGuide primaryColor={primaryColor} title="Sökords-tracker"
          what="Din egen bevakningslista över de sökord du vill ranka på. För ord du redan syns på hämtas din placering automatiskt från Google Search Console, så du ser utvecklingen över tid."
          how="Skriv in ett sökord och lägg till det. Syns du redan på ordet fylls din snittplacering i automatiskt från Google. Ord du inte rankar på än får ingen placering — då kan du skriva in en själv om du vill."
          tips={["Lägg till de viktigaste orden från 'Vad ska du ranka på?'.", "Placeringen kommer från Google automatiskt för ord du redan syns på.", "Ord utan siffra rankar du inte på än — skriv mer innehåll om dem så börjar de synas."]} />}>
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <input
            value={newKw.keyword}
            onChange={(e) => setNewKw({ ...newKw, keyword: e.target.value })}
            onKeyDown={(e) => { if (e.key === "Enter") addKeyword(); }}
            placeholder="Skriv ett sökord du vill följa, t.ex. ledarskapsutbildning"
            className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 text-sm outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
          />
          <button
            onClick={addKeyword}
            disabled={!newKw.keyword.trim()}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-40 transition-opacity shadow-sm"
            style={{ background: primaryColor }}
          >
            <Plus className="w-4 h-4" /> Lägg till
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 mb-4 -mt-1">
          <button
            onClick={importFromGsc}
            disabled={importing}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border disabled:opacity-50 transition-colors"
            style={{ borderColor: `${primaryColor}40`, color: primaryColor, background: `${primaryColor}0a` }}
          >
            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Hämta mina sökord från Google
          </button>
          {importMsg && <span className="text-xs text-gray-500">{importMsg}</span>}
        </div>
        {keywords.length === 0 ? <Empty text="Lägg till ditt första sökord ovan." /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-100">
                  <th className="text-left py-2 px-2">Sökord</th>
                  <th className="text-right py-2 px-2">Volym</th>
                  <th className="text-right py-2 px-2">Position</th>
                  <th className="text-right py-2 px-2">Bästa</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {keywords.map((k) => (
                  <tr key={k.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="py-2 px-2">
                      <div className="font-medium text-gray-900">{k.keyword}</div>
                      {k.target_url && <div className="text-xs text-gray-400 truncate max-w-xs">{k.target_url}</div>}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums text-gray-600">{k.search_volume ?? "—"}</td>
                    <td className="py-2 px-2 text-right">
                      {k.gsc_position != null ? (
                        <span className="inline-flex items-center gap-1.5 justify-end" title="Hämtad automatiskt från Google Search Console — din snittplacering på exakt det här ordet.">
                          <span className="tabular-nums font-semibold text-gray-900">{k.gsc_position}</span>
                          <span className="text-[10px] font-semibold uppercase tracking-wide px-1 py-0.5 rounded bg-blue-50 text-blue-600">Google</span>
                        </span>
                      ) : k.gsc_related_position != null ? (
                        <span className="inline-flex flex-col items-end" title={`Du syns inte på exakt det här ordet, men på en liknande sökning: "${k.gsc_related_query}" (plats ${k.gsc_related_position}). Siffran gäller den sökningen.`}>
                          <span className="inline-flex items-center gap-1.5">
                            <span className="tabular-nums font-medium text-gray-500">~{k.gsc_related_position}</span>
                            <span className="text-[10px] font-semibold uppercase tracking-wide px-1 py-0.5 rounded bg-amber-50 text-amber-600">liknande</span>
                          </span>
                          <span className="text-[10px] text-gray-400 truncate max-w-[140px]">”{k.gsc_related_query}”</span>
                        </span>
                      ) : (
                        <input
                          type="number"
                          value={k.current_rank ?? ""}
                          onChange={(e) => updateRank(k.id, e.target.value ? parseInt(e.target.value) : null)}
                          placeholder="—"
                          title="Du syns inte på det här ordet (eller något liknande) i Google än. Fyll i en placering själv om du vill."
                          className="w-16 px-2 py-1 rounded border border-gray-200 text-sm text-right tabular-nums outline-none focus:border-gray-400"
                        />
                      )}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums text-emerald-700 font-medium">
                      {(() => { const vals = [k.best_rank, k.gsc_position].filter((v): v is number => typeof v === "number"); return vals.length ? Math.min(...vals) : "—"; })()}
                    </td>
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-1">
                        <a href={`https://www.google.com/search?q=${encodeURIComponent(k.keyword)}&gl=se&hl=sv`} target="_blank" rel="noopener" className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Sök på Google">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <button onClick={() => deleteKeyword(k.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* AEO-tips */}
      <div className="rounded-xl p-5 border" style={{ background: `${primaryColor}08`, borderColor: `${primaryColor}25` }}>
        <h3 className="font-display font-bold text-gray-900 flex items-center gap-2 mb-2">
          <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${primaryColor}1a` }}>
            <Lightbulb className="w-[18px] h-[18px]" style={{ color: primaryColor }} />
          </span>
          Så syns du i AI-sökmotorer
        </h3>
        <ul className="text-sm text-gray-700 space-y-1.5 list-disc pl-5">
          <li>Skriv rubriker (H2/H3) som <strong>frågor</strong> dina kunder faktiskt ställer</li>
          <li>Lägg en <strong>FAQ-sektion</strong> i slutet av varje sida (4–6 frågor)</li>
          <li>Ge ett <strong>direkt svar i första meningen</strong> efter varje rubrik — det är det AI citerar</li>
          <li>Använd punktlistor och tabeller — de citeras oftare</li>
          <li>Visa <strong>uppdaterad-datum</strong> och vem som skrivit (erfarenhet bygger förtroende)</li>
        </ul>
      </div>

      {showAiAudit && <AiAuditModal primaryColor={primaryColor} onClose={() => setShowAiAudit(false)} />}
    </div>
  );
}

function AiAuditModal({ primaryColor, onClose }: { primaryColor: string; onClose: () => void }) {
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ContentAudit | null>(null);

  async function run() {
    setLoading(true);
    try {
      const r = await fetch("/api/seo/content-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url || undefined, text: text || undefined }),
      });
      const d = await r.json();
      if (r.ok) setResult(d);
      else alert("Fel: " + (d.error || "okänt"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-display font-bold text-lg">AI-granskning av text</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 text-xl leading-none">×</button>
        </div>
        <div className="overflow-y-auto p-5">
          <div className="text-sm text-gray-600 mb-3">Klistra in en URL eller texten direkt. AI:n bedömer kvalitet, ton, AI-känsla och konvertering.</div>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="URL (eller klistra text nedan)" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm mb-2 outline-none focus:border-gray-400" />
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="...eller klistra in text direkt" rows={5} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm mb-3 outline-none focus:border-gray-400" />
          <button onClick={run} disabled={loading || (!url && !text)} className="text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 flex items-center gap-2" style={{ background: primaryColor }}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Granska
          </button>
          {result && (
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-4 gap-2">
                <ScoreBox label="Total" v={result.overall_score} />
                <ScoreBox label="Röst" v={result.voice_match_score} />
                <ScoreBox label="Ingen AI" v={result.ai_smell_score} />
                <ScoreBox label="Konv." v={result.conversion_score} />
              </div>
              {result.ai_smell_phrases?.length > 0 && (
                <div className="bg-red-50 border-l-4 border-red-400 p-3 rounded">
                  <div className="text-xs font-bold text-red-700 mb-1">AI-fraser hittade:</div>
                  <div className="flex flex-wrap gap-1">{result.ai_smell_phrases.map((p, i) => <span key={i} className="text-xs bg-white text-red-700 px-2 py-0.5 rounded border border-red-200">{p}</span>)}</div>
                </div>
              )}
              {result.rewrite_priorities?.length > 0 && (
                <div>
                  <div className="text-xs font-bold text-gray-700 uppercase mb-1">Skriv om</div>
                  <div className="space-y-2">
                    {result.rewrite_priorities.map((rw, i) => (
                      <div key={i} className="bg-amber-50 rounded p-2 text-sm">
                        <div className="font-bold text-amber-800">{rw.issue}</div>
                        <div className="text-gray-600 line-through text-xs mt-1">{rw.original}</div>
                        <div className="text-gray-900 text-xs mt-1">→ {rw.rewrite}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {result.next_actions?.length > 0 && (
                <div className="bg-emerald-50 border-l-4 border-emerald-400 p-3 rounded">
                  <div className="text-xs font-bold text-emerald-700 mb-1">Nästa steg</div>
                  <ul className="text-sm text-gray-700 list-disc pl-5 space-y-0.5">{result.next_actions.map((a, i) => <li key={i}>{a}</li>)}</ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


function ScoreBox({ label, v }: { label: string; v: number }) {
  const c = v >= 80 ? "text-emerald-700 bg-emerald-50" : v >= 60 ? "text-amber-700 bg-amber-50" : "text-red-700 bg-red-50";
  return <div className={`rounded-lg p-2 text-center ${c}`}><div className="text-xl font-bold tabular-nums">{v}</div><div className="text-xs opacity-70">{label}</div></div>;
}

function Card({ title, subtitle, children, guide }: { title: string; subtitle?: string; children: React.ReactNode; guide?: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
      <h2 className="font-display font-bold text-gray-900 text-lg leading-tight flex items-center gap-1.5">
        {title}{guide}
      </h2>
      {subtitle && <p className="text-sm text-gray-500 mt-1 mb-4 leading-relaxed">{subtitle}</p>}
      <div className={subtitle ? "" : "mt-4"}>{children}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="text-center text-sm text-gray-400 py-6">{text}</div>;
}

// Liten etikett som ärligt visar vem som gör steget: kunden själv eller byrån (eller båda).
function WhoBadge({ who, primaryColor }: { who: "du" | "vi" | "duvi"; primaryColor: string }) {
  if (who === "du") return <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ background: `${primaryColor}15`, color: primaryColor }}>Du gör</span>;
  if (who === "vi") return <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">Vi gör</span>;
  return <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">Du &amp; vi</span>;
}

function ScoreBadge({ label, value }: { label: string; value: number }) {
  const color = value >= 80 ? "bg-emerald-100 text-emerald-700" : value >= 60 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold tabular-nums ${color}`}>
      <span className="opacity-70">{label}</span>
      <span>{value}</span>
    </span>
  );
}

function Mini({ label, value, ok }: { label: string; value: string | number; ok: boolean }) {
  return (
    <div className={`px-3 py-2 rounded-lg border ${ok ? "bg-emerald-50 border-emerald-100" : "bg-amber-50 border-amber-100"}`}>
      <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
      <div className={`text-sm font-medium ${ok ? "text-emerald-700" : "text-amber-700"}`}>{value}</div>
    </div>
  );
}
