// Fokusmotorns spegel — Cockpit hämtar den själv i stället för att hoppas på någon annan.
//
// BAKGRUND (2026-08-03): `fokus_opportunities` fylldes enbart av den fristående
// MySales Coach-appen. Slutade den köra stannade spegeln, och Cockpit hade ingen aning.
// Skarpt utfall på Displayteknik: spegeln stod stilla i tre dygn, en affär på 150 000 kr
// syntes aldrig i Fokus, och två affärer visade fel steg — en av dem som "Vunnen (order)"
// när den i verkligheten stod på "Möte genomfört".
//
// EN KÄLLA: GoHighLevel äger affärerna. `fokus_opportunities` är en spegel av GHL, inget
// annat. Cockpit skriver hit efter att ha läst GHL — aldrig utifrån någon annan tabell.
// HQ:s `hq_pipeline_cache` speglar SAMMA GHL men för Håkans egen location och med egna
// fält; de två speglarna härleds aldrig ur varandra, så de kan inte driva isär i sak.
// Därför läser Fokus INTE hq_pipeline_cache: den är låst till Displayteknik (HQ_GHL_PIT /
// DT-klientraden) och skulle spränga multi-tenant-modellen.
//
// LÄS-ONLY mot GHL. Den här filen skriver aldrig något till MySales.
//
// ⚠ GHL:s `status`-fält är ALDRIG facit för vunnet — alla DT:s affärer svarar "open"
// även de som står i steget "Vunnen (order)". Fokus härleder vunnet/förlorat ur STEGET
// (lib/fokus/config.buildConfigFromStages + personal_os.__ghl_won_stage_id). Vi speglar
// råvärdet som det är, men ingen logik får luta sig mot det.

import { supabaseService } from "@/lib/supabase-admin";
import { resolveCoachGhl } from "@/lib/coach-bridge";
import { borSynkaOm } from "@/lib/farskhet";

const BASE = "https://services.leadconnectorhq.com";
const VERSION = "2021-07-28";

export interface GhlSteg {
  id: string;
  namn: string;
  pipelineId: string;
  pipelineNamn: string;
}

export interface RaOpp {
  id: string;
  name?: string;
  monetaryValue?: number;
  source?: string;
  pipelineId?: string;
  pipelineStageId?: string;
  status?: string;
  lastStageChangeAt?: string;
  updatedAt?: string;
  contactId?: string;
  contact?: { id?: string; name?: string; companyName?: string };
}

export interface SpegelRad {
  tenant_id: string;
  ghl_opportunity_id: string;
  ghl_contact_id: string;
  kontakt: string;
  foretag: string;
  steg_id: string;
  steg_namn: string;
  varde: number;
  kalla: string;
  steg_sedan: string | null;
  senast_aktivitet: string | null;
  status: string;
  updated_at: string;
}

export interface FokusSynkResultat {
  ok: boolean;
  /** Coach-tenanterna klienten speglas mot. Tom = ingen MySales-koppling. */
  ids: string[];
  /** Antal affärer i spegeln efter synken (unika, inte rader). */
  antal?: number;
  /** Rader som togs bort för att affären inte längre finns i de valda pipelines. */
  borttagna?: number;
  /** true = spegeln var färsk nog, vi rörde inte GHL. */
  hoppadeOver?: boolean;
  fel?: string;
}

function headers(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, Version: VERSION, Accept: "application/json" };
}

/**
 * Vilka pipelines som ska speglas.
 *
 * Håkans inställda pipeline (`personal_os.__ghl_pipeline_id`) styr urvalet, precis som i
 * Fokusmotorns egen synk — annars skulle GHL:s standardpipelines ("Sales Pipeline",
 * "YOUR PROMOTION") dyka upp som affärer i Fokus.
 *
 * ⚠ Tom mängd betyder "spegla allt". Att i stället gissa på den första pipelinen skulle
 * tyst dölja resten, och en pipeline som försvinner ur vyn utan förklaring är värre än
 * en pipeline för mycket.
 */
export function valjPipelineIds(alla: string[], valda: Set<string>): Set<string> {
  const traffar = alla.filter((id) => valda.has(id));
  return traffar.length ? new Set(traffar) : new Set(alla);
}

