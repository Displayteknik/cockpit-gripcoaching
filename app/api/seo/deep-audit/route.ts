import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase-admin";
import { resolveClientId } from "@/lib/client-context";
import { requireAdminOrCustomer } from "@/lib/api-auth";
import { finalizePendingAudits } from "@/lib/deep-audit-finalize";
import { runDeepAudit } from "@/lib/deep-audit-generate";

export const runtime = "nodejs";
export const maxDuration = 60; // POST submittar bara en batch (<10s) — genereringen sker async i bakgrunden

/**
 * ★ ÅTERÖPPNAD 2026-08-11 — villkoret är uppfyllt, och här är vad som gäller nu.
 *
 * Bakgrunden: hämtningen av forbalance.se föll med HTTP 500 i vårt led. Generatorn
 * tolkade frånvaro av DATA som frånvaro av INNEHÅLL och skrev en självsäker åtgärdslista
 * ur ingenting — inklusive instruktionen att kunden skulle kontakta sitt webbhotell om ett
 * serverfel som var vårt eget. Sid-analysen av samma URL gav minuter tidigare Teknisk SEO
 * 83 och AEO 68, och sajten fungerade i webbläsare.
 *
 * Varför det var värre än en vanlig bugg: utdatan är ett dokument kunden ska AGERA på, och
 * kunden startar körningen själv från /k/seo. En rapport som ser trovärdig ut och är fel
 * är sämre än ingen rapport alls.
 *
 * ★ VILLKORET FÖR ÅTERÖPPNING VAR ATT GENERATORN VÄGRAR SKRIVA UTAN UNDERLAG.
 *   Den grinden finns nu i `underlagDuger` (lib/deep-audit-generate.ts) och ligger FÖRE
 *   prompten byggs: ingen läst sida, oläsbar startsida eller en startsida under 200 tecken
 *   ger ett hårt fel med förklaring — aldrig en rapport. Fyra test låser beteendet.
 *
 *   Grinden sitter i generatorn, inte här, med flit: /api/analytics/deep-audit (admin)
 *   anropar samma funktion, så skyddet kan inte kringgås genom att gå in en annan väg.
 *
 * ⚠ `DOLJ_RAPPORTER_I_KUNDVYN` nedan står KVAR PÅ. De gamla rapporterna skrevs innan
 *   grinden fanns, och en rapport som skrevs ur ingenting blir inte sann av att vägen
 *   lagas. De ska granskas en och en innan de visas igen — Håkans villkor 7/8.
 */
const DJUPGRANSKNING_AVSTANGD = false;
const AVSTANGD_TEXT =
  "Djupgranskningen är tillfälligt ur funktion. Den kunde skriva rapporter även när sajten inte gick att läsa, " +
  "vilket gav åtgärdsförslag byggda på ingenting. Den är avstängd tills hämtningen är lagad. Sid-analysen fungerar som vanligt.";

/**
 * ★ REDAN SKRIVNA RAPPORTER DÖLJS I KUNDVYN — Håkans beslut 2026-08-09.
 *
 * Kill switchen ovan stoppade NYA rapporter 7/8, men de gamla låg kvar synliga. Sju
 * rapporter hos displayteknik, hmmotor och ledarskapskultur är byggda på misslyckade
 * hämtningar och säger bland annat åt kunden att kontakta sitt webbhotell om ett
 * serverfel som var VÅRT. De är alltså aktivt vilseledande varje dag de ligger kvar.
 *
 * Dölja, inte radera: de är enda referensen när hämtvägen ska lagas (Håkans villkor 7/8),
 * och de ligger orörda i `client_assets`. Den interna vyn (/dashboard/seo via
 * /api/analytics/deep-audit) ser dem oförändrat — bara kundvyn /k/seo döljs.
 *
 * Spärren ligger SERVER-sidan av samma skäl som kill switchen: en gammal flik eller ett
 * direktanrop ska inte kunna hämta dem.
 *
 * Öppnas igen när hämtvägen är lagad OCH generatorn vägrar dra slutsatser ur en
 * misslyckad hämtning. Då ska de gamla rapporterna dessutom granskas en och en innan de
 * visas igen — en rapport som skrevs ur ingenting blir inte sann av att vägen lagas.
 */
const DOLJ_RAPPORTER_I_KUNDVYN = true;
const DOLJ_TEXT =
  "Dina tidigare djupgranskningar är tillfälligt dolda. Vi upptäckte att de kunde innehålla " +
  "slutsatser byggda på en misslyckad läsning av sajten, och vi vill hellre visa ingenting än " +
  "något som kan leda dig fel. Sid-analysen fungerar som vanligt.";

// Kund-vy av djupgranskningar (/k/seo). Kunden får både LÄSA sina färdiga rapporter
// OCH SJÄLV starta en ny (POST) — tenant-låst via resolveClientId (kund-session → egen klient).
// Spärr: en klient kan inte ha två granskningar igång samtidigt (kostnads-/förvirringsskydd).
export async function GET() {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;

  // Döljningen ligger FÖRE läsningen: inga rapporter hämtas, inget kan läcka genom ett
  // filter som någon råkar ändra senare. Kunden får ett ärligt besked i stället för en
  // tom lista som ser ut som "du har inga rapporter".
  if (DOLJ_RAPPORTER_I_KUNDVYN) {
    return NextResponse.json({ reports: [], generating: [], dolt: true, doltText: DOLJ_TEXT });
  }

  const sb = supabaseService(); // client_assets har strikt RLS → kräver service-role
  const clientId = await resolveClientId();

  await finalizePendingAudits(clientId).catch(() => 0);

  const { data } = await sb
    .from("client_assets")
    .select("id, body, metadata, created_at, status")
    .eq("client_id", clientId)
    .eq("category", "deep_audit_report")
    .in("status", ["active", "processing"])
    .order("created_at", { ascending: false })
    .limit(10);

  const rows = (data ?? []) as Array<{ id: string; status: string; body?: string }>;
  return NextResponse.json({
    reports: rows.filter((r) => r.status === "active" && r.body?.trim()),
    generating: rows.filter((r) => r.status === "processing").map((r) => r.id),
  });
}

export async function POST() {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;

  // Kill switch — se kommentaren vid DJUPGRANSKNING_AVSTANGD. Grinden ligger SERVER-sidan
  // och inte bara i UI:t, så en gammal flik eller ett direktanrop inte kan starta en körning.
  if (DJUPGRANSKNING_AVSTANGD) {
    return NextResponse.json({ error: AVSTANGD_TEXT, avstangd: true }, { status: 503 });
  }

  const sb = supabaseService();
  const clientId = await resolveClientId();

  // Undvik dubbla samtidiga körningar (kostnad + förvirring i UI:t).
  const { data: existing } = await sb
    .from("client_assets")
    .select("id")
    .eq("client_id", clientId)
    .eq("category", "deep_audit_report")
    .eq("status", "processing")
    .limit(1)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ ok: true, status: "processing", asset_id: existing.id, already_running: true });
  }

  const result = await runDeepAudit(clientId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json(result);
}
