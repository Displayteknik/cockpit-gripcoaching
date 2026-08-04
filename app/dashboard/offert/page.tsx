"use client";

import { useEffect, useState } from "react";
import OffertClient from "@/components/OffertClient";

// Admin-vyn av Offertmotorn. Samma motor som kundportalens /k/offert, men bakom
// admin-grinden och styrd av klientväljaren (getActiveClientId).
//
// Finns ?lead=<uuid> öppnas offertförslaget direkt på en offertförfrågan från kundens
// webbformulär — det är målet för "Skapa offertförslag" i aviseringsmejlet. Den vägen
// måste vara admin-grindad: en kund-session når aldrig /dashboard, och därför ligger
// länkens mål här i stället för i /k/offert.
//
// Query-strängen läses ur window.location, inte via useSearchParams. Samma mönster som
// LeadsClient. useSearchParams kräver en Suspense-gräns, och den gränsen löstes aldrig ut
// här — sidan blev en tom <main> med en hängande boundary.
export default function DashboardOffert() {
  const [leadId, setLeadId] = useState<string | undefined>(undefined);
  const [redo, setRedo] = useState(false);
  const [primary, setPrimary] = useState<string | undefined>(undefined);
  const [klientVersion, setKlientVersion] = useState(0);

  useEffect(() => {
    setLeadId(new URLSearchParams(window.location.search).get("lead") || undefined);
    // Motorn får inte monteras innan vi vet om det finns ett lead — annars hinner den
    // ladda offerter för föregående klient innan djuplänken växlat tenant.
    setRedo(true);
  }, []);

  useEffect(() => {
    fetch("/api/clients/active")
      .then((r) => r.json())
      .then((c) => { if (c?.primary_color) setPrimary(c.primary_color); })
      .catch(() => {});
  }, [klientVersion]);

  if (!redo) return null;

  return (
    <OffertClient
      primaryColor={primary}
      leadId={leadId}
      onKlientBytt={() => setKlientVersion((v) => v + 1)}
    />
  );
}
