"use client";

// UTKAST-1 — den diskreta raden som visas när ett pågående arbete återställts efter en
// omladdning. Medvetet lågmäld: den ska lugna ("allt är kvar"), inte ta plats. En enda
// tydlig nästa-åtgärd bredvid: börja om.

import { RotateCcw, History } from "lucide-react";
import { utkastTid } from "@/lib/studio/useUtkast";

export default function UtkastRad({
  aterupptaget,
  sparatVid,
  onBorjaOm,
  text = "Fortsätter där du var",
}: {
  aterupptaget: boolean;
  sparatVid: number | null;
  /** Rensa utkastet OCH nollställ ytans fält. */
  onBorjaOm: () => void;
  text?: string;
}) {
  if (!aterupptaget) return null;
  const tid = utkastTid(sparatVid);
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2">
      <span className="inline-flex items-center gap-2 text-sm text-amber-900">
        <History className="w-4 h-4 flex-shrink-0" />
        {text}
        {tid && <span className="text-amber-700">· sparat {tid}</span>}
      </span>
      <button
        onClick={() => onBorjaOm()}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-900 hover:text-amber-950 underline underline-offset-2 flex-shrink-0"
      >
        <RotateCcw className="w-3.5 h-3.5" /> Börja om
      </button>
    </div>
  );
}
