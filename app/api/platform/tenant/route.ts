import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getAdminScope } from "@/lib/api-auth";
import { getTenantModuleView } from "@/lib/entitlements";
import { supabaseService } from "@/lib/supabase-admin";

export const runtime = "nodejs";

// Admin Vy 2 — per kund. GET effektiv behörighet + källa + override per modul.
// PATCH togglar ett manuellt tillägg/avdrag (tenant_modules), eller återställer
// till standard. Klient-scopad admin är låst till sin egen tenant.
async function resolveClient(reqClientId: string | null): Promise<string | NextResponse> {
  const scope = await getAdminScope();
  if (scope) return scope; // scopad admin → alltid egen tenant
  if (!reqClientId) return NextResponse.json({ error: "clientId krävs" }, { status: 400 });
  return reqClientId;
}

export async function GET(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const resolved = await resolveClient(req.nextUrl.searchParams.get("clientId"));
  if (resolved instanceof NextResponse) return resolved;
  try {
    return NextResponse.json(await getTenantModuleView(resolved));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const body = await req.json();
    const resolved = await resolveClient(body.clientId ? String(body.clientId) : null);
    if (resolved instanceof NextResponse) return resolved;
    const clientId = resolved;
    const moduleId = String(body.moduleId || "");
    const action = String(body.action || ""); // 'add' | 'remove' | 'reset'
    if (!moduleId) return NextResponse.json({ error: "moduleId krävs" }, { status: 400 });

    const sb = supabaseService();
    // Validera att modulen finns.
    const { data: mod } = await sb.from("platform_modules").select("id").eq("id", moduleId).maybeSingle();
    if (!mod) return NextResponse.json({ error: "okänd modul" }, { status: 400 });

    if (action === "reset") {
      const { error } = await sb.from("tenant_modules").delete().eq("client_id", clientId).eq("module_id", moduleId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else if (action === "add" || action === "remove") {
      const { error } = await sb.from("tenant_modules").upsert(
        { client_id: clientId, module_id: moduleId, enabled: action === "add", source: "manuell", updated_at: new Date().toISOString() },
        { onConflict: "client_id,module_id" },
      );
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      return NextResponse.json({ error: "ogiltig action" }, { status: 400 });
    }

    return NextResponse.json(await getTenantModuleView(clientId));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
