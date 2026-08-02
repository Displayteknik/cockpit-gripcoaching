"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Image as ImageIcon, Film, Plus, Check, AlertTriangle } from "lucide-react";

// ETAPP K2-2 — saldo, förbrukning i klartext, historik och påfyllning.
// Regler i den här vyn: inga kronor, inga interna ord, ingen jargong. Förvarningen
// börjar under 15 procent kvar, och vid noll är beskedet tydligt om vad som händer nu.

interface Historikrad { created_at: string; delta: number; type: string; note: string | null }
interface Data {
  saldo: number; kvot: number; extra: number; anvant: number; procentKvar: number;
  periodStart: string; forbrukning: string;
  antal: Record<string, number>; priser: Record<string, number>;
  historik: Historikrad[];
  pending: { id: string; credits: number; created_at: string } | null;
  topup: { credits: number; pris: number };
}

const TYP_TEXT: Record<string, string> = {
  monthly_reset: "Ny månad, kvoten förnyad",
  usage: "Skapat",
  topup: "Påfyllning tillagd",
  manual_grant: "Extra credits från din rådgivare",
};

const ATGARD_TEXT: Record<string, string> = {
  "social-bild": "en bild till ett inlägg",
  "hero-bild": "en stor bild",
  video: "en video",
};

const datum = (s: string) => new Date(s).toLocaleDateString("sv-SE", { day: "numeric", month: "long" });

/** Nästa månadsskifte i klartext, så "förnyas den 1:a" blir ett riktigt datum. */
function nastaFornyelse(): string {
  const nu = new Date();
  const nasta = new Date(nu.getFullYear(), nu.getMonth() + 1, 1);
  return nasta.toLocaleDateString("sv-SE", { day: "numeric", month: "long" });
}

