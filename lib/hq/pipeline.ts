// HQ-1 — läser MySales-pipelinen (GoHighLevel) och speglar den i hq_pipeline_cache.
//
// LÄS-ONLY. HQ skriver aldrig något till GHL. Affärspipelinen ägs av MySales, och den
// som ändrar ett kort gör det där. Utan den regeln får Håkan dubbelinmatning, och det
// var hela poängen med att inte bygga en egen offerttabell.
//
// API-kontrakt verifierat mot live-API 2026-08-02 (Displayteknik-locationen):
//   GET /opportunities/pipelines?locationId=<loc>            → pipelines + stages (id, name, position)
//   GET /opportunities/search?location_id=<loc>&limit=100    → affärer, snake_case query (POST-body ger 422)
//   GET /contacts/<id>/tasks                                 → { tasks: [{ title, dueDate, completed }] }
// Headers: Authorization: Bearer <pit>, Version: 2021-07-28
//
// ⚠ GHL:s status-fält är INTE sanningen om vunnet/förlorat. Alla 51 DT-affärer svarade
// status="open", varav 11 stod i steget "Vunnen (order)" och 11 i "Förlorad / Paus".
// Vunnet/förlorat härleds därför ur STEGET, inte ur status.

import { supabaseService } from "@/lib/supabase-admin";
import { standardSannolikhet } from "@/lib/hq/likviditet";

const BASE = "https://services.leadconnectorhq.com";
const VERSION = "2021-07-28";

// Hur färsk spegeln måste vara innan en sidladdning får trigga en ny synk.
export const SYNK_INTERVALL_MS = 10 * 60 * 1000;

// Displayteknik i clients-tabellen. Slås upp på id, med namnet som reserv om id:t
// någon gång byts — utan uppslaget står HQ utan pipeline och det syns inte i UI:t.
const DT_CLIENT_ID = "a6a33547-5ca7-475f-9a62-43ff2c74d000";

export interface HqGhl {
  locationId: string;
  pit: string;
  kalla: "env" | "klientrad";
}

export interface PipelineRad {
  ghl_opportunity_id: string;
  location_id: string;
  namn: string | null;
  kontakt: string | null;
  foretag: string | null;
  ghl_contact_id: string | null;
  pipeline_id: string | null;
  pipeline_namn: string | null;
  steg_id: string | null;
  steg_namn: string | null;
  steg_position: number | null;
  varde: number;
  status: string | null;
  harledd_status: "open" | "won" | "lost";
  steg_sedan: string | null;
  senast_uppdaterad: string | null;
  uppfoljning_datum: string | null;
  uppfoljning_titel: string | null;
  antal_uppgifter: number;
  senast_synkad: string;
}

function headers(pit: string): Record<string, string> {
  return { Authorization: `Bearer ${pit}`, Version: VERSION, Accept: "application/json" };
}

/**
 * Nyckeln till MySales. Server-only: värdet lämnar aldrig den här processen.
 * Env-variablerna vinner (HQ_GHL_PIT + HQ_GHL_LOCATION_ID). Saknas de läses
 * Displayteknik-klientens redan sparade koppling, så HQ fungerar utan ny konfiguration.
 */
export async function hamtaHqGhl(): Promise<HqGhl | null> {
  const pit = (process.env.HQ_GHL_PIT || "").trim();
  const loc = (process.env.HQ_GHL_LOCATION_ID || "").trim();
  if (pit && loc) return { locationId: loc, pit, kalla: "env" };

  const sb = supabaseService();
  const { data } = await sb
    .from("clients")
    .select("id, name, ghl_location_id, ghl_pit")
    .or(`id.eq.${DT_CLIENT_ID},name.ilike.Displayteknik`);
  const rad = ((data as Array<{ ghl_location_id: string | null; ghl_pit: string | null }> | null) || []).find(
    (c) => c.ghl_location_id && c.ghl_pit,
  );
  if (!rad) return null;
  return { locationId: String(rad.ghl_location_id), pit: String(rad.ghl_pit), kalla: "klientrad" };
}

interface Steg {
  namn: string;
  position: number;
  pipelineId: string;
  pipelineNamn: string;
}

async function hamtaSteg(cfg: HqGhl): Promise<Map<string, Steg>> {
  const karta = new Map<string, Steg>();
  const r = await fetch(`${BASE}/opportunities/pipelines?locationId=${cfg.locationId}`, { headers: headers(cfg.pit) });
  if (!r.ok) throw new Error(`Pipelinerna svarade ${r.status}`);
  const d = await r.json();
  const pipelines: Array<{ id: string; name: string; stages?: Array<{ id: string; name: string; position: number }> }> =
    d?.pipelines || [];
  for (const p of pipelines) {
    for (const s of p.stages || []) {
      karta.set(s.id, { namn: s.name, position: Number(s.position) || 0, pipelineId: p.id, pipelineNamn: p.name || "" });
    }
  }
  return karta;
}

