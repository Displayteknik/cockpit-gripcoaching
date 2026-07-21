"use client";

import { useEffect, useState } from "react";
import FokusClient from "@/components/FokusClient";

// Admin-vyn av Fokusmotorn — samma IDAG-tavla som /k/fokus men för aktiv klient
// i Cockpit (API:erna är redan admin-medvetna via getActiveClientId).
export default function DashboardFokus() {
  const [primary, setPrimary] = useState<string | undefined>(undefined);

  useEffect(() => {
    fetch("/api/clients/active")
      .then((r) => r.json())
      .then((c) => { if (c?.primary_color) setPrimary(c.primary_color); })
      .catch(() => {});
  }, []);

  return <FokusClient primaryColor={primary} />;
}
