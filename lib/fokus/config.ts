// Fokusmotorn — stegmappning & SLA. "Vilken verksamhet som helst" lever här (spec §2.2, §6).
// Ny kund = ny mappning, noll ny kod: vi matchar på stegnamn, inte på hårdkodade id:n.
import type { StegRegel, TenantConfig } from "./types";

/** Tar bort diakriter så matchning tål å/ä/ö oavsett teckenkodning. */
function norm(s: string): string {
  return (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Pilot-defaults för Displayteknik (spec §2.2). En annan verksamhet ändrar bara siffrorna.
 * Ordningen spelar roll: första matchande regel vinner.
 */
const PILOT_REGLER: Array<{ test: RegExp; regel: StegRegel }> = [
  { test: /offert skickad|forslag|offert ut/, regel: { typ: "offert", namn: "Offert skickad", vikt: 3.0, sla: 3 } },
  { test: /uppfoljning|follow/, regel: { typ: "uppfoljning", namn: "Uppföljning", vikt: 3.5, sla: 7 } },
  { test: /forhandling|andring|forhandl/, regel: { typ: "uppfoljning", namn: "Förhandling", vikt: 3.5, sla: 3 } },
  { test: /mote genomfort|genomfort|demo held|halls/, regel: { typ: "mote", namn: "Möte genomfört", vikt: 2.0, sla: 2 } },
  { test: /mote bokat|bokad|booked|provklippning/, regel: { typ: "kontakt", namn: "Möte bokat", vikt: 1.5, sla: null } },
  { test: /kvalif|passar/, regel: { typ: "kontakt", namn: "Kvalificerad", vikt: 1.0, sla: 5 } },
  { test: /nytt lead|ny kontakt|new lead|lead/, regel: { typ: "kontakt", namn: "Ny kontakt", vikt: 1.0, sla: 5 } },
];

const DEFAULT_FALLBACK: StegRegel = { typ: "kontakt", namn: "Övrigt steg", vikt: 1.0, sla: 5 };

/** Matcha ett enskilt stegnamn mot pilotreglerna. */
export function regelForSteg(stegNamn: string): StegRegel {
  const n = norm(stegNamn);
  for (const { test, regel } of PILOT_REGLER) if (test.test(n)) return { ...regel };
  return { ...DEFAULT_FALLBACK };
}

/**
 * Bygg tenant-config ur en GHL-pipeline. Won/lost-steg kommer ur den sparade
 * personal_os-configen — de har status 'open' i GHL, så steg-id är sanningen (verifierat live).
 */
export function buildConfigFromStages(
  pipeline: { id: string; namn: string },
  steg: Array<{ id: string; namn: string }>,
  cfgRaw: Record<string, string>,
): TenantConfig {
  const stegMap: Record<string, StegRegel> = {};
  for (const s of steg) stegMap[s.id] = regelForSteg(s.namn);
  return {
    pipelineId: pipeline.id,
    pipelineNamn: pipeline.namn,
    wonStageId: cfgRaw.__ghl_won_stage_id || "",
    lostStageId: cfgRaw.__ghl_lost_stage_id || "",
    stegMap,
    fallback: { ...DEFAULT_FALLBACK },
  };
}
