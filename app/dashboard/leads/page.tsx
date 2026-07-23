"use client";

import { useEffect, useState } from "react";
import LeadsClient from "@/components/LeadsClient";

// Admin-vyn av "Nya leads" (fd Lobbyn). Följer klientväljaren via
// /api/lobby/contacts → getActiveClientId → identitetsbryggan.
export default function DashboardLeads() {
  const [primary, setPrimary] = useState<string | undefined>(undefined);

  useEffect(() => {
    fetch("/api/clients/active")
      .then((r) => r.json())
      .then((c) => { if (c?.primary_color) setPrimary(c.primary_color); })
      .catch(() => {});
  }, []);

  return <LeadsClient primaryColor={primary} />;
}
