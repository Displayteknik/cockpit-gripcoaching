import { NextRequest, NextResponse } from "next/server";
import { getActiveClientId } from "@/lib/client-context";
import { buildDashboardData } from "@/lib/dashboard-data";

export const runtime = "nodejs";

// Samlad analytics-dashboard för aktiv klient (admin). Logiken delas med kundportalen
// via lib/dashboard-data.ts så båda ytorna visar exakt samma data.
export async function GET(req: NextRequest) {
  const clientId = await getActiveClientId();
  const days = Number(req.nextUrl.searchParams.get("days") || 30);
  const data = await buildDashboardData(clientId, days);
  return NextResponse.json(data);
}
