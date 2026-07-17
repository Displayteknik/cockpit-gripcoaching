import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getAdminScope } from "@/lib/api-auth";
import { supabaseService } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const ROLES = ["customer", "customer_member"]; // owner skapas ej här (= Håkans admin-session)

function newToken(): string {
  return (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, ""); // 64 hex → per-användar magic-link
}

// Admin Vy 3 — användare (email → tenant + roll). Aldrig lösenord i klartext:
// varje användare får en egen magic-link (login_token). Avaktivera = länken dör.
export async function GET(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const scope = await getAdminScope();
  const clientId = scope || req.nextUrl.searchParams.get("clientId");
  try {
    const sb = supabaseService();
    let q = sb
      .from("platform_users")
      .select("id, email, client_id, role, active, activated_at, invited_at, login_token, clients(name)")
      .order("invited_at", { ascending: false });
    if (clientId) q = q.eq("client_id", clientId);
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const body = await req.json();
    const scope = await getAdminScope();
    const clientId = scope || (body.clientId ? String(body.clientId) : "");
    const email = String(body.email || "").trim().toLowerCase();
    const role = ROLES.includes(body.role) ? body.role : "customer";
    if (!clientId) return NextResponse.json({ error: "clientId krävs" }, { status: 400 });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: "ogiltig e-post" }, { status: 400 });

    const sb = supabaseService();
    const { data: client } = await sb.from("clients").select("id").eq("id", clientId).maybeSingle();
    if (!client) return NextResponse.json({ error: "okänd klient" }, { status: 400 });

    const { data, error } = await sb
      .from("platform_users")
      .insert({ email, client_id: clientId, role, login_token: newToken() })
      .select("id, email, client_id, role, active, invited_at, login_token")
      .single();
    if (error) {
      if (error.code === "23505") return NextResponse.json({ error: "användaren finns redan för den här kunden" }, { status: 409 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const body = await req.json();
    const id = String(body.id || "");
    if (!id) return NextResponse.json({ error: "id krävs" }, { status: 400 });
    const patch: Record<string, unknown> = {};
    if (typeof body.active === "boolean") patch.active = body.active;
    if (body.rotate_token) patch.login_token = newToken(); // ny länk, gammal dör
    if (Object.keys(patch).length === 0) return NextResponse.json({ error: "inget att uppdatera" }, { status: 400 });

    const sb = supabaseService();
    // Scopad admin får bara röra egna tenantens användare.
    const scope = await getAdminScope();
    let q = sb.from("platform_users").update(patch).eq("id", id);
    if (scope) q = q.eq("client_id", scope);
    const { data, error } = await q.select("id, email, client_id, role, active, login_token").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