export default function CreditsVy({ primaryColor }: { primaryColor: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [fel, setFel] = useState("");
  const [laddar, setLaddar] = useState(true);
  const [bestaller, setBestaller] = useState(false);
  const [kvitto, setKvitto] = useState("");

  const hamta = useCallback(async () => {
    try {
      const r = await fetch("/api/k/credits");
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Kunde inte hämta saldot");
      setData(j);
      setFel("");
    } catch (e) {
      setFel((e as Error).message);
    } finally {
      setLaddar(false);
    }
  }, []);

  useEffect(() => { hamta(); }, [hamta]);

  async function bestall() {
    setBestaller(true);
    try {
      const r = await fetch("/api/k/credits", { method: "POST" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.besked || j.error || "Beställningen gick inte fram");
      setKvitto(j.besked);
      await hamta();
    } catch (e) {
      setFel((e as Error).message);
    } finally {
      setBestaller(false);
    }
  }

  if (laddar) {
    return <div className="flex items-center gap-2 text-sm text-gray-500 py-8"><Loader2 className="w-4 h-4 animate-spin" /> Hämtar din kvot…</div>;
  }
  if (fel && !data) {
    return <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{fel}</div>;
  }
  if (!data) return null;

  const tomt = data.saldo <= 0;
  const nastanTomt = !tomt && data.procentKvar < 15;
  const anvantProcent = data.kvot + data.extra > 0 ? (data.anvant / (data.kvot + data.extra)) * 100 : 0;

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Saldot, stort och först. */}
      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="font-display text-4xl font-bold tabular-nums" style={{ color: tomt ? "#dc2626" : primaryColor }}>
              {data.saldo}
            </div>
            <p className="mt-1 text-sm text-gray-600">
              credits kvar av {data.kvot + data.extra} den här månaden
            </p>
          </div>
          <p className="text-sm text-gray-500">Kvoten förnyas {nastaFornyelse()}.</p>
        </div>

        <div className="mt-4 h-2.5 w-full rounded-full bg-gray-100">
          <div
            className="h-2.5 rounded-full transition-all"
            style={{
              width: `${Math.min(100, Math.max(2, anvantProcent))}%`,
              background: tomt ? "#dc2626" : nastanTomt ? "#d97706" : primaryColor,
            }}
          />
        </div>

        <p className="mt-3 text-sm text-gray-700">
          Du har skapat <strong>{data.forbrukning}</strong> den här månaden.
        </p>
      </section>

      {/* Tydligt besked vid noll, förvarning under 15 procent. */}
      {tomt && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div>
            <p className="font-semibold text-red-800">Månadens bilder och videor är slut.</p>
            <p className="mt-1 text-sm text-red-700">
              Du kan fortsätta skriva texter som vanligt, de drar ingenting. Nya bilder går att skapa igen {nastaFornyelse()},
              eller så fyller du på nu med knappen nedan.
            </p>
          </div>
        </div>
      )}
      {nastanTomt && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          Det börjar ta slut: <strong>{data.saldo} credits</strong> kvar. Det räcker till ungefär {Math.floor(data.saldo / (data.priser["social-bild"] || 3))} bilder till.
        </div>
      )}

      {/* Vad saker kostar — i credits, aldrig i kronor. */}
      <section className="rounded-2xl border border-gray-100 bg-white p-5">
        <h2 className="font-display text-lg font-semibold text-gray-900">Vad kostar vad?</h2>
        <ul className="mt-3 space-y-2 text-sm text-gray-700">
          <li className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-gray-400" /> En bild till ett inlägg
            <span className="ml-auto font-semibold tabular-nums">{data.priser["social-bild"]} credits</span>
          </li>
          <li className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-gray-400" /> En stor bild till webb eller blogg
            <span className="ml-auto font-semibold tabular-nums">{data.priser["hero-bild"]} credits</span>
          </li>
          <li className="flex items-center gap-2">
            <Film className="h-4 w-4 text-gray-400" /> Video, per påbörjade fem sekunder
            <span className="ml-auto font-semibold tabular-nums">{data.priser.video} credits</span>
          </li>
        </ul>
        <p className="mt-3 text-xs text-gray-500">Texter, rubriker och förslag är alltid fria och drar inga credits.</p>
      </section>

      {/* Påfyllning. Ingen betalning här — beställningen går till din rådgivare. */}
      <section className="rounded-2xl border border-gray-100 bg-white p-5">
        <h2 className="font-display text-lg font-semibold text-gray-900">Behöver du fler?</h2>
        <p className="mt-1 text-sm text-gray-600">
          {data.topup.credits} credits kostar {data.topup.pris} kr och faktureras separat. Du betalar inget här.
        </p>
        {data.pending ? (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            <Check className="h-4 w-4" /> Din påfyllning är beställd och aktiveras inom kort.
          </div>
        ) : (
          <button
            onClick={bestall}
            disabled={bestaller}
            className="mt-3 inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
            style={{ background: primaryColor }}
          >
            {bestaller ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Beställ {data.topup.credits} credits
          </button>
        )}
        {kvitto && !data.pending && <p className="mt-2 text-sm text-emerald-700">{kvitto}</p>}
      </section>

      {/* Historik — vad som hänt med kvoten den här månaden. */}
      <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
        <h2 className="border-b border-gray-100 px-5 py-3.5 font-display text-lg font-semibold text-gray-900">Den här månaden</h2>
        {data.historik.length === 0 ? (
          <p className="px-5 py-6 text-sm text-gray-500">Inget har hänt med kvoten än den här månaden.</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {data.historik.map((h, i) => (
              <li key={i} className="flex items-center gap-3 px-5 py-3 text-sm">
                <span className="w-24 shrink-0 text-gray-500">{datum(h.created_at)}</span>
                <span className="text-gray-800">
                  {TYP_TEXT[h.type] || h.type}
                  {h.type === "usage" && h.note ? ` ${ATGARD_TEXT[h.note] || h.note}` : ""}
                </span>
                <span className={`ml-auto tabular-nums font-medium ${h.delta < 0 ? "text-gray-600" : "text-emerald-600"}`}>
                  {h.delta > 0 ? `+${h.delta}` : h.delta}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {fel && <p className="text-sm text-red-600">{fel}</p>}
    </div>
  );
}
