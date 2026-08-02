"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Coins, TrendingUp, CalendarDays, Wallet, ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import { DashHero, HeroChip, LivePill, StatTile } from "@/components/ui/dash";

// KOSTNAD-1 K3 — vad AI:n kostar, var pengarna går och vilken provider som är nere.
// Endast huvudadmin (API:t grindar). Klarspråk, inga tankstreck i UI-texterna.

interface Grupp { nyckel: string; kostnad: number; anrop: number; fel: number }
interface TenantRad { tenantId: string | null; namn: string; kostnad: number; anrop: number; fel: number; tak: number; procent: number }
interface HealthRad {
  provider: string; senaste_ok: string | null; senaste_fel: string | null;
  senaste_felklass: string | null; senaste_httpstatus: number | null; senaste_svarskropp: string | null;
  fel_senaste_timmen: number; ok_senaste_timmen: number; rod: boolean; text: string | null;
}
interface FelRad {
  created_at: string; provider: string; flow: string; model: string;
  error_class: string | null; http_status: number | null; error_body: string | null;
}
interface Data {
  summa: { idag: number; vecka: number; manad: number; prognos: number };
  health: HealthRad[];
  perProvider: Grupp[];
  perFlow: Grupp[];
  perTenant: TenantRad[];
  plattform: { tak: number | null; varningProcent: number; manad: number };
  fel: FelRad[];
  antalHandelser: number;
}

