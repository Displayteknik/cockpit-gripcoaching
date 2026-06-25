"use client";

import { useEffect, useState } from "react";
import { Globe, MousePointer, ExternalLink, Loader2, Code2, Check, Copy } from "lucide-react";

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
  snippet = "",
}: {
  primaryColor?: string;
  clientName: string;
  snippet?: string;
}) {
  const [traffic, setTraffic] = useState<SiteTraffic | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/seo/analytics")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setTraffic(d))
      .finally(() => setLoading(false));
  }, []);

  function copySnippet() {
    navigator.clipboard.writeText(snippet).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const noData = !traffic || traffic.visits_30d === 0;

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="font-display text-2xl font-bold text-gray-900 flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${primaryColor}1a` }}>
            <Globe className="w-[18px] h-[18px]" style={{ color: primaryColor }} />
          </span>
          Besökare
        </h1>
        <p className="text-gray-500 text-sm mt-1">Hur många som besöker din sajt, varifrån de kommer och vilka sidor de tittar på.</p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-400 text-sm py-12 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Hämtar besöksdata…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            <KPI label="Besök 24h" value={traffic?.visits_24h ?? 0} color={primaryColor} />
            <KPI label="Besök 7 dagar" value={traffic?.visits_7d ?? 0} color={primaryColor} />
            <KPI label="Besök 30 dagar" value={traffic?.visits_30d ?? 0} color={primaryColor} />
          </div>

          {/* Få igång mätningen — visas tills pixeln skickar trafik */}
          {noData && snippet && (
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-2.5 mb-1">
                <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${primaryColor}1a` }}>
                  <Code2 className="w-[18px] h-[18px]" style={{ color: primaryColor }} />
                </span>
                <h2 className="font-display font-bold text-gray-900 text-lg">Få igång din statistik</h2>
              </div>
              <p className="text-sm text-gray-500 mb-4">
                Lägg in den här lilla koden i <code className="px-1 py-0.5 rounded bg-gray-100 text-gray-700 text-xs">&lt;head&gt;</code> på din sajt — en gång.
                Sen fylls siffrorna i automatiskt så fort någon besöker den.
              </p>
              <div className="relative">
                <pre className="bg-gray-900 text-gray-100 text-xs rounded-xl p-4 overflow-x-auto leading-relaxed">{snippet}</pre>
                <button
                  onClick={copySnippet}
                  className="absolute top-3 right-3 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
                >
                  {copied ? <><Check className="w-3.5 h-3.5" /> Kopierad</> : <><Copy className="w-3.5 h-3.5" /> Kopiera</>}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-3">
                Vet du inte var koden ska in? Skicka den till den som sköter din hemsida — eller hör av dig så hjälper vi till.
              </p>
            </div>
          )}

          {!noData && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <section className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
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

                <section className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
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
                <section className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
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
            </>
          )}

          <p className="text-xs text-gray-400 text-center">{clientName} · besöksdata via spårningspixel</p>
        </>
      )}
    </div>
  );
}

function KPI({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
      <span className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ color, background: `${color}1a` }}>
        <MousePointer className="w-[18px] h-[18px]" />
      </span>
      <div className="text-3xl font-bold font-display text-gray-900 tabular-nums">
        {typeof value === "number" ? value.toLocaleString("sv-SE") : value}
      </div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}
