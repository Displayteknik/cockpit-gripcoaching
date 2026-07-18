import { NextResponse } from "next/server";
import { requireAdminOrCustomer } from "@/lib/api-auth";
import { getActiveClientId } from "@/lib/client-context";
import { resolveCoachUserIds } from "@/lib/coach-bridge";
import { supabaseService } from "@/lib/supabase-admin";

export const runtime = "nodejs";

// GET /api/offert/quotes — aktiv klients offerter (MySales Coach), read-only.
// Tenant-låst via identitetsbryggan (klient → egna coach_users → egna sales_quotes).
// Väljer bara kund-relevanta fält (aldrig cost_total/interna marginaler i listan).
export async function GET() {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;

  const clientId = await getActiveClientId();
  const coachIds = await resolveCoachUserIds(clientId);
  if (!coachIds.length) return NextResponse.json({ linked: false, quotes: [] });

  const sb = supabaseService();
  const { data, error } = await sb
    .from("sales_quotes")
    .select("id, quote_number, customer_name, customer_company, status, total, valid_days, created_at, updated_at, sent_at, won_at")
    .in("user_id", coachIds)
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ linked: true, quotes: data || [] });
}
