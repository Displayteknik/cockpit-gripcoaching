"use client";

import { useEffect, useState } from "react";
import { Search, TrendingUp, Eye, Globe, Plus, Trash2, Loader2, ExternalLink, Gauge, Zap, AlertCircle, CheckCircle2, FileSearch } from "lucide-react";

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

export default function SEOPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [audits, setAudits] = useState<Audit[]>([]);
  const [auditUrl, setAuditUrl] = useState("");
  const [auditing, setAuditing] = useState(false);
  const [skipPagespeed, setSkipPagespeed] = useState(false);
  const [newKw, setNewKw] = useState({ keyword: "", target_url: "", intent: "informational", search_volume: "" });

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
      <div>
        <h1 className="font-display text-2xl font-bold text-gray-900 flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-emerald-600" />
          SEO &amp; AEO
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Synlighet i Google + AI-motorer (ChatGPT, Perplexity, Google AI). Helt gratis verktyg.
        </p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat icon={Eye} color="blue" label="Besökare 24h" value={analytics?.visits_24h ?? "—"} />
        <Stat icon={Eye} color="purple" label="Besökare 7d" value={analytics?.visits_7d ?? "—"} />
        <Stat icon={Eye} color="emerald" label="Besökare 30d" value={analytics?.visits_30d ?? "—"} />
        <Stat icon={Search} color="amber" label="Spårade sökord" value={keywords.length} />
      </div>

      {/* Top paths + referrers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="Mest besökta sidor (30d)">
          {!analytics?.top_paths.length ? <Empty text="Ingen data än — väntar på besökare" /> : (
            <ul className="space-y-1">
              {analytics.top_paths.map((p) => (
                <li key={p.key} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50 last:border-b-0">
                  <span className="font-mono text-xs text-gray-700 truncate">{p.key}</span>
                  <span className="text-gray-500 tabular-nums">{p.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Top referrers (30d)">
          {!analytics?.top_referrers.length ? <Empty text="Ingen extern trafik än" /> : (
            <ul className="space-y-1">
              {analytics.top_referrers.map((r) => (
                <li key={r.key} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50 last:border-b-0">
                  <span className="text-xs text-gray-700 truncate">{shortHost(r.key)}</span>
                  <span className="text-gray-500 tabular-nums">{r.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

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
            placeholder="https://hmmotor-next.vercel.app/blogg/atv-jamtland"
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

      <div className="bg-gradient-to-br from-emerald-50 to-blue-50 border border-emerald-100 rounded-xl p-5">
        <h3 className="font-display font-bold text-gray-900 flex items-center gap-2 mb-2">
          <Zap className="w-5 h-5 text-emerald-600" />
          AEO snabbtips (Answer Engine Optimization)
        </h3>
        <ul className="text-sm text-gray-700 space-y-1.5 list-disc pl-5">
          <li>Skriv H2/H3 som <strong>frågor</strong>: &quot;Vilken ATV passar för jämtländsk skog?&quot;</li>
          <li>Lägg <strong>FAQ-sektion</strong> i slutet av varje sida (3–5 frågor)</li>
          <li>Använd <strong>Schema.org/JSON-LD</strong> — FAQPage, Product, LocalBusiness</li>
          <li>Skriv <strong>direkta svar</strong> i första meningen efter varje fråga</li>
          <li><strong>Punktlistor och tabeller</strong> citeras oftare av AI</li>
          <li>Visa <strong>uppdaterad-datum</strong> på varje sida</li>
        </ul>
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
