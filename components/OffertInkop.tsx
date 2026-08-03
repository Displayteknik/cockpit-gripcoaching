"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Database, Loader2, Upload, AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Ban, FileSpreadsheet, X } from "lucide-react";

// OFFERT-2 / O-1c — inköpsdatabasen i katalogvyn. Skrivskyddad läsning av den aktiva prisboken
// plus import av en ny version.
//
// Regeln som styr hela vyn: ett fraktsätt utan offererat pris visas som saknat, aldrig som 0 och
// aldrig som ett streck bland siffrorna. Det ska gå att se skillnad på "gratis" och "vet inte"
// utan att öppna kalkylbladet.

interface Fraktsatt {
  fraktsatt: string;
  etikett: string;
  frakt_styck: number;
}
interface Trappa {
  trappa_id: string;
  antal: number;
  exw_styck: number;
  fraktsatt: Fraktsatt[];
  lagsta_landat: number | null;
}
interface Produkt {
  produktnyckel: string;
  leverantor: string;
  modellnr: string | null;
  produktnamn: string;
  storlek: string | null;
  ljusstyrka: string | null;
  miljo: string | null;
  ledtid: string | null;
  garanti: string | null;
  trappor: Trappa[];
  harNagonFrakt: boolean;
}
interface Prisbok {
  id: string;
  kallfil: string;
  importerad_at: string;
  radantal: { produkter?: number; trappor?: number; fraktceller?: number; tomma_fraktceller?: number; prislistedata?: number } | null;
}
interface Forhandsgranskning {
  kallfil: string;
  radantal: { produkter: number; trappor: number; fraktceller: number; tomma_fraktceller: number; prislistedata: number };
  varningar: string[];
  produkter: { produktnyckel: string; produktnamn: string; trappor: number[]; fraktsatt: string[] }[];
  redanImporterad: { importerad_at: string; aktiv: boolean } | null;
}

const ALLA_FRAKTSATT = ["Båt", "Tåg", "Lastbil", "Flyg", "DHL", "Fedex"];

function usd(n: number) {
  return n.toLocaleString("sv-SE") + " USD";
}
function datum(s?: string) {
  return s ? new Date(s).toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" }) : "";
}
// Ljusstyrkan är ett fritextfält — den kan stå som "5500 i rubriken, 3500 i specifikationen".
// Enheten läggs bara på ett rent tal, annars blir texten "…i specifikationen nits".
function ljus(v: string | null) {
  if (!v) return null;
  return /^\d+$/.test(v.trim()) ? `${v} nits` : v;
}

