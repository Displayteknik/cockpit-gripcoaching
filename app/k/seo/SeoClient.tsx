"use client";

import { useEffect, useState } from "react";
import { TrendingUp, FileSearch, Loader2, AlertCircle, CheckCircle2, Plus, Trash2, ExternalLink, Sparkles, Zap, FileText, Download } from "lucide-react";

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

interface Report {
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
    exempel?: string;
    prioritet: "hög" | "medel" | "låg";
    effekt?: "stor" | "medel" | "liten";
  }[];
  citerbarhet?: { omdome: string; motivering: string; forslag: string };
  eeat?: { omdome: string; saknas: string[] };
}

export default function SeoClient({ primaryColor, clientName, publicUrl }: { primaryColor: string; clientName: string; publicUrl: string }) {
  const [audits, setAudits] = useState<Audit[]>([]);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [auditUrl, setAuditUrl] = useState(publicUrl);
  const [skipPagespeed, setSkipPagespeed] = useState(false);
  const [auditing, setAuditing] = useState(false);
  const [newKw, setNewKw] = useState({ keyword: "", target_url: "", intent: "informational", search_volume: "" });
  const [showAiAudit, setShowAiAudit] = useState(false);
  const [reports, setReports] = useState<Record<string, Report>>({});
  const [reportLoading, setReportLoading] = useState<Record<string, boolean>>({});

  async function genReport(auditId: string) {
    setReportLoading((p) => ({ ...p, [auditId]: true }));
    try {
      const r = await fetch("/api/seo/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auditId }),
      });
      const d = await r.json();
      if (r.ok) setReports((p) => ({ ...p, [auditId]: d }));
      else alert("Kunde inte skapa rapport: " + (d.error || "okänt"));
    } finally {
      setReportLoading((p) => ({ ...p, [auditId]: false }));
    }
  }

  async function reload() {
    const [ad, kw] = await Promise.all([
      fetch("/api/seo/audit").then((r) => r.json()).catch(() => []),
      fetch("/api/seo/keywords").then((r) => r.json()).catch(() => []),
    ]);
    setAudits(Array.isArray(ad) ? ad : []);
    setKeywords(Array.isArray(kw) ? kw : []);
  }

  useEffect(() => { reload(); }, []);

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
          className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded"
          style={{ background: `${primaryColor}15`, color: primaryColor }}
        >
          SEO &amp; AEO
        </span>
        <h1 className="font-display text-2xl font-bold text-gray-900 flex items-center gap-2 mt-1">
          <TrendingUp className="w-6 h-6" style={{ color: primaryColor }} />
          Syns du i Google + AI-sökmotorer?
        </h1>
        <p className="text-gray-600 text-sm mt-1 max-w-2xl">
          Auditera dina sidor och se hur väl de presterar både i Google (SEO) och i AI-sökmotorer som
          ChatGPT, Perplexity och Google AI Overviews (AEO). Få konkreta förbättringar.
        </p>
      </div>

      {/* Sid-audit */}
      <Card title="Sid-audit (SEO + AEO)" subtitle="Klistra in en URL från din sajt. Vi hämtar sidan, analyserar den och kör Google PageSpeed. Du får en SEO-score och en AEO-score med åtgärdslista.">
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
                    <ScoreBadge label="SEO" value={a.seo_score} />
                    <ScoreBadge label="AEO" value={a.aeo_score} />
                    {a.pagespeed_mobile != null && <ScoreBadge label="📱" value={a.pagespeed_mobile} />}
                  </div>
                </summary>
                <div className="px-4 py-3 border-t border-gray-200 bg-white space-y-3">
                  {/* Klartext-rapport */}
                  {!reports[a.id] ? (
                    <button
                      onClick={() => genReport(a.id)}
                      disabled={reportLoading[a.id]}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                      style={{ background: primaryColor }}
                    >
                      {reportLoading[a.id] ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                      {reportLoading[a.id] ? "Skriver rapport..." : "Förklara resultatet (rapport)"}
                    </button>
                  ) : (
                    <ReportView report={reports[a.id]} primaryColor={primaryColor} clientName={clientName} url={a.url} auditedAt={a.audited_at} />
                  )}

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
      <Card title="AI-granskning av text" subtitle="Klistra in en text eller URL — AI:n bedömer kvalitet, ton, AI-känsla och om texten leder till handling. Hård men ärlig.">
        <button
          onClick={() => setShowAiAudit(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
          style={{ background: primaryColor }}
        >
          <Sparkles className="w-4 h-4" />
          Granska en text
        </button>
      </Card>

      {/* Sökords-tracker */}
      <Card title="Sökords-tracker" subtitle="Lägg in dina viktigaste sökord. Sök på Google, se var du ligger och skriv in din position — så ser du utvecklingen över tid.">
        <div className="grid grid-cols-1 md:grid-cols-[2fr_2fr_1fr_1fr_auto] gap-2 mb-4">
          <input value={newKw.keyword} onChange={(e) => setNewKw({ ...newKw, keyword: e.target.value })} placeholder="Sökord" className="px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-gray-400" />
          <input value={newKw.target_url} onChange={(e) => setNewKw({ ...newKw, target_url: e.target.value })} placeholder="Mål-URL (valfritt)" className="px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-gray-400" />
          <select value={newKw.intent} onChange={(e) => setNewKw({ ...newKw, intent: e.target.value })} className="px-3 py-2 rounded-lg border border-gray-200 text-sm">
            <option value="informational">Info</option>
            <option value="transactional">Köp</option>
            <option value="navigational">Navigering</option>
            <option value="commercial">Jämför</option>
          </select>
          <input type="number" value={newKw.search_volume} onChange={(e) => setNewKw({ ...newKw, search_volume: e.target.value })} placeholder="Volym/mån" className="px-3 py-2 rounded-lg border border-gray-200 text-sm" />
          <button onClick={addKeyword} disabled={!newKw.keyword.trim()} className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50" style={{ background: primaryColor }}>
            <Plus className="w-4 h-4" />
          </button>
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
                      <input
                        type="number"
                        value={k.current_rank ?? ""}
                        onChange={(e) => updateRank(k.id, e.target.value ? parseInt(e.target.value) : null)}
                        placeholder="—"
                        className="w-16 px-2 py-1 rounded border border-gray-200 text-sm text-right tabular-nums outline-none focus:border-gray-400"
                      />
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums text-emerald-700 font-medium">{k.best_rank ?? "—"}</td>
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
          <Zap className="w-5 h-5" style={{ color: primaryColor }} />
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

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function printReport(report: Report, ctx: { clientName: string; url: string; auditedAt: string; primaryColor: string }) {
  const { clientName, url, auditedAt, primaryColor } = ctx;
  const sc = report.scorecard;
  const order = { hög: 0, medel: 1, låg: 2 } as Record<string, number>;
  const forb = [...(report.forbattringar || [])].sort((a, b) => (order[a.prioritet] ?? 9) - (order[b.prioritet] ?? 9));
  const datum = (() => { try { return new Date(auditedAt).toLocaleDateString("sv-SE"); } catch { return ""; } })();

  const scoreColor = (v?: number) => (v == null ? "#9ca3af" : v >= 80 ? "#059669" : v >= 60 ? "#d97706" : "#dc2626");
  const cell = (label: string, o?: { poang: number; kommentar: string }) => `
    <div class="cell">
      <div class="cell-label">${esc(label)}</div>
      <div class="cell-score" style="color:${scoreColor(o?.poang)}">${o?.poang ?? "—"}</div>
      <div class="cell-comment">${esc(o?.kommentar)}</div>
    </div>`;

  const html = `<!doctype html><html lang="sv"><head><meta charset="utf-8">
<title>SEO & AEO-rapport – ${esc(clientName)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1f2937; margin: 0; padding: 32px; }
  .top { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid ${primaryColor}; padding-bottom:14px; margin-bottom:20px; }
  .brand { font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:1px; color:${primaryColor}; }
  .client { font-size:22px; font-weight:800; margin-top:2px; }
  .meta { font-size:11px; color:#6b7280; text-align:right; line-height:1.6; }
  h1.betyg { font-size:19px; margin:0 0 6px; }
  .summary { font-size:13px; color:#374151; line-height:1.6; margin:0 0 18px; }
  .scorecard { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin:0 0 22px; }
  .cell { border:1px solid #e5e7eb; border-radius:8px; padding:10px; }
  .cell-label { font-size:9px; text-transform:uppercase; letter-spacing:.5px; color:#6b7280; }
  .cell-score { font-size:26px; font-weight:800; }
  .cell-comment { font-size:10px; color:#6b7280; line-height:1.4; }
  h2 { font-size:14px; margin:20px 0 8px; padding-bottom:4px; border-bottom:1px solid #e5e7eb; }
  .good { background:#ecfdf5; border:1px solid #d1fae5; border-radius:8px; padding:10px; margin-bottom:8px; }
  .good .t { font-weight:700; font-size:13px; }
  .good .w { font-size:11px; color:#4b5563; margin-top:2px; }
  .item { border:1px solid #e5e7eb; border-radius:8px; padding:12px; margin-bottom:10px; page-break-inside:avoid; }
  .item .h { display:flex; justify-content:space-between; gap:8px; }
  .item .t { font-weight:700; font-size:13px; }
  .badges span { font-size:9px; font-weight:800; text-transform:uppercase; padding:2px 7px; border-radius:999px; margin-left:4px; }
  .b-hog{background:#fee2e2;color:#b91c1c;} .b-medel{background:#fef3c7;color:#b45309;} .b-lag{background:#f3f4f6;color:#6b7280;}
  .e-stor{background:#d1fae5;color:#047857;} .e-medel{background:#dbeafe;color:#1d4ed8;} .e-liten{background:#f3f4f6;color:#9ca3af;}
  .row { font-size:11px; color:#374151; margin-top:5px; } .row b { color:#111827; }
  .ex { font-family:ui-monospace,Menlo,Consolas,monospace; font-size:10px; background:#f9fafb; border:1px solid #f3f4f6; border-radius:6px; padding:8px; margin-top:6px; white-space:pre-wrap; }
  .box { border:1px solid #e5e7eb; border-radius:8px; padding:12px; background:${primaryColor}0D; margin-top:8px; }
  ul { margin:6px 0; padding-left:18px; } li { font-size:11px; margin:2px 0; }
  .foot { margin-top:26px; padding-top:10px; border-top:1px solid #e5e7eb; font-size:10px; color:#9ca3af; text-align:center; }
  @media print { body { padding:0; } @page { margin:18mm; } }
</style></head><body>
  <div class="top">
    <div><div class="brand">SEO &amp; AEO-rapport</div><div class="client">${esc(clientName)}</div></div>
    <div class="meta">${esc(url)}<br>${esc(datum)}</div>
  </div>
  <h1 class="betyg">${esc(report.betyg)}</h1>
  <p class="summary">${esc(report.sammanfattning)}</p>
  ${sc ? `<div class="scorecard">${cell("Google (SEO)", sc.seo)}${cell("AI-sökmotorer (AEO)", sc.aeo)}${cell("Innehåll", sc.innehall)}${cell("Trovärdighet (E-E-A-T)", sc.eeat)}</div>` : ""}
  ${report.styrkor?.length ? `<h2>Det här är bra</h2>${report.styrkor.map(s => `<div class="good"><div class="t">${esc(s.rubrik)}</div><div class="w">${esc(s.varfor)}</div></div>`).join("")}` : ""}
  ${forb.length ? `<h2>Prioriterade åtgärder</h2>${forb.map((f, i) => `
    <div class="item">
      <div class="h"><div class="t">${i + 1}. ${esc(f.rubrik)}</div>
        <div class="badges"><span class="b-${f.prioritet === "hög" ? "hog" : f.prioritet === "medel" ? "medel" : "lag"}">${esc(f.prioritet)} prio</span>${f.effekt ? `<span class="e-${f.effekt === "stor" ? "stor" : f.effekt === "medel" ? "medel" : "liten"}">${esc(f.effekt)} effekt</span>` : ""}</div>
      </div>
      <div class="row"><b>Varför:</b> ${esc(f.varfor)}</div>
      <div class="row"><b>Så här:</b> ${esc(f.sa_har)}</div>
      ${f.exempel && f.exempel.trim() ? `<div class="ex">${esc(f.exempel)}</div>` : ""}
    </div>`).join("")}` : ""}
  ${report.citerbarhet ? `<h2>Citerbarhet i AI-sökmotorer</h2><div class="box"><div class="t" style="font-weight:700;font-size:13px;">${esc(report.citerbarhet.omdome)}</div><div class="row">${esc(report.citerbarhet.motivering)}</div>${report.citerbarhet.forslag ? `<div class="row"><b>Gör så här:</b> ${esc(report.citerbarhet.forslag)}</div>` : ""}</div>` : ""}
  ${report.eeat && (report.eeat.omdome || report.eeat.saknas?.length) ? `<h2>Trovärdighet (E-E-A-T)</h2>${report.eeat.omdome ? `<div class="row">${esc(report.eeat.omdome)}</div>` : ""}${report.eeat.saknas?.length ? `<ul>${report.eeat.saknas.map(s => `<li>${esc(s)}</li>`).join("")}</ul>` : ""}` : ""}
  <div class="foot">Genererad av Cockpit · ${esc(clientName)}</div>
</body></html>`;

  const w = window.open("", "_blank");
  if (!w) { alert("Tillåt popup-fönster för att ladda ner rapporten."); return; }
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}

function ReportView({ report, primaryColor, clientName, url, auditedAt }: { report: Report; primaryColor: string; clientName: string; url: string; auditedAt: string }) {
  const order = { hög: 0, medel: 1, låg: 2 } as const;
  const prioColor: Record<string, string> = {
    hög: "bg-red-100 text-red-700",
    medel: "bg-amber-100 text-amber-700",
    låg: "bg-gray-100 text-gray-600",
  };
  const effektColor: Record<string, string> = {
    stor: "bg-emerald-100 text-emerald-700",
    medel: "bg-blue-100 text-blue-700",
    liten: "bg-gray-100 text-gray-500",
  };
  const forbattringar = [...(report.forbattringar || [])].sort(
    (a, b) => (order[a.prioritet] ?? 9) - (order[b.prioritet] ?? 9)
  );
  const sc = report.scorecard;

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-5" style={{ background: `${primaryColor}0D` }}>
        <div className="flex items-start justify-between gap-3">
          <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: primaryColor }}>
            Din SEO &amp; AEO-rapport
          </div>
          <button
            onClick={() => printReport(report, { clientName, url, auditedAt, primaryColor })}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border bg-white hover:bg-gray-50 flex-shrink-0"
            style={{ color: primaryColor, borderColor: `${primaryColor}40` }}
          >
            <Download className="w-3.5 h-3.5" />
            Ladda ner som PDF
          </button>
        </div>
        <div className="font-display font-bold text-gray-900 text-xl mt-0.5">{report.betyg}</div>
        <p className="text-sm text-gray-700 mt-1.5 leading-relaxed">{report.sammanfattning}</p>
      </div>

      {/* Scorecard */}
      {sc && (
        <div className="grid grid-cols-2 md:grid-cols-4 border-b border-gray-100">
          <ScoreCell label="Google (SEO)" v={sc.seo?.poang} comment={sc.seo?.kommentar} />
          <ScoreCell label="AI-sökmotorer (AEO)" v={sc.aeo?.poang} comment={sc.aeo?.kommentar} />
          <ScoreCell label="Innehåll" v={sc.innehall?.poang} comment={sc.innehall?.kommentar} />
          <ScoreCell label="Trovärdighet (E-E-A-T)" v={sc.eeat?.poang} comment={sc.eeat?.kommentar} />
        </div>
      )}

      <div className="p-5 space-y-5">
        {/* Styrkor */}
        {report.styrkor?.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700 mb-2">
              <CheckCircle2 className="w-4 h-4" /> Det här är bra
            </div>
            <ul className="space-y-2">
              {report.styrkor.map((s, i) => (
                <li key={i} className="bg-emerald-50 border border-emerald-100 rounded-lg p-3">
                  <div className="text-sm font-medium text-gray-900">{s.rubrik}</div>
                  <div className="text-xs text-gray-600 mt-0.5">{s.varfor}</div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Förbättringar */}
        {forbattringar.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 text-sm font-semibold text-amber-700 mb-2">
              <AlertCircle className="w-4 h-4" /> Prioriterade åtgärder
            </div>
            <ol className="space-y-2.5">
              {forbattringar.map((f, i) => (
                <li key={i} className="bg-white border border-gray-200 rounded-lg p-3.5">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="text-sm font-semibold text-gray-900">{i + 1}. {f.rubrik}</div>
                    <div className="flex gap-1 flex-shrink-0">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${prioColor[f.prioritet] || prioColor["låg"]}`}>{f.prioritet} prio</span>
                      {f.effekt && <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${effektColor[f.effekt] || effektColor["liten"]}`}>{f.effekt} effekt</span>}
                    </div>
                  </div>
                  <div className="text-xs text-gray-600"><strong className="text-gray-700">Varför:</strong> {f.varfor}</div>
                  <div className="text-xs text-gray-800 mt-1"><strong className="text-gray-700">Så här:</strong> {f.sa_har}</div>
                  {f.exempel && f.exempel.trim() && (
                    <div className="mt-2 text-xs bg-gray-50 border border-gray-100 rounded p-2 text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">{f.exempel}</div>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Citerbarhet för AI */}
        {report.citerbarhet && (
          <div className="rounded-lg border border-gray-200 p-3.5" style={{ background: `${primaryColor}08` }}>
            <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 mb-1">
              <Sparkles className="w-4 h-4" style={{ color: primaryColor }} /> Citerbarhet i AI-sökmotorer
            </div>
            <div className="text-sm font-medium text-gray-800">{report.citerbarhet.omdome}</div>
            <div className="text-xs text-gray-600 mt-1">{report.citerbarhet.motivering}</div>
            {report.citerbarhet.forslag && (
              <div className="text-xs text-gray-800 mt-1.5"><strong className="text-gray-700">Gör så här:</strong> {report.citerbarhet.forslag}</div>
            )}
          </div>
        )}

        {/* E-E-A-T saknas */}
        {report.eeat && (report.eeat.omdome || (report.eeat.saknas?.length ?? 0) > 0) && (
          <div>
            <div className="text-sm font-semibold text-gray-900 mb-1">Trovärdighet (E-E-A-T)</div>
            {report.eeat.omdome && <div className="text-xs text-gray-600 mb-1.5">{report.eeat.omdome}</div>}
            {report.eeat.saknas?.length > 0 && (
              <ul className="text-xs text-gray-700 list-disc pl-5 space-y-0.5">
                {report.eeat.saknas.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ScoreCell({ label, v, comment }: { label: string; v?: number; comment?: string }) {
  const val = typeof v === "number" ? v : null;
  const color = val == null ? "text-gray-400" : val >= 80 ? "text-emerald-600" : val >= 60 ? "text-amber-600" : "text-red-600";
  return (
    <div className="p-3 border-r border-b border-gray-100 last:border-r-0">
      <div className="text-[10px] text-gray-500 uppercase tracking-wide leading-tight">{label}</div>
      <div className={`text-2xl font-bold tabular-nums ${color}`}>{val ?? "—"}</div>
      {comment && <div className="text-[11px] text-gray-500 leading-snug mt-0.5">{comment}</div>}
    </div>
  );
}

function ScoreBox({ label, v }: { label: string; v: number }) {
  const c = v >= 80 ? "text-emerald-700 bg-emerald-50" : v >= 60 ? "text-amber-700 bg-amber-50" : "text-red-700 bg-red-50";
  return <div className={`rounded-lg p-2 text-center ${c}`}><div className="text-xl font-bold tabular-nums">{v}</div><div className="text-[10px] opacity-70">{label}</div></div>;
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

function Mini({ label, value, ok }: { label: string; value: string | number; ok: boolean }) {
  return (
    <div className={`px-3 py-2 rounded-lg border ${ok ? "bg-emerald-50 border-emerald-100" : "bg-amber-50 border-amber-100"}`}>
      <div className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</div>
      <div className={`text-sm font-medium ${ok ? "text-emerald-700" : "text-amber-700"}`}>{value}</div>
    </div>
  );
}
