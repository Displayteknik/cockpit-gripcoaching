"use client";

// WEBBDATA COMMAND CENTER — demo-klon av SEO-översikten (dashboard/seo → Översikt)
// med maxad grafik: mörk glascockpit, animerade areakurvor, donut, radial gauge.
// Läser samma API som originalet (/api/analytics/dashboard) och faller tillbaka
// på deterministisk demo-data så sidan alltid har något snyggt att visa.
// Palett validerad mot mörk yta (#101430) med dataviz-validatorn: alla checkar PASS.

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Activity, ArrowUpRight, ArrowDownRight, Award, Bot, Eye, Gauge as GaugeIcon,
  MousePointerClick, Repeat, Search, Sparkles, Target, TrendingUp, Trophy, Zap,
} from "lucide-react";
import { useCountUp } from "@/components/ui/dash";

/* ============================== Palett & format ============================== */

// Seriefärger (validerade i ordning: grön→blå→amber→violett, ΔE-check PASS)
const C = {
  klick: "#10a56f",
  visningar: "#3987e5",
  position: "#c98500",
  ai: "#9085e9",
  surface: "#101430",
  ink: "#eef0ff",
  inkDim: "rgba(238,240,255,0.55)",
  inkMute: "rgba(238,240,255,0.35)",
  grid: "rgba(238,240,255,0.07)",
} as const;

const nf = new Intl.NumberFormat("sv-SE");
const fmtN = (v: number) => nf.format(Math.round(v));

/* ============================== Datamodell ============================== */

type Period = 7 | 14 | 30 | 90;

interface DayPoint { date: string; klick: number; visningar: number; position: number; besok: number }
interface QueryRow { query: string; klick: number; visningar: number; position: number; ctr: number; brand: boolean }
interface WebData {
  source: "live" | "demo";
  clientName: string;
  days: Period;
  kpi: {
    klick: number; visningar: number; position: number; besok: number; aiBesok: number; engagemang: number;
    dKlick: number; dVisningar: number; dPosition: number; dBesok: number;
  };
  series: DayPoint[];
  positionBands: { label: string; count: number; imp: number; color: string }[];
  brand: { brand: number; nonBrand: number };
  channels: { name: string; sessions: number }[];
  aiSources: { name: string; sessions: number }[];
  queries: QueryRow[];
  quickWins: { query: string; position: number; visningar: number; potential: number }[];
}

/* ============================== Demo-data (seedad, deterministisk) ============================== */

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DEMO_QUERIES: Array<[string, number, boolean]> = [
  ["led skärm utomhus", 8.4, false],
  ["displayteknik", 1.1, true],
  ["digital skyltning pris", 6.2, false],
  ["led skärm pris", 11.8, false],
  ["storbildsskärm hyra", 13.5, false],
  ["digital skylt butik", 9.7, false],
  ["led display fasad", 15.2, false],
  ["displayteknik ab", 1.0, true],
  ["skyltskärm inomhus", 18.9, false],
  ["led skärm fotbollsarena", 21.4, false],
  ["videowall pris", 12.6, false],
  ["digital menytavla restaurang", 24.8, false],
];

