"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search, TrendingUp, Eye, Globe, Plus, Trash2, Loader2, ExternalLink, Gauge, Zap, AlertCircle, CheckCircle2, FileSearch, Upload, HelpCircle, Sparkles, BarChart3, Bot, ShieldCheck, Code2, RefreshCw, Target, ArrowRight } from "lucide-react";
import AnalyticsDashboard from "@/components/AnalyticsDashboard";

interface Analytics {
  visits_24h: number;
  visits_7d: number;
  visits_30d: number;
  top_paths: { key: string; count: number }[];
  top_referrers: { key: string; count: number }[];
  recent: { path: string; ts: string; referrer: string | null }[];
}

interface Keyword {
  id: string;
  keyword: string;
  target_url: string | null;
  intent: string | null;
  current_rank: number | null;
  best_rank: number | null;
  search_volume: number | null;
  country: string;
  notes: string | null;
  last_checked: string | null;
}

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

type TabKey = "oversikt" | "audit" | "ai-flode";

const AI_FLOW = [
  { step: "1", icon: Target, title: "Audit", desc: "Score 0-100 + topp-5 fixar med exakt plats.", id: "seo-technical-audit" },
  { step: "2", icon: ShieldCheck, title: "E-E-A-T-grind", desc: "Kvalitetscheck innan publicering.", id: "eeat-gate" },
  { step: "3", icon: Sparkles, title: "GEO/AEO", desc: "Skriv om för ChatGPT, Perplexity, Google AI.", id: "geo-aeo-optimizer" },
  { step: "4", icon: Code2, title: "Schema", desc: "Generera JSON-LD strukturerad data.", id: "schema-generator" },
  { step: "5", icon: RefreshCw, title: "Refresh", desc: "Granska gammalt innehåll, få åtgärdslista.", id: "refresh-recommender" },
];

export default function SEOPage() {
  return (
    <Suspense fallback={<div className="text-sm text-gray-500 p-4">Laddar...</div>}>
      <SEOPageInner />
    </Suspense>
  );
}

