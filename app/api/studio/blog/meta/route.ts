import { NextResponse } from "next/server";
import { resolveClientId } from "@/lib/client-context";
import { requireAdminOrCustomer } from "@/lib/api-auth";
import { getGhlConfig, ghlBlogMeta } from "@/lib/studio/ghl";

export const runtime = "nodejs";

// GET /api/studio/blog/meta — bloggsajter/författare/kategorier för aktiv klients GHL.
// ⚠ Säkerhetsfynd 22/8: saknade auth-grind helt — se lib/client-context.ts::getActiveClientId().
export async function GET() {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;
  try {
    const clientId = await resolveClientId();
    const cfg = await getGhlConfig(clientId);
    if (!cfg) return NextResponse.json({ connected: false });
    const { meta, error } = await ghlBlogMeta(cfg);
    if (error) return NextResponse.json({ connected: true, error });
    return NextResponse.json({ connected: true, meta });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