function makeDemo(days: Period): WebData {
  const rnd = mulberry32(days * 7919);
  const today = new Date("2026-07-19T00:00:00Z");
  const series: DayPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today); d.setUTCDate(d.getUTCDate() - i);
    const t = (days - 1 - i) / Math.max(1, days - 1);
    const weekday = d.getUTCDay();
    const weekend = weekday === 0 || weekday === 6 ? 0.55 : 1;
    const trend = 1 + t * 0.65;
    const klick = Math.max(1, Math.round((9 + rnd() * 7) * weekend * trend));
    const visningar = Math.round(klick * (34 + rnd() * 14));
    const position = 14.2 - t * 4.6 + (rnd() - 0.5) * 1.6;
    const besok = Math.round(klick * (2.1 + rnd() * 0.8));
    series.push({ date: d.toISOString().slice(0, 10), klick, visningar, position: Math.round(position * 10) / 10, besok });
  }
  const sum = (f: (p: DayPoint) => number) => series.reduce((s, p) => s + f(p), 0);
  const klick = sum((p) => p.klick);
  const visningar = sum((p) => p.visningar);
  const besok = sum((p) => p.besok);
  const position = Math.round((sum((p) => p.position) / series.length) * 10) / 10;

  const queries: QueryRow[] = DEMO_QUERIES.map(([q, pos, brand]) => {
    const imp = Math.round((visningar / 46) * (0.3 + rnd() * 1.4));
    const ctrBase = pos <= 3 ? 0.19 : pos <= 10 ? 0.055 : pos <= 20 ? 0.014 : 0.004;
    const k = Math.round(imp * ctrBase * (0.7 + rnd() * 0.6));
    return { query: q, klick: k, visningar: imp, position: pos, ctr: imp > 0 ? Math.round((k / imp) * 1000) / 10 : 0, brand };
  }).sort((a, b) => b.klick - a.klick);

  const bandOf = (p: number) => (p <= 3 ? 0 : p <= 10 ? 1 : p <= 20 ? 2 : 3);
  const bands = [
    { label: "Topp 3", count: 0, imp: 0, color: C.klick },
    { label: "Topp 4–10", count: 0, imp: 0, color: C.visningar },
    { label: "Plats 11–20", count: 0, imp: 0, color: C.position },
    { label: "Plats 21+", count: 0, imp: 0, color: C.ai },
  ];
  queries.forEach((q) => { const b = bands[bandOf(q.position)]; b.count++; b.imp += q.visningar; });

  const brandClicks = queries.filter((q) => q.brand).reduce((s, q) => s + q.klick, 0);

  return {
    source: "demo",
    clientName: "Displayteknik",
    days,
    kpi: {
      klick, visningar, position, besok,
      aiBesok: Math.round(besok * 0.031),
      engagemang: 64,
      dKlick: 23, dVisningar: 17, dPosition: -2.8, dBesok: 19,
    },
    series,
    positionBands: bands,
    brand: { brand: brandClicks, nonBrand: klick > brandClicks ? klick - brandClicks : Math.round(klick * 0.6) },
    channels: [
      { name: "Organiskt sök", sessions: Math.round(besok * 0.47) },
      { name: "Direkt", sessions: Math.round(besok * 0.24) },
      { name: "Socialt", sessions: Math.round(besok * 0.13) },
      { name: "Hänvisningar", sessions: Math.round(besok * 0.09) },
      { name: "AI-motorer", sessions: Math.round(besok * 0.031) },
    ],
    aiSources: [
      { name: "ChatGPT", sessions: Math.round(besok * 0.017) },
      { name: "Perplexity", sessions: Math.round(besok * 0.008) },
      { name: "Copilot", sessions: Math.round(besok * 0.006) },
    ],
    queries,
    quickWins: queries
      .filter((q) => q.position >= 4 && q.position <= 15 && q.visningar >= 40)
      .slice(0, 3)
      .map((q) => ({ query: q.query, position: q.position, visningar: q.visningar, potential: Math.round(q.visningar * 0.25) })),
  };
}

/* ============================== Live-mappning ============================== */

// Samma payload som AnalyticsDashboard läser. Minimal typning — vi plockar bara det vi ritar.
interface LivePayload {
  client?: { name?: string } | null;
  kpi?: { gsc_clicks?: number; gsc_impressions?: number; gsc_avg_position?: number | null; visits?: number };
  ga4?: { sessions?: number; engagementRate?: number; ai?: { sessions?: number; sources?: { source: string; sessions: number }[] }; channels?: { channel: string; sessions: number }[]; daily?: { date: string; sessions: number }[] } | null;
  gsc_daily_series?: { date: string; clicks: number; impressions: number; position: number }[];
  position_distribution?: { top3: number; top10: number; top20: number; beyond: number; top3Imp: number; top10Imp: number; top20Imp: number; beyondImp: number };
  brand_split?: { brand: { clicks: number }; non_brand: { clicks: number } };
  queries_top?: { query: string; clicks: number; impressions: number; avg_position: number | null; ctr: number }[];
  quick_wins?: { query: string; impressions: number; avg_position: number | null }[];
}

