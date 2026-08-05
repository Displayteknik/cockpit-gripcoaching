// Gemensam lead-mottagning.
//
// Bakgrunden: ett lead som kom via Displaytekniks webbformulär fick BÅDE ett kort i
// Nya leads OCH en affär i MySales, medan ett lead som lades in för hand bara fick kortet.
// Kedjan låg inbakad i Netlify-funktionen för en enda kund och gick inte att återanvända.
// Den bor här nu, så formulär, manuellt inlägg och inklistrat mejl ger samma resultat.
//
// ★ AFFÄRSSKAPANDET ÄR AVSTÄNGT SOM STANDARD, PER KLIENT.
// "Nya leads" är medvetet lead-pipelinen FÖRE MySales — man skjuter över en kontakt när
// den är kvalificerad (se app/api/lobby/sync). Att skapa affärer automatiskt för alla
// hade ändrat beteendet för klienter som redan kör. Den som vill ha det på (Displayteknik,
// vars formulär alltid gjort så) slår på det i Inställningar.

import { resolveCoachGhl } from "./coach-bridge";
import { supabaseService } from "./supabase-admin";

const GHL_BASE = "https://services.leadconnectorhq.com";

export interface LeadInstallningar {
  /** Skapa affär i MySales direkt när leadet kommer in. Default false. */
  skapaAffar: boolean;
  pipelineId: string;
  stageId: string;
}

export const LEAD_NYCKLAR = {
  skapaAffar: "lead_skapa_affar",
  pipeline: "lead_ghl_pipeline_id",
  steg: "lead_ghl_stage_id",
} as const;

/** Läser klientens lead-inställningar ur hm_settings. Fel → allt av (fail-safe). */
export async function hamtaLeadInstallningar(clientId: string): Promise<LeadInstallningar> {
  const av: LeadInstallningar = { skapaAffar: false, pipelineId: "", stageId: "" };
  try {
    const sb = supabaseService();
    const { data } = await sb
      .from("hm_settings")
      .select("key, value")
      .eq("client_id", clientId)
      .in("key", [LEAD_NYCKLAR.skapaAffar, LEAD_NYCKLAR.pipeline, LEAD_NYCKLAR.steg]);
    const k: Record<string, string> = {};
    for (const r of (data as { key: string; value: string }[] | null) || []) k[r.key] = r.value;
    return {
      // Bara ett uttryckligt "ja" räknas. En tom eller okänd sträng ska aldrig tolkas som på.
      skapaAffar: (k[LEAD_NYCKLAR.skapaAffar] || "").toLowerCase() === "ja",
      pipelineId: k[LEAD_NYCKLAR.pipeline] || "",
      stageId: k[LEAD_NYCKLAR.steg] || "",
    };
  } catch {
    return av;
  }
}

export interface LeadIn {
  clientId: string;
  namn: string;
  foretag?: string | null;
  epost?: string | null;
  telefon?: string | null;
  /** Kort ärendebeskrivning — hamnar i affärens anteckning. */
  arende?: string | null;
  /** Vad affären ska heta i MySales. Utan denna byggs den av namn och företag. */
  affarsnamn?: string | null;
}

export interface AffarsResultat {
  status: "skapad" | "avstangd" | "ej_konfigurerad" | "ingen_koppling" | "fel";
  ghlContactId: string | null;
  ghlOpportunityId: string | null;
  /** Klartext för UI och loggar — säg alltid vad som HÄNDE, aldrig tyst ingenting. */
  notis: string;
}

/**
 * Skapar kontakt + affär i MySales för ett inkommet lead.
 *
 * Kastar aldrig. Leadet självt är primärleveransen och får aldrig falla på att MySales
 * strular — samma princip som best-effort-stegen i Displaytekniks formulärfunktion.
 */
export async function skapaAffarIMysales(lead: LeadIn): Promise<AffarsResultat> {
  const svar = (status: AffarsResultat["status"], notis: string, c: string | null = null, o: string | null = null): AffarsResultat =>
    ({ status, ghlContactId: c, ghlOpportunityId: o, notis });

  try {
    const inst = await hamtaLeadInstallningar(lead.clientId);
    if (!inst.skapaAffar) return svar("avstangd", "Affär skapades inte — avstängt i Inställningar.");
    if (!inst.pipelineId || !inst.stageId) {
      return svar("ej_konfigurerad", "Affär skapades inte — pipeline eller steg är inte valt i Inställningar.");
    }

    const { token, locationId } = await resolveCoachGhl(lead.clientId);
    if (!token) return svar("ingen_koppling", "Affär skapades inte — klienten saknar MySales-koppling.");

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Version: "2021-07-28",
    };

    const delar = (lead.namn || "").trim().split(/\s+/);
    const kontaktKropp: Record<string, unknown> = {
      firstName: delar[0] || lead.namn,
      lastName: delar.slice(1).join(" "),
      name: lead.namn,
      tags: ["lead"],
      source: "Cockpit",
    };
    if (locationId) kontaktKropp.locationId = locationId;
    if (lead.foretag) kontaktKropp.companyName = lead.foretag;
    if (lead.epost) kontaktKropp.email = lead.epost;
    if (lead.telefon) kontaktKropp.phone = lead.telefon;

    const kr = await fetch(`${GHL_BASE}/contacts/upsert`, {
      method: "POST", headers, body: JSON.stringify(kontaktKropp),
    });
    if (!kr.ok) {
      const t = await kr.text();
      return svar("fel", `MySales svarade ${kr.status} på kontakten: ${t.slice(0, 120)}`);
    }
    const kd = await kr.json();
    const kontaktId: string | null = kd?.contact?.id ?? kd?.id ?? null;
    if (!kontaktId) return svar("fel", "MySales returnerade ingen kontakt.");

    const affarKropp: Record<string, unknown> = {
      name: lead.affarsnamn || [lead.namn, lead.foretag].filter(Boolean).join(" – "),
      contactId: kontaktId,
      pipelineId: inst.pipelineId,
      pipelineStageId: inst.stageId,
      status: "open",
    };
    if (locationId) affarKropp.locationId = locationId;

    const or = await fetch(`${GHL_BASE}/opportunities/`, {
      method: "POST", headers, body: JSON.stringify(affarKropp),
    });
    if (!or.ok) {
      const t = await or.text();
      return svar("fel", `Kontakten sparades men affären misslyckades (${or.status}): ${t.slice(0, 120)}`, kontaktId);
    }
    const od = await or.json();
    const affarId: string | null = od?.opportunity?.id ?? od?.id ?? null;

    // Ärendet som anteckning — utan den står affären i MySales utan att säga vad kunden vill.
    if (lead.arende) {
      try {
        await fetch(`${GHL_BASE}/contacts/${kontaktId}/notes/`, {
          method: "POST", headers,
          body: JSON.stringify({ body: `Källa: Cockpit\nÄrende: ${String(lead.arende).slice(0, 500)}` }),
        });
      } catch { /* anteckningen är en bonus */ }
    }

    return svar("skapad", "Affär skapad i MySales.", kontaktId, affarId);
  } catch (e) {
    return svar("fel", `Kunde inte nå MySales: ${(e as Error).message.slice(0, 120)}`);
  }
}
