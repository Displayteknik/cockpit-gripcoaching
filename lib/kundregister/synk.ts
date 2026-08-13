// KUNDREGISTER-1 — Cockpit speglar tenantens MySales-kontakter och läser dem.
//
// Samma modell som Fokusmotorns spegel (lib/fokus/synk.ts), och av samma skäl:
// GoHighLevel äger kontakterna, den här tabellen är en spegel och inget annat. Cockpit
// skriver aldrig tillbaka. Redigering sker i MySales, med en djuplänk per kontakt.
//
// ⚠ MÄTT MOT SKARPA KONTON 2026-08-12, innan en rad byggdes:
//     Displayteknik  → HTTP 200, meta.total = 137 kontakter
//     For Balance    → HTTP 401 "The token is not authorized for this scope."
//     AluCon         → HTTP 401, samma
//   Kundnycklarna saknar alltså kontakt-scopet. Det är samma scope-tak som bet i
//   onboardingen, och det är INTE ett fel i koden — 401 betyder "inte behörig", inte
//   "trasig" (lesson_okontrollerbart_ar_inte_trasigt). Därför bär `fel` en klartext som
//   säger vad som ska göras, och vyn visar den i stället för en tom lista. En tom lista
//   hade sagt "du har inga kunder", vilket är en lögn.
//
// API-kontrakt verifierat mot live-API (Displayteknik-locationen):
//   GET /contacts/?locationId=<loc>&limit=100   → { contacts: [...], meta: { total, nextPageUrl } }
//   Fält på en kontakt: id, contactName, firstName, lastName, companyName, email, phone,
//                       source, tags[], dateAdded, dateUpdated, customFields, assignedTo
//   Sidbrytning: meta.nextPageUrl (bär startAfter + startAfterId).

import { supabaseService } from "@/lib/supabase-admin";
import { resolveCoachGhl } from "@/lib/coach-bridge";
import { borSynkaOm } from "@/lib/farskhet";

const BASE = "https://services.leadconnectorhq.com";
const VERSION = "2021-07-28";

/** Hårt tak på sidbrytningen. 100 varv = 10 000 kontakter; en loop utan tak är en hängning. */
const MAX_SIDOR = 100;

export interface RaKontakt {
  id: string;
  contactName?: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  source?: string;
  tags?: string[];
  dateAdded?: string;
  dateUpdated?: string;
}

export interface KontaktRad {
  tenant_id: string;
  ghl_contact_id: string;
  namn: string;
  foretag: string;
  epost: string;
  telefon: string;
  taggar: string[];
  kalla: string;
  senast_aktivitet: string | null;
  skapad_i_mysales: string | null;
  location_id: string;
  updated_at: string;
}

export interface KundregisterSynk {
  ok: boolean;
  ids: string[];
  antal?: number;
  borttagna?: number;
  hoppadeOver?: boolean;
  fel?: string;
}

function headers(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, Version: VERSION, Accept: "application/json" };
}

/**
 * Namnet vi visar. `contactName` är MySales egen sammanslagning och är det som står i
 * deras gränssnitt — den vinner, så Cockpit och MySales aldrig visar olika namn på samma
 * person. Saknas den byggs namnet av delarna; saknas allt blir det tomt och vyn skriver
 * "Namn saknas i MySales" i stället för att hitta på något.
 */
export function visningsnamn(k: RaKontakt): string {
  const hopsatt = [k.firstName, k.lastName].filter(Boolean).join(" ").trim();
  return (k.contactName || hopsatt || "").trim();
}

/**
 * GHL-kontakter → spegelrader, en rad per tenant.
 *
 * Displayteknik delar en location över två `coach_users`, och båda måste få sin rad
 * (samma skäl som i Fokus-spegeln).
 */
export function byggKontaktrader(
  kontakter: RaKontakt[],
  tenantIds: string[],
  locationId: string,
  nu: string,
): KontaktRad[] {
  const rader: KontaktRad[] = [];
  for (const k of kontakter) {
    if (!k.id) continue;
    for (const tenantId of tenantIds) {
      rader.push({
        tenant_id: tenantId,
        ghl_contact_id: k.id,
        namn: visningsnamn(k),
        foretag: (k.companyName || "").trim(),
        epost: (k.email || "").trim(),
        telefon: (k.phone || "").trim(),
        // Taggarna normaliseras till gemener: MySales sparar dem som användaren skrev
        // dem, så "Offert-lead" och "offert-lead" blir annars två filter för samma sak.
        taggar: (k.tags || []).map((t) => String(t).trim().toLowerCase()).filter(Boolean),
        kalla: (k.source || "").trim(),
        senast_aktivitet: k.dateUpdated || null,
        skapad_i_mysales: k.dateAdded || null,
        location_id: locationId,
        updated_at: nu,
      });
    }
  }
  return rader;
}

/**
 * Alla kontakter på locationen. Sidbrytning krävs — utan loopen tappas allt över 100
 * kontakter tyst, och det syns inte förrän registret vuxit förbi gränsen. Displayteknik
 * ligger redan på 137.
 */