interface RaOpp {
  id: string;
  name?: string;
  monetaryValue?: number;
  pipelineId?: string;
  pipelineStageId?: string;
  status?: string;
  lastStageChangeAt?: string;
  updatedAt?: string;
  contactId?: string;
  contact?: { name?: string; companyName?: string };
}

// Sidbrytning: search returnerar meta.startAfter/startAfterId. Utan loopen tappas allt
// över 100 affärer tyst, och det syns inte förrän pipelinen vuxit.
async function hamtaAffarer(cfg: HqGhl): Promise<RaOpp[]> {
  const alla: RaOpp[] = [];
  let sida = `${BASE}/opportunities/search?location_id=${cfg.locationId}&limit=100`;
  for (let varv = 0; varv < 20; varv++) {
    const r = await fetch(sida, { headers: headers(cfg.pit) });
    if (!r.ok) throw new Error(`Affärerna svarade ${r.status}`);
    const d = await r.json();
    const del: RaOpp[] = d?.opportunities || [];
    alla.push(...del);
    const nasta = d?.meta?.nextPageUrl;
    if (!nasta || del.length < 100) break;
    sida = String(nasta);
  }
  return alla;
}

interface Uppgift {
  datum: string;
  titel: string;
}

/**
 * Uppföljningsdatum bor på uppgifterna hos kontakten, inte på affären. Vi hämtar bara
 * för kontakter som fortfarande är i spel, så en vunnen eller förlorad affär inte kostar
 * ett anrop i onödan. Åtta parallella anrop åt gången: snabbt nog utan att sabla API:t.
 */
async function hamtaUppgifter(cfg: HqGhl, kontaktIds: string[]): Promise<Map<string, { tidigast: Uppgift | null; antal: number }>> {
  const ut = new Map<string, { tidigast: Uppgift | null; antal: number }>();
  for (let i = 0; i < kontaktIds.length; i += 8) {
    const grupp = kontaktIds.slice(i, i + 8);
    await Promise.all(
      grupp.map(async (id) => {
        try {
          const r = await fetch(`${BASE}/contacts/${id}/tasks`, { headers: headers(cfg.pit) });
          if (!r.ok) return;
          const d = await r.json();
          const oppna: Array<{ title?: string; dueDate?: string; completed?: boolean }> = (d?.tasks || []).filter(
            (t: { completed?: boolean; dueDate?: string }) => !t.completed && t.dueDate,
          );
          if (!oppna.length) return;
          oppna.sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));
          ut.set(id, {
            tidigast: { datum: String(oppna[0].dueDate), titel: String(oppna[0].title || "Uppgift") },
            antal: oppna.length,
          });
        } catch {
          /* en kontakt som inte svarar får sakna uppgifter, resten ska ändå in */
        }
      }),
    );
  }
  return ut;
}

/**
 * Vunnet/förlorat ur steget. Håkans egna inställda steg-id:n (sparade av MySales Coach
 * i coach_users.personal_os) är facit. Saknas de faller vi tillbaka på stegnamnet, så en
 * pipeline som aldrig konfigurerats ändå räknas rätt.
 */
export function harledStatus(
  stegId: string | null,
  stegNamn: string | null,
  vinnare: Set<string>,
  forlorare: Set<string>,
): "open" | "won" | "lost" {
  if (stegId && vinnare.has(stegId)) return "won";
  if (stegId && forlorare.has(stegId)) return "lost";
  const n = (stegNamn || "").toLowerCase();
  if (/vunn|\bwon\b|payment made|\bsold\b|betald/.test(n)) return "won";
  if (/förlorad|forlorad|\blost\b|paus/.test(n)) return "lost";
  return "open";
}

/**
 * Håkans egna inställningar för locationen: vinst- och förluststeg samt vilken pipeline
 * som faktiskt används. Samma källa som Fokusmotorn läser, så vyerna aldrig motsäger
 * varandra. Tom mängd = inget facit, då gäller fallbacken.
 */
