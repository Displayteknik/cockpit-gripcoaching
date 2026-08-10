"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Image as ImageIcon, Film, Check, Type } from "lucide-react";
import { TokenKort } from "@/components/TokenMatare";

// ETAPP K2-2, omgjord i BETAL-1 (B-1).
//
// Regler i den här vyn: inga kronor för förbrukningen, inga interna ord, ingen jargong.
// Kundvänt heter det TOKENS. Varningarna går vid 80, 95 och 100 procent använt och bor
// i TokenKort, så kort, sidomeny och mobilhuvud alltid säger samma sak.
//
// En 55-årig terapeut ska förstå varje ord här.

interface Historikrad { created_at: string; delta: number; type: string; note: string | null }
interface Data {
  saldo: number; kvot: number; extra: number; anvant: number; procentKvar: number;
  periodStart: string; forbrukning: string;
  antal: Record<string, number>; priser: Record<string, number>;
  historik: Historikrad[];
  pending: { id: string; credits: number; created_at: string } | null;
  topup: { credits: number; pris: number; direktkop: boolean };
}

const TYP_TEXT: Record<string, string> = {
  monthly_reset: "Ny månad, tokens förnyade",
  usage: "Skapat",
  topup: "Påfyllning tillagd",
  manual_grant: "Extra tokens från din rådgivare",
};

const ATGARD_TEXT: Record<string, string> = {
  "social-bild": "en bild till ett inlägg",
  "hero-bild": "en stor bild",
  video: "en video",
};

const datum = (s: string) => new Date(s).toLocaleDateString("sv-SE", { day: "numeric", month: "long" });

export default function CreditsVy({ primaryColor }: { primaryColor: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [fel, setFel] = useState("");
  const [laddar, setLaddar] = useState(true);
  const [koper, setKoper] = useState(false);
  const [kvitto, setKvitto] = useState("");

  const hamta = useCallback(async () => {
    try {
      const r = await fetch("/api/k/credits");
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Kunde inte hämta dina tokens");
      setData(j);
      setFel("");
    } catch (e) {
      setFel((e as Error).message);
    } finally {
      setLaddar(false);
    }
  }, []);

  useEffect(() => { hamta(); }, [hamta]);

  async function fyllPa() {
    setKoper(true);
    setFel("");
    try {
      const r = await fetch("/api/k/credits", { method: "POST" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.besked || j.error || "Påfyllningen gick inte fram");
      // Stripe-vägen: vi skickar kunden vidare till betalningen.
      if (j.url) { window.location.href = j.url; return; }
      setKvitto(j.besked);
      await hamta();
    } catch (e) {
      setFel((e as Error).message);
    } finally {
      setKoper(false);
    }
  }

  if (laddar) {
    return <div className="flex items-center gap-2 text-sm text-gray-500 py-8"><Loader2 className="w-4 h-4 animate-spin" /> Hämtar dina tokens…</div>;
  }
  if (fel && !data) {
    return <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{fel}</div>;
  }
  if (!data) return null;

  const tak = data.kvot + data.extra;

  return (
    <div className="space-y-5 max-w-3xl">
      <TokenKort
        tokens={{ anvant: data.anvant, tak }}
        primaryColor={primaryColor}
        onFyllPa={data.pending ? undefined : fyllPa}
        laddar={koper}
      />

      {data.pending && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-700">
          <Check className="h-4 w-4 flex-shrink-0" /> Din påfyllning är beställd och aktiveras inom kort.
        </div>
      )}
      {kvitto && !data.pending && (
        <p className="text-sm text-emerald-700">{kvitto}</p>
      )}

      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="font-display text-lg font-semibold text-gray-900">Du har skapat</h2>
        <p className="mt-1 text-sm text-gray-700">
          <strong>{data.forbrukning}</strong> den här månaden.
        </p>
      </section>

      {/* Vad saker kostar — i tokens, aldrig i kronor. */}
      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="font-display text-lg font-semibold text-gray-900">Vad kostar vad?</h2>
        <ul className="mt-4 space-y-3 text-sm text-gray-700">
          <Prisrad ikon={<ImageIcon className="h-4 w-4" />} text="En bild till ett inlägg" tokens={data.priser["social-bild"]} />
          <Prisrad ikon={<ImageIcon className="h-4 w-4" />} text="En stor bild till webb eller blogg" tokens={data.priser["hero-bild"]} />
          <Prisrad ikon={<Film className="h-4 w-4" />} text="Video, per påbörjade fem sekunder" tokens={data.priser.video} />
          <li className="flex items-center gap-3 border-t border-gray-50 pt-3">
            <span className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
              <Type className="h-4 w-4 text-emerald-600" />
            </span>
            <span>Texter, rubriker och förslag</span>
            <span className="ml-auto font-semibold text-emerald-600">Obegränsat</span>
          </li>
        </ul>
        {data.topup.direktkop && (
          <p className="mt-4 text-xs text-gray-500">
            {data.topup.credits} extra tokens kostar {data.topup.pris} kr och läggs till direkt när betalningen är klar.
          </p>
        )}
      </section>

      {/* Historik — vad som hänt den här månaden. */}
      <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <h2 className="border-b border-gray-100 px-6 py-4 font-display text-lg font-semibold text-gray-900">Den här månaden</h2>
        {data.historik.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-gray-400">
            Inget har hänt än den här månaden. Skapa din första bild i Innehållsstudion.
          </p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {data.historik.map((h, i) => (
              <li key={i} className="flex items-center gap-3 px-6 py-3 text-sm">
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

function Prisrad({ ikon, text, tokens }: { ikon: React.ReactNode; text: string; tokens: number }) {
  return (
    <li className="flex items-center gap-3">
      <span className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 text-gray-500">{ikon}</span>
      <span>{text}</span>
      <span className="ml-auto font-semibold tabular-nums">{tokens} tokens</span>
    </li>
  );
}
