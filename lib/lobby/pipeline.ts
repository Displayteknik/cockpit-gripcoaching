// Nya leads ↔ MySales-pipelinen — vilka lobby-kontakter som redan är affärer.
//
// ⚠ GHL:s `status`-fält är ALDRIG facit. Verifierat mot Displayteknik-locationen
// (cZzTvCeFRDLinf5Ha3je) 2026-08-03: samtliga affärer i "Kund pipeline DT" svarar
// status="open" — även de som står i steget "Vunnen (order)" och de som står i
// "Förlorad / Paus (nurture)". Ett filter på `status !== "open"` släpper alltså igenom
// ALLT som "aktivt", och då blir ett lead vars affär lagts ner i MySales permanent
// osynligt i Nya leads: det kan aldrig bearbetas igen.
//
// Vunnet/förlorat härleds därför ur STEGET (`harledStatus`), precis som Fokusmotorn och
// HQ gör. Håkans inställda steg-id:n (coach_users.personal_os) är facit, stegnamnet är
// reserv för en pipeline som aldrig konfigurerats.
//
// Vad som göms ur Nya leads:
//   open  → affären är i spel i MySales  → göms, den hör hemma i Fokus idag
//   won   → kontakten är kund            → göms, en kund är inget nytt lead
//   lost  → affären är nedlagd/pausad    → SYNS igen och får bearbetas på nytt
//
// Nedlagt slår också lead-status "passed" (satt en gång av /api/lobby/sync när kontakten
// skickades till MySales, och aldrig nollställd sedan). Utan det vore leadet fortfarande
// osynligt — bara av den andra spärren — och hela fixen vore verkningslös.

import { harledStatus } from "@/lib/hq/pipeline";

/** Det spegeln behöver ge oss för att avgöra om en kontakt är i pipelinen. */
export interface PipelineOpp {
  kontakt: string | null;
  ghl_contact_id: string | null;
  steg_id: string | null;
  steg_namn: string | null;
}

export interface PipelineIndex {
  /** ghl_contact_id → steg_namn. SÄKER match: kontakten ÄR affären. */
  perId: Map<string, string>;
  /** normaliserat namn → steg_namn. OSÄKER match: två personer kan heta samma. */
  perNamn: Map<string, string>;
  /**
   * ghl_contact_id → steg_namn för kontakter vars ENDA affär(er) är nedlagda.
   *
   * Den här är skälet till att leadet får synas igen trots att det en gång skickades
   * till MySales (lead-status "passed"). Bara SÄKER match räknas: att någon med samma
   * namn har en nedlagd affär bevisar ingenting.
   */
  nedlagdaPerId: Map<string, string>;
}

/** Namn matchas löst — fokus_opportunities har varken e-post eller telefon att gå på. */
export function normNamn(s: string | null | undefined): string {
  return (s || "").trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Bygger uppslaget som avgör vilka lobby-kontakter som göms ur Nya leads.
 *
 * Nedlagda affärer (steget = förlorat/paus) lämnas medvetet UTANFÖR båda kartorna: de
 * ska varken dölja leadet eller flagga det, för leadet är fritt att jobba med igen.
 * En kontakt som bär både en nedlagd och en levande affär göms ändå — den levande
 * affären lägger in sig och vinner.
 */
export function byggPipelineIndex(
  opps: PipelineOpp[],
  vinnare: Set<string>,
  forlorare: Set<string>,
): PipelineIndex {
  const perId = new Map<string, string>();
  const perNamn = new Map<string, string>();
  const nedlagdaPerId = new Map<string, string>();
  const nedlagda: PipelineOpp[] = [];

  for (const o of opps) {
    if (harledStatus(o.steg_id, o.steg_namn, vinnare, forlorare) === "lost") {
      nedlagda.push(o);
      continue;
    }
    const steg = o.steg_namn || "";
    if (o.ghl_contact_id && !perId.has(o.ghl_contact_id)) perId.set(o.ghl_contact_id, steg);
    const namn = normNamn(o.kontakt);
    if (namn && !perNamn.has(namn)) perNamn.set(namn, steg);
  }

  // Först när ALLA levande affärer är inlagda vet vi att kontakten inte har någon kvar.
  for (const o of nedlagda) {
    if (!o.ghl_contact_id || perId.has(o.ghl_contact_id) || nedlagdaPerId.has(o.ghl_contact_id)) continue;
    nedlagdaPerId.set(o.ghl_contact_id, o.steg_namn || "");
  }
  return { perId, perNamn, nedlagdaPerId };
}
