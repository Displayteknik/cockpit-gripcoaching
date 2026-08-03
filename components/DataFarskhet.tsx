"use client";

// Färskhetsraden — säger alltid hur gammal den lånade datan är.
//
// Regeln bakom komponenten: ingen vy får visa affärer, kontakter eller siffror som
// hämtats från MySales utan att samtidigt säga när de hämtades. En vy som ritar upp tre
// dygn gammal pipeline ser precis lika trovärdig ut som en som ritar upp dagens — och då
// har systemet fel utan att någon kan se det.
//
// Därför finns ingen "dölj om allt är bra"-variant. Raden syns alltid; den byter bara
// ton när datan blivit gammal eller när hämtningen misslyckats.

import { useState } from "react";
import { AlertTriangle, Check, Loader2, RefreshCw } from "lucide-react";
import { beskrivFarskhet } from "@/lib/farskhet";

export interface DataFarskhetProps {
  /** När datan senast hämtades ur källsystemet. null = aldrig, och det ska synas. */
  senastSynkad: string | null | undefined;
  /** Felet från senaste hämtningsförsöket, om den misslyckades. */
  fel?: string | null;
  /** Utan den här körs ingen knapp — vyn visar bara åldern. */
  onSynka?: () => Promise<void> | void;
  /** Vad datan kommer ifrån, i klarspråk. */
  kalla?: string;
  className?: string;
}

export default function DataFarskhet({
  senastSynkad,
  fel,
  onSynka,
  kalla = "MySales",
  className = "",
}: DataFarskhetProps) {
  const [synkar, setSynkar] = useState(false);
  const f = beskrivFarskhet(senastSynkad);
  // Ett misslyckat försök väger tyngre än åldern: datan kan vara en timme gammal och
  // ändå vara på väg att bli hur gammal som helst.
  const varning = !!fel || f.niva !== "farsk";

  const ton = fel
    ? "border-red-200 bg-red-50 text-red-800"
    : f.niva === "farsk"
      ? "border-gray-200 bg-gray-50 text-gray-600"
      : "border-amber-200 bg-amber-50 text-amber-900";

  const kor = async () => {
    if (!onSynka || synkar) return;
    setSynkar(true);
    try {
      await onSynka();
    } finally {
      setSynkar(false);
    }
  };

  return (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border px-3.5 py-2.5 text-xs ${ton} ${className}`}
    >
      <span className="inline-flex items-center gap-1.5 font-medium">
        {varning ? (
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
        ) : (
          <Check className="h-3.5 w-3.5 flex-shrink-0" />
        )}
        {f.text === "Aldrig hämtad från MySales" ? `Aldrig hämtad från ${kalla}` : `${f.text} från ${kalla}`}
      </span>

      {f.niva === "gammal" && !fel && (
        <span className="opacity-90">Siffrorna kan ha ändrats i {kalla} sedan dess.</span>
      )}
      {fel && <span className="opacity-90">Senaste försöket misslyckades: {fel}</span>}

      {onSynka && (
        <button
          type="button"
          onClick={kor}
          disabled={synkar}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-black/10 bg-white/70 px-2.5 py-1 font-semibold transition-colors hover:bg-white disabled:opacity-60"
        >
          {synkar ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {synkar ? "Hämtar…" : "Synka nu"}
        </button>
      )}
    </div>
  );
}