/**
 * GHL-affärer → spegelrader, en rad per tenant.
 *
 * Displayteknik delar en location över två `coach_users`. Båda måste få sin rad: den
 * fristående Coach-appen läser på sitt eget tenant-id, och skriver vi bara till det ena
 * ser den andra användaren en spegel som aldrig uppdateras.
 */
export function byggSpegelrader(
  opps: RaOpp[],
  steg: Map<string, GhlSteg>,
  pipelineIds: Set<string>,
  tenantIds: string[],
  nu: string,
): SpegelRad[] {
  const rader: SpegelRad[] = [];
  for (const o of opps) {
    if (!o.id) continue;
    const s = o.pipelineStageId ? steg.get(o.pipelineStageId) : undefined;
    // Pipeline-tillhörigheten läses ur STEGET när affären har ett känt steg — GHL:s
    // pipelineId på affären kan släpa efter en flytt, stegets kan det inte.
    const pid = s?.pipelineId || o.pipelineId || "";
    if (pid && !pipelineIds.has(pid)) continue;
    for (const tenantId of tenantIds) {
      rader.push({
        tenant_id: tenantId,
        ghl_opportunity_id: o.id,
        ghl_contact_id: o.contact?.id || o.contactId || "",
        kontakt: o.contact?.name || o.name || "",
        foretag: o.contact?.companyName || "",
        steg_id: o.pipelineStageId || "",
        steg_namn: s?.namn || "",
        varde: Number(o.monetaryValue) || 0,
        kalla: o.source || "",
        steg_sedan: o.lastStageChangeAt || o.updatedAt || null,
        senast_aktivitet: o.updatedAt || null,
        status: o.status || "open",
        updated_at: nu,
      });
    }
  }
  return rader;
}

async function hamtaSteg(token: string, locationId: string): Promise<Map<string, GhlSteg>> {
  const karta = new Map<string, GhlSteg>();
  const r = await fetch(`${BASE}/opportunities/pipelines?locationId=${locationId}`, { headers: headers(token) });
  if (!r.ok) throw new Error(`MySales svarade ${r.status} på pipelines`);
  const d = await r.json();
  const pipelines: Array<{ id: string; name?: string; stages?: Array<{ id: string; name?: string }> }> = d?.pipelines || [];
  for (const p of pipelines) {
    for (const s of p.stages || []) {
      karta.set(s.id, { id: s.id, namn: s.name || "", pipelineId: p.id, pipelineNamn: p.name || "" });
    }
  }
  return karta;
}

/**
 * Alla affärer på locationen. Sidbrytning krävs: utan loopen tappas allt över 100
 * affärer tyst, och det syns inte förrän pipelinen vuxit förbi gränsen.
 */
async function hamtaAffarer(token: string, locationId: string): Promise<RaOpp[]> {
  const alla: RaOpp[] = [];
  let sida = `${BASE}/opportunities/search?location_id=${locationId}&limit=100`;
  for (let varv = 0; varv < 20; varv++) {
    const r = await fetch(sida, { headers: headers(token) });
    if (!r.ok) throw new Error(`MySales svarade ${r.status} på affärerna`);
    const d = await r.json();
    const del: RaOpp[] = d?.opportunities || [];
    alla.push(...del);
    const nasta = d?.meta?.nextPageUrl;
    if (!nasta || del.length < 100) break;
    sida = String(nasta);
  }
  return alla;
}

/** Håkans inställda pipeline-id:n för locationen (samma källa som Fokus won/lost-steg). */
async function hamtaValdaPipelines(locationId: string): Promise<Set<string>> {
  const valda = new Set<string>();
  const sb = supabaseService();
  const { data, error } = await sb.from("coach_users").select("personal_os").eq("ghl_location_id", locationId);
  if (error) return valda; // utan facit speglas allt — hellre för mycket än tyst tomt
  for (const u of ((data as Array<{ personal_os: Record<string, unknown> | null }> | null) || [])) {
    const os = u.personal_os || {};
    if (typeof os.__ghl_pipeline_id === "string" && os.__ghl_pipeline_id) valda.add(os.__ghl_pipeline_id);
  }
  return valda;
}

/**
 * Tidsstämpeln på spegeln för de här tenanterna. null = aldrig synkad.
 *
 * ⚠ En misslyckad select ger `data: null` — exakt som en tom tabell. Utan
 * error-kollen nedan skulle ett trasigt anrop se ut som "aldrig synkad", vilket i sin
 * tur skulle trigga en synk varje sidladdning. Felet ska bubbla, inte maskeras.
 */
