import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-admin";
import { resolveClientId } from "@/lib/client-context";
import { extractPageSignals } from "@/lib/seo-deep";

export const runtime = "nodejs";
export const maxDuration = 60;

const host = (u: string) => {
  try { return new URL(u).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; }
};
// Normalisera för slug-matchning: gemener, å/ä→a, ö→o, bara bokstäver/siffror.
const norm = (s: string) => s.toLowerCase().replace(/[åä]/g, "a").replace(/ö/g, "o").replace(/[^a-z0-9]/g, "");

// Väljer den sida vars adress bäst matchar sökordet — så "utomhusskärm" landar på
// /utomhus-skarmar i stället för den sida som råkar ranka (t.ex. /led-skarmar).
async function bestPageForKeyword(clientHost: string, amne: string, fallback: string): Promise<string> {
  try {
    const res = await fetch(`https://${clientHost}/sitemap.xml`, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) return fallback;
    const xml = await res.text();
    const locs = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/gi)).map((m) => m[1].trim());
    if (locs.length === 0) return fallback;
    const tokens = amne.split(/[^A-Za-zÀ-ÿ0-9]+/).map(norm).filter((t) => t.length >= 3);
    if (tokens.length === 0) return fallback;
    let best = fallback, bestScore = 0;
    for (const loc of locs) {
      if (host(loc) !== clientHost) continue;
      let slug = "";
      try { slug = norm(new URL(loc).pathname); } catch { continue; }
      if (!slug) continue; // startsidan
      const score = tokens.reduce((s, t) => s + (slug.includes(t) ? t.length : 0), 0);
      if (score > bestScore) { bestScore = score; best = loc; }
    }
    return bestScore > 0 ? best : fallback;
  } catch { return fallback; }
}

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
  const url = amne ? await bestPageForKeyword(clientHost, amne, rawUrl) : rawUrl;

  try {
    const signals = await extractPageSignals(url, { skipLighthouse: true, skipRobotsSitemap: true });
    return NextResponse.json({
      url: signals.url,
      title: signals.title,
      word_count: signals.wordCount,
      text: signals.mainText,
      matched: url !== rawUrl, // true = vi bytte till en bättre matchande sida
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Kunde inte läsa sidan" }, { status: 500 });
  }
}
