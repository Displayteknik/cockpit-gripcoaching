import { NextRequest, NextResponse } from "next/server";
import { getActiveClient, resolveClientId } from "@/lib/client-context";
import { generateCarousel } from "@/lib/studio/carousel";
import { requireAdminOrCustomer } from "@/lib/api-auth";
import type { CompassParams } from "@/lib/content-compass/prompt";

export const runtime = "nodejs";
export const maxDuration = 45;

// POST /api/studio/carousel/generate — { topic, points } → { slides: StudioSlide[] }
// Admin-grindad av proxy.ts. Text grundas i klientens röst + hook-playbook.
export async function POST(req: NextRequest) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;

  try {
    const client = await getActiveClient();
    const clientId = await resolveClientId();
    const body = await req.json().catch(() => ({}));
    const topic = String(body.topic || "").slice(0, 300);
    if (!topic) return NextResponse.json({ error: "Ämne saknas" }, { status: 400 });
    const points = Number(body.points) || 3;
    // TEXT-1: skickas som parametrar — prompt-core renderar compass-blocket.
    const compass = body.compass && typeof body.compass === "object" ? (body.compass as CompassParams) : undefined;

    const { slides, generationId } = await generateCarousel({
      clientId,
      topic,
      points,
      brandName: client?.name,
      industry: client?.industry || undefined,
      compass,
    });
    if (!slides.length) return NextResponse.json({ error: "Kunde inte generera karusell" }, { status: 500 });
    // G-1c: id:t följer med till klienten och tillbaka vid sparning, så generationen kan
    // bindas till inlägget den blev. Utan den resan vet loggen aldrig vad som användes.
    return NextResponse.json({ slides, generationId });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
