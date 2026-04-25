import { createClient } from "@supabase/supabase-js";

// Server-side client. Använder anon key (single-owner app utan user-auth).
// Byt till service-role om RLS tajtas senare.
export function supabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}
