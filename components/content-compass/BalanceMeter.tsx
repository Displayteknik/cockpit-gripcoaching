"use client";

// CC-3 balansmätare: faktisk innehållsmix (rullande 30 dagar) mot schema-målet,
// med varningar i klarspråk. Diskret kort i kalender/nav. Grindas på compass-modul.
import { useEffect, useState } from "react";
import { Gauge, AlertTriangle, Loader2 } from "lucide-react";

interface Mix { total: number; tofu: number; mofu: number; bofu: number; tofuShare: number }
interface Target { perWeek: number; tofuShare: number; mofuShare: number; bofuShare: number }
interface BalanceData { enabled: boolean; cadence: string; mix: Mix; warnings: string[]; target: Target }

const FUNNEL_BAR: Record<string, string> = { tofu: "bg-slate-400", mofu: "bg-amber-400", bofu: "bg-emerald-500" };
const FUNNEL_LABEL: Record<string, string> = { tofu: "TOFU (toppen)", mofu: "MOFU (mitten)", bofu: "BOFU (sälj)" };

export default function BalanceMeter({ reloadKey = 0 }: { reloadKey?: number }) {
  const [data, setData] = useState<BalanceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch("/api/content/balance")
      .then((r) => r.json())
      .then((d) => { if (alive && !d.error) setData(d); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [reloadKey]);

  // Grinda bort helt om modulen är av eller inget svar.
  if (!loading && (!data || !data.enabled)) return null;

  const mix = data?.mix;
  const classified = mix ? mix.tofu + mix.mofu + mix.bofu : 0;
  const pct = (n: number) => (classified > 0 ? Math.round((n / classified) * 100) : 0);
  const rows: { key: "tofu" | "mofu" | "bofu"; count: number }[] = [
    { key: "tofu", count: mix?.tofu || 0 },
    { key: "mofu", count: mix?.mofu || 0 },
    { key: "bofu", count: mix?.bofu || 0 },
  ];

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <Gauge className="w-5 h-5 text-violet-600" />
        <h2 className="font-display font-bold text-gray-900 text-base">Balans</h2>
        {data && <span className="text-xs text-gray-400">senaste 30 dagarna · {classified} klassade inlägg</span>}
      </div>
      <p className="text-xs text-gray-400 mb-4">Din mix mot målet. Bygg först räckvidd och intresse, sälj sedan.</p>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-3"><Loader2 className="w-4 h-4 animate-spin" /> Räknar.</div>
      ) : classified === 0 ? (
        <div className="text-sm text-gray-400">Inga klassade inlägg än. Skapa veckans innehåll eller klassa dina inlägg så fylls mätaren.</div>
      ) : (
        <div className="space-y-2.5">
          {rows.map(({ key, count }) => {
            const actual = pct(count);
            const goal = Math.round((data!.target[`${key}Share` as "tofuShare" | "mofuShare" | "bofuShare"] || 0) * 100);
            return (
              <div key={key}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium text-gray-700">{FUNNEL_LABEL[key]}</span>
                  <span className="text-gray-400">{actual}% · mål {goal}%</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div className={`h-full rounded-full ${FUNNEL_BAR[key]}`} style={{ width: `${actual}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {data && data.warnings.length > 0 && (
        <div className="mt-4 space-y-1.5">
          {data.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> <span>{w}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
