import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-admin";

export const runtime = "nodejs";

// Lättviktig analytics-endpoint. Kallas från publika sajten.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const sb = supabaseServer();
    const ua = req.headers.get("user-agent") || "";
    const country = req.headers.get("x-vercel-ip-country") || null;
    // Filtrera bort uppenbara bottar
    if (/bot|crawl|spider|preview/i.test(ua)) return NextResponse.json({ ok: true, skipped: "bot" });

    await sb.from("hm_visits").insert({
      path: body.path?.slice(0, 500),
      referrer: body.referrer?.slice(0, 500) || null,
      user_agent: ua.slice(0, 300),
      country,
      session_id: body.session_id?.slice(0, 100),
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
