import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrCustomer } from "@/lib/api-auth";
import { getActiveClientId } from "@/lib/client-context";
import { resolveCoachUserIds, resolveCoachContext } from "@/lib/coach-bridge";
import { supabaseService } from "@/lib/supabase-admin";

export const runtime = "nodejs";

// Lobbyn (porterad från MySales Coach) — kontakterna före de blir affärer i GHL.
// Läser/skriver lobby_contacts via identitetsbryggan (klient → coach_users), aldrig på
// hårdkodat user_id. En klient kan ha flera coach_users (pionjär-appen mintar ett
// per enhet) → alltid array vid läsning; skrivning går till den kanoniska (första).

const FIELDS =
  "id, user_id, name, company, title, platform, status, last_message, sentiment, " +
  "next_step, next_contact_date, last_contact_at, email, phone, notes, extra_notes, " +
  "ghl_contact_id, created_at, updated_at";

const WRITABLE = [
  "name", "company", "title", "platform", "status", "last_message",
  "sentiment", "next_step", "next_contact_date", "email", "phone", "notes", "last_contact_at",
];

export async function GET() {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;

  const clientId = await getActiveClientId();
  const ctx = await resolveCoachContext(clientId);
  if (!ctx.ids.length) return NextResponse.json({ linked: false, contacts: [] });

  const sb = supabaseService();
  const { data, error } = await sb
    .from("lobby_contacts")
    .select(FIELDS)
    .in("user_id", ctx.ids)
    .order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // White-label GHL-bas för "Öppna i MySales"-deeplänk (customers/detail per kontakt).
  const mysalesBase = ctx.locationId ? `https://app.mysales.se/location/${ctx.locationId}` : null;
  return NextResponse.json({ linked: true, contacts: data || [], mysalesBase });
}

// POST — skapa en ny kontakt. Skrivs till den kanoniska coach_user:n (första),
// samma mönster som Fokus. Klienten får aldrig sätta id/user_id.
export async function POST(req: NextRequest) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan" }, { status: 400 });
  }
  if (!body.name || !String(body.name).trim()) {
    return NextResponse.json({ error: "Namn krävs" }, { status: 400 });
  }

  const clientId = await getActiveClientId();
  const ids = await resolveCoachUserIds(clientId);
  if (!ids.length) return NextResponse.json({ error: "Ingen Coach-koppling" }, { status: 403 });

  const now = new Date().toISOString();
  const row: Record<string, unknown> = {
    user_id: ids[0], // kanonisk tenant för nyskapade rader
    status: "new",
    company: "", title: "", platform: "other", last_message: "", sentiment: 0,
    next_step: "", next_contact_date: "", email: "", phone: "", notes: "", extra_notes: [],
    last_contact_at: now, created_at: now, updated_at: now,
  };
  for (const k of WRITABLE) if (k in body) row[k] = body[k];
  row.name = String(body.name).trim();

  const sb = supabaseService();
  const { data, error } = await sb.from("lobby_contacts").insert(row).select(FIELDS).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, contact: data });
}

// PATCH — uppdatera en kontakt. Tenant-låst: raden måste tillhöra klientens coach_users.
export async function PATCH(req: NextRequest) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;

  let body: { id?: string; changes?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan" }, { status: 400 });
  }
  const { id, changes } = body;
  if (!id || !changes) return NextResponse.json({ error: "id och changes krävs" }, { status: 400 });

  const clientId = await getActiveClientId();
  const ids = await resolveCoachUserIds(clientId);
  if (!ids.length) return NextResponse.json({ error: "Ingen Coach-koppling" }, { status: 403 });

  const patch: Record<string, unknown> = {};
  for (const k of WRITABLE) if (k in changes) patch[k] = changes[k];
  if (!Object.keys(patch).length) return NextResponse.json({ error: "Inga giltiga fält" }, { status: 400 });
  patch.updated_at = new Date().toISOString();

  const sb = supabaseService();
  const { data, error } = await sb
    .from("lobby_contacts")
    .update(patch)
    .eq("id", id)
    .in("user_id", ids)
    .select(FIELDS)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Kontakten finns inte" }, { status: 404 });

  return NextResponse.json({ ok: true, contact: data });
}

// DELETE ?id= — radera en kontakt (tenant-låst).
export async function DELETE(req: NextRequest) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id krävs" }, { status: 400 });

  const clientId = await getActiveClientId();
  const ids = await resolveCoachUserIds(clientId);
  if (!ids.length) return NextResponse.json({ error: "Ingen Coach-koppling" }, { status: 403 });

  const sb = supabaseService();
  const { error } = await sb.from("lobby_contacts").delete().eq("id", id).in("user_id", ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
