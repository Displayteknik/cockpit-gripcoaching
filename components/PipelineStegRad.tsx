"use client";

import { useState } from "react";
import { Loader2, Check, TrendingUp, GripVertical } from "lucide-react";

// Delad grafisk pipeline-stegrad. Visar hela GHL-pipelinen, markerar nuvarande steg,
// och flyttar affären i GHL på riktigt — via KLICK eller DRAG-AND-DROP. Används av
// både Fokus-kortet (FokusClient) och Nya leads (LeadsClient). GHL-write via
// /api/fokus/move-stage (token server-side, kundens knapptryck).
export interface StegInfo {
  aktuellId: string;
  pipelineNamn: string;
  steg: { id: string; namn: string }[];
}

export default function PipelineStegRad({
  oppId,
  stegInfo,
  primaryColor,
  onMoved,
}: {
  oppId: string;
  stegInfo: StegInfo;
  primaryColor: string;
  onMoved: () => void;
}) {
  const [flyttar, setFlyttar] = useState<string | null>(null);
  const [dragTarget, setDragTarget] = useState<string | null>(null);
  const [drar, setDrar] = useState(false);

  const aktuellIndex = stegInfo.steg.findIndex((s) => s.id === stegInfo.aktuellId);
  const aktuellNamn = stegInfo.steg[aktuellIndex]?.namn || "";
  const antal = stegInfo.steg.length;

  const flytta = async (stegId: string, stegNamn: string) => {
    if (stegId === stegInfo.aktuellId || flyttar) return;
    setFlyttar(stegId);
    try {
      const r = await fetch("/api/fokus/move-stage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oppId, stegId, stegNamn }),
      });
      const d = await r.json();
      if (d.ok) onMoved();
      else alert(d.error || "Kunde inte flytta affären");
    } catch {
      alert("Kunde inte flytta affären");
    } finally {
      setFlyttar(null);
    }
  };

  return (
    <div className="mt-3">
      {/* Förklarande rubrik */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
          <TrendingUp className="w-3.5 h-3.5" />
          Var i pipelinen{stegInfo.pipelineNamn ? ` · ${stegInfo.pipelineNamn}` : ""}
        </div>
        {aktuellIndex >= 0 && (
          <span className="text-[11px] font-medium text-gray-400 whitespace-nowrap">
            Steg {aktuellIndex + 1} av {antal}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1 overflow-x-auto pb-1.5 -mx-0.5 px-0.5">
        {stegInfo.steg.map((s, i) => {
          const aktuell = i === aktuellIndex;
          const passerad = i < aktuellIndex;
          const laddar = flyttar === s.id;
          const isTarget = dragTarget === s.id && !aktuell;
          return (
            <button
              key={s.id}
              onClick={() => flytta(s.id, s.namn)}
              disabled={aktuell || !!flyttar}
              // Dra det nuvarande steget till ett annat → flytta. Klick funkar också.
              draggable={aktuell && !flyttar}
              onDragStart={(e) => {
                setDrar(true);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", stegInfo.aktuellId);
              }}
              onDragEnd={() => { setDrar(false); setDragTarget(null); }}
              onDragOver={(e) => { if (!aktuell && drar) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; } }}
              onDragEnter={() => { if (!aktuell && drar) setDragTarget(s.id); }}
              onDragLeave={() => { if (dragTarget === s.id) setDragTarget(null); }}
              onDrop={(e) => {
                e.preventDefault();
                setDragTarget(null); setDrar(false);
                if (!aktuell) flytta(s.id, s.namn);
              }}
              title={aktuell ? `Nuvarande steg: ${s.namn} — dra hit till ett annat steg` : `Flytta till "${s.namn}"`}
              className={`group relative flex-shrink-0 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all ${
                aktuell ? "text-white shadow-sm cursor-grab active:cursor-grabbing" : passerad ? "text-white/95" : "text-gray-500 hover:text-gray-800 hover:bg-gray-100"
              } ${!aktuell && !flyttar ? "cursor-pointer" : ""} ${flyttar && !laddar ? "opacity-50" : ""} ${isTarget ? "ring-2 ring-offset-1 scale-105" : ""}`}
              style={{
                background: aktuell ? primaryColor : passerad ? `${primaryColor}99` : isTarget ? `${primaryColor}22` : "#f3f4f6",
                ...(isTarget ? { boxShadow: `0 0 0 2px ${primaryColor}` } : {}),
              }}
            >
              {laddar ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : aktuell ? (
                <GripVertical className="w-3 h-3 opacity-80" />
              ) : passerad ? (
                <Check className="w-3 h-3" />
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
              )}
              <span className="whitespace-nowrap">{s.namn}</span>
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-gray-400 mt-0.5">
        Dra det markerade steget eller klicka ett steg för att flytta affären i MySales{aktuellNamn ? ` (nu: ${aktuellNamn})` : ""}.
      </p>
    </div>
  );
}
