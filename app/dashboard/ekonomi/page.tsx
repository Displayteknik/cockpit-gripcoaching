"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ExternalLink, Loader2, ShieldCheck, Wallet } from "lucide-react";
import { DashHero, LivePill } from "@/components/ui/dash";

// KOSTNAD-2 (HELG-1 DEL 8, 2026-08-21) — saldoskyddet som en egen, fokuserad vy.
// Tunn ovanpå K3-INKÖP:s redan befintliga uträkning (app/api/ekonomi läser byggInkop()),
// ingen ny mätning. Svarar på EN fråga per konto: räcker pengarna, och om inte — vad gör
// jag NU. Fullständig kostnadsanalys, marginal per kund och köp-historik hör hemma i
// /dashboard/kostnader, som denna sida länkar vidare till.

interface Kort {
  provider: string; etikett: string; typ: string;
  saldoBelopp: number | null; saldoValuta: string; saldoKalla: string;
  saldoAlderDagar: number | null; saldoFel: string | null;
  larmniva: "gron" | "gul" | "rod";
  saldolarmniva: "gron" | "varning" | "akut" | null;
  dagarKvar: number | null; manadHittills: number; takt30PerDag: number;
  rekommendationKlartext: string | null;
  vadStannarText: string | null;
  fakturalank: string | null; betalkortSistaFyra: string | null;
}

const NIVA_FARG: Record<string, { bg: string; text: string; kant: string; etikett: string }> = {
  gron: { bg: "bg-emerald-50", text: "text-emerald-700", kant: "border-emerald-200", etikett: "OK" },
  gul: { bg: "bg-amber-50", text: "text-amber-800", kant: "border-amber-200", etikett: "Håll koll" },
  rod: { bg: "bg-red-50", text: "text-red-700", kant: "border-red-200", etikett: "Agera" },
  varning: { bg: "bg-amber-50", text: "text-amber-800", kant: "border-amber-200", etikett: "Varning" },
  akut: { bg: "bg-red-50", text: "text-red-700", kant: "border-red-300", etikett: "Akut" },
};

const kr = (n: number | null) => (n === null ? "—" : `${Math.round(n).toLocaleString("sv-SE")} kr`);

export default function EkonomiPage() {
  const [kort, setKort] = useState<Kort[] | null>(null);
  const [manuella, setManuella] = useState<{ text: string; lank: string }[]>([]);
  const [laddar, setLaddar] = useState(true);
  const [fel, setFel] = useState("");

  const hamta = useCallback(async () => {
    setLaddar(true);
    try {
      const r = await fetch("/api/ekonomi");
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Kunde inte hämta saldoläget");
      setKort(j.kort);
      setManuella(j.manuellaKontroller || []);
      setFel("");
    } catch (e) {
      setFel((e as Error).message);
    } finally {
      setLaddar(false);
    }
  }, []);

  useEffect(() => { hamta(); }, [hamta]);

  const varstaNiva = (k: Kort) => (k.saldolarmniva && k.saldolarmniva !== "gron" ? k.saldolarmniva : k.larmniva);

  return (
    <div className="space-y-6">
      <DashHero
        title="Ekonomi"
        subtitle="Saldoskyddet — räcker pengarna hos varje leverantör, och vad gör du om de inte gör det. Fullständig kostnadsanalys och marginal per kund ligger i Kostnader."
        icon={ShieldCheck}
        eyebrow={<LivePill label="live" />}
      />

      {fel && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{fel}</div>
      )}

      {laddar && !kort ? (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-8">
          <Loader2 className="w-4 h-4 animate-spin" /> Hämtar saldon…
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(kort || []).map((k) => {
              const niva = varstaNiva(k);
              const f = NIVA_FARG[niva] || NIVA_FARG.gron;
              return (
                <section key={k.provider} className={`rounded-2xl border ${f.kant} bg-white p-5 shadow-sm`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${f.bg}`}>
                        <Wallet className={`w-[18px] h-[18px] ${f.text}`} />
                      </span>
                      <div>
                        <div className="font-semibold text-gray-900">{k.etikett}</div>
                        <div className="text-xs text-gray-500">{k.typ === "forbetalt" ? "Förbetalt konto" : "Faktura i efterhand"}</div>
                      </div>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${f.bg} ${f.text}`}>{f.etikett}</span>
                  </div>

                  <div className="mt-4">
                    {k.saldoKalla === "api" ? (
                      <div className="font-display text-3xl font-bold text-gray-900 tabular-nums">
                        {k.saldoBelopp === null ? "—" : `${Math.round(k.saldoBelopp).toLocaleString("sv-SE")} ${k.saldoValuta}`}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">Manuellt inlagt saldo{k.saldoAlderDagar !== null ? `, ${k.saldoAlderDagar} dagar gammalt` : ""}</div>
                    )}
                    {k.saldoFel && (
                      <p className="mt-1.5 flex items-center gap-1 text-xs text-red-600">
                        <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" /> Kunde inte hämta saldot: {k.saldoFel}
                      </p>
                    )}
                  </div>

                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-xs text-gray-400">Räcker</dt>
                      <dd className="font-medium text-gray-900 tabular-nums">
                        {k.typ === "efterskott" ? "gäller inte" : k.dagarKvar === null ? "går inte att räkna" : `${Math.floor(k.dagarKvar)} dagar`}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-400">Senaste 30 dagar</dt>
                      <dd className="font-medium text-gray-900 tabular-nums">{kr(k.manadHittills)}</dd>
                    </div>
                  </dl>

                  {/* DEL 8: "vad stannar om X tar slut" — den konkreta konsekvensen, inte bara ett saldo */}
                  {k.vadStannarText && (
                    <p className={`mt-4 rounded-xl border ${f.kant} ${f.bg} px-3 py-2.5 text-sm ${f.text}`}>
                      {k.vadStannarText}
                    </p>
                  )}
                  {!k.vadStannarText && k.rekommendationKlartext && (
                    <p className="mt-4 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5 text-sm text-gray-700">
                      {k.rekommendationKlartext}
                    </p>
                  )}

                  <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                    {k.fakturalank && (
                      <a href={k.fakturalank} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-medium text-gray-700 hover:text-gray-900">
                        Betalsida <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                    {k.betalkortSistaFyra && <span className="text-xs text-gray-500">kort som slutar på {k.betalkortSistaFyra}</span>}
                  </div>
                </section>
              );
            })}
          </div>

          {manuella.length > 0 && (
            <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
              <h2 className="font-display text-lg font-semibold text-gray-900">Kontrollera manuellt</h2>
              <p className="mt-1 text-sm text-gray-500">Sådant inget API kan bekräfta eller slå på åt dig.</p>
              <ul className="mt-3 space-y-2">
                {manuella.map((m, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-2.5 text-sm">
                    <span className="text-gray-700">{m.text}</span>
                    <a href={m.lank} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-gray-600 hover:text-gray-900 flex-shrink-0">
                      Öppna <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <a href="/dashboard/kostnader" className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900">
            Full kostnadsanalys och marginal per kund <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </>
      )}
    </div>
  );
}
