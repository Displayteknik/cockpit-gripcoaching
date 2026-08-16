"use client";

import { useState } from "react";
import Link from "next/link";
import { Calculator, ArrowLeft, Loader2 } from "lucide-react";
import { DashHero } from "@/components/ui/dash";

interface Resultat {
  kolumner: number; rader: number; kabinettPerSida: number; kabinettTotalt: number;
  bredd_m: number; hojd_m: number; ytaPerSidaM2: number; ytaTotaltM2: number;
  upplosning: { bredd: number; hojd: number }; format: string;
  prisPerSida: number; prisTotalt: number;
}

const kr = (n: number) => `${n.toLocaleString("sv-SE")} kr`;

export default function KabinettkalkylatorPage() {
  const [bredd, setBredd] = useState("1.92");
  const [hojd, setHojd] = useState("2.88");
  const [dubbelsidig, setDubbelsidig] = useState(true);
  const [pris, setPris] = useState("16200");
  const [resultat, setResultat] = useState<Resultat | null>(null);
  const [laddar, setLaddar] = useState(false);
  const [fel, setFel] = useState<string | null>(null);

  async function berakna() {
    setLaddar(true); setFel(null);
    try {
      const r = await fetch("/api/prislistan/kabinett", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ bredd_m: Number(bredd), hojd_m: Number(hojd), dubbelsidig, prisKrPerKvm: Number(pris) }),
      });
      const d = await r.json();
      if (!r.ok || d.error) { setFel(d.error || `Fel ${r.status}`); return; }
      setResultat(d);
    } catch (e) { setFel(String(e)); } finally { setLaddar(false); }
  }

  return (
    <div className="space-y-8">
      <DashHero
        title="Kabinettkalkylatorn"
        subtitle="Mata in önskad storlek på en LED-vägg. Snappar till 0,96 m-kabinett, aldrig ett halvt. Kalibrerad mot Fresh Air-offerten."
        icon={Calculator}
        accent="#059669"
      />
      <Link href="/dashboard/prislistan" className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> Tillbaka till prislistan
      </Link>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Önskad bredd (m)</span>
              <input type="number" step="0.01" value={bredd} onChange={(e) => setBredd(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-gray-400 focus:ring-2 focus:ring-gray-100" />
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Önskad höjd (m)</span>
              <input type="number" step="0.01" value={hojd} onChange={(e) => setHojd(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-gray-400 focus:ring-2 focus:ring-gray-100" />
            </label>
          </div>
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Pris per kvadratmeter (kr)</span>
            <input type="number" value={pris} onChange={(e) => setPris(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-gray-400 focus:ring-2 focus:ring-gray-100" />
            <span className="mt-1 block text-xs text-gray-400">16 200 dubbelsidig / 14 900 enkelsidig enligt PRIS-2-beställningen — kontrollera mot säljlagrets 20 000 innan du skickar en offert.</span>
          </label>
          <label className="flex items-center gap-2.5">
            <input type="checkbox" checked={dubbelsidig} onChange={(e) => setDubbelsidig(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" />
            <span className="text-sm text-gray-700">Dubbelsidig</span>
          </label>
          <button onClick={berakna} disabled={laddar}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-40">
            {laddar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />} Beräkna
          </button>
          {fel && <div className="rounded-lg bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{fel}</div>}
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          {!resultat ? (
            <div className="flex h-full items-center justify-center text-sm text-gray-400">Fyll i mått och beräkna.</div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs uppercase tracking-wide text-gray-500">Storlek</div>
                  <div className="text-lg font-display font-bold text-gray-900 tabular-nums">{resultat.bredd_m} × {resultat.hojd_m} m</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-gray-500">Kabinett</div>
                  <div className="text-lg font-display font-bold text-gray-900 tabular-nums">{resultat.kolumner} × {resultat.rader} = {resultat.kabinettTotalt} st</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-gray-500">Yta</div>
                  <div className="text-lg font-display font-bold text-gray-900 tabular-nums">{resultat.ytaTotaltM2} m²</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-gray-500">Upplösning</div>
                  <div className="text-lg font-display font-bold text-gray-900 tabular-nums">{resultat.upplosning.bredd} × {resultat.upplosning.hojd} px</div>
                </div>
              </div>
              <div className="border-t border-gray-100 pt-4">
                <div className="text-xs uppercase tracking-wide text-gray-500">Pris</div>
                <div className="text-3xl font-display font-bold text-gray-900 tabular-nums">{kr(resultat.prisTotalt)}</div>
                <div className="text-sm text-gray-500">{kr(resultat.prisPerSida)} per sida · format {resultat.format}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
