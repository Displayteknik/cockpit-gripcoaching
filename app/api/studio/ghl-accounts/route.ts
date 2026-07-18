import { NextResponse } from "next/server";
import { getActiveClientId } from "@/lib/client-context";
import { getGhlConfig, ghlListAccounts } from "@/lib/studio/ghl";
import { requireAdminOrCustomer } from "@/lib/api-auth";

export const runtime = "nodejs";

// GET /api/studio/ghl-accounts — kopplade sociala konton för aktiv klient (LÄS).
// { connected:false } om klienten saknar GHL-koppling. Admin ELLER kund (kunden får se om
// FB/LI är kopplat via MySales och publicera den vägen). Tenant-låst via getActiveClientId.
export async function GET() {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;
  try {
    const clientId = await getActiveClientId();
    const cfg = await getGhlConfig(clientId);
    if (!cfg) return NextResponse.json({ connected: false, accounts: [] });
    const { accounts, error } = await ghlListAccounts(cfg);
    if (error) return NextResponse.json({ connected: true, accounts: [], error });
    return NextResponse.json({ connected: true, accounts });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
