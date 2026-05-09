"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Eye, Search, TrendingUp, MousePointerClick, Gauge, Smartphone, Repeat, Award, Target, Zap, ExternalLink, Loader2, RefreshCw, AlertCircle, Trophy, Info, FileText, BookOpen, X, Copy, Check, Sparkles } from "lucide-react";

type Period = 7 | 14 | 30 | 90;

interface Dashboard {
  period: { days: number; since: string; until: string };
  client: { name: string; public_url: string | null } | null;
  gsc_last_sync: { imported_at: string | null; period_start: string | null; period_end: string | null } | null;
  kpi: {
    visits: number;
    visits_returning: number;
    visits_mobile_pct: number;
    avg_page_load_ms: number | null;
    gsc_clicks: number;
    gsc_impressions: number;
    gsc_ctr: number;
    gsc_avg_position: number | null;
    gsc_keyword_count: number;
    tracked_keywords: number;
    audits: number;
  };
  position_distribution: { top3: number; top10: number; top20: number; beyond: number; top3Imp: number; top10Imp: number; top20Imp: number; beyondImp: number };
  brand_split: { brand: { clicks: number; impressions: number }; non_brand: { clicks: number; impressions: number } };
  quick_wins: Array<{ query: string; clicks: number; impressions: number; avg_position: number | null; ctr: number }>;
  queries_top: Array<{ query: string; clicks: number; impressions: number; avg_position: number | null; ctr: number; page_count: number }>;
  queries_all_count: number;
  top_pages: Array<{ page: string; clicks: number; impressions: number; queryCount: number }>;
  traffic_series: Array<{ date: string; visits: number }>;
  top_paths: Array<{ path: string; visits: number }>;
  top_referrers: Array<{ host: string; visits: number }>;
  tracked_keywords: Array<{ id: string; keyword: string; current_rank: number | null; best_rank: number | null }>;
  recent_audits: Array<{ id: string; url: string; seo_score: number; aeo_score: number; audited_at: string }>;
}

