"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Sparkles, ArrowLeft, Loader2, Send, Check, AlertTriangle } from "lucide-react";
import { DashHero } from "@/components/ui/dash";

interface Artikel { artikelnummer: string; namn: string }
interface Meddelande { roll: "user" | "assistant"; text: string }
interface Laget { saljpris: number | null; golv: number; bastaInkop: { landat_sek: number; tb_pct: number | null } | null }

export default function PriscoachPageWrapper() {
  return (
    <Suspense fallback={null}>
      <PriscoachPage />
    </Suspense>
  );
}

function PriscoachPage() {
  const forvald = useSearchParams().get("artikel") || "";
  const [artiklar, setArtiklar] = useState<Artikel[]>([]);
  const [vald, setVald] = useState(forvald);
  const [historik, setHistorik] = useState<Meddelande[]>([]);
  const [laget, setLaget] = useState<Laget | null>(null);
  const [laddar, setLaddar] = useState(false);
  const [startad, setStartad] = useState(false);
  const [fraga, setFraga] = useState("");

  const [nyttPris, setNyttPris] = useState("");
  const [motivering, setMotivering] = useState("");
  const [godkanner, setGodkanner] = useState(false);
  const [godkantMsg, setGodkantMsg] = useState<string | null>(null);
  const [godkannFel, setGodkannFel] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/prislistan/granska?sajt=0")
      .then((r) => r.json())
      .then((d) => setArtiklar((d.artiklar || []).map((a: { artikelnummer: string; namn: string }) => ({ artikelnummer: a.artikelnummer, namn: a.namn }))))
      .catch(() => {});
  }, []);

  // Kommer man hit via "Coacha priset" på en produktsida är artikeln redan vald — starta direkt.
  useEffect(() => {
    if (forvald) starta();
  }, [forvald]); // eslint-disable-line react-hooks/exhaustive-deps

  async function starta() {
    if (!vald) return;
    setLaddar(true); setHistorik([]); setLaget(null); setStartad(true); setGodkantMsg(null); setGodkannFel(null);
    try {
      const r = await fetch("/api/prislistan/coach", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ artikelnummer: vald }),
      });
      const d = await r.json();
      if (d.error) { setHistorik([{ roll: "assistant", text: `Fel: ${d.error}` }]); return; }
      setHistorik([{ roll: "assistant", text: d.svar }]);
      setLaget(d.laget);
      if (d.laget?.saljpris) setNyttPris(String(d.laget.saljpris));
    } finally { setLaddar(false); }
  }

  async function stallFraga() {
    if (!fraga.trim() || !vald) return;
    const ny = [...historik, { roll: "user" as const, text: fraga }];
    setHistorik(ny); setFraga(""); setLaddar(true);
    try {
      const r = await fetch("/api/prislistan/coach", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ artikelnummer: vald, fraga, historik: ny.slice(0, -1) }),
      });
      const d = await r.json();
      setHistorik((h) => [...h, { roll: "assistant", text: d.svar || d.error || "Inget svar" }]);
    } finally { setLaddar(false); }
  }

  async function godkann() {
    const pris = Number(nyttPris);
    if (!pris || !motivering.trim()) return;
    setGodkanner(true); setGodkannFel(null); setGodkantMsg(null);
    try {
      const r = await fetch("/api/prislistan/coach/godkann", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ artikelnummer: vald, nyttPris: pris, motivering, beslutAv: "Håkan (Priscoachen)" }),
      });
      const d = await r.json();
      if (!r.ok || d.error) { setGodkannFel(d.error || `Fel ${r.status}`); return; }
      setGodkantMsg(`Ny säljlagerversion ${d.ny.version}: ${d.ny.pris} kr. TB ${d.tb?.pct ?? "?"}%.`);
    } catch (e) { setGodkannFel(String(e)); } finally { setGodkanner(false); }
  }

  return (
    <div className="space-y-8">
      <DashHero
        title="Priscoachen"
        subtitle="Läser läget, spanar marknaden, föreslår en sweet spot. Coachen föreslår, du beslutar — inget pris skrivs utan ditt godkännande."
        icon={Sparkles}
        accent="#7c3aed"
      />
      <Link href="/dashboard/prislistan" className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> Tillbaka till prislistan
      </Link>

      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-4">
        <div className="flex gap-2">
          <select value={vald} onChange={(e) => setVald(e.target.value)}
            className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-gray-400 focus:ring-2 focus:ring-gray-100">
            <option value="">Välj artikel…</option>
            {artiklar.map((a) => <option key={a.artikelnummer} value={a.artikelnummer}>{a.namn} ({a.artikelnummer})</option>)}
          </select>
          <button onClick={starta} disabled={!vald || laddar}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-40"
            style={{ background: "#7c3aed" }}>
            {laddar && !historik.length ? <Loader2 className="h-4 w-4 animate-spin" /> : "Coacha priset"}
          </button>
        </div>

        {startad && (
          <div className="space-y-4">
            {laget && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                <span>Gällande pris: <b className="text-gray-700">{laget.saljpris ?? "inget"} kr</b></span>
                <span>Golv: <b className="text-gray-700">{laget.golv}%</b></span>
                {laget.bastaInkop && <span>Bästa inköp: <b className="text-gray-700">{laget.bastaInkop.landat_sek} kr landat, TB {laget.bastaInkop.tb_pct}%</b></span>}
              </div>
            )}
            <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
              {historik.map((m, i) => (
                <div key={i} className={`rounded-xl p-3 text-sm leading-relaxed ${m.roll === "user" ? "ml-8 bg-violet-50 text-gray-800" : "mr-8 bg-gray-50 text-gray-700"}`}>
                  {m.text}
                </div>
              ))}
              {laddar && historik.length > 0 && <div className="flex items-center gap-2 text-xs text-gray-400"><Loader2 className="h-3 w-3 animate-spin" /> Coachen svarar…</div>}
            </div>
            <div className="flex gap-2">
              <input value={fraga} onChange={(e) => setFraga(e.target.value)} onKeyDown={(e) => e.key === "Enter" && stallFraga()}
                placeholder="Fråga vidare, t.ex. vad tar SWEDX för motsvarande…"
                className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-gray-400 focus:ring-2 focus:ring-gray-100" />
              <button onClick={stallFraga} disabled={laddar || !fraga.trim()} className="rounded-lg px-4 py-2.5 text-white disabled:opacity-40" style={{ background: "#7c3aed" }}>
                <Send className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2 border-t border-gray-100 pt-4">
              <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Godkänn förslag</div>
              <div className="flex flex-wrap gap-2">
                <input type="number" value={nyttPris} onChange={(e) => setNyttPris(e.target.value)} placeholder="Nytt pris kr"
                  className="w-32 rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-gray-400 focus:ring-2 focus:ring-gray-100" />
                <input value={motivering} onChange={(e) => setMotivering(e.target.value)} placeholder="Motivering (krävs)"
                  className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-gray-400 focus:ring-2 focus:ring-gray-100" />
                <button onClick={godkann} disabled={godkanner || !nyttPris || !motivering.trim()}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-40">
                  {godkanner ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Godkänn
                </button>
              </div>
              {godkantMsg && <div className="flex items-center gap-1.5 text-sm text-emerald-700"><Check className="h-3.5 w-3.5" /> {godkantMsg}</div>}
              {godkannFel && <div className="flex items-center gap-1.5 text-sm text-rose-700"><AlertTriangle className="h-3.5 w-3.5" /> {godkannFel}</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