function mapLive(d: LivePayload, days: Period): WebData | null {
  const daily = d.gsc_daily_series ?? [];
  const k = d.kpi;
  if (!k || daily.length < 2 || (k.gsc_impressions ?? 0) === 0) return null;
  const ga4daily = new Map((d.ga4?.daily ?? []).map((x) => [x.date, x.sessions]));
  const brandName = (d.client?.name ?? "").toLowerCase();
  const pd = d.position_distribution;
  const besok = d.ga4?.sessions ?? k.visits ?? 0;
  return {
    source: "live",
    clientName: d.client?.name ?? "Klient",
    days,
    kpi: {
      klick: k.gsc_clicks ?? 0,
      visningar: k.gsc_impressions ?? 0,
      position: k.gsc_avg_position ?? 0,
      besok,
      aiBesok: d.ga4?.ai?.sessions ?? 0,
      engagemang: Math.round(d.ga4?.engagementRate ?? 0),
      dKlick: 0, dVisningar: 0, dPosition: 0, dBesok: 0,
    },
    series: daily.map((x) => ({ date: x.date, klick: x.clicks, visningar: x.impressions, position: x.position, besok: ga4daily.get(x.date) ?? 0 })),
    positionBands: [
      { label: "Topp 3", count: pd?.top3 ?? 0, imp: pd?.top3Imp ?? 0, color: C.klick },
      { label: "Topp 4–10", count: pd?.top10 ?? 0, imp: pd?.top10Imp ?? 0, color: C.visningar },
      { label: "Plats 11–20", count: pd?.top20 ?? 0, imp: pd?.top20Imp ?? 0, color: C.position },
      { label: "Plats 21+", count: pd?.beyond ?? 0, imp: pd?.beyondImp ?? 0, color: C.ai },
    ],
    brand: { brand: d.brand_split?.brand.clicks ?? 0, nonBrand: d.brand_split?.non_brand.clicks ?? 0 },
    channels: (d.ga4?.channels ?? []).map((c) => ({ name: c.channel, sessions: c.sessions })),
    aiSources: (d.ga4?.ai?.sources ?? []).map((s) => ({ name: s.source, sessions: s.sessions })),
    queries: (d.queries_top ?? []).slice(0, 12).map((q) => ({
      query: q.query, klick: q.clicks, visningar: q.impressions,
      position: q.avg_position ?? 0, ctr: q.ctr,
      brand: !!brandName && q.query.toLowerCase().includes(brandName),
    })),
    quickWins: (d.quick_wins ?? []).slice(0, 3).map((q) => ({
      query: q.query, position: q.avg_position ?? 0, visningar: q.impressions, potential: Math.round(q.impressions * 0.25),
    })),
  };
}

/* ============================== Sidan ============================== */

