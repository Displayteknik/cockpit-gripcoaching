import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrCustomer } from "@/lib/api-auth";
import { resolveClientId } from "@/lib/client-context";
import { supabaseService } from "@/lib/supabase-admin";

export const runtime = "nodejs";

// Innehålls-navets källa → tabell. Kalendern visar poster från flera verkstäder,
// och ska kunna radera dem där de faktiskt bor. Alltid tenant-låst på client_id.
const TABELL: Record<string, string> = {
  studio: "studio_posts",
  social: "hm_social_posts",
  linkedin: "linkedin_posts",
  blog: "hm_blog",
};

// DELETE /api/content/item?source=studio&id=<uuid> — ta bort en post ur kalendern.
export async function DELETE(req: NextRequest) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;
  try {
    const { searchParams } = new URL(req.url);
    const source = searchParams.get("source") || "";
    const id = searchParams.get("id") || "";
    const tabell = TABELL[source];
    if (!tabell || !id) return NextResponse.json({ error: "source och id krävs" }, { status: 400 });

    const clientId = await resolveClientId();
    const sb = supabaseService();
    const { error } = await sb.from(tabell).delete().eq("id", id).eq("client_id", clientId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// ── KALENDER-1 (Håkans krav 11/8): flytta ett inlägg genom att dra det ────────
//
// Varje verkstad har sin egen datumkolumn, och kalendern visar dem sida vid sida. Ska en
// bricka kunna dras till ett annat datum måste flytten skriva i RÄTT kolumn per källa —
// annars ser flytten ut att fungera i vyn och ligger kvar i databasen.
//
// Bloggen är medvetet utelämnad: dess datum är `published_at`, alltså publiceringstiden på
// den publika sajten. Att dra i den hade flyttat en publicerad artikel, inte ett schema.
const DATUMKOLUMN: Record<string, string> = {
  studio: "scheduled_at",
  social: "scheduled_for",
  linkedin: "scheduled_for",
};

// PATCH /api/content/item — { source, id, when } flyttar posten till ett nytt datum.
export async function PATCH(req: NextRequest) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;
  try {
    const b = await req.json().catch(() => ({}));
    const source = String(b.source || "");
    const id = String(b.id || "");
    const tabell = TABELL[source];
    const kolumn = DATUMKOLUMN[source];
    if (!tabell || !id) return NextResponse.json({ error: "source och id krävs" }, { status: 400 });
    if (!kolumn) {
      return NextResponse.json({ error: "Den här sortens inlägg går inte att flytta i kalendern." }, { status: 400 });
    }
    const nar = b.when ? new Date(String(b.when)) : null;
    if (!nar || Number.isNaN(nar.getTime())) {
      return NextResponse.json({ error: "Ogiltigt datum" }, { status: 400 });
    }
    // Bakåt i tiden är inte en flytt, det är en publicering som redan borde ha skett.
    // Samma gräns som schemaläggningen använder (en minut, så dagens datum går att välja).
    if (nar.getTime() < Date.now() - 60_000) {
      return NextResponse.json({ error: "Det datumet har redan passerat." }, { status: 400 });
    }

    const clientId = await resolveClientId();
    const sb = supabaseService();
    // Publicerat flyttas ALDRIG: texten är redan ute hos kunderna, och att ändra dess datum
    // hade bara gjort kalendern osann. Läses status per källa eftersom kolumnerna skiljer sig.
    // `select("*")` med flit: kolumnnamnen skiljer sig per källa (ghl_status / status +
    // published_at / posted_at), och en select-sträng byggd av en variabel går inte att
    // typa i supabase-klienten. En rad, tenant-låst — kostnaden är noll.
    const { data: rad, error: lasFel } = await sb
      .from(tabell)
      .select("*")
      .eq("id", id)
      .eq("client_id", clientId)
      .maybeSingle();
    if (lasFel) return NextResponse.json({ error: lasFel.message }, { status: 500 });
    if (!rad) return NextResponse.json({ error: "Inlägget finns inte" }, { status: 404 });
    const r = rad as Record<string, unknown>;
    const publicerat =
      String(r.ghl_status || "") === "published" ||
      String(r.status || "") === "published" ||
      !!r.published_at ||
      !!r.posted_at;
    if (publicerat) {
      return NextResponse.json({ error: "Inlägget är redan publicerat och kan inte flyttas." }, { status: 409 });
    }

    const { error } = await sb
      .from(tabell)
      .update({ [kolumn]: nar.toISOString() })
      .eq("id", id)
      .eq("client_id", clientId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, when: nar.toISOString() });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
