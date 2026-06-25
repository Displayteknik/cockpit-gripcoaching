import { NextRequest, NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/customer-context";
import { buildDashboardData } from "@/lib/dashboard-data";

export const runtime = "nodejs";

// Kund-scopad analytics-dashboard. Klienten resolvas ALLTID från den HttpOnly-validerade
// kund-sessionen — kunden kan aldrig nå annan tenants data.
export async function GET(req: NextRequest) {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ error: "Ej inloggad" }, { status: 401 });
  // Kräver minst en av analytics-modulerna.
  if (!session.features.includes("besokare") && !session.features.includes("seo")) {
    return NextResponse.json({ error: "Saknar behörighet" }, { status: 403 });
  }
  const days = Number(req.nextUrl.searchParams.get("days") || 30);
  const data = await buildDashboardData(session.client_id, days);
  return NextResponse.json(data);
}
