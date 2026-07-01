import { NextRequest, NextResponse } from "next/server";
import { finalizePendingAudits } from "@/lib/deep-audit-finalize";

export const runtime = "nodejs";
export const maxDuration = 120;

// Vercel Cron var 5:e minut: finaliserar klara djupgransknings-batchar för ALLA klienter,
// så rapporten sparas pålitligt även om användaren stängt fönstret innan batchen blev klar.
// Autentiseras via CRON_SECRET (Vercel skickar Authorization: Bearer <CRON_SECRET>).
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const finalized = await finalizePendingAudits().catch(() => 0);
  return NextResponse.json({ ok: true, finalized });
}
