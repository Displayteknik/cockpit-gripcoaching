import { NextRequest, NextResponse } from "next/server";
import { runHealthChecks } from "@/lib/meta-health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ANSLUT-3: daglig hälsovakt. Grindas med samma CRON_SECRET som schemaläggaren.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // ?dryrun=1 kör alla kontroller utan DB-skrivningar eller mail (för att validera secret).
  const dryrun = new URL(req.url).searchParams.get("dryrun") === "1";
  const summary = await runHealthChecks(dryrun);
  return NextResponse.json({ success: true, dryrun, ...summary });
}
