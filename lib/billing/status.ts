// BETAL-1 — statusmaskinen och betalspärren.
//
// ★ EN källa. Alla tre spärrlagren (kundsessionen, /k-layouten, API-grinden) läser
// hamtaBetalstatus() och ingenting annat. En andra plats som "också vet" om en kund är
// spärrad är en plats som förr eller senare säger något annat än den första.
//
// Trappan:
//   aktiv        → allt fungerar
//   forsenad     → första misslyckade debiteringen. Gul banner, full funktion kvar.
//   paminnelser  → påminnelsemejl går ut. Full funktion kvar.
//   sparrad      → bara betalsidan. INGEN data raderas, publicerat rörs inte.
//
// Två skyddsnät åt kundens håll:
//   1. dunning_aktiv = false (default) → ingen spärras, oavsett status i tabellen.
//      Håkan slår på spärren medvetet, den slås aldrig på av sig själv.
//   2. Går statusläsningen sönder → 'aktiv'. Ett felaktigt öppet konto är ett billigare
//      fel än en betalande kund som låses ute.
//
// Server-only (service-role).

import { supabaseService } from "../supabase-admin";
import { hamtaInstallningar } from "./installningar";

export type Betalstatus = "aktiv" | "forsenad" | "paminnelser" | "sparrad";

export interface Statusrad {
  client_id: string;
  status: Betalstatus;
  forsta_misslyckande: string | null;
  paminnelser_skickade: number;
  senaste_paminnelse: string | null;
  sparrad_at: string | null;
  senaste_faktura_id: string | null;
  owner_override: "frys" | "las_upp" | null;
  override_note: string | null;
}

const cache = new Map<string, { v: Betalstatus; tid: number }>();
const TTL_MS = 20 * 1000;

export function nollstallStatusCache(clientId?: string) {
  if (clientId) cache.delete(clientId);
  else cache.clear();
}

/**
 * Den effektiva statusen för en tenant.
 *
 * Ordningen är medveten: ownerns överstyrning prövas FÖRE dunning-flaggan, så Håkan
 * kan frysa en kund manuellt även innan automatiken är påslagen.
 */
export async function hamtaBetalstatus(clientId: string | null | undefined): Promise<Betalstatus> {
  if (!clientId) return "aktiv";
  const cachad = cache.get(clientId);
  if (cachad && Date.now() - cachad.tid < TTL_MS) return cachad.v;

  let status: Betalstatus = "aktiv";
  try {
    const { data } = await supabaseService()
      .from("billing_status")
      .select("status, owner_override")
      .eq("client_id", clientId)
      .maybeSingle();

    const rad = data as { status: Betalstatus; owner_override: string | null } | null;

    if (rad?.owner_override === "frys") {
      status = "sparrad";
    } else if (rad?.owner_override === "las_upp") {
      status = "aktiv";
    } else {
      const { dunning_aktiv } = await hamtaInstallningar();
      // Automatiken av → ingen spärras. Statusen finns kvar i tabellen och syns i
      // ownervyn, men den får inga följder för kunden.
      status = dunning_aktiv ? (rad?.status as Betalstatus) || "aktiv" : "aktiv";
    }
  } catch (e) {
    console.error("[billing] kunde inte läsa betalstatus, släpper igenom:", (e as Error).message);
    status = "aktiv";
  }

  cache.set(clientId, { v: status, tid: Date.now() });
  return status;
}

export async function arSparrad(clientId: string | null | undefined): Promise<boolean> {
  return (await hamtaBetalstatus(clientId)) === "sparrad";
}

/** Rå rad utan överstyrning eller dunning-flagga. För ownervyn, som ska se sanningen. */
export async function hamtaStatusrad(clientId: string): Promise<Statusrad | null> {
  try {
    const { data } = await supabaseService().from("billing_status").select("*").eq("client_id", clientId).maybeSingle();
    return (data as Statusrad | null) || null;
  } catch {
    return null;
  }
}

async function skriv(clientId: string, patch: Record<string, unknown>): Promise<boolean> {
  try {
    const { error } = await supabaseService()
      .from("billing_status")
      .upsert({ client_id: clientId, ...patch }, { onConflict: "client_id" });
    if (error) {
      console.error("[billing] kunde inte skriva status:", error.message);
      return false;
    }
    nollstallStatusCache(clientId);
    return true;
  } catch (e) {
    console.error("[billing] kunde inte skriva status:", (e as Error).message);
    return false;
  }
}

