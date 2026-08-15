"use client";

import { useEffect, useState } from "react";
import { Sparkles, Zap } from "lucide-react";
import FokusClient from "@/components/FokusClient";
import DagensDrag from "@/components/DagensDrag";

// Admin-vyn av Fokusmotorn — samma IDAG-tavla som /k/fokus men för aktiv klient
// i Cockpit (API:erna är redan admin-medvetna via getActiveClientId).
//
// DRIV-4 + Håkans fynd 15/8: Dagens drag staplad ovanpå Fokus idags egna sektioner
// (Bokat, Pengalinjen, Väntar på offert m.fl.) gav för mycket att skrolla. Flikar i
// stället för stapling — samma innehåll, ingenting togs bort, bara en åt gången.
export default function DashboardFokus() {
  const [primary, setPrimary] = useState<string | undefined>(undefined);
  const [flik, setFlik] = useState<"drag" | "fokus">("drag");

  useEffect(() => {
    fetch("/api/clients/active")
      .then((r) => r.json())
      .then((c) => { if (c?.primary_color) setPrimary(c.primary_color); })
      .catch(() => {});
  }, []);

  const primaryColor = primary || "#4f46e5";
  const flikar: Array<{ id: "drag" | "fokus"; label: string; icon: typeof Sparkles }> = [
    { id: "drag", label: "Dagens drag", icon: Sparkles },
    { id: "fokus", label: "Fokus idag", icon: Zap },
  ];

  return (
    <div>
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {flikar.map((f) => {
          const aktiv = flik === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setFlik(f.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
                aktiv ? "" : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"
              }`}
              style={aktiv ? { borderColor: primaryColor, color: primaryColor } : undefined}
            >
              <f.icon className="w-4 h-4" />
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Båda monteras hela tiden (inte bara den synliga) — annars förlorar Fokus idag
          sin laddade data varje gång man växlar flik. display:none döljer utan att avmontera. */}
      <div style={{ display: flik === "drag" ? "block" : "none" }}>
        <DagensDrag primaryColor={primaryColor} />
      </div>
      <div style={{ display: flik === "fokus" ? "block" : "none" }}>
        <FokusClient primaryColor={primary} />
      </div>
    </div>
  );
}
