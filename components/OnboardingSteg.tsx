"use client";

// ONBOARD-7 — onboardingen som stegverktyg.
//
// Målet: öppna en kund och på fem sekunder se var hon står och vad nästa handling är.
//
// ★ ETT MANUELLT STEG FÅR ALDRIG SE AUTOMATISKT UT. Ägaren styr färg och rubrik:
//   "Väntar på dig" är bärnsten, "Systemet gör det" är grått. Ett steg som ser
//   automatiskt ut men väntar på en människa blir liggande i veckor.
//
// ★ BLOCKERAT SVARAR ALLTID VARFÖR. En grå knapp utan förklaring läses som ett fel i
//   verktyget, inte som en ordningsföljd.

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle, ArrowLeft, Check, ChevronDown, ChevronRight, Circle,
  Clock, Copy, Loader2, Lock, User, Zap,
} from "lucide-react";

type Agare = "system" | "hakan" | "kund";
type Status = "vantar" | "pagar" | "klart" | "blockerat" | "hoppat";

interface Steg {
  nr: number; nyckel: string; titel: string; agare: Agare;
  beskrivning: string; instruktion?: string; atgard?: string;
  status: Status; blockeratVarfor: string | null; notering: string | null;
}
interface Onboarding {
  id: string; doman: string; url: string; foretag: string | null;
  clientId: string | null; locationId: string | null; skapad: string;
  steg: Steg[]; klaraAntal: number;
  nastaHandling: { nr: number; titel: string; agare: Agare } | null;
}
interface Punkt { namn: string; ok: boolean; detalj: string; manuell?: boolean }

const AGARE: Record<Agare, { text: string; chip: string; ikon: React.ComponentType<{ className?: string }> }> = {
  system: { text: "Systemet gör det", chip: "bg-gray-100 text-gray-600 ring-gray-200/70", ikon: Zap },
  hakan: { text: "Väntar på dig", chip: "bg-amber-50 text-amber-800 ring-amber-200/70", ikon: User },
  kund: { text: "Väntar på kunden", chip: "bg-sky-50 text-sky-700 ring-sky-200/70", ikon: Clock },
};

export default function OnboardingSteg() {
  const [lista, setLista] = useState<Onboarding[] | null>(null);
  const [vald, setVald] = useState<Onboarding | null>(null);
  const [fel, setFel] = useState<string | null>(null);

  const ladda = useCallback(async () => {
    try {
      const r = await fetch("/api/onboarding/steg").then((x) => x.json());
      if (r.error) { setFel(r.error); return; }
      setLista(r.onboardingar ?? []);
    } catch (e) { setFel((e as Error).message); }
  }, []);

  useEffect(() => { ladda(); }, [ladda]);

  if (fel) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-5 text-sm text-rose-900">
        <p className="font-semibold">Kunde inte läsa onboardingarna</p>
        <p className="mt-1">{fel}</p>
      </div>
    );
  }
  if (!lista) return <div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Laddar…</div>;

  if (vald) return <Detalj onboarding={vald} onTillbaka={() => { setVald(null); ladda(); }} onUppdaterad={setVald} />;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-lg font-bold text-gray-900">Pågående onboardingar</h2>
        <p className="text-sm text-gray-500">Var varje kund står och vad nästa handling är.</p>
      </div>
      {!lista.length && (
        <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center text-sm text-gray-500 shadow-sm">
          Ingen onboarding igång än. Klistra in en webbadress ovan för att börja.
        </div>
      )}
      <div className="space-y-3">
        {lista.map((o) => (
          <button
            key={o.id}
            onClick={() => setVald(o)}
            className="flex w-full items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 text-left shadow-sm transition hover:border-gray-200 hover:shadow"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-semibold text-gray-900">{o.foretag || o.doman}</span>
                <span className="truncate text-xs text-gray-400">{o.doman}</span>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-1.5 w-28 overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(o.klaraAntal / 11) * 100}%` }} />
                </div>
                <span className="text-xs tabular-nums text-gray-500">{o.klaraAntal} av 11</span>
              </div>
            </div>
            {o.nastaHandling ? (
              <div className="flex-shrink-0 text-right">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${AGARE[o.nastaHandling.agare].chip}`}>
                  {AGARE[o.nastaHandling.agare].text}
                </span>
                <p className="mt-1 max-w-[13rem] truncate text-xs text-gray-500">
                  {o.nastaHandling.nr}. {o.nastaHandling.titel}
                </p>
              </div>
            ) : (
              <span className="flex-shrink-0 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200/70">Klar</span>
            )}
            <ChevronRight className="h-4 w-4 flex-shrink-0 text-gray-300" />
          </button>
        ))}
      </div>
    </div>
  );
}

