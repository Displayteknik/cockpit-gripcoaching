"use client";

// Kvalitetsmätaren (PROFIL-1/F-mätare).
// Visar NIVÅ, inte procent. Ett procenttal kan alltid läsas som "89 % klart" — en
// nivå som säger "texterna låter som branschen, inte som du" kan det inte.
// Bredvid nivån: de tre åtgärder som höjer textkvaliteten mest just nu, dynamiskt
// beräknade (störst viktförlust först) och formulerade som uppmaningar.

import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Circle, Loader2, RefreshCw, ArrowRight, AlertTriangle } from "lucide-react";

interface Kriterium {
  key: string;
  label: string;
  vikt: number;
  andel: number;
  antal: number;
  krav: number;
  atgard: string;
  varfor: string;
}

export interface KvalitetsSvar {
  niva: 1 | 2 | 3 | 4 | 5;
  niva_namn: string;
  niva_konsekvens: string;
  ready_to_produce: boolean;
  forankringsflagga: boolean;
  forankring_varning: string | null;
  tak_orsak: string | null;
  atgarder: string[];
  kriterier: Kriterium[];
}

const NIVA_STIL: Record<number, { ring: string; text: string; bg: string }> = {
  1: { ring: "ring-rose-200", text: "text-rose-700", bg: "bg-rose-50" },
  2: { ring: "ring-rose-200", text: "text-rose-700", bg: "bg-rose-50" },
  3: { ring: "ring-amber-200", text: "text-amber-700", bg: "bg-amber-50" },
  4: { ring: "ring-emerald-200", text: "text-emerald-700", bg: "bg-emerald-50" },
  5: { ring: "ring-emerald-200", text: "text-emerald-700", bg: "bg-emerald-50" },
};

function stil(andel: number) {
  if (andel >= 1) return { bar: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50", Icon: CheckCircle2 };
  if (andel >= 0.5) return { bar: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50", Icon: AlertCircle };
  return { bar: "bg-rose-500", text: "text-rose-700", bg: "bg-rose-50", Icon: Circle };
}

export default function QualityMeter({ refreshKey, onNavigate }: { refreshKey?: number; onNavigate?: (key: string) => void }) {
  const [report, setReport] = useState<KvalitetsSvar | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/profile/quality");
      const d = await r.json();
      if (!d.error) setReport(d);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [refreshKey]);

  if (loading && !report) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-center gap-3 text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin" /> Räknar kvalitet...
      </div>
    );
  }
  if (!report) return null;

  const n = NIVA_STIL[report.niva] || NIVA_STIL[3];

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-display font-bold text-gray-900 text-lg">Vad dina texter kan bli av profilen</h2>
          <p className="text-sm text-gray-500 mt-1">
            Skrivhjälpen blir bara så bra som underlaget. Ett fält räknas när det innehåller något bara du kunde ha skrivit.
          </p>
        </div>
        <button onClick={load} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-50 rounded-lg flex-shrink-0" title="Uppdatera">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className={`rounded-xl ${n.bg} ring-1 ${n.ring} p-4`}>
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-xs uppercase tracking-wide text-gray-500">Nivå {report.niva} av 5</span>
          <span className={`font-display font-bold text-xl ${n.text}`}>{report.niva_namn}</span>
        </div>
        <p className="text-sm text-gray-800 mt-1">{report.niva_konsekvens}</p>
        {report.tak_orsak && <p className="text-xs text-gray-600 mt-2">{report.tak_orsak}</p>}
      </div>

      {report.forankringsflagga && report.forankring_varning && (
        <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-3 flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-gray-900">Kontrollera att profilen handlar om rätt verksamhet</div>
            <p className="text-xs text-gray-800 mt-1">{report.forankring_varning}</p>
          </div>
        </div>
      )}

      {report.atgarder.length > 0 && (
        <div className="rounded-lg border border-gray-200 p-4">
          <div className="text-sm font-display font-semibold text-gray-900">Gör det här härnäst</div>
          <p className="text-xs text-gray-500 mt-0.5">De tre sakerna som höjer textkvaliteten mest just nu.</p>
          <ol className="mt-3 space-y-2">
            {report.atgarder.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-800">
                <span className="mt-0.5 w-5 h-5 rounded-full bg-gray-900 text-white text-xs flex items-center justify-center flex-shrink-0">{i + 1}</span>
                <span>{a}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="grid gap-3">
        {report.kriterier.map((k) => {
          const s = stil(k.andel);
          const Icon = s.Icon;
          const clickable = !!onNavigate;
          return (
            <button
              key={k.key}
              type="button"
              onClick={clickable ? () => onNavigate!(k.key) : undefined}
              disabled={!clickable}
              className={`group text-left w-full rounded-lg border ${s.bg} border-gray-200 p-4 transition ${
                clickable ? "cursor-pointer hover:border-gray-300 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Icon className={`w-5 h-5 ${s.text}`} />
                  <div>
                    <div className="font-display font-semibold text-gray-900 flex items-center gap-1.5">
                      {k.label}
                      {clickable && <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all" />}
                    </div>
                    <div className="text-xs text-gray-500">
                      {k.antal} av {k.krav} · väger {k.vikt} %
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-3 h-2 bg-white rounded-full overflow-hidden">
                <div className={`h-full ${s.bar} transition-all duration-500`} style={{ width: `${Math.round(k.andel * 100)}%` }} />
              </div>
              {k.atgard && <div className="mt-3 text-xs text-gray-800 font-medium">{k.atgard}</div>}
              <div className="mt-1 text-xs text-gray-500 italic">{k.varfor}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
