import { NextResponse } from "next/server";
import { requireAdminOrCustomer } from "@/lib/api-auth";
import { getActiveClientId } from "@/lib/client-context";
import { resolveCoachContext } from "@/lib/coach-bridge";
import { supabaseService } from "@/lib/supabase-admin";

export const runtime = "nodejs";

// GET /api/offert/customers — kunder att välja för en offert, ur den synkade pipelinen
// (fokus_opportunities via bryggan). Saknas koppling → tom lista (då skriver man fritext).
export async function GET() {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;
  const clientId = await getActiveClientId();
  const ctx = await resolveCoachContext(clientId);
  if (!ctx.ids.length) return NextResponse.json({ linked: false, customers: [] });

  const sb = supabaseService();
  const { data } = await sb
    .from("fokus_opportunities")
    .select("ghl_opportunity_id, ghl_contact_id, kontakt, foretag, updated_at")
    .in("tenant_id", ctx.ids)
    .order("updated_at", { ascending: false });

  const seen = new Set<string>();
  const customers: { name: string; company: string; ghlContactId: string; ghlOpportunityId: string }[] = [];
  for (const r of (data as { ghl_opportunity_id: string; ghl_contact_id: string | null; kontakt: string | null; foretag: string | null }[] | null) || []) {
    const key = r.ghl_contact_id || r.ghl_opportunity_id;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    customers.push({
      name: r.kontakt || "",
      company: r.foretag || "",
      ghlContactId: r.ghl_contact_id || "",
      ghlOpportunityId: r.ghl_opportunity_id || "",
    });
  }
  return NextResponse.json({ linked: true, customers });
}
