import { supabaseService } from "./supabase-admin";

// IDENTITETSBRYGGA — Cockpit-klient → MySales Coach `coach_users` (delad Supabase).
// Offert/Fokus-data nycklas mot coach_users.id (pionjar-appens browser-UUID), inte
// clients.id. Bryggan = delad GHL-location: clients.ghl_location_id == coach_users.ghl_location_id.
// 1:many (pionjar mintar en coach_user per enhet/session) → returnerar ALLA matchande.
// OBS: härda ALDRIG coach_*/offert-tabellernas RLS — live pionjar-appen läser dem via anon.
// Cockpit tenant-låser i app-lagret (denna brygga + service-role), Path A.
export async function resolveCoachUserIds(clientId: string): Promise<string[]> {
  const sb = supabaseService();
  const { data: client } = await sb
    .from("clients")
    .select("ghl_location_id")
    .eq("id", clientId)
    .maybeSingle();
  const loc = client?.ghl_location_id;
  if (!loc) return []; // klient utan GHL-location → ingen Coach-koppling
  const { data: users } = await sb
    .from("coach_users")
    .select("id")
    .eq("ghl_location_id", loc);
  return ((users as { id: string }[] | null) || []).map((u) => u.id);
}

// Fokusmotorns config-behov: alla coach-tenant-id:n + won/lost-steg + location.
// Won/lost ligger i coach_users.personal_os (steg-id:n med status 'open' i GHL, se config.ts).
// DT delar location över 2 coach_users → vi slår ihop: första icke-tomma won/lost vinner.
export interface CoachContext {
  ids: string[];
  wonStageId: string;
  lostStageId: string;
  locationId: string;
}

export async function resolveCoachContext(clientId: string): Promise<CoachContext> {
  const sb = supabaseService();
  const { data: client } = await sb
    .from("clients")
    .select("ghl_location_id")
    .eq("id", clientId)
    .maybeSingle();
  const loc = client?.ghl_location_id;
  if (!loc) return { ids: [], wonStageId: "", lostStageId: "", locationId: "" };
  const { data: users } = await sb
    .from("coach_users")
    .select("id, personal_os")
    .eq("ghl_location_id", loc);
  const rows = (users as { id: string; personal_os: Record<string, unknown> | null }[] | null) || [];
  let wonStageId = "";
  let lostStageId = "";
  for (const u of rows) {
    const os = (u.personal_os || {}) as Record<string, unknown>;
    if (!wonStageId && typeof os.__ghl_won_stage_id === "string") wonStageId = os.__ghl_won_stage_id;
    if (!lostStageId && typeof os.__ghl_lost_stage_id === "string") lostStageId = os.__ghl_lost_stage_id;
  }
  return { ids: rows.map((u) => u.id), wonStageId, lostStageId, locationId: String(loc) };
}

// Server-only: hämta en giltig GHL-token för klientens Coach-koppling (för värde-write-back).
// Väljer första coach_user med token. Läcker ALDRIG token till klienten — bara server-side.
export async function resolveCoachGhl(
  clientId: string,
): Promise<{ ids: string[]; token: string; locationId: string }> {
  const sb = supabaseService();
  const { data: client } = await sb
    .from("clients")
    .select("ghl_location_id")
    .eq("id", clientId)
    .maybeSingle();
  const loc = client?.ghl_location_id;
  if (!loc) return { ids: [], token: "", locationId: "" };
  const { data: users } = await sb
    .from("coach_users")
    .select("id, ghl_api_token, ghl_location_id")
    .eq("ghl_location_id", loc);
  const rows = (users as { id: string; ghl_api_token: string | null; ghl_location_id: string | null }[] | null) || [];
  const withToken = rows.find((u) => u.ghl_api_token);
  return {
    ids: rows.map((u) => u.id),
    token: withToken?.ghl_api_token || "",
    locationId: String(withToken?.ghl_location_id || loc),
  };
}
