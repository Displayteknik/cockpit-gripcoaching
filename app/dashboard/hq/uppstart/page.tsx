"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  CheckCircle2, ChevronDown, ChevronRight, Circle, Clock, ListChecks,
  Loader2, PauseCircle, Play, RefreshCw, Rocket, Trash2, X,
} from "lucide-react";
import { DashHero, HeroChip, LivePill } from "@/components/ui/dash";

// START-1 — uppstartsmodulen. En plats där allt som måste göras för att systemet ska
// rulla ligger samlat, i ordning, med skälet skrivet bredvid.
// Modulen mäter och vägleder. Den agerar aldrig åt dig. Inga AI-anrop.

interface Kontroll { kontrolltyp: string; senast_kord: string | null; resultat_text: string | null; uppfyllt: boolean }
interface Steg {
  id: string; titel: string; varfor: string; hur: string | null; kategori: string;
  blockerar: string[]; uppskattad_tid_min: number; sortering: number;
  status: "att_gora" | "pagar" | "klar" | "skjutet";
  klar_datum: string | null; anteckning: string | null; egen: boolean;
  kontroll: Kontroll | null; delvis: boolean;
}
interface Data {
  steg: Steg[];
  sammanfattning: { klara: number; totalt: number; skjutna: number; minuterKvar: number; mysalesKlart: boolean };
  nasta: Steg | null;
}

const KATEGORINAMN: Record<string, string> = {
  mysales: "MySales", ekonomi: "Ekonomi", drift: "Drift", cockpit: "Cockpit", kalender: "Kalender",
};
const ORDNING = ["mysales", "ekonomi", "drift", "cockpit", "kalender"];

const tidText = (min: number) => (min >= 60 ? `${Math.round((min / 60) * 10) / 10} h` : `${min} min`);

/** Länkar i hur-texten öppnas i ny flik. Att tappa uppstartslistan mitt i ett steg är onödigt. */
const MD = {
  a: (p: React.ComponentProps<"a">) => (
    <a {...p} target="_blank" rel="noreferrer" className="font-medium text-indigo-600 underline hover:text-indigo-800" />
  ),
  ol: (p: React.ComponentProps<"ol">) => <ol {...p} className="ml-5 list-decimal space-y-1" />,
  ul: (p: React.ComponentProps<"ul">) => <ul {...p} className="ml-5 list-disc space-y-1" />,
  p: (p: React.ComponentProps<"p">) => <p {...p} className="mb-2 last:mb-0" />,
  strong: (p: React.ComponentProps<"strong">) => <strong {...p} className="font-semibold text-gray-900" />,
};

