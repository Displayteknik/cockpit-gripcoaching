"use client";

import { useEffect, useState } from "react";

// Cockpit designsystem — delas av dashboard-sidor. Mörk gradient-mesh-hero + glow-KPI.
// Animations-keyframes (cw-reveal/cwFloat/cwPing) ligger i app/globals.css.

export const TONES = {
  blue:    { grad: "linear-gradient(135deg,#38bdf8,#2563eb)", rgb: "37,99,235" },
  emerald: { grad: "linear-gradient(135deg,#34d399,#059669)", rgb: "16,185,129" },
  violet:  { grad: "linear-gradient(135deg,#a78bfa,#7c3aed)", rgb: "124,58,237" },
  amber:   { grad: "linear-gradient(135deg,#fbbf24,#d97706)", rgb: "217,119,6" },
  slate:   { grad: "linear-gradient(135deg,#94a3b8,#475569)", rgb: "71,85,105" },
} as const;
export type Tone = keyof typeof TONES;

// Räknar upp mjukt till målvärdet vid mount (null = visa "—").
export function useCountUp(target: number | null, ms = 900): number | null {
  const [n, setN] = useState<number | null>(target === null ? null : 0);
  useEffect(() => {
    if (target === null || typeof target !== "number" || !isFinite(target)) { setN(target); return; }
    let raf = 0, start = 0;
    const tick = (t: number) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / ms);
      setN(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return n;
}

type IconType = React.ComponentType<{ className?: string }>;

// Glas-chip för hero-nyckeltal.
export function HeroChip({ icon: Icon, label }: { icon: IconType; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm font-medium text-white/90 ring-1 ring-white/10 backdrop-blur">
      <Icon className="h-3.5 w-3.5 text-white/70" />
      <span className="tabular-nums">{label}</span>
    </span>
  );
}

// Mörk gradient-hero med mesh-glow. accent = klientfärg som vävs in i glöden.
export function DashHero({
  title, subtitle, accent = "#6366f1", eyebrow, chips, right, icon: Icon,
}: {
  title: string; subtitle?: string; accent?: string;
  eyebrow?: React.ReactNode; chips?: React.ReactNode; right?: React.ReactNode; icon?: IconType;
}) {
  return (
    <section className="cw-reveal relative overflow-hidden rounded-3xl px-7 py-8 md:px-10 md:py-9 text-white"
      style={{ background: "linear-gradient(135deg,#0b1020 0%,#161436 55%,#1e1b4b 100%)" }}>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-28 -left-20 h-80 w-80 rounded-full blur-3xl opacity-50" style={{ background: `radial-gradient(circle,${accent},transparent 70%)`, animation: "cwFloat 9s ease-in-out infinite" }} />
        <div className="absolute -bottom-28 right-0 h-96 w-96 rounded-full blur-3xl opacity-40" style={{ background: "radial-gradient(circle,#7c3aed,transparent 70%)", animation: "cwFloat 11s ease-in-out infinite reverse" }} />
        <div className="absolute top-1/3 left-1/2 h-72 w-72 rounded-full blur-3xl opacity-25" style={{ background: "radial-gradient(circle,#0ea5e9,transparent 70%)" }} />
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)", backgroundSize: "46px 46px" }} />
      </div>
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && <div className="mb-3">{eyebrow}</div>}
          <h1 className="flex items-center gap-3 font-display text-3xl md:text-4xl font-bold tracking-tight">
            {Icon && <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15 backdrop-blur"><Icon className="h-6 w-6 text-white" /></span>}
            {title}
          </h1>
          {subtitle && <p className="mt-2 max-w-xl text-white/60">{subtitle}</p>}
          {chips && <div className="mt-6 flex flex-wrap gap-2.5">{chips}</div>}
        </div>
        {right && <div className="relative shrink-0">{right}</div>}
      </div>
    </section>
  );
}

// Live-pill med pulserande prick (till hero-eyebrow).
export function LivePill({ label }: { label: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium ring-1 ring-white/15 backdrop-blur">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" style={{ animation: "cwPing 1.6s cubic-bezier(0,0,.2,1) infinite" }} />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
      </span>
      <span className="capitalize">{label}</span>
    </div>
  );
}

// Glow-KPI: gradient-ikonbricka, uppräknad siffra, lyft + färgad glow på hover.
export function StatTile({ label, value, sub, icon: Icon, tone = "blue", i = 0 }: {
  label: string; value: number | null; sub?: string; icon: IconType; tone?: Tone; i?: number;
}) {
  const [hover, setHover] = useState(false);
  const animated = useCountUp(value);
  const t = TONES[tone];
  return (
    <div
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      className="cw-reveal group relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-5 transition-all duration-300 hover:-translate-y-1"
      style={{ animationDelay: `${i * 70}ms`, boxShadow: hover ? `0 18px 44px -14px rgba(${t.rgb},.4)` : "0 1px 3px rgba(0,0,0,0.05)" }}
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-[0.14] blur-2xl transition-opacity duration-300 group-hover:opacity-30" style={{ background: t.grad }} />
      <div className="relative">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: t.grad, boxShadow: `0 8px 20px -8px rgba(${t.rgb},.7)` }}>
          <Icon className="h-5 w-5 text-white" />
        </span>
        <div className="mt-4 font-display text-[2rem] font-bold leading-none tabular-nums text-gray-900">{animated === null ? "—" : animated}</div>
        <div className="mt-2 text-sm font-medium text-gray-700">{label}</div>
        {sub && <div className="text-xs text-gray-400">{sub}</div>}
      </div>
    </div>
  );
}
