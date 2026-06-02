"use client";

import { useEffect, useState } from "react";
import { Globe, MousePointer, ExternalLink, Loader2 } from "lucide-react";

interface SiteTraffic {
  visits_24h: number;
  visits_7d: number;
  visits_30d: number;
  top_paths: { key: string; count: number }[];
  top_referrers: { key: string; count: number }[];
  recent: { path: string | null; referrer: string | null; ts: string }[];
}

export default function BesokareClient({
  primaryColor = "#10B981",
  clientName,
}: {
  primaryColor?: string;
  clientName: string;
}) {
  const [traffic, setTraffic] = useState<SiteTraffic | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/seo/analytics")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setTraffic(d))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="font-display text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Globe className="w-6 h-6" style={{ color: primaryColor }} />
          Besökare
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Statistik från er spårningspixel — uppdateras automatiskt, inget att koppla.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-400 text-sm py-12 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Hämtar besöksdata…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <KPI label="Besök 24h" value={traffic?.visits_24h ?? "—"} color={primaryColor} />
            <KPI label="Besök 7 dagar" value={traffic?.visits_7d ?? "—"} color={primaryColor} />
            <KPI label="Besök 30 dagar" value={traffic?.visits_30d ?? "—"} color={primaryColor} />
          </div>

          {traffic && traffic.visits_30d === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
              Inga besök registrerade än — pixeln väntar på trafik. Så fort någon besöker sajten dyker det upp här.
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <section className="bg-white border border-gray-200 rounded-xl p-5">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Mest besökta sidor</h2>
              {!traffic || traffic.top_paths.length === 0 ? (
                <p className="text-xs text-gray-400">Ingen data än</p>
              ) : (
                <ul className="space-y-2">
                  {traffic.top_paths.slice(0, 8).map((p, i) => (
                    <li key={i} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 truncate font-mono text-xs" title={p.key}>{p.key || "/"}</span>
                      <span className="text-gray-500 font-semibold tabular-nums">{p.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="bg-white border border-gray-200 rounded-xl p-5">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Var trafiken kommer ifrån</h2>
              {!traffic || traffic.top_referrers.length === 0 ? (
                <p className="text-xs text-gray-400">Ingen data än — eller så är alla besök direkta</p>
              ) : (
                <ul className="space-y-2">
                  {traffic.top_referrers.slice(0, 8).map((r, i) => {
                    const host = r.key.replace(/^https?:\/\//, "").split("/")[0];
                    return (
                      <li key={i} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700 truncate flex items-center gap-1.5" title={r.key}>
                          <ExternalLink className="w-3 h-3 text-gray-400" /> {host || r.key}
                        </span>
                        <span className="text-gray-500 font-semibold tabular-nums">{r.count}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>

          {traffic && traffic.recent.length > 0 && (
            <section className="bg-white border border-gray-200 rounded-xl p-5">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Senaste besöken</h2>
              <ul className="space-y-1.5 text-xs">
                {traffic.recent.slice(0, 10).map((v, i) => (
                  <li key={i} className="flex items-center gap-2 text-gray-600">
                    <span className="text-gray-400 tabular-nums w-12 shrink-0">
                      {new Date(v.ts).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className="font-mono truncate flex-1" title={v.path || ""}>{v.path || "/"}</span>
                    {v.referrer && (
                      <span className="text-gray-400 truncate max-w-[140px]" title={v.referrer}>
                        ← {v.referrer.replace(/^https?:\/\//, "").split("/")[0]}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p className="text-[11px] text-gray-400 text-center">{clientName} · besöksdata via spårningspixel</p>
        </>
      )}
    </div>
  );
}

function KPI({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center border mb-2" style={{ color, borderColor: `${color}33`, background: `${color}0D` }}>
        <MousePointer className="w-4 h-4" />
      </div>
      <div className="text-2xl font-bold font-display text-gray-900">
        {typeof value === "number" ? value.toLocaleString("sv-SE") : value}
      </div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}
