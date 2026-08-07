// ONBOARD-7 steg 10: kontrollerna ur processdokumentets del 2.
//
// ⚠ SNIPPETS SAKNAS MEDVETET. /locations/{id}/templates kräver ett scope som inte finns
//   bland de nio i kundnyckeln, så systemet kan inte räkna dem. Den punkten är en
//   INSTRUKTION till Håkan i steg 10, inte en tyst utelämnad kontroll — se steg.ts.
//   Att låtsas att allt är kontrollerat vore värre än att peka ut vad han måste titta på.
import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrCustomer } from "@/lib/api-auth";
import { supabaseService } from "@/lib/supabase-admin";
import { hamtaOnboarding } from "@/lib/onboard/steg-status";

export const runtime = "nodejs";
const GHL = "https://services.leadconnectorhq.com";

interface Punkt { namn: string; ok: boolean; detalj: string; manuell?: boolean }

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;
  const { id } = await ctx.params;

  const vy = await hamtaOnboarding(id);
  if (!vy) return NextResponse.json({ error: "Onboardingen hittades inte." }, { status: 404 });
  if (!vy.locationId) return NextResponse.json({ error: "GHL-kontot är inte skapat än." }, { status: 400 });

  const sb = supabaseService();
  const { data: cu } = await sb
    .from("coach_users")
    .select("id, ghl_api_token")
    .eq("ghl_location_id", vy.locationId)
    .maybeSingle();
  const token = (cu as { ghl_api_token?: string } | null)?.ghl_api_token || "";
  if (!token) {
    return NextResponse.json({ error: "Kundnyckeln saknas — gör steg 4 först." }, { status: 400 });
  }

  const las = async <T>(vag: string): Promise<T | null> => {
    const r = await fetch(`${GHL}${vag}`, {
      headers: { Authorization: `Bearer ${token}`, Version: "2021-07-28", Accept: "application/json" },
    });
    return r.ok ? ((await r.json()) as T) : null;
  };

  const punkter: Punkt[] = [];

  const pl = await las<{ pipelines?: { name: string; stages?: unknown[] }[] }>(`/opportunities/pipelines?locationId=${vy.locationId}`);
  const pipeline = pl?.pipelines?.find((p) => /kund pipeline/i.test(p.name));
  const antalSteg = pipeline?.stages?.length ?? 0;
  punkter.push({
    namn: "Pipeline med sju steg",
    ok: antalSteg === 7,
    detalj: pipeline ? `"${pipeline.name}" har ${antalSteg} steg` : "Ingen pipeline som heter Kund pipeline",
  });

  const cv = await las<{ customValues?: { value?: string }[] }>(`/locations/${vy.locationId}/customValues`);
  const antalCv = cv?.customValues?.length ?? 0;
  const ifyllda = (cv?.customValues ?? []).filter((c) => (c.value ?? "").trim()).length;
  punkter.push({
    namn: "Tretton custom values, ifyllda",
    ok: antalCv === 13 && ifyllda >= 10,
    detalj: `${antalCv} finns, ${ifyllda} har värde`,
  });

  const tg = await las<{ tags?: unknown[] }>(`/locations/${vy.locationId}/tags`);
  punkter.push({
    namn: "Åtta taggar",
    ok: (tg?.tags?.length ?? 0) === 8,
    detalj: `${tg?.tags?.length ?? 0} taggar`,
  });

  const wf = await las<{ workflows?: { name: string; status?: string }[] }>(`/workflows/?locationId=${vy.locationId}`);
  const flode = wf?.workflows?.find((w) => /uppföljning/i.test(w.name));
  punkter.push({
    namn: "Uppföljningsflödet publicerat",
    ok: flode?.status === "published",
    detalj: flode ? `"${flode.name}" är ${flode.status}` : "Hittade inget uppföljningsflöde",
  });

  if (vy.clientId) {
    const { synkaFokus } = await import("@/lib/fokus/synk");
    const s = await synkaFokus(vy.clientId, true);
    punkter.push({
      namn: "Fokus idag läser MySales",
      ok: s.ok,
      detalj: s.ok ? `Synken svarar, ${s.antal ?? 0} affärer` : (s.fel ?? "okänt fel"),
    });
  }

  punkter.push({
    namn: "Sju snippets",
    ok: false,
    manuell: true,
    detalj: "Kan inte läsas — scopet finns inte i kundnyckeln. Gå till Marketing → Snippets och räkna: fas 1–5 plus dag 3 och dag 7.",
  });

  const automatiska = punkter.filter((p) => !p.manuell);
  return NextResponse.json({
    punkter,
    allaGrona: automatiska.every((p) => p.ok),
    manuellaKvar: punkter.filter((p) => p.manuell).length,
  });
}
