"use client";

import { useEffect, useState, use as usePromise } from "react";
import Link from "next/link";
import {
  Package, ArrowLeft, Link2, FileText, ExternalLink, Sparkles, Upload, Loader2,
  AlertTriangle, Check, History,
} from "lucide-react";
import { DashHero } from "@/components/ui/dash";

interface Leverantorskoppling { produktnyckel: string; bekraftad: boolean }
interface Datablad { titel: string; file_path: string; url: string | null }
interface Tillval { artikelnr: string; namn: string; pris: number | null; prismodell: string }
interface Artikel {
  artikelnummer: string; namn: string; kategori: string; tum: number | null;
  pixel_pitch: number | null; ljusstyrka_nits: number | null; ip_klass: string | null;
  miljo: string | null; montering: string | null; garanti_ar: number | null; status: string;
  sl_artikelnr: string | null; saljpris: number | null; saljprismodell: string | null;
  saljprisversion: number | null; saljpris_giltig_fran: string | null;
  leverantorskopplingar: Leverantorskoppling[] | null;
  datablad: Datablad[] | null;
  tillval: Tillval[] | null;
}
interface Version {
  version: number; pris: number | null; prismodell: string; gallande: boolean;
  giltig_fran: string; giltig_till: string | null; motivering: string; kalla: string;
  beslut_av: string; tb_pct: number | null;
}
interface KalkylRad {
  produktnyckel: string; bekraftad: boolean; sku: string; qty_tier: number; shipping_way: string;
  unit_price_usd: number; freight_per_unit_usd: number; landat_sek: number; ledtid: string | null;
  tb_kr: number | null; tb_pct: number | null; over_golv: boolean | null;
}

const kr = (n: number | null) => (n == null ? "—" : `${Math.round(n).toLocaleString("sv-SE")} kr`);

