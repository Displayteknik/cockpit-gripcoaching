import { NextRequest, NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase-admin";
import { resolveClientId } from "@/lib/client-context";
import { finalizePendingAudits } from "@/lib/deep-audit-finalize";
import { runDeepAudit } from "@/lib/deep-audit-generate";
import { beslutstabellBlock, type Sifferbeslut } from "@/lib/deep-audit-siffror";

export const runtime = "nodejs";
export const maxDuration = 300;

interface AuditInput {
  url?: string;
}

export async function POST(req: NextRequest) {
  const clientId = await resolveClientId();
  const body = (await req.json().catch(() => ({}))) as AuditInput;
  const result = await runDeepAudit(clientId, body.url);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json(result);
}

// Finalisera aktuell klients ev. klara batch-jobb + lista sparade rapporter + pågående.
export async function GET() {
  const sb = supabaseService(); // client_assets har strikt RLS → kräver service-role
  const clientId = await resolveClientId();

  // Finalisera denna klients klara batchar (idempotent, snabbt om inget klart).
  await finalizePendingAudits(clientId).catch(() => 0);

  const { data } = await sb
    .from("client_assets")
    .select("id, body, metadata, created_at, status")
    .eq("client_id", clientId)
    .eq("category", "deep_audit_report")
    .in("status", ["active", "processing"])
    .order("created_at", { ascending: false })
    .limit(10);

  const rows = (data ?? []) as Array<{
    id: string; status: string; body?: string;
    metadata?: { grind_sifferbeslut?: Sifferbeslut[] } | null;
  }>;

  // ÄGARVYN, till skillnad från kundens /k/seo (app/api/seo/deep-audit): här bifogas
  // beslutstabellen igen, återskapad ur metadata.grind_sifferbeslut — R-5b, fjärde kravet.
  // `body` i databasen bär aldrig tabellen längre, den ägs bara av denna vy.
  const medBeslutstabell = rows.map((r) => ({
    ...r,
    body: r.body ? r.body + beslutstabellBlock(r.metadata?.grind_sifferbeslut ?? []) : r.body,
  }));

  return NextResponse.json({
    reports: medBeslutstabell.filter((r) => r.status === "active" && r.body?.trim()),
    generating: medBeslutstabell.filter((r) => r.status === "processing").map((r) => r.id),
  });
}
