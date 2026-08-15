"use client";

import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, AlertTriangle, RefreshCw, LayoutGrid } from "lucide-react";

interface Forslag {
  ghlOpportunityId: string; ghlContactId: string; namn: string | null; stegNamn: string | null;
  dagarISteget: number | null; regel: string; titel: string; datum: string;
}
interface Kvitto { ghlOpportunityId: string; namn: string | null; skapad: boolean; hoppadeOver?: string; fel?: string }

function datumInput(iso: string) {
  return new Date(iso).toISOString().slice(0, 16);
}

export default function StadningPage() {
  const [primary] = useState("#4f46e5");
  const [forslag, setForslag] = useState<Forslag[] | null>(null);
  const [ingar, setIngar] = useState<Set<string>>(new Set());
  const [redigerad, setRedigerad] = useState<Record<string, { titel: string; datum: string }>>({});
  const [laddar, setLaddar] = useState(true);
  const [fel, setFel] = useState<string | null>(null);
  const [godkanner, setGodkanner] = useState(false);
  const [kvitton, setKvitton] = useState<Kvitto[] | null>(null);

  async function ladda() {
    setLaddar(true);
    setFel(null);
    try {
      const r = await fetch("/api/driv/stadning");
      const d = await r.json();
      if (d.error) { setFel(d.error); setForslag([]); return; }
      setForslag(d.forslag);
      setIngar(new Set((d.forslag as Forslag[]).map((f) => f.ghlOpportunityId)));
    } catch {
      setFel("Kunde inte nå servern. Kontrollera anslutningen och försök igen.");
      setForslag([]);
    } finally {
      setLaddar(false);
    }
  }
  useEffect(() => { ladda(); }, []);

  async function godkann() {
    if (!forslag) return;
    setGodkanner(true);
    try {
      const rader = forslag
        .filter((f) => ingar.has(f.ghlOpportunityId))
        .map((f) => ({
          ghlOpportunityId: f.ghlOpportunityId,
          ghlContactId: f.ghlContactId,
          namn: f.namn,
          titel: redigerad[f.ghlOpportunityId]?.titel ?? f.titel,
          datum: redigerad[f.ghlOpportunityId]?.datum ? new Date(redigerad[f.ghlOpportunityId].datum).toISOString() : f.datum,
        }));
      const r = await fetch("/api/driv/stadning", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rader }) });
      const d = await r.json();
      if (d.error) { setFel(d.error); return; }
      setKvitton(d.kvitton);
    } finally {
      setGodkanner(false);
    }
  }

  if (laddar) {
    return <div className="flex items-center justify-center py-24 text-gray-400"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Läser pipelinen…</div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="font-display font-bold text-gray-900 text-2xl">Engångsstädning — nästa steg saknas</h1>
        <p className="text-sm text-gray-500 mt-1">
          Affärer i spel utan nästa steg. Förslagen är regelbaserade (steg + tid i steget), ingen AI. Justera vad du vill innan du godkänner.
        </p>
      </div>

      {fel && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {fel}
        </div>
      )}

      {kvitton ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-2">
          <h2 className="font-display font-bold text-gray-900">Klart — {kvitton.filter((k) => k.skapad).length} av {kvitton.length} uppgifter skapade</h2>
          {kvitton.map((k) => (
            <div key={k.ghlOpportunityId} className="flex items-center gap-2 text-sm py-1.5 border-t border-gray-50 first:border-t-0">
              {k.skapad ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />}
              <span className="font-medium text-gray-700">{k.namn || k.ghlOpportunityId}</span>
              {k.hoppadeOver && <span className="text-gray-400">— {k.hoppadeOver}</span>}
              {k.fel && <span className="text-red-600">— {k.fel}</span>}
            </div>
          ))}
          <button onClick={ladda} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold px-3.5 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50">
            <RefreshCw className="w-3.5 h-3.5" /> Kör igen (visar bara det som fortfarande saknas)
          </button>
        </div>
      ) : !forslag || forslag.length === 0 ? (
        <div className="text-center text-sm text-gray-400 py-16">Allt är städat — varje affär i spel har redan ett nästa steg.</div>
      ) : (
        <>
          <div className="space-y-3">
            {forslag.map((f) => {
              const vald = ingar.has(f.ghlOpportunityId);
              const r = redigerad[f.ghlOpportunityId];
              return (
                <div key={f.ghlOpportunityId} className={`bg-white border rounded-2xl p-4 shadow-sm ${vald ? "border-gray-100" : "border-gray-100 opacity-50"}`}>
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={vald}
                      onChange={(e) => setIngar((s) => { const n = new Set(s); if (e.target.checked) n.add(f.ghlOpportunityId); else n.delete(f.ghlOpportunityId); return n; })}
                      className="mt-1.5 w-4 h-4 rounded"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900">{f.namn || "Namnlös affär"}</span>
                        <span className="text-xs text-gray-400">{f.stegNamn} · {f.dagarISteget} dagar i steget · regel: {f.regel}</span>
                      </div>
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        <input
                          value={r?.titel ?? f.titel}
                          onChange={(e) => setRedigerad((s) => ({ ...s, [f.ghlOpportunityId]: { titel: e.target.value, datum: r?.datum ?? datumInput(f.datum) } }))}
                          className="flex-1 min-w-[220px] text-sm rounded-lg border border-gray-200 px-3 py-1.5 focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                        />
                        <input
                          type="datetime-local"
                          value={r?.datum ?? datumInput(f.datum)}
                          onChange={(e) => setRedigerad((s) => ({ ...s, [f.ghlOpportunityId]: { titel: r?.titel ?? f.titel, datum: e.target.value } }))}
                          className="text-sm rounded-lg border border-gray-200 px-3 py-1.5 focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                        />
                        {/* Generella förslag passar inte alla — öppna det riktiga kortet (tidslinje,
                            senaste kontakt) i en ny flik när texten ovan inte känns rätt. */}
                        <a
                          href={`/dashboard/driv/${f.ghlOpportunityId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 flex-shrink-0"
                        >
                          <LayoutGrid className="w-3.5 h-3.5" /> Öppna kort
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={godkann}
            disabled={godkanner || ingar.size === 0}
            className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-lg text-white shadow-sm hover:opacity-90 disabled:opacity-40"
            style={{ background: primary }}
          >
            {godkanner ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Godkänn {ingar.size} uppgift{ingar.size === 1 ? "" : "er"} i MySales
          </button>
        </>
      )}
    </div>
  );
}