async function hamtaKontakter(token: string, locationId: string): Promise<RaKontakt[]> {
  const alla: RaKontakt[] = [];
  let sida = `${BASE}/contacts/?locationId=${locationId}&limit=100`;
  for (let varv = 0; varv < MAX_SIDOR; varv++) {
    const r = await fetch(sida, { headers: headers(token) });
    if (!r.ok) {
      const kropp = (await r.text()).slice(0, 200);
      // 401 är det förväntade svaret när kundnyckeln saknar kontakt-scopet. Texten ska
      // säga vad som ska GÖRAS, inte bara vad som hände — vyn skriver ut den ordagrant.
      if (r.status === 401 || r.status === 403) {
        throw new Error(
          "MySales-nyckeln för den här kunden får inte läsa kontakter. " +
            "Lägg till behörigheten för kontakter på nyckeln i MySales, så fylls listan vid nästa synk.",
        );
      }
      throw new Error(`MySales svarade ${r.status} på kontakterna: ${kropp}`);
    }
    const d = await r.json();
    const del: RaKontakt[] = d?.contacts || [];
    alla.push(...del);
    const nasta = d?.meta?.nextPageUrl;
    if (!nasta || del.length < 100) break;
    sida = String(nasta);
  }
  return alla;
}

/** Tidsstämpeln på spegeln. null = aldrig hämtad. Fel bubblar — de får inte se ut som tomt. */
export async function senastSynkadKundregister(tenantIds: string[]): Promise<string | null> {
  if (!tenantIds.length) return null;
  const sb = supabaseService();
  const { data, error } = await sb
    .from("kundregister_kontakter")
    .select("updated_at")
    .in("tenant_id", tenantIds)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  const rad = ((data as Array<{ updated_at: string | null }> | null) || [])[0];
  return rad?.updated_at || null;
}

/**
 * Hämtar kontakterna ur MySales och speglar dem.
 *
 * Hoppar över om spegeln är färskare än tio minuter, om inte `tvinga` är satt
 * ("Synka nu"-knappen). Misslyckas anropet lämnas spegeln orörd och felet returneras —
 * vyn visar då gammal data MED sin ålder utskriven, i stället för att krascha eller ljuga.
 */
export async function synkaKundregister(clientId: string, tvinga = false): Promise<KundregisterSynk> {
  let ids: string[] = [];
  try {
    const ghl = await resolveCoachGhl(clientId);
    ids = ghl.ids;
    const { token, locationId } = ghl;
    if (!ids.length || !locationId) return { ok: false, ids, fel: "Kunden är inte kopplad till MySales." };
    if (!token) return { ok: false, ids, fel: "Ingen MySales-nyckel finns sparad för kunden." };

    if (!tvinga) {
      const senast = await senastSynkadKundregister(ids);
      if (!borSynkaOm(senast)) return { ok: true, ids, hoppadeOver: true };
    }

    const kontakter = await hamtaKontakter(token, locationId);
    const nu = new Date().toISOString();
    const rader = byggKontaktrader(kontakter, ids, locationId, nu);

    const sb = supabaseService();
    if (rader.length) {
      const { error } = await sb
        .from("kundregister_kontakter")
        .upsert(rader, { onConflict: "tenant_id,ghl_contact_id" });
      if (error) return { ok: false, ids, fel: `Kunde inte spara spegeln: ${error.message}` };
    }

    // Kontakter som inte längre finns i MySales ska bort. Vi läste HELA locationen, så
    // "saknas i listan" är ett konstaterande och inte en gissning.
    //
    // ⚠ Städas bara när hämtningen gav NÅGOT. Ett tomt svar på en location som faktiskt
    // har kontakter (tillfälligt fel som ändå gav 200) hade annars raderat hela registret
    // — och en tom lista ser ut som ett svar, inte som ett fel.
    let borttagna = 0;
    if (rader.length) {
      const kvar = Array.from(new Set(rader.map((r) => r.ghl_contact_id)));
      const { count, error: bortFel } = await sb
        .from("kundregister_kontakter")
        .delete({ count: "exact" })
        .in("tenant_id", ids)
        .not("ghl_contact_id", "in", `(${kvar.map((id) => `"${id}"`).join(",")})`);
      if (bortFel) return { ok: false, ids, fel: `Kunde inte städa spegeln: ${bortFel.message}` };
      borttagna = count || 0;
    }

    return { ok: true, ids, antal: new Set(rader.map((r) => r.ghl_contact_id)).size, borttagna };
  } catch (e) {
    return { ok: false, ids, fel: (e as Error).message };
  }
}

export interface KundregisterStatus {
  senastSynkad: string | null;
  fel: string | null;
  ids: string[];
}

/** Det vyn anropar: synka om det behövs, och lämna ALLTID tillbaka ålder och ev. fel. */
export async function synkaOchStatusKundregister(clientId: string, tvinga = false): Promise<KundregisterStatus> {
  const res = await synkaKundregister(clientId, tvinga);
  let senastSynkad: string | null = null;
  try {
    senastSynkad = await senastSynkadKundregister(res.ids);
  } catch {
    /* åldern kunde inte läsas — vyn visar "okänd ålder", aldrig "färsk" */
  }
  return { senastSynkad, fel: res.ok ? null : res.fel || "Okänt fel mot MySales", ids: res.ids };
}
