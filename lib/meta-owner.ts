// Server-side åtkomst till ägarens Meta-token. Läses bara i route-handlers (nodejs).
// Token dekrypteras precis före Graph-anrop och lämnar aldrig servern.

import { supabaseService } from "./supabase-admin";
import { decryptToken } from "./crypto/token-vault";

export async function getOwnerToken(): Promise<string | null> {
  const sb = supabaseService();
  const { data } = await sb
    .from("meta_owner_connection")
    .select("user_token_enc")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data?.user_token_enc) return null;
  try {
    return decryptToken(data.user_token_enc);
  } catch {
    return null;
  }
}
