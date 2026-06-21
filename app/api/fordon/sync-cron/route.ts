import { NextRequest, NextResponse } from "next/server";
import { BYTBIL_FEEDS, syncBytbilForClient } from "@/lib/bytbil";

export const runtime = "nodejs";
export const maxDuration = 120;

// Daglig auto-synk av Bytbil-feeden (Vercel Cron). Håller fordonslistan på publika
// sajten (/fordon) aktuell utan manuell knapptryckning. Auth via CRON_SECRET.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const results: Record<string, unknown> = {};
  for (const [clientId, feedUrl] of Object.entries(BYTBIL_FEEDS)) {
    try {
      results[clientId] = await syncBytbilForClient(clientId, feedUrl);
    } catch (e) {
      results[clientId] = { error: (e as Error).message };
    }
  }

  return NextResponse.json({ ok: true, ranAt: new Date().toISOString(), results });
}
