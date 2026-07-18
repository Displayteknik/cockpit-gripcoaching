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
  type Aktivitet,
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
  const canon = (oppRows as { id: string; tenant_id: string }[] | null)?.[0] || null;
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

  // Kvalitetsvakt (§4.5): ingen historik + ingen fråga → be om EN mening, gissa inte.
  if (historik.length === 0 && !fraga) {
    const namn = (kort.namn || "kunden").split(" ")[0];
    return NextResponse.json({
      insamlingsfraga: `Innan jag ger ett skarpt råd — vad vet du om ${namn} sedan sist? Ett möte, ett samtal, en invändning eller vad som sagts. En mening räcker.`,
      fallback: false,
    });
  }

  const dk = buildDatakontrakt(kort, verksamhet, historik, fraga, tidigareCoachrad);
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
        return NextResponse.json({ svar: parsed as CoachSvar, provider: "gemini", fallback: false });
      }
    } catch (err) {
      if (forsok === 1)
        return NextResponse.json({ svar: fallbackRad(kort), provider: "gemini", fallback: true, orsak: String(err) });
    }
  }
  return NextResponse.json({ svar: fallbackRad(kort), provider: "gemini", fallback: true });
}
