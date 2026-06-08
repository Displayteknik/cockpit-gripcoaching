import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-admin";
import { resolveClientId } from "@/lib/client-context";
import { extractPageSignals } from "@/lib/seo-deep";

export const runtime = "nodejs";
export const maxDuration = 60;

const host = (u: string) => {
  try { return new URL(u).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; }
};

// Läser den renderade texten från en sida så optimerare/specialister kan fyllas i
// automatiskt — användaren ska aldrig klistra in sidtext manuellt.
// Tenant-säkrad: bara den aktiva klientens egen domän får hämtas (ingen öppen proxy).
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url")?.trim();
  if (!url || !/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: "Ogiltig url" }, { status: 400 });
  }

  const sb = supabaseServer();
  const clientId = await resolveClientId();
  const { data: client } = await sb.from("clients").select("public_url").eq("id", clientId).maybeSingle();
  const clientHost = host((client as { public_url?: string } | null)?.public_url || "");
  if (!clientHost || host(url) !== clientHost) {
    return NextResponse.json({ error: "Sidan ligger utanför klientens domän" }, { status: 403 });
  }

  try {
    const signals = await extractPageSignals(url, { skipLighthouse: true, skipRobotsSitemap: true });
    return NextResponse.json({
      url: signals.url,
      title: signals.title,
      word_count: signals.wordCount,
      text: signals.mainText,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Kunde inte läsa sidan" }, { status: 500 });
  }
}
