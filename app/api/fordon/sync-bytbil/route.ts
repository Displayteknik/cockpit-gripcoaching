import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabase-admin";
import { getActiveClientId } from "@/lib/client-context";
import { verifyAdminSession, ADMIN_COOKIE } from "@/lib/admin-auth";
import { fetchBytbilCars, mapCarToVehicle } from "@/lib/bytbil";

export const runtime = "nodejs";
export const maxDuration = 120;

// Bytbil-feed per klient. v1: HM Motor. Multi: flytta till clients.bytbil_feed_url.
const BYTBIL_FEEDS: Record<string, string> = {
  "00000000-0000-0000-0000-000000000001":
    "https://hmmotor.accesspaket.bytbilcms.com/wp-json/accesspackage/v1/cars",
};

// Bytbil-synkade rader får slug som slutar på "-<bytbil-id>" (minst 7 siffror).
// Allt annat = manuellt inlagt och rörs ALDRIG av synken.
const bytbilIdOf = (slug: string): string | null => slug.match(/-(\d{7,})$/)?.[1] || null;

export async function POST(req: NextRequest) {
  // Admin-only (manuell synk från dashboarden).
  const secret = process.env.ADMIN_SESSION_SECRET;
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!secret || !(await verifyAdminSession(token, secret))) {
    return NextResponse.json({ error: "ej inloggad" }, { status: 401 });
  }

  const clientId = await getActiveClientId();
  const feedUrl = BYTBIL_FEEDS[clientId];
  if (!feedUrl) {
    return NextResponse.json({ error: "Ingen Bytbil-feed är kopplad till denna klient." }, { status: 400 });
  }

  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";
  // Engångs-städning: dölj gamla MANUELLA dubbletter (innan Bytbil tog över).
  // Används bara vid första övergången — vanlig synk rör aldrig manuella rader.
  const hideLegacyManual = req.nextUrl.searchParams.get("hideLegacyManual") === "1";
  const syncedAt = new Date().toISOString();
  const sb = supabaseServer();

  let cars;
  try {
    cars = await fetchBytbilCars(feedUrl);
  } catch (e) {
    return NextResponse.json({ error: `Kunde inte hämta Bytbil-feeden: ${(e as Error).message}` }, { status: 502 });
  }

  const mapped = cars.map((c, i) => ({ ...mapCarToVehicle(c, clientId, syncedAt), sort_order: i }));
  const feedIds = new Set(mapped.map((m) => m.bytbil_id));

  const { data: existing } = await sb
    .from("hm_vehicles")
    .select("id, slug, is_sold")
    .eq("client_id", clientId);

  // Indexera befintliga Bytbil-rader på Bytbil-id (ur slug-suffix). Rader utan id-suffix
  // = manuellt inlagda → räknas som legacy och rörs aldrig av den vanliga synken.
  const existingById = new Map<string, { id: string; slug: string; is_sold: boolean }>();
  let legacyManualCount = 0;
  for (const v of existing || []) {
    const bid = bytbilIdOf(v.slug);
    if (bid) existingById.set(bid, v);
    else if (!v.is_sold) legacyManualCount++;
  }

  let created = 0, updated = 0, soldMarked = 0, legacyHidden = 0;
  const errors: string[] = [];

  for (const m of mapped) {
    const ex = existingById.get(m.bytbil_id);
    if (dryRun) { ex ? updated++ : created++; continue; }
    if (ex) {
      // BEVARA REDIGERING: uppdatera bara pris (Bytbils domän). Utvald, badge,
      // beskrivning, bilder, rubrik m.m. lämnas orörda — Håkans val består.
      const { error } = await sb.from("hm_vehicles").update({ price: m.price }).eq("id", ex.id);
      error ? errors.push(`${m.slug}: ${error.message}`) : updated++;
    } else {
      // Ny bil → full insert.
      const row = {
        client_id: m.client_id, slug: m.slug, title: m.title, brand: m.brand, model: m.model,
        category: m.category, image_url: m.image_url, gallery: m.gallery, description: m.description,
        specs: m.specs, price: m.price, price_label: m.price_label, is_sold: false, sort_order: m.sort_order,
      };
      const { error } = await sb.from("hm_vehicles").insert(row);
      error ? errors.push(`${m.slug}: ${error.message}`) : created++;
    }
  }

  if (!dryRun) {
    // Bytbil-bil som lämnat feeden = såld/borttagen på Bytbil → dölj.
    for (const [bid, v] of existingById) {
      if (!feedIds.has(bid) && !v.is_sold) {
        const { error } = await sb.from("hm_vehicles").update({ is_sold: true }).eq("id", v.id);
        if (!error) soldMarked++;
      }
    }
    // Engångs: dölj gamla manuella dubbletter (bara när användaren godkänt det).
    if (hideLegacyManual) {
      for (const v of existing || []) {
        if (!bytbilIdOf(v.slug) && !v.is_sold) {
          const { error } = await sb.from("hm_vehicles").update({ is_sold: true }).eq("id", v.id);
          if (!error) legacyHidden++;
        }
      }
    }
  }

  return NextResponse.json({
    ok: errors.length === 0,
    dryRun,
    total: mapped.length,
    created,
    updated,
    soldMarked,
    legacyHidden,
    legacyManualCount,
    syncedAt,
    ...(errors.length ? { errors: errors.slice(0, 5) } : {}),
  });
}
