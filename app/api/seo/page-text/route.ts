import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-admin";
import { resolveClientId } from "@/lib/client-context";
import { extractPageSignals } from "@/lib/seo-deep";
import { urlHost as host, fetchSitemapPages, bestPageForKeyword } from "@/lib/page-match";

export const runtime = "nodejs";
export const maxDuration = 60;

// Läser den renderade texten från en sida så optimerare/specialister kan fyllas i
// automatiskt — användaren ska aldrig klistra in sidtext manuellt.
// Tenant-säkrad: bara den aktiva klientens egen domän får hämtas (ingen öppen proxy).
export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get("url")?.trim();
  const amne = req.nextUrl.searchParams.get("amne")?.trim() || "";
  if (!rawUrl || !/^https?:\/\//i.test(rawUrl)) {
    return NextResponse.json({ error: "Ogiltig url" }, { status: 400 });
  }

  const sb = supabaseServer();
  const clientId = await resolveClientId();
  const { data: client } = await sb.from("clients").select("public_url").eq("id", clientId).maybeSingle();
  const clientHost = host((client as { public_url?: string } | null)?.public_url || "");
  if (!clientHost || host(rawUrl) !== clientHost) {
    return NextResponse.json({ error: "Sidan ligger utanför klientens domän" }, { status: 403 });
  }

  // Om sökord finns: välj den sida vars adress passar bäst (annars den inskickade).
  const url = amne ? bestPageForKeyword(await fetchSitemapPages(clientHost), amne, rawUrl) : rawUrl;

  try {
    const signals = await extractPageSignals(url, { skipLighthouse: true, skipRobotsSitemap: true });
    return NextResponse.json({
      url: signals.url,
      title: signals.title,
      word_count: signals.wordCount,
      text: signals.mainText,
      matched: url !== rawUrl, // true = vi bytte till en bättre matchande sida
      platform: signals.platform, // → instruktioner anpassas per plattform (GHL/WordPress/...), inte hårdkodat
      schema_types: signals.schemaTypes,
      has_faq_schema: signals.schemaTypes.includes("FAQPage"), // → optimeraren slipper kasta ut dubbelt schema
      existing_faqs: signals.faqs.map((f) => f.question).slice(0, 20), // → föreslå inte FAQ som redan finns
      existing_headings: signals.headings.map((h) => h.text).filter(Boolean).slice(0, 30), // → bygg på befintliga sektioner
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Kunde inte läsa sidan" }, { status: 500 });
  }
}
