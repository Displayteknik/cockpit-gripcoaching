import { NextResponse } from "next/server";
import { getActiveClientId } from "@/lib/client-context";
import { getContentOverview } from "@/lib/content/overview";
import { requireAdminOrCustomer } from "@/lib/api-auth";

export const runtime = "nodejs";

// GET /api/content/overview — enhetlig vy över allt innehåll för aktiv klient.
// Admin ELLER kund (/k/kalender). Grindas här, tenant-låst via getActiveClientId.
export async function GET() {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;
  try {
    const clientId = await getActiveClientId();
    if (!clientId) return NextResponse.json({ error: "Ingen aktiv klient" }, { status: 400 });
    const overview = await getContentOverview(clientId);
    return NextResponse.json(overview);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
