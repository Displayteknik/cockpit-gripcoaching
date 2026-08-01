"use client";

// Mjuk grind i genereringsvyerna (PROFIL-1/F-mätare).
// Blockerar ingenting — den säger bara sanningen på ett ställe där den spelar roll:
// texten du är på väg att skapa blir bättre av mer underlag. Visas under toppnivån
// (nivå 5 "Belagd"), och tystnar helt när profilen är där.

import { useEffect, useState } from "react";
import { Sparkles, ArrowRight } from "lucide-react";

export default function ProfilGrind({ href = "/dashboard/profil" }: { href?: string }) {
  const [niva, setNiva] = useState<number | null>(null);
  const [atgard, setAtgard] = useState<string | null>(null);

  useEffect(() => {
    let aktiv = true;
    fetch("/api/profile/quality")
      .then((r) => r.json())
      .then((d) => {
        if (!aktiv || d?.error || typeof d?.niva !== "number") return;
        setNiva(d.niva);
        setAtgard(Array.isArray(d.atgarder) && d.atgarder.length ? d.atgarder[0] : null);
      })
      .catch(() => {});
    return () => {
      aktiv = false;
    };
  }, []);

  if (niva === null || niva >= 5) return null;

  return (
    <a
      href={href}
      className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600 hover:border-gray-300 hover:text-gray-900 transition"
    >
      <Sparkles className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
      <span>
        Texterna blir märkbart bättre med mer underlag i profilen.
        {atgard ? <span className="text-gray-500"> Närmast: {atgard.charAt(0).toLowerCase()}{atgard.slice(1)}.</span> : null}
      </span>
      <ArrowRight className="w-3.5 h-3.5 text-gray-400 ml-auto flex-shrink-0" />
    </a>
  );
}
