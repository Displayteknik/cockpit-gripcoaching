import { NextResponse } from "next/server";
import { getActiveClientId } from "@/lib/client-context";
import { getContentOverview } from "@/lib/content/overview";

export const runtime = "nodejs";

// GET /api/content/overview — enhetlig vy över allt innehåll för aktiv klient.
// Admin-grindad av proxy.ts. Läser alla verkstäders tabeller (service-role).
export async function GET() {
  try {
    const clientId = await getActiveClientId();
    if (!clientId) return NextResponse.json({ error: "Ingen aktiv klient" }, { status: 400 });
    const overview = await getContentOverview(clientId);
    return NextResponse.json(overview);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
