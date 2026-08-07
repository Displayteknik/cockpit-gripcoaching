import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase-admin";
import { resolveClientId } from "@/lib/client-context";
import { requireAdminOrCustomer } from "@/lib/api-auth";
import { finalizePendingAudits } from "@/lib/deep-audit-finalize";
import { runDeepAudit } from "@/lib/deep-audit-generate";

export const runtime = "nodejs";
export const maxDuration = 60; // POST submittar bara en batch (<10s) — genereringen sker async i bakgrunden

/**
 * ★ AVSTÄNGD 2026-08-07 — djupgranskningen genererar rapporter ur misslyckade hämtningar.
 *
 * Vad som hände: hämtningen av forbalance.se föll med HTTP 500 i vårt led. Generatorn
 * tolkade frånvaro av DATA som frånvaro av INNEHÅLL och skrev en självsäker åtgärdslista
 * ur ingenting — inklusive instruktionen att kunden skulle kontakta sitt webbhotell om ett
 * serverfel som var vårt eget. Sid-analysen av samma URL gav minuter tidigare Teknisk SEO
 * 83 och AEO 68, och sajten fungerar i webbläsare.
 *
 * Varför det är värre än en vanlig bugg: utdatan är ett dokument kunden ska AGERA på, och
 * kunden kan starta körningen själv från /k/seo. En rapport som ser trovärdig ut och är
 * fel är sämre än ingen rapport alls.
 *
 * Samma princip som belägg-regeln i onboardingmotorn: en misslyckad hämtning ska ge ett
 * tydligt FEL, aldrig en rapport.
 *
 * Öppnas igen när hämtvägen är lagad OCH generatorn vägrar skriva rapport utan underlag.
 * Läsning av redan sparade rapporter lämnas på — bara nygenerering stoppas.
 */
const DJUPGRANSKNING_AVSTANGD = true;
const AVSTANGD_TEXT =
  "Djupgranskningen är tillfälligt ur funktion. Den kunde skriva rapporter även när sajten inte gick att läsa, " +
  "vilket gav åtgärdsförslag byggda på ingenting. Den är avstängd tills hämtningen är lagad. Sid-analysen fungerar som vanligt.";

// Kund-vy av djupgranskningar (/k/seo). Kunden får både LÄSA sina färdiga rapporter
// OCH SJÄLV starta en ny (POST) — tenant-låst via resolveClientId (kund-session → egen klient).
// Spärr: en klient kan inte ha två granskningar igång samtidigt (kostnads-/förvirringsskydd).
export async function GET() {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;

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