export default function ProduktDetalj({ params }: { params: Promise<{ artikelnummer: string }> }) {
  const { artikelnummer } = usePromise(params);
  const [artikel, setArtikel] = useState<Artikel | null>(null);
  const [historik, setHistorik] = useState<Version[]>([]);
  const [kalkyl, setKalkyl] = useState<{ golv_pct: number; rader: KalkylRad[] } | null>(null);
  const [laddar, setLaddar] = useState(true);
  const [fel, setFel] = useState<string | null>(null);

  const [nyttPris, setNyttPris] = useState("");
  const [motivering, setMotivering] = useState("");
  const [sparar, setSparar] = useState(false);
  const [sparatMsg, setSparatMsg] = useState<string | null>(null);
  const [sparaFel, setSparaFel] = useState<string | null>(null);

  async function ladda() {
    setLaddar(true); setFel(null);
    try {
      const [r1, r2] = await Promise.all([
        fetch(`/api/prislistan/produkter/${artikelnummer}`),
        fetch(`/api/prislistan/produkter/${artikelnummer}/kalkyl`),
      ]);
      const d1 = await r1.json();
      if (d1.error) { setFel(d1.error); return; }
      setArtikel(d1.artikel); setHistorik(d1.historik || []);
      if (d1.artikel.saljpris) setNyttPris(String(d1.artikel.saljpris));
      const d2 = await r2.json();
      if (!d2.error) setKalkyl(d2);
    } catch (e) { setFel(String(e)); } finally { setLaddar(false); }
  }

  useEffect(() => { ladda(); }, [artikelnummer]); // eslint-disable-line react-hooks/exhaustive-deps

  async function spara() {
    const pris = Number(nyttPris);
    if (!pris || !motivering.trim()) return;
    setSparar(true); setSparaFel(null); setSparatMsg(null);
    try {
      const r = await fetch("/api/prislistan/coach/godkann", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ artikelnummer, nyttPris: pris, motivering, beslutAv: "Håkan (direkt i produktvyn)" }),
      });
      const d = await r.json();
      if (!r.ok || d.error) { setSparaFel(d.error || `Fel ${r.status}`); return; }
      setSparatMsg(`Sparat som version ${d.ny.version}: ${d.ny.pris} kr.`);
      setMotivering("");
      ladda();
    } catch (e) { setSparaFel(String(e)); } finally { setSparar(false); }
  }

  if (laddar) return <div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Läser…</div>;
  if (fel || !artikel) return <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">{fel || "Hittades inte"}</div>;

  return (
    <div className="space-y-6">
      <DashHero title={artikel.namn} subtitle={`${artikel.artikelnummer} · ${artikel.kategori}`} icon={Package} accent="#4f46e5" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/dashboard/prislistan/produkter" className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" /> Tillbaka till produkter
        </Link>
        <div className="flex gap-2">
          <Link href={`/dashboard/prislistan/priscoach?artikel=${encodeURIComponent(artikel.artikelnummer)}`}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90" style={{ background: "#7c3aed" }}>
            <Sparkles className="h-3.5 w-3.5" /> Coacha priset
          </Link>
          <Link href="/dashboard/prislistan/uppladdning" className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <Upload className="h-3.5 w-3.5" /> Läs in prislista
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Specs */}
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Specifikation</div>
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              {artikel.tum && <div><div className="text-xs text-gray-400">Storlek</div><div className="font-medium text-gray-900">{artikel.tum}″</div></div>}
              {artikel.ljusstyrka_nits && <div><div className="text-xs text-gray-400">Ljusstyrka</div><div className="font-medium text-gray-900">{artikel.ljusstyrka_nits} nits</div></div>}
              {artikel.ip_klass && <div><div className="text-xs text-gray-400">IP-klass</div><div className="font-medium text-gray-900">{artikel.ip_klass}</div></div>}
              {artikel.miljo && <div><div className="text-xs text-gray-400">Miljö</div><div className="font-medium text-gray-900 capitalize">{artikel.miljo}</div></div>}
              {artikel.montering && <div><div className="text-xs text-gray-400">Montering</div><div className="font-medium text-gray-900 capitalize">{artikel.montering}</div></div>}
              {artikel.garanti_ar && <div><div className="text-xs text-gray-400">Garanti</div><div className="font-medium text-gray-900">{artikel.garanti_ar} år</div></div>}
              <div><div className="text-xs text-gray-400">Status</div><div className="font-medium text-gray-900 capitalize">{artikel.status}</div></div>
            </div>
          </div>

          {/* Marginaltabell */}
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Marginal per inköpsväg</div>
            {kalkyl && <p className="mb-3 text-xs text-gray-400">Golv för kategorin: {kalkyl.golv_pct}%. Billigast landat överst.</p>}
            {!kalkyl || kalkyl.rader.length === 0 ? (
              <div className="py-4 text-sm text-gray-400">Ingen inköpsdata kopplad ännu — kan inte räkna landad kostnad.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-gray-400">
                      <th className="py-1.5 text-left">Källa</th>
                      <th className="text-left">Antal</th>
                      <th className="text-left">Fraktsätt</th>
                      <th className="text-left">EXW USD</th>
                      <th className="text-left">Frakt USD</th>
                      <th className="text-left">Landat SEK</th>
                      <th className="text-left">TB</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kalkyl.rader.map((r, i) => (
                      <tr key={i} className="border-t border-gray-50">
                        <td className="py-2 font-mono text-xs text-gray-500">{r.sku}{!r.bekraftad && <span className="ml-1 text-amber-600">obekräftad</span>}</td>
                        <td className="py-2 tabular-nums">{r.qty_tier}</td>
                        <td className="py-2">{r.shipping_way}</td>
                        <td className="py-2 tabular-nums">{r.unit_price_usd}</td>
                        <td className="py-2 tabular-nums">{r.freight_per_unit_usd}</td>
                        <td className="py-2 font-medium tabular-nums text-gray-900">{r.landat_sek.toLocaleString("sv-SE")}</td>
                        <td className="py-2 tabular-nums">
                          {r.tb_pct != null ? (
                            <span className={r.over_golv ? "text-emerald-700" : "text-rose-600 font-medium"}>{r.tb_kr?.toLocaleString("sv-SE")} kr ({r.tb_pct}%)</span>
                          ) : <span className="text-gray-400">inget säljpris</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Leverantörskopplingar + datablad */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500"><Link2 className="h-3.5 w-3.5" /> Leverantörskopplingar</div>
              {artikel.leverantorskopplingar?.length ? artikel.leverantorskopplingar.map((k, i) => (
                <div key={i} className="flex items-center gap-2 py-1 text-sm">
                  <span className="font-mono text-xs text-gray-600">{k.produktnyckel}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${k.bekraftad ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{k.bekraftad ? "bekräftad" : "obekräftad"}</span>
                </div>
              )) : <div className="text-sm text-gray-400">Ingen koppling.</div>}
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500"><FileText className="h-3.5 w-3.5" /> Datablad</div>
              {artikel.datablad?.length ? artikel.datablad.map((d, i) => (
                <div key={i} className="py-1 text-sm">
                  {d.url ? (
                    <a href={d.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-indigo-600 hover:underline">{d.titel} <ExternalLink className="h-3 w-3" /></a>
                  ) : <span className="text-gray-600">{d.titel} <span className="text-xs text-gray-400">(länk kunde inte skapas)</span></span>}
                </div>
              )) : <div className="text-sm text-gray-400">Inget uppladdat.</div>}
            </div>
          </div>
        </div>

        {/* Höger kolumn: pris + historik */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Gällande säljpris</div>
            <div className="text-2xl font-display font-bold tabular-nums text-gray-900">
              {artikel.saljprismodell === "offert" ? <span className="text-base font-normal text-amber-600">Begär offert</span> : kr(artikel.saljpris)}
            </div>
            {artikel.saljprisversion && <div className="mt-1 text-xs text-gray-400">Version {artikel.saljprisversion} · sedan {artikel.saljpris_giltig_fran}</div>}
            {!artikel.sl_artikelnr && <div className="mt-2 text-xs text-amber-600">Inte kopplad till säljlagret — kan inte sättas härifrån än.</div>}

            {artikel.sl_artikelnr && (
              <div className="mt-4 space-y-2 border-t border-gray-100 pt-4">
                <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Sätt nytt pris</div>
                <input type="number" value={nyttPris} onChange={(e) => setNyttPris(e.target.value)} placeholder="Nytt pris kr"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:ring-2 focus:ring-gray-100" />
                <input value={motivering} onChange={(e) => setMotivering(e.target.value)} placeholder="Motivering (krävs)"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:ring-2 focus:ring-gray-100" />
                <button onClick={spara} disabled={sparar || !nyttPris || !motivering.trim()}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-40">
                  {sparar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Spara nytt pris
                </button>
                <p className="text-xs text-gray-400">Blockeras automatiskt om TB hamnar under kategorins golv.</p>
                {sparatMsg && <div className="flex items-center gap-1.5 text-xs text-emerald-700"><Check className="h-3 w-3" /> {sparatMsg}</div>}
                {sparaFel && <div className="flex items-center gap-1.5 text-xs text-rose-700"><AlertTriangle className="h-3 w-3" /> {sparaFel}</div>}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500"><History className="h-3.5 w-3.5" /> Prishistorik</div>
            {historik.length ? (
              <div className="space-y-2">
                {historik.map((v) => (
                  <div key={v.version} className={`rounded-lg px-3 py-2 text-xs ${v.gallande ? "bg-emerald-50" : "bg-gray-50"}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-900">v{v.version} · {kr(v.pris)}</span>
                      <span className="text-gray-400">{v.giltig_fran}{v.giltig_till ? ` → ${v.giltig_till}` : ""}</span>
                    </div>
                    <div className="mt-0.5 text-gray-500">{v.motivering}</div>
                    <div className="mt-0.5 text-gray-400">{v.kalla} · {v.beslut_av}</div>
                  </div>
                ))}
              </div>
            ) : <div className="text-sm text-gray-400">Ingen historik.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
