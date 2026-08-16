"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Tag, AlertTriangle, RefreshCw, Globe, Lock, Link2, Search, ShieldAlert,
  CheckCircle2, ExternalLink, Layers, FileText, Package, Upload, Calculator, Sparkles,
} from "lucide-react";
import Link from "next/link";
import { DashHero, HeroChip, LivePill, StatTile } from "@/components/ui/dash";

// PRIS-1 granskningsvy. Läser säljlagret som byggdes i MySales Coach och visar
// vad som saknas innan något går skarpt. Ingen knapp här ändrar ett pris:
// beslut, kalkyl och agent bor i MySales Coach, den här sidan är en spegel.

interface Volym { min_antal: number; pris: number; synlighet: string }
interface Koppling { kalla: string; nyckel: string; bekraftad: boolean; notering: string | null }
interface Marknadsrad { competitor: string; price_sek: number | null; source_url: string | null; fetched_at: string; notering: string | null }
interface Flagga { typ: string; allvar: string; text: string; skapad_at: string }
interface Prisrad {
  artikelnr: string; benamning: string; kategori: string; prismodell: string;
  pris: number | null; enhet: string; fran_pris: boolean; synlighet: string;
  version: number; giltig_fran: string; motivering: string; noteringar: string | null;
  tb_pct: number | null; kalla: string; beslut_av: string;
  volymtrappa: Volym[]; kopplingar: Koppling[]; marknad: Marknadsrad[]; flaggor: Flagga[];
}
interface Text { id: string; typ: string; text: string; synlighet: string }
interface Lucka { allvar: "hog" | "medel" | "info"; omrade: string; text: string }
interface Artikel {
  id: string; artikelnummer: string; namn: string; kategori: string;
  tum: number | null; ljusstyrka_nits: number | null; ip_klass: string | null;
  miljo: string | null; montering: string | null; status: string;
  kopplatSaljpris: string | null;
  leverantorskopplingar: { produktnyckel: string; bekraftad: boolean }[];
  datablad: { titel: string; file_path: string }[];
  tillval: string[];
}
interface Svar {
  byggt: boolean; fel?: string; hamtad: string;
  priser: Prisrad[]; texter: Text[];
  golv: { kategori: string; golv_pct: number }[];
  konkurrenter: { namn: string; webb: string | null; typ: string; aktiv: boolean }[];
  sajt: { url: string; status: number | null; saknasPaSidan: string[]; utanTackning: number[] } | null;
  luckor: Lucka[];
  artiklar: Artikel[];
}

const kr = (n: number | null, enhet = "kr") =>
  n == null ? "—" : `${Math.round(n).toLocaleString("sv-SE")} ${enhet}`;

const ALLVAR: Record<string, { ring: string; bg: string; text: string; etikett: string }> = {
  hog: { ring: "ring-rose-100", bg: "bg-rose-50", text: "text-rose-700", etikett: "Måste åtgärdas" },
  medel: { ring: "ring-amber-100", bg: "bg-amber-50", text: "text-amber-700", etikett: "Bör åtgärdas" },
  info: { ring: "ring-sky-100", bg: "bg-sky-50", text: "text-sky-700", etikett: "Att veta om" },
};

