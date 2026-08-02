"use client";

import { useEffect, useRef, useState } from "react";
import { Lock } from "lucide-react";

// PLAN-1 — veckorutnätet. Fem kolumner måndag till fredag, en smal helgkolumn som bara
// visar det som råkar ligga där, och en tidsaxel 07 till 20.
//
// Drag och släpp är byggt på pointer events, inget bibliotek: ett block flyttas genom att
// dras, längden ändras genom att dra i nederkanten. Uppdateringen sker optimistiskt i
// vyn och rullas tillbaka om Google säger nej, så det aldrig ser ut som att en flytt
// gick igenom när den inte gjorde det.

export const AXEL_START = 7 * 60;
export const AXEL_SLUT = 20 * 60;
const PX_PER_TIMME = 56;
const SNAPP = 15;

export interface VyHandelse {
  google_event_id: string;
  titel: string | null;
  datum: string;
  dag: number;
  startMinut: number;
  slutMinut: number;
  heldag: boolean;
  start_datum: string | null;
  slut_datum: string | null;   // Google räknar slutdatumet EXKLUSIVE för heldagar
  last: boolean;
  event_type: string | null;
  html_lank: string | null;
  tidstyp: { id: string; namn: string; farg_ramp: string } | null;
}

// Färgramperna ur tidstyperna. Mjuk botten, mättad kantlinje och mörk text: blocken ska
// gå att läsa på en skärm i solljus, inte bara se dekorativa ut.
export const RAMPER: Record<string, { bg: string; kant: string; text: string; prick: string }> = {
  teal:   { bg: "#ccfbf1", kant: "#0d9488", text: "#134e4a", prick: "#14b8a6" },
  coral:  { bg: "#ffe4e6", kant: "#e11d48", text: "#881337", prick: "#fb7185" },
  blue:   { bg: "#dbeafe", kant: "#2563eb", text: "#1e3a8a", prick: "#3b82f6" },
  purple: { bg: "#f3e8ff", kant: "#9333ea", text: "#581c87", prick: "#a855f7" },
  gray:   { bg: "#f1f5f9", kant: "#64748b", text: "#334155", prick: "#94a3b8" },
};
export const ramp = (f?: string | null) => RAMPER[f || "gray"] || RAMPER.gray;

export const klocka = (minut: number) =>
  `${String(Math.floor(minut / 60)).padStart(2, "0")}:${String(Math.round(minut % 60)).padStart(2, "0")}`;

const DAGKORT = ["mån", "tis", "ons", "tors", "fre", "lör", "sön"];

interface Props {
  dagar: string[];                 // sju datum, måndag först
  handelser: VyHandelse[];
  idag: string;
  mobilDag?: string;               // satt = dagvy (under 700 px)
  onFlytta: (id: string, datum: string, start: string, slut: string) => Promise<boolean>;
  onOppna: (h: VyHandelse) => void;
  onSkapa: (datum: string, start: string, slut: string) => void;
}

interface Drag {
  id: string;
  typ: "flytta" | "langd";
  greppMinut: number;    // var i blocket man tog tag
  datum: string;
  start: number;
  slut: number;
}