export async function hamtaStegFacit(
  locationId: string,
): Promise<{ vinnare: Set<string>; forlorare: Set<string>; pipelines: Set<string> }> {
  const vinnare = new Set<string>();
  const forlorare = new Set<string>();
  const pipelines = new Set<string>();
  try {
    const sb = supabaseService();
    const { data } = await sb.from("coach_users").select("personal_os").eq("ghl_location_id", locationId);
    for (const u of ((data as Array<{ personal_os: Record<string, unknown> | null }> | null) || [])) {
      const os = u.personal_os || {};
      if (typeof os.__ghl_won_stage_id === "string" && os.__ghl_won_stage_id) vinnare.add(os.__ghl_won_stage_id);
      if (typeof os.__ghl_lost_stage_id === "string" && os.__ghl_lost_stage_id) forlorare.add(os.__ghl_lost_stage_id);
      if (typeof os.__ghl_pipeline_id === "string" && os.__ghl_pipeline_id) pipelines.add(os.__ghl_pipeline_id);
    }
  } catch {
    /* utan facit räcker stegnamnen */
  }
  return { vinnare, forlorare, pipelines };
}

/**
 * Vilka pipelines som ska räknas. Spegeln lagrar ALLT som finns i MySales, men GHL:s
 * standardpipelines ("Sales Pipeline", "YOUR PROMOTION" med flera) innehåller gamla kort
 * som aldrig varit riktiga affärer. Håkans inställda pipeline styr urvalet.
 * ⚠ Tom mängd betyder "visa allt" — hellre för mycket än att tyst dölja hela pipelinen
 * för att en inställning saknas.
 */
export async function hamtaValdaPipelines(locationId: string): Promise<Set<string>> {
  return (await hamtaStegFacit(locationId)).pipelines;
}

/**
 * LIKVID-1 — ser till att varje steg har en sannolikhet att väga med.
 *
 * Viktningen i "I spel, ofakturerat" och i likviditetsprognosens kundinbetalningar
 * måste bygga på en siffra per steg. Den siffran får inte vara hårdkodad i en formel
 * ingen ser, därför läggs den i en tabell ägaren kan ändra. Utgångspunkten räknas ur
 * stegets plats bland de steg som är i spel.
 *
 * ⚠ En rad där ägaren satt sin egen siffra (`agarsatt`) skrivs ALDRIG över av synken.
 */
async function seedaSannolikheter(
  steg: Map<string, Steg>,
  facit: { vinnare: Set<string>; forlorare: Set<string> },
): Promise<void> {
  const sb = supabaseService();
  const { data } = await sb.from("hq_steg_sannolikhet").select("steg_id, agarsatt, procent");
  const kanda = new Map(
    ((data as Array<{ steg_id: string; agarsatt: boolean; procent: number }> | null) || []).map((r) => [r.steg_id, r]),
  );

  const perPipeline = new Map<string, Array<{ id: string; s: Steg; status: "open" | "won" | "lost" }>>();
  for (const [id, s] of steg) {
    const lista = perPipeline.get(s.pipelineId) || [];
    lista.push({ id, s, status: harledStatus(id, s.namn, facit.vinnare, facit.forlorare) });
    perPipeline.set(s.pipelineId, lista);
  }

  const rader: Array<Record<string, unknown>> = [];
  for (const [pipelineId, lista] of perPipeline) {
    const iSpel = lista.filter((x) => x.status === "open").sort((a, b) => a.s.position - b.s.position);
    for (const x of lista) {
      const befintlig = kanda.get(x.id);
      if (befintlig?.agarsatt) continue; // ägarens egen siffra vinner alltid
      const plats = iSpel.findIndex((y) => y.id === x.id);
      const procent =
        x.status === "won" ? 100 : x.status === "lost" ? 0 : standardSannolikhet(plats, iSpel.length);
      if (befintlig && befintlig.procent === procent) continue;
      rader.push({
        steg_id: x.id,
        pipeline_id: pipelineId,
        steg_namn: x.s.namn,
        position: x.s.position,
        procent,
        agarsatt: false,
        uppdaterad: new Date().toISOString(),
      });
    }
  }
  if (rader.length) await sb.from("hq_steg_sannolikhet").upsert(rader, { onConflict: "steg_id" });
}

export interface SynkResultat {
  ok: boolean;
  antal?: number;
  hoppadeOver?: boolean; // spegeln var färsk nog
  fel?: string;
}

/** Tidsstämpeln på spegeln. null = aldrig synkad. */
export async function senastSynkad(): Promise<string | null> {
  const sb = supabaseService();
  const { data } = await sb
    .from("hq_pipeline_cache")
    .select("senast_synkad")
    .order("senast_synkad", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as { senast_synkad: string } | null)?.senast_synkad || null;
}