function Synlighet({ v }: { v: string }) {
  const publik = v === "publik";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${publik
      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
      : "bg-amber-50 text-amber-700 ring-1 ring-amber-100"}`}>
      {publik ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
      {publik ? "Publik" : "Endast offert"}
    </span>
  );
}

export default function PrislistanGranskning() {
  const [data, setData] = useState<Svar | null>(null);
  const [laddar, setLaddar] = useState(true);
  const [fel, setFel] = useState<string | null>(null);

  const ladda = useCallback(async () => {
    setLaddar(true);
    setFel(null);
    try {
      const r = await fetch("/api/prislistan/granska", { cache: "no-store" });
      if (r.status === 401) { setFel("Du är inte inloggad som admin."); return; }
      const d: Svar = await r.json();
      if (!d.byggt) { setFel(d.fel || "Säljlagret är inte byggt i den här databasen."); return; }
      setData(d);
    } catch (e) {
      setFel(String(e));
    } finally {
      setLaddar(false);
    }
  }, []);

  useEffect(() => { ladda(); }, [ladda]);

  const priser = data?.priser || [];
  const luckor = data?.luckor || [];
  const publika = priser.filter(p => p.synlighet === "publik").length;
  const hoga = luckor.filter(l => l.allvar === "hog").length;
  const utanKoppling = priser.filter(p => p.kopplingar.length === 0).length;

  return (
    <div className="space-y-8">
      <DashHero
        title="Prislistan"
        subtitle="Säljlagret som Prislisteagenten bygger i MySales Coach. Här ser du läget och vad som saknas. Priser ändras inte härifrån."
        icon={Tag}
        accent="#6366f1"
        eyebrow={<LivePill label={laddar ? "läser" : "läst"} />}
        chips={data ? (
          <>
            <HeroChip icon={Layers} label={`${priser.length} artiklar`} />
            <HeroChip icon={Globe} label={`${publika} publika`} />
            <HeroChip icon={ShieldAlert} label={`${hoga} måste åtgärdas`} />
          </>
        ) : undefined}
        right={
          <button
            onClick={ladda}
            disabled={laddar}
            className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-white/15 backdrop-blur transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <RefreshCw className={`h-4 w-4 ${laddar ? "animate-spin" : ""}`} /> Läs om
          </button>
        }
      />

      {/* Verktygen — de tre sakerna man faktiskt GÖR här, resten av sidan är granskning */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/dashboard/prislistan/uppladdning" className="group flex items-start gap-3 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50">
            <Upload className="h-5 w-5 text-blue-600" />
          </span>
          <div>
            <div className="font-display font-bold text-gray-900">Läs in prislista</div>
            <p className="mt-0.5 text-sm text-gray-500">PDF, Excel eller en skärmdump. Visar vad som ändras innan något sparas.</p>
          </div>
        </Link>
        <Link href="/dashboard/prislistan/kalkylator" className="group flex items-start gap-3 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
            <Calculator className="h-5 w-5 text-emerald-600" />
          </span>
          <div>
            <div className="font-display font-bold text-gray-900">Kabinettkalkylatorn</div>
            <p className="mt-0.5 text-sm text-gray-500">Mata in en LED-väggs mått, få kolumner, pixlar och pris på sekunden.</p>
          </div>
        </Link>
        <Link href="/dashboard/prislistan/priscoach" className="group flex items-start gap-3 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50">
            <Sparkles className="h-5 w-5 text-violet-600" />
          </span>
          <div>
            <div className="font-display font-bold text-gray-900">Priscoachen</div>
            <p className="mt-0.5 text-sm text-gray-500">Läser läget, spanar marknaden, föreslår ett pris. Du beslutar.</p>
          </div>
        </Link>
      </div>

      {fel && (
        <div className="flex items-start gap-3 rounded-2xl border border-rose-100 bg-rose-50 p-5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-100">
            <AlertTriangle className="h-[18px] w-[18px] text-rose-600" />
          </span>
          <div>
            <div className="font-display font-bold text-gray-900">Kunde inte visa säljlagret</div>
            <p className="mt-1 text-sm text-gray-600">{fel}</p>
          </div>
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatTile label="Artiklar i säljlagret" value={priser.length} icon={Layers} tone="violet" i={0} />
            <StatTile label="Publika priser" value={publika} sub="syns på sajt och i chatt" icon={Globe} tone="emerald" i={1} />
            <StatTile label="Saknar inköpsdata" value={utanKoppling} sub="marginalen är okänd" icon={Link2} tone="amber" i={2} />
            <StatTile label="Måste åtgärdas" value={hoga} sub={`${luckor.length} punkter totalt`} icon={ShieldAlert} tone="blue" i={3} />
          </div>

          {/* Vad som saknas */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-gray-900">Vad som saknas</h2>
              <span className="text-xs text-gray-500">
                Läst {new Date(data.hamtad).toLocaleString("sv-SE")}
              </span>
            </div>
            {luckor.length === 0 ? (
              <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
                <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
                <p className="mt-3 text-sm text-gray-600">Inget saknas. Säljlagret, sajten och kunskapsbasen säger samma sak.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {luckor.map((l, i) => {
                  const a = ALLVAR[l.allvar];
                  return (
                    <div key={i} className={`flex items-start gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm`}>
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${a.bg} ring-1 ${a.ring}`}>
                        <AlertTriangle className={`h-[18px] w-[18px] ${a.text}`} />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${a.bg} ${a.text}`}>{a.etikett}</span>
                          <span className="text-xs font-medium uppercase tracking-wide text-gray-400">{l.omrade}</span>
                        </div>
                        <p className="mt-1.5 text-sm text-gray-700">{l.text}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Artikellagret (PRIS2-1) — kort summering, full tabell på egen sida */}
          {data.artiklar && data.artiklar.length > 0 && (
            <Link href="/dashboard/prislistan/produkter" className="group flex items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50">
                  <Package className="h-5 w-5 text-indigo-600" />
                </span>
                <div>
                  <div className="font-display font-bold text-gray-900">Artikellagret</div>
                  <p className="text-sm text-gray-500">
                    {data.artiklar.length} artiklar · {data.artiklar.filter((a) => a.kopplatSaljpris).length} har säljpris ·{" "}
                    {data.artiklar.filter((a) => a.leverantorskopplingar.some((k) => k.bekraftad)).length} bekräftad inköpskoppling
                  </p>
                </div>
              </div>
              <span className="text-sm font-medium text-indigo-600">Öppna tabellen →</span>
            </Link>
          )}

          {/* Priserna */}
          <section className="space-y-3">
            <h2 className="font-display text-lg font-bold text-gray-900">Godkända säljpriser</h2>
            <div className="space-y-3">
              {priser.map(p => (
                <div key={p.artikelnr} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display font-bold text-gray-900">{p.benamning}</span>
                        <span className="font-mono text-xs text-gray-400">{p.artikelnr}</span>
                        <Synlighet v={p.synlighet} />
                        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">v{p.version}</span>
                      </div>
                      <p className="mt-1.5 max-w-2xl text-sm text-gray-600">{p.motivering}</p>
                      {p.noteringar && <p className="mt-1 text-xs text-gray-500">{p.noteringar}</p>}
                    </div>
                    <div className="text-right">
                      <div className="font-display text-2xl font-bold tabular-nums text-gray-900">
                        {p.prismodell === "offert"
                          ? <span className="text-base text-amber-600">Begär offert</span>
                          : <>{p.fran_pris && <span className="mr-1 text-sm font-medium text-gray-400">från</span>}{kr(p.pris, p.enhet)}</>}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        {p.tb_pct != null ? `Täckningsbidrag ${p.tb_pct} procent vid beslutet` : "Aldrig prövat mot en kalkyl"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 border-t border-gray-100 pt-4 md:grid-cols-3">
                    <div>
                      <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-gray-400">Volymtrappa</div>
                      {p.volymtrappa.length ? p.volymtrappa.map((v, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-gray-700">
                          Från {v.min_antal} st: <span className="tabular-nums">{kr(v.pris)}</span>
                          <Synlighet v={v.synlighet} />
                        </div>
                      )) : <div className="text-sm text-gray-400">Ingen satt.</div>}
                    </div>
                    <div>
                      <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-gray-400">Koppling till inköp</div>
                      {p.kopplingar.length ? p.kopplingar.map((k, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-gray-700">
                          <Link2 className="h-3.5 w-3.5 text-gray-400" />
                          <span className="font-mono text-xs">{k.nyckel}</span>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${k.bekraftad
                            ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                            {k.bekraftad ? "bekräftad" : "obekräftad"}
                          </span>
                        </div>
                      )) : <div className="text-sm text-gray-400">Ingen. Kalkylen kan inte köras.</div>}
                    </div>
                    <div>
                      <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-gray-400">Marknadsbild</div>
                      {p.marknad.length ? p.marknad.map((m, i) => (
                        <div key={i} className="text-sm text-gray-700">
                          {m.competitor}: {m.price_sek != null ? (
                            <>
                              <span className="tabular-nums">{kr(m.price_sek)}</span>
                              {m.source_url && (
                                <a href={m.source_url} target="_blank" rel="noreferrer" className="ml-1.5 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline">
                                  källa <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                            </>
                          ) : <span className="text-gray-400">ej funnet</span>}
                        </div>
                      )) : <div className="text-sm text-gray-400">Ingen sökning gjord.</div>}
                    </div>
                  </div>

                  {p.flaggor.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {p.flaggor.map((f, i) => (
                        <div key={i} className="rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-800 ring-1 ring-amber-100">{f.text}</div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Sidan, golv, konkurrenter, villkor */}
          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50">
                  <Search className="h-[18px] w-[18px] text-indigo-600" />
                </span>
                <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Prissidan</span>
              </div>
              {data.sajt ? (
                <div className="space-y-1.5 text-sm text-gray-700">
                  <div>
                    <a href={data.sajt.url} target="_blank" rel="noreferrer" className="font-medium text-indigo-600 hover:underline">{data.sajt.url}</a>
                    <span className="ml-2 text-xs text-gray-400">svarade {data.sajt.status ?? "inte alls"}</span>
                  </div>
                  <div>Priser som saknas på sidan: <span className="tabular-nums font-medium">{data.sajt.saknasPaSidan.length}</span></div>
                  <div>Belopp på sidan utan täckning: <span className="tabular-nums font-medium">{data.sajt.utanTackning.length}</span>
                    {data.sajt.utanTackning.length > 0 && (
                      <span className="ml-1.5 text-xs text-gray-500">{data.sajt.utanTackning.map(t => t.toLocaleString("sv-SE")).join(", ")} kr</span>
                    )}
                  </div>
                </div>
              ) : <div className="text-sm text-gray-400">Kontrollen kördes inte.</div>}
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50">
                  <ShieldAlert className="h-[18px] w-[18px] text-violet-600" />
                </span>
                <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Marginalgolv och bevakning</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {data.golv.map(g => (
                  <span key={g.kategori} className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                    {g.kategori} <span className="tabular-nums">{g.golv_pct} %</span>
                  </span>
                ))}
              </div>
              <div className="mt-3 text-sm text-gray-600">
                Bevakade konkurrenter: {data.konkurrenter.filter(k => k.aktiv).map(k => k.namn).join(", ") || "inga"}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm md:col-span-2">
              <div className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500">Ingår, villkor och regler</div>
              <div className="grid gap-2 md:grid-cols-2">
                {data.texter.map(t => (
                  <div key={t.id} className="flex items-start gap-2 text-sm text-gray-700">
                    <Synlighet v={t.synlighet} />
                    <span>{t.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
