import { NextResponse } from "next/server";
import { requireAdminOrCustomer } from "@/lib/api-auth";
import { getActiveClientId } from "@/lib/client-context";
import { hamtaAktivPrisbok, listaPrisbocker } from "@/lib/offert/inkopsdata";

export const runtime = "nodejs";

// GET /api/offert/inkop/prisbok — vilka versioner av inköpsdatabasen som importerats och vilken
// som är aktiv. Underlaget för "hur gammalt är det här priset?".

export async function GET() {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;
  const clientId = await getActiveClientId();
  const [aktiv, versioner] = await Promise.all([hamtaAktivPrisbok(clientId), listaPrisbocker(clientId)]);
  return NextResponse.json({ aktiv, versioner });
}
