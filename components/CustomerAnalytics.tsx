"use client";

import { useEffect, useState } from "react";
import {
  Eye, Search, TrendingUp, TrendingDown, MousePointerClick, Gauge, Smartphone,
  Repeat, Award, Target, Zap, Loader2, AlertCircle, Trophy, Info, Sparkles,
  ChevronDown, LineChart, Globe, Code2, Copy, Check, ExternalLink, BookOpen,
} from "lucide-react";

// Liten bok-ikon med förklaring (hover/peka) — "vad betyder det här?".
function Hint({ text }: { text: string }) {
  return (
    <span className="relative inline-flex group/hint align-middle ml-1.5" title={text}>
      <BookOpen className="w-3.5 h-3.5 text-gray-300 hover:text-gray-500 cursor-help" />
      <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-60 rounded-lg bg-gray-900 text-white text-xs leading-relaxed px-3 py-2 opacity-0 group-hover/hint:opacity-100 transition-opacity z-30 shadow-lg font-normal normal-case tracking-normal text-left">
        {text}
      </span>
    </span>
  );
}

type Period = 7 | 14 | 30 | 90;

interface Dashboard {
  period: { days: number; since: string; until: string };
  client: { name: string; public_url: string | null } | null;
  kpi: {
    visits: number; pageviews?: number; visits_returning: number; visits_mobile_pct: number; avg_page_load_ms: number | null;
    gsc_clicks: number; gsc_impressions: number; gsc_ctr: number; gsc_avg_position: number | null; gsc_keyword_count: number;
    tracked_keywords: number; audits: number;
  };
  position_distribution: { top3: number; top10: number; top20: number; beyond: number; top3Imp: number; top10Imp: number; top20Imp: number; beyondImp: number };
  position_distribution_queries?: Record<"top3" | "top10" | "top20" | "beyond", Array<{ query: string; clicks: number; impressions: number; avg_position: number | null; ctr: number; page?: string | null }>>;
  brand_split: { brand: { clicks: number; impressions: number }; non_brand: { clicks: number; impressions: number } };
  quick_wins: Array<{ query: string; clicks: number; impressions: number; avg_position: number | null; ctr: number; page?: string | null }>;
  queries_top: Array<{ query: string; clicks: number; impressions: number; avg_position: number | null; ctr: number; page_count: number }>;
  queries_all_count: number;
  top_pages: Array<{ page: string; clicks: number; impressions: number; queryCount: number }>;
  gsc_daily_series?: Array<{ date: string; clicks: number; impressions: number; ctr: number; position: number }>;
  ga4?: {
    property_id: string; sessions: number; users: number; newUsers: number; engagedSessions: number; engagementRate: number; avgSessionSec: number; pageviews: number;
    channels: Array<{ channel: string; sessions: number }>;
    ai: { sessions: number; sources: Array<{ source: string; sessions: number }> };
    daily: Array<{ date: string; sessions: number }>;
  } | null;
  top_paths: Array<{ path: string; visits: number }>;
  top_referrers: Array<{ host: string; visits: number }>;
}