export default function UppstartPage() {
  const [data, setData] = useState<Data | null>(null);
  const [fel, setFel] = useState("");
  const [laddar, setLaddar] = useState(true);
  const [sparar, setSparar] = useState<string | null>(null);
  const [oppna, setOppna] = useState<Record<string, boolean>>({});
  const [stangdaGrupper, setStangdaGrupper] = useState<Record<string, boolean>>({});
  const [visaAllt, setVisaAllt] = useState(false);
  const [guidad, setGuidad] = useState<string | null>(null);
  const [skjuter, setSkjuter] = useState<{ id: string; anteckning: string } | null>(null);
  const [nyttSteg, setNyttSteg] = useState<{ titel: string; varfor: string; kategori: string; tid: string; sortering: string } | null>(null);

  const hamta = useCallback(async (tvinga = false) => {
    setLaddar(true);
    try {
      const r = await fetch(`/api/hq/uppstart${tvinga ? "?uppdatera=1" : ""}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Kunde inte hämta uppstartslistan");
      setData(j);
      setFel("");
    } catch (e) {
      setFel((e as Error).message);
    } finally {
      setLaddar(false);
    }
  }, []);

  useEffect(() => { hamta(); }, [hamta]);

  async function sattStatus(id: string, status: Steg["status"], anteckning?: string) {
    setSparar(id);
    try {
      const r = await fetch("/api/hq/uppstart", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, ...(anteckning !== undefined ? { anteckning } : {}) }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Kunde inte spara");
      setFel("");
      await hamta();
      return true;
    } catch (e) {
      setFel((e as Error).message);
      return false;
    } finally {
      setSparar(null);
    }
  }

  const kvarLista = useMemo(
    () => (data?.steg || []).filter((s) => s.status !== "klar" && s.status !== "skjutet"),
    [data],
  );
  const guidatSteg = guidad ? data?.steg.find((s) => s.id === guidad) || null : null;
  const procent = data && data.sammanfattning.totalt > 0
    ? (data.sammanfattning.klara / data.sammanfattning.totalt) * 100 : 0;

  return (
    <div className="space-y-6">
      <DashHero
        title="Uppstart"
        subtitle="Allt som behöver göras för att systemet ska rulla, i ordning och med skälet bredvid. Bocka av ett steg i taget. Där siffran går att mäta mäter systemet den åt dig."
        icon={Rocket}
        eyebrow={<LivePill label="uppstart" />}
        chips={
          data ? (
            <>
              <HeroChip icon={ListChecks} label={`${data.sammanfattning.klara} av ${data.sammanfattning.totalt} klara`} />
              <HeroChip icon={Clock} label={`${tidText(data.sammanfattning.minuterKvar)} kvar`} />
            </>
          ) : undefined
        }
        right={
          <button onClick={() => hamta(true)} disabled={laddar}
            className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white ring-1 ring-white/20 backdrop-blur hover:bg-white/20 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${laddar ? "animate-spin" : ""}`} /> Uppdatera
          </button>
        }
      />

      {fel && <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{fel}</div>}

      {data && (
        <>
          {/* Progress */}
          <div className="rounded-2xl border border-gray-100 bg-white px-5 py-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
              <span className="font-medium text-gray-800">
                {data.sammanfattning.klara} av {data.sammanfattning.totalt} klara
              </span>
              <span className="tabular-nums text-gray-500">
                {Math.round(procent)} procent{data.sammanfattning.skjutna > 0 ? `, ${data.sammanfattning.skjutna} uppskjutna` : ""}
              </span>
            </div>
            <div className="mt-2 h-2.5 w-full rounded-full bg-gray-100">
              <div className="h-2.5 rounded-full transition-all"
                style={{ width: `${Math.max(1, procent)}%`, background: "linear-gradient(90deg,#34d399,#059669)" }} />
            </div>
          </div>

          {/* Nästa steg, lyft som eget kort */}
          {data.nasta && !guidatSteg && (
            <section className="overflow-hidden rounded-2xl border border-indigo-200 bg-indigo-50 px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Nästa steg</p>
                  <h2 className="mt-1 font-display text-lg font-semibold text-gray-900">{data.nasta.titel}</h2>
                  <p className="mt-1 max-w-2xl text-sm text-gray-700">{data.nasta.varfor}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {KATEGORINAMN[data.nasta.kategori]} · {tidText(data.nasta.uppskattad_tid_min)}
                    {data.nasta.blockerar.length > 0 ? ` · väntar på detta: ${data.nasta.blockerar.join(", ")}` : ""}
                  </p>
                </div>
                <button onClick={() => setGuidad(data.nasta!.id)}
                  className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                  <Play className="h-4 w-4" /> Börja
                </button>
              </div>
            </section>
          )}

          {/* Guidat läge: ETT steg i taget, i fullbredd. */}
          {guidatSteg && (
            <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 bg-gray-50 px-5 py-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Guidat läge · {KATEGORINAMN[guidatSteg.kategori]} · {tidText(guidatSteg.uppskattad_tid_min)}
                </span>
                <button onClick={() => setGuidad(null)} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900">
                  <X className="h-4 w-4" /> Stäng guidningen
                </button>
              </div>
              <div className="px-5 py-5">
                <h2 className="font-display text-2xl font-semibold text-gray-900">{guidatSteg.titel}</h2>
                <p className="mt-2 max-w-2xl text-gray-700">{guidatSteg.varfor}</p>

                {guidatSteg.kontroll && <KontrollRad k={guidatSteg.kontroll} />}

                {guidatSteg.hur && (
                  <div className="mt-4 rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-700">
                    <ReactMarkdown components={MD}>{guidatSteg.hur}</ReactMarkdown>
                  </div>
                )}

                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <button disabled={sparar === guidatSteg.id}
                    onClick={async () => {
                      const ok = await sattStatus(guidatSteg.id, "klar");
                      if (ok) {
                        const nasta = kvarLista.find((s) => s.id !== guidatSteg.id);
                        setGuidad(nasta ? nasta.id : null);
                      }
                    }}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
                      {sparar === guidatSteg.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Klar
                  </button>
                  <button
                    onClick={() => {
                      const i = kvarLista.findIndex((s) => s.id === guidatSteg.id);
                      const nasta = kvarLista[i + 1] || kvarLista[0];
                      if (nasta && nasta.id !== guidatSteg.id) setGuidad(nasta.id);
                    }}
                    className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                    Nästa
                  </button>
                  <button onClick={() => setSkjuter({ id: guidatSteg.id, anteckning: guidatSteg.anteckning || "" })}
                    className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
                    Skjut upp
                  </button>
                  <span className="ml-auto text-xs text-gray-400">{kvarLista.length} steg kvar att göra</span>
                </div>
              </div>
            </section>
          )}

          {/* Filter */}
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setVisaAllt(false)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${!visaAllt ? "bg-gray-900 text-white" : "border border-gray-200 bg-white text-gray-600"}`}>
              Bara det som är kvar
            </button>
            <button onClick={() => setVisaAllt(true)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${visaAllt ? "bg-gray-900 text-white" : "border border-gray-200 bg-white text-gray-600"}`}>
              Visa allt
            </button>
            {!guidatSteg && kvarLista.length > 0 && (
              <button onClick={() => setGuidad(kvarLista[0].id)}
                className="ml-auto inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700">
                <Play className="h-4 w-4" /> Guida mig
              </button>
            )}
          </div>

          {/* Stegen per kategori. Uppskjutna hamnar sist men försvinner aldrig. */}
          {ORDNING.map((kat) => {
            const alla = data.steg.filter((s) => s.kategori === kat);
            const synliga = visaAllt ? alla : alla.filter((s) => s.status !== "klar");
            if (synliga.length === 0) return null;
            const klaraHar = alla.filter((s) => s.status === "klar" && !s.delvis).length;
            const stangd = stangdaGrupper[kat];
            return (
              <section key={kat} className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
                <button onClick={() => setStangdaGrupper({ ...stangdaGrupper, [kat]: !stangd })}
                  className="flex w-full items-center gap-2 border-b border-gray-100 px-5 py-3.5 text-left hover:bg-gray-50">
                  {stangd ? <ChevronRight className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                  <h2 className="font-display text-lg font-semibold text-gray-900">{KATEGORINAMN[kat]}</h2>
                  <span className="text-sm text-gray-500">{klaraHar} av {alla.length} klara</span>
                  {kat === "mysales" && data.sammanfattning.mysalesKlart && (
                    <span className="ml-auto rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                      MySales är i ordning
                    </span>
                  )}
                </button>
                {!stangd && (
                  <ul className="divide-y divide-gray-50">
                    {[...synliga].sort((a, b) => Number(a.status === "skjutet") - Number(b.status === "skjutet") || a.sortering - b.sortering)
                      .map((s) => (
                        <StegRad key={s.id} s={s} oppen={!!oppna[s.id]} sparar={sparar === s.id}
                          onVaxla={() => setOppna({ ...oppna, [s.id]: !oppna[s.id] })}
                          onStatus={(st) => sattStatus(s.id, st)}
                          onSkjut={() => setSkjuter({ id: s.id, anteckning: s.anteckning || "" })}
                          onGuida={() => setGuidad(s.id)}
                          onTaBort={async () => {
                            setSparar(s.id);
                            const r = await fetch(`/api/hq/uppstart?id=${s.id}`, { method: "DELETE" });
                            const j = await r.json();
                            if (!r.ok) setFel(j.error || "Kunde inte ta bort steget");
                            setSparar(null);
                            await hamta();
                          }} />
                      ))}
                  </ul>
                )}
              </section>
            );
          })}

          {/* Egna steg */}
          <div className="rounded-2xl border border-gray-100 bg-white px-5 py-4">
            {nyttSteg ? (
              <div className="space-y-3">
                <h3 className="font-display text-lg font-semibold text-gray-900">Lägg till ett eget steg</h3>
                <input value={nyttSteg.titel} onChange={(e) => setNyttSteg({ ...nyttSteg, titel: e.target.value })}
                  placeholder="Vad ska göras?" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                <input value={nyttSteg.varfor} onChange={(e) => setNyttSteg({ ...nyttSteg, varfor: e.target.value })}
                  placeholder="Varför? Vad slutar fungera utan det?" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                <div className="flex flex-wrap items-center gap-2">
                  <select value={nyttSteg.kategori} onChange={(e) => setNyttSteg({ ...nyttSteg, kategori: e.target.value })}
                    className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm">
                    {ORDNING.map((k) => <option key={k} value={k}>{KATEGORINAMN[k]}</option>)}
                  </select>
                  <input type="number" min={1} value={nyttSteg.tid} onChange={(e) => setNyttSteg({ ...nyttSteg, tid: e.target.value })}
                    placeholder="minuter" className="w-24 rounded-lg border border-gray-200 px-2 py-1.5 text-sm tabular-nums" />
                  <input type="number" value={nyttSteg.sortering} onChange={(e) => setNyttSteg({ ...nyttSteg, sortering: e.target.value })}
                    placeholder="ordning" className="w-24 rounded-lg border border-gray-200 px-2 py-1.5 text-sm tabular-nums" />
                  <button disabled={!nyttSteg.titel.trim()}
                    onClick={async () => {
                      const r = await fetch("/api/hq/uppstart", {
                        method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          titel: nyttSteg.titel, varfor: nyttSteg.varfor, kategori: nyttSteg.kategori,
                          uppskattad_tid_min: Number(nyttSteg.tid) || 10, sortering: Number(nyttSteg.sortering) || 500,
                        }),
                      });
                      const j = await r.json();
                      if (!r.ok) setFel(j.error || "Kunde inte lägga till steget");
                      setNyttSteg(null);
                      await hamta();
                    }}
                    className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40">Lägg till</button>
                  <button onClick={() => setNyttSteg(null)} className="text-sm text-gray-500 underline">Avbryt</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setNyttSteg({ titel: "", varfor: "", kategori: "cockpit", tid: "10", sortering: "500" })}
                className="text-sm font-medium text-gray-700 underline">Lägg till ett eget steg</button>
            )}
          </div>

          <p className="pb-2 text-center text-xs text-gray-400">
            <a href="/dashboard/hq" className="font-medium text-gray-500 underline">Tillbaka till Founder HQ</a>
          </p>
        </>
      )}

      {/* Skjut upp */}
      {skjuter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSkjuter(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg font-semibold text-gray-900">Skjut upp steget</h3>
            <p className="mt-1 text-sm text-gray-600">Det hamnar längst ner i sin kategori men försvinner aldrig.</p>
            <input autoFocus value={skjuter.anteckning} onChange={(e) => setSkjuter({ ...skjuter, anteckning: e.target.value })}
              placeholder="Anteckning, valfri" className="mt-4 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
            <div className="mt-5 flex items-center gap-2">
              <button disabled={sparar === skjuter.id}
                onClick={async () => {
                  const ok = await sattStatus(skjuter.id, "skjutet", skjuter.anteckning);
                  if (ok) { setSkjuter(null); if (guidad === skjuter.id) setGuidad(null); }
                }}
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Skjut upp</button>
              <button onClick={() => setSkjuter(null)} className="text-sm text-gray-500 underline">Avbryt</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Kontrollens resultat, alltid med sin egen siffra. Grönt bara när mätningen säger ja. */
function KontrollRad({ k }: { k: Kontroll }) {
  return (
    <div className={`mt-3 flex items-start gap-2 rounded-xl px-4 py-2.5 text-sm ${
      k.uppfyllt ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>
      {k.uppfyllt ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0" />}
      <span>{k.resultat_text || "Kontrollen har inte körts än."}</span>
    </div>
  );
}

function StegRad({ s, oppen, sparar, onVaxla, onStatus, onSkjut, onGuida, onTaBort }: {
  s: Steg; oppen: boolean; sparar: boolean;
  onVaxla: () => void; onStatus: (st: Steg["status"]) => void;
  onSkjut: () => void; onGuida: () => void; onTaBort: () => void;
}) {
  const klar = s.status === "klar" && !s.delvis;
  return (
    <li className={s.status === "skjutet" ? "bg-gray-50/60" : ""}>
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1 px-5 py-3">
        <button onClick={onVaxla} className="mt-0.5 shrink-0 text-gray-400 hover:text-gray-700" aria-label="Visa hur">
          {oppen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        {klar ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          : s.status === "pagar" ? <Loader2 className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
          : s.status === "skjutet" ? <PauseCircle className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
          : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-gray-300" />}

        <div className="min-w-0 flex-1">
          <button onClick={onVaxla} className="text-left">
            <span className={`text-sm font-medium ${klar ? "text-gray-400 line-through" : "text-gray-900"}`}>{s.titel}</span>
          </button>
          <p className="text-xs text-gray-500">{s.varfor}</p>
          {s.delvis && (
            <p className="mt-1 text-xs font-medium text-amber-600">
              Markerat som klart, men mätningen säger att något återstår. Se siffran nedan.
            </p>
          )}
          {s.anteckning && <p className="mt-1 text-xs italic text-gray-500">{s.anteckning}</p>}
          {s.kontroll && <KontrollRad k={s.kontroll} />}
          {oppen && s.hur && (
            <div className="mt-3 rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-700">
              <ReactMarkdown components={MD}>{s.hur}</ReactMarkdown>
            </div>
          )}
        </div>

        <span className="shrink-0 text-xs tabular-nums text-gray-400">{tidText(s.uppskattad_tid_min)}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2 px-5 pb-3 pl-12 text-xs">
        {!klar && (
          <>
            <button onClick={() => onStatus("klar")} disabled={sparar}
              className="rounded-lg bg-emerald-600 px-2.5 py-1 font-medium text-white hover:bg-emerald-700 disabled:opacity-50">Klar</button>
            {s.status !== "pagar" && (
              <button onClick={() => onStatus("pagar")} disabled={sparar}
                className="rounded-lg border border-gray-200 px-2.5 py-1 font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">Pågår</button>
            )}
            {s.status !== "skjutet" && (
              <button onClick={onSkjut} disabled={sparar}
                className="rounded-lg border border-gray-200 px-2.5 py-1 font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">Skjut upp</button>
            )}
            <button onClick={onGuida} className="inline-flex items-center gap-1 font-medium text-indigo-600 underline">
              <Play className="h-3 w-3" /> Guida mig genom det
            </button>
          </>
        )}
        {klar && (
          <button onClick={() => onStatus("att_gora")} disabled={sparar}
            className="rounded-lg border border-gray-200 px-2.5 py-1 font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">Ångra</button>
        )}
        {s.blockerar.length > 0 && !klar && (
          <span className="text-gray-400">väntar på detta: {s.blockerar.join(", ")}</span>
        )}
        {s.egen && (
          <button onClick={onTaBort} disabled={sparar} aria-label="Ta bort eget steg"
            className="ml-auto text-gray-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
        )}
      </div>
    </li>
  );
}