/**
 * Synkar spegeln. Högst en gång per tio minuter om inte `tvinga` är satt
 * ("Uppdatera nu"-knappen). Misslyckas anropet lämnas spegeln orörd och felet
 * returneras — vyn visar då gammal data med sin tidsstämpel i stället för att krascha.
 */
export async function synkaPipeline(tvinga = false): Promise<SynkResultat> {
  try {
    if (!tvinga) {
      const senast = await senastSynkad();
      if (senast && Date.now() - new Date(senast).getTime() < SYNK_INTERVALL_MS) {
        return { ok: true, hoppadeOver: true };
      }
    }

    const cfg = await hamtaHqGhl();
    if (!cfg) return { ok: false, fel: "Ingen koppling till MySales är inlagd. Sätt HQ_GHL_PIT och HQ_GHL_LOCATION_ID." };

    const [steg, facit] = await Promise.all([hamtaSteg(cfg), hamtaStegFacit(cfg.locationId)]);
    // Sannolikheterna hålls i takt med pipelinen. Faller det lämnas synken orörd:
    // en vikt som saknas får aldrig stoppa spegeln.
    try {
      await seedaSannolikheter(steg, facit);
    } catch {
      /* prognosen faller tillbaka på 50 procent och säger det i vyn */
    }
    const affarer = await hamtaAffarer(cfg);

    // Uppgifter bara för affärer som fortfarande är i spel.
    const iSpel = affarer.filter((o) => {
      const s = o.pipelineStageId ? steg.get(o.pipelineStageId) : undefined;
      return harledStatus(o.pipelineStageId || null, s?.namn || null, facit.vinnare, facit.forlorare) === "open";
    });
    const kontaktIds = [...new Set(iSpel.map((o) => o.contactId).filter((v): v is string => !!v))];
    const uppgifter = await hamtaUppgifter(cfg, kontaktIds);

    const nu = new Date().toISOString();
    const rader: PipelineRad[] = affarer.map((o) => {
      const s = o.pipelineStageId ? steg.get(o.pipelineStageId) : undefined;
      const harledd = harledStatus(o.pipelineStageId || null, s?.namn || null, facit.vinnare, facit.forlorare);
      // Uppgiften sitter på KONTAKTEN, och samma kontakt kan bära flera affärer. Utan
      // det här villkoret ärver en vunnen eller förlorad affär kontaktens uppföljning
      // och dyker upp i morgonlistan trots att den är avslutad. Bara affärer i spel
      // ska påminna om något.
      const u = harledd === "open" && o.contactId ? uppgifter.get(o.contactId) : undefined;
      return {
        ghl_opportunity_id: o.id,
        location_id: cfg.locationId,
        namn: o.name || null,
        kontakt: o.contact?.name || null,
        foretag: o.contact?.companyName || null,
        ghl_contact_id: o.contactId || null,
        pipeline_id: o.pipelineId || null,
        pipeline_namn: s?.pipelineNamn || null,
        steg_id: o.pipelineStageId || null,
        steg_namn: s?.namn || null,
        steg_position: s?.position ?? null,
        varde: Number(o.monetaryValue) || 0,
        status: o.status || null,
        harledd_status: harledd,
        steg_sedan: o.lastStageChangeAt || null,
        senast_uppdaterad: o.updatedAt || null,
        uppfoljning_datum: u?.tidigast?.datum || null,
        uppfoljning_titel: u?.tidigast?.titel || null,
        antal_uppgifter: u?.antal || 0,
        senast_synkad: nu,
      };
    });

    const sb = supabaseService();
    if (rader.length) {
      const { error } = await sb.from("hq_pipeline_cache").upsert(rader, { onConflict: "ghl_opportunity_id" });
      if (error) return { ok: false, fel: `Kunde inte spara spegeln: ${error.message}` };
    }
    // Affärer som tagits bort i MySales ska inte ligga kvar och räknas med.
    const kvar = rader.map((r) => r.ghl_opportunity_id);
    let bort = sb.from("hq_pipeline_cache").delete().eq("location_id", cfg.locationId);
    if (kvar.length) bort = bort.not("ghl_opportunity_id", "in", `(${kvar.map((id) => `"${id}"`).join(",")})`);
    await bort;

    return { ok: true, antal: rader.length };
  } catch (e) {
    return { ok: false, fel: (e as Error).message };
  }
}

/** Läser spegeln. Rör aldrig GHL. */
export async function lasPipeline(): Promise<PipelineRad[]> {
  const sb = supabaseService();
  const { data } = await sb.from("hq_pipeline_cache").select("*");
  return ((data as PipelineRad[] | null) || []).map((r) => ({ ...r, varde: Number(r.varde) || 0 }));
}
