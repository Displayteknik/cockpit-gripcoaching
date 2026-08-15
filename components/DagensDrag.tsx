"use client";

// DRIV-4 — morgonkön. Översta sektionen i Fokus idag (spec punkt 4). Befintlig
// funktionalitet (FokusClient) rörs inte, den här komponenten läggs bara ovanpå.

import { useEffect, useState } from "react";
import {
  Sparkles, Loader2, CheckCircle2, Clock, CalendarDays, MessageSquareWarning,
  FileWarning, TrendingDown, RefreshCw, LayoutGrid,
} from "lucide-react";

interface KoRad {
  id: string; ghlOpportunityId: string | null; namn: string | null; typ: string;
  varforNu: string; foreslagetDrag: string; status: string;
  moteForberedelse?: { frageforslag: string[]; senasteHandelser: string[] };
}

const TYP_IKON: Record<string, React.ElementType> = {
  uppgift_forfallen: Clock, obesvarat: MessageSquareWarning, offert_uppfoljning: FileWarning,
  mote_forberedelse: CalendarDays, steg_aldrat: TrendingDown,
};

export default function DagensDrag({ primaryColor }: { primaryColor: string }) {
  const [rader, setRader] = useState<KoRad[] | null>(null);
  const [laddar, setLaddar] = useState(true);
  const [agerar, setAgerar] = useState<string | null>(null);
  const [fel, setFel] = useState<string | null>(null);

  async function ladda() {
    setLaddar(true);
    setFel(null);
    try {
      const r = await fetch("/api/driv/ko");
      const d = await r.json();
      if (d.error) { setFel(d.error); setRader([]); return; }
      setRader((d.rader as KoRad[]).filter((r) => r.status === "oppen"));
    } catch {
      setFel("Kunde inte hämta dagens drag just nu.");
      setRader([]);
    } finally {
      setLaddar(false);
    }
  }
  useEffect(() => { ladda(); }, []);

  async function agera(id: string, beslut: "klar" | "senare_idag" | "vecka") {
    setAgerar(id);
    try {
      const r = await fetch("/api/driv/ko", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, beslut }) });
      const d = await r.json();
      if (!d.ok) { alert(d.error || "Kunde inte spara."); return; }
      setRader((r) => (r || []).filter((x) => x.id !== id)); // optimistisk — försvinner direkt
    } finally {
      setAgerar(null);
    }
  }

  if (laddar) {
    return (
      <section className="space-y-3">
        <h2 className="font-display font-bold text-gray-900 text-lg inline-flex items-center gap-2">
          <Sparkles className="w-5 h-5" style={{ color: primaryColor }} /> Dagens drag
        </h2>
        <div className="flex items-center gap-2 text-sm text-gray-400 py-6"><Loader2 className="w-4 h-4 animate-spin" /> Bygger dagens kö…</div>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-bold text-gray-900 text-lg inline-flex items-center gap-2">
          <Sparkles className="w-5 h-5" style={{ color: primaryColor }} /> Dagens drag
        </h2>
        <button onClick={ladda} className="text-xs text-gray-400 hover:text-gray-600 inline-flex items-center gap-1">
          <RefreshCw className="w-3 h-3" /> Uppdatera
        </button>
      </div>

      {fel && <div className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">{fel}</div>}

      {!fel && rader && rader.length === 0 && (
        <div className="text-center text-sm text-gray-400 py-10 bg-white border border-gray-100 rounded-2xl">
          Allt är gjort, bra jobbat. 🎉
        </div>
      )}

      {rader && rader.length > 0 && (
        <div className="space-y-2.5">
          {rader.map((r) => {
            const Icon = TYP_IKON[r.typ] || Sparkles;
            const kortHref = r.ghlOpportunityId ? `/dashboard/driv/${r.ghlOpportunityId}${r.typ === "obesvarat" ? "?auto=1" : ""}` : undefined;
            return (
              <div key={r.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${primaryColor}14` }}>
                    <Icon className="w-4 h-4" style={{ color: primaryColor }} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-gray-900">{r.varforNu}</div>
                    <div className="text-sm text-gray-500 mt-0.5">{r.foreslagetDrag}</div>
                    {r.moteForberedelse && r.moteForberedelse.frageforslag.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {r.moteForberedelse.frageforslag.map((f, i) => (
                          <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                            <span className="text-gray-300">·</span> {f}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  {kortHref && (
                    <a
                      href={kortHref}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-white shadow-sm hover:opacity-90"
                      style={{ background: primaryColor }}
                    >
                      <LayoutGrid className="w-3.5 h-3.5" /> Öppna kortet
                    </a>
                  )}
                  <button
                    onClick={() => agera(r.id, "klar")}
                    disabled={agerar === r.id}
                    className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Klart
                  </button>
                  <button
                    onClick={() => agera(r.id, "senare_idag")}
                    disabled={agerar === r.id}
                    className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1.5 disabled:opacity-40"
                  >
                    Senare idag
                  </button>
                  <button
                    onClick={() => agera(r.id, "vecka")}
                    disabled={agerar === r.id}
                    className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1.5 disabled:opacity-40"
                  >
                    Om en vecka
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
