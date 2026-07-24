import { NextResponse } from "next/server";
import { requireAdminOrCustomer } from "@/lib/api-auth";
import { getActiveClientId } from "@/lib/client-context";
import { resolveCoachContext, resolveCoachGhl } from "@/lib/coach-bridge";
import { supabaseService } from "@/lib/supabase-admin";
import { buildConfigFromStages } from "@/lib/fokus/config";
import { prioritize } from "@/lib/fokus/priority";
import type { RawOpportunity } from "@/lib/fokus/types";

export const runtime = "nodejs";

// GET /api/fokus/board — den prioriterade IDAG-vyn (spec §6), read-mostly.
// Läser fokus_opportunities (GHL-spegeln, fylld av standalone Coach) via identitetsbryggan,
// kör prioriteringsmotorn server-side och returnerar Dagens drag + Avgör + Pengalinjen.
// DT delar location över 2 coach_users → speglade opps → dedupe på ghl_opportunity_id.
export async function GET() {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;

  const clientId = await getActiveClientId();
  const ctx = await resolveCoachContext(clientId);
  if (!ctx.ids.length) return NextResponse.json({ linked: false });

  const sb = supabaseService();
  const { data: rows, error } = await sb
    .from("fokus_opportunities")
    .select(
      "ghl_opportunity_id, ghl_contact_id, kontakt, foretag, varde, steg_id, steg_namn, status, steg_sedan, senast_aktivitet, kalla, updated_at",
    )
    .in("tenant_id", ctx.ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type Row = {
    ghl_opportunity_id: string;
    ghl_contact_id: string | null;
    kontakt: string | null;
    foretag: string | null;
    varde: number | null;
    steg_id: string | null;
    steg_namn: string | null;
    status: string | null;
    steg_sedan: string | null;
    senast_aktivitet: string | null;
    kalla: string | null;
    updated_at: string | null;
  };

  // Dedupe på ghl_opportunity_id — behåll senast uppdaterade spegelraden.
  const byOpp = new Map<string, Row>();
  for (const r of (rows as Row[] | null) || []) {
    const prev = byOpp.get(r.ghl_opportunity_id);
    if (!prev || (r.updated_at || "") > (prev.updated_at || "")) byOpp.set(r.ghl_opportunity_id, r);
  }
  const deduped = Array.from(byOpp.values());

  const opps: RawOpportunity[] = deduped.map((r) => ({
    id: r.ghl_opportunity_id,
    ghlContactId: r.ghl_contact_id || "",
    namn: r.kontakt || "",
    foretag: r.foretag || "",
    varde: r.varde || 0,
    stegId: r.steg_id || "",
    status: r.status || "open",
    lastStageChangeAt: r.steg_sedan,
    updatedAt: r.senast_aktivitet,
    kalla: r.kalla || "",
  }));

  const distinctSteg = Array.from(new Map(deduped.map((r) => [r.steg_id, r.steg_namn])).entries()).map(
    ([id, namn]) => ({ id: id || "", namn: namn || "" }),
  );
  const cfg = buildConfigFromStages({ id: "", namn: "" }, distinctSteg, {
    __ghl_won_stage_id: ctx.wonStageId,
    __ghl_lost_stage_id: ctx.lostStageId,
  });

  const prioritering = prioritize(opps, cfg, Date.now());
  const syncedAt = deduped.reduce((m, r) => ((r.updated_at || "") > m ? r.updated_at || "" : m), "") || null;

  // Planerade kontakter (fokus_planering) → badge "Planerat" + "Att göra idag" när de förfaller.
  const { data: planRows } = await sb
    .from("fokus_planering")
    .select("id, ghl_opportunity_id, kanal, due_at, note")
    .in("tenant_id", ctx.ids)
    .eq("status", "open");
  const planering: Record<string, { id: string; kanal: string; dueAt: string; note: string | null }> = {};
  for (const pr of (planRows as { id: string; ghl_opportunity_id: string; kanal: string; due_at: string; note: string | null }[] | null) || []) {
    const prev = planering[pr.ghl_opportunity_id];
    if (!prev || pr.due_at < prev.dueAt)
      planering[pr.ghl_opportunity_id] = { id: pr.id, kanal: pr.kanal, dueAt: pr.due_at, note: pr.note };
  }
  const todayStr = new Date().toISOString().slice(0, 10);
  const attGoraIdag = Object.entries(planering)
    .filter(([, p]) => (p.dueAt || "").slice(0, 10) <= todayStr)
    .map(([oppId]) => oppId);

  // Grafisk pipeline-stegrad: hela pipelinen (steg i ordning) från GHL, per affär.
  // GHL-stegets id är globalt unikt → hitta pipelinen som innehåller affärens steg.
  // Best-effort: utan detta renderas kortet ändå (bara utan stegrad).
  const stegKarta: Record<string, { aktuellId: string; pipelineNamn: string; steg: { id: string; namn: string }[] }> = {};
  try {
    const { token, locationId: loc } = await resolveCoachGhl(clientId);
    if (token && loc) {
      const gh = { Authorization: `Bearer ${token}`, Version: "2021-07-28" };
      const pr = await fetch(`https://services.leadconnectorhq.com/opportunities/pipelines?locationId=${loc}`, { headers: gh });
      if (pr.ok) {
        const pd = await pr.json();
        const pipelines: Array<{ name: string; stages: Array<{ id: string; name: string }> }> = pd?.pipelines ?? [];
        const stegForSteg = new Map<string, { pipelineNamn: string; lista: { id: string; namn: string }[] }>();
        for (const p of pipelines) {
          const lista = (p.stages || []).map((s) => ({ id: s.id, namn: s.name }));
          for (const s of lista) stegForSteg.set(s.id, { pipelineNamn: p.name || "", lista });
        }
        for (const r of deduped) {
          const sid = r.steg_id;
          const match = sid ? stegForSteg.get(sid) : undefined;
          if (sid && match) stegKarta[r.ghl_opportunity_id] = { aktuellId: sid, pipelineNamn: match.pipelineNamn, steg: match.lista };
        }
      }
    }
  } catch { /* best-effort */ }

  return NextResponse.json({
    linked: true,
    prioritering,
    syncedAt,
    antal: opps.length,
    locationId: ctx.locationId,
    planering,
    attGoraIdag,
    stegKarta,
  });
}
