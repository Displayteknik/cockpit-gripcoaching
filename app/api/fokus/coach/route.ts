import { NextResponse } from "next/server";
import { requireAdminOrCustomer } from "@/lib/api-auth";
import { getActiveClientId } from "@/lib/client-context";
import { resolveCoachContext } from "@/lib/coach-bridge";
import { supabaseService } from "@/lib/supabase-admin";
import { generate } from "@/lib/gemini";
import {
  byggSystemprompt,
  buildDatakontrakt,
  extractJson,
  fallbackRad,
  validateCoachSvar,
  DEFAULT_VERKSAMHET,
  vetJagRedan,
  type Aktivitet,
  type AutoKontext,
  type CoachSvar,
  type Verksamhet,
} from "@/lib/fokus/coach";
import type { ScoredCard } from "@/lib/fokus/types";

export const runtime = "nodejs";

// POST /api/fokus/coach { kort, fraga? } — AI-säljcoach per affär (spec §4, §6).
// Berikar caset med coach-minne (fokus_aktiviteter/coachrad) ur DB, kör Gemini, validerar
// mot schemat med retry + regelbaserad fallback. Kvalitetsvakt: tomt minne + ingen fråga →
// ber om EN mening (gissar aldrig). Tenant-låst via bryggan.
export async function POST(req: Request) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;

  let body: { kort?: ScoredCard; fraga?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 });
  }
  const kort = body.kort;
  if (!kort || !kort.id) return NextResponse.json({ error: "kort krävs" }, { status: 400 });
  const fraga = (body.fraga || "").trim() || null;

  const clientId = await getActiveClientId();
  const ctx = await resolveCoachContext(clientId);
  if (!ctx.ids.length) return NextResponse.json({ error: "Ingen Coach-koppling" }, { status: 400 });

  const sb = supabaseService();

  // Verksamhet ur klientnamnet (tonprofil-defaults). Byts mot rikare brand-profil senare.
  const { data: client } = await sb.from("clients").select("name").eq("id", clientId).maybeSingle();
  const verksamhet: Verksamhet = { ...DEFAULT_VERKSAMHET, namn: client?.name || DEFAULT_VERKSAMHET.namn };

  // Hitta caseets spegelrad (uuid) — plocka en kanonisk tenant för coach-minnet.
  const { data: oppRows } = await sb
    .from("fokus_opportunities")
    .select("id, tenant_id")
    .in("tenant_id", ctx.ids)
    .eq("ghl_opportunity_id", kort.id)
    .order("tenant_id", { ascending: true });
  let canon = (oppRows as { id: string; tenant_id: string }[] | null)?.[0] || null;
  // Öppnas coachen från ett DM-pipelinekort finns inget opportunity-id: matcha på
  // kontaktnamn istället, så samma affärsminne och planering hittas som från Fokus idag.
  if (!canon && kort.namn) {
    const { data: viaNamn } = await sb
      .from("fokus_opportunities")
      .select("id, tenant_id")
      .in("tenant_id", ctx.ids)
      .ilike("kontakt", kort.namn.trim())
      .order("tenant_id", { ascending: true });
    canon = (viaNamn as { id: string; tenant_id: string }[] | null)?.[0] || null;
  }
  const memTenant = canon?.tenant_id || null;
  const uuid = canon?.id || null;

  let historik: Aktivitet[] = [];
  let tidigareCoachrad: unknown[] = [];

  if (uuid && memTenant) {
    // Användarens fritextsvar är case-kontext → spara som aktivitet (bygger minnet).
    if (fraga)
      await sb
        .from("fokus_aktiviteter")
        .insert({ tenant_id: memTenant, opportunity_id: uuid, typ: "note", notering: fraga, kalla: "coachpanel" });

    const [{ data: akt }, { data: rad }] = await Promise.all([
      sb
        .from("fokus_aktiviteter")
        .select("typ, notering, tidpunkt")
        .eq("tenant_id", memTenant)
        .eq("opportunity_id", uuid)
        .order("tidpunkt", { ascending: true }),
      sb
        .from("fokus_coachrad")
        .select("svar_json, utfall, tidpunkt")
        .eq("tenant_id", memTenant)
        .eq("opportunity_id", uuid)
        .order("tidpunkt", { ascending: true }),
    ]);
    historik = ((akt as { typ: string | null; notering: string | null; tidpunkt: string | null }[] | null) || []).map(
      (a) => ({ datum: (a.tidpunkt || "").slice(0, 10), typ: a.typ || "note", notering: a.notering || "" }),
    );
    tidigareCoachrad = (
      (rad as { svar_json: unknown; utfall: string | null; tidpunkt: string | null }[] | null) || []
    )
      .slice(-5)
      .map((r) => {
        const s = (r.svar_json || {}) as { drag?: { vad?: string } };
        return { datum: (r.tidpunkt || "").slice(0, 10), drag: s.drag?.vad || "", utfall: r.utfall || null };
      });
  }

  // ── Automatisk kontext (spec Jobb 3a): läs DM-kontakten och planerade uppföljningar
  // själv istället för att fråga användaren om sådant som redan står i systemet. ──
  const DM_STEG: Record<string, string> = { new: "Ny", acknowledge: "Bekräftad", connect: "Dialog", offer: "Erbjudande", won: "Bokad", lost: "Förlorad" };
  let autoKontext: AutoKontext | undefined;
  try {
    const { data: dm } = await sb
      .from("cockpit_dm_contacts")
      .select("display_name, ig_username, source, stage, notes, next_action, next_action_at")
      .eq("client_id", clientId)
      .ilike("display_name", (kort.namn || "").trim())
      .maybeSingle();

    const { data: plan } = uuid
      ? await sb.from("fokus_planering").select("kanal, due_at, note").eq("opportunity_id", uuid).eq("status", "open").order("due_at", { ascending: true }).limit(1).maybeSingle()
      : { data: null };

    const d = dm as { source?: string; stage?: string; notes?: string; next_action?: string; next_action_at?: string } | null;
    const p = plan as { kanal?: string; due_at?: string; note?: string } | null;
    if (d || p) {
      const konv = d?.notes || "";
      // Räkna turer: rader på formen "… · Namn: text" (så här sparas DM-konversationer).
      const turer = (konv.match(/·\s*[^:\n]{1,40}:/g) || []).length;
      autoKontext = {
        kanal: d?.source || (p?.kanal === "dm" ? "DM" : p?.kanal || null),
        dm_konversation: turer > 0 ? konv : null,
        antal_meddelanden: turer,
        anteckningar: turer > 0 ? null : konv || null, // är det inte en konversation är det anteckningar
        nasta_steg: d?.next_action || null,
        planerad_uppfoljning: p?.due_at ? `${p.note || "uppföljning"} (${p.due_at.slice(0, 10)}${p.kanal ? `, ${p.kanal}` : ""})` : null,
        erbjudande: kort.foretag || null,
        pipelinesteg_dm: d?.stage ? DM_STEG[d.stage] || d.stage : null,
      };
    }
  } catch { /* best-effort: coachen funkar även utan DM-kontext */ }

  const vetRedan = vetJagRedan(kort, autoKontext, historik);
  const harKontext = historik.length > 0 || (autoKontext?.antal_meddelanden ?? 0) > 0 || !!autoKontext?.anteckningar;

  // Kvalitetsvakt (§4.5): bara när det verkligen INTE finns någon kontext alls.
  if (!harKontext && !fraga) {
    return NextResponse.json({
      insamlingsfraga: "Jag har ingen historik än, berätta kort om läget.",
      vetRedan,
      fallback: false,
    });
  }

  const dk = buildDatakontrakt(kort, verksamhet, historik, fraga, tidigareCoachrad, autoKontext);
  const system = byggSystemprompt(verksamhet);
  const bas = `Här är säljcaset (JSON):\n${JSON.stringify(dk.case, null, 2)}`;
  const krav =
    "Svara med EXAKT det angivna JSON-formatet. ALLA fält krävs — särskilt utkast.text (vid telefon: punktmanus som en enda textsträng med radbrytningar).";
  const user = fraga ? `${bas}\n\nAnvändarens fråga: ${fraga}\n${krav}` : `${bas}\n\n${krav}`;

  // Försök 1 → validera. Ogiltigt: försök 2 med felet inbakat. Annars regelbaserad fallback (§6).
  for (let forsok = 0; forsok < 2; forsok++) {
    try {
      const extraUser =
        forsok === 0 ? user : `${user}\n\nDitt förra svar var ogiltig JSON. Svara ENBART med giltig JSON enligt formatet.`;
      const raw = await generate({
        model: "gemini-2.5-flash",
        systemInstruction: system,
        prompt: extraUser,
        jsonMode: true,
        maxOutputTokens: 2000,
        temperature: 0.4,
      });
      const parsed = extractJson(raw);
      const fel = validateCoachSvar(parsed);
      if (fel.length === 0) {
        if (uuid && memTenant)
          await sb
            .from("fokus_coachrad")
            .insert({ tenant_id: memTenant, opportunity_id: uuid, input_json: dk.case, svar_json: parsed });
        return NextResponse.json({ svar: parsed as CoachSvar, vetRedan, provider: "gemini", fallback: false });
      }
    } catch (err) {
      if (forsok === 1)
        return NextResponse.json({ svar: fallbackRad(kort), vetRedan, provider: "gemini", fallback: true, orsak: String(err) });
    }
  }
  return NextResponse.json({ svar: fallbackRad(kort), vetRedan, provider: "gemini", fallback: true });
}