export default function WebbdataDemoPage() {
  const [period, setPeriod] = useState<Period>(30);
  const [data, setData] = useState<WebData>(() => makeDemo(30));

  useEffect(() => {
    let cancelled = false;
    setData(makeDemo(period));
    fetch(`/api/analytics/dashboard?days=${period}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: LivePayload | null) => {
        if (cancelled || !d) return;
        const mapped = mapLive(d, period);
        if (mapped) setData(mapped);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [period]);

  const totalBandCount = data.positionBands.reduce((s, b) => s + b.count, 0);

  return (
    <div className="wd-root relative -m-4 min-h-screen overflow-hidden p-4 md:-m-8 md:p-8 lg:p-10 text-[15px]"
      style={{ background: "radial-gradient(1200px 700px at 85% -10%, #1e1b4b 0%, transparent 60%), radial-gradient(900px 600px at -10% 110%, #0e2a3f 0%, transparent 55%), linear-gradient(160deg, #0b1020 0%, #101430 60%, #0b1020 100%)", color: C.ink }}>
      <style>{`
        @keyframes wdAurora { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(40px,-30px) scale(1.15); } }
        @keyframes wdGrow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        @keyframes wdDraw { from { stroke-dashoffset: var(--wd-len, 1000); } to { stroke-dashoffset: 0; } }
        @keyframes wdFill { from { opacity: 0; } to { opacity: 1; } }
        .wd-grow { transform-origin: left; animation: wdGrow .9s cubic-bezier(.2,.7,.2,1) both; }
        .wd-draw { stroke-dasharray: var(--wd-len, 1000); animation: wdDraw 1.4s cubic-bezier(.4,0,.2,1) both; }
        .wd-fill { animation: wdFill .8s ease .6s both; }
        .wd-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09); border-radius: 1.25rem; backdrop-filter: blur(12px); }
        .wd-card:hover { border-color: rgba(255,255,255,0.16); }
        @media (prefers-reduced-motion: reduce) { .wd-grow, .wd-draw, .wd-fill { animation: none !important; } }
      `}</style>

      {/* Aurora-bakgrund */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -top-32 left-1/4 h-96 w-96 rounded-full opacity-30 blur-3xl" style={{ background: `radial-gradient(circle, ${C.visningar}, transparent 65%)`, animation: "wdAurora 13s ease-in-out infinite" }} />
        <div className="absolute right-0 top-1/3 h-80 w-80 rounded-full opacity-25 blur-3xl" style={{ background: `radial-gradient(circle, ${C.ai}, transparent 65%)`, animation: "wdAurora 17s ease-in-out infinite reverse" }} />
        <div className="absolute -bottom-24 left-10 h-72 w-72 rounded-full opacity-25 blur-3xl" style={{ background: `radial-gradient(circle, ${C.klick}, transparent 65%)`, animation: "wdAurora 15s ease-in-out infinite" }} />
        <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)", backgroundSize: "52px 52px" }} />
      </div>

      <div className="relative mx-auto max-w-7xl space-y-6">
        {/* HEADER */}
        <header className="cw-reveal flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium ring-1 ring-white/15 backdrop-blur">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" style={{ animation: "cwPing 1.6s cubic-bezier(0,0,.2,1) infinite" }} />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                Webbdata · {data.clientName}
              </span>
              <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ring-1 ${data.source === "live" ? "bg-emerald-400/15 text-emerald-300 ring-emerald-400/30" : "bg-amber-400/15 text-amber-300 ring-amber-400/30"}`}>
                {data.source === "live" ? "Live-data" : "Demo-data"}
              </span>
            </div>
            <h1 className="font-display text-3xl font-bold tracking-tight md:text-5xl">
              Webbdata{" "}
              <span className="bg-clip-text text-transparent" style={{ backgroundImage: `linear-gradient(90deg, ${C.klick}, ${C.visningar} 55%, ${C.ai})` }}>
                Command&nbsp;Center
              </span>
            </h1>
            <p className="mt-2 max-w-xl" style={{ color: C.inkDim }}>
              Testklon av SEO-översikten — samma data, ny kostym. Google-sök, besökare och AI-synlighet i realtid.
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-xl bg-white/5 p-1 ring-1 ring-white/10 backdrop-blur">
            {([7, 14, 30, 90] as Period[]).map((p) => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${period === p ? "bg-white text-gray-900 shadow-lg" : "text-white/60 hover:text-white"}`}>
                {p}d
              </button>
            ))}
          </div>
        </header>

        {/* KPI-RAD */}
        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Kpi i={0} icon={MousePointerClick} label="Klick (Google)" value={data.kpi.klick} delta={data.kpi.dKlick} color={C.klick} spark={data.series.map((p) => p.klick)} />
          <Kpi i={1} icon={Eye} label="Visningar" value={data.kpi.visningar} delta={data.kpi.dVisningar} color={C.visningar} spark={data.series.map((p) => p.visningar)} />
          <Kpi i={2} icon={Award} label="Snittposition" value={data.kpi.position} delta={data.kpi.dPosition} deltaInvert color={C.position} spark={data.series.map((p) => p.position)} sparkInvert decimals />
          <Kpi i={3} icon={TrendingUp} label="Besök" value={data.kpi.besok} delta={data.kpi.dBesok} color={C.ai} spark={data.series.map((p) => p.besok)} />
          <Kpi i={4} icon={Sparkles} label="AI-besök" value={data.kpi.aiBesok} color={C.ai} />
          <Kpi i={5} icon={Zap} label="Engagemang" value={data.kpi.engagemang} suffix="%" color={C.klick} />
        </section>

        {/* HUVUDGRAF + POSITION */}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <TrendCard data={data} className="lg:col-span-2" />

          <div className="wd-card cw-reveal p-5" style={{ animationDelay: "180ms" }}>
            <CardTitle icon={Target} color={C.klick} title="Var rankar du?" sub={`${totalBandCount} sökord fördelade på Google-positioner`} />
            <div className="mt-4 space-y-4">
              {data.positionBands.map((b, i) => {
                const pct = totalBandCount > 0 ? (b.count / totalBandCount) * 100 : 0;
                return (
                  <div key={b.label}>
                    <div className="mb-1.5 flex items-baseline justify-between text-sm">
                      <span className="flex items-center gap-2 font-medium">
                        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: b.color }} />
                        {b.label}
                      </span>
                      <span style={{ color: C.inkDim }}>
                        <strong className="tabular-nums" style={{ color: C.ink }}>{b.count}</strong> sökord · {fmtN(b.imp)} visn.
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-white/5">
                      <div className="wd-grow h-full rounded-full" style={{ width: `${Math.max(2, pct)}%`, background: `linear-gradient(90deg, ${b.color}bb, ${b.color})`, animationDelay: `${200 + i * 120}ms` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-5 rounded-xl bg-white/5 p-3 text-xs ring-1 ring-white/10" style={{ color: C.inkDim }}>
              <Trophy className="mr-1.5 inline h-3.5 w-3.5" style={{ color: C.position }} />
              Position 4–15 är snabbaste vinsterna — de syns redan men får få klick.
            </div>

            <div className="mt-5 border-t border-white/10 pt-5">
              <CardTitle icon={Repeat} color={C.ai} title="Brand vs icke-brand" sub="Andel klick från de som redan kände till er" />
              <BrandDonut brand={data.brand.brand} nonBrand={data.brand.nonBrand} />
            </div>
          </div>
        </section>

        {/* KANALER + AI-SYNLIGHET + QUICK WINS */}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="wd-card cw-reveal p-5" style={{ animationDelay: "120ms" }}>
            <CardTitle icon={Activity} color={C.visningar} title="Var kommer besökarna ifrån" sub="Kanaler under perioden" />
            <div className="mt-4 space-y-3">
              {data.channels.map((c, i) => {
                const max = Math.max(...data.channels.map((x) => x.sessions), 1);
                return (
                  <div key={c.name} title={`${c.name}: ${fmtN(c.sessions)} besök`}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="font-medium">{c.name}</span>
                      <span className="tabular-nums" style={{ color: C.inkDim }}>{fmtN(c.sessions)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/5">
                      <div className="wd-grow h-full rounded-full" style={{ width: `${(c.sessions / max) * 100}%`, background: C.visningar, animationDelay: `${150 + i * 100}ms` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="wd-card cw-reveal relative overflow-hidden p-5" style={{ animationDelay: "200ms" }}>
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-20 blur-2xl" style={{ background: C.ai }} />
            <CardTitle icon={Bot} color={C.ai} title="AI-synlighet" sub="Besök från ChatGPT, Perplexity, Copilot m.fl." />
            <div className="mt-4 flex items-center gap-5">
              <AiGauge value={data.kpi.aiBesok} total={Math.max(1, data.kpi.besok)} />
              <div className="flex-1 space-y-2">
                {data.aiSources.length > 0 ? data.aiSources.map((s) => (
                  <div key={s.name} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm ring-1 ring-white/10">
                    <span className="font-medium">{s.name}</span>
                    <span className="tabular-nums" style={{ color: C.inkDim }}>{fmtN(s.sessions)}</span>
                  </div>
                )) : (
                  <p className="text-xs" style={{ color: C.inkDim }}>Inga AI-besök ännu — kör AEO-åtgärderna i djupgranskningen.</p>
                )}
              </div>
            </div>
          </div>

          <div className="wd-card cw-reveal p-5" style={{ animationDelay: "280ms" }}>
            <CardTitle icon={Trophy} color={C.position} title="Snabbaste vinsterna" sub="Sökord nära toppen — optimera & klättra" />
            <div className="mt-4 space-y-3">
              {data.quickWins.length > 0 ? data.quickWins.map((w, i) => (
                <div key={w.query} className="group rounded-xl bg-white/5 p-3.5 ring-1 ring-white/10 transition hover:bg-white/[0.08] hover:ring-white/20">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{i + 1}. {w.query}</div>
                      <div className="mt-1 text-xs" style={{ color: C.inkDim }}>
                        Position <strong style={{ color: C.position }}>{w.position}</strong> · {fmtN(w.visningar)} visningar
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums" style={{ background: `${C.klick}26`, color: "#4ade80" }}>
                      +{fmtN(w.potential)} klick
                    </span>
                  </div>
                </div>
              )) : (
                <p className="text-xs" style={{ color: C.inkDim }}>Inga quick wins i datan just nu.</p>
              )}
            </div>
          </div>
        </section>

        {/* SÖKORDSTABELL */}
        <QueriesTable queries={data.queries} />

        <footer className="cw-reveal flex flex-wrap items-center justify-between gap-3 pb-4 text-xs" style={{ color: C.inkMute, animationDelay: "350ms" }}>
          <span>Demo-klon för test · originalet finns kvar under <Link href="/dashboard/seo" className="underline decoration-white/30 underline-offset-2 hover:text-white">SEO &amp; AEO</Link>.</span>
          <span>Period: {data.days} dagar · Källa: {data.source === "live" ? "GSC + GA4 (live)" : "genererad demo-data"}</span>
        </footer>
      </div>
    </div>
  );
}

/* ============================== Byggstenar ============================== */

function CardTitle({ icon: Icon, color, title, sub }: { icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; color: string; title: string; sub?: string }) {
  return (
    <div>
      <h3 className="flex items-center gap-2 font-semibold">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: `${color}22`, boxShadow: `inset 0 0 0 1px ${color}44` }}>
          <Icon className="h-4 w-4" style={{ color }} />
        </span>
        {title}
      </h3>
      {sub && <p className="mt-1 text-xs" style={{ color: C.inkDim }}>{sub}</p>}
    </div>
  );
}

function Kpi({ i, icon: Icon, label, value, delta, deltaInvert, color, spark, sparkInvert, suffix, decimals }: {
  i: number; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; label: string; value: number;
  delta?: number; deltaInvert?: boolean; color: string; spark?: number[]; sparkInvert?: boolean; suffix?: string; decimals?: boolean;
}) {
  const animated = useCountUp(decimals ? Math.round(value * 10) : Math.round(value));
  const shown = animated === null ? "—" : decimals ? (animated / 10).toLocaleString("sv-SE", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : fmtN(animated);
  const good = delta !== undefined && (deltaInvert ? delta < 0 : delta > 0);
  return (
    <div className="wd-card cw-reveal group relative overflow-hidden p-4 transition-transform duration-300 hover:-translate-y-1"
      style={{ animationDelay: `${i * 70}ms` }}>
      <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-40" style={{ background: color }} />
      <div className="flex items-center justify-between">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: `${color}22`, boxShadow: `inset 0 0 0 1px ${color}55, 0 8px 20px -10px ${color}` }}>
          <Icon className="h-4.5 w-4.5" style={{ color }} />
        </span>
        {delta !== undefined && delta !== 0 && (
          <span className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${good ? "bg-emerald-400/15 text-emerald-300" : "bg-rose-400/15 text-rose-300"}`}>
            {delta > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(delta)}%
          </span>
        )}
      </div>
      <div className="mt-3 font-display text-[1.7rem] font-bold leading-none tabular-nums">{shown}{suffix}</div>
      <div className="mt-1.5 text-xs font-medium" style={{ color: C.inkDim }}>{label}</div>
      {spark && spark.length > 1 && <Sparkline points={spark} color={color} invert={sparkInvert} />}
    </div>
  );
}

