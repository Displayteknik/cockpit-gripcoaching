import { NextResponse } from "next/server";
import { requireAdminOrCustomer } from "@/lib/api-auth";
import { getActiveClientId } from "@/lib/client-context";
import { resolveCoachContext } from "@/lib/coach-bridge";
import { supabaseService } from "@/lib/supabase-admin";
import { synkaOchStatus } from "@/lib/fokus/synk";

export const runtime = "nodejs";

// GET /api/offert/customers — kunder att välja för en offert, ur den synkade pipelinen
// (fokus_opportunities via bryggan). Saknas koppling → tom lista (då skriver man fritext).
//
// Listan MÅSTE vara färsk: en kund som tillkommit i MySales men saknas i spegeln går inte
// att välja, och då skrivs namnet in för hand utan koppling till affären. Samma synk och
// samma åldersstämpel som Fokus.
export async function GET() {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;
  const clientId = await getActiveClientId();
  const synk = await synkaOchStatus(clientId);
  const ctx = await resolveCoachContext(clientId);
  if (!ctx.ids.length) return NextResponse.json({ linked: false, customers: [], synk });

  const sb = supabaseService();
  const { data, error } = await sb
    .from("fokus_opportunities")
    .select("ghl_opportunity_id, ghl_contact_id, kontakt, foretag, updated_at")
    .in("tenant_id", ctx.ids)
    .order("updated_at", { ascending: false });
  // ⚠ Ett misslyckat anrop ger `data: null` — exakt som en tom tabell. Utan den här
  // kollen skulle ett fel se ut som "kunden finns inte i pipelinen".
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

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
  return NextResponse.json({ linked: true, customers, synk });
}
