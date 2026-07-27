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

  // ── DM-berikning: kontextspecifika förslag + bokade tider ──────────────────────
  // Förslagsraden ska komma ur kontaktens verkliga läge (steg, anteckning, nästa steg),
  // inte generiska fraser. Bokade kontakter ska INTE föreslås som drag. Samma datakälla
  // som Säljcoachen läser, så vyerna aldrig motsäger varandra.
  const { data: dmRows } = await sb
    .from("cockpit_dm_contacts")
    .select("display_name, stage, notes, next_action, next_action_at")
    .eq("client_id", clientId);

  type DmRad = { display_name: string | null; stage: string | null; notes: string | null; next_action: string | null; next_action_at: string | null };
  const dmByNamn = new Map<string, DmRad>();
  for (const d of (dmRows as DmRad[] | null) || []) {
    if (d.display_name) dmByNamn.set(d.display_name.trim().toLowerCase(), d);
  }

  const DM_ETIKETT: Record<string, string> = { new: "Ny", acknowledge: "Bekräftad", connect: "Dialog", offer: "Erbjudande", won: "Bokad", lost: "Förlorad" };
  // Tid alltid i svensk tidszon: servern kör UTC, annars visas 14.00 som 12:00.
  const TZ = "Europe/Stockholm";
  const dagIStockholm = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: TZ });
  const tidText = (iso: string) => {
    const d = new Date(iso);
    const idag = dagIStockholm(new Date());
    const imorgon = dagIStockholm(new Date(Date.now() + 86400000));
    const dStr = dagIStockholm(d);
    const dag = dStr === idag ? "idag" : dStr === imorgon ? "imorgon" : d.toLocaleDateString("sv-SE", { timeZone: TZ, day: "numeric", month: "short" });
    return `${dag} ${d.toLocaleTimeString("sv-SE", { timeZone: TZ, hour: "2-digit", minute: "2-digit" })}`;
  };

  // Per affär: etikett ur DM-steget, förslag ur kontexten, och bokad tid när den finns.
  const dmInfo: Record<string, { etikett: string | null; forslag: string | null; bokad: string | null; bokadNot: string | null }> = {};
  for (const o of opps) {
    const d = dmByNamn.get((o.namn || "").trim().toLowerCase());
    if (!d) continue;
    const etikett = d.stage ? DM_ETIKETT[d.stage] || null : null;
    const bokadTid = d.stage === "won" && d.next_action_at ? tidText(d.next_action_at) : null;
    // Bokad kontakt: ingen åtgärdsrad, bara den bokade tiden.
    if (bokadTid) {
      dmInfo[o.id] = { etikett: "Bokad", forslag: null, bokad: bokadTid, bokadNot: (d.notes || "").split("\n")[0] || null };
      continue;
    }
    const dagar = Math.max(0, Math.floor((Date.now() - new Date(o.lastStageChangeAt || o.updatedAt || Date.now()).getTime()) / 86400000));
    let forslag: string | null = null;
    if (planering[o.id]) {
      // Uppgiften förfaller nu ("Att göra idag"): säg vad draget ÄR, utifrån var i
      // samtalet kontakten står. Aldrig avslutspress, aldrig generiska fraser.
      if (d.stage === "offer") forslag = "Påminn mjukt om tiderna du föreslog, lämna dörren öppen för andra tider.";
      else if (d.stage === "acknowledge") forslag = `Hör av dig mjukt och fråga om ${d.notes && /\bhon\b/i.test(d.notes) ? "hon" : "han"} vill boka.`;
      else if (d.stage === "connect") forslag = "Fortsätt dialogen och föreslå ett nästa steg.";
      else if (d.stage === "new") forslag = "Svara och starta samtalet.";
      else forslag = d.next_action || null;
    } else {
      // Erbjudande: uppföljningsdisciplinen vinner över en generisk anteckning, så vi
      // aldrig råder till att tjata. Max 2 uppföljningar (dag 3 och dag 7), aldrig pressa.
      if (d.stage === "offer") {
        const kvar = 3 - dagar;
        forslag = kvar > 0
          ? `Invänta svar på erbjudandet, mjuk påminnelse om ${kvar} ${kvar === 1 ? "dag" : "dagar"}`
          : dagar < 7 ? "Skicka en mjuk påminnelse om erbjudandet" : "Sista mjuka påminnelsen, annars släpp";
      } else {
        // Övriga steg: kundens egen anteckning om nästa steg är mest konkret.
        forslag = d.next_action || null;
        if (!forslag) {
          if (d.stage === "connect") forslag = "Fortsätt dialogen, föreslå nästa steg";
          else if (d.stage === "acknowledge") forslag = "Ställ en öppen fråga om läget";
          else if (d.stage === "new") forslag = "Svara och starta samtalet";
        }
      }
    }
    dmInfo[o.id] = { etikett, forslag, bokad: null, bokadNot: null };
  }

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
    dmInfo,
  });
}
