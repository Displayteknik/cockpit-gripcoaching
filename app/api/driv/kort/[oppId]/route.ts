import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getActiveClientId } from "@/lib/client-context";
import { DT_CLIENT_ID } from "@/lib/dt-client";
import { byggKort } from "@/lib/driv/kort";

export const runtime = "nodejs";

// GET /api/driv/kort/{oppId} — sammansätter kortet live. Ägar-only i DRIV-1 (agera-panelen
// är avstängd, kundversionen är parkerad, se ordens "Ingår inte").
//
// Läckage-fix 19/8: byggKort() läser samma DT-bara pipeline som Founder HQ/På G/Dagens
// drag — samma DT-spärr, annars går kortet att öppna direkt (URL med oppId) oavsett
// vilken klient som är aktiv, även efter att alla länkar till det gömts.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ oppId: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if ((await getActiveClientId()) !== DT_CLIENT_ID) {
    return NextResponse.json({ error: "Kortet visas bara när Displayteknik är aktiv klient." }, { status: 200 });
  }
  const { oppId } = await params;
  try {
    const kort = await byggKort(oppId);
    return NextResponse.json(kort);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 200 });
  }
}
