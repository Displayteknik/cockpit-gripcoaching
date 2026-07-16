import { NextResponse } from "next/server";
import { getActiveClientId } from "@/lib/client-context";
import { getGhlConfig, ghlListAccounts } from "@/lib/studio/ghl";

export const runtime = "nodejs";

// GET /api/studio/ghl-accounts — kopplade sociala konton för aktiv klient.
// { connected:false } om klienten saknar GHL-koppling. Admin-grindad av proxy.ts.
export async function GET() {
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
