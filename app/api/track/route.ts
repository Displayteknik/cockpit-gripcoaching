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

    const insertRow: Record<string, unknown> = {
      path: body.path?.slice(0, 500),
      referrer: body.referrer?.slice(0, 500) || null,
      user_agent: ua.slice(0, 300),
      country,
      session_id: body.session_id?.slice(0, 100),
    };
    // Stoder explicit client_id fran pixel-snippet (per-klient-pixel)
    if (typeof body.client_id === "string" && /^[0-9a-f-]{36}$/i.test(body.client_id)) {
      insertRow.client_id = body.client_id;
    }
    await sb.from("hm_visits").insert(insertRow);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
