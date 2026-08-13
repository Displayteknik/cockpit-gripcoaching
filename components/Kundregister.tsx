"use client";

// KUNDREGISTER-1 — läsande kundlista ur MySales. Delad av kundvyn och byråvyn.
//
// Cockpit LÄSER. Varje rad har en knapp till MySales, för det är där man ändrar.
//
// ⚠ Tre lägen hålls isär, och det är hela poängen med vyn:
//     HAR DATA   — listan, med sin ålder utskriven
//     TOMT       — "inga kontakter i MySales än", ett svar
//     FEL        — vad som gick fel och vad man gör åt det, ALDRIG en tom lista
//   En tom lista som egentligen är ett behörighetsfel säger "du har inga kunder", och det
//   är en lögn. Samma regel som G-9: visa aldrig en nolla som ett mätvärde.

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ExternalLink, Loader2, MessageSquare, RefreshCw, Search, Users } from "lucide-react";

interface Kontakt {
  id: string;
  namn: string;
  foretag: string;
  epost: string;
  telefon: string;
  taggar: string[];
  kalla: string;
  senastAktivitet: string | null;
  mysalesUrl: string | null;
  dmKortId: string | null;
}

interface Svar {
  kontakter: Kontakt[] | null;
  taggar: { namn: string; antal: number }[];
  totalt: number;
  visade: number;
  avkortad: boolean;
  synkad: string | null;
  farskhet?: { niva: string; text: string };
  fel: string | null;
  error?: string;
}

export default function Kundregister({ dmBasHref }: { dmBasHref: string }) {
  const [data, setData] = useState<Svar | null>(null);
  const [laddar, setLaddar] = useState(true);
  const [synkar, setSynkar] = useState(false);
  const [q, setQ] = useState("");
  const [tagg, setTagg] = useState("");
  const [tekniskFel, setTekniskFel] = useState<string | null>(null);

  const hamta = useCallback(async () => {
    setLaddar(true);
    setTekniskFel(null);
    try {
      const p = new URLSearchParams();
      if (q.trim()) p.set("q", q.trim());
      if (tagg) p.set("tagg", tagg);
      const r = await fetch(`/api/kundregister?${p.toString()}`);
      const d: Svar = await r.json();
      if (!r.ok) {
        setTekniskFel(d.error || "Kundlistan kunde inte läsas.");
        setData(null);
      } else {
        setData(d);
      }
    } catch (e) {
      setTekniskFel((e as Error).message);
      setData(null);
    } finally {
      setLaddar(false);
    }
  }, [q, tagg]);

  // Sökningen väntar in att man slutat skriva. Utan pausen går ett anrop per tangent.
  useEffect(() => {
    const t = setTimeout(hamta, q ? 350 : 0);
    return () => clearTimeout(t);
  }, [hamta, q]);

  const synkaNu = useCallback(async () => {
    setSynkar(true);
    try {
      await fetch("/api/kundregister", { method: "POST" });
      await hamta();
    } finally {
      setSynkar(false);
    }
  }, [hamta]);

  const kontakter = data?.kontakter ?? [];
  const alderText = useMemo(() => {
    if (!data) return "";
    if (!data.synkad) return "Aldrig hämtad";
    return data.farskhet?.text ? `Hämtad ${data.farskhet.text}` : "Hämtad nyligen";
  }, [data]);

  return (
    <div className="space-y-4">
      {/* Hjälm: vad listan är, hur färsk den är, och knappen att hämta om */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
              <Users className="w-5 h-5 text-emerald-600" />
            </span>
            <div>
              <h2 className="font-semibold text-gray-900">Dina kunder</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Hämtade från MySales. Du ändrar uppgifterna där — här ser du dem samlade.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-sm ${data?.farskhet?.niva === "gammal" || !data?.synkad ? "text-amber-700" : "text-gray-500"}`}>
              {alderText}
            </span>
            <button
              onClick={synkaNu}
              disabled={synkar || laddar}
              className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40"
            >
              {synkar ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Hämta nu
            </button>
          </div>
        </div>

        {/* Felet från MySales — i klartext, med vad man gör åt det. Listan under kan
            fortfarande visa äldre data, och då står åldern kvar ovanför. */}
        {(data?.fel || tekniskFel) && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{tekniskFel || data?.fel}</span>
          </div>
        )}
      </div>

      {/* Sök + taggfilter */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Sök på namn, företag, e-post eller telefon"
            className="w-full rounded-lg border border-gray-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-100"
          />
        </div>
        {(data?.taggar.length ?? 0) > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setTagg("")}
              className={`text-sm px-2.5 py-1 rounded-lg border ${!tagg ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}
            >
              Alla
            </button>
            {data!.taggar.map((t) => (
              <button
                key={t.namn}
                onClick={() => setTagg(tagg === t.namn ? "" : t.namn)}
                className={`text-sm px-2.5 py-1 rounded-lg border ${tagg === t.namn ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}
              >
                {t.namn} <span className="opacity-60">{t.antal}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Listan */}
      {laddar && !data ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center text-sm text-gray-500 shadow-sm">
          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-gray-400" />
          Hämtar dina kunder…
        </div>
      ) : kontakter.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center shadow-sm">
          <p className="text-sm text-gray-600">
            {/* Tre olika tomma lägen, tre olika besked. Att slå ihop dem gör att ett
                behörighetsfel ser ut som ett tomt register. */}
            {data?.fel
              ? "Listan kunde inte hämtas den här gången — se meddelandet ovan."
              : q || tagg
                ? "Ingen kund matchar det du sökte på."
                : "Inga kontakter i MySales än. De som läggs upp där dyker upp här."}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100 text-sm text-gray-500">
            {data!.visade} av {data!.totalt} {data!.totalt === 1 ? "kund" : "kunder"}
            {/* Avkortningen skrivs ut. En tyst gräns läses som "det här är alla". */}
            {data!.avkortad && " · visar de senast aktiva"}
          </div>
          <ul className="divide-y divide-gray-100">
            {kontakter.map((k) => (
              <li key={k.id} className="px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2 hover:bg-gray-50/60">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 text-sm">
                      {k.namn || <span className="text-gray-400 font-normal">Namn saknas i MySales</span>}
                    </span>
                    {k.foretag && <span className="text-sm text-gray-500">{k.foretag}</span>}
                  </div>
                  <div className="flex items-center gap-x-3 gap-y-1 flex-wrap mt-1 text-sm text-gray-500">
                    {k.epost && <span>{k.epost}</span>}
                    {k.telefon && <span>{k.telefon}</span>}
                    {k.kalla && <span className="text-gray-400">via {k.kalla}</span>}
                  </div>
                  {k.taggar.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {k.taggar.map((t) => (
                        <span key={t} className="text-sm px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {k.senastAktivitet && (
                    <span className="text-sm text-gray-400">
                      {new Date(k.senastAktivitet).toLocaleDateString("sv-SE")}
                    </span>
                  )}
                  {/* Kopplingen till DM & Pipeline visas bara när kortet FINNS. En knapp
                      som leder till ett kort som inte finns är värre än ingen knapp. */}
                  {k.dmKortId && (
                    <a
                      href={dmBasHref}
                      className="inline-flex items-center gap-1 text-sm font-semibold px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
                      title="Den här kunden har ett kort i DM och pipeline"
                    >
                      <MessageSquare className="w-3.5 h-3.5" /> I pipeline
                    </a>
                  )}
                  {k.mysalesUrl && (
                    <a
                      href={k.mysalesUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm font-semibold px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
                    >
                      Öppna i MySales <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
