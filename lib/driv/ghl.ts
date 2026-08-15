// DRIV-1 — GHL-läsning för kortet: konversationer, meddelanden och kontaktdetaljer.
// Samma nyckel som HQ redan använder (hamtaHqGhl). LÄS-ONLY utom uppgiftsskapandet i
// städningen (skapaUppgift), som kräver contacts.write.
//
// API-kontrakt verifierat mot GHL:s öppna OpenAPI-spec (highlevel-api-docs, 2026-08-15)
// och mot skarp data i DRIV-0:
//   GET  /conversations/search?locationId=&contactId=   → conversations.readonly
//   GET  /conversations/{id}/messages                   → conversations/message.readonly
//   GET  /contacts/{id}                                  → contacts.readonly
//   POST /contacts/{id}/tasks                            → contacts.write (saknas idag, se DRIV-0)

import type { HqGhl } from "@/lib/hq/pipeline";

const BASE = "https://services.leadconnectorhq.com";
const VERSION = "2021-07-28";

function headers(pit: string): Record<string, string> {
  return { Authorization: `Bearer ${pit}`, Version: VERSION, Accept: "application/json" };
}

export interface GhlKonversation {
  id: string;
  contactId: string;
  type: string; // TYPE_PHONE / TYPE_EMAIL / TYPE_FB_MESSENGER / TYPE_REVIEW / TYPE_GROUP_SMS
  lastMessageBody: string;
  lastMessageType: string;
  unreadCount: number;
}

export interface GhlMeddelande {
  id: string;
  conversationId: string;
  messageType: string;
  dateAdded: string;
  body: string;
  direction: "inbound" | "outbound" | null;
}

/** Alla konversationer för en kontakt (SMS, e-post via GHL, socialt, samtalslogg). */
export async function hamtaKonversationer(cfg: HqGhl, ghlContactId: string): Promise<GhlKonversation[]> {
  const r = await fetch(`${BASE}/conversations/search?locationId=${cfg.locationId}&contactId=${ghlContactId}&limit=25`, {
    headers: headers(cfg.pit),
  });
  if (!r.ok) throw new Error(`GHL-konversationer svarade ${r.status}`);
  const d = await r.json();
  return (d?.conversations || []) as GhlKonversation[];
}

/**
 * Meddelanden i en konversation. Snippet klipps till 200 tecken redan här — den fulla
 * kroppen lagras aldrig i vår databas (1C), samma disciplin som Gmail-vägen.
 */
export async function hamtaMeddelanden(cfg: HqGhl, conversationId: string): Promise<GhlMeddelande[]> {
  const r = await fetch(`${BASE}/conversations/${conversationId}/messages?limit=20`, { headers: headers(cfg.pit) });
  if (!r.ok) throw new Error(`GHL-meddelanden svarade ${r.status}`);
  const d = await r.json();
  return (d?.messages?.messages || d?.messages || []) as GhlMeddelande[];
}

export interface GhlKontakt {
  id: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  tags?: string[];
}

/** Live kontaktdetalj — telefon och taggar finns inte i pipelinespegeln, hämtas på klick. */
export async function hamtaKontakt(cfg: HqGhl, ghlContactId: string): Promise<GhlKontakt | null> {
  const r = await fetch(`${BASE}/contacts/${ghlContactId}`, { headers: headers(cfg.pit) });
  if (!r.ok) return null;
  const d = await r.json();
  return (d?.contact || null) as GhlKontakt | null;
}

export interface GhlUppgift { id: string; title: string; dueDate: string; completed: boolean }

export async function hamtaUppgifterForKontakt(cfg: HqGhl, ghlContactId: string): Promise<GhlUppgift[]> {
  const r = await fetch(`${BASE}/contacts/${ghlContactId}/tasks`, { headers: headers(cfg.pit) });
  if (!r.ok) return [];
  const d = await r.json();
  return (d?.tasks || []) as GhlUppgift[];
}

/**
 * Skapar en uppgift på KONTAKTEN. ⚠ GHL:s publika API har ingen affärs-scopad
 * uppgiftsändpunkt (verifierat mot OpenAPI-specen 2026-08-15) — uppgiften kan bara fästas
 * på kontakten, aldrig på en specifik opportunity. En kontakt med flera öppna affärer får
 * därför titeln disambiguerad med affärens namn, se lib/driv/stadning.ts.
 */
export async function skapaUppgift(
  cfg: HqGhl,
  ghlContactId: string,
  titel: string,
  dueDateIso: string,
): Promise<{ ok: boolean; fel?: string }> {
  const r = await fetch(`${BASE}/contacts/${ghlContactId}/tasks`, {
    method: "POST",
    headers: { ...headers(cfg.pit), "Content-Type": "application/json" },
    body: JSON.stringify({ title: titel, dueDate: dueDateIso, completed: false }),
  });
  if (!r.ok) return { ok: false, fel: `GHL svarade ${r.status}: ${(await r.text()).slice(0, 300)}` };
  return { ok: true };
}

