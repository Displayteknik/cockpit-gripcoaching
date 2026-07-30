import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireAdminOrCustomer } from "@/lib/api-auth";
import { getActiveClientId } from "@/lib/client-context";
import { supabaseService } from "@/lib/supabase-admin";

export const runtime = "nodejs";

async function latestCheck(sb: ReturnType<typeof supabaseService>, clientId: string): Promise<{ status: string; checked_at: string } | null> {
  const { data } = await sb
    .from("token_health_checks")
    .select("status, checked_at")
    .eq("client_id", clientId)
    .eq("scope", "page")
    .order("checked_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? { status: data.status, checked_at: data.checked_at } : null;
}

// ?all=1 (admin) → översikt över alla kopplingar. Annars → status för aktiv tenant (badge).
export async function GET(req: NextRequest) {
  const all = new URL(req.url).searchParams.get("all") === "1";

  if (all) {
    const denied = await requireAdmin();
    if (denied) return denied;
    const sb = supabaseService();

    const { data: owner } = await sb
      .from("meta_owner_connection")
      .select("fb_user_name, status, token_expires_at, last_checked_at, last_error")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: clientsData } = await sb.from("clients").select("id, name, ig_handle, ig_account_id");
    const { data: tenantRows } = await sb
      .from("tenant_ig_connections")
      .select("client_id, ig_username, page_name, source, status, last_checked_at, last_error");
    const tMap = new Map((tenantRows || []).map((t) => [t.client_id, t]));

    const tenants = [];
    for (const c of clientsData || []) {
      const t = tMap.get(c.id);
      if (!t && !c.ig_account_id) continue; // ingen koppling alls
      let status = t?.status || null;
      let checkedAt = t?.last_checked_at || null;
      if (!status) {
        const lc = await latestCheck(sb, c.id);
        status = lc?.status || "unknown";
        checkedAt = lc?.checked_at || null;
      }
      tenants.push({
        client_id: c.id,
        name: c.name,
        ig_username: t?.ig_username || c.ig_handle || null,
        page_name: t?.page_name || null,
        source: t?.source || (c.ig_account_id ? "legacy" : null),
        status,
        last_checked_at: checkedAt,
        last_error: t?.last_error || null,
      });
    }
    return NextResponse.json({ owner: owner || null, tenants });
  }

  const denied = await requireAdminOrCustomer();
  if (denied) return denied;
  const sb = supabaseService();
  const clientId = await getActiveClientId();
  const { data: t } = await sb.from("tenant_ig_connections").select("status, last_checked_at").eq("client_id", clientId).maybeSingle();
  if (t) return NextResponse.json({ connected: true, status: t.status, last_checked_at: t.last_checked_at });
  const lc = await latestCheck(sb, clientId);
  const { data: c } = await sb.from("clients").select("ig_account_id").eq("id", clientId).maybeSingle();
  return NextResponse.json({ connected: !!c?.ig_account_id, status: lc?.status || null, last_checked_at: lc?.checked_at || null });
}
