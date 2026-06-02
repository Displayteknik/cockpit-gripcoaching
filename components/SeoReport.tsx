"use client";

// Delad SEO/AEO-rapport — används av BÅDE kund-portalen (/k/seo) och admin (/dashboard/seo).
// SeoReportBlock sköter knapp + hämtning + rendering + PDF för EN audit.

import { useState } from "react";
import { FileText, Download, Loader2, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";

export interface SeoReport {
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
  teknik?: {
    plattform: string;
    indexerbar: boolean;
    canonical: string | null;
    canonical_kalla: string;
    lighthouse_seo: number | null;
    sitemap_urls: number | null;
    cwv: { lcp: CwvCell | null; inp: CwvCell | null; cls: CwvCell | null } | null;
    checkar: { label: string; pass: boolean; detail: string }[];
  };
  sokord?: { query: string; clicks: number; impressions: number; ctr: number | null; position: number | null }[];
}

type CwvCell = { value: number; category: string };
const cwvColor = (c?: string) => (c === "good" ? "text-emerald-600" : c === "needs-improvement" ? "text-amber-600" : c === "poor" ? "text-red-600" : "text-gray-400");
const cwvLcp = (v: number) => `${(v / 1000).toFixed(1)} s`;
const cwvInp = (v: number) => `${Math.round(v)} ms`;
const cwvCls = (v: number) => v.toFixed(2);

export function SeoReportBlock({
  auditId,
  url,
  auditedAt,
  clientName,
  primaryColor = "#10B981",
}: {
  auditId: string;
  url: string;
  auditedAt: string;
  clientName: string;
  primaryColor?: string;
}) {
  const [report, setReport] = useState<SeoReport | null>(null);
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    try {
      const r = await fetch("/api/seo/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auditId }),
      });
      const d = await r.json();
      if (r.ok) setReport(d);
      else alert("Kunde inte skapa rapport: " + (d.error || "okänt"));
    } finally {
      setLoading(false);
    }
  }

  if (!report) {
    return (
      <button
        onClick={generate}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
        style={{ background: primaryColor }}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
        {loading ? "Skriver rapport (läser hela sidan)..." : "Förklara resultatet (rapport)"}
      </button>
    );
  }

  return <ReportView report={report} primaryColor={primaryColor} clientName={clientName} url={url} auditedAt={auditedAt} />;
}

