"use client";

import { useEffect, useState } from "react";
import LobbyClient from "@/components/LobbyClient";

// Admin-vyn av Lobbyn (porterad från MySales Coach). Följer klientväljaren via
// /api/lobby/contacts → getActiveClientId → identitetsbryggan.
export default function DashboardLobby() {
  const [primary, setPrimary] = useState<string | undefined>(undefined);

  useEffect(() => {
    fetch("/api/clients/active")
      .then((r) => r.json())
      .then((c) => { if (c?.primary_color) setPrimary(c.primary_color); })
      .catch(() => {});
  }, []);

  return <LobbyClient primaryColor={primary} />;
}
