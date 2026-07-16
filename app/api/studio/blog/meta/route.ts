import { NextResponse } from "next/server";
import { getActiveClientId } from "@/lib/client-context";
import { getGhlConfig, ghlBlogMeta } from "@/lib/studio/ghl";

export const runtime = "nodejs";

// GET /api/studio/blog/meta — bloggsajter/författare/kategorier för aktiv klients GHL.
export async function GET() {
  try {
    const clientId = await getActiveClientId();
    const cfg = await getGhlConfig(clientId);
    if (!cfg) return NextResponse.json({ connected: false });
    const { meta, error } = await ghlBlogMeta(cfg);
    if (error) return NextResponse.json({ connected: true, error });
    return NextResponse.json({ connected: true, meta });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