function ReportView({
  report,
  primaryColor,
  clientName,
  url,
  auditedAt,
}: {
  report: SeoReport;
  primaryColor: string;
  clientName: string;
  url: string;
  auditedAt: string;
}) {
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
            SEO &amp; AEO-rapport
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
        {report.teknik && (
          <div>
            <div className="text-sm font-semibold text-gray-900 mb-2">Teknik &amp; prestanda <span className="text-[10px] font-normal text-gray-400">(uppmätt)</span></div>
            <div className="flex flex-wrap gap-2 mb-2">
              <span className={`text-xs px-2 py-1 rounded-lg border ${report.teknik.indexerbar ? "bg-emerald-50 border-emerald-100 text-emerald-700" : "bg-red-50 border-red-100 text-red-700"}`}>
                {report.teknik.indexerbar ? "Indexerbar" : "EJ indexerbar"}
              </span>
              <span className="text-xs px-2 py-1 rounded-lg border bg-gray-50 border-gray-100 text-gray-600">Plattform: {report.teknik.plattform}</span>
              {report.teknik.lighthouse_seo != null && <span className="text-xs px-2 py-1 rounded-lg border bg-gray-50 border-gray-100 text-gray-600">Lighthouse SEO: {report.teknik.lighthouse_seo}</span>}
              <span className={`text-xs px-2 py-1 rounded-lg border ${report.teknik.canonical_kalla === "none" ? "bg-red-50 border-red-100 text-red-700" : "bg-gray-50 border-gray-100 text-gray-600"}`}>
                Canonical: {report.teknik.canonical_kalla === "none" ? "saknas" : report.teknik.canonical_kalla === "payload" ? "renderad" : "ok"}
              </span>
              {report.teknik.sitemap_urls != null && <span className="text-xs px-2 py-1 rounded-lg border bg-gray-50 border-gray-100 text-gray-600">Sitemap: {report.teknik.sitemap_urls} URL:er</span>}
            </div>
            {report.teknik.cwv && (
              <div className="grid grid-cols-3 gap-2 mb-2">
                {([["LCP", report.teknik.cwv.lcp, cwvLcp], ["INP", report.teknik.cwv.inp, cwvInp], ["CLS", report.teknik.cwv.cls, cwvCls]] as const).map(([label, cell, fmt]) => (
                  <div key={label} className="border border-gray-100 rounded-lg p-2 text-center">
                    <div className="text-[10px] text-gray-500 uppercase">{label}</div>
                    <div className={`text-lg font-bold tabular-nums ${cwvColor(cell?.category)}`}>{cell ? fmt(cell.value) : "—"}</div>
                  </div>
                ))}
              </div>
            )}
            {report.teknik.checkar?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {report.teknik.checkar.map((c, i) => (
                  <span key={i} className={`text-[11px] px-2 py-0.5 rounded-full ${c.pass ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`} title={c.detail}>
                    {c.pass ? "✓" : "✕"} {c.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {report.sokord && report.sokord.length > 0 && (
          <div>
            <div className="text-sm font-semibold text-gray-900 mb-2">Sökord i Google <span className="text-[10px] font-normal text-gray-400">(Search Console)</span></div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="text-gray-500 text-left border-b border-gray-100">
                  <th className="py-1 pr-2 font-medium">Sökord</th><th className="py-1 px-2 font-medium text-right">Visn.</th><th className="py-1 px-2 font-medium text-right">Klick</th><th className="py-1 px-2 font-medium text-right">CTR</th><th className="py-1 pl-2 font-medium text-right">Pos.</th>
                </tr></thead>
                <tbody>
                  {report.sokord.slice(0, 10).map((k, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="py-1 pr-2 text-gray-800">{k.query}</td>
                      <td className="py-1 px-2 text-right tabular-nums text-gray-600">{k.impressions}</td>
                      <td className="py-1 px-2 text-right tabular-nums text-gray-600">{k.clicks}</td>
                      <td className="py-1 px-2 text-right tabular-nums text-gray-600">{k.ctr != null ? (k.ctr * 100).toFixed(1) + "%" : "—"}</td>
                      <td className="py-1 pl-2 text-right tabular-nums text-gray-600">{k.position != null ? k.position.toFixed(1) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

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

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function printReport(report: SeoReport, ctx: { clientName: string; url: string; auditedAt: string; primaryColor: string }) {
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
  ${report.teknik ? (() => {
    const t = report.teknik!;
    const cc = (c?: string) => (c === "good" ? "#059669" : c === "needs-improvement" ? "#d97706" : c === "poor" ? "#dc2626" : "#9ca3af");
    const cwvHtml = t.cwv ? `<div class="scorecard" style="grid-template-columns:repeat(3,1fr);">
      <div class="cell"><div class="cell-label">LCP</div><div class="cell-score" style="color:${cc(t.cwv.lcp?.category)}">${t.cwv.lcp ? (t.cwv.lcp.value / 1000).toFixed(1) + " s" : "—"}</div></div>
      <div class="cell"><div class="cell-label">INP</div><div class="cell-score" style="color:${cc(t.cwv.inp?.category)}">${t.cwv.inp ? Math.round(t.cwv.inp.value) + " ms" : "—"}</div></div>
      <div class="cell"><div class="cell-label">CLS</div><div class="cell-score" style="color:${cc(t.cwv.cls?.category)}">${t.cwv.cls ? t.cwv.cls.value.toFixed(2) : "—"}</div></div>
    </div>` : "";
    const checks = t.checkar?.length ? `<div style="margin-top:6px;">${t.checkar.map(c => `<span style="display:inline-block;font-size:10px;padding:2px 7px;border-radius:999px;margin:2px;background:${c.pass ? "#ecfdf5" : "#fee2e2"};color:${c.pass ? "#047857" : "#b91c1c"};">${c.pass ? "✓" : "✕"} ${esc(c.label)}</span>`).join("")}</div>` : "";
    return `<h2>Teknik &amp; prestanda (uppmätt)</h2>
      <div class="row"><b>Indexerbar:</b> ${t.indexerbar ? "Ja" : "NEJ"} &nbsp;·&nbsp; <b>Plattform:</b> ${esc(t.plattform)} &nbsp;·&nbsp; <b>Canonical:</b> ${t.canonical_kalla === "none" ? "saknas" : t.canonical_kalla === "payload" ? "renderad" : "ok"}${t.lighthouse_seo != null ? ` &nbsp;·&nbsp; <b>Lighthouse SEO:</b> ${t.lighthouse_seo}` : ""}${t.sitemap_urls != null ? ` &nbsp;·&nbsp; <b>Sitemap:</b> ${t.sitemap_urls} URL:er` : ""}</div>
      ${cwvHtml}${checks}`;
  })() : ""}
  ${report.sokord?.length ? `<h2>Sökord i Google (Search Console)</h2>
    <table style="width:100%;border-collapse:collapse;font-size:11px;">
      <tr style="text-align:left;border-bottom:1px solid #e5e7eb;color:#6b7280;"><th style="padding:3px 4px;">Sökord</th><th style="padding:3px 4px;text-align:right;">Visn.</th><th style="padding:3px 4px;text-align:right;">Klick</th><th style="padding:3px 4px;text-align:right;">CTR</th><th style="padding:3px 4px;text-align:right;">Pos.</th></tr>
      ${report.sokord.slice(0, 10).map(k => `<tr style="border-bottom:1px solid #f3f4f6;"><td style="padding:3px 4px;">${esc(k.query)}</td><td style="padding:3px 4px;text-align:right;">${k.impressions}</td><td style="padding:3px 4px;text-align:right;">${k.clicks}</td><td style="padding:3px 4px;text-align:right;">${k.ctr != null ? (k.ctr * 100).toFixed(1) + "%" : "—"}</td><td style="padding:3px 4px;text-align:right;">${k.position != null ? k.position.toFixed(1) : "—"}</td></tr>`).join("")}
    </table>` : ""}
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