const kr = (n: number) => `${n.toLocaleString("sv-SE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr`;
const tid = (s: string | null) => (s ? new Date(s).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" }) : "aldrig");

const FELKLASS_TEXT: Record<string, string> = {
  billing: "Betalning",
  quota: "Kvot",
  auth: "Nyckel",
  model: "Modell",
  other: "Övrigt",
};

/** Vågrätt stapeldiagram i tabellform. Bredden är andel av den dyraste raden. */
function Stapel({ rader, max, etikett }: { rader: Grupp[]; max: number; etikett: string }) {
  if (!rader.length) return <p className="px-5 py-6 text-sm text-gray-500">Inga anrop den här månaden än.</p>;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-500">
          <th className="px-5 py-2.5 font-medium">{etikett}</th>
          <th className="px-3 py-2.5 font-medium">Andel</th>
          <th className="px-3 py-2.5 text-right font-medium">Kostnad</th>
          <th className="px-3 py-2.5 text-right font-medium">Anrop</th>
          <th className="px-5 py-2.5 text-right font-medium">Fel</th>
        </tr>
      </thead>
      <tbody>
        {rader.map((g) => (
          <tr key={g.nyckel || "-"} className="border-b border-gray-50 last:border-0">
            <td className="px-5 py-2.5 font-medium text-gray-800">{g.nyckel || "okänt"}</td>
            <td className="px-3 py-2.5 w-1/3">
              <div className="h-2 w-full rounded-full bg-gray-100">
                <div className="h-2 rounded-full" style={{ width: `${max > 0 ? Math.max(2, (g.kostnad / max) * 100) : 0}%`, background: "linear-gradient(90deg,#38bdf8,#2563eb)" }} />
              </div>
            </td>
            <td className="px-3 py-2.5 text-right tabular-nums text-gray-900">{kr(g.kostnad)}</td>
            <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">{g.anrop}</td>
            <td className={`px-5 py-2.5 text-right tabular-nums ${g.fel ? "font-semibold text-red-600" : "text-gray-400"}`}>{g.fel}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function KostnaderPage() {
  const [data, setData] = useState<Data | null>(null);
  const [fel, setFel] = useState("");
  const [laddar, setLaddar] = useState(true);
  const [oppetFel, setOppetFel] = useState<number | null>(null);
  const [redigerar, setRedigerar] = useState<string | null>(null);
  const [nyttTak, setNyttTak] = useState("");
  const [sparar, setSparar] = useState(false);

  const hamta = useCallback(async () => {
    setLaddar(true);
    try {
      const r = await fetch("/api/kostnader");
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Kunde inte hämta kostnaderna");
      setData(j);
      setFel("");
    } catch (e) {
      setFel((e as Error).message);
    } finally {
      setLaddar(false);
    }
  }, []);

  useEffect(() => { hamta(); }, [hamta]);

  async function sparaTak(tenantId: string) {
    setSparar(true);
    try {
      const r = await fetch("/api/kostnader", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, tak: Number(nyttTak) }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Kunde inte spara taket");
      setRedigerar(null);
      await hamta();
    } catch (e) {
      setFel((e as Error).message);
    } finally {
      setSparar(false);
    }
  }

  const roda = data?.health.filter((h) => h.rod) || [];
  const maxProvider = Math.max(0, ...(data?.perProvider.map((g) => g.kostnad) || [0]));
  const maxFlow = Math.max(0, ...(data?.perFlow.map((g) => g.kostnad) || [0]));
  const plattformProcent =
    data?.plattform.tak && data.plattform.tak > 0 ? (data.plattform.manad / data.plattform.tak) * 100 : 0;

  return (
    <div className="space-y-6">
      <DashHero
        title="Vad AI:n kostar"
        subtitle="Varje anrop till en AI-tjänst loggas här: vad det kostade, vilket flöde det tillhörde och om det gick fel."
        icon={Coins}
        eyebrow={<LivePill label="denna månad" />}
        chips={
          data ? (
            <>
              <HeroChip icon={Wallet} label={`${kr(data.summa.manad)} hittills`} />
              <HeroChip icon={TrendingUp} label={`${kr(data.summa.prognos)} vid månadsslut`} />
              <HeroChip icon={CalendarDays} label={`${data.antalHandelser} anrop`} />
            </>
          ) : undefined
        }
        right={
          <button onClick={hamta} disabled={laddar}
            className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white ring-1 ring-white/20 backdrop-blur hover:bg-white/20 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${laddar ? "animate-spin" : ""}`} /> Uppdatera
          </button>
        }
      />

      {fel && <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{fel}</div>}

      {/* Larmbanner: en provider som svarar med betalnings- eller nyckelfel stoppar allt som
          går genom den. Klartext plus länk till rätt ställe att åtgärda det på. */}
      {roda.map((h) => (
        <div key={h.provider} className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-red-800">{h.text}</p>
            <p className="mt-1 text-sm text-red-700">
              Senaste lyckade anrop: {tid(h.senaste_ok)}. Svarskod {h.senaste_httpstatus ?? "okänd"}.
            </p>
            {h.senaste_svarskropp && (
              <pre className="mt-2 max-h-32 overflow-auto rounded-lg bg-white/70 p-3 text-xs text-red-900">{h.senaste_svarskropp.slice(0, 1200)}</pre>
            )}
            <a
              href={h.provider === "gemini" ? "https://console.cloud.google.com/billing" : h.provider === "anthropic" ? "https://console.anthropic.com/settings/billing" : h.provider === "fal" ? "https://fal.ai/dashboard/billing" : "#"}
              target="_blank" rel="noreferrer"
              className="mt-3 inline-flex rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700">
              Öppna fakturasidan hos {h.provider}
            </a>
          </div>
        </div>
      ))}

      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Idag" value={Math.round(data.summa.idag)} sub={kr(data.summa.idag)} icon={Coins} tone="blue" i={0} />
            <StatTile label="Senaste sju dagarna" value={Math.round(data.summa.vecka)} sub={kr(data.summa.vecka)} icon={CalendarDays} tone="violet" i={1} />
            <StatTile label="Denna månad" value={Math.round(data.summa.manad)} sub={kr(data.summa.manad)} icon={Wallet} tone="emerald" i={2} />
            <StatTile label="Prognos månadsslut" value={Math.round(data.summa.prognos)} sub={kr(data.summa.prognos)} icon={TrendingUp} tone="amber" i={3} />
          </div>

          {/* Globalt tak: varning vid inställd procent (default 90). */}
          {data.plattform.tak && (
            <div className={`rounded-2xl border px-5 py-4 ${plattformProcent >= 100 ? "border-red-200 bg-red-50" : plattformProcent >= data.plattform.varningProcent ? "border-amber-200 bg-amber-50" : "border-gray-100 bg-white"}`}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-800">Plattformens månadstak</span>
                <span className="tabular-nums text-gray-600">{kr(data.plattform.manad)} av {kr(data.plattform.tak)}</span>
              </div>
              <div className="mt-2 h-2 w-full rounded-full bg-gray-100">
                <div className="h-2 rounded-full transition-all" style={{ width: `${Math.min(100, plattformProcent)}%`, background: plattformProcent >= 100 ? "#dc2626" : plattformProcent >= data.plattform.varningProcent ? "#d97706" : "linear-gradient(90deg,#34d399,#059669)" }} />
              </div>
            </div>
          )}

          {/* Providerhälsa */}
          <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
            <h2 className="border-b border-gray-100 px-5 py-3.5 font-display text-lg font-semibold text-gray-900">Tjänsternas läge</h2>
            {data.health.length === 0 ? (
              <p className="px-5 py-6 text-sm text-gray-500">Inga anrop loggade än. Så fort något genereras dyker tjänsterna upp här.</p>
            ) : (
              <ul className="divide-y divide-gray-50">
                {data.health.map((h) => (
                  <li key={h.provider} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${h.rod ? "bg-red-500" : h.fel_senaste_timmen > 0 ? "bg-amber-400" : "bg-emerald-500"}`} />
                    <span className="min-w-28 font-medium text-gray-900">{h.provider}</span>
                    <span className="text-gray-500">Senast klart: {tid(h.senaste_ok)}</span>
                    {h.senaste_fel && (
                      <span className="text-gray-500">
                        Senaste fel: {tid(h.senaste_fel)} ({FELKLASS_TEXT[h.senaste_felklass || "other"]})
                      </span>
                    )}
                    <span className="ml-auto tabular-nums text-gray-400">{h.ok_senaste_timmen} klara / {h.fel_senaste_timmen} fel senaste timmen</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Per klient, mot taket */}
          <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
            <h2 className="border-b border-gray-100 px-5 py-3.5 font-display text-lg font-semibold text-gray-900">Per klient</h2>
            {data.perTenant.length === 0 ? (
              <p className="px-5 py-6 text-sm text-gray-500">Inga anrop den här månaden än.</p>
            ) : (
              <ul className="divide-y divide-gray-50">
                {data.perTenant.map((t) => {
                  const rod = t.procent >= 100;
                  const gul = !rod && t.procent >= 75;
                  return (
                    <li key={t.tenantId || "utan"} className="px-5 py-4">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-medium text-gray-900">{t.namn}</span>
                        <span className={`tabular-nums text-sm ${rod ? "font-semibold text-red-600" : gul ? "font-semibold text-amber-600" : "text-gray-600"}`}>
                          {kr(t.kostnad)} av {kr(t.tak)} ({Math.round(t.procent)} procent)
                        </span>
                      </div>
                      <div className="mt-2 h-2 w-full rounded-full bg-gray-100">
                        <div className="h-2 rounded-full transition-all" style={{ width: `${Math.min(100, Math.max(1, t.procent))}%`, background: rod ? "#dc2626" : gul ? "#d97706" : "linear-gradient(90deg,#34d399,#059669)" }} />
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                        <span>{t.anrop} anrop{t.fel > 0 ? `, ${t.fel} fel` : ""}</span>
                        {rod && <span className="font-medium text-red-600">Nya genereringar är stoppade för den här klienten tills taket höjs eller månaden vänder.</span>}
                        {t.tenantId && (redigerar === t.tenantId ? (
                          <span className="inline-flex items-center gap-2">
                            <input type="number" min={0} value={nyttTak} onChange={(e) => setNyttTak(e.target.value)}
                              className="w-24 rounded-lg border border-gray-200 px-2 py-1 text-sm" />
                            <button onClick={() => sparaTak(t.tenantId!)} disabled={sparar}
                              className="rounded-lg bg-gray-900 px-2.5 py-1 font-medium text-white disabled:opacity-50">Spara</button>
                            <button onClick={() => setRedigerar(null)} className="text-gray-500 underline">Avbryt</button>
                          </span>
                        ) : (
                          <button onClick={() => { setRedigerar(t.tenantId!); setNyttTak(String(t.tak)); }}
                            className="font-medium text-gray-700 underline">Ändra taket</button>
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
            <h2 className="border-b border-gray-100 px-5 py-3.5 font-display text-lg font-semibold text-gray-900">Per tjänst</h2>
            <Stapel rader={data.perProvider} max={maxProvider} etikett="Tjänst" />
          </section>

          <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
            <h2 className="border-b border-gray-100 px-5 py-3.5 font-display text-lg font-semibold text-gray-900">Per flöde</h2>
            <Stapel rader={data.perFlow} max={maxFlow} etikett="Flöde" />
          </section>

          {/* Fellogg med hela svarskroppen — regeln från betalningsspärren. */}
          <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
            <h2 className="border-b border-gray-100 px-5 py-3.5 font-display text-lg font-semibold text-gray-900">
              Senaste felen {data.fel.length > 0 && <span className="text-sm font-normal text-gray-500">({data.fel.length})</span>}
            </h2>
            {data.fel.length === 0 ? (
              <p className="px-5 py-6 text-sm text-gray-500">Inga fel den här månaden. Bra läge.</p>
            ) : (
              <ul className="divide-y divide-gray-50">
                {data.fel.map((f, i) => (
                  <li key={i}>
                    <button onClick={() => setOppetFel(oppetFel === i ? null : i)}
                      className="flex w-full items-center gap-3 px-5 py-3 text-left text-sm hover:bg-gray-50">
                      {oppetFel === i ? <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" /> : <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />}
                      <span className="tabular-nums text-gray-500">{tid(f.created_at)}</span>
                      <span className="font-medium text-gray-900">{f.provider}</span>
                      <span className="text-gray-600">{f.flow}</span>
                      <span className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-medium ${f.error_class === "billing" || f.error_class === "auth" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                        {FELKLASS_TEXT[f.error_class || "other"]}{f.http_status ? ` ${f.http_status}` : ""}
                      </span>
                    </button>
                    {oppetFel === i && (
                      <pre className="mx-5 mb-3 max-h-72 overflow-auto rounded-lg bg-gray-900 p-4 text-xs leading-relaxed text-gray-100">
                        {f.error_body || "Ingen svarskropp sparades för det här felet."}
                      </pre>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