export async function senastSynkadFokus(tenantIds: string[]): Promise<string | null> {
  if (!tenantIds.length) return null;
  const sb = supabaseService();
  const { data, error } = await sb
    .from("fokus_opportunities")
    .select("updated_at")
    .in("tenant_id", tenantIds)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  const rad = ((data as Array<{ updated_at: string | null }> | null) || [])[0];
  return rad?.updated_at || null;
}

/**
 * Hämtar pipelinen ur MySales och speglar den i `fokus_opportunities`.
 *
 * Hoppar över om spegeln är färskare än tio minuter, om inte `tvinga` är satt
 * ("Synka nu"-knappen). Misslyckas anropet lämnas spegeln orörd och felet returneras —
 * vyn visar då gammal data MED sin ålder utskriven, i stället för att krascha eller
 * ljuga.
 */
export async function synkaFokus(clientId: string, tvinga = false): Promise<FokusSynkResultat> {
  let ids: string[] = [];
  try {
    const ghl = await resolveCoachGhl(clientId);
    ids = ghl.ids;
    const { token, locationId } = ghl;
    if (!ids.length || !locationId) return { ok: false, ids, fel: "Klienten är inte kopplad till MySales." };
    if (!token) return { ok: false, ids, fel: "Ingen MySales-nyckel finns sparad för klienten." };

    if (!tvinga) {
      const senast = await senastSynkadFokus(ids);
      if (!borSynkaOm(senast)) return { ok: true, ids, hoppadeOver: true };
    }

    const [steg, valda] = await Promise.all([hamtaSteg(token, locationId), hamtaValdaPipelines(locationId)]);
    const allaPipelines = Array.from(new Set(Array.from(steg.values()).map((s) => s.pipelineId)));
    const pipelineIds = valjPipelineIds(allaPipelines, valda);

    const opps = await hamtaAffarer(token, locationId);
    const nu = new Date().toISOString();
    const rader = byggSpegelrader(opps, steg, pipelineIds, ids, nu);

    const sb = supabaseService();
    if (rader.length) {
      const { error } = await sb
        .from("fokus_opportunities")
        .upsert(rader, { onConflict: "tenant_id,ghl_opportunity_id" });
      if (error) return { ok: false, ids, fel: `Kunde inte spara spegeln: ${error.message}` };
    }

    // Affärer som inte längre hör hemma här ska bort. Vi läste HELA locationen, så
    // "saknas i listan" är ett konstaterande och inte en gissning: affären är antingen
    // raderad i MySales eller flyttad till en pipeline vi inte speglar. Ligger den kvar
    // dyker en död affär upp som dagens viktigaste drag.
    let borttagna = 0;
    const kvar = Array.from(new Set(rader.map((r) => r.ghl_opportunity_id)));
    let bort = sb.from("fokus_opportunities").delete({ count: "exact" }).in("tenant_id", ids);
    if (kvar.length) bort = bort.not("ghl_opportunity_id", "in", `(${kvar.map((id) => `"${id}"`).join(",")})`);
    const { count, error: bortFel } = await bort;
    if (bortFel) return { ok: false, ids, fel: `Kunde inte städa spegeln: ${bortFel.message}` };
    borttagna = count || 0;

    return { ok: true, ids, antal: kvar.length, borttagna };
  } catch (e) {
    return { ok: false, ids, fel: (e as Error).message };
  }
}

export interface SynkStatus {
  senastSynkad: string | null;
  fel: string | null;
}

/**
 * Det varje MySales-läsande vy ska anropa innan den läser spegeln: synka om det behövs,
 * och returnera alltid åldern så vyn kan skriva ut den. Ett fel stoppar aldrig läsningen
 * — men det får heller aldrig döljas.
 */
export async function synkaOchStatus(clientId: string, tvinga = false): Promise<SynkStatus> {
  const res = await synkaFokus(clientId, tvinga);
  let senastSynkad: string | null = null;
  try {
    senastSynkad = await senastSynkadFokus(res.ids);
  } catch {
    /* åldern kunde inte läsas — vyn visar "okänd ålder", aldrig "färsk" */
  }
  return { senastSynkad, fel: res.ok ? null : res.fel || "Okänt fel mot MySales" };
}
