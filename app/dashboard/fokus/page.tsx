"use client";

import { useEffect, useState } from "react";
import FokusClient from "@/components/FokusClient";
import DagensDrag from "@/components/DagensDrag";

// Admin-vyn av Fokusmotorn — samma IDAG-tavla som /k/fokus men för aktiv klient
// i Cockpit (API:erna är redan admin-medvetna via getActiveClientId).
//
// DRIV-4: Dagens drag är den översta sektionen (spec punkt 4) — befintlig funktionalitet
// (FokusClient) flyttas under, ingenting togs bort.
export default function DashboardFokus() {
  const [primary, setPrimary] = useState<string | undefined>(undefined);

  useEffect(() => {
    fetch("/api/clients/active")
      .then((r) => r.json())
      .then((c) => { if (c?.primary_color) setPrimary(c.primary_color); })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-8">
      <DagensDrag primaryColor={primary || "#4f46e5"} />
      <FokusClient primaryColor={primary} />
    </div>
  );
}
