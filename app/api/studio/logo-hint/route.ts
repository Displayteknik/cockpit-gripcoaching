import { NextRequest, NextResponse } from "next/server";
import { normalizePayload } from "@/lib/studio/payload";
import { loadBrand } from "@/lib/studio/brand";
import { computeLogoHint } from "@/lib/studio/logo-contrast";
import { requireAdminOrCustomer } from "@/lib/api-auth";

export const runtime = "nodejs";
export const maxDuration = 30;

// POST /api/studio/logo-hint — { payload, slideIndex? } → { url, plate } | { hint: null }
//
// KVALITET-3/6b: loggvalet (BILD-5a/6b) mäter bakgrunden med sharp och kan därför bara
// köras på servern. Render-routen (/studio/render/...) hade hinten, men det är INTE den
// som blir de publicerade pixlarna i molnet — export, "spara i biblioteket" och
// publicering fångar live-editorn i webbläsaren (html-to-image), och den fick aldrig
// någon hint. Resultatet: preview visade rätt loggvariant, den publicerade bilden fel.
// Den här routen ger klienten exakt samma beslut som render-routen använder.
export async function POST(req: NextRequest) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;

  try {
    const body = await req.json().catch(() => ({}));
    const payload = normalizePayload(body.payload || {});
    const slideIndex = Math.max(0, Number(body.slideIndex ?? 0) || 0);
    const brand = await loadBrand(payload.clientId);
    const hint = await computeLogoHint(payload.templateId, payload, brand, slideIndex);
    return NextResponse.json({ hint });
  } catch (e) {
    // Fail-open: utan hint faller mallen tillbaka på sitt gamla val, aldrig ett tomt kort.
    return NextResponse.json({ hint: null, error: (e as Error).message });
  }
}
