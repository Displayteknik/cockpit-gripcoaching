import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrCustomer } from "@/lib/api-auth";
import { getActiveClientId } from "@/lib/client-context";
import { resolveCoachUserIds, resolveCoachContext } from "@/lib/coach-bridge";
import { supabaseService } from "@/lib/supabase-admin";
import { notifyNewLead } from "@/lib/lead-notify";
import { synkaOchStatus } from "@/lib/fokus/synk";

export const runtime = "nodejs";

// lobby_contacts saknar en source-kolumn; platform är det närmaste vi har. Etiketten
// används i aviseringens ämnesrad så mottagaren direkt ser var leadet kom ifrån.
function kallaEtikett(platform: string): string {
  const p = (platform || "").toLowerCase();
  if (p === "linkedin") return "Bild eller LinkedIn";
  if (p === "ig") return "Instagram";
  if (p === "fb") return "Facebook";
  if (p === "email") return "E-post";
  if (p === "phone") return "Telefon";
  if (p === "web") return "Formulär";
  return "Nya leads";
}

// Lobbyn (porterad från MySales Coach) — kontakterna före de blir affärer i GHL.
// Läser/skriver lobby_contacts via identitetsbryggan (klient → coach_users), aldrig på
// hårdkodat user_id. En klient kan ha flera coach_users (pionjär-appen mintar ett
// per enhet) → alltid array vid läsning; skrivning går till den kanoniska (första).

const FIELDS =
  "id, user_id, name, company, title, platform, status, last_message, sentiment, " +
  "next_step, next_contact_date, last_contact_at, email, phone, notes, extra_notes, " +
  "profile_url, ghl_contact_id, created_at, updated_at";

const WRITABLE = [
  "name", "company", "title", "platform", "status", "last_message",
  "sentiment", "next_step", "next_contact_date", "email", "phone", "notes", "last_contact_at", "profile_url",
];

export async function GET() {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;

  const clientId = await getActiveClientId();
  // Vilka leads som DÖLJS här avgörs av pipeline-spegeln nedan. Är spegeln gammal kan ett
  // lead ligga kvar långt efter att det blivit en affär — eller försvinna på en affär som
  // sedan lades ner. Samma synk och samma åldersstämpel som Fokus, av det skälet.
  const synk = await synkaOchStatus(clientId);
  const ctx = await resolveCoachContext(clientId);
  if (!ctx.ids.length) return NextResponse.json({ linked: false, contacts: [], synk });

  const sb = supabaseService();
  const [lobbyRes, oppRes] = await Promise.all([
    sb.from("lobby_contacts").select(FIELDS).in("user_id", ctx.ids).order("updated_at", { ascending: false }),
    // Pipelinen (fokus_opportunities-spegeln) → en kontakt som redan är en affär
    // hör hemma i Fokus idag, INTE i Nya leads. Matcha på ghl_contact_id (säkrast)
    // + normaliserat namn (fokus_opportunities har varken email eller telefon).
    sb.from("fokus_opportunities").select("kontakt, ghl_contact_id, steg_namn, status").in("tenant_id", ctx.ids),
  ]);
  if (lobbyRes.error) return NextResponse.json({ error: lobbyRes.error.message }, { status: 500 });

  // Nya leads = lead-pipelinen FÖRE MySales. En kontakt som redan är en aktiv affär i
  // pipelinen (matchad på ghl_contact_id el. namn) lämnar Nya leads helt → hör hemma i
  // Fokus idag. Vi behöver bara veta OM den är i pipelinen (steg-namn för en diskret rad).
  const norm = (s: string | null | undefined) => (s || "").trim().toLowerCase().replace(/\s+/g, " ");
  const oppById = new Map<string, string>();   // ghl_contact_id → steg_namn
  const oppByName = new Map<string, string>();  // normaliserat namn → steg_namn
  for (const o of (oppRes.data as { kontakt: string | null; ghl_contact_id: string | null; steg_namn: string | null; status: string | null }[] | null) || []) {
    if (o.status && o.status !== "open") continue; // bara aktiva affärer räknas som "i pipelinen"
    if (o.ghl_contact_id && !oppById.has(o.ghl_contact_id)) oppById.set(o.ghl_contact_id, o.steg_namn || "");
    if (o.kontakt && !oppByName.has(norm(o.kontakt))) oppByName.set(norm(o.kontakt), o.steg_namn || "");
  }

  // Skilj SÄKER match (ghl_contact_id — sätts vid synk) från OSÄKER (bara namn).
  // Säker match → kontakten döljs ur Nya leads (den ÄR i pipelinen). Namn-match →
  // behåll leadet men flagga "kan redan vara i pipelinen" (två olika personer kan
  // heta samma → tappa aldrig ett nytt lead tyst). [buggfix 2026-07-21]
  const contacts = ((lobbyRes.data as unknown as Record<string, unknown>[] | null) || []).map((c) => {
    const idStage = c.ghl_contact_id ? oppById.get(c.ghl_contact_id as string) : undefined;
    const nameStage = oppByName.get(norm(c.name as string));
    return {
      ...c,
      pipeline_stage: idStage ?? null,                                   // säker → döljs
      name_match_stage: !idStage && nameStage ? nameStage : null,        // osäker → badge
    };
  });

  // White-label GHL-bas för "Öppna i MySales"-deeplänk (customers/detail per kontakt).
  const mysalesBase = ctx.locationId ? `https://app.mysales.se/location/${ctx.locationId}` : null;
  return NextResponse.json({ linked: true, contacts, mysalesBase, synk });
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
    profile_url: "", last_contact_at: now, created_at: now, updated_at: now,
  };
  for (const k of WRITABLE) if (k in body) row[k] = body[k];
  row.name = String(body.name).trim();

  const sb = supabaseService();
  const { data, error } = await sb.from("lobby_contacts").insert(row).select(FIELDS).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Etapp L1 — avisera. Alla fyra källor (bild, röst, manuellt, formulär) går genom den
  // här routen, så en enda hook täcker Nya leads. Best-effort: får aldrig fälla svaret.
  const rad = data as Record<string, unknown> | null;
  void notifyNewLead({
    clientId,
    namn: String(row.name || "Okänt namn"),
    kalla: kallaEtikett(String(row.platform || "")),
    epost: (rad?.email as string) || null,
    telefon: (rad?.phone as string) || null,
    innehall: (rad?.last_message as string) || (rad?.notes as string) || null,
    lank: rad?.id ? `/dashboard/leads?id=${rad.id}` : "/dashboard/leads",
  });

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
