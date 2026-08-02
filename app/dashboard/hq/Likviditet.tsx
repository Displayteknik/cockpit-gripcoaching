"use client";

import { useState } from "react";
import { AlertTriangle, Banknote, CheckCircle2, PiggyBank, Trash2, TrendingDown } from "lucide-react";

// LIKVID-1 — likviditetsvyn i Founder HQ.
//
// Ingen bankkoppling, ingen automatisk moms eller skatt. Ägaren lägger in banksaldot och
// de betalningar han känner till, resten kommer ur affärerna, intäktsraderna och de fasta
// kostnaderna som redan finns i HQ. Räkningen sker i lib/hq/likviditet.ts och är testad
// mot ett handräknat exempel.

export interface PrognosVecka {
  index: number;
  start: string;
  slut: string;
  veckonummer: number;
  ingaende: number;
  in: number;
  ut: number;
  utgaende: number;
  rader: { titel: string; belopp: number }[];
}

export interface SaldoRad {
  id: string;
  bolag: string;
  saldo: number;
  datum: string;
  notering: string | null;
}

export interface CashRad {
  id: string;
  bolag: string;
  titel: string;
  belopp: number;
  datum: string;
  typ: string;
  status: string;
  notering: string | null;
}

export interface Likviditet {
  bolag: "grip" | "dt";
  saknarSaldo: boolean;
  startSaldo: number;
  saldoDatum: string | null;
  veckor: PrognosVecka[];
  lagsta: { belopp: number; veckonummer: number; start: string };
  brytVecka: { veckonummer: number; start: string; belopp: number } | null;
  trafikljus: "gron" | "gul" | "rod" | "okand";
  klartext: string;
  ejDaterade: { summa: number; antal: number };
  senareVarning: { veckonummer: number; start: string; belopp: number } | null;
  buffertmal: number;
  gulGransVeckor: number;
  konfig: { bolag: string; buffertmal: number; gul_grans_veckor: number; usd_kurs: number; notering: string | null };
  fastaSek: number;
  fastaUtanKurs: { valuta: string; summa: number }[];
  saldoHistorik: SaldoRad[];
}

const BOLAGSNAMN: Record<string, string> = { grip: "GripCoaching", dt: "Displayteknik" };
const TYPNAMN: Record<string, string> = {
  leverantorsbetalning: "Leverantörsbetalning",
  moms: "Moms",
  skatt: "Skatt",
  inkasso: "Inkasso",
  lan: "Lån",
  ovrigt: "Övrigt",
};

const kr = (n: number) => `${Math.round(n).toLocaleString("sv-SE")} kr`;

const LJUS = {
  gron: { text: "Grönt läge", klass: "bg-emerald-100 text-emerald-800", prick: "bg-emerald-500" },
  gul: { text: "Gult läge", klass: "bg-amber-100 text-amber-900", prick: "bg-amber-500" },
  rod: { text: "Rött läge", klass: "bg-red-100 text-red-800", prick: "bg-red-500" },
  okand: { text: "Går inte att räkna", klass: "bg-gray-100 text-gray-600", prick: "bg-gray-400" },
} as const;

