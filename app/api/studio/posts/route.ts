import { NextRequest, NextResponse } from "next/server";
import { resolveClientId } from "@/lib/client-context";
import { supabaseService } from "@/lib/supabase-admin";
import { requireAdminOrCustomer } from "@/lib/api-auth";

export const runtime = "nodejs";

// Studio-bibliotek: sparade skapelser (payload + bild) som kan återanvändas/redigeras.
// Admin-grindad av proxy.ts. Strikt RLS på tabellen → service-role här.

// GET /api/studio/posts — lista aktiv klients skapelser (nyast först)
export async function GET() {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;

  try {
    const clientId = await resolveClientId();
    const sb = supabaseService();
    const { data, error } = await sb
      .from("studio_posts")
      .select("id, template_id, format, title, image_url, payload, updated_at, ghl_status, scheduled_at")
      .eq("client_id", clientId)
      .order("updated_at", { ascending: false })
      .limit(120);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ posts: data || [] });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// POST /api/studio/posts — { id?, title, payload } → spara ny eller uppdatera befintlig
export async function POST(req: NextRequest) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;

  try {
    const clientId = await resolveClientId();
    const body = await req.json().catch(() => ({}));
    const payload = body.payload;
    if (!payload || typeof payload !== "object") {
      return NextResponse.json({ error: "payload krävs" }, { status: 400 });
    }
    const title = (body.title || "").toString().trim().slice(0, 120) || "Namnlöst inlägg";
    // Content Compass-profil (valfri). Skrivs på posten så kalendern kan visa den.
    const c = body.compass && typeof body.compass === "object" ? body.compass : null;
    const compassCols = c
      ? {
          funnel_level: ["tofu", "mofu", "bofu"].includes(c.funnel) ? c.funnel : null,
          four_a: ["analytical", "aspirational", "actionable", "authentic"].includes(c.four_a) ? c.four_a : null,
          disc: Array.isArray(c.disc) && c.disc.length ? c.disc.filter((d: unknown) => ["D", "I", "S", "C"].includes(d as string)) : null,
          compass_source: c.funnel || c.four_a ? "manual" : null,
        }
      : {};
    const row = {
      client_id: clientId,
      template_id: String(payload.templateId || "ark-textkort"),
      format: String(payload.format || "1080x1350"),
      title,
      payload,
      image_url: payload.imageUrl || null,
      updated_at: new Date().toISOString(),
      ...compassCols,
    };
    const sb = supabaseService();

    if (body.id) {
      // Uppdatera bara om posten tillhör aktiv klient (tenant-lås).
      const { data, error } = await sb
        .from("studio_posts")
        .update(row)
        .eq("id", body.id)
        .eq("client_id", clientId)
        .select("id, template_id, format, title, image_url, payload, updated_at")
        .maybeSingle();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (!data) return NextResponse.json({ error: "Hittade inte inlägget" }, { status: 404 });
      return NextResponse.json({ post: data });
    }

    const { data, error } = await sb
      .from("studio_posts")
      .insert(row)
      .select("id, template_id, format, title, image_url, payload, updated_at")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ post: data });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
