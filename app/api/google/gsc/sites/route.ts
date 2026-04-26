import { NextResponse } from "next/server";
import { listGscSites } from "@/lib/google";
import { getActiveClientId } from "@/lib/client-context";

export const runtime = "nodejs";

export async function GET() {
  const clientId = await getActiveClientId();
  try {
    const sites = await listGscSites(clientId);
    return NextResponse.json(sites);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