/** Enkel kurva över utgående saldo. Nollinjen och buffertmålet ritas ut, så läget syns. */
function Kurva({ veckor, buffertmal }: { veckor: PrognosVecka[]; buffertmal: number }) {
  const B = 320;
  const H = 100;
  const varden = veckor.map((v) => v.utgaende);
  const max = Math.max(...varden, buffertmal, 0);
  const min = Math.min(...varden, 0);
  const spann = max - min || 1;
  const y = (n: number) => H - ((n - min) / spann) * H;
  const x = (i: number) => (veckor.length === 1 ? B / 2 : (i / (veckor.length - 1)) * B);
  const linje = varden.map((n, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(n).toFixed(1)}`).join(" ");
  const yta = `${linje} L${B},${H} L0,${H} Z`;
  const lagstIndex = varden.indexOf(Math.min(...varden));

  return (
    <svg viewBox={`0 0 ${B} ${H}`} className="h-28 w-full" role="img" aria-label="Utgående saldo per vecka">
      <defs>
        <linearGradient id="likvidYta" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
        </linearGradient>
      </defs>
      {buffertmal > 0 && buffertmal >= min && buffertmal <= max && (
        <line x1="0" y1={y(buffertmal)} x2={B} y2={y(buffertmal)} stroke="#f59e0b" strokeWidth="1" strokeDasharray="4 3" />
      )}
      {min < 0 && <line x1="0" y1={y(0)} x2={B} y2={y(0)} stroke="#ef4444" strokeWidth="1" />}
      <path d={yta} fill="url(#likvidYta)" />
      <path d={linje} fill="none" stroke="#4f46e5" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(lagstIndex)} cy={y(varden[lagstIndex])} r="3.5" fill="#4f46e5" />
    </svg>
  );
}

export default function Likviditet({
  likviditet,
  cash,
  sparar,
  skicka,
  taBort,
}: {
  likviditet: Likviditet[];
  cash: CashRad[];
  sparar: boolean;
  skicka: (metod: "POST" | "PATCH", kropp: Record<string, unknown>) => Promise<void>;
  taBort: (typ: string, id: string) => Promise<void>;
}) {
  const [oppen, setOppen] = useState<string | null>(null);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-xl font-semibold text-gray-900">Likviditet, tolv veckor framåt</h2>
        <span className="text-sm text-gray-500">
          Ingen bankkoppling. Moms och skatt lägger du in själv som poster, det är ärligare än en schablon.
        </span>
      </div>

      {likviditet.map((l) => (
        <BolagsKort
          key={l.bolag}
          l={l}
          cash={cash.filter((c) => c.bolag === l.bolag)}
          sparar={sparar}
          skicka={skicka}
          taBort={taBort}
          oppen={oppen === l.bolag}
          setOppen={(v) => setOppen(v ? l.bolag : null)}
        />
      ))}
    </section>
  );
}

function BolagsKort({
  l,
  cash,
  sparar,
  skicka,
  taBort,
  oppen,
  setOppen,
}: {
  l: Likviditet;
  cash: CashRad[];
  sparar: boolean;
  skicka: (metod: "POST" | "PATCH", kropp: Record<string, unknown>) => Promise<void>;
  taBort: (typ: string, id: string) => Promise<void>;
  oppen: boolean;
  setOppen: (v: boolean) => void;
}) {
  const [nyttSaldo, setNyttSaldo] = useState({ saldo: "", datum: "", notering: "" });
  const [nyPost, setNyPost] = useState({ titel: "", belopp: "", datum: "", typ_post: "ovrigt", status: "planerad" });
  const [konfUtkast, setKonfUtkast] = useState<Record<string, string>>({});
  const [raderar, setRaderar] = useState<string | null>(null);

  const ljus = LJUS[l.trafikljus];
  const konfVarde = (falt: "buffertmal" | "gul_grans_veckor" | "usd_kurs") =>
    konfUtkast[falt] ?? String(l.konfig[falt]);
  const konfAndrad = (falt: "buffertmal" | "gul_grans_veckor" | "usd_kurs") =>
    konfVarde(falt) !== String(l.konfig[falt]);

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-5 py-3.5">
        <h3 className="font-display text-lg font-semibold text-gray-900">{BOLAGSNAMN[l.bolag]}</h3>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${ljus.klass}`}>
          <span className={`h-2 w-2 rounded-full ${ljus.prick}`} /> {ljus.text}
        </span>
        {l.saldoDatum && (
          <span className="text-sm text-gray-500">
            Utgår från {kr(l.startSaldo)} avläst {l.saldoDatum}
          </span>
        )}
        <button
          onClick={() => setOppen(!oppen)}
          className="ml-auto rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          {oppen ? "Dölj veckorna" : "Visa veckorna"}
        </button>
      </div>

      {l.saknarSaldo ? (
        <div className="flex items-start gap-3 px-5 py-5">
          <PiggyBank className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" />
          <p className="text-sm text-gray-600">
            Inget banksaldo är inlagt för {BOLAGSNAMN[l.bolag]}, så prognosen går inte att räkna. Lägg in saldot längst
            ner i det här kortet, så räknas de tolv veckorna direkt. Ingen siffra gissas fram.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 px-5 py-4 sm:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Lägsta läge</p>
              <p className={`font-display text-2xl font-bold tabular-nums ${l.lagsta.belopp < 0 ? "text-red-600" : "text-gray-900"}`}>
                {kr(l.lagsta.belopp)}
              </p>
              <p className="text-sm text-gray-500">vecka {l.lagsta.veckonummer}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Buffertmål</p>
              <p className="font-display text-2xl font-bold tabular-nums text-gray-900">{kr(l.buffertmal)}</p>
              <p className="text-sm text-gray-500">larmgräns {l.gulGransVeckor} veckor</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Ej daterade affärer</p>
              <p className="font-display text-2xl font-bold tabular-nums text-gray-900">{kr(l.ejDaterade.summa)}</p>
              <p className="text-sm text-gray-500">
                {l.ejDaterade.antal} {l.ejDaterade.antal === 1 ? "affär" : "affärer"} utan förväntat betaldatum, räknas
                inte in
              </p>
            </div>
          </div>

          <div className="px-5">
            <Kurva veckor={l.veckor} buffertmal={l.buffertmal} />
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm">
            <span className={l.trafikljus === "gron" ? "text-emerald-700" : l.trafikljus === "gul" ? "text-amber-700" : "text-red-700"}>
              {l.trafikljus === "gron" ? (
                <CheckCircle2 className="mr-1 inline h-4 w-4" />
              ) : (
                <AlertTriangle className="mr-1 inline h-4 w-4" />
              )}
              {l.klartext}
            </span>
            {l.senareVarning && (
              <span className="text-gray-500">
                Under buffertmålet först vecka {l.senareVarning.veckonummer}, alltså utanför larmgränsen.
              </span>
            )}
          </div>

          {oppen && (
            <div className="overflow-x-auto border-t border-gray-100">
              <table className="w-full min-w-[36rem] text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-5 py-2.5 font-medium">Vecka</th>
                    <th className="px-3 py-2.5 font-medium">Från</th>
                    <th className="px-3 py-2.5 text-right font-medium">Ingående</th>
                    <th className="px-3 py-2.5 text-right font-medium">In</th>
                    <th className="px-3 py-2.5 text-right font-medium">Ut</th>
                    <th className="px-5 py-2.5 text-right font-medium">Utgående</th>
                  </tr>
                </thead>
                <tbody>
                  {l.veckor.map((v) => (
                    <tr key={v.start} className="border-b border-gray-50 last:border-0">
                      <td className="px-5 py-2 font-medium tabular-nums text-gray-900">v{v.veckonummer}</td>
                      <td className="px-3 py-2 tabular-nums text-gray-500">{v.start}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-500">{kr(v.ingaende)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-emerald-700">{v.in ? kr(v.in) : ""}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-700">{v.ut ? kr(v.ut) : ""}</td>
                      <td
                        className={`px-5 py-2 text-right font-medium tabular-nums ${
                          v.utgaende < 0 ? "text-red-600" : v.utgaende < l.buffertmal ? "text-amber-700" : "text-gray-900"
                        }`}
                      >
                        {kr(v.utgaende)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Omräkningen står här oavsett om prognosen går att räkna. Kursen ska aldrig
          vara gömd bakom att ett banksaldo saknas. */}
      <p className="border-t border-gray-50 px-5 py-2.5 text-xs text-gray-500">
        Fasta kostnader i prognosen: {kr(l.fastaSek)} per månad. USD räknas om med kursen {l.konfig.usd_kurs} kronor per
        dollar.
        {l.fastaUtanKurs.length > 0 && (
          <span className="ml-1 font-medium text-amber-700">
            {l.fastaUtanKurs.map((v) => `${v.summa} ${v.valuta}`).join(", ")} räknas inte in, ingen kurs är inlagd för
            den valutan.
          </span>
        )}
      </p>

      {/* ── Banksaldo ────────────────────────────────────────────────────── */}
      <div className="border-t border-gray-100 bg-gray-50 px-5 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700">
            <Banknote className="h-4 w-4 text-gray-400" /> Nytt banksaldo
          </span>
          <input
            type="number"
            step="0.01"
            value={nyttSaldo.saldo}
            onChange={(e) => setNyttSaldo({ ...nyttSaldo, saldo: e.target.value })}
            placeholder="kronor på kontot"
            className="w-36 rounded-lg border border-gray-200 px-2 py-1.5 text-sm tabular-nums"
          />
          <input
            type="date"
            value={nyttSaldo.datum}
            onChange={(e) => setNyttSaldo({ ...nyttSaldo, datum: e.target.value })}
            className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
          />
          <input
            value={nyttSaldo.notering}
            onChange={(e) => setNyttSaldo({ ...nyttSaldo, notering: e.target.value })}
            placeholder="Notering"
            className="w-40 rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
          />
          <button
            onClick={async () => {
              await skicka("POST", { typ: "saldo", bolag: l.bolag, ...nyttSaldo });
              setNyttSaldo({ saldo: "", datum: "", notering: "" });
            }}
            disabled={sparar || nyttSaldo.saldo === "" || !nyttSaldo.datum}
            className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
          >
            Spara saldot
          </button>
        </div>
        {l.saldoHistorik.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
            {l.saldoHistorik.map((s, i) => (
              <li key={s.id} className="tabular-nums">
                {s.datum}: {kr(s.saldo)}
                {i === 0 && <span className="ml-1 font-medium text-gray-700">(gäller nu)</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Kända in- och utbetalningar ──────────────────────────────────── */}
      <div className="border-t border-gray-100">
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-3">
          <h4 className="font-medium text-gray-800">Kända in- och utbetalningar</h4>
          <span className="text-xs text-gray-500">
            Skriv beloppet med minus för pengar ut. Moms och skatt läggs in här.
          </span>
        </div>
        {cash.length > 0 && (
          <ul className="divide-y divide-gray-50 border-t border-gray-50">
            {cash.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5 text-sm">
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{TYPNAMN[c.typ]}</span>
                <span className="font-medium text-gray-900">{c.titel}</span>
                <span className="tabular-nums text-gray-500">{c.datum}</span>
                <button
                  onClick={() => skicka("PATCH", { typ: "cash", id: c.id, status: c.status === "klar" ? "planerad" : "klar" })}
                  disabled={sparar}
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    c.status === "klar" ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {c.status === "klar" ? "Klar" : "Planerad"}
                </button>
                <span className={`ml-auto tabular-nums ${c.belopp < 0 ? "text-red-600" : "text-emerald-700"}`}>
                  {kr(c.belopp)}
                </span>
                {raderar === c.id ? (
                  <span className="inline-flex items-center gap-2 text-xs">
                    <button
                      onClick={() => taBort("cash", c.id)}
                      disabled={sparar}
                      className="rounded-lg bg-red-600 px-2 py-1 font-medium text-white disabled:opacity-50"
                    >
                      Ja, ta bort
                    </button>
                    <button onClick={() => setRaderar(null)} className="text-gray-500 underline">
                      Avbryt
                    </button>
                  </span>
                ) : (
                  <button onClick={() => setRaderar(c.id)} aria-label={`Ta bort ${c.titel}`} className="text-gray-400 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-center gap-2 border-t border-gray-50 bg-gray-50 px-5 py-3">
          <input
            value={nyPost.titel}
            onChange={(e) => setNyPost({ ...nyPost, titel: e.target.value })}
            placeholder="Vad gäller det?"
            className="min-w-44 flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm"
          />
          <input
            type="number"
            step="0.01"
            value={nyPost.belopp}
            onChange={(e) => setNyPost({ ...nyPost, belopp: e.target.value })}
            placeholder="belopp"
            className="w-32 rounded-lg border border-gray-200 px-2 py-1.5 text-sm tabular-nums"
          />
          <input
            type="date"
            value={nyPost.datum}
            onChange={(e) => setNyPost({ ...nyPost, datum: e.target.value })}
            className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
          />
          <select
            value={nyPost.typ_post}
            onChange={(e) => setNyPost({ ...nyPost, typ_post: e.target.value })}
            className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
          >
            {Object.entries(TYPNAMN).map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
          <button
            onClick={async () => {
              await skicka("POST", { typ: "cash", bolag: l.bolag, ...nyPost });
              setNyPost({ titel: "", belopp: "", datum: "", typ_post: "ovrigt", status: "planerad" });
            }}
            disabled={sparar || !nyPost.titel.trim() || nyPost.belopp === "" || !nyPost.datum}
            className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
          >
            Lägg till
          </button>
        </div>
      </div>

      {/* ── Inställningar ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 px-5 py-3 text-sm">
        <span className="inline-flex items-center gap-1.5 font-medium text-gray-700">
          <TrendingDown className="h-4 w-4 text-gray-400" /> Inställningar
        </span>
        <label className="flex items-center gap-1.5 text-gray-600">
          Buffertmål
          <input
            type="number"
            min={0}
            value={konfVarde("buffertmal")}
            onChange={(e) => setKonfUtkast({ ...konfUtkast, buffertmal: e.target.value })}
            className="w-28 rounded-lg border border-gray-200 px-2 py-1 text-right tabular-nums"
          />
        </label>
        <label className="flex items-center gap-1.5 text-gray-600">
          Larmgräns i veckor
          <input
            type="number"
            min={1}
            max={12}
            value={konfVarde("gul_grans_veckor")}
            onChange={(e) => setKonfUtkast({ ...konfUtkast, gul_grans_veckor: e.target.value })}
            className="w-16 rounded-lg border border-gray-200 px-2 py-1 text-right tabular-nums"
          />
        </label>
        <label className="flex items-center gap-1.5 text-gray-600">
          Dollarkurs
          <input
            type="number"
            min={0}
            step="0.01"
            value={konfVarde("usd_kurs")}
            onChange={(e) => setKonfUtkast({ ...konfUtkast, usd_kurs: e.target.value })}
            className="w-20 rounded-lg border border-gray-200 px-2 py-1 text-right tabular-nums"
          />
        </label>
        {(konfAndrad("buffertmal") || konfAndrad("gul_grans_veckor") || konfAndrad("usd_kurs")) && (
          <button
            onClick={async () => {
              await skicka("PATCH", {
                typ: "konfig",
                bolag: l.bolag,
                buffertmal: Number(konfVarde("buffertmal")),
                gul_grans_veckor: Number(konfVarde("gul_grans_veckor")),
                usd_kurs: Number(konfVarde("usd_kurs")),
              });
              setKonfUtkast({});
            }}
            disabled={sparar}
            className="rounded-lg bg-gray-900 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
          >
            Spara
          </button>
        )}
      </div>
    </div>
  );
}
