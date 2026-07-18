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
