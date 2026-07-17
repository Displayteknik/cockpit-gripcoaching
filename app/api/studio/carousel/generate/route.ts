import { NextRequest, NextResponse } from "next/server";
import { getActiveClient, getActiveClientId } from "@/lib/client-context";
import { generateCarousel } from "@/lib/studio/carousel";

export const runtime = "nodejs";
export const maxDuration = 45;

// POST /api/studio/carousel/generate — { topic, points } → { slides: StudioSlide[] }
// Admin-grindad av proxy.ts. Text grundas i klientens röst + hook-playbook.
export async function POST(req: NextRequest) {
  try {
    const client = await getActiveClient();
    const clientId = await getActiveClientId();
    const body = await req.json().catch(() => ({}));
    const topic = String(body.topic || "").slice(0, 300);
    if (!topic) return NextResponse.json({ error: "Ämne saknas" }, { status: 400 });
    const points = Number(body.points) || 3;

    const slides = await generateCarousel({
      clientId,
      topic,
      points,
      brandName: client?.name,
      industry: client?.industry || undefined,
    });
    if (!slides.length) return NextResponse.json({ error: "Kunde inte generera karusell" }, { status: 500 });
    return NextResponse.json({ slides });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