export default function OffertInkop({ primaryColor = "#1A6B3C" }: { primaryColor?: string }) {
  const [prisbok, setPrisbok] = useState<Prisbok | null>(null);
  const [produkter, setProdukter] = useState<Produkt[]>([]);
  const [delade, setDelade] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [oppen, setOppen] = useState<string | null>(null);
  const [sok, setSok] = useState("");
  const [fel, setFel] = useState<string | null>(null);
  const [laser, setLaser] = useState(false);
  const [sparar, setSparar] = useState(false);
  const [forhand, setForhand] = useState<Forhandsgranskning | null>(null);
  const [vald, setVald] = useState<File | null>(null);
  const [klart, setKlart] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const ladda = useCallback(() => {
    setLoading(true);
    fetch("/api/offert/inkop/produkter")
      .then((r) => r.json())
      .then((d) => {
        setPrisbok(d.prisbok || null);
        setProdukter(d.produkter || []);
        setDelade(d.delade || {});
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => ladda(), [ladda]);

  // Steg 1: tolka filen utan att spara. Man ska se vad som händer innan det händer.
  const granska = async (file: File) => {
    setLaser(true);
    setFel(null);
    setKlart(null);
    setForhand(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("torrkor", "1");
      const r = await fetch("/api/offert/inkop/import", { method: "POST", body: fd });
      const d = await r.json();
      if (r.status === 401 || r.status === 403) setFel("Bara byråadmin kan importera inköpsdatabasen.");
      else if (!d.ok) setFel(d.error || "Kunde inte läsa filen");
      else {
        setForhand(d);
        setVald(file);
      }
    } catch {
      setFel("Kunde inte läsa filen");
    } finally {
      setLaser(false);
    }
  };

  // Steg 2: spara som ny prisbok.
  const spara = async () => {
    if (!vald || sparar) return;
    setSparar(true);
    setFel(null);
    try {
      const fd = new FormData();
      fd.append("file", vald);
      const r = await fetch("/api/offert/inkop/import", { method: "POST", body: fd });
      const d = await r.json();
      if (!d.ok) setFel(d.error || "Kunde inte spara prisboken");
      else {
        setKlart(
          d.oforandrad
            ? d.note
            : `Ny prisbok sparad: ${d.radantal.produkter} produkter, ${d.radantal.trappor} kvantitetstrappor, ${d.radantal.fraktceller} offererade fraktpriser.` +
                (d.ersatte ? ` Ersatte versionen från ${datum(d.ersatte.importerad_at)} (den ligger kvar).` : ""),
        );
        setForhand(null);
        setVald(null);
        ladda();
      }
    } catch {
      setFel("Kunde inte spara prisboken");
    } finally {
      setSparar(false);
    }
  };

  const filtrerade = produkter.filter((p) => {
    if (!sok.trim()) return true;
    const hö = [p.produktnamn, p.produktnyckel, p.modellnr, p.storlek, p.ljusstyrka, p.miljo].filter(Boolean).join(" ").toLowerCase();
    return sok.toLowerCase().split(/\s+/).every((o) => hö.includes(o));
  });

  const utanFrakt = produkter.filter((p) => !p.harNagonFrakt).length;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5" style={{ color: primaryColor }} />
          <h2 className="font-display font-bold text-gray-900 text-lg">Inköpsdatabas</h2>
          {prisbok && <span className="text-xs text-gray-400">({produkter.length} produkter)</span>}
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={laser || sparar}
          className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {laser ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {prisbok ? "Uppdatera från Excel" : "Importera produktdatabas"}
        </button>
      </div>

      {fel && <div className="text-xs text-red-600">{fel}</div>}
      {klart && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-emerald-800">{klart}</div>
        </div>
      )}

      {/* Bekräftelseskärm före sparning */}
      {forhand && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" style={{ color: primaryColor }} />
              <div>
                <div className="font-semibold text-gray-900 text-sm">{forhand.kallfil}</div>
                <div className="text-xs text-gray-500">Det här läses in. Inget är sparat än.</div>
              </div>
            </div>
            <button onClick={() => { setForhand(null); setVald(null); }} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-4 h-4" /></button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Ruta etikett="Produkter" varde={forhand.radantal.produkter} />
            <Ruta etikett="Kvantitetstrappor" varde={forhand.radantal.trappor} />
            <Ruta etikett="Offererade fraktpriser" varde={forhand.radantal.fraktceller} />
            <Ruta etikett="Saknade fraktpriser" varde={forhand.radantal.tomma_fraktceller} dampad />
          </div>

          {forhand.redanImporterad && (
            <div className="text-xs text-gray-600 bg-gray-50 rounded-xl px-3 py-2">
              Filen är identisk med versionen som importerades {datum(forhand.redanImporterad.importerad_at)}. Sparar du igen skapas ingen dubblett.
            </div>
          )}

          {forhand.varningar.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
                <AlertTriangle className="w-3.5 h-3.5" /> Att känna till ({forhand.varningar.length})
              </div>
              {forhand.varningar.map((v, i) => (
                <div key={i} className="text-xs text-amber-700 pl-5">• {v}</div>
              ))}
            </div>
          )}

          <div className="max-h-56 overflow-y-auto rounded-xl border border-gray-100 divide-y divide-gray-50">
            {forhand.produkter.map((p) => (
              <div key={p.produktnyckel} className="px-3 py-2 flex items-center justify-between gap-3 text-xs">
                <span className="text-gray-800 truncate">{p.produktnamn}</span>
                <span className="text-gray-400 flex-shrink-0">
                  {p.trappor.join("/")} st · {p.fraktsatt.length ? `${p.fraktsatt.length} fraktsätt` : "ingen frakt"}
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-end gap-2">
            <button onClick={() => { setForhand(null); setVald(null); }} className="text-sm font-semibold px-4 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50">Avbryt</button>
            <button
              onClick={spara}
              disabled={sparar}
              className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg text-white disabled:opacity-40"
              style={{ background: primaryColor }}
            >
              {sparar ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Spara som ny prisbok
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500 py-6"><Loader2 className="w-4 h-4 animate-spin" /> Laddar…</div>
      ) : !prisbok ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center shadow-sm">
          <span className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: `${primaryColor}14` }}>
            <Database className="w-6 h-6" style={{ color: primaryColor }} />
          </span>
          <div className="font-semibold text-gray-900">Ingen inköpsdatabas importerad</div>
          <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
            Ladda upp <span className="font-medium">produktdatabas.xlsx</span> så kan offertbyggaren räkna landad kostnad per styck och för hela ordern, med källhänvisning till raden i filen.
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm flex items-center justify-between gap-3 flex-wrap">
            <div className="text-xs text-gray-500">
              <span className="font-medium text-gray-700">{prisbok.kallfil}</span> · importerad {datum(prisbok.importerad_at)}
              {prisbok.radantal?.fraktceller != null && prisbok.radantal?.tomma_fraktceller != null && (
                <> · {prisbok.radantal.fraktceller} offererade fraktpriser, {prisbok.radantal.tomma_fraktceller} saknas</>
              )}
            </div>
            <input value={sok} onChange={(e) => setSok(e.target.value)} placeholder="Sök storlek, ljusstyrka, miljö…" className="text-sm rounded-lg border border-gray-200 px-3 py-1.5 focus:border-gray-400 focus:ring-2 focus:ring-gray-100" />
          </div>

          {utanFrakt > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-amber-800">
                {utanFrakt} produkter saknar offererat fraktpris helt och går därför inte att prissätta. För 65 och 86 tum utomhus anger prislistan bara en gemensam fraktsumma för båda skärmarna — be leverantören om fraktpris per modell.
              </div>
            </div>
          )}

          {Object.keys(delade).length > 0 && (
            <div className="text-xs text-gray-500">
              Modellnummer som delas av flera produkter: {Object.entries(delade).map(([m, n]) => `${m} (${n.length} st)`).join(", ")}. Uppslag sker därför alltid på produktnyckel.
            </div>
          )}

          <div className="space-y-2">
            {filtrerade.map((p) => {
              const upp = oppen === p.produktnyckel;
              return (
                <div key={p.produktnyckel} className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                  <button onClick={() => setOppen(upp ? null : p.produktnyckel)} className="w-full text-left p-4 flex items-center justify-between gap-4 hover:bg-gray-50/60">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {upp ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                        <span className="font-semibold text-gray-900 text-sm truncate">{p.produktnamn}</span>
                        {!p.harNagonFrakt && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold bg-amber-100 text-amber-800 rounded-full px-2 py-0.5">
                            <Ban className="w-3 h-3" /> fraktpris saknas
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-x-3 gap-y-0.5 flex-wrap text-xs text-gray-500 mt-1 pl-6">
                        {p.storlek && <span>{p.storlek}</span>}
                        {ljus(p.ljusstyrka) && <span>{ljus(p.ljusstyrka)}</span>}
                        {p.miljo && <span>{p.miljo}</span>}
                        <span className="text-gray-400">{p.produktnyckel}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs text-gray-400">från</div>
                      <div className="font-bold text-gray-900 tabular-nums text-sm">
                        {p.trappor.some((t) => t.lagsta_landat !== null)
                          ? usd(Math.min(...p.trappor.filter((t) => t.lagsta_landat !== null).map((t) => t.lagsta_landat as number)))
                          : "—"}
                      </div>
                    </div>
                  </button>

                  {upp && (
                    <div className="border-t border-gray-100 px-4 py-3 space-y-3 bg-gray-50/40">
                      {p.trappor.map((t) => {
                        const har = new Map(t.fraktsatt.map((f) => [f.etikett, f]));
                        return (
                          <div key={t.trappa_id} className="space-y-1.5">
                            <div className="text-xs font-semibold text-gray-700">
                              {t.antal} st · EXW {usd(t.exw_styck)}/st
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {ALLA_FRAKTSATT.map((namn) => {
                                const f = har.get(namn);
                                if (!f) {
                                  return (
                                    <span key={namn} className="text-xs rounded-lg px-2 py-1 bg-white border border-dashed border-gray-200 text-gray-400" title="Leverantören har inte offererat det här fraktsättet — priset är okänt.">
                                      {namn}: saknas
                                    </span>
                                  );
                                }
                                const landat = t.exw_styck + f.frakt_styck;
                                const billigast = t.lagsta_landat === landat;
                                return (
                                  <span
                                    key={namn}
                                    className={`text-xs rounded-lg px-2 py-1 border tabular-nums ${billigast ? "bg-white font-semibold text-gray-900" : "bg-white border-gray-200 text-gray-600"}`}
                                    style={billigast ? { borderColor: primaryColor, color: primaryColor } : undefined}
                                    title={`Frakt ${f.frakt_styck} USD/st + EXW ${t.exw_styck} USD/st`}
                                  >
                                    {namn}: {landat.toLocaleString("sv-SE")} /st · {(landat * t.antal).toLocaleString("sv-SE")} totalt
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                      <div className="text-xs text-gray-400 pt-1">
                        Alla belopp i USD, EXW Shenzhen. Svenskt pris kräver växelkurs och påslagsregel — de sätts i nästa steg.
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) granska(f); e.target.value = ""; }} />
    </section>
  );
}

function Ruta({ etikett, varde, dampad }: { etikett: string; varde: number; dampad?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${dampad ? "border-amber-200 bg-amber-50" : "border-gray-100 bg-white"}`}>
      <div className={`text-xs ${dampad ? "text-amber-700" : "text-gray-500"}`}>{etikett}</div>
      <div className={`text-lg font-bold tabular-nums ${dampad ? "text-amber-900" : "text-gray-900"}`}>{varde}</div>
    </div>
  );
}
