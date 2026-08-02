"use client";

import React, { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ExternalLink, HelpCircle, MessageSquarePlus, Phone, RefreshCw } from "lucide-react";
import SmartTextarea from "@/components/SmartTextarea";

// KONTAKT-1 — tystnadslistan. Delas av den egna vyn och sektionen i Founder HQ, så de
// två aldrig kan visa olika sanning om samma affär.
//
// Den viktigaste raden är den där bollen ligger hos oss. Den ligger alltid överst,
// oavsett hur många dagar som gått.

export interface Rad {
  opportunity_id: string;
  namn: string | null;
  varde: number;
  steg_namn: string | null;
  epost: string | null;
  dagar: number | null;
  bollen: "kund" | "oss" | "okant";
  senasteAmne: string | null;
  kommentar: string | null;
  matbar: boolean;
  ghl_contact_id: string | null;
  location_id: string;
}
export interface Data {
  kopplad: boolean;
  harGmail: boolean;
  authUrl: string | null;
  rader: Rad[];
  antal: { totalt: number; matbara: number; omatbara: number; bollenHosOss: number };
  synk: { senastSynkad: string | null; ok: boolean; fel: string | null };
}

const kr = (n: number) => `${Math.round(n).toLocaleString("sv-SE")} kr`;
const tid = (s: string | null) => (s ? new Date(s).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" }) : "aldrig");

/** Under 7 dagar neutral, 7 till 20 gul, över 20 röd. Samma trösklar som i lib. */
function niva(dagar: number | null): "neutral" | "gul" | "rod" {
  if (dagar === null) return "neutral";
  if (dagar > 20) return "rod";
  if (dagar >= 7) return "gul";
  return "neutral";
}

const mysalesLank = (r: Rad) =>
  r.ghl_contact_id ? `https://app.mysales.se/v2/location/${r.location_id}/contacts/detail/${r.ghl_contact_id}` : null;

export function useTystnad() {
  const [data, setData] = useState<Data | null>(null);
  const [fel, setFel] = useState("");
  const [laddar, setLaddar] = useState(true);

  const hamta = useCallback(async (tvinga = false) => {
    setLaddar(true);
    try {
      const r = await fetch(`/api/hq/kontakt${tvinga ? "?uppdatera=1" : ""}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Kunde inte hämta tystnadslistan");
      setData(j);
      setFel("");
    } catch (e) {
      setFel((e as Error).message);
    } finally {
      setLaddar(false);
    }
  }, []);

  useEffect(() => { hamta(); }, [hamta]);
  return { data, fel, laddar, hamta, setFel };
}

export default function Tystnadslistan({ data, laddar, onUppdatera, onFel }: {
  data: Data; laddar: boolean; onUppdatera: () => void; onFel: (s: string) => void;
}) {
  const [loggar, setLoggar] = useState<{ id: string; notering: string } | null>(null);
  const [sparar, setSparar] = useState(false);
  // Kommentaren redigeras direkt i raden. Utkastet hålls per affär så flera rader kan
  // vara öppna samtidigt utan att skriva över varandra.
  const [kommentarer, setKommentarer] = useState<Record<string, string>>({});
  const [oppenKommentar, setOppenKommentar] = useState<string | null>(null);

  async function sparaKommentar(id: string) {
    setSparar(true);
    try {
      const r = await fetch("/api/hq/kontakt", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityId: id, kommentar: kommentarer[id] ?? "" }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Kunde inte spara kommentaren");
      setOppenKommentar(null);
      onUppdatera();
    } catch (e) {
      onFel((e as Error).message);
    } finally {
      setSparar(false);
    }
  }

  async function loggaSamtal() {
    if (!loggar) return;
    setSparar(true);
    try {
      const r = await fetch("/api/hq/kontakt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityId: loggar.id, notering: loggar.notering }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Kunde inte logga samtalet");
      setLoggar(null);
      onUppdatera();
    } catch (e) {
      onFel((e as Error).message);
    } finally {
      setSparar(false);
    }
  }

  return (
    <>
      {/* Saknas Gmail-behörigheten visas listan ändå, men den säger mindre. Att låtsas
          att bollen är känd vore värre än att skriva ut att den inte går att avgöra. */}
      {data.kopplad && !data.harGmail && data.authUrl && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
          <span>
            <strong>Kopplingen till Google saknar behörighet till din e-post.</strong> Utan den går det inte att se
            vem som har bollen. Listan visar tills vidare bara aktivitet från MySales.
          </span>
          <a href={data.authUrl} className="ml-auto rounded-lg bg-gray-900 px-3 py-1.5 font-medium text-white">Koppla om Google</a>
        </div>
      )}
      {!data.kopplad && data.authUrl && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-200 bg-white px-5 py-4 text-sm text-gray-700">
          <span>Koppla ditt Google-konto så räknar systemet ut vem som har bollen i varje affär.</span>
          <a href={data.authUrl} className="ml-auto rounded-lg bg-gray-900 px-3 py-1.5 font-medium text-white">Koppla Google</a>
        </div>
      )}
      {data.kopplad && data.harGmail && !data.synk.ok && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-semibold">Kunde inte läsa e-posten just nu.</p>
            <p className="mt-1">Siffrorna kommer från senast sparade hämtning: {tid(data.synk.senastSynkad)}. Orsak: {data.synk.fel}</p>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-100 px-5 py-3.5">
          <h2 className="font-display text-lg font-semibold text-gray-900">Vilka håller på att tystna</h2>
          <span className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
            {data.antal.bollenHosOss > 0 && (
              <span className="font-medium text-red-600">
                {data.antal.bollenHosOss} {data.antal.bollenHosOss === 1 ? "kund väntar" : "kunder väntar"} på svar från dig
              </span>
            )}
            <span>{data.antal.matbara} av {data.antal.totalt} går att mäta</span>
            <button onClick={onUppdatera} disabled={laddar}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              <RefreshCw className={`h-3.5 w-3.5 ${laddar ? "animate-spin" : ""}`} /> Uppdatera
            </button>
          </span>
        </div>

        {data.rader.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-500">Inga öppna affärer i pipelinen än.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[54rem] text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-5 py-2.5 font-medium">Affär</th>
                  <th className="px-3 py-2.5 text-right font-medium">Belopp</th>
                  <th className="px-3 py-2.5 font-medium">Steg</th>
                  <th className="px-3 py-2.5 text-right font-medium">Dagar sedan kontakt</th>
                  <th className="px-3 py-2.5 font-medium">Bollen hos</th>
                  <th className="px-3 py-2.5 font-medium">Senaste ämnesrad</th>
                  <th className="px-5 py-2.5 font-medium">Åtgärd</th>
                </tr>
              </thead>
              <tbody>
                {data.rader.map((r) => {
                  const n = niva(r.dagar);
                  const lank = mysalesLank(r);
                  return (
                    <React.Fragment key={r.opportunity_id}>
                    <tr
                      className={`border-b border-gray-50 last:border-0 ${
                        r.bollen === "oss" ? "bg-red-50/60" : n === "rod" ? "bg-red-50/30" : n === "gul" ? "bg-amber-50/40" : ""}`}>
                      <td className="px-5 py-2.5 font-medium text-gray-900">{r.namn || "Namnlös affär"}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-gray-900">{r.varde > 0 ? kr(r.varde) : ""}</td>
                      <td className="px-3 py-2.5 text-gray-600">{r.steg_namn}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {!r.matbar ? (
                          <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                            <HelpCircle className="h-3.5 w-3.5" /> kan inte mätas
                          </span>
                        ) : r.dagar === null ? (
                          <span className="text-xs text-gray-400">ingen historik</span>
                        ) : (
                          <span className={n === "rod" ? "font-semibold text-red-600" : n === "gul" ? "font-semibold text-amber-600" : "text-gray-700"}>
                            {r.dagar}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {r.bollen === "oss" ? (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">du</span>
                        ) : r.bollen === "kund" ? (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">kunden</span>
                        ) : (
                          <span className="text-xs text-gray-400">okänt</span>
                        )}
                      </td>
                      <td className="max-w-56 truncate px-3 py-2.5 text-gray-600" title={r.senasteAmne || ""}>
                        {r.senasteAmne || ""}
                      </td>
                      <td className="px-5 py-2.5">
                        <span className="flex flex-wrap items-center gap-2">
                          <button onClick={() => {
                              setKommentarer((k) => ({ ...k, [r.opportunity_id]: k[r.opportunity_id] ?? r.kommentar ?? "" }));
                              setOppenKommentar(oppenKommentar === r.opportunity_id ? null : r.opportunity_id);
                            }}
                            className={`inline-flex items-center gap-1 text-xs font-medium underline ${
                              r.kommentar ? "text-gray-900" : "text-gray-600 hover:text-gray-900"}`}>
                            <MessageSquarePlus className="h-3 w-3" /> {r.kommentar ? "Kommentar" : "Kommentera"}
                          </button>
                          <button onClick={() => setLoggar({ id: r.opportunity_id, notering: "" })}
                            className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 underline hover:text-gray-900">
                            <Phone className="h-3 w-3" /> Loggade ett samtal
                          </button>
                          {lank && (
                            <a href={lank} target="_blank" rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800">
                              MySales <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </span>
                      </td>
                    </tr>
                    {/* Kommentaren. Skriv, klistra in eller diktera. Den rör aldrig
                        tystnaden: en anteckning om vad som är på gång är inte kontakt. */}
                    {oppenKommentar === r.opportunity_id && (
                      <tr key={`${r.opportunity_id}-kommentar`} className="border-b border-gray-50 bg-gray-50/60">
                        <td colSpan={7} className="px-5 py-3">
                          <label className="text-xs font-medium text-gray-700">Kommentar om {r.namn || "affären"}</label>
                          <SmartTextarea
                            value={kommentarer[r.opportunity_id] ?? ""}
                            onChange={(e) => setKommentarer((k) => ({ ...k, [r.opportunity_id]: e.target.value }))}
                            rows={3}
                            placeholder="Vad är på gång? Skriv, klistra in, eller tryck på mikrofonen och prata."
                            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                          />
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <button onClick={() => sparaKommentar(r.opportunity_id)} disabled={sparar}
                              className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">Spara</button>
                            <button onClick={() => setOppenKommentar(null)} className="text-xs text-gray-500 underline">Stäng</button>
                            {r.kommentar && (
                              <button onClick={() => { setKommentarer((k) => ({ ...k, [r.opportunity_id]: "" })); }}
                                className="text-xs text-gray-500 underline">Töm fältet</button>
                            )}
                            <span className="text-xs text-gray-400">Kommentaren påverkar inte antalet dagar sedan kontakt.</span>
                          </div>
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="border-t border-gray-100 bg-gray-50 px-5 py-2.5 text-xs text-gray-500">
          Bollen hos dig betyder att kunden hörde av sig sist. Kort utan e-postadress kan inte mätas och räknas
          aldrig som tysta. E-posten läses bara som avsändare, mottagare, datum och ämnesrad. Hämtad {tid(data.synk.senastSynkad)}.
        </p>
      </div>

      {loggar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setLoggar(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg font-semibold text-gray-900">Loggade ett samtal</h3>
            <p className="mt-1 text-sm text-gray-600">
              Nollställer tystnaden för affären, så ett telefonsamtal inte räknas som att det blivit tyst.
              Noteringen stannar i HQ.
            </p>
            <input autoFocus value={loggar.notering} onChange={(e) => setLoggar({ ...loggar, notering: e.target.value })}
              placeholder="Vad sades? Valfritt." className="mt-4 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
            <div className="mt-5 flex items-center gap-2">
              <button onClick={loggaSamtal} disabled={sparar}
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Spara</button>
              <button onClick={() => setLoggar(null)} className="text-sm text-gray-500 underline">Avbryt</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
