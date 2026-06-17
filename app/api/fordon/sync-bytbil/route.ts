import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getActiveClientId } from "@/lib/client-context";
import { verifyAdminSession, ADMIN_COOKIE } from "@/lib/admin-auth";
import { BYTBIL_FEEDS, syncBytbilForClient } from "@/lib/bytbil";

export const runtime = "nodejs";
export const maxDuration = 120;

// Talar om ifall aktiv klient har en Bytbil-feed → dashboarden visar "Synka"-knappen
// bara för klienter där synken faktiskt gäller (idag HM Motor).
export async function GET() {
  const clientId = await getActiveClientId();
  return NextResponse.json({ hasFeed: !!BYTBIL_FEEDS[clientId] });
}

export async function POST(req: NextRequest) {
  // Admin-only (manuell synk från dashboarden).
  const secret = process.env.ADMIN_SESSION_SECRET;
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!secret || !(await verifyAdminSession(token, secret))) {
    return NextResponse.json({ error: "ej inloggad" }, { status: 401 });
  }

  const clientId = await getActiveClientId();
  const feedUrl = BYTBIL_FEEDS[clientId];
  if (!feedUrl) {
    return NextResponse.json({ error: "Ingen Bytbil-feed är kopplad till denna klient." }, { status: 400 });
  }

  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";
  // Engångs-städning: dölj gamla MANUELLA dubbletter (innan Bytbil tog över).
  const hideLegacyManual = req.nextUrl.searchParams.get("hideLegacyManual") === "1";

  try {
    const result = await syncBytbilForClient(clientId, feedUrl, { dryRun, hideLegacyManual });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: `Kunde inte hämta Bytbil-feeden: ${(e as Error).message}` }, { status: 502 });
  }
}
