import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrCustomer } from "@/lib/api-auth";
import { getActiveClientId } from "@/lib/client-context";
import { resolveCoachUserIds, resolveCoachContext } from "@/lib/coach-bridge";
import { supabaseService } from "@/lib/supabase-admin";
import { notifyNewLead } from "@/lib/lead-notify";
import { synkaOchStatus } from "@/lib/fokus/synk";
import { hamtaStegFacit } from "@/lib/hq/pipeline";
import { byggPipelineIndex, normNamn, type PipelineOpp } from "@/lib/lobby/pipeline";
import { skapaAffarIMysales } from "@/lib/lead-intake";

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
  const [lobbyRes, oppRes, facit] = await Promise.all([
    sb.from("lobby_contacts").select(FIELDS).in("user_id", ctx.ids).order("updated_at", { ascending: false }),
    // Pipelinen (fokus_opportunities-spegeln) → en kontakt som redan är en affär
    // hör hemma i Fokus idag, INTE i Nya leads. Matcha på ghl_contact_id (säkrast)
    // + normaliserat namn (fokus_opportunities har varken email eller telefon).
    // steg_id + steg_namn, INTE status: GHL:s status ljuger (se lib/lobby/pipeline).
    sb.from("fokus_opportunities").select("kontakt, ghl_contact_id, steg_id, steg_namn").in("tenant_id", ctx.ids),
    // Håkans inställda vinst-/förluststeg för locationen — samma facit som Fokus och HQ.
    hamtaStegFacit(ctx.locationId),
  ]);
  if (lobbyRes.error) return NextResponse.json({ error: lobbyRes.error.message }, { status: 500 });

  // Nya leads = lead-pipelinen FÖRE MySales. En kontakt vars affär lever (i spel eller
  // vunnen) lämnar Nya leads helt. En NEDLAGD affär gör den däremot inte: då är leadet
  // fritt igen och ska tillbaka i listan. Vunnet/förlorat härleds ur steget — GHL:s
  // status-fält säger "open" om allt, även om det som är vunnet och förlorat.
  const index = byggPipelineIndex(
    (oppRes.data as PipelineOpp[] | null) || [],
    facit.vinnare,
    facit.forlorare,
  );

  // Skilj SÄKER match (ghl_contact_id — sätts vid synk) från OSÄKER (bara namn).
  // Säker match → kontakten döljs ur Nya leads (den ÄR i pipelinen). Namn-match →
  // behåll leadet men flagga "kan redan vara i pipelinen" (två olika personer kan
  // heta samma → tappa aldrig ett nytt lead tyst). [buggfix 2026-07-21]
  const contacts = ((lobbyRes.data as unknown as Record<string, unknown>[] | null) || []).map((c) => {
    const idStage = c.ghl_contact_id ? index.perId.get(c.ghl_contact_id as string) : undefined;
    const nameStage = index.perNamn.get(normNamn(c.name as string));
    // Nedlagd affär → leadet är fritt igen. Flaggan slår även lead-status "passed" i
    // vyn: den sattes när kontakten skickades till MySales och nollställs aldrig, så
    // utan den här raden vore leadet fortfarande osynligt. [buggfix 2026-08-03]
    const nedlagd = !idStage && c.ghl_contact_id ? index.nedlagdaPerId.get(c.ghl_contact_id as string) : undefined;
    return {
      ...c,
      pipeline_stage: idStage ?? null,                                   // säker → döljs
      name_match_stage: !idStage && nameStage ? nameStage : null,        // osäker → badge
      nedlagd_stage: nedlagd ?? null,                                    // nedlagd → tillbaka i listan
    };
  });

  // Bara location-id ut. Adressformen byggs med mysalesKontaktUrl i klienten — skickar vi
  // en halv URL härifrån bor formen på två ställen igen, vilket är precis hur de två
  // konkurrerande varianterna uppstod.
  return NextResponse.json({ linked: true, contacts, locationId: ctx.locationId || null, synk });
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

  const rad = data as Record<string, unknown> | null;

  // Affär i MySales direkt — samma steg som Displaytekniks webbformulär alltid gjort, så
  // ett inklistrat mejl hamnar lika långt in i systemet som en formulärförfrågan.
  // Avstängt som standard: för klienter som använder Nya leads som lead-pipeline FÖRE
  // MySales vore automatiska affärer en beteendeändring. Slås på per klient i Inställningar.
  const affar = await skapaAffarIMysales({
    clientId,
    namn: String(row.name || ""),
    foretag: (rad?.company as string) || null,
    epost: (rad?.email as string) || null,
    telefon: (rad?.phone as string) || null,
    arende: (rad?.last_message as string) || (rad?.notes as string) || null,
  });
  // Spegla kopplingen på kortet → "Öppna i MySales" blir en direktlänk, och leadet
  // döljs korrekt ur Nya leads när affären lever.
  if (affar.ghlContactId && rad?.id) {
    try {
      await sb.from("lobby_contacts")
        .update({ ghl_contact_id: affar.ghlContactId, updated_at: new Date().toISOString() })
        .eq("id", rad.id as string)
        .in("user_id", ids);
      (rad as Record<string, unknown>).ghl_contact_id = affar.ghlContactId;
    } catch { /* kortet finns, kopplingen är en bonus */ }
  }

  // Etapp L1 — avisera. Alla fyra källor (bild, röst, manuellt, formulär) går genom den
  // här routen, så en enda hook täcker Nya leads. Best-effort: får aldrig fälla svaret.
  void notifyNewLead({
    clientId,
    namn: String(row.name || "Okänt namn"),
    kalla: kallaEtikett(String(row.platform || "")),
    epost: (rad?.email as string) || null,
    telefon: (rad?.phone as string) || null,
    innehall: (rad?.last_message as string) || (rad?.notes as string) || null,
    lank: rad?.id ? `/dashboard/leads?id=${rad.id}` : "/dashboard/leads",
  });

  // Säg alltid vad som hände i MySales. Motsvarande steg gjorde tidigare tyst ingenting
  // när en inställning saknades, och då ser "sparat" ut som att allt gick vägen.
  return NextResponse.json({ ok: true, contact: rad ?? data, mysales: affar.notis, mysalesStatus: affar.status });
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