function SEOPageInner() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams?.get("tab") as TabKey) || "oversikt";
  const [tab, setTab] = useState<TabKey>(["oversikt", "audit", "ai-flode"].includes(initialTab) ? initialTab : "oversikt");
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [audits, setAudits] = useState<Audit[]>([]);
  const [auditUrl, setAuditUrl] = useState("");
  const [auditing, setAuditing] = useState(false);
  const [skipPagespeed, setSkipPagespeed] = useState(false);
  const [newKw, setNewKw] = useState({ keyword: "", target_url: "", intent: "informational", search_volume: "" });
  const [showGscImport, setShowGscImport] = useState(false);
  const [showPaa, setShowPaa] = useState(false);
  const [showAiAudit, setShowAiAudit] = useState(false);
  const [gscRows, setGscRows] = useState<{ query: string; clicks: number; impressions: number; position: number }[]>([]);
  const [googleStatus, setGoogleStatus] = useState<{ connected: boolean; connection: { gsc_site: string | null } | null } | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    fetch("/api/seo/gsc-import").then((r) => r.ok ? r.json() : []).then(setGscRows).catch(() => {});
    fetch("/api/google/status").then((r) => r.json()).then(setGoogleStatus).catch(() => {});
  }, []);

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
        alert(`Synkat ${d.rows} sökord från GSC (${d.period_start} → ${d.period_end})`);
        const fresh = await fetch("/api/seo/gsc-import").then((r) => r.json());
        setGscRows(fresh);
      } else {
        alert("Fel: " + (d.error || "okänt"));
      }
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => { reload(); }, []);

  async function reload() {
    const [a, k, ad] = await Promise.all([
      fetch("/api/seo/analytics").then((r) => r.json()),
      fetch("/api/seo/keywords").then((r) => r.json()),
      fetch("/api/seo/audit").then((r) => r.json()),
    ]);
    setAnalytics(a);
    setKeywords(k);
    setAudits(ad);
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
        setAuditUrl("");
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
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-emerald-600" />
            SEO &amp; AEO
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Synlighet i Google + AI-motorer (ChatGPT, Perplexity, Google AI). Helt gratis verktyg.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {googleStatus?.connected && googleStatus?.connection?.gsc_site ? (
            <button onClick={() => syncGsc(28)} disabled={syncing} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
              {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshIcon />}
              Synka GSC (28 dagar)
            </button>
          ) : (
            <a href="/dashboard/installningar" className="flex items-center gap-2 bg-white border border-amber-300 text-amber-700 hover:bg-amber-50 px-3 py-2 rounded-lg text-sm font-medium">
              <ExternalLink className="w-4 h-4" />
              Anslut Google
            </a>
          )}
          <button onClick={() => setShowGscImport(true)} className="flex items-center gap-2 bg-white border border-gray-200 hover:border-blue-300 px-3 py-2 rounded-lg text-sm font-medium text-gray-700">
            <Upload className="w-4 h-4" />
            CSV-import
          </button>
          <button onClick={() => setShowPaa(true)} className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:opacity-90">
            <HelpCircle className="w-4 h-4" />
            People Also Ask
          </button>
          <button onClick={() => setShowAiAudit(true)} className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:opacity-90">
            <Sparkles className="w-4 h-4" />
            AI Content-audit
          </button>
        </div>
      </div>

      {/* TABS */}
      <div className="flex gap-1 border-b border-gray-200 -mt-2">
        {([
          { key: "oversikt", label: "Översikt", icon: BarChart3 },
          { key: "audit", label: "Audit & sökord", icon: FileSearch },
          { key: "ai-flode", label: "AI Sök-motor (GEO/AEO)", icon: Bot },
        ] as const).map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${active ? "border-emerald-600 text-emerald-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* === FLIK: ÖVERSIKT === */}
      {tab === "oversikt" && <AnalyticsDashboard />}
      {/* === SLUT FLIK: ÖVERSIKT === */}

      {/* === FLIK: AUDIT & SÖKORD === */}
      {tab === "audit" && (
      <>
      {/* Keyword tracker */}
      <Card title="Sökords-tracker" subtitle="Lägg in dina målsökord. Kolla rank manuellt på Google → uppdatera position. AI-coachen rekommenderar redan ord baserat på lager.">
        <div className="grid grid-cols-1 md:grid-cols-[2fr_2fr_1fr_1fr_auto] gap-2 mb-4">
          <input value={newKw.keyword} onChange={(e) => setNewKw({ ...newKw, keyword: e.target.value })} placeholder="Sökord (t.ex. atv jämtland)" className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none" />
          <input value={newKw.target_url} onChange={(e) => setNewKw({ ...newKw, target_url: e.target.value })} placeholder="Mål-URL (valfritt)" className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none" />
          <select value={newKw.intent} onChange={(e) => setNewKw({ ...newKw, intent: e.target.value })} className="px-3 py-2 rounded-lg border border-gray-200 text-sm">
            <option value="informational">Info</option>
            <option value="transactional">Köp</option>
            <option value="navigational">Navigerings</option>
            <option value="commercial">Jämför</option>
          </select>
          <input type="number" value={newKw.search_volume} onChange={(e) => setNewKw({ ...newKw, search_volume: e.target.value })} placeholder="Volym/mån" className="px-3 py-2 rounded-lg border border-gray-200 text-sm" />
          <button onClick={addKeyword} disabled={!newKw.keyword.trim()} className="px-4 py-2 bg-brand-blue text-white rounded-lg text-sm font-medium hover:bg-brand-blue-dark disabled:opacity-50">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        {keywords.length === 0 ? <Empty text="Lägg till ditt första sökord ovan" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-100">
                  <th className="text-left py-2 px-2">Sökord</th>
                  <th className="text-left py-2 px-2">Intent</th>
                  <th className="text-right py-2 px-2">Volym</th>
                  <th className="text-right py-2 px-2">Position</th>
                  <th className="text-right py-2 px-2">Bästa</th>
                  <th className="text-left py-2 px-2">Senast</th>
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
                    <td className="py-2 px-2"><IntentBadge intent={k.intent} /></td>
                    <td className="py-2 px-2 text-right tabular-nums text-gray-600">{k.search_volume ?? "—"}</td>
                    <td className="py-2 px-2 text-right">
                      <input
                        type="number"
                        value={k.current_rank ?? ""}
                        onChange={(e) => updateRank(k.id, e.target.value ? parseInt(e.target.value) : null)}
                        placeholder="—"
                        className="w-16 px-2 py-1 rounded border border-gray-200 text-sm text-right tabular-nums focus:border-brand-blue outline-none"
                      />
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums text-emerald-700 font-medium">{k.best_rank ?? "—"}</td>
                    <td className="py-2 px-2 text-xs text-gray-500">{k.last_checked ? new Date(k.last_checked).toLocaleDateString("sv-SE") : "Aldrig"}</td>
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

      {/* Page audit */}
      <Card title="Sid-audit (SEO + AEO)" subtitle="Hämtar sidan, analyserar HTML och kör Google PageSpeed Insights (gratis). Returnerar SEO-score + AEO-score.">
        <div className="flex gap-2 mb-4 flex-wrap">
          <input
            value={auditUrl}
            onChange={(e) => setAuditUrl(e.target.value)}
            placeholder="https://din-sajt.se/blogg/exempel-artikel"
            className="flex-1 min-w-[280px] px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none"
          />
          <label className="flex items-center gap-2 text-xs text-gray-600 px-3">
            <input type="checkbox" checked={skipPagespeed} onChange={(e) => setSkipPagespeed(e.target.checked)} className="rounded" />
            Hoppa PageSpeed (snabbt)
          </label>
          <button onClick={runAudit} disabled={auditing || !auditUrl.trim()} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
            {auditing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSearch className="w-4 h-4" />}
            Auditera
          </button>
        </div>

        {audits.length === 0 ? <Empty text="Ingen audit än. Klistra in en URL och kör." /> : (
          <div className="space-y-3">
            {audits.slice(0, 10).map((a) => (
              <details key={a.id} className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
                <summary className="cursor-pointer px-4 py-3 hover:bg-gray-100 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{a.title || a.url}</div>
                    <div className="text-xs text-gray-500 truncate">{a.url}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <ScoreBadge label="SEO" value={a.seo_score} />
                    <ScoreBadge label="AEO" value={a.aeo_score} />
                    {a.pagespeed_mobile != null && <ScoreBadge label="📱" value={a.pagespeed_mobile} />}
                    {a.pagespeed_desktop != null && <ScoreBadge label="💻" value={a.pagespeed_desktop} />}
                  </div>
                </summary>
                <div className="px-4 py-3 border-t border-gray-200 bg-white space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <Mini label="Title" value={a.title ? `${a.title.length} tecken` : "saknas"} ok={!!a.title && a.title.length >= 30 && a.title.length <= 60} />
                    <Mini label="Meta-desc" value={a.meta_description ? `${a.meta_description.length} tecken` : "saknas"} ok={!!a.meta_description && a.meta_description.length >= 120 && a.meta_description.length <= 160} />
                    <Mini label="Ord" value={a.word_count} ok={a.word_count >= 600} />
                    <Mini label="Schema" value={a.has_schema ? "ja" : "nej"} ok={a.has_schema} />
                    <Mini label="FAQ" value={a.has_faq ? "ja" : "nej"} ok={a.has_faq} />
                    <Mini label="OG" value={a.has_og ? "ja" : "nej"} ok={a.has_og} />
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
                  <div className="text-xs text-gray-400">
                    Auditerad {new Date(a.audited_at).toLocaleString("sv-SE")}
                  </div>
                </div>
              </details>
            ))}
          </div>
        )}
      </Card>

      {gscRows.length > 0 && (
        <Card title="Google Search Console — top queries" subtitle={`${gscRows.length} importerade rader. Sortera och hitta snabba rank-vinster (position 4–15 = nära toppen).`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-100">
                  <th className="text-left py-2 px-2">Sökord</th>
                  <th className="text-right py-2 px-2">Klick</th>
                  <th className="text-right py-2 px-2">Visningar</th>
                  <th className="text-right py-2 px-2">Position</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {gscRows.slice(0, 30).map((g, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-2 px-2 font-medium text-gray-900">{g.query}</td>
                    <td className="py-2 px-2 text-right tabular-nums text-emerald-700 font-medium">{g.clicks}</td>
                    <td className="py-2 px-2 text-right tabular-nums text-gray-600">{g.impressions}</td>
                    <td className="py-2 px-2 text-right tabular-nums">
                      <span className={g.position <= 3 ? "text-emerald-700 font-bold" : g.position <= 10 ? "text-amber-700" : "text-gray-500"}>
                        {g.position?.toFixed(1)}
                      </span>
                    </td>
                    <td className="py-2 px-2">
                      <button
                        onClick={() => { setNewKw({ keyword: g.query, target_url: "", intent: "informational", search_volume: g.impressions.toString() }); }}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Spåra
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      </>
      )}
      {/* === SLUT FLIK: AUDIT & SÖKORD === */}

      {/* === FLIK: AI SÖK-MOTOR === */}
      {tab === "ai-flode" && (
      <>
      <div className="bg-gradient-to-br from-teal-50 to-emerald-50 border border-teal-200 rounded-2xl p-6">
        <div className="flex items-start justify-between mb-1">
          <div>
            <h2 className="font-display font-bold text-gray-900 flex items-center gap-2">
              <Bot className="w-5 h-5 text-teal-600" />
              AI Sök-motor — flödet
            </h2>
            <p className="text-sm text-gray-600 mt-1 max-w-2xl">
              Optimera för Google + AI-sökmotorer (ChatGPT, Perplexity, Google AI Overviews). Fem specialister i ordning — kör dem en gång per sida.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-5">
          {AI_FLOW.map((f) => {
            const Icon = f.icon;
            return (
              <Link
                key={f.step}
                href={`/dashboard/specialister/${f.id}`}
                className="group bg-white border border-gray-200 rounded-xl p-4 hover:border-teal-400 hover:shadow-sm transition"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-teal-700">{f.step}</span>
                  <Icon className="w-4 h-4 text-teal-600" />
                </div>
                <div className="font-semibold text-gray-900 text-sm mb-1 group-hover:text-teal-700">
                  {f.title}
                </div>
                <div className="text-xs text-gray-600 leading-snug">{f.desc}</div>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="bg-gradient-to-br from-emerald-50 to-blue-50 border border-emerald-100 rounded-xl p-5">
        <h3 className="font-display font-bold text-gray-900 flex items-center gap-2 mb-2">
          <Zap className="w-5 h-5 text-emerald-600" />
          Snabbtips för AI-synlighet
        </h3>
        <ul className="text-sm text-gray-700 space-y-1.5 list-disc pl-5">
          <li>Skriv H2/H3 som <strong>frågor</strong> läsaren faktiskt ställer</li>
          <li>Lägg <strong>FAQ-sektion</strong> i slutet av varje sida (4–6 frågor)</li>
          <li>Använd <strong>Schema.org/JSON-LD</strong> — FAQPage, Product, LocalBusiness, Article</li>
          <li>Direkt svar i <strong>första meningen</strong> efter varje rubrik (citerbart)</li>
          <li>Punktlistor och tabeller citeras oftare av AI</li>
          <li>Visa <strong>uppdaterad-datum</strong> + författarens erfarenhet (E-E-A-T)</li>
        </ul>
        <Link href="/dashboard/agents" className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-900 mt-3">
          Se score-trend och idé-bank
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      </>
      )}
      {/* === SLUT FLIK: AI SÖK-MOTOR === */}

      {showGscImport && <GscImportModal onClose={() => { setShowGscImport(false); reload(); fetch("/api/seo/gsc-import").then((r) => r.json()).then(setGscRows); }} />}
      {showPaa && <PaaModal onClose={() => setShowPaa(false)} />}
      {showAiAudit && <AiAuditModal onClose={() => setShowAiAudit(false)} />}
    </div>
  );
}

function RefreshIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M3 21v-5h5" /></svg>;
}

function GscImportModal({ onClose }: { onClose: () => void }) {
  const [csv, setCsv] = useState("");
  const [period_start, setPs] = useState("");
  const [period_end, setPe] = useState("");
  const [loading, setLoading] = useState(false);

  async function run() {
    if (!csv.trim()) return;
    setLoading(true);
    const r = await fetch("/api/seo/gsc-import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv, period_start, period_end }),
    });
    const d = await r.json();
    setLoading(false);
    if (r.ok) { alert(`Importerat ${d.imported} rader.`); onClose(); }
    else alert("Fel: " + (d.error || "okänt"));
  }

  return (
    <Modal title="Importera Google Search Console" onClose={onClose}>
      <div className="text-sm text-gray-600 mb-3 space-y-1">
        <p>Steg: <a href="https://search.google.com/search-console" target="_blank" rel="noopener" className="text-blue-600 underline">Search Console</a> → Performance → Export → Download CSV (Top queries).</p>
        <p>Klistra in CSV-innehållet nedan. Format: <code className="bg-gray-100 px-1 rounded text-xs">Query,Clicks,Impressions,CTR,Position</code></p>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div>
          <label className="text-xs text-gray-500">Period start</label>
          <input type="date" value={period_start} onChange={(e) => setPs(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-500">Period slut</label>
          <input type="date" value={period_end} onChange={(e) => setPe(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
        </div>
      </div>
      <textarea
        value={csv}
        onChange={(e) => setCsv(e.target.value)}
        rows={10}
        placeholder="Query,Clicks,Impressions,CTR,Position&#10;atv jämtland,42,1200,3.5%,8.2&#10;..."
        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-mono"
      />
      <div className="flex justify-end mt-4">
        <button onClick={run} disabled={loading || !csv.trim()} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          Importera
        </button>
      </div>
    </Modal>
  );
}

function PaaModal({ onClose }: { onClose: () => void }) {
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ questions: { question: string; short_answer: string; intent: string }[]; related_keywords: string[]; long_tail: string[] } | null>(null);

  async function run() {
    if (!keyword.trim()) return;
    setLoading(true);
    const r = await fetch("/api/seo/paa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword }),
    });
    const d = await r.json();
    setLoading(false);
    if (r.ok) setResult(d);
    else alert("Fel: " + (d.error || "okänt"));
  }

  return (
    <Modal title="People Also Ask & long-tail" onClose={onClose}>
      <div className="text-sm text-gray-600 mb-3">Generera frågor som riktiga användare söker — för FAQ-sektioner och AEO.</div>
      <div className="flex gap-2 mb-3">
        <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="t.ex. atv jämtland" className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm" />
        <button onClick={run} disabled={loading || !keyword.trim()} className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Generera
        </button>
      </div>
      {result && (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          <div>
            <div className="text-xs font-bold text-gray-700 uppercase mb-1">Frågor</div>
            <div className="space-y-2">
              {result.questions.map((q, i) => (
                <div key={i} className="bg-purple-50 rounded p-2">
                  <div className="font-medium text-sm">{q.question}</div>
                  <div className="text-xs text-gray-600 mt-0.5">{q.short_answer}</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs font-bold text-gray-700 uppercase mb-1">Relaterade sökord</div>
            <div className="flex flex-wrap gap-1.5">
              {result.related_keywords.map((k, i) => <span key={i} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{k}</span>)}
            </div>
          </div>
          <div>
            <div className="text-xs font-bold text-gray-700 uppercase mb-1">Long-tail</div>
            <div className="flex flex-wrap gap-1.5">
              {result.long_tail.map((k, i) => <span key={i} className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">{k}</span>)}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

function AiAuditModal({ onClose }: { onClose: () => void }) {
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ overall_score: number; voice_match_score: number; ai_smell_score: number; conversion_score: number; ai_smell_phrases: string[]; rewrite_priorities: { issue: string; original: string; rewrite: string }[]; strengths: string[]; next_actions: string[] } | null>(null);

  async function run() {
    setLoading(true);
    const r = await fetch("/api/seo/content-audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: url || undefined, text: text || undefined }),
    });
    const d = await r.json();
    setLoading(false);
    if (r.ok) setResult(d);
    else alert("Fel: " + (d.error || "okänt"));
  }

  return (
    <Modal title="AI Content-audit" onClose={onClose}>
      <div className="text-sm text-gray-600 mb-3">Gemini bedömer kvalitet, ton-match, AI-smell och konvertering. Hård granskning.</div>
      <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="URL (eller klistra text nedan)" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm mb-2" />
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="...eller klistra in text direkt" rows={5} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm mb-3" />
      <button onClick={run} disabled={loading || (!url && !text)} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        Granska
      </button>
      {result && (
        <div className="mt-4 space-y-3 max-h-[400px] overflow-y-auto">
          <div className="grid grid-cols-4 gap-2">
            <ScoreBox label="Total" v={result.overall_score} />
            <ScoreBox label="Voice" v={result.voice_match_score} />
            <ScoreBox label="No AI" v={result.ai_smell_score} />
            <ScoreBox label="CR" v={result.conversion_score} />
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
    </Modal>
  );
}

function ScoreBox({ label, v }: { label: string; v: number }) {
  const c = v >= 80 ? "text-emerald-700 bg-emerald-50" : v >= 60 ? "text-amber-700 bg-amber-50" : "text-red-700 bg-red-50";
  return <div className={`rounded-lg p-2 text-center ${c}`}><div className="text-xl font-bold tabular-nums">{v}</div><div className="text-[10px] opacity-70">{label}</div></div>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-display font-bold text-lg">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 text-xl leading-none">×</button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

function shortHost(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ""); }
  catch { return url; }
}

function Stat({ icon: Icon, color, label, value }: { icon: React.ComponentType<{ className?: string }>; color: string; label: string; value: number | string }) {
  const colors: Record<string, string> = { blue: "text-blue-600 bg-blue-50 border-blue-100", purple: "text-purple-600 bg-purple-50 border-purple-100", emerald: "text-emerald-600 bg-emerald-50 border-emerald-100", amber: "text-amber-600 bg-amber-50 border-amber-100" };
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${colors[color]} mb-2`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="text-2xl font-bold font-display text-gray-900">{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h2 className="font-display font-bold text-gray-900">{title}</h2>
      {subtitle && <p className="text-xs text-gray-500 mt-0.5 mb-3">{subtitle}</p>}
      <div className={subtitle ? "" : "mt-3"}>{children}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="text-center text-sm text-gray-400 py-6">{text}</div>;
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

function IntentBadge({ intent }: { intent: string | null }) {
  if (!intent) return <span className="text-gray-400">—</span>;
  const map: Record<string, string> = { informational: "bg-blue-100 text-blue-700", transactional: "bg-emerald-100 text-emerald-700", navigational: "bg-gray-100 text-gray-700", commercial: "bg-purple-100 text-purple-700" };
  const labels: Record<string, string> = { informational: "Info", transactional: "Köp", navigational: "Nav", commercial: "Jämför" };
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${map[intent] || "bg-gray-100"}`}>{labels[intent] || intent}</span>;
}

function Mini({ label, value, ok }: { label: string; value: string | number; ok: boolean }) {
  return (
    <div className={`px-3 py-2 rounded-lg border ${ok ? "bg-emerald-50 border-emerald-100" : "bg-amber-50 border-amber-100"}`}>
      <div className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</div>
      <div className={`text-sm font-medium ${ok ? "text-emerald-700" : "text-amber-700"}`}>{value}</div>
    </div>
  );
}
