"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Package, ArrowLeft, ArrowUpDown, Search, Link2, FileText, CheckCircle2, Circle } from "lucide-react";
import { DashHero, StatTile } from "@/components/ui/dash";

interface Produkt {
  id: string; artikelnummer: string; namn: string; kategori: string;
  tum: number | null; ljusstyrka_nits: number | null; ip_klass: string | null; miljo: string | null;
  status: string; leverantorskopplingar: number; leverantorskopplingBekraftad: boolean;
  datablad: number; tillval: number;
  saljprisArtikelnr: string | null; saljpris: number | null; saljprismodell: string | null;
  saljprisEnhet: string | null; franPris: boolean; tbPct: number | null;
}

type SortKey = "artikelnummer" | "namn" | "kategori" | "tum" | "status" | "saljpris" | "tbPct";

const KATEGORI_LABEL: Record<string, string> = {
  fonsterskarm: "Fönsterskärm",
  utomhus_lcd: "Utomhus LCD",
  led_vagg: "LED-vägg",
  transparent_film: "Transparent film",
  cylinder: "Cylinder",
  mediaspelare: "Mediaspelare",
  tillbehor: "Tillbehör",
  tjanst: "Tjänst",
};

const kr = (n: number | null) => (n == null ? "—" : `${Math.round(n).toLocaleString("sv-SE")} kr`);

export default function ProdukterPage() {
  const router = useRouter();
  const [produkter, setProdukter] = useState<Produkt[]>([]);
  const [laddar, setLaddar] = useState(true);
  const [fel, setFel] = useState<string | null>(null);
  const [sok, setSok] = useState("");
  const [kategoriFilter, setKategoriFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("artikelnummer");
  const [sortAsc, setSortAsc] = useState(true);

  useEffect(() => {
    fetch("/api/prislistan/produkter")
      .then((r) => r.json())
      .then((d) => { if (d.error) setFel(d.error); else setProdukter(d.produkter || []); })
      .catch((e) => setFel(String(e)))
      .finally(() => setLaddar(false));
  }, []);

  const kategorier = useMemo(() => [...new Set(produkter.map((p) => p.kategori))].sort(), [produkter]);

  const rader = useMemo(() => {
    let r = produkter;
    if (kategoriFilter) r = r.filter((p) => p.kategori === kategoriFilter);
    if (sok.trim()) {
      const q = sok.toLowerCase();
      r = r.filter((p) => p.namn.toLowerCase().includes(q) || p.artikelnummer.toLowerCase().includes(q));
    }
    const sorted = [...r].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return av - bv;
      return String(av).localeCompare(String(bv), "sv");
    });
    return sortAsc ? sorted : sorted.reverse();
  }, [produkter, sok, kategoriFilter, sortKey, sortAsc]);

  function sortera(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  }

  const kopplade = produkter.filter((p) => p.saljpris != null || p.saljprisArtikelnr).length;
  const bekraftade = produkter.filter((p) => p.leverantorskopplingBekraftad).length;

  const Th = ({ children, k }: { children: React.ReactNode; k: SortKey }) => (
    <th className="cursor-pointer select-none px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hover:text-gray-700" onClick={() => sortera(k)}>
      <span className="inline-flex items-center gap-1">{children}<ArrowUpDown className="h-3 w-3 opacity-40" /></span>
    </th>
  );

  return (
    <div className="space-y-6">
      <DashHero title="Produkter" subtitle="Hela artikellagret i en tabell — sök, sortera, se status på ett ögonblick." icon={Package} accent="#4f46e5" />
      <Link href="/dashboard/prislistan" className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> Tillbaka till prislistan
      </Link>

      {fel && <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">{fel}</div>}

      {!laddar && !fel && (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatTile label="Artiklar totalt" value={produkter.length} icon={Package} tone="violet" i={0} />
            <StatTile label="Har säljpris" value={kopplade} icon={CheckCircle2} tone="emerald" i={1} />
            <StatTile label="Bekräftad inköpskoppling" value={bekraftade} icon={Link2} tone="blue" i={2} />
            <StatTile label="Kategorier" value={kategorier.length} icon={FileText} tone="amber" i={3} />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input value={sok} onChange={(e) => setSok(e.target.value)} placeholder="Sök namn eller artikelnummer…"
                className="w-full rounded-lg border border-gray-200 py-2.5 pl-9 pr-4 text-sm focus:border-gray-400 focus:ring-2 focus:ring-gray-100" />
            </div>
            <select value={kategoriFilter} onChange={(e) => setKategoriFilter(e.target.value)}
              className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-gray-400 focus:ring-2 focus:ring-gray-100">
              <option value="">Alla kategorier</option>
              {kategorier.map((k) => <option key={k} value={k}>{KATEGORI_LABEL[k] || k}</option>)}
            </select>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 bg-gray-50">
                <tr>
                  <Th k="artikelnummer">Artikelnr</Th>
                  <Th k="namn">Namn</Th>
                  <Th k="kategori">Kategori</Th>
                  <Th k="tum">Specs</Th>
                  <Th k="status">Status</Th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Inköp</th>
                  <Th k="saljpris">Säljpris</Th>
                  <Th k="tbPct">TB</Th>
                </tr>
              </thead>
              <tbody>
                {rader.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => router.push(`/dashboard/prislistan/produkter/${encodeURIComponent(p.artikelnummer)}`)}
                    className="cursor-pointer border-b border-gray-50 last:border-0 hover:bg-indigo-50/40"
                  >
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-gray-500">{p.artikelnummer}</td>
                    <td className="px-4 py-2.5 font-medium text-gray-900">{p.namn}</td>
                    <td className="px-4 py-2.5 text-gray-600">{KATEGORI_LABEL[p.kategori] || p.kategori}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">
                      {[p.tum && `${p.tum}″`, p.ljusstyrka_nits && `${p.ljusstyrka_nits} nits`, p.ip_klass].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        p.status === "aktiv" ? "bg-emerald-50 text-emerald-700" : p.status === "utgaende" ? "bg-amber-50 text-amber-700" : "bg-gray-100 text-gray-600"
                      }`}>{p.status === "aktiv" ? "Aktiv" : p.status === "utgaende" ? "Utgående" : "Utgången"}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      {p.leverantorskopplingar > 0 ? (
                        <span className={`inline-flex items-center gap-1 text-xs ${p.leverantorskopplingBekraftad ? "text-emerald-700" : "text-amber-700"}`}>
                          {p.leverantorskopplingBekraftad ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                          {p.leverantorskopplingar} koppling{p.leverantorskopplingar === 1 ? "" : "ar"}
                        </span>
                      ) : <span className="text-xs text-gray-400">Ingen</span>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 font-semibold tabular-nums text-gray-900">
                      {p.saljprismodell === "offert" ? <span className="font-normal text-amber-600">Begär offert</span> : p.saljpris != null ? `${p.franPris ? "från " : ""}${kr(p.saljpris)}` : <span className="font-normal text-gray-400">Ej kopplat</span>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">
                      {p.tbPct != null ? <span className={p.tbPct >= 30 ? "text-emerald-700" : "text-rose-600"}>{p.tbPct}%</span> : <span className="text-gray-400">—</span>}
                    </td>
                  </tr>
                ))}
                {rader.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-400">Inga produkter matchar.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