// ── Övergångar ──────────────────────────────────────────────────────────────

/**
 * Första misslyckade debiteringen → forsenad. Dag 0 sätts EN gång och rörs inte av
 * senare misslyckanden på samma faktura — annars skulle påminnelsetrappan starta om
 * varje gång Stripe gör ett nytt försök, och kunden skulle aldrig nå spärren.
 */
export async function registreraMisslyckadBetalning(clientId: string, fakturaId?: string | null): Promise<void> {
  const nuvarande = await hamtaStatusrad(clientId);
  if (nuvarande && nuvarande.status !== "aktiv") {
    await skriv(clientId, { senaste_faktura_id: fakturaId || nuvarande.senaste_faktura_id });
    return;
  }
  await skriv(clientId, {
    status: "forsenad",
    forsta_misslyckande: new Date().toISOString(),
    paminnelser_skickade: 0,
    senaste_paminnelse: null,
    sparrad_at: null,
    senaste_faktura_id: fakturaId || null,
  });
}

/**
 * Betalning inkommen → allt öppnas direkt. Ingen manuell åtgärd, ingen fördröjning.
 * Cachen töms i samma andetag, så kunden är inne igen vid nästa sidladdning.
 */
export async function registreraBetalning(clientId: string): Promise<void> {
  await skriv(clientId, {
    status: "aktiv",
    forsta_misslyckande: null,
    paminnelser_skickade: 0,
    senaste_paminnelse: null,
    sparrad_at: null,
  });
}

export async function registreraPaminnelse(clientId: string, antal: number): Promise<void> {
  await skriv(clientId, {
    status: "paminnelser",
    paminnelser_skickade: antal,
    senaste_paminnelse: new Date().toISOString(),
  });
}

export async function sparra(clientId: string): Promise<void> {
  await skriv(clientId, { status: "sparrad", sparrad_at: new Date().toISOString() });
}

/** Ownerns manuella överstyrning. null = låt automatiken bestämma igen. */
export async function sattOverride(
  clientId: string,
  override: "frys" | "las_upp" | null,
  note?: string,
): Promise<boolean> {
  return skriv(clientId, { owner_override: override, override_note: note?.slice(0, 500) || null });
}

// ── Kundvänd text ───────────────────────────────────────────────────────────
// Klarspråk. En kund som just blivit spärrad ska förstå exakt vad som hänt och exakt
// vad hon gör åt det, utan att känna sig utpekad. Inga tankstreck.

export interface Statusbesked {
  ton: "info" | "varning" | "stopp";
  rubrik: string;
  text: string;
  knapp: string;
}

export function statusbesked(status: Betalstatus): Statusbesked | null {
  if (status === "aktiv") return null;
  if (status === "forsenad") {
    return {
      ton: "varning",
      rubrik: "Vi kunde inte dra din betalning",
      text: "Det brukar bero på att kortet gått ut eller att pengarna inte räckte just då. Uppdatera ditt kort så försöker vi igen. Allt fungerar som vanligt under tiden.",
      knapp: "Hantera betalkort",
    };
  }
  if (status === "paminnelser") {
    return {
      ton: "varning",
      rubrik: "Din betalning ligger kvar obetald",
      text: "Vi har skickat en påminnelse till din e-post. Uppdatera ditt kort eller betala fakturan så är allt i ordning igen. Du har full tillgång så länge.",
      knapp: "Hantera betalkort",
    };
  }
  return {
    ton: "stopp",
    rubrik: "Ditt konto är pausat tills betalningen är ordnad",
    text: "Allt du har skapat finns kvar, och det du redan publicerat ligger kvar orört. Så fort betalningen kommer in öppnas allt igen automatiskt, oftast inom en minut.",
    knapp: "Betala nu",
  };
}

/** Svaret en spärrad kund får från API:et. 402 är statuskoden för obetalt. */
export const SPARRAD_API_BESKED =
  "Ditt konto är pausat tills betalningen är ordnad. Gå till Abonnemang och kvitton för att betala, så öppnas allt igen direkt.";
