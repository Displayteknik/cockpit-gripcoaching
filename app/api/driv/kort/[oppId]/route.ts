import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { byggKort } from "@/lib/driv/kort";

export const runtime = "nodejs";

// GET /api/driv/kort/{oppId} — sammansätter kortet live. Ägar-only i DRIV-1 (agera-panelen
// är avstängd, kundversionen är parkerad, se ordens "Ingår inte").
export async function GET(_req: NextRequest, { params }: { params: Promise<{ oppId: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { oppId } = await params;
  try {
    const kort = await byggKort(oppId);
    return NextResponse.json(kort);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 200 });
  }
}