function Detalj({ onboarding, onTillbaka, onUppdaterad }: {
  onboarding: Onboarding;
  onTillbaka: () => void;
  onUppdaterad: (o: Onboarding) => void;
}) {
  const [oppet, setOppet] = useState<string | null>(onboarding.nastaHandling ? onboarding.steg.find((s) => s.status === "vantar")?.nyckel ?? null : null);
  const [arbetar, setArbetar] = useState<string | null>(null);
  const [nyckel, setNyckel] = useState("");
  const [nyckelFel, setNyckelFel] = useState<{ text: string; scopes?: string[] } | null>(null);
  const [punkter, setPunkter] = useState<Punkt[] | null>(null);
  const [provSteg, setProvSteg] = useState<{ namn: string; status: string; detalj?: string | null }[] | null>(null);

  async function bocka(s: Steg, status: Status) {
    setArbetar(s.nyckel);
    try {
      const r = await fetch(`/api/onboarding/${onboarding.id}/steg`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nyckel: s.nyckel, status }),
      }).then((x) => x.json());
      if (r.onboarding) onUppdaterad(r.onboarding);
    } finally { setArbetar(null); }
  }

  async function sparaNyckel() {
    setArbetar("kundnyckel"); setNyckelFel(null);
    try {
      const r = await fetch(`/api/onboarding/${onboarding.id}/kundnyckel`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nyckel }),
      }).then((x) => x.json());
      if (r.error) { setNyckelFel({ text: r.error, scopes: r.saknadeScopes }); return; }
      setNyckel("");
      if (r.onboarding) onUppdaterad(r.onboarding);
    } finally { setArbetar(null); }
  }

  // Provisioneringen kör steg 3, 5, 6 och 7 i en följd och är idempotent — den kan därför
  // köras om efter att kundnyckeln lagts in i steg 4, vilket är precis vad som krävs:
  // custom values kan inte skrivas förrän nyckeln finns.
  async function provisionera(torrkorning: boolean) {
    setArbetar("provisionera"); setProvSteg(null);
    try {
      const r = await fetch(`/api/onboarding/${onboarding.id}/provisionera`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ torrkorning }),
      }).then((x) => x.json());
      if (r.error) { setProvSteg([{ namn: "Provisioneringen kunde inte köras", status: "fel", detalj: r.error }]); return; }
      setProvSteg(r.steg ?? r.steps ?? []);
      const uppdaterad = await fetch(`/api/onboarding/${onboarding.id}/steg`).then((x) => x.json());
      if (uppdaterad.onboarding) onUppdaterad(uppdaterad.onboarding);
    } finally { setArbetar(null); }
  }

  async function verifiera() {
    setArbetar("verifiering"); setPunkter(null);
    try {
      const r = await fetch(`/api/onboarding/${onboarding.id}/verifiera`, { method: "POST" }).then((x) => x.json());
      if (r.error) { setPunkter([{ namn: "Verifieringen kunde inte köras", ok: false, detalj: r.error }]); return; }
      setPunkter(r.punkter ?? []);
    } finally { setArbetar(null); }
  }

  const kundlank = onboarding.clientId ? `https://cockpit.gripcoaching.se/k/${onboarding.clientId}` : null;

  return (
    <div className="space-y-4">
      <button onClick={onTillbaka} className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-900">
        <ArrowLeft className="h-4 w-4" /> Alla onboardingar
      </button>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="font-display text-xl font-bold text-gray-900">{onboarding.foretag || onboarding.doman}</h2>
        <p className="text-sm text-gray-500">{onboarding.url}</p>
        <div className="mt-3 flex items-center gap-3">
          <div className="h-2 w-40 overflow-hidden rounded-full bg-gray-100">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(onboarding.klaraAntal / 11) * 100}%` }} />
          </div>
          <span className="text-sm tabular-nums text-gray-600">{onboarding.klaraAntal} av 11 steg klara</span>
        </div>
      </div>

      <div className="space-y-2.5">
        {onboarding.steg.map((s) => {
          const a = AGARE[s.agare];
          const klart = s.status === "klart";
          const blockerat = s.status === "blockerat";
          const upp = oppet === s.nyckel;
          return (
            <div
              key={s.nyckel}
              className={`rounded-2xl border bg-white shadow-sm transition ${
                klart ? "border-emerald-100" : blockerat ? "border-gray-100 opacity-60" : s.agare === "hakan" ? "border-amber-200" : "border-gray-100"
              }`}
            >
              <button
                onClick={() => setOppet(upp ? null : s.nyckel)}
                className="flex w-full items-start gap-3 p-4 text-left"
              >
                <span className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  klart ? "bg-emerald-500 text-white" : blockerat ? "bg-gray-100 text-gray-400" : "bg-gray-900 text-white"
                }`}>
                  {klart ? <Check className="h-3.5 w-3.5" /> : blockerat ? <Lock className="h-3 w-3" /> : s.nr}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`font-semibold ${klart ? "text-gray-500 line-through decoration-gray-300" : "text-gray-900"}`}>{s.titel}</span>
                    {!klart && (
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${a.chip}`}>
                        <a.ikon className="h-3 w-3" /> {a.text}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-gray-500">{s.beskrivning}</p>
                  {blockerat && s.blockeratVarfor && (
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs text-gray-500">
                      <Lock className="h-3 w-3" /> {s.blockeratVarfor}
                    </p>
                  )}
                </div>
                <ChevronDown className={`mt-1 h-4 w-4 flex-shrink-0 text-gray-300 transition ${upp ? "rotate-180" : ""}`} />
              </button>

              {upp && (
                <div className="border-t border-gray-100 px-4 py-4 sm:px-[3.25rem]">
                  {s.instruktion && (
                    <div className="prose-sm mb-4 whitespace-pre-wrap rounded-xl bg-gray-50 p-4 text-sm leading-relaxed text-gray-700">
                      {s.instruktion}
                    </div>
                  )}

                  {s.nyckel === "kundnyckel" && !klart && (
                    <div className="mb-4 space-y-2">
                      <input
                        value={nyckel}
                        onChange={(e) => setNyckel(e.target.value)}
                        placeholder="pit-…"
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-sm outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                      />
                      <button
                        onClick={sparaNyckel}
                        disabled={!nyckel.trim() || arbetar === "kundnyckel"}
                        className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                      >
                        {arbetar === "kundnyckel" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Verifiera och spara
                      </button>
                      {nyckelFel && (
                        <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3 text-xs text-rose-900">
                          <p className="font-semibold">{nyckelFel.text}</p>
                          {nyckelFel.scopes?.length ? (
                            <p className="mt-1">Saknade behörigheter: {nyckelFel.scopes.join(", ")}. Skapa en ny integration — scopes som läggs till i efterhand får inget genomslag.</p>
                          ) : null}
                        </div>
                      )}
                    </div>
                  )}

                  {["ghl_konto", "custom_values", "tenant", "brand_profil"].includes(s.nyckel) && (
                    <div className="mb-4 space-y-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => provisionera(true)}
                          disabled={arbetar === "provisionera"}
                          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                        >
                          {arbetar === "provisionera" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                          Torrkör — visa vad som skulle göras
                        </button>
                        <button
                          onClick={() => provisionera(false)}
                          disabled={arbetar === "provisionera"}
                          className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                        >
                          Kör skarpt
                        </button>
                      </div>
                      <p className="text-xs text-gray-500">
                        Kör steg 3, 5, 6 och 7 i en följd. Kan köras om — custom values skrivs först när kundnyckeln i steg 4 finns.
                      </p>
                      {provSteg && (
                        <ul className="space-y-1.5 pt-1">
                          {provSteg.map((p, i) => (
                            <li key={`${p.namn}-${i}`} className="flex items-start gap-2 text-sm">
                              {p.status === "klar" ? <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
                                : p.status === "fel" ? <Circle className="mt-0.5 h-4 w-4 flex-shrink-0 text-rose-500" />
                                : <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />}
                              <span>
                                <span className="font-medium text-gray-900">{p.namn}</span>
                                {p.detalj ? <span className="text-gray-500"> — {p.detalj}</span> : null}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {s.nyckel === "verifiering" && (
                    <div className="mb-4 space-y-2">
                      <button
                        onClick={verifiera}
                        disabled={arbetar === "verifiering"}
                        className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                      >
                        {arbetar === "verifiering" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Kör verifieringen
                      </button>
                      {punkter && (
                        <ul className="space-y-1.5 pt-1">
                          {punkter.map((p) => (
                            <li key={p.namn} className="flex items-start gap-2 text-sm">
                              {p.manuell ? <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
                                : p.ok ? <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
                                : <Circle className="mt-0.5 h-4 w-4 flex-shrink-0 text-rose-500" />}
                              <span>
                                <span className="font-medium text-gray-900">{p.namn}</span>
                                <span className="text-gray-500"> — {p.detalj}</span>
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {s.nyckel === "kundlank" && kundlank && (
                    <div className="mb-4 flex items-center gap-2">
                      <code className="min-w-0 flex-1 truncate rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-700">{kundlank}</code>
                      <button
                        onClick={() => navigator.clipboard?.writeText(kundlank)}
                        className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        <Copy className="h-3.5 w-3.5" /> Kopiera
                      </button>
                    </div>
                  )}

                  {!blockerat && (
                    <div className="flex flex-wrap gap-2">
                      {!klart ? (
                        <button
                          onClick={() => bocka(s, "klart")}
                          disabled={arbetar === s.nyckel}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                        >
                          {arbetar === s.nyckel ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                          Markera som klart
                        </button>
                      ) : (
                        <button
                          onClick={() => bocka(s, "vantar")}
                          className="text-xs font-medium text-gray-400 hover:text-gray-700"
                        >
                          Ångra
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
