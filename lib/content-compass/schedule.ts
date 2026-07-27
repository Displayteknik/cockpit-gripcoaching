// Content Compass — server-laddare (läser tenantens schema, fallback = standard).
// Ren data/typer ligger i ./data (säkert i klientkomponenter). Detta lager är server-only.
import { supabaseService } from "@/lib/supabase-admin";
import { standardSchedule, type Cadence, type CompassSchedule, type CompassDay, type DayKey } from "./data";

export * from "./data";

// Läser tenantens schema; fallback = standard. Aldrig kast, aldrig tom profil.
export async function getCompassSchedule(clientId: string): Promise<CompassSchedule> {
  try {
    const sb = supabaseService();
    const { data } = await sb
      .from("content_compass_schedules")
      .select("schedule, cadence")
      .eq("client_id", clientId)
      .maybeSingle();
    if (data?.schedule?.days) {
      return {
        days: data.schedule.days as Record<DayKey, CompassDay>,
        cadence: (data.cadence as Cadence) || "7",
        activeDays: (data.schedule.activeDays as DayKey[] | undefined) ?? undefined,
      };
    }
  } catch {
    /* fallthrough till standard */
  }
  return standardSchedule("7");
}