export default function CustomerAnalytics({ primaryColor, clientName, snippet = "" }: { primaryColor: string; clientName: string; snippet?: string }) {
  const [period, setPeriod] = useState<Period>(30);
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"clicks" | "impressions" | "position" | "ctr">("clicks");
  const [openBand, setOpenBand] = useState<"top3" | "top10" | "top20" | "beyond" | null>(null);
  const [copied, setCopied] = useState(false);

  async function load(p: Period) {
    setLoading(true); setError(null);
    try {
      const r = await fetch(`/api/k/dashboard?days=${p}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Kunde inte ladda");
      setData(d);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(period); }, [period]);

  function copySnippet() {
    navigator.clipboard.writeText(snippet).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  if (loading && !data) {
    return <div className="flex items-center gap-2 text-gray-500 text-sm py-16 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Hämtar din statistik…</div>;
  }
  if (error) return <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 text-sm">{error}</div>;
  if (!data) return null;

  const k = data.kpi;
  const pd = data.position_distribution;
  const totalKeywords = pd.top3 + pd.top10 + pd.top20 + pd.beyond;
  const hasGa4 = !!data.ga4;
  const hasGsc = k.gsc_keyword_count > 0;
  const hasVisits = k.visits > 0 || (data.ga4?.sessions ?? 0) > 0;
  const empty = !hasGa4 && !hasGsc && !hasVisits;

  const filtered = data.queries_top
    .filter((q) => !search || q.query.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      switch (sort) {
        case "impressions": return b.impressions - a.impressions;
        case "position": return (a.avg_position ?? 999) - (b.avg_position ?? 999);
        case "ctr": return b.ctr - a.ctr;
        default: return b.clicks - a.clicks;
      }
    });

  // "Att fokusera på" — konkreta förbättringstips ur kundens egen data. Täcker även
  // tidiga sajter (syns men lågt, få klick) så det ALLTID finns ett nästa steg.
  const insights: { icon: typeof Trophy; accent: string; title: string; detail: string }[] = [];
  const qw0 = data.quick_wins[0];
  const totImp = k.gsc_impressions, totClk = k.gsc_clicks, avgPos = k.gsc_avg_position, kwCount = k.gsc_keyword_count;
  // Närmaste riktiga klättrings-möjlighet: lägst placering men utanför topp 3 (inte redan etta).
  const bestKw = data.queries_top.filter((q) => q.avg_position != null && q.avg_position > 3).sort((a, b) => (a.avg_position! - b.avg_position!))[0];

  if (qw0) insights.push({ icon: Trophy, accent: "amber", title: `"${qw0.query}" är din snabbaste möjlighet`, detail: `Du syns redan på plats ${qw0.avg_position} (${qw0.impressions.toLocaleString("sv-SE")} visningar). Lyfts sidan till topp 3 ger det ungefär ${Math.round(qw0.impressions * 0.25)} fler besök i månaden.` });
  if (pd.top20 > 0) insights.push({ icon: Target, accent: "blue", title: `${pd.top20} sökord ligger på sida 2 i Google`, detail: `De är närmast att nå sida 1. Öppna "Var rankar du på Google" nedan och titta på bandet 11–20.` });
  if (totImp > 0 && totClk === 0) insights.push({ icon: MousePointerClick, accent: "pink", title: "Du syns i Google men får inga klick än", detail: "Din sajt visas i sökresultaten men ingen har klickat. Skriv mer lockande sidtitlar och beskrivningar — och jobba dig uppåt i placering — så blir visningar till besök." });
  if (avgPos !== null && avgPos > 15 && bestKw) insights.push({ icon: TrendingUp, accent: "blue", title: `Du ligger lågt i Google (snitt plats ${avgPos})`, detail: `Du syns men långt ner. Innehåll som svarar tydligare på frågan lyfter dig uppåt. Närmast toppen: "${bestKw.query}" (plats ${bestKw.avg_position}).` });
  if (kwCount > 0 && kwCount < 20) insights.push({ icon: Search, accent: "emerald", title: `Du syns på ${kwCount} sökord`, detail: `Fler sidor och inlägg om dina ämnen ger fler vägar in. Klicka "Vad ska du ranka på?" på SEO & AEO-sidan för förslag.` });
  const bClicks = data.brand_split.brand.clicks;
  const totClicks = bClicks + data.brand_split.non_brand.clicks;
  if (totClicks >= 5 && bClicks / totClicks > 0.7) insights.push({ icon: Repeat, accent: "purple", title: `${Math.round((bClicks / totClicks) * 100)}% av klicken kommer från ditt eget namn`, detail: `Du hittas mest av folk som redan känner till dig. Mer innehåll om det du erbjuder når nya kunder.` });
  if (hasGa4 && data.ga4!.ai.sessions === 0) insights.push({ icon: Sparkles, accent: "violet", title: "Inga besök från AI-sökmotorer än", detail: "ChatGPT, Copilot och Perplexity skickar inga besök ännu. Tydliga svar, jämförelser och konkreta siffror gör att de börjar tipsa om dig." });
  // Säkerställ alltid minst ett konkret nästa steg.
  if (insights.length === 0) insights.push({ icon: Sparkles, accent: "emerald", title: "Fyll i din Brand-profil", detail: "Ju mer ifylld din profil är (din röst, ditt erbjudande, dina kunder), desto skarpare blir sökords-förslagen och allt AI skapar åt dig." });
  const topInsights = insights.slice(0, 3);

  return (
    <div className="space-y-8 pb-12">
      {/* Rubrik + period */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900 flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${primaryColor}1a` }}>
              <LineChart className="w-[18px] h-[18px]" style={{ color: primaryColor }} />
            </span>
            Din statistik
          </h1>
          <p className="text-gray-500 text-sm mt-1">Besök, synlighet i Google och AI-sökmotorer — allt på ett ställe.</p>
        </div>
        {!empty && (
          <div className="flex items-center gap-1.5 bg-white border border-gray-100 rounded-xl p-1 shadow-sm">
            {([7, 14, 30, 90] as Period[]).map((p) => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-sm rounded-lg font-medium transition tabular-nums ${period === p ? "text-white shadow-sm" : "text-gray-600 hover:bg-gray-50"}`}
                style={period === p ? { background: primaryColor } : undefined}>
                {p}d
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tomt läge — visa hur man kommer igång */}
      {empty && snippet && (
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2.5 mb-1">
            <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${primaryColor}1a` }}>
              <Code2 className="w-[18px] h-[18px]" style={{ color: primaryColor }} />
            </span>
            <h2 className="font-display font-bold text-gray-900 text-lg">Så får du igång din statistik</h2>
          </div>
          <p className="text-sm text-gray-500 mb-4">Lägg in den här lilla koden i <code className="px-1 py-0.5 rounded bg-gray-100 text-gray-700 text-xs">&lt;head&gt;</code> på din sajt — en gång. Sen fylls allt i automatiskt.</p>
          <div className="relative">
            <pre className="bg-gray-900 text-gray-100 text-xs rounded-xl p-4 overflow-x-auto leading-relaxed">{snippet}</pre>
            <button onClick={copySnippet} className="absolute top-3 right-3 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors">
              {copied ? <><Check className="w-3.5 h-3.5" /> Kopierad</> : <><Copy className="w-3.5 h-3.5" /> Kopiera</>}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-3">Vet du inte var koden ska in? Skicka den till den som sköter din hemsida — eller hör av dig så hjälper vi till.</p>
        </div>
      )}

      {!empty && (
        <>
          {/* KPI-RAD — anpassad efter vilken data som faktiskt finns (inga tomma nollor) */}
          {hasGa4 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <KPI icon={TrendingUp} primary={primaryColor} label="Besök" value={data.ga4!.sessions} sub={`${data.ga4!.users.toLocaleString("sv-SE")} personer`} hint="Antal besök på din sajt under perioden (från Google Analytics)." />
              <KPI icon={Search} accent="emerald" label="Från Google-sök" value={k.gsc_clicks} sub={`plats ${k.gsc_avg_position ?? "—"} i snitt`} hint="Besök som kom via en sökning på Google." />
              <KPI icon={Sparkles} accent="violet" label="Från AI-sök" value={data.ga4!.ai.sessions} sub="ChatGPT m.fl." hint="Besök från AI-tjänster som ChatGPT, Copilot och Perplexity." />
              <KPI icon={Eye} accent="blue" label="Visningar i Google" value={k.gsc_impressions} sub={`${k.gsc_keyword_count} sökord`} hint="Hur många gånger din sajt visats i Googles sökresultat." />
              <KPI icon={Award} accent="amber" label="Snitt-plats Google" value={k.gsc_avg_position ?? "—"} sub="lägre = bättre" hint="Din genomsnittliga placering i Google. Lägre siffra = högre upp = bättre. Plats 1–10 = sida 1." />
              <KPI icon={Zap} accent="teal" label="Engagemang" value={`${data.ga4!.engagementRate}%`} sub={`${Math.floor(data.ga4!.avgSessionSec / 60)}m ${data.ga4!.avgSessionSec % 60}s i snitt`} hint="Andel besök där någon faktiskt läste eller klickade — inte bara stängde direkt." />
            </div>
          ) : hasGsc ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KPI icon={TrendingUp} primary={primaryColor} label="Besök" value={k.visits} sub={k.pageviews != null ? `${k.pageviews.toLocaleString("sv-SE")} sidvisningar` : ""} hint="Antal besök på din sajt (från mätpixeln på sidan)." />
              <KPI icon={MousePointerClick} accent="emerald" label="Klick från Google" value={k.gsc_clicks} sub={`CTR ${k.gsc_ctr}%`} hint="Hur många som klickat in på din sajt från Googles sökresultat. CTR = andel som klickade av de som såg dig." />
              <KPI icon={Eye} accent="blue" label="Visningar i Google" value={k.gsc_impressions} sub={`${k.gsc_keyword_count} sökord`} hint="Hur många gånger din sajt visats i Googles sökresultat, och på hur många olika sökord." />
              <KPI icon={Award} accent="amber" label="Snitt-plats Google" value={k.gsc_avg_position ?? "—"} sub="lägre = bättre" hint="Din genomsnittliga placering i Google. Lägre siffra = högre upp = bättre. Plats 1–10 = sida 1." />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <KPI icon={TrendingUp} primary={primaryColor} label="Besök" value={k.visits} sub="senaste 30 dagarna" hint="Antal besök på din sajt under perioden (mätt via spårningspixeln)." />
                <KPI icon={Eye} accent="blue" label="Sidvisningar" value={k.pageviews ?? k.visits} sub="totalt" hint="Hur många sidor som visats totalt — en besökare kan titta på flera sidor." />
                <KPI icon={Repeat} accent="purple" label="Återkommande" value={k.visits_returning} sub="kom tillbaka" hint="Besökare som varit inne hos dig tidigare och kommit tillbaka." />
              </div>
              <div className="flex items-start gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-4">
                <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${primaryColor}1a` }}>
                  <Search className="w-[18px] h-[18px]" style={{ color: primaryColor }} />
                </span>
                <div className="text-sm text-gray-600">
                  <strong className="text-gray-900">Google-sökstatistik kopplas på.</strong> Så snart kopplingen är klar fylls sökord, klick och placeringar i här automatiskt. Besöksdatan nedan mäts redan via pixeln på din sajt.
                </div>
              </div>
            </>
          )}

          {/* ATT FOKUSERA PÅ */}
          {topInsights.length > 0 && (
            <section className="space-y-3">
              <h2 className="font-display font-bold text-gray-900 text-lg flex items-center gap-2">
                <Zap className="w-5 h-5" style={{ color: primaryColor }} /> Att fokusera på<Hint text="De viktigaste sakerna att jobba med just nu — uträknat ur din egen data." />
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {topInsights.map((a, i) => {
                  const Icon = a.icon;
                  return (
                    <div key={i} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                      <span className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${ACCENTS[a.accent] || ACCENTS.gray}`}><Icon className="w-[18px] h-[18px]" /></span>
                      <div className="text-sm font-semibold text-gray-900">{a.title}</div>
                      <div className="text-xs text-gray-600 mt-1 leading-relaxed">{a.detail}</div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* KANALER + AI-SYNLIGHET */}
          {hasGa4 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                <h2 className="font-display font-bold text-gray-900 flex items-center gap-2 mb-1"><Repeat className="w-4 h-4 text-indigo-600" /> Var kommer besökarna ifrån<Hint text="Hur dina besökare hittade dig: direkt, via Google, sociala medier, länkar m.m." /></h2>
                <p className="text-xs text-gray-500 mb-4">Totalt {data.ga4!.sessions.toLocaleString("sv-SE")} besök under perioden.</p>
                <div className="space-y-2.5">
                  {data.ga4!.channels.map((c) => {
                    const pct = data.ga4!.sessions > 0 ? Math.round((c.sessions / data.ga4!.sessions) * 100) : 0;
                    return (
                      <div key={c.channel}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-medium text-gray-700">{channelSv(c.channel)}</span>
                          <span className="text-gray-500"><strong className="text-gray-900 tabular-nums">{c.sessions}</strong> · {pct}%</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: primaryColor }} /></div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                <h2 className="font-display font-bold text-gray-900 flex items-center gap-2 mb-1"><Sparkles className="w-4 h-4 text-violet-600" /> Syns du i AI-sök?<Hint text="Besök från AI-tjänster (ChatGPT, Copilot, Perplexity). En kanal som växer snabbt 2026." /></h2>
                <p className="text-xs text-gray-500 mb-3">Besök från ChatGPT, Copilot, Perplexity och Gemini. En kanal som växer snabbt.</p>
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="text-4xl font-bold font-display tabular-nums text-violet-700">{data.ga4!.ai.sessions}</span>
                  <span className="text-sm text-gray-500">besök från AI</span>
                </div>
                {data.ga4!.ai.sources.length > 0 ? (
                  <div className="space-y-1.5">
                    {data.ga4!.ai.sources.map((s) => (
                      <div key={s.source} className="flex items-center justify-between text-sm bg-violet-50/60 rounded-lg px-3 py-1.5">
                        <span className="font-medium text-gray-800">{s.source}</span>
                        <span className="tabular-nums text-gray-600">{s.sessions}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3">Inga AI-besök ännu. Tydliga svar och jämförelser på sajten gör att AI-motorerna börjar tipsa om dig.</p>
                )}
              </div>
            </div>
          )}

          {/* UTVECKLING ÖVER TID */}
          {((data.gsc_daily_series?.length ?? 0) >= 2 || (data.ga4 && data.ga4.daily.length >= 2)) && (
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
              <h2 className="font-display font-bold text-gray-900 flex items-center gap-2 mb-1"><LineChart className="w-4 h-4 text-indigo-600" /> Utveckling över tid<Hint text="Hur dina siffror rör sig dag för dag. För 'Plats i Google' gäller att linjen uppåt betyder att du klättrar (lägre placering är bättre)." /></h2>
              <p className="text-xs text-gray-500 mb-4">Dag för dag. För plats gäller: linjen uppåt = du klättrar (lägre siffra är bättre).</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                {data.ga4 && data.ga4.daily.length >= 2 && (
                  <TrendChart id="ga4sess" label="Besök" color={primaryColor} data={data.ga4.daily.map((d) => ({ date: d.date, value: d.sessions }))} fmt={(v) => Math.round(v).toLocaleString("sv-SE")} />
                )}
                <TrendChart id="pos" label="Plats i Google" color="#4f46e5" invert data={(data.gsc_daily_series ?? []).filter((d) => d.position > 0).map((d) => ({ date: d.date, value: d.position }))} fmt={(v) => v.toFixed(1)} />
                <TrendChart id="clk" label="Klick" color="#059669" data={(data.gsc_daily_series ?? []).map((d) => ({ date: d.date, value: d.clicks }))} fmt={(v) => Math.round(v).toString()} />
                <TrendChart id="imp" label="Visningar" color="#2563eb" data={(data.gsc_daily_series ?? []).map((d) => ({ date: d.date, value: d.impressions }))} fmt={(v) => Math.round(v).toLocaleString("sv-SE")} />
              </div>
            </div>
          )}

          {/* POSITION + BRAND */}
          {hasGsc && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                <h2 className="font-display font-bold text-gray-900 flex items-center gap-2 mb-3"><Target className="w-4 h-4 text-emerald-600" /> Var rankar du på Google<Hint text="Hur dina sökord fördelar sig på Googles placeringar. Topp 3 = sida 1 högst upp. Sida 2 (11–20) är närmast att lyfta till sida 1." /></h2>
                <div className="space-y-1">
                  {([
                    { band: "top3" as const, label: "Topp 3", count: pd.top3, imp: pd.top3Imp, color: "bg-emerald-500" },
                    { band: "top10" as const, label: "Topp 4–10", count: pd.top10, imp: pd.top10Imp, color: "bg-blue-500" },
                    { band: "top20" as const, label: "Sida 2 (11–20)", count: pd.top20, imp: pd.top20Imp, color: "bg-amber-500" },
                    { band: "beyond" as const, label: "21+", count: pd.beyond, imp: pd.beyondImp, color: "bg-gray-400" },
                  ]).map((b) => (
                    <div key={b.band}>
                      <PosBar label={b.label} count={b.count} imp={b.imp} total={totalKeywords} color={b.color} active={openBand === b.band} onClick={() => setOpenBand(openBand === b.band ? null : b.band)} />
                      {openBand === b.band && <BandKeywords queries={data.position_distribution_queries?.[b.band] ?? []} />}
                    </div>
                  ))}
                </div>
                <div className="text-xs text-gray-500 mt-3 flex items-center gap-1"><Info className="w-3 h-3" /> Klicka på ett band för att se sökorden.</div>
              </div>

              <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                <h2 className="font-display font-bold text-gray-900 flex items-center gap-2 mb-3"><Repeat className="w-4 h-4 text-purple-600" /> Ditt namn vs nya kunder<Hint text="Söker folk på ditt namn (kände redan till dig) eller på det du erbjuder (nya kunder)? Mycket 'nya kunder' = du växer." /></h2>
                {(data.brand_split.brand.impressions + data.brand_split.non_brand.impressions) > 0 ? (
                  <div className="space-y-3">
                    <BrandRow label="Nya kunder (sökte på det du erbjuder)" clicks={data.brand_split.non_brand.clicks} imp={data.brand_split.non_brand.impressions} color="text-emerald-700" />
                    <BrandRow label="Kände redan till dig (sökte ditt namn)" clicks={data.brand_split.brand.clicks} imp={data.brand_split.brand.impressions} color="text-blue-700" />
                    <div className="text-xs text-gray-500 mt-2">Många "nya kunder" = du hittas av folk som inte kände till dig sen innan. Det är så du växer.</div>
                  </div>
                ) : <div className="text-sm text-gray-400">Ingen data ännu.</div>}
              </div>
            </div>
          )}

          {/* SÖKNINGAR SOM GAV KLICK — premium rankad lista med staplar */}
          {data.queries_top.some((q) => q.clicks > 0) && (() => {
            const rows = data.queries_top.filter((q) => q.clicks > 0).sort((a, b) => b.clicks - a.clicks).slice(0, 15);
            const maxClicks = Math.max(...rows.map((q) => q.clicks), 1);
            return (
              <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                <h2 className="font-display font-bold text-gray-900 flex items-center gap-2 mb-1"><MousePointerClick className="w-4 h-4 text-emerald-600" /> Vad folk sökte när de hittade dig<Hint text="De exakta orden folk skrev i Google innan de såg/klickade på din sajt." /></h2>
                <p className="text-xs text-gray-500 mb-4">De exakta orden folk skrev i Google innan de klickade in på din sajt.</p>
                <div className="space-y-3">
                  {rows.map((q, i) => (
                    <div key={i} className="group">
                      <div className="flex items-baseline justify-between gap-3 mb-1.5">
                        <span className="font-medium text-gray-900 text-sm truncate flex items-center gap-2">
                          <span className="text-xs tabular-nums text-gray-300 font-bold w-5">{i + 1}</span>
                          {q.query}
                        </span>
                        <span className="flex items-center gap-2.5 flex-shrink-0">
                          <PosPill pos={q.avg_position} />
                          <span className="text-sm font-bold tabular-nums" style={{ color: primaryColor }}>{q.clicks}</span>
                          <span className="text-xs text-gray-400">klick</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2 pl-7">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(4, (q.clicks / maxClicks) * 100)}%`, background: `linear-gradient(90deg, ${primaryColor}cc, ${primaryColor})` }} />
                        </div>
                        <span className="text-xs text-gray-400 tabular-nums w-24 text-right">{q.impressions.toLocaleString("sv-SE")} visningar</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* SNABBASTE VINSTERNA — premium kort-rutnät */}
          {data.quick_wins.length > 0 && (
            <div className="bg-gradient-to-br from-amber-50/60 to-white border border-amber-100 rounded-2xl p-6 shadow-sm">
              <h2 className="font-display font-bold text-gray-900 flex items-center gap-2 mb-1"><Trophy className="w-4 h-4 text-amber-600" /> Dina snabbaste möjligheter<Hint text="Sökord där du redan syns men ligger precis utanför topp 3. Lyfts sidan klättrar du oftast flera placeringar — störst effekt för minst jobb." /></h2>
              <p className="text-xs text-gray-500 mb-4">Sökord där du redan syns men ligger precis utanför topp 3. Lyfts sidan klättrar du oftast flera placeringar.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {data.quick_wins.slice(0, 9).map((q, i) => (
                  <div key={i} className="bg-white border border-amber-100 rounded-xl p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <span className="font-semibold text-gray-900 text-sm leading-snug">{q.query}</span>
                      <PosPill pos={q.avg_position} />
                    </div>
                    <div className="flex items-end justify-between">
                      <div>
                        <div className="text-2xl font-bold font-display text-emerald-600 tabular-nums leading-none">+{Math.round(q.impressions * 0.25)}</div>
                        <div className="text-xs text-gray-400 mt-1">möjliga besök/mån</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-gray-700 tabular-nums">{q.impressions.toLocaleString("sv-SE")}</div>
                        <div className="text-xs text-gray-400">visningar</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-sm text-gray-700 bg-white border border-amber-100 rounded-xl p-3.5 mt-4 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500 flex-shrink-0" />
                Vill du att vi optimerar sidorna för de här sökorden? Hör av dig så fixar vi det.
              </div>
            </div>
          )}

          {/* SIDOR SOM RANKAR BÄST */}
          {data.top_pages.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
              <h2 className="font-display font-bold text-gray-900 mb-3">Sidor som syns bäst i Google<Hint text="Vilka av dina sidor som får flest visningar och klick från Google-sök. Hjälper dig se vilket innehåll som drar — och var det är värt att lägga krut." /></h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                    <th className="py-2 px-2 font-medium">Sida</th><th className="py-2 px-2 font-medium text-right">Klick</th><th className="py-2 px-2 font-medium text-right">Visningar</th><th className="py-2 px-2 font-medium text-right">Sökord</th>
                  </tr></thead>
                  <tbody>
                    {data.top_pages.slice(0, 12).map((p, i) => (
                      <tr key={i} className="border-b border-gray-50">
                        <td className="py-2 px-2"><a href={p.page} target="_blank" rel="noopener" className="text-blue-600 hover:underline truncate inline-block max-w-md">{p.page.replace(/^https?:\/\//, "")}</a></td>
                        <td className="py-2 px-2 text-right tabular-nums">{p.clicks}</td>
                        <td className="py-2 px-2 text-right tabular-nums">{p.impressions.toLocaleString("sv-SE")}</td>
                        <td className="py-2 px-2 text-right tabular-nums text-gray-500">{p.queryCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* PIXEL: MEST BESÖKTA + KÄLLOR — med staplar */}
          {data.top_paths.length > 0 && (() => {
            const maxPath = Math.max(...data.top_paths.map((p) => p.visits), 1);
            const maxRef = Math.max(...data.top_referrers.map((r) => r.visits), 1);
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                  <h2 className="font-display font-bold text-gray-900 mb-4">Mest besökta sidor<Hint text="De sidor på din sajt som fått flest besök, mätt via spårningspixeln. Visar var dina besökare faktiskt landar." /></h2>
                  <ul className="space-y-3">
                    {data.top_paths.slice(0, 8).map((p, i) => (
                      <li key={i}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-gray-700 truncate font-mono text-xs" title={p.path}>{p.path || "/"}</span>
                          <span className="text-gray-900 font-semibold tabular-nums">{p.visits}</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.max(4, (p.visits / maxPath) * 100)}%`, background: primaryColor }} /></div>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                  <h2 className="font-display font-bold text-gray-900 mb-4">Var trafiken kommer ifrån<Hint text="Vilka sajter dina besökare kom från (länkar, sociala medier, andra sidor). 'Direkt' betyder att de skrev in din adress eller hade dig sparad." /></h2>
                  {data.top_referrers.length === 0 ? <p className="text-sm text-gray-400 py-4">Mest direkta besök än så länge — folk skriver in din adress eller har dig sparad.</p> : (
                    <ul className="space-y-3">
                      {data.top_referrers.slice(0, 8).map((r, i) => (
                        <li key={i}>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-gray-700 truncate flex items-center gap-1.5" title={r.host}><ExternalLink className="w-3 h-3 text-gray-400" /> {r.host}</span>
                            <span className="text-gray-900 font-semibold tabular-nums">{r.visits}</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full rounded-full bg-indigo-400" style={{ width: `${Math.max(4, (r.visits / maxRef) * 100)}%` }} /></div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            );
          })()}

          {/* ALLA SÖKORD */}
          {hasGsc && (
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <h2 className="font-display font-bold text-gray-900 flex items-center gap-2"><Search className="w-4 h-4 text-emerald-600" /> Alla dina sökord ({data.queries_all_count})<Hint text="Alla sökord folk faktiskt sökte på i Google och då fick se din sajt — hämtat direkt från Google Search Console. Klick = antal som klickade in, Visningar = hur ofta du visades, CTR = andel som klickade, Plats = din snittplacering (lägre = bättre). Skiljer sig från Sökords-trackern på SEO & AEO-sidan, där du själv lägger till ord att följa." /></h2>
                <div className="flex items-center gap-2">
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Sök i listan…" className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 focus:border-gray-400 focus:ring-2 focus:ring-gray-100 outline-none w-48" />
                  <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 bg-white">
                    <option value="clicks">Mest klick</option>
                    <option value="impressions">Mest visningar</option>
                    <option value="position">Bästa plats</option>
                    <option value="ctr">Bästa CTR</option>
                  </select>
                </div>
              </div>
              <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white"><tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                    <th className="py-2 px-2 font-medium">Sökord</th><th className="py-2 px-2 font-medium text-right">Klick</th><th className="py-2 px-2 font-medium text-right">Visningar</th><th className="py-2 px-2 font-medium text-right">CTR</th><th className="py-2 px-2 font-medium text-right">Plats</th>
                  </tr></thead>
                  <tbody>
                    {filtered.length === 0 ? <tr><td colSpan={5} className="py-6 text-center text-gray-400">Inga sökord matchar.</td></tr> : filtered.slice(0, 200).map((q, i) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="py-2 px-2 font-medium text-gray-900">{q.query}</td>
                        <td className="py-2 px-2 text-right tabular-nums text-gray-700">{q.clicks}</td>
                        <td className="py-2 px-2 text-right tabular-nums text-gray-700">{q.impressions.toLocaleString("sv-SE")}</td>
                        <td className="py-2 px-2 text-right tabular-nums text-gray-500">{q.ctr}%</td>
                        <td className="py-2 px-2 text-right tabular-nums">
                          <span className={q.avg_position === null ? "text-gray-400" : q.avg_position <= 3 ? "text-emerald-700 font-bold" : q.avg_position <= 10 ? "text-blue-700 font-semibold" : q.avg_position <= 20 ? "text-amber-700" : "text-gray-500"}>{q.avg_position ?? "—"}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <p className="text-xs text-gray-400 text-center">{clientName} · {data.period.days} dagar</p>
        </>
      )}
    </div>
  );
}

const ACCENTS: Record<string, string> = {
  gray: "bg-gray-100 text-gray-600", amber: "bg-amber-100 text-amber-600", emerald: "bg-emerald-100 text-emerald-600",
  purple: "bg-purple-100 text-purple-600", blue: "bg-blue-100 text-blue-600", violet: "bg-violet-100 text-violet-600",
  pink: "bg-pink-100 text-pink-600", teal: "bg-teal-100 text-teal-600",
};

function KPI({ icon: Icon, label, value, sub, accent, primary, hint }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number | string; sub?: string; accent?: string; primary?: string; hint?: string }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
      <span className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={primary ? { background: `${primary}1a`, color: primary } : undefined}>
        {primary ? <Icon className="w-[18px] h-[18px]" /> : <span className={`w-9 h-9 -m-0 rounded-xl flex items-center justify-center ${ACCENTS[accent || "gray"]}`}><Icon className="w-[18px] h-[18px]" /></span>}
      </span>
      <div className="text-2xl font-bold font-display text-gray-900 tabular-nums leading-tight">{typeof value === "number" ? value.toLocaleString("sv-SE") : value}</div>
      <div className="text-xs text-gray-500 mt-0.5 flex items-center">{label}{hint && <Hint text={hint} />}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

// Färgad placerings-badge — grön topp 3, blå topp 10, amber sida 2, grå längre ner.
function PosPill({ pos }: { pos: number | null }) {
  if (pos === null) return <span className="text-xs text-gray-400">—</span>;
  const tone = pos <= 3 ? "bg-emerald-50 text-emerald-700" : pos <= 10 ? "bg-blue-50 text-blue-700" : pos <= 20 ? "bg-amber-50 text-amber-700" : "bg-gray-100 text-gray-500";
  return <span className={`inline-flex items-center text-xs font-bold tabular-nums px-2 py-0.5 rounded-full ${tone}`}>plats {pos}</span>;
}

function PosBar({ label, count, imp, total, color, active, onClick }: { label: string; count: number; imp: number; total: number; color: string; active?: boolean; onClick?: () => void }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <button type="button" onClick={onClick} className={`w-full text-left rounded-lg px-2 py-1.5 -mx-2 transition-colors ${active ? "bg-gray-50 ring-1 ring-gray-200" : "hover:bg-gray-50"} ${count > 0 ? "cursor-pointer" : "cursor-default"}`}>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="font-medium text-gray-700 flex items-center gap-1"><ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${active ? "rotate-180" : ""}`} />{label}</span>
        <span className="text-gray-500"><strong className="text-gray-900 tabular-nums">{count}</strong> sökord · {imp.toLocaleString("sv-SE")} visn.</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} /></div>
    </button>
  );
}

function BandKeywords({ queries }: { queries: Array<{ query: string; clicks: number; impressions: number; avg_position: number | null; ctr: number; page?: string | null }> }) {
  if (queries.length === 0) return <div className="mt-2 mb-1 text-xs text-gray-400 px-1">Inga sökord i detta band.</div>;
  return (
    <div className="mt-2 mb-2 border border-gray-100 rounded-lg bg-gray-50/50 p-2">
      <div className="text-xs text-gray-500 mb-1 px-1">{queries.length} sökord — störst möjlighet först</div>
      <div className="max-h-64 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="text-gray-400 sticky top-0 bg-gray-50"><tr>
            <th className="text-left font-medium py-1 px-1">Sökord</th><th className="text-right font-medium px-1">Plats</th><th className="text-right font-medium px-1">Visn.</th><th className="text-right font-medium px-1">Klick</th>
          </tr></thead>
          <tbody>
            {queries.map((q, i) => (
              <tr key={i} className="border-t border-gray-100">
                <td className="py-1.5 px-1 text-gray-800">{q.query}</td>
                <td className="py-1.5 px-1 text-right tabular-nums text-gray-600">{q.avg_position ?? "—"}</td>
                <td className="py-1.5 px-1 text-right tabular-nums text-gray-600">{q.impressions.toLocaleString("sv-SE")}</td>
                <td className="py-1.5 px-1 text-right tabular-nums text-gray-600">{q.clicks}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TrendChart({ id, label, color, data, invert, fmt }: { id: string; label: string; color: string; data: Array<{ date: string; value: number }>; invert?: boolean; fmt: (v: number) => string }) {
  const pts = data.filter((d) => Number.isFinite(d.value));
  if (pts.length < 2) {
    return <div><div className="text-xs font-medium text-gray-700 mb-1">{label}</div><div className="h-24 flex items-center justify-center text-xs text-gray-400 bg-gray-50 rounded-lg">För få datapunkter ännu</div></div>;
  }
  const W = 300, H = 96, padT = 8, padB = 14, padX = 2;
  const vals = pts.map((p) => p.value);
  let min = Math.min(...vals), max = Math.max(...vals);
  if (min === max) { min -= 1; max += 1; }
  const span = max - min;
  const xAt = (i: number) => padX + (i / (pts.length - 1)) * (W - padX * 2);
  const yAt = (v: number) => { const t = (v - min) / span; const tt = invert ? t : 1 - t; return padT + tt * (H - padT - padB); };
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${xAt(i).toFixed(1)},${yAt(p.value).toFixed(1)}`).join(" ");
  const area = `${line} L${xAt(pts.length - 1).toFixed(1)},${(H - padB).toFixed(1)} L${xAt(0).toFixed(1)},${(H - padB).toFixed(1)} Z`;
  const first = pts[0], last = pts[pts.length - 1];
  const delta = last.value - first.value;
  const improved = invert ? delta < 0 : delta > 0;
  const flat = Math.abs(delta) < (invert ? 0.1 : 0.5);
  const shortDate = (d: string) => { const p = d.slice(5).split("-"); return p.length === 2 ? `${parseInt(p[1], 10)}/${parseInt(p[0], 10)}` : d; };
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-xs font-medium text-gray-700">{label}</span>
        <span className="text-sm font-bold text-gray-900 tabular-nums">{fmt(last.value)}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 88 }} preserveAspectRatio="none">
        <defs><linearGradient id={`cgrad-${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.18" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
        <path d={area} fill={`url(#cgrad-${id})`} />
        <path d={line} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <circle cx={xAt(pts.length - 1)} cy={yAt(last.value)} r="2.6" fill={color} />
      </svg>
      <div className="flex items-center justify-between mt-1 text-xs text-gray-400">
        <span>{shortDate(first.date)}</span>
        <span className={`flex items-center gap-0.5 font-medium ${flat ? "text-gray-400" : improved ? "text-emerald-600" : "text-red-500"}`}>
          {!flat && (improved ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />)}
          {flat ? "oförändrat" : improved ? "förbättras" : "försämras"}
        </span>
        <span>{shortDate(last.date)}</span>
      </div>
    </div>
  );
}

function BrandRow({ label, clicks, imp, color }: { label: string; clicks: number; imp: number; color: string }) {
  return (
    <div className="flex items-center justify-between border-b border-gray-100 pb-2">
      <span className="text-sm text-gray-700">{label}</span>
      <div className="text-right"><div className={`text-sm font-bold ${color} tabular-nums`}>{clicks} klick</div><div className="text-xs text-gray-500 tabular-nums">{imp.toLocaleString("sv-SE")} visningar</div></div>
    </div>
  );
}

function channelSv(ch: string): string {
  const map: Record<string, string> = {
    "Direct": "Direkt", "Organic Search": "Organisk sök", "Paid Search": "Betald sök", "Display": "Display",
    "Paid Social": "Betald social", "Organic Social": "Social", "Email": "Mejl", "Affiliates": "Affiliate",
    "Referral": "Hänvisning", "Organic Video": "Video", "Paid Video": "Betald video", "Organic Shopping": "Shopping",
    "Paid Shopping": "Betald shopping", "Unassigned": "Okänd", "Cross-network": "Cross-network", "Audio": "Audio",
    "SMS": "SMS", "Mobile Push Notifications": "Push",
  };
  return map[ch] || ch;
}