function Sparkline({ points, color, invert }: { points: number[]; color: string; invert?: boolean }) {
  const w = 120, h = 26;
  const min = Math.min(...points), max = Math.max(...points);
  const span = max - min || 1;
  const d = points
    .map((v, i) => {
      const x = (i / (points.length - 1)) * w;
      const norm = (v - min) / span;
      const y = invert ? norm * (h - 4) + 2 : h - 2 - norm * (h - 4);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 h-6 w-full" preserveAspectRatio="none" aria-hidden>
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="wd-draw" style={{ "--wd-len": 300 } as React.CSSProperties} />
    </svg>
  );
}

/* ---------- Stora trendkortet med metrikflikar + crosshair-tooltip ---------- */

const METRICS = [
  { key: "klick", label: "Klick", color: C.klick, icon: MousePointerClick },
  { key: "visningar", label: "Visningar", color: C.visningar, icon: Eye },
  { key: "position", label: "Position", color: C.position, icon: Award, invert: true },
  { key: "besok", label: "Besök", color: C.ai, icon: TrendingUp },
] as const;
type MetricKey = (typeof METRICS)[number]["key"];

function TrendCard({ data, className }: { data: WebData; className?: string }) {
  const [metric, setMetric] = useState<MetricKey>("klick");
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const m = METRICS.find((x) => x.key === metric)!;
  const invert = "invert" in m && m.invert;

  const W = 760, H = 360, PAD = { l: 44, r: 16, t: 16, b: 26 };
  const pts = data.series.map((p) => p[metric]);
  const min = Math.min(...pts), max = Math.max(...pts);
  const lo = invert ? min - (max - min) * 0.1 : 0;
  const hi = max + (max - min || max || 1) * 0.1;
  const span = hi - lo || 1;
  const x = (i: number) => PAD.l + (i / Math.max(1, pts.length - 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => {
    const norm = (v - lo) / span;
    return invert ? PAD.t + norm * (H - PAD.t - PAD.b) : H - PAD.b - norm * (H - PAD.t - PAD.b);
  };
  const line = pts.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L${x(pts.length - 1).toFixed(1)},${H - PAD.b} L${x(0).toFixed(1)},${H - PAD.b} Z`;

  const ticks = useMemo(() => {
    const n = 4;
    return Array.from({ length: n + 1 }, (_, i) => lo + (span * i) / n);
  }, [lo, span]);

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - PAD.l) / (W - PAD.l - PAD.r)) * (pts.length - 1));
    setHover(Math.max(0, Math.min(pts.length - 1, i)));
  }

  const hoverPt = hover !== null ? data.series[hover] : null;
  const fmtVal = (v: number) => (metric === "position" ? v.toFixed(1) : fmtN(v));

  return (
    <div className={`wd-card cw-reveal p-5 ${className ?? ""}`} style={{ animationDelay: "100ms" }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle icon={GaugeIcon} color={m.color} title="Utveckling över tid" sub={metric === "position" ? "Lägre siffra = högre upp i Google" : "Dag för dag under vald period"} />
        <div className="flex gap-1 rounded-xl bg-white/5 p-1 ring-1 ring-white/10">
          {METRICS.map((t) => (
            <button key={t.key} onClick={() => { setMetric(t.key); setHover(null); }}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${metric === t.key ? "text-gray-900" : "text-white/55 hover:text-white"}`}
              style={metric === t.key ? { background: "#fff" } : undefined}>
              <span className="h-2 w-2 rounded-full" style={{ background: t.color }} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative mt-4">
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
          aria-label={`${m.label} per dag, ${data.days} dagar`}
          onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
          <defs>
            <linearGradient id={`wdArea-${metric}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={m.color} stopOpacity="0.35" />
              <stop offset="100%" stopColor={m.color} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke={C.grid} strokeWidth="1" />
              <text x={PAD.l - 8} y={y(t) + 3.5} textAnchor="end" fontSize="10" fill={C.inkMute} className="tabular-nums">
                {metric === "position" ? t.toFixed(0) : fmtN(t)}
              </text>
            </g>
          ))}
          {[0, Math.floor((pts.length - 1) / 2), pts.length - 1].map((i) => (
            <text key={i} x={x(i)} y={H - 8} textAnchor={i === 0 ? "start" : i === pts.length - 1 ? "end" : "middle"} fontSize="10" fill={C.inkMute}>
              {data.series[i]?.date.slice(5)}
            </text>
          ))}
          <path key={`a-${metric}-${data.days}-${data.source}`} d={area} fill={`url(#wdArea-${metric})`} className="wd-fill" />
          <path key={`l-${metric}-${data.days}-${data.source}`} d={line} fill="none" stroke={m.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="wd-draw" style={{ "--wd-len": 1800 } as React.CSSProperties} />
          {hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} stroke="rgba(255,255,255,0.25)" strokeWidth="1" strokeDasharray="3 3" />
              <circle cx={x(hover)} cy={y(pts[hover])} r="5" fill={m.color} stroke={C.surface} strokeWidth="2" />
            </g>
          )}
          <circle cx={x(pts.length - 1)} cy={y(pts[pts.length - 1])} r="4" fill={m.color} stroke={C.surface} strokeWidth="2" />
          <text x={x(pts.length - 1) - 8} y={y(pts[pts.length - 1]) - 10} textAnchor="end" fontSize="11" fontWeight="700" fill={C.ink} className="tabular-nums">
            {fmtVal(pts[pts.length - 1])}
          </text>
        </svg>

        {hoverPt && hover !== null && (
          <div className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-xl border border-white/15 bg-[#171b3a]/95 px-3 py-2 text-xs shadow-2xl backdrop-blur"
            style={{ left: `${(x(hover) / W) * 100}%`, top: 0 }}>
            <div className="font-semibold">{hoverPt.date}</div>
            <div className="mt-1 flex items-center gap-1.5 tabular-nums" style={{ color: C.inkDim }}>
              <span className="h-2 w-2 rounded-full" style={{ background: m.color }} />
              {m.label}: <strong style={{ color: C.ink }}>{fmtVal(hoverPt[metric])}</strong>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Donut: brand vs icke-brand ---------- */

function BrandDonut({ brand, nonBrand }: { brand: number; nonBrand: number }) {
  const total = brand + nonBrand;
  const pctNew = total > 0 ? nonBrand / total : 0;
  const R = 42, CIRC = 2 * Math.PI * R;
  const gap = total > 0 && brand > 0 && nonBrand > 0 ? 4 : 0; // 2px yt-gap per skarv
  const newLen = Math.max(0, CIRC * pctNew - gap);
  const brandLen = Math.max(0, CIRC * (1 - pctNew) - gap);
  return (
    <div className="mt-3 flex items-center gap-5">
      <svg viewBox="0 0 110 110" className="h-28 w-28 shrink-0" role="img" aria-label={`Icke-brand ${Math.round(pctNew * 100)} procent av klicken`}>
        <circle cx="55" cy="55" r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="12" />
        <g transform="rotate(-90 55 55)">
          <circle cx="55" cy="55" r={R} fill="none" stroke={C.klick} strokeWidth="12" strokeLinecap="round"
            strokeDasharray={`${newLen} ${CIRC - newLen}`} className="wd-draw" style={{ "--wd-len": 0 } as React.CSSProperties} />
          <circle cx="55" cy="55" r={R} fill="none" stroke={C.visningar} strokeWidth="12" strokeLinecap="round"
            strokeDasharray={`${brandLen} ${CIRC - brandLen}`} strokeDashoffset={-(newLen + gap)} />
        </g>
        <text x="55" y="52" textAnchor="middle" fontSize="20" fontWeight="800" fill={C.ink} className="tabular-nums">{Math.round(pctNew * 100)}%</text>
        <text x="55" y="68" textAnchor="middle" fontSize="8.5" fill={C.inkDim}>nya kunder</text>
      </svg>
      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: C.klick }} />
          <span>Icke-brand</span>
          <strong className="tabular-nums">{fmtN(nonBrand)}</strong>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: C.visningar }} />
          <span>Brand</span>
          <strong className="tabular-nums">{fmtN(brand)}</strong>
        </div>
        <p className="max-w-[180px] text-xs" style={{ color: C.inkDim }}>Hög icke-brand-andel = ni hittas av folk som inte kände till er.</p>
      </div>
    </div>
  );
}

/* ---------- Radial gauge: AI-besök ---------- */

function AiGauge({ value, total }: { value: number; total: number }) {
  const pct = Math.min(1, value / total);
  const R = 40, CIRC = 2 * Math.PI * R;
  const len = Math.max(CIRC * 0.015, CIRC * pct);
  const animated = useCountUp(value);
  return (
    <svg viewBox="0 0 100 100" className="h-28 w-28 shrink-0" role="img" aria-label={`${value} AI-besök av ${total} totalt`}>
      <circle cx="50" cy="50" r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="10" />
      <circle cx="50" cy="50" r={R} fill="none" stroke={C.ai} strokeWidth="10" strokeLinecap="round"
        strokeDasharray={`${len} ${CIRC}`} transform="rotate(-90 50 50)"
        style={{ filter: `drop-shadow(0 0 6px ${C.ai}88)`, transition: "stroke-dasharray 1s cubic-bezier(.2,.7,.2,1)" }} />
      <text x="50" y="48" textAnchor="middle" fontSize="22" fontWeight="800" fill={C.ink} className="tabular-nums">{animated ?? 0}</text>
      <text x="50" y="63" textAnchor="middle" fontSize="8" fill={C.inkDim}>{(pct * 100).toFixed(1)}% av besöken</text>
    </svg>
  );
}

/* ---------- Sökordstabell med sök + sortering + heat-bars ---------- */

type SortKey = "klick" | "visningar" | "position" | "ctr";

function QueriesTable({ queries }: { queries: QueryRow[] }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("klick");
  const rows = useMemo(() => {
    return queries
      .filter((r) => !q || r.query.toLowerCase().includes(q.toLowerCase()))
      .slice()
      .sort((a, b) => (sort === "position" ? a.position - b.position : b[sort] - a[sort]));
  }, [queries, q, sort]);
  const maxK = Math.max(...queries.map((r) => r.klick), 1);
  const maxV = Math.max(...queries.map((r) => r.visningar), 1);

  const TH = ({ k, label, right }: { k?: SortKey; label: string; right?: boolean }) => (
    <th className={`px-3 py-2.5 text-xs font-semibold uppercase tracking-wider ${right ? "text-right" : "text-left"}`} style={{ color: C.inkMute }}>
      {k ? (
        <button onClick={() => setSort(k)} className={`inline-flex items-center gap-1 transition hover:text-white ${sort === k ? "text-white" : ""}`}>
          {label}{sort === k && <ArrowDownRight className="h-3 w-3 rotate-45" />}
        </button>
      ) : label}
    </th>
  );

  return (
    <section className="wd-card cw-reveal overflow-hidden" style={{ animationDelay: "300ms" }}>
      <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-3">
        <CardTitle icon={Search} color={C.visningar} title="Vad folk söker på" sub="Sökningar där du visades i Google — klick, visningar & position" />
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: C.inkMute }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrera sökord…"
            className="w-56 rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm outline-none backdrop-blur transition placeholder:text-white/30 focus:border-white/25 focus:bg-white/[0.08]" />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <TH label="Sökning" />
              <TH label="Typ" />
              <TH k="klick" label="Klick" right />
              <TH k="visningar" label="Visningar" right />
              <TH k="ctr" label="CTR" right />
              <TH k="position" label="Position" right />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.query} className="border-b border-white/5 transition hover:bg-white/[0.04]">
                <td className="px-3 py-2.5 font-medium">{r.query}</td>
                <td className="px-3 py-2.5">
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                    style={r.brand ? { background: `${C.visningar}26`, color: "#7db6f2" } : { background: `${C.klick}26`, color: "#4ade80" }}>
                    {r.brand ? "Brand" : "Ny kund"}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <CellBar value={r.klick} max={maxK} color={C.klick} />
                </td>
                <td className="px-3 py-2.5 text-right">
                  <CellBar value={r.visningar} max={maxV} color={C.visningar} />
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: C.inkDim }}>{r.ctr.toLocaleString("sv-SE")}%</td>
                <td className="px-3 py-2.5 text-right">
                  <span className="rounded-lg px-2 py-1 text-xs font-bold tabular-nums"
                    style={{
                      background: r.position <= 3 ? `${C.klick}26` : r.position <= 10 ? `${C.visningar}26` : `${C.position}26`,
                      color: r.position <= 3 ? "#4ade80" : r.position <= 10 ? "#7db6f2" : "#e5a832",
                    }}>
                    {r.position.toLocaleString("sv-SE", { maximumFractionDigits: 1 })}
                  </span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-sm" style={{ color: C.inkMute }}>Inga sökord matchar ”{q}”.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-1.5 border-t border-white/10 px-5 py-3 text-xs" style={{ color: C.inkMute }}>
        <ArrowUpRight className="h-3.5 w-3.5" />
        Klicka på en kolumnrubrik för att sortera. Grön position = topp 3, blå = sida 1, amber = sida 2+.
      </div>
    </section>
  );
}

function CellBar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <span className="inline-flex items-center justify-end gap-2">
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-white/5">
        <span className="block h-full rounded-full" style={{ width: `${(value / max) * 100}%`, background: color }} />
      </span>
      <span className="w-12 tabular-nums font-semibold">{fmtN(value)}</span>
    </span>
  );
}
