import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Server-side klient. Använder anon-nyckel (single-byrå-app utan user-auth idag).
// Bibehålls för bakåtkompatibilitet med befintliga endpoints.
export function supabaseServer(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

// Service-role-klient. Bypassar RLS — används för tabeller med strikt RLS
// (client_assets, client_voice_profile) och för privata storage-buckets.
// API-endpoints som använder denna MÅSTE själva verifiera att caller har rätt
// att röra det angivna client_id (via getActiveClientId i Cockpit; via JWT i MySales Pro).
export function supabaseService(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY saknas. Sätt env-variabeln i .env.local och på Vercel."
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
