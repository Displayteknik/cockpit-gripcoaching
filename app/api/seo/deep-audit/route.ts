import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase-admin";
import { resolveClientId } from "@/lib/client-context";
import { requireAdminOrCustomer } from "@/lib/api-auth";

export const runtime = "nodejs";

// Read-only kund-vy av djupgranskningar. Kunden (/k) ska kunna LÄSA sina färdiga
// SEO/AEO-djupgranskningar, men ALDRIG kunna trigga den dyra/långsamma genereringen
// (den sker i admin via POST /api/analytics/deep-audit). Därför bara GET här, och bara
// rapporter med status "active" (klara). Tenant-låses via resolveClientId (kund-session
// → låst till egen klient).
export async function GET() {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;

  const sb = supabaseService(); // client_assets har strikt RLS → kräver service-role
  const clientId = await resolveClientId();

  const { data } = await sb
    .from("client_assets")
    .select("id, body, metadata, created_at")
    .eq("client_id", clientId)
    .eq("category", "deep_audit_report")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(10);

  // Filtrera bort ev. tomma kroppar (avbrutna jobb) så kunden bara ser läsbara rapporter.
  const reports = (data ?? []).filter((r) => (r as { body?: string }).body?.trim());
  return NextResponse.json({ reports });
}
