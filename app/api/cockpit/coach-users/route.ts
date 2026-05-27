import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin-endpoint för Cockpit: lista alla MySales Coach-pionjärer
 * med deras identitet, GHL-anslutning, aktivitetsräkningar.
 *
 * Används av /dashboard/mysales-kunder.
 */

interface PersonalOs {
  display_name?: string;
  brand?: string;
  brand_color?: string;
  imported_prospects?: unknown[];
  import_snapshots?: { date: string; total: number; added_this_import: number }[];
}

interface CoachUserRow {
  id: string;
  ghl_location_id: string | null;
  ghl_api_token: string | null;
  ghl_pipeline_name: string | null;
  personal_os: PersonalOs | null;
  created_at: string;
  updated_at: string | null;
}

export async function GET() {
  const sb = supabaseServer();

  // Hämta alla coach_users
  const { data: users, error } = await sb
    .from("coach_users")
    .select("id, ghl_location_id, ghl_api_token, ghl_pipeline_name, personal_os, created_at, updated_at")
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Räkna lobby_contacts per user_id (en gång, gruppera lokalt)
  const { data: lobbyCounts } = await sb
    .from("lobby_contacts")
    .select("user_id");

  const lobbyByUser = new Map<string, number>();
  (lobbyCounts || []).forEach((row: { user_id: string }) => {
    lobbyByUser.set(row.user_id, (lobbyByUser.get(row.user_id) || 0) + 1);
  });

  // Bygg respons med beräknade fält
  const result = (users as CoachUserRow[] | null || []).map((u) => {
    const pos = u.personal_os || {};
    const hasGhl = !!u.ghl_location_id && !!u.ghl_api_token;
    const isDemo = u.id.startsWith("demo-") || u.ghl_location_id?.startsWith("demo-");
    const lobbyCount = lobbyByUser.get(u.id) || 0;
    const importCount = Array.isArray(pos.imported_prospects) ? pos.imported_prospects.length : 0;
    const lastImport = pos.import_snapshots?.length
      ? pos.import_snapshots[pos.import_snapshots.length - 1].date
      : null;

    // Status-heuristik
    let status: "active" | "demo" | "setup" | "inactive";
    if (isDemo) status = "demo";
    else if (hasGhl && lobbyCount > 0) status = "active";
    else if (hasGhl) status = "setup";
    else status = "inactive";

    return {
      id: u.id,
      display_name: pos.display_name || null,
      brand: pos.brand || null,
      brand_color: pos.brand_color || null,
      ghl_location_id: u.ghl_location_id,
      ghl_connected: hasGhl,
      ghl_pipeline_name: u.ghl_pipeline_name || null,
      status,
      lobby_count: lobbyCount,
      imported_prospects_count: importCount,
      last_import_at: lastImport,
      created_at: u.created_at,
      updated_at: u.updated_at,
    };
  });

  // Aggregerat
  const summary = {
    total: result.length,
    active: result.filter((r) => r.status === "active").length,
    setup: result.filter((r) => r.status === "setup").length,
    demo: result.filter((r) => r.status === "demo").length,
    inactive: result.filter((r) => r.status === "inactive").length,
    total_lobby_contacts: result.reduce((s, r) => s + r.lobby_count, 0),
    total_imported_prospects: result.reduce((s, r) => s + r.imported_prospects_count, 0),
  };

  return NextResponse.json({ ok: true, summary, users: result });
}
