"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Eye, Search, TrendingUp, MousePointerClick, Gauge, Smartphone, Repeat, Award, Target, Zap, ExternalLink, Loader2, RefreshCw, AlertCircle, Trophy, Info, FileText, BookOpen, X, Copy, Check, Sparkles, ChevronDown, TrendingDown, LineChart } from "lucide-react";

type Period = 7 | 14 | 30 | 90;

// Statiska Tailwind-klasser för "Att göra idag"-rutans accentfärger (måste vara hela strängar för att byggas).
const ACTION_ACCENT = {
  amber: { chip: "bg-amber-100 text-amber-700", btn: "bg-amber-600 hover:bg-amber-700" },
  blue: { chip: "bg-blue-100 text-blue-700", btn: "bg-blue-600 hover:bg-blue-700" },
  purple: { chip: "bg-purple-100 text-purple-700", btn: "bg-purple-600 hover:bg-purple-700" },
  violet: { chip: "bg-violet-100 text-violet-700", btn: "bg-violet-600 hover:bg-violet-700" },
  rose: { chip: "bg-rose-100 text-rose-700", btn: "bg-rose-600 hover:bg-rose-700" },
} as const;

interface Dashboard {
  period: { days: number; since: string; until: string };
  client: { name: string; public_url: string | null } | null;
  gsc_last_sync: { imported_at: string | null; period_start: string | null; period_end: string | null; days: number | null } | null;
  kpi: {
    visits: number;
    pageviews?: number;
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
  position_distribution_queries?: Record<"top3" | "top10" | "top20" | "beyond", Array<{ query: string; clicks: number; impressions: number; avg_position: number | null; ctr: number; page?: string | null }>>;
  brand_split: { brand: { clicks: number; impressions: number }; non_brand: { clicks: number; impressions: number } };
  quick_wins: Array<{ query: string; clicks: number; impressions: number; avg_position: number | null; ctr: number; page?: string | null }>;
  queries_top: Array<{ query: string; clicks: number; impressions: number; avg_position: number | null; ctr: number; page_count: number }>;
  queries_all_count: number;
  top_pages: Array<{ page: string; clicks: number; impressions: number; queryCount: number }>;
  traffic_series: Array<{ date: string; visits: number }>;
  gsc_daily_series?: Array<{ date: string; clicks: number; impressions: number; ctr: number; position: number }>;
  ga4?: {
    property_id: string;
    sessions: number; users: number; newUsers: number; engagedSessions: number; engagementRate: number; avgSessionSec: number; pageviews: number;
    channels: Array<{ channel: string; sessions: number }>;
    ai: { sessions: number; sources: Array<{ source: string; sessions: number }> };
    daily: Array<{ date: string; sessions: number }>;
  } | null;
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
  const [openBand, setOpenBand] = useState<"top3" | "top10" | "top20" | "beyond" | null>(null);

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

  // Auto-synka GSC nar user byter period och datan inte matchar perioden
  async function changePeriod(p: Period) {
    setPeriod(p);
    // Om GSC-data ar synkad for annan period — auto-synka
    if (data?.gsc_last_sync?.days && data.gsc_last_sync.days !== p) {
      await syncGsc(p);
    }
  }

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

  async function downloadPdf() {
    if (!reportText) return;
    // jsPDF:s inbyggda typsnitt klarar bara Latin-1 (WinAnsi). Pilar/emoji utanför det
    // ger skräptecken OCH får hela raden att rendera bokstav-för-bokstav. Mappa kända + strip resten.
    const GLYPH: Record<string, string> = { "→": "->", "←": "<-", "✅": "OK", "✔": "OK", "✓": "OK", "❌": "X", "✗": "X", "✘": "X", "⚠": "!" };
    const safe = (s: string) => s.replace(/[←-⇿⌀-➿⬀-⯿️\u{1F000}-\u{1FAFF}]/gu, (m) => GLYPH[m] ?? "");
    const name = data?.client?.name ?? "Klient";
    const filename = `seo-aeo-rapport-${name.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.pdf`;
    try {
      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const pageW = 210, pageH = 297, mL = 14, mR = 14, mT = 16, mB = 16;
      const contentW = pageW - mL - mR;
      let y = mT;
      let firstHeading = true;
      const DARK: [number, number, number] = [31, 58, 95];
      const MID: [number, number, number] = [46, 89, 132];
      const TEXT: [number, number, number] = [31, 41, 55];
      const lh = (fs: number) => fs * 0.3528 * 1.34;
      const ensure = (h: number) => { if (y + h > pageH - mB) { doc.addPage(); y = mT; } };

      const parseInline = (s: string) => {
        s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1");
        const segs: { t: string; b: boolean; m: boolean }[] = [];
        const re = /(\*\*([^*]+)\*\*|`([^`]+)`)/g;
        let idx = 0, mt: RegExpExecArray | null;
        while ((mt = re.exec(s))) {
          if (mt.index > idx) segs.push({ t: s.slice(idx, mt.index), b: false, m: false });
          if (mt[2] != null) segs.push({ t: mt[2], b: true, m: false });
          else segs.push({ t: mt[3], b: false, m: true });
          idx = mt.index + mt[0].length;
        }
        if (idx < s.length) segs.push({ t: s.slice(idx), b: false, m: false });
        return segs.length ? segs : [{ t: s, b: false, m: false }];
      };

      const drawRich = (str: string, fs: number, x0: number, maxW: number) => {
        doc.setFontSize(fs); doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
        const lineH = lh(fs);
        const words: { w: string; b: boolean; m: boolean }[] = [];
        parseInline(str).forEach((sg) => sg.t.split(/(\s+)/).forEach((p) => { if (p !== "") words.push({ w: p, b: sg.b, m: sg.m }); }));
        ensure(lineH);
        let x = x0;
        const setF = (b: boolean, m: boolean) => doc.setFont(m ? "courier" : "helvetica", b ? "bold" : "normal");
        for (const wd of words) {
          setF(wd.b, wd.m);
          if (/^\s+$/.test(wd.w)) { x += doc.getTextWidth(wd.w); continue; }
          const ww = doc.getTextWidth(wd.w);
          if (x + ww > x0 + maxW && x > x0) { y += lineH; x = x0; ensure(lineH); }
          doc.text(wd.w, x, y); x += ww;
        }
        y += lineH;
      };

      const lines = safe(reportText).replace(/\r/g, "").split("\n");
      let i = 0;
      while (i < lines.length) {
        const line = lines[i];

        if (/^```/.test(line)) {
          i++;
          const buf: string[] = [];
          while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++; }
          i++;
          doc.setFont("courier", "normal"); doc.setFontSize(8);
          const wrapped: string[] = [];
          buf.forEach((b) => { (doc.splitTextToSize(b === "" ? " " : b, contentW - 6) as string[]).forEach((w) => wrapped.push(w)); });
          const lineH = lh(8);
          let j = 0;
          while (j < wrapped.length) {
            let canLines = Math.floor((pageH - mB - y - 4) / lineH);
            if (canLines <= 0) { doc.addPage(); y = mT; canLines = Math.floor((pageH - mB - mT - 4) / lineH); }
            const chunk = wrapped.slice(j, j + canLines);
            const boxH = chunk.length * lineH + 4;
            doc.setFillColor(244, 244, 244); doc.rect(mL, y, contentW, boxH, "F");
            doc.setTextColor(40, 40, 40); doc.setFont("courier", "normal"); doc.setFontSize(8);
            let ty = y + 3 + lineH * 0.7;
            chunk.forEach((cl) => { doc.text(cl, mL + 3, ty); ty += lineH; });
            y += boxH + 2; j += chunk.length;
          }
          continue;
        }

        if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
          const head = line.split("|").slice(1, -1).map((c) => c.trim().replace(/\*\*/g, ""));
          i += 2;
          const rows: string[][] = [];
          while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) { rows.push(lines[i].split("|").slice(1, -1).map((c) => c.trim().replace(/\*\*/g, "").replace(/`/g, ""))); i++; }
          autoTable(doc, {
            startY: y,
            head: [head],
            body: rows,
            styles: { fontSize: 8, cellPadding: 2, overflow: "linebreak", textColor: TEXT, lineColor: [221, 221, 221], lineWidth: 0.1 },
            headStyles: { fillColor: DARK, textColor: [255, 255, 255], fontStyle: "bold" },
            alternateRowStyles: { fillColor: [245, 248, 251] },
            margin: { left: mL, right: mR },
            theme: "grid",
          });
          y = (((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY) ?? y) + 4;
          continue;
        }

        const hm = line.match(/^(#{1,6})\s+(.*)$/);
        if (hm) {
          const level = hm[1].length;
          const txt = hm[2].replace(/\*\*/g, "").replace(/`/g, "");
          if (level === 1) {
            if (!firstHeading) { doc.addPage(); y = mT; }
            firstHeading = false;
            y += 2; doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(DARK[0], DARK[1], DARK[2]);
            (doc.splitTextToSize(txt, contentW) as string[]).forEach((w) => { ensure(lh(16)); doc.text(w, mL, y + 5); y += lh(16); });
            doc.setDrawColor(DARK[0], DARK[1], DARK[2]); doc.setLineWidth(0.8); doc.line(mL, y + 1, pageW - mR, y + 1); y += 6;
          } else if (level === 2) {
            ensure(14); y += 3; doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(MID[0], MID[1], MID[2]);
            (doc.splitTextToSize(txt, contentW) as string[]).forEach((w) => { ensure(lh(13)); doc.text(w, mL, y + 4); y += lh(13); });
            doc.setDrawColor(225, 229, 235); doc.setLineWidth(0.3); doc.line(mL, y + 0.5, pageW - mR, y + 0.5); y += 4;
          } else {
            const fs = level === 3 ? 11 : 10;
            ensure(lh(fs) + 2); y += 2; doc.setFont("helvetica", "bold"); doc.setFontSize(fs); doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
            (doc.splitTextToSize(txt, contentW) as string[]).forEach((w) => { ensure(lh(fs)); doc.text(w, mL, y + 3); y += lh(fs); });
            y += 2;
          }
          i++; continue;
        }

        if (/^---+\s*$/.test(line)) { ensure(4); doc.setDrawColor(225, 229, 235); doc.setLineWidth(0.3); doc.line(mL, y, pageW - mR, y); y += 4; i++; continue; }

        if (/^>\s?/.test(line)) {
          const buf: string[] = [];
          while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, "")); i++; }
          const startY = y; y += 1.5;
          buf.forEach((b) => drawRich(b || " ", 10, mL + 5, contentW - 7));
          y += 1.5;
          doc.setDrawColor(MID[0], MID[1], MID[2]); doc.setLineWidth(1.2); doc.line(mL + 1.5, startY, mL + 1.5, y - 1.5); y += 2;
          continue;
        }

        if (/^\s*[-*]\s+/.test(line)) {
          while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
            const txt = lines[i].replace(/^\s*[-*]\s+/, ""); i++;
            doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
            ensure(lh(10)); doc.text("•", mL + 2, y);
            drawRich(txt, 10, mL + 6, contentW - 6);
          }
          y += 1; continue;
        }

        if (/^\s*\d+\.\s+/.test(line)) {
          let n = 1;
          while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
            const txt = lines[i].replace(/^\s*\d+\.\s+/, ""); i++;
            doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
            ensure(lh(10)); doc.text(`${n}.`, mL + 2, y); n++;
            drawRich(txt, 10, mL + 8, contentW - 8);
          }
          y += 1; continue;
        }

        if (/^\s*$/.test(line)) { y += 2; i++; continue; }

        const buf: string[] = [];
        while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^(#{1,6}\s|```|>\s?|\s*[-*]\s+|\s*\d+\.\s+|\s*\|)/.test(lines[i])) { buf.push(lines[i]); i++; }
        buf.forEach((b) => drawRich(b, 10, mL, contentW));
        y += 1.5;
      }
      doc.save(filename);
    } catch (e) {
      alert("Kunde inte skapa PDF: " + (e as Error).message);
    }
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

  // "Att göra idag" — syntetiserar 1-3 prioriterade åtgärder ur klientens EGEN data.
  // Prioordning: snabbaste vinsten > sida-2-sökord > brand-beroende > AI-synlighet > svag CTR.
  type Action = { icon: typeof Trophy; accent: keyof typeof ACTION_ACCENT; title: string; detail: string; href?: string; report?: boolean; cta?: string };
  const actions: Action[] = [];

  const qw0 = data.quick_wins[0];
  if (qw0) {
    const pot = Math.round(qw0.impressions * 0.25);
    // sid_url → optimeraren läser in sidans text automatiskt (ingen manuell inklistring).
    const href = `/dashboard/specialister/geo-aeo-optimizer?amne=${encodeURIComponent(qw0.query)}${qw0.page ? `&sid_url=${encodeURIComponent(qw0.page)}` : ""}`;
    actions.push({ icon: Trophy, accent: "amber", title: `Optimera "${qw0.query}" — snabbaste vinsten`, detail: `Position ${qw0.avg_position}, ${qw0.impressions.toLocaleString("sv-SE")} visningar. Klättrar den till topp 3 ≈ +${pot} klick/mån.`, href, cta: "Optimera nu" });
  }

  if (pd.top20 > 0) {
    actions.push({ icon: Target, accent: "blue", title: `${pd.top20} sökord ligger på sida 2 (position 11–20)`, detail: `De är närmast att lyfta till sida 1. Öppna bandet "11–20" i "Var rankar du?" nedan för att se exakt vilka.` });
  }

  const bClicks = data.brand_split.brand.clicks;
  const totClicks = bClicks + data.brand_split.non_brand.clicks;
  if (totClicks >= 5 && bClicks / totClicks > 0.7) {
    actions.push({ icon: Repeat, accent: "purple", title: `${Math.round((bClicks / totClicks) * 100)}% av klicken kommer från ert eget namn`, detail: `Ni hittas mest av folk som redan känner till er. Skapa innehåll för det ni säljer (icke-brand-sökord) för att nå nya kunder.` });
  }

  if (data.ga4 && data.ga4.ai.sessions === 0) {
    actions.push({ icon: Sparkles, accent: "violet", title: `Inga besök från AI-sökmotorer än`, detail: `ChatGPT, Copilot och Perplexity citerar dig inte. Kör djupgranskningens AEO/GEO-åtgärder: definitioner, jämförelsetabeller och konkreta siffror.`, report: true, cta: "Generera djupgranskning" });
  }

  const ctrLow = data.queries_top.find((q) => q.avg_position !== null && q.avg_position <= 10 && q.impressions >= 50 && q.ctr < 1);
  if (ctrLow) {
    actions.push({ icon: AlertCircle, accent: "rose", title: `"${ctrLow.query}" syns högt men får få klick`, detail: `Position ${ctrLow.avg_position}, ${ctrLow.impressions.toLocaleString("sv-SE")} visningar men bara ${ctrLow.ctr}% CTR. Skriv en mer lockande sidtitel och meta-beskrivning.` });
  }

  const todoActions = actions.slice(0, 3);

  return (
    <div className="space-y-6">
      {/* ATT GÖRA IDAG — syntetiserade prioriteringar ur klientens egen data */}
      <div className="bg-gradient-to-br from-slate-50 to-emerald-50/40 border border-emerald-200 rounded-xl p-5">
        <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
          <Zap className="w-4 h-4 text-emerald-600" />
          Att göra idag
        </h3>
        <p className="text-xs text-gray-500 mb-4">De 1–3 åtgärder som ger mest effekt just nu — uträknade ur din egen data.</p>
        {todoActions.length === 0 ? (
          <div className="flex items-start gap-2 text-sm text-gray-600 bg-white border border-gray-100 rounded-lg p-3">
            <Check className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
            <span>Inga akuta åtgärder i datan. Kör månadsrutinen i <button onClick={() => setShowHandbok(true)} className="text-emerald-700 font-medium hover:underline">Handboken</button> eller en <button onClick={generateReport} className="text-emerald-700 font-medium hover:underline">djupgranskning</button>.</span>
          </div>
        ) : (
          <ol className="space-y-2">
            {todoActions.map((a, i) => {
              const c = ACTION_ACCENT[a.accent];
              const Icon = a.icon;
              return (
                <li key={i} className="flex items-start gap-3 bg-white border border-gray-100 rounded-lg p-3">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${c.chip}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-900">{i + 1}. {a.title}</div>
                    <div className="text-xs text-gray-600 mt-0.5">{a.detail}</div>
                  </div>
                  {a.href && (
                    <Link href={a.href} className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg text-white flex-shrink-0 ${c.btn}`}>
                      <Sparkles className="w-3 h-3" /> {a.cta}
                    </Link>
                  )}
                  {a.report && (
                    <button onClick={generateReport} disabled={generatingReport} className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg text-white flex-shrink-0 disabled:opacity-50 ${c.btn}`}>
                      <FileText className="w-3 h-3" /> {a.cta}
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>

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
              onClick={() => changePeriod(p)}
              disabled={syncing}
              className={`px-3 py-1.5 text-sm rounded-lg font-medium transition disabled:opacity-50 ${period === p ? "bg-emerald-600 text-white" : "bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200"}`}
            >
              {p === 7 ? "7d" : p === 14 ? "14d" : p === 30 ? "30d" : "90d"}
            </button>
          ))}
          <span className="text-xs ml-3 text-gray-500">
            Trafik (GA4) = vald period{data.gsc_last_sync?.days ? ` · Sök (GSC) = Googles ${data.gsc_last_sync.days}-dagarsfönster` : ""}
          </span>
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

      {/* KPI-RAD — GA4 (auktoritativ trafik) leder när det är kopplat, annars GSC + pixel */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {data.ga4 ? (
          <>
            <KPI icon={TrendingUp} color="purple" label="Besök (GA4)" value={data.ga4.sessions} sub={`${data.ga4.users.toLocaleString("sv-SE")} användare`} />
            <KPI icon={Search} color="emerald" label="Från Google-sök" value={k.gsc_clicks} sub={`CTR ${k.gsc_ctr}% · pos ${k.gsc_avg_position ?? "—"}`} />
            <KPI icon={Sparkles} color="purple" label="AI-besök" value={data.ga4.ai.sessions} sub="ChatGPT, Copilot m.fl." />
            <KPI icon={Award} color="amber" label="Snitt-position" value={k.gsc_avg_position ?? "—"} sub="lägre = bättre" />
            <KPI icon={Eye} color="blue" label="Visningar (Google)" value={k.gsc_impressions} sub={`${k.gsc_keyword_count} sökord`} />
            <KPI icon={Zap} color="teal" label="Engagemang" value={`${data.ga4.engagementRate}%`} sub={`${Math.floor(data.ga4.avgSessionSec / 60)}m ${data.ga4.avgSessionSec % 60}s snitt`} />
          </>
        ) : (
          <>
            <KPI icon={MousePointerClick} color="emerald" label="Klick (Google)" value={k.gsc_clicks} sub={`CTR ${k.gsc_ctr}%`} />
            <KPI icon={Eye} color="blue" label="Visningar (Google)" value={k.gsc_impressions} sub={`${k.gsc_keyword_count} sökord`} />
            <KPI icon={Award} color="amber" label="Snitt-position" value={k.gsc_avg_position ?? "—"} sub="lägre = bättre" />
            <KPI icon={TrendingUp} color="purple" label="Besök (pixel)" value={k.visits} sub={k.pageviews != null ? `${k.pageviews.toLocaleString("sv-SE")} sidvisningar` : ""} />
            <KPI icon={Smartphone} color="pink" label="Mobil-andel" value={`${k.visits_mobile_pct}%`} sub="av besök" />
            <KPI icon={Gauge} color="teal" label="Sid-laddtid" value={k.avg_page_load_ms !== null ? `${k.avg_page_load_ms}ms` : "—"} sub="snitt" />
          </>
        )}
      </div>

      {/* VAR KOMMER BESÖKARNA IFRÅN (GA4) + AI-SYNLIGHET */}
      {data.ga4 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
              <Repeat className="w-4 h-4 text-indigo-600" />
              Var kommer besökarna ifrån
            </h3>
            <p className="text-xs text-gray-500 mb-3">Googles egna kanaler (GA4) — samma siffror som i din Google Analytics. Totalt {data.ga4.sessions.toLocaleString("sv-SE")} besök.</p>
            <div className="space-y-2">
              {data.ga4.channels.map((c) => {
                const pct = data.ga4!.sessions > 0 ? Math.round((c.sessions / data.ga4!.sessions) * 100) : 0;
                return (
                  <div key={c.channel}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-gray-700">{channelSv(c.channel)}</span>
                      <span className="text-gray-500"><strong className="text-gray-900">{c.sessions}</strong> · {pct}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded overflow-hidden">
                      <div className="h-full bg-indigo-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-gradient-to-br from-violet-50 to-fuchsia-50 border border-violet-200 rounded-xl p-5">
            <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-600" />
              AI-synlighet
            </h3>
            <p className="text-xs text-gray-600 mb-3">Besök från AI-sökmotorer (ChatGPT, Copilot, Perplexity, Gemini). 2026 växer den här kanalen snabbt — det är här AEO/GEO-arbetet lönar sig.</p>
            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-3xl font-bold text-violet-700">{data.ga4.ai.sessions}</span>
              <span className="text-sm text-gray-600">AI-besök ({data.period.days} dagar)</span>
            </div>
            {data.ga4.ai.sources.length > 0 ? (
              <div className="space-y-1">
                {data.ga4.ai.sources.map((s) => (
                  <div key={s.source} className="flex items-center justify-between text-xs bg-white/70 rounded-lg px-3 py-1.5">
                    <span className="font-medium text-gray-800">{s.source}</span>
                    <span className="tabular-nums text-gray-600">{s.sessions} besök</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-gray-600 bg-white/70 rounded-lg p-3">
                Inga AI-besök ännu. Kör djupgranskningens AEO/GEO-åtgärder (definitioner, jämförelsetabeller, konkreta siffror) så börjar AI-motorerna citera dig.
              </div>
            )}
          </div>
        </div>
      )}

      {/* UTVECKLING OVER TID — TREND-GRAFER */}
      {(data.gsc_daily_series?.length ?? 0) >= 2 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
            <LineChart className="w-4 h-4 text-indigo-600" />
            Utveckling över tid
          </h3>
          <p className="text-xs text-gray-500 mb-4">Dag för dag. Besök = GA4. Sök = Google Search Console. Position: en stigande linje = du klättrar uppåt (lägre siffra = bättre).</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {data.ga4 && data.ga4.daily.length >= 2 && (
              <TrendChart id="ga4sess" label="Besök (GA4)" color="#7c3aed"
                data={data.ga4.daily.map((d) => ({ date: d.date, value: d.sessions }))} fmt={(v) => Math.round(v).toLocaleString("sv-SE")} />
            )}
            <TrendChart id="pos" label="Snittposition" color="#4f46e5" invert
              data={(data.gsc_daily_series ?? []).filter((d) => d.position > 0).map((d) => ({ date: d.date, value: d.position }))} fmt={(v) => v.toFixed(1)} />
            <TrendChart id="clk" label="Klick" color="#059669"
              data={(data.gsc_daily_series ?? []).map((d) => ({ date: d.date, value: d.clicks }))} fmt={(v) => Math.round(v).toString()} />
            <TrendChart id="imp" label="Visningar" color="#2563eb"
              data={(data.gsc_daily_series ?? []).map((d) => ({ date: d.date, value: d.impressions }))} fmt={(v) => Math.round(v).toLocaleString("sv-SE")} />
          </div>
        </div>
      )}

      {/* POSITION-FORDELNING + BRAND SPLIT */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Target className="w-4 h-4 text-emerald-600" />
            Var rankar du? — sökords-fördelning
          </h3>
          <div className="space-y-1">
            {([
              { band: "top3" as const, label: "Topp 3", count: pd.top3, imp: pd.top3Imp, color: "bg-emerald-500" },
              { band: "top10" as const, label: "Topp 4–10", count: pd.top10, imp: pd.top10Imp, color: "bg-blue-500" },
              { band: "top20" as const, label: "11–20", count: pd.top20, imp: pd.top20Imp, color: "bg-amber-500" },
              { band: "beyond" as const, label: "21+", count: pd.beyond, imp: pd.beyondImp, color: "bg-gray-400" },
            ]).map((b) => (
              <div key={b.band}>
                <PosBar label={b.label} count={b.count} imp={b.imp} total={totalKeywords} color={b.color}
                  active={openBand === b.band}
                  onClick={() => setOpenBand(openBand === b.band ? null : b.band)} />
                {openBand === b.band && (
                  <BandKeywords queries={data.position_distribution_queries?.[b.band] ?? []} />
                )}
              </div>
            ))}
          </div>
          <div className="text-xs text-gray-500 mt-3 flex items-center gap-1">
            <Info className="w-3 h-3" />
            Klicka på ett band för att se sökorden. Position 4–15 = snabbaste vinsterna.
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

      {/* SOKNINGAR SOM GAV KLICK */}
      {data.queries_top.some((q) => q.clicks > 0) && (() => {
        const brandName = (data.client?.name || "").toLowerCase().trim();
        const clicked = data.queries_top.filter((q) => q.clicks > 0).sort((a, b) => b.clicks - a.clicks);
        const newCust = clicked.filter((q) => !(brandName && q.query.toLowerCase().includes(brandName))).reduce((s, q) => s + q.clicks, 0);
        const brandCust = clicked.reduce((s, q) => s + q.clicks, 0) - newCust;
        return (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
              <MousePointerClick className="w-4 h-4 text-emerald-600" />
              Vad folk sökte när de klickade
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              De exakta sökningarna som gav klick (senaste mätningen). <span className="text-blue-700 font-medium">Brand</span> = de kände redan till ert namn. <span className="text-emerald-700 font-medium">Ny kund</span> = kall upptäckt via det ni säljer.
            </p>
            <div className="flex gap-3 mb-3 text-xs">
              <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800"><strong>{brandCust}</strong> klick från brand-sök</span>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800"><strong>{newCust}</strong> klick från nya kunder</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                    <th className="py-2 px-2 font-medium">Sökning</th>
                    <th className="py-2 px-2 font-medium">Typ</th>
                    <th className="py-2 px-2 font-medium text-right">Klick</th>
                    <th className="py-2 px-2 font-medium text-right">Visn.</th>
                    <th className="py-2 px-2 font-medium text-right">Pos</th>
                  </tr>
                </thead>
                <tbody>
                  {clicked.map((q, i) => {
                    const brand = brandName && q.query.toLowerCase().includes(brandName);
                    return (
                      <tr key={i} className="border-b border-gray-50">
                        <td className="py-2 px-2 text-gray-900 font-medium">{q.query}</td>
                        <td className="py-2 px-2">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${brand ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700"}`}>{brand ? "Brand" : "Ny kund"}</span>
                        </td>
                        <td className="py-2 px-2 text-right tabular-nums font-semibold text-gray-900">{q.clicks}</td>
                        <td className="py-2 px-2 text-right tabular-nums text-gray-600">{q.impressions.toLocaleString("sv-SE")}</td>
                        <td className="py-2 px-2 text-right tabular-nums text-gray-600">{q.avg_position ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-3 text-xs text-gray-700 bg-amber-50 border border-amber-100 rounded-lg p-3">
              <strong>Vad du behöver göra:</strong> är de flesta klicken &quot;Brand&quot; betyder det att kunderna redan kände ert namn — väg upp det med fler <strong>nya</strong> kunder genom &quot;Snabbaste vinsterna&quot; nedan (sökord du syns på men ligger på sida 2). Klättrar de till sida 1 blir visningar till klick.
            </div>
          </div>
        );
      })()}

      {/* QUICK WINS */}
      {data.quick_wins.length > 0 && (
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-5">
          <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-600" />
            Snabbaste vinsterna — {data.quick_wins.length} sökord på position 4–15
          </h3>
          <p className="text-xs text-gray-700 mb-3">
            <strong>Vad detta är:</strong> sökord där du redan syns i Google men ligger precis utanför topp 3.
            En optimerad sida som svarar bättre på frågan klättrar oftast 3–8 placeringar och ger 3–10x fler klick.
          </p>

          <details className="mb-3 text-xs text-gray-700 bg-white rounded-lg p-3 border border-amber-200">
            <summary className="cursor-pointer font-medium text-amber-900">📖 Så jobbar du med Quick wins (klicka)</summary>
            <ol className="list-decimal pl-5 mt-2 space-y-1.5">
              <li><strong>Välj 1 sökord per vecka</strong> — högst potential först (sortat så).</li>
              <li><strong>Öppna sidan som rankar</strong> (URL-länken nedan). Läs igenom den med sökordet i åtanke.</li>
              <li><strong>Klicka &quot;Optimera&quot;</strong> — det öppnar GEO/AEO-specialisten med sökord + sida ifyllt. AI:n skriver om sidan så att den svarar bättre på frågan.</li>
              <li><strong>Klistra resultatet på sajten</strong>, publicera.</li>
              <li><strong>Vänta 1–4 veckor</strong> — Google indexerar om. Position klättrar.</li>
              <li><strong>Mät igen</strong> — kom tillbaka hit och se hur sökordet flyttat sig.</li>
            </ol>
            <div className="mt-2 pt-2 border-t border-amber-100">
              <strong>Tröskelvärden:</strong> Position 4–10 = klättra till topp 3 (lättare). Position 11–15 = klättra till topp 10 först (medium). Visningar &gt; 100 = mer värt än visningar &lt; 50.
            </div>
          </details>

          <div className="overflow-x-auto bg-white rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-amber-50">
                <tr className="text-left text-xs text-gray-700 border-b border-amber-200">
                  <th className="py-2 px-3 font-medium">Sökord</th>
                  <th className="py-2 px-3 font-medium">Sida som rankar idag</th>
                  <th className="py-2 px-3 font-medium text-right">Pos</th>
                  <th className="py-2 px-3 font-medium text-right">Visn.</th>
                  <th className="py-2 px-3 font-medium text-right">Klick nu</th>
                  <th className="py-2 px-3 font-medium text-right">Potential</th>
                  <th className="py-2 px-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {data.quick_wins.map((q, i) => {
                  const potClicks = Math.round(q.impressions * 0.25);
                  // sid_url → optimeraren läser in sidans text automatiskt (ingen manuell inklistring).
                  const optimizeUrl = `/dashboard/specialister/geo-aeo-optimizer?amne=${encodeURIComponent(q.query)}${q.page ? `&sid_url=${encodeURIComponent(q.page)}` : ""}`;
                  return (
                    <tr key={i} className="border-b border-amber-100 hover:bg-amber-50/50">
                      <td className="py-2 px-3 font-medium text-gray-900">{q.query}</td>
                      <td className="py-2 px-3 text-xs">
                        {q.page ? (
                          <a href={q.page} target="_blank" rel="noopener" className="text-blue-600 hover:underline truncate inline-block max-w-[220px]">
                            {q.page.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "") || "/"}
                          </a>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums text-amber-700 font-semibold">{q.avg_position}</td>
                      <td className="py-2 px-3 text-right tabular-nums text-gray-700">{q.impressions.toLocaleString("sv-SE")}</td>
                      <td className="py-2 px-3 text-right tabular-nums text-gray-700">{q.clicks}</td>
                      <td className="py-2 px-3 text-right tabular-nums text-emerald-700 font-bold">+{potClicks}/m</td>
                      <td className="py-2 px-3 text-right">
                        <Link
                          href={optimizeUrl}
                          className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded bg-amber-600 text-white hover:bg-amber-700"
                        >
                          <Sparkles className="w-3 h-3" /> Optimera
                        </Link>
                      </td>
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
                    <button onClick={downloadPdf} className="text-xs px-3 py-1.5 rounded-lg bg-purple-600 text-white hover:bg-purple-700 font-medium">
                      Ladda ner PDF
                    </button>
                    <button onClick={downloadReport} className="text-xs px-3 py-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-50">
                      .md
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

function PosBar({ label, count, imp, total, color, active, onClick }: { label: string; count: number; imp: number; total: number; color: string; active?: boolean; onClick?: () => void }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <button type="button" onClick={onClick} className={`w-full text-left rounded-lg px-2 py-1.5 -mx-2 transition-colors ${active ? "bg-gray-50 ring-1 ring-gray-200" : "hover:bg-gray-50"} ${count > 0 ? "cursor-pointer" : "cursor-default"}`}>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="font-medium text-gray-700 flex items-center gap-1">
          <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${active ? "rotate-180" : ""}`} />
          {label}
        </span>
        <span className="text-gray-500"><strong className="text-gray-900">{count}</strong> sökord · {imp.toLocaleString("sv-SE")} visn.</span>
      </div>
      <div className="h-2 bg-gray-100 rounded overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </button>
  );
}

function BandKeywords({ queries }: { queries: Array<{ query: string; clicks: number; impressions: number; avg_position: number | null; ctr: number; page?: string | null }> }) {
  if (queries.length === 0) return <div className="mt-2 mb-1 text-xs text-gray-400 px-1">Inga sökord i detta band.</div>;
  return (
    <div className="mt-2 mb-2 border border-gray-100 rounded-lg bg-gray-50/50 p-2">
      <div className="text-[11px] text-gray-500 mb-1 px-1">{queries.length} sökord — störst möjlighet (flest visningar) först</div>
      <div className="max-h-64 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="text-gray-400 sticky top-0 bg-gray-50">
            <tr>
              <th className="text-left font-medium py-1 px-1">Sökord</th>
              <th className="text-right font-medium px-1">Pos</th>
              <th className="text-right font-medium px-1">Visn.</th>
              <th className="text-right font-medium px-1">Klick</th>
              <th className="px-1" />
            </tr>
          </thead>
          <tbody>
            {queries.map((q, i) => {
              const optimizeUrl = `/dashboard/specialister/geo-aeo-optimizer?amne=${encodeURIComponent(q.query)}${q.page ? `&nuvarande_text=${encodeURIComponent(`Sida som rankar idag: ${q.page}\nNuvarande position i Google: ${q.avg_position}\nVisningar: ${q.impressions}/månad\n\n[Klistra in nuvarande text från sidan här]`)}` : ""}`;
              return (
                <tr key={i} className="border-t border-gray-100 hover:bg-white">
                  <td className="py-1.5 px-1 text-gray-800">{q.query}</td>
                  <td className="py-1.5 px-1 text-right tabular-nums text-gray-600">{q.avg_position ?? "—"}</td>
                  <td className="py-1.5 px-1 text-right tabular-nums text-gray-600">{q.impressions.toLocaleString("sv-SE")}</td>
                  <td className="py-1.5 px-1 text-right tabular-nums text-gray-600">{q.clicks}</td>
                  <td className="py-1.5 px-1 text-right">
                    <a href={optimizeUrl} className="text-purple-600 hover:text-purple-800 font-medium whitespace-nowrap">Optimera</a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TrendChart({ id, label, color, data, invert, fmt }: { id: string; label: string; color: string; data: Array<{ date: string; value: number }>; invert?: boolean; fmt: (v: number) => string }) {
  const pts = data.filter((d) => Number.isFinite(d.value));
  if (pts.length < 2) {
    return (
      <div>
        <div className="text-xs font-medium text-gray-700 mb-1">{label}</div>
        <div className="h-24 flex items-center justify-center text-[11px] text-gray-400 bg-gray-50 rounded-lg">För få datapunkter ännu</div>
      </div>
    );
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
        <defs>
          <linearGradient id={`grad-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#grad-${id})`} />
        <path d={line} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <circle cx={xAt(pts.length - 1)} cy={yAt(last.value)} r="2.6" fill={color} />
      </svg>
      <div className="flex items-center justify-between mt-1 text-[10px] text-gray-400">
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

function channelSv(ch: string): string {
  const map: Record<string, string> = {
    "Direct": "Direkt", "Organic Search": "Organisk sök", "Paid Search": "Betald sök",
    "Display": "Display", "Paid Social": "Betald social", "Organic Social": "Social",
    "Email": "Mejl", "Affiliates": "Affiliate", "Referral": "Hänvisning",
    "Organic Video": "Video", "Paid Video": "Betald video", "Organic Shopping": "Shopping",
    "Paid Shopping": "Betald shopping", "Unassigned": "Okänd", "Cross-network": "Cross-network",
    "Audio": "Audio", "SMS": "SMS", "Mobile Push Notifications": "Push",
  };
  return map[ch] || ch;
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