/** Uppdaterar en befintlig uppgift (nytt datum/titel, eller klarmarkerar den). */
export async function uppdateraUppgift(
  cfg: HqGhl,
  ghlContactId: string,
  taskId: string,
  titel: string,
  dueDateIso: string,
  completed = false,
): Promise<{ ok: boolean; fel?: string }> {
  const r = await fetch(`${BASE}/contacts/${ghlContactId}/tasks/${taskId}`, {
    method: "PUT",
    headers: { ...headers(cfg.pit), "Content-Type": "application/json" },
    body: JSON.stringify({ title: titel, dueDate: dueDateIso, completed }),
  });
  if (!r.ok) return { ok: false, fel: `GHL svarade ${r.status}: ${(await r.text()).slice(0, 300)}` };
  return { ok: true };
}

/** DRIV-4 "Klart" — klarmarkerar den tidigast förfallande öppna uppgiften, om en finns. */
export async function markeraTidigasteUppgiftKlar(cfg: HqGhl, ghlContactId: string): Promise<{ ok: boolean; fel?: string }> {
  const befintliga = await hamtaUppgifterForKontakt(cfg, ghlContactId);
  const oppen = befintliga.filter((u) => !u.completed).sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  if (!oppen) return { ok: true }; // inget att klarmarkera, inte ett fel
  return uppdateraUppgift(cfg, ghlContactId, oppen.id, oppen.title, oppen.dueDate, true);
}

/**
 * DRIV-2 — sätt/ändra nästa steg. Uppdaterar den TIDIGAST förfallande öppna uppgiften om
 * en sådan finns (det ÄR "nästa steg" i UI:t), annars skapar en ny. Aldrig en andra öppen
 * uppgift bredvid — det skulle ge två motstridiga "nästa steg" på samma kontakt.
 */
export async function sattNastaSteg(
  cfg: HqGhl,
  ghlContactId: string,
  titel: string,
  dueDateIso: string,
): Promise<{ ok: boolean; fel?: string }> {
  const befintliga = await hamtaUppgifterForKontakt(cfg, ghlContactId);
  const oppna = befintliga.filter((u) => !u.completed).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  if (oppna[0]) return uppdateraUppgift(cfg, ghlContactId, oppna[0].id, titel, dueDateIso);
  return skapaUppgift(cfg, ghlContactId, titel, dueDateIso);
}

/** DRIV-2 — sparar en anteckning på kontakten (fritext eller Prata in-transkribering). */
export async function skapaNotering(cfg: HqGhl, ghlContactId: string, text: string): Promise<{ ok: boolean; fel?: string }> {
  const r = await fetch(`${BASE}/contacts/${ghlContactId}/notes`, {
    method: "POST",
    headers: { ...headers(cfg.pit), "Content-Type": "application/json" },
    body: JSON.stringify({ body: text }),
  });
  if (!r.ok) return { ok: false, fel: `GHL svarade ${r.status}: ${(await r.text()).slice(0, 300)}` };
  return { ok: true };
}

// GHL:s konversationstyp → sändningens `type`-fält. SMS/samtal/socialt skickas alla via
// samma /conversations/messages-endpoint, bara `type` skiljer.
const SAND_TYP: Record<string, string> = {
  TYPE_PHONE: "SMS", TYPE_EMAIL: "Email", TYPE_FB_MESSENGER: "FB", TYPE_GROUP_SMS: "SMS",
};

/**
 * DRIV-2 — svarar i en BEFINTLIG GHL-konversation. Kanalen är låst till den konversationen
 * redan har (spec: "ingen kanalväxling utan att Håkan väljer det") — `typ` kommer alltid
 * från den konversation svaret hör till, aldrig gissat.
 */
export async function skickaGhlMeddelande(
  cfg: HqGhl,
  ghlContactId: string,
  konversationTyp: string,
  text: string,
): Promise<{ ok: boolean; fel?: string }> {
  const typ = SAND_TYP[konversationTyp] || "SMS";
  const r = await fetch(`${BASE}/conversations/messages`, {
    method: "POST",
    headers: { ...headers(cfg.pit), "Content-Type": "application/json" },
    body: JSON.stringify({ type: typ, contactId: ghlContactId, message: text }),
  });
  if (!r.ok) return { ok: false, fel: `GHL svarade ${r.status}: ${(await r.text()).slice(0, 300)}` };
  return { ok: true };
}

export interface StegInfo { aktuellId: string; pipelineNamn: string; steg: { id: string; namn: string }[] }

/**
 * Stegkartan för EN affär — samma mönster som `/api/fokus/board` bygger för hela listan
 * (`stegKarta`), här för ett enda steg-id. Best-effort: kortet fungerar utan stegraden.
 */
export async function hamtaStegInfo(cfg: HqGhl, aktuelltStegId: string | null): Promise<StegInfo | null> {
  if (!aktuelltStegId) return null;
  const r = await fetch(`${BASE}/opportunities/pipelines?locationId=${cfg.locationId}`, { headers: headers(cfg.pit) });
  if (!r.ok) return null;
  const d = await r.json();
  const pipelines: Array<{ name: string; stages?: Array<{ id: string; name: string }> }> = d?.pipelines || [];
  for (const p of pipelines) {
    const lista = (p.stages || []).map((s) => ({ id: s.id, namn: s.name }));
    if (lista.some((s) => s.id === aktuelltStegId)) {
      return { aktuellId: aktuelltStegId, pipelineNamn: p.name || "", steg: lista };
    }
  }
  return null;
}
