import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrCustomer } from "@/lib/api-auth";
import { getActiveClientId } from "@/lib/client-context";
import { resolveCoachUserIds } from "@/lib/coach-bridge";
import { supabaseService } from "@/lib/supabase-admin";

export const runtime = "nodejs";

// Lobbyn (porterad från MySales Coach) — kontakterna före de blir affärer i GHL.
// Läser lobby_contacts via identitetsbryggan (klient → coach_users), aldrig på
// hårdkodat user_id. En klient kan ha flera coach_users (pionjär-appen mintar ett
// per enhet) → alltid array, aldrig [0].

const FIELDS =
  "id, user_id, name, company, title, platform, status, last_message, sentiment, " +
  "next_step, next_contact_date, last_contact_at, email, phone, notes, extra_notes, created_at, updated_at";

export async function GET() {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;

  const clientId = await getActiveClientId();
  const ids = await resolveCoachUserIds(clientId);
  if (!ids.length) return NextResponse.json({ linked: false, contacts: [] });

  const sb = supabaseService();
  const { data, error } = await sb
    .from("lobby_contacts")
    .select(FIELDS)
    .in("user_id", ids)
    .order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ linked: true, contacts: data || [] });
}

// PATCH — uppdatera en kontakt (status, nästa steg, datum, anteckning).
// Tenant-låst: raden måste tillhöra en coach_user som klienten äger.
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

  // Vitlista fälten — aldrig låta klienten skriva user_id eller id.
  const ALLOWED = [
    "name", "company", "title", "platform", "status", "last_message",
    "sentiment", "next_step", "next_contact_date", "email", "phone", "notes", "last_contact_at",
  ];
  const patch: Record<string, unknown> = {};
  for (const k of ALLOWED) if (k in changes) patch[k] = changes[k];
  if (!Object.keys(patch).length) return NextResponse.json({ error: "Inga giltiga fält" }, { status: 400 });
  patch.updated_at = new Date().toISOString();

  const sb = supabaseService();
  const { data, error } = await sb
    .from("lobby_contacts")
    .update(patch)
    .eq("id", id)
    .in("user_id", ids) // tenant-lås: raden måste vara klientens
    .select(FIELDS)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Kontakten finns inte" }, { status: 404 });

  return NextResponse.json({ ok: true, contact: data });
}
