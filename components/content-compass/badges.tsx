// Content Compass — visuella markörer för kalendern (self-förklarande via tooltips).
// Rena presentationskomponenter (inga hooks) → funkar i både server- och klientkomponenter.
import { BarChart3, Sparkles, CheckCircle2, Heart } from "lucide-react";
import { DISC_GUIDE, FOURA_GUIDE, FUNNEL_GUIDE, type FourA } from "@/lib/content-framework";
import type { DiscLetter, FunnelLevel } from "@/lib/content-compass/data";
import { FUNNEL_LABEL_SV, FOURA_LABEL_SV, DISC_LABEL_SV } from "@/lib/content-compass/labels";

// DISC: D röd, I gul, S grön, C blå.
const DISC_DOT: Record<DiscLetter, string> = {
  D: "bg-red-500", I: "bg-amber-400", S: "bg-emerald-500", C: "bg-blue-500",
};

export function DiscDots({ disc, size = 16 }: { disc?: string[] | null; size?: number }) {
  if (!disc || disc.length === 0) return null;
  return (
    <span className="inline-flex items-center gap-1 align-middle">
      {disc.map((d) => {
        const letter = d as DiscLetter;
        const bg = DISC_DOT[letter] || "bg-gray-400";
        const label = DISC_LABEL_SV[letter];
        return (
          <span key={d} title={label ? `${label}. ${DISC_GUIDE[letter] || ""}` : d}
            className={`inline-flex items-center justify-center rounded-full text-white font-bold leading-none ${bg}`}
            style={{ width: size, height: size, fontSize: Math.round(size * 0.6) }}>
            {letter}
          </span>
        );
      })}
    </span>
  );
}

// Funnel-ton (Förslag A: en-hue-ramp). Appliceras som vänsterkant + svag bakgrund på kortet.
const FUNNEL_TINT: Record<FunnelLevel, string> = {
  tofu: "border-l-slate-300 bg-slate-50/50",
  mofu: "border-l-amber-300 bg-amber-50/40",
  bofu: "border-l-emerald-400 bg-emerald-50/50",
};
const FUNNEL_UP: Record<FunnelLevel, "TOFU" | "MOFU" | "BOFU"> = { tofu: "TOFU", mofu: "MOFU", bofu: "BOFU" };

export function funnelTintClass(level?: string | null): string {
  return level && FUNNEL_TINT[level as FunnelLevel] ? `border-l-4 ${FUNNEL_TINT[level as FunnelLevel]}` : "";
}

export function FunnelLabel({ level }: { level?: string | null }) {
  const lv = level as FunnelLevel;
  if (!level || !FUNNEL_UP[lv]) return null;
  const up = FUNNEL_UP[lv];
  return (
    <span title={`${FUNNEL_LABEL_SV[lv]} (${up}). ${FUNNEL_GUIDE[up]}`} className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-semibold bg-gray-100 text-gray-600 align-middle whitespace-nowrap">
      {FUNNEL_LABEL_SV[lv]}
    </span>
  );
}

// 4A: distinkt ikon + färg + etikett.
const FOURA: Record<FourA, { Icon: typeof BarChart3; bg: string }> = {
  analytical: { Icon: BarChart3, bg: "bg-blue-600" },
  aspirational: { Icon: Sparkles, bg: "bg-purple-600" },
  actionable: { Icon: CheckCircle2, bg: "bg-emerald-600" },
  authentic: { Icon: Heart, bg: "bg-amber-600" },
};

export function FourALabel({ value, compact = false }: { value?: string | null; compact?: boolean }) {
  const meta = value ? FOURA[value as FourA] : null;
  if (!meta) return null;
  const { Icon, bg } = meta;
  return (
    <span title={FOURA_GUIDE[value as FourA]}
      className={`inline-flex items-center gap-1 rounded-full text-white ${bg} align-middle ${compact ? "p-1" : "px-2 py-0.5 text-xs font-semibold"}`}>
      <Icon className="w-3 h-3" />{!compact && FOURA_LABEL_SV[value as FourA]}
    </span>
  );
}

// Bekvämlighet: DISC-pluppar + 4A-etikett + funnel-label i en rad.
export function CompassBadges({ funnel, four_a, disc }: { funnel?: string | null; four_a?: string | null; disc?: string[] | null }) {
  if (!funnel && !four_a && (!disc || disc.length === 0)) return null;
  return (
    <span className="inline-flex items-center gap-1.5 flex-wrap align-middle">
      <FourALabel value={four_a} />
      <FunnelLabel level={funnel} />
      <DiscDots disc={disc} />
    </span>
  );
}
