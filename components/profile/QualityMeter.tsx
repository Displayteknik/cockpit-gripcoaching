"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Circle, Loader2, RefreshCw } from "lucide-react";

interface Dimension {
  key: string;
  label: string;
  status: "red" | "yellow" | "green";
  score: number;
  filled: number;
  total: number;
  missing: string[];
  hint: string;
}

interface QualityReport {
  overall: number;
  ready_to_produce: boolean;
  dimensions: Dimension[];
}

const STATUS_STYLES = {
  green: { bar: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50", icon: CheckCircle2 },
  yellow: { bar: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50", icon: AlertCircle },
  red: { bar: "bg-rose-500", text: "text-rose-700", bg: "bg-rose-50", icon: Circle },
};

export default function QualityMeter({ refreshKey }: { refreshKey?: number }) {
  const [report, setReport] = useState<QualityReport | null>(null);
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

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display font-bold text-gray-900 text-lg">
            Datakvalitet — fundamentet för bra innehåll
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            AI:n kan bara producera så bra som datan ni matar in. Alla fem ska bli gröna innan
            generatorn producerar i full kvalitet.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs text-gray-400">Totalt</div>
            <div className="text-2xl font-bold text-gray-900">{report.overall}%</div>
          </div>
          <button
            onClick={load}
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-50 rounded-lg"
            title="Uppdatera"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {report.ready_to_produce && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center gap-2 text-emerald-800 text-sm font-medium">
          <CheckCircle2 className="w-5 h-5" />
          Klar att producera — alla fem dimensioner är gröna.
        </div>
      )}

      <div className="grid gap-3">
        {report.dimensions.map((d) => {
          const s = STATUS_STYLES[d.status];
          const Icon = s.icon;
          return (
            <div key={d.key} className={`rounded-lg border ${s.bg} border-gray-200 p-4`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Icon className={`w-5 h-5 ${s.text}`} />
                  <div>
                    <div className="font-display font-semibold text-gray-900">{d.label}</div>
                    <div className="text-xs text-gray-500">
                      {d.filled} av {d.total} klara
                    </div>
                  </div>
                </div>
                <div className={`text-sm font-bold ${s.text}`}>{d.score}%</div>
              </div>
              <div className="mt-3 h-2 bg-white rounded-full overflow-hidden">
                <div
                  className={`h-full ${s.bar} transition-all duration-500`}
                  style={{ width: `${d.score}%` }}
                />
              </div>
              {d.missing.length > 0 && (
                <div className="mt-3 text-xs space-y-1">
                  <div className="text-gray-500 font-medium">Saknas:</div>
                  <ul className="text-gray-600 space-y-0.5">
                    {d.missing.map((m, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-gray-400">·</span>
                        <span>{m}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="mt-2 text-xs text-gray-500 italic">{d.hint}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
