import { NextRequest, NextResponse } from "next/server";
import { getActiveClientId } from "@/lib/client-context";
import { supabaseService } from "@/lib/supabase-admin";
import { requireAdminOrCustomer } from "@/lib/api-auth";

export const runtime = "nodejs";

// OPTICUR-1 Etapp B (B1) — sparar ett namngivet fritt mått ("Infartsskärmen" 1200x900)
// på klientens studio_brand_kits, utan att röra kitets övriga fält. Egen route i stället
// för att lasta hela kit-PUT:en (/api/brand-kit) — den skriver över HELA kit-objektet,
// och en storleks-räddning ska aldrig kunna tappa en färg som sparades i en annan flik
// samtidigt.

interface ScreenFormat { name: string; w: number; h: number }

function clampDim(n: unknown): number | null {
  const v = Math.round(Number(n));
  return Number.isFinite(v) && v >= 200 && v <= 4096 ? v : null;
}

// POST /api/studio/screen-formats — { name, w, h } → sparar/uppdaterar (samma namn skrivs över)
export async function POST(req: NextRequest) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;

  try {
    const clientId = await getActiveClientId();
    const b = await req.json().catch(() => ({}));
    const name = typeof b.name === "string" ? b.name.trim().slice(0, 60) : "";
    const w = clampDim(b.w);
    const h = clampDim(b.h);
    if (!name) return NextResponse.json({ error: "Namn krävs" }, { status: 400 });
    if (!w || !h) return NextResponse.json({ error: "Bredd och höjd måste vara 200-4096 px" }, { status: 400 });

    const sb = supabaseService();
    const { data: row } = await sb.from("studio_brand_kits").select("kit").eq("client_id", clientId).maybeSingle();
    const kit = (row?.kit as Record<string, unknown>) || {};
    const existing = (Array.isArray(kit.screenFormats) ? kit.screenFormats : []) as ScreenFormat[];
    const utan = existing.filter((f) => f.name !== name);
    const screenFormats = [...utan, { name, w, h }].slice(-20);

    const { error } = await sb.from("studio_brand_kits").upsert(
      { client_id: clientId, kit: { ...kit, screenFormats }, source: kit.source || "manual", updated_at: new Date().toISOString() },
      { onConflict: "client_id" },
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, screenFormats });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// DELETE /api/studio/screen-formats — { name } → tar bort ett sparat mått
export async function DELETE(req: NextRequest) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;

  try {
    const clientId = await getActiveClientId();
    const b = await req.json().catch(() => ({}));
    const name = typeof b.name === "string" ? b.name.trim() : "";
    if (!name) return NextResponse.json({ error: "Namn krävs" }, { status: 400 });

    const sb = supabaseService();
    const { data: row } = await sb.from("studio_brand_kits").select("kit").eq("client_id", clientId).maybeSingle();
    const kit = (row?.kit as Record<string, unknown>) || {};
    const existing = (Array.isArray(kit.screenFormats) ? kit.screenFormats : []) as ScreenFormat[];
    const screenFormats = existing.filter((f) => f.name !== name);

    const { error } = await sb.from("studio_brand_kits").upsert(
      { client_id: clientId, kit: { ...kit, screenFormats }, source: kit.source || "manual", updated_at: new Date().toISOString() },
      { onConflict: "client_id" },
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, screenFormats });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