export default function AnalyticsDashboard() {
  const [period, setPeriod] = useState<Period>(30);
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"clicks" | "impressions" | "position" | "ctr">("clicks");
  const [syncing, setSyncing] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportText, setReportText] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [showHandbok, setShowHandbok] = useState(false);
  const [savedReports, setSavedReports] = useState<Array<{ id: string; body: string; metadata: { url?: string; generated_at?: string }; created_at: string }>>([]);
  const [copied, setCopied] = useState(false);

  async function load(p: Period) {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/analytics/dashboard?days=${p}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Kunde inte ladda");
      setData(d);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(period);
    fetch("/api/analytics/deep-audit").then((r) => r.json()).then((d) => setSavedReports(d.reports ?? [])).catch(() => {});
  }, [period]);

  async function generateReport() {
    setGeneratingReport(true);
    setReportError(null);
    setReportText(null);
    setReportOpen(true);
    try {
      const r = await fetch("/api/analytics/deep-audit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Kunde inte generera");
      setReportText(d.report);
      const refresh = await fetch("/api/analytics/deep-audit").then((rr) => rr.json());
      setSavedReports(refresh.reports ?? []);
    } catch (e) {
      setReportError((e as Error).message);
    } finally {
      setGeneratingReport(false);
    }
  }

  function copyReport() {
    if (!reportText) return;
    navigator.clipboard.writeText(reportText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function downloadReport() {
    if (!reportText) return;
    const blob = new Blob([reportText], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `seo-aeo-rapport-${data?.client?.name?.toLowerCase().replace(/\s+/g, "-") ?? "klient"}-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function syncGsc(days: number) {
    setSyncing(true);
    try {
      const r = await fetch("/api/google/gsc/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days }),
      });
      const d = await r.json();
      if (r.ok) {
        await load(period);
      } else {
        setError("Sync-fel: " + (d.error || "okänt"));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  if (loading && !data) {
    return (
      <div className="flex items-center gap-2 text-gray-500 text-sm py-12 justify-center">
        <Loader2 className="w-4 h-4 animate-spin" /> Laddar dashboard...
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">{error}</div>
    );
  }

  if (!data) return null;

  const k = data.kpi;
  const pd = data.position_distribution;
  const totalKeywords = pd.top3 + pd.top10 + pd.top20 + pd.beyond;

  // Filtrerade & sorterade queries
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

  const clientHost = data.client?.public_url
    ? (() => { try { return new URL(data.client.public_url).hostname; } catch { return ""; } })()
    : "";

  return (
    <div className="space-y-6">
      {/* HANDBOK + DJUPGRANSKNING */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <button
          onClick={() => setShowHandbok((v) => !v)}
          className="flex items-center gap-3 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 text-left hover:shadow-sm transition"
        >
          <div className="w-10 h-10 rounded-lg bg-white border border-blue-200 flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-gray-900">Handbok — så jobbar du med dashboarden</div>
            <div className="text-xs text-gray-600 mt-0.5">7 rutiner som faktiskt ger fler kunder från sajten</div>
          </div>
        </button>
        <button
          onClick={generateReport}
          disabled={generatingReport}
          className="flex items-center gap-3 bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-4 text-left hover:shadow-sm transition disabled:opacity-50"
        >
          <div className="w-10 h-10 rounded-lg bg-white border border-purple-200 flex items-center justify-center flex-shrink-0">
            {generatingReport ? <Loader2 className="w-5 h-5 text-purple-600 animate-spin" /> : <FileText className="w-5 h-5 text-purple-600" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-gray-900">{generatingReport ? "Granskar sajten..." : "Generera djupgranskning"}</div>
            <div className="text-xs text-gray-600 mt-0.5">{generatingReport ? "60-90 sekunder" : "Full SEO/AEO-rapport: TL;DR + brister + sprintplan"}</div>
          </div>
        </button>
      </div>

      {showHandbok && (
        <div className="bg-white border border-blue-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-blue-600" />
              Handbok — så jobbar du med dashboarden
            </h3>
            <button onClick={() => setShowHandbok(false)} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
          </div>
          <div className="space-y-3 text-sm text-gray-800">
            <div>
              <div className="font-semibold text-gray-900 mb-1">📅 Varje dag (5 min)</div>
              <ul className="list-disc pl-5 space-y-1 text-gray-700">
                <li>Öppna dashboarden → kolla om <strong>Quick wins</strong> har nya sökord. Det är där snabbaste klick-vinsterna finns.</li>
                <li>Granska <strong>Idé-bank & trend</strong> i sidebaren — godkänn/avslå nattens utkast.</li>
              </ul>
            </div>
            <div>
              <div className="font-semibold text-gray-900 mb-1">📅 Varje vecka (30 min)</div>
              <ul className="list-disc pl-5 space-y-1 text-gray-700">
                <li>Filtrera sökords-tabellen på <em>"led skärm"</em>, <em>"digital skylt"</em> osv. — vilka klättrar? Vilka tappar?</li>
                <li>Kolla <strong>Position-fördelning</strong>. Mål: flytta sökord från 11–20 till topp 10. Varje vecka.</li>
                <li>Kör <strong>Refresh Recommender</strong>-specialisten på en gammal sida — uppdatera om den säger så.</li>
              </ul>
            </div>
            <div>
              <div className="font-semibold text-gray-900 mb-1">📅 Varje månad (2 timmar)</div>
              <ul className="list-disc pl-5 space-y-1 text-gray-700">
                <li>Kör <strong>Generera djupgranskning</strong>-knappen ovan — full rapport med konkreta åtgärder.</li>
                <li>Plocka 3 quick-win-sökord → kör <strong>GEO/AEO-optimeraren</strong> på sidan som rankar för dem.</li>
                <li>Skapa 1 ny sida som svarar på en topp-fråga från GSC ("vad kostar led skärm" osv.).</li>
              </ul>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-3">
              <div className="font-semibold text-gray-900 mb-1">🎯 Mål-tröskelvärden</div>
              <ul className="text-xs text-gray-700 space-y-0.5">
                <li>• <strong>CTR &lt; 1%</strong> = title/meta är oattraktiv → skriv om</li>
                <li>• <strong>Position 4–15 + impressions &gt; 50</strong> = quick win → optimera sidan, klättra till topp 3</li>
                <li>• <strong>Snitt-position &gt; 20</strong> = sajten ej topical authority än → bygg fler artiklar i ämnet</li>
                <li>• <strong>Brand &gt; 70% av klick</strong> = beroende av varumärke → bygg icke-brand-sökord</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* PERIOD-VALJARE + SYNC */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 font-medium uppercase tracking-wide mr-2">Period</span>
          {([7, 14, 30, 90] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-sm rounded-lg font-medium transition ${period === p ? "bg-emerald-600 text-white" : "bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200"}`}
            >
              {p === 7 ? "7d" : p === 14 ? "14d" : p === 30 ? "30d" : "90d"}
            </button>
          ))}
          <span className="text-xs text-gray-400 ml-3">{data.period.since} → {data.period.until}</span>
        </div>
        <div className="flex items-center gap-3">
          {data.gsc_last_sync?.imported_at && (
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              GSC: {formatRelative(data.gsc_last_sync.imported_at)}
              <span className="text-gray-400 ml-1">(auto-synk dagligen 03:00)</span>
            </span>
          )}
          <button
            onClick={() => syncGsc(period)}
            disabled={syncing}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-50"
            title="Tvinga manuell synk om du inte vill vänta till imorgon"
          >
            {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Synka nu
          </button>
        </div>
      </div>

      {/* KPI-RAD */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <KPI icon={MousePointerClick} color="emerald" label="Klick (Google)" value={k.gsc_clicks} sub={`CTR ${k.gsc_ctr}%`} />
        <KPI icon={Eye} color="blue" label="Visningar (Google)" value={k.gsc_impressions} sub={`${k.gsc_keyword_count} sökord`} />
        <KPI icon={Award} color="amber" label="Snitt-position" value={k.gsc_avg_position ?? "—"} sub="lägre = bättre" />
        <KPI icon={TrendingUp} color="purple" label="Besökare (sajt)" value={k.visits} sub={k.visits_returning > 0 ? `${k.visits_returning} återkomm.` : ""} />
        <KPI icon={Smartphone} color="pink" label="Mobil-andel" value={`${k.visits_mobile_pct}%`} sub="av besök" />
        <KPI icon={Gauge} color="teal" label="Sid-laddtid" value={k.avg_page_load_ms !== null ? `${k.avg_page_load_ms}ms` : "—"} sub="snitt" />
      </div>

      {/* POSITION-FORDELNING + BRAND SPLIT */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Target className="w-4 h-4 text-emerald-600" />
            Var rankar du? — sökords-fördelning
          </h3>
          <div className="space-y-2">
            <PosBar label="Topp 3" count={pd.top3} imp={pd.top3Imp} total={totalKeywords} color="bg-emerald-500" />
            <PosBar label="Topp 4–10" count={pd.top10} imp={pd.top10Imp} total={totalKeywords} color="bg-blue-500" />
            <PosBar label="11–20" count={pd.top20} imp={pd.top20Imp} total={totalKeywords} color="bg-amber-500" />
            <PosBar label="21+" count={pd.beyond} imp={pd.beyondImp} total={totalKeywords} color="bg-gray-400" />
          </div>
          <div className="text-xs text-gray-500 mt-3 flex items-center gap-1">
            <Info className="w-3 h-3" />
            Sökord på position 4–15 är där snabbaste vinsterna finns.
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Repeat className="w-4 h-4 text-purple-600" />
            Brand vs icke-brand
          </h3>
          {(data.brand_split.brand.impressions + data.brand_split.non_brand.impressions) > 0 ? (
            <div className="space-y-3">
              <BrandRow label="Icke-brand (nya kunder)" clicks={data.brand_split.non_brand.clicks} imp={data.brand_split.non_brand.impressions} color="text-emerald-700" />
              <BrandRow label="Brand (kände redan till er)" clicks={data.brand_split.brand.clicks} imp={data.brand_split.brand.impressions} color="text-blue-700" />
              <div className="text-xs text-gray-500 mt-2">
                Hög icke-brand-andel = ni hittas av nya kunder. Lågt = beroende av brand-igenkänning.
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-400">Ingen data ännu.</div>
          )}
        </div>
      </div>

      {/* QUICK WINS */}
      {data.quick_wins.length > 0 && (
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-5">
          <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-600" />
            Snabbaste vinsterna — sökord på position 4–15
          </h3>
          <p className="text-xs text-gray-600 mb-3">
            Dessa sökord har hög synlighet men ligger precis utanför topp 3. En optimering här ger dig flest nya klick per arbetad timme.
          </p>
          <div className="overflow-x-auto bg-white rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-amber-50">
                <tr className="text-left text-xs text-gray-700 border-b border-amber-200">
                  <th className="py-2 px-3 font-medium">Sökord</th>
                  <th className="py-2 px-3 font-medium text-right">Position</th>
                  <th className="py-2 px-3 font-medium text-right">Visningar</th>
                  <th className="py-2 px-3 font-medium text-right">Klick</th>
                  <th className="py-2 px-3 font-medium text-right">CTR</th>
                  <th className="py-2 px-3 font-medium text-right">Potential</th>
                </tr>
              </thead>
              <tbody>
                {data.quick_wins.map((q, i) => {
                  const potClicks = Math.round(q.impressions * 0.25); // Topp 3 har CTR ~20-30%
                  return (
                    <tr key={i} className="border-b border-amber-100 hover:bg-amber-50/50">
                      <td className="py-2 px-3 font-medium text-gray-900">{q.query}</td>
                      <td className="py-2 px-3 text-right tabular-nums text-amber-700 font-semibold">{q.avg_position}</td>
                      <td className="py-2 px-3 text-right tabular-nums text-gray-700">{q.impressions.toLocaleString("sv-SE")}</td>
                      <td className="py-2 px-3 text-right tabular-nums text-gray-700">{q.clicks}</td>
                      <td className="py-2 px-3 text-right tabular-nums text-gray-500">{q.ctr}%</td>
                      <td className="py-2 px-3 text-right tabular-nums text-emerald-700 font-bold">+{potClicks}/m</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SOKORDSTABELL */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Search className="w-4 h-4 text-emerald-600" />
            Alla sökord ({data.queries_all_count})
          </h3>
          <div className="flex items-center gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrera (t.ex. led skärm)"
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 focus:border-emerald-500 outline-none w-56"
            />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-200"
            >
              <option value="clicks">Sortera: klick</option>
              <option value="impressions">Sortera: visningar</option>
              <option value="position">Sortera: position</option>
              <option value="ctr">Sortera: CTR</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                <th className="py-2 px-3 font-medium">Sökord</th>
                <th className="py-2 px-3 font-medium text-right">Klick</th>
                <th className="py-2 px-3 font-medium text-right">Visningar</th>
                <th className="py-2 px-3 font-medium text-right">CTR</th>
                <th className="py-2 px-3 font-medium text-right">Pos</th>
                <th className="py-2 px-3 font-medium text-right">Sidor</th>
                <th className="py-2 px-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="py-6 text-center text-gray-400">Inga sökord matchar filtret.</td></tr>
              ) : filtered.map((q, i) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="py-2 px-3 font-medium text-gray-900">{q.query}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-gray-700">{q.clicks}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-gray-700">{q.impressions.toLocaleString("sv-SE")}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-gray-500">{q.ctr}%</td>
                  <td className="py-2 px-3 text-right tabular-nums">
                    <span className={
                      q.avg_position === null ? "text-gray-400"
                      : q.avg_position <= 3 ? "text-emerald-700 font-bold"
                      : q.avg_position <= 10 ? "text-blue-700 font-semibold"
                      : q.avg_position <= 20 ? "text-amber-700"
                      : "text-gray-500"
                    }>
                      {q.avg_position ?? "—"}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-gray-400 text-xs">{q.page_count}</td>
                  <td className="py-2 px-3">
                    <a
                      href={`https://www.google.com/search?q=${encodeURIComponent(q.query)}&gl=se&hl=sv`}
                      target="_blank"
                      rel="noopener"
                      className="text-xs text-blue-600 hover:underline"
                    >Sök</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* TOP PAGES */}
      {data.top_pages.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-semibold text-gray-900 mb-3">Sidor som rankar bäst</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                  <th className="py-2 px-3 font-medium">Sida</th>
                  <th className="py-2 px-3 font-medium text-right">Klick</th>
                  <th className="py-2 px-3 font-medium text-right">Visningar</th>
                  <th className="py-2 px-3 font-medium text-right">Sökord</th>
                </tr>
              </thead>
              <tbody>
                {data.top_pages.map((p, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-2 px-3"><a href={p.page} target="_blank" rel="noopener" className="text-blue-600 hover:underline truncate inline-block max-w-md">{p.page.replace(/^https?:\/\//, "")}</a></td>
                    <td className="py-2 px-3 text-right tabular-nums">{p.clicks}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{p.impressions.toLocaleString("sv-SE")}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-gray-500">{p.queryCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PIXEL-DATA */}
      {data.top_paths.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Mest besökta sidor (pixel)</h3>
            <ul className="space-y-1.5 text-sm">
              {data.top_paths.map((p, i) => (
                <li key={i} className="flex items-center justify-between border-b border-gray-50 pb-1.5">
                  <span className="font-mono text-xs text-gray-700 truncate">{p.path}</span>
                  <span className="text-gray-500 tabular-nums">{p.visits}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Top referrers</h3>
            {data.top_referrers.length === 0 ? (
              <div className="text-sm text-gray-400">Ingen extern trafik än.</div>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {data.top_referrers.map((r, i) => (
                  <li key={i} className="flex items-center justify-between border-b border-gray-50 pb-1.5">
                    <span className="text-xs text-gray-700">{r.host}</span>
                    <span className="text-gray-500 tabular-nums">{r.visits}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* EXTERNA DASHBOARDS */}
      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-5">
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <ExternalLink className="w-4 h-4 text-indigo-600" />
          Djupare data (externa dashboards)
        </h3>
        <p className="text-xs text-gray-600 mb-3">
          Cockpit visar topp-data per klient. För heatmaps, session-replay, konvertering och funnel — öppna fullständig dashboard hos respektive leverantör.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <DashCard
            title="Microsoft Clarity"
            desc="Heatmaps, session replay, frustration"
            url={clientHost === "displayteknik.se" ? "https://clarity.microsoft.com/projects/view/ue5zf5lp9d/dashboard" : "https://clarity.microsoft.com"}
            color="from-orange-50 to-amber-50 border-orange-200"
          />
          <DashCard
            title="Google Analytics"
            desc="Sessioner, konvertering, funnel"
            url="https://analytics.google.com/analytics/web/"
            color="from-blue-50 to-cyan-50 border-blue-200"
          />
          <DashCard
            title="Search Console"
            desc="Detaljer, indexering, Core Web Vitals"
            url={clientHost ? `https://search.google.com/search-console?resource_id=sc-domain:${clientHost.replace(/^www\./, "")}` : "https://search.google.com/search-console"}
            color="from-emerald-50 to-teal-50 border-emerald-200"
          />
        </div>
      </div>

      {/* SPARADE RAPPORTER */}
      {savedReports.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-purple-600" />
            Tidigare djupgranskningar ({savedReports.length})
          </h3>
          <div className="space-y-1.5">
            {savedReports.map((r) => (
              <button
                key={r.id}
                onClick={() => { setReportText(r.body); setReportOpen(true); }}
                className="w-full flex items-center justify-between text-sm border-b border-gray-50 py-2 hover:bg-gray-50/50 px-2 rounded text-left"
              >
                <span className="text-gray-700 truncate">
                  {r.metadata?.url?.replace(/^https?:\/\/(www\.)?/, "") ?? "—"}
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(r.created_at).toLocaleDateString("sv-SE")} · {new Date(r.created_at).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* RAPPORT-MODAL */}
      {reportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => !generatingReport && setReportOpen(false)}>
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-purple-50 to-pink-50">
              <h3 className="font-semibold flex items-center gap-2 text-gray-900">
                <Sparkles className="w-4 h-4 text-purple-600" />
                SEO/AEO-djupgranskning
              </h3>
              <div className="flex items-center gap-2">
                {reportText && (
                  <>
                    <button onClick={copyReport} className="text-xs px-3 py-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 flex items-center gap-1">
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? "Kopierat" : "Kopiera"}
                    </button>
                    <button onClick={downloadReport} className="text-xs px-3 py-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-50">
                      Ladda ner .md
                    </button>
                  </>
                )}
                <button onClick={() => setReportOpen(false)} className="text-gray-400 hover:text-gray-700 p-1"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="overflow-y-auto p-6">
              {generatingReport && !reportText && (
                <div className="flex flex-col items-center gap-3 py-12 text-gray-500">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                  <div className="text-sm">Granskar {data.client?.public_url ?? "sajten"} — det tar 60-90 sekunder...</div>
                  <div className="text-xs text-gray-400">Hämtar HTML, läser GSC-data, kör Claude Sonnet 4.5</div>
                </div>
              )}
              {reportError && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">{reportError}</div>
              )}
              {reportText && (
                <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans leading-relaxed">{reportText}</pre>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SENASTE AUDITS */}
      {data.recent_audits.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-semibold text-gray-900 mb-3">Senaste audit-körningar</h3>
          <div className="space-y-1.5">
            {data.recent_audits.map((a) => (
              <div key={a.id} className="flex items-center justify-between text-sm border-b border-gray-50 py-2">
                <span className="text-blue-600 truncate max-w-md">{a.url.replace(/^https?:\/\//, "")}</span>
                <div className="flex items-center gap-2">
                  <Badge label="SEO" v={a.seo_score} />
                  <Badge label="AEO" v={a.aeo_score} />
                  <span className="text-xs text-gray-400">{new Date(a.audited_at).toLocaleDateString("sv-SE")}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function KPI({ icon: Icon, color, label, value, sub }: { icon: React.ComponentType<{ className?: string }>; color: string; label: string; value: number | string; sub?: string }) {
  const colors: Record<string, string> = {
    emerald: "text-emerald-700 bg-emerald-50 border-emerald-200",
    blue: "text-blue-700 bg-blue-50 border-blue-200",
    amber: "text-amber-700 bg-amber-50 border-amber-200",
    purple: "text-purple-700 bg-purple-50 border-purple-200",
    pink: "text-pink-700 bg-pink-50 border-pink-200",
    teal: "text-teal-700 bg-teal-50 border-teal-200",
  };
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3">
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center border ${colors[color]} mb-2`}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="text-xl font-bold text-gray-900 tabular-nums leading-tight">{typeof value === "number" ? value.toLocaleString("sv-SE") : value}</div>
      <div className="text-[11px] text-gray-500 mt-0.5">{label}</div>
      {sub && <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function PosBar({ label, count, imp, total, color }: { label: string; count: number; imp: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="font-medium text-gray-700">{label}</span>
        <span className="text-gray-500"><strong className="text-gray-900">{count}</strong> sökord · {imp.toLocaleString("sv-SE")} visn.</span>
      </div>
      <div className="h-2 bg-gray-100 rounded overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function BrandRow({ label, clicks, imp, color }: { label: string; clicks: number; imp: number; color: string }) {
  return (
    <div className="flex items-center justify-between border-b border-gray-100 pb-2">
      <span className="text-sm text-gray-700">{label}</span>
      <div className="text-right">
        <div className={`text-sm font-bold ${color}`}>{clicks} klick</div>
        <div className="text-xs text-gray-500">{imp.toLocaleString("sv-SE")} visningar</div>
      </div>
    </div>
  );
}

function DashCard({ title, desc, url, color }: { title: string; desc: string; url: string; color: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener"
      className={`block bg-gradient-to-br ${color} border rounded-xl p-3 hover:shadow-sm transition group`}
    >
      <div className="flex items-center justify-between">
        <span className="font-semibold text-sm text-gray-900">{title}</span>
        <ExternalLink className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-700" />
      </div>
      <div className="text-xs text-gray-600 mt-1">{desc}</div>
    </a>
  );
}

function formatRelative(ts: string): string {
  try {
    const ms = Date.now() - new Date(ts).getTime();
    const min = Math.floor(ms / 60000);
    if (min < 60) return `${min}m sedan`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h}h sedan`;
    const d = Math.floor(h / 24);
    if (d < 30) return `${d}d sedan`;
    return new Date(ts).toLocaleDateString("sv-SE");
  } catch {
    return "okänt";
  }
}

function Badge({ label, v }: { label: string; v: number }) {
  const c = v >= 80 ? "bg-emerald-100 text-emerald-700" : v >= 60 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold tabular-nums ${c}`}>
      <span className="opacity-70">{label}</span>{v}
    </span>
  );
}