export default function Veckovy({ dagar, handelser, idag, mobilDag, onFlytta, onOppna, onSkapa }: Props) {
  const rutRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [sparar, setSparar] = useState(false);

  const veckodagar = mobilDag ? [mobilDag] : dagar.slice(0, 5);
  const helg = mobilDag ? [] : dagar.slice(5);
  const helgHandelser = handelser.filter((h) => helg.includes(h.datum) && !h.heldag);
  const hojd = ((AXEL_SLUT - AXEL_START) / 60) * PX_PER_TIMME;
  const minutTillY = (m: number) => ((Math.max(AXEL_START, Math.min(AXEL_SLUT, m)) - AXEL_START) / 60) * PX_PER_TIMME;

  // Pekaren under ett pågående drag. Registreras på window så draget överlever att
  // pekaren lämnar blocket, vilket den alltid gör.
  useEffect(() => {
    if (!drag) return;
    const rut = rutRef.current;
    if (!rut) return;

    const flytta = (e: PointerEvent) => {
      const box = rut.getBoundingClientRect();
      const kolBredd = box.width / veckodagar.length;
      const rawMinut = AXEL_START + ((e.clientY - box.top) / PX_PER_TIMME) * 60;
      const snappat = Math.round(rawMinut / SNAPP) * SNAPP;

      setDrag((d) => {
        if (!d) return d;
        if (d.typ === "langd") {
          const slut = Math.max(d.start + SNAPP, Math.min(AXEL_SLUT, snappat));
          return { ...d, slut };
        }
        const langd = d.slut - d.start;
        let start = snappat - d.greppMinut;
        start = Math.max(AXEL_START, Math.min(AXEL_SLUT - langd, Math.round(start / SNAPP) * SNAPP));
        const kolIndex = Math.max(0, Math.min(veckodagar.length - 1, Math.floor((e.clientX - box.left) / kolBredd)));
        return { ...d, datum: veckodagar[kolIndex], start, slut: start + langd };
      });
    };

    const slapp = async () => {
      const d = drag;
      setDrag(null);
      if (!d) return;
      const original = handelser.find((h) => h.google_event_id === d.id);
      if (!original) return;
      // Inget ändrades: rör aldrig Google i onödan.
      if (original.datum === d.datum && original.startMinut === d.start && original.slutMinut === d.slut) return;
      setSparar(true);
      await onFlytta(d.id, d.datum, klocka(d.start), klocka(d.slut));
      setSparar(false);
    };

    window.addEventListener("pointermove", flytta);
    window.addEventListener("pointerup", slapp, { once: true });
    return () => {
      window.removeEventListener("pointermove", flytta);
      window.removeEventListener("pointerup", slapp);
    };
  }, [drag, handelser, onFlytta, veckodagar]);

  function taTag(e: React.PointerEvent, h: VyHandelse, typ: "flytta" | "langd") {
    if (h.last || sparar) return;
    e.preventDefault();
    e.stopPropagation();
    const rut = rutRef.current;
    if (!rut) return;
    const box = rut.getBoundingClientRect();
    const pekarMinut = AXEL_START + ((e.clientY - box.top) / PX_PER_TIMME) * 60;
    setDrag({
      id: h.google_event_id,
      typ,
      greppMinut: Math.max(0, pekarMinut - h.startMinut),
      datum: h.datum,
      start: h.startMinut,
      slut: h.slutMinut,
    });
  }

  function dubbelklick(e: React.MouseEvent, datum: string) {
    const rut = rutRef.current;
    if (!rut) return;
    const box = rut.getBoundingClientRect();
    const raw = AXEL_START + ((e.clientY - box.top) / PX_PER_TIMME) * 60;
    const start = Math.max(AXEL_START, Math.min(AXEL_SLUT - 60, Math.round(raw / SNAPP) * SNAPP));
    onSkapa(datum, klocka(start), klocka(start + 60));
  }

  const timmar: number[] = [];
  for (let t = AXEL_START; t <= AXEL_SLUT; t += 60) timmar.push(t);

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
      {/* Dagrubriker */}
      <div className="flex border-b border-gray-100 bg-gray-50">
        <div className="w-14 shrink-0" />
        <div className="flex flex-1">
          {veckodagar.map((d) => {
            const dagIdx = dagar.indexOf(d);
            const arIdag = d === idag;
            return (
              <div key={d} className={`flex-1 px-2 py-2 text-center ${arIdag ? "bg-indigo-50" : ""}`}>
                <div className={`text-xs font-semibold uppercase tracking-wide ${arIdag ? "text-indigo-700" : "text-gray-500"}`}>
                  {DAGKORT[dagIdx]}
                </div>
                <div className={`text-sm tabular-nums ${arIdag ? "font-semibold text-indigo-700" : "text-gray-700"}`}>
                  {d.slice(8)}/{Number(d.slice(5, 7))}
                </div>
              </div>
            );
          })}
        </div>
        {helg.length > 0 && (
          <div className="w-24 shrink-0 border-l border-gray-200 px-2 py-2 text-center">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">helg</div>
            <div className="text-sm tabular-nums text-gray-500">{helg[0].slice(8)} och {helg[1].slice(8)}</div>
          </div>
        )}
      </div>

      {/* Heldagar: egen rad överst. De har inget klockslag och kan inte ritas på axeln. */}
      <HeldagsRad dagar={veckodagar} helg={helg} handelser={handelser} onOppna={onOppna} />

      <div className="flex">
        {/* Tidsaxel */}
        <div className="w-14 shrink-0 select-none">
          <div style={{ height: hojd }} className="relative">
            {timmar.map((t) => (
              <div key={t} className="absolute right-2 -translate-y-1/2 text-xs tabular-nums text-gray-400"
                style={{ top: minutTillY(t) }}>
                {klocka(t)}
              </div>
            ))}
          </div>
        </div>

        {/* Rutnätet */}
        <div ref={rutRef} className="relative flex flex-1 border-l border-gray-100" style={{ height: hojd }}>
          {timmar.map((t) => (
            <div key={t} className="pointer-events-none absolute inset-x-0 border-t border-gray-100"
              style={{ top: minutTillY(t) }} />
          ))}
          {veckodagar.map((d) => {
            const dagIdx = dagar.indexOf(d);
            const whiteSpace = [0, 2, 4].includes(dagIdx); // mån, ons, fre
            const dagens = handelser.filter((h) => h.datum === d && !h.heldag && h.slutMinut > AXEL_START && h.startMinut < AXEL_SLUT);
            return (
              <div key={d}
                onDoubleClick={(e) => dubbelklick(e, d)}
                className={`relative flex-1 border-r border-gray-100 last:border-r-0 ${whiteSpace ? "bg-gray-50/40" : ""}`}>
                {dagens.map((h) => {
                  const dragig = drag?.id === h.google_event_id;
                  const visaDatum = dragig ? drag!.datum : h.datum;
                  if (visaDatum !== d) return null;
                  const s = dragig ? drag!.start : h.startMinut;
                  const e2 = dragig ? drag!.slut : h.slutMinut;
                  const r = ramp(h.tidstyp?.farg_ramp);
                  const topp = minutTillY(s);
                  const h2 = Math.max(18, minutTillY(e2) - topp);
                  return (
                    <div key={h.google_event_id}
                      onPointerDown={(ev) => taTag(ev, h, "flytta")}
                      onClick={(ev) => { ev.stopPropagation(); if (!dragig) onOppna(h); }}
                      onDoubleClick={(ev) => ev.stopPropagation()}
                      title={`${h.titel || "Namnlös"} ${klocka(s)} till ${klocka(e2)}`}
                      className={`absolute inset-x-1 overflow-hidden rounded-lg border-l-4 px-2 py-1 text-left transition-shadow ${
                        h.last ? "cursor-default" : "cursor-grab active:cursor-grabbing"
                      } ${dragig ? "z-20 shadow-lg ring-2 ring-indigo-400" : "z-10 hover:shadow-md"}`}
                      style={{ top: topp, height: h2, background: r.bg, borderColor: r.kant, color: r.text }}>
                      <div className="flex items-start gap-1">
                        {h.last && <Lock className="mt-0.5 h-3 w-3 shrink-0 opacity-60" />}
                        <span className="truncate text-xs font-semibold leading-tight">{h.titel || "Namnlös"}</span>
                      </div>
                      {h2 > 34 && <div className="text-[11px] tabular-nums opacity-75">{klocka(s)} till {klocka(e2)}</div>}
                      {!h.last && (
                        <div onPointerDown={(ev) => taTag(ev, h, "langd")}
                          title="Dra för att ändra längd"
                          className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize" />
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Helgen: bara det som råkar ligga där, aldrig en dropplats. */}
        {helg.length > 0 && (
          <div className="w-24 shrink-0 border-l border-gray-200 p-1.5" style={{ height: hojd }}>
            {helgHandelser.length === 0 ? (
              <p className="pt-3 text-center text-[11px] leading-tight text-gray-300">inget bokat</p>
            ) : (
              <div className="space-y-1">
                {helgHandelser.map((h) => {
                  const r = ramp(h.tidstyp?.farg_ramp);
                  return (
                    <button key={h.google_event_id} onClick={() => onOppna(h)}
                      className="w-full rounded-lg border-l-4 px-1.5 py-1 text-left"
                      style={{ background: r.bg, borderColor: r.kant, color: r.text }}>
                      <div className="truncate text-[11px] font-semibold leading-tight">{h.titel || "Namnlös"}</div>
                      <div className="text-[10px] tabular-nums opacity-75">{klocka(h.startMinut)}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <UtanforAxeln dagar={veckodagar} handelser={handelser} onOppna={onOppna} />
    </div>
  );
}

/** Heldagar har inget klockslag. De får en egen rad i stället för att tvingas på axeln. */
function HeldagsRad({ dagar, helg, handelser, onOppna }: {
  dagar: string[]; helg: string[]; handelser: VyHandelse[];
  onOppna: (h: VyHandelse) => void;
}) {
  const heldagar = handelser.filter((h) => h.heldag);
  if (heldagar.length === 0) return null;
  return (
    <div className="flex border-b border-gray-100 bg-white">
      <div className="flex w-14 shrink-0 items-center justify-end pr-2 text-[10px] uppercase tracking-wide text-gray-400">hela</div>
      <div className="flex flex-1">
        {dagar.map((d) => {
          // Google anger slutdatumet EXKLUSIVE: 4 till 6 augusti betyder 4 och 5.
          const dagens = heldagar.filter((h) => (h.start_datum || "") <= d && d < (h.slut_datum || ""));
          return (
            <div key={d} className="min-h-8 flex-1 space-y-0.5 border-r border-gray-100 p-1 last:border-r-0">
              {dagens.map((h) => {
                const r = ramp(h.tidstyp?.farg_ramp);
                return (
                  <button key={h.google_event_id + d} onClick={() => onOppna(h)}
                    className="flex w-full items-center gap-1 truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium"
                    style={{ background: r.bg, color: r.text }}>
                    <Lock className="h-2.5 w-2.5 shrink-0 opacity-50" />
                    <span className="truncate">{h.titel || "Namnlös"}</span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
      {helg.length > 0 && <div className="w-24 shrink-0 border-l border-gray-200" />}
    </div>
  );
}

/** Händelser helt utanför 07 till 20 syns inte på axeln. De listas hellre än göms. */
function UtanforAxeln({ dagar, handelser, onOppna }: {
  dagar: string[]; handelser: VyHandelse[]; onOppna: (h: VyHandelse) => void;
}) {
  const utanfor = handelser.filter(
    (h) => !h.heldag && dagar.includes(h.datum) && (h.slutMinut <= AXEL_START || h.startMinut >= AXEL_SLUT),
  );
  if (utanfor.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 bg-gray-50 px-4 py-2 text-xs text-gray-500">
      <span className="font-medium">Utanför 07 till 20:</span>
      {utanfor.map((h) => (
        <button key={h.google_event_id} onClick={() => onOppna(h)} className="underline hover:text-gray-900">
          {h.titel || "Namnlös"} {klocka(h.startMinut)}
        </button>
      ))}
    </div>
  );
}
