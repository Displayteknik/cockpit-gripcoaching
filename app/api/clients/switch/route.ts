import { NextRequest, NextResponse } from "next/server";
import { setActiveClientId } from "@/lib/client-context";
import { getCustomerSession, clearCustomerSession } from "@/lib/customer-context";
import { requireAdmin } from "@/lib/api-auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // Klientväxling är en admin-handling → kräver giltig admin-session.
  // (Referer är INTE auth; admin-grinden är den riktiga grinden. Referer-logiken
  // nedan finns kvar bara som diskriminator för att städa stale kund-cookie.)
  const denied = await requireAdmin();
  if (denied) return denied;

  // Diskriminator = referer, samma referer-medvetna mönster som resolveClientId:
  //  - anrop från kundportalen (/k) → en kund försöker flytta admin-kontexten →
  //    ALDRIG tillåtet (annars kringgås tenant-isoleringen).
  //  - anrop från admin (/dashboard) → genuint admin-byte. En kvarliggande
  //    kund-cookie (efter att admin förhandsgranskat en /k-portal) får INTE
  //    blockera bytet — rensa den och fortsätt.
  const referer = req.headers.get("referer") || "";
  let fromPortal = false;
  try { fromPortal = /^\/k(\/|$)/.test(new URL(referer).pathname); } catch { /* ingen/ogiltig referer */ }

  if (fromPortal && (await getCustomerSession())) {
    return NextResponse.json({ error: "ej tillåtet" }, { status: 403 });
  }

  const { client_id } = await req.json();
  if (!client_id) return NextResponse.json({ error: "client_id krävs" }, { status: 400 });

  // Rensa ev. kvarliggande kund-session så admin-kontexten verkligen byts
  // (annars vinner kund-cookien i resolveClientId/getCustomerSession nästa request).
  if (await getCustomerSession()) {
    await clearCustomerSession();
  }

  await setActiveClientId(client_id);
  return NextResponse.json({ ok: true });
}
