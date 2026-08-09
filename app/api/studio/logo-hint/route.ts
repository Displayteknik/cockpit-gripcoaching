import { NextRequest, NextResponse } from "next/server";
import { MAX_SLIDES, normalizePayload } from "@/lib/studio/payload";
import { loadBrand } from "@/lib/studio/brand";
import { computeLogoHint } from "@/lib/studio/logo-contrast";
import { requireAdminOrCustomer } from "@/lib/api-auth";

export const runtime = "nodejs";
export const maxDuration = 30;

// POST /api/studio/logo-hint
//   { payload, slideIndex? }        → { hint }            (oförändrat kontrakt)
//   { payload, slideIndexes: n[] }  → { hint, hints[] }   (AKUT-KARUSELL)
//
// KVALITET-3/6b: loggvalet (BILD-5a/6b) mäter bakgrunden med sharp och kan därför bara
// köras på servern. Render-routen (/studio/render/...) hade hinten, men det är INTE den
// som blir de publicerade pixlarna i molnet — export, "spara i biblioteket" och
// publicering fångar live-editorn i webbläsaren (html-to-image), och den fick aldrig
// någon hint. Resultatet: preview visade rätt loggvariant, den publicerade bilden fel.
// Den här routen ger klienten exakt samma beslut som render-routen använder.
//
// AKUT-KARUSELL: en karusell exporteras som N bilder, och varje slide har sin EGEN
// bakgrund. En hint för den slide användaren råkade titta på är fel för de andra —
// exakt den bugg BILD-6b stängde (mörkt foto + tunn vit logga). Därför kan klienten
// begära alla slides i ETT anrop i stället för N anrop per tangenttryck.
// Fail-open per slide: en slide som kastar ger null, resten levereras ändå.
export async function POST(req: NextRequest) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;

  try {
    const body = await req.json().catch(() => ({}));
    const payload = normalizePayload(body.payload || {});
    const brand = await loadBrand(payload.clientId);

    const raa = Array.isArray(body.slideIndexes) ? body.slideIndexes : null;
    if (raa) {
      // Tak = MAX_SLIDES; ett skjutet index-fält får aldrig bli N mätningar av samma bild.
      const index = raa.slice(0, MAX_SLIDES).map((n: unknown) => Math.max(0, Number(n) || 0));
      const hints = await Promise.all(
        index.map((i: number) => computeLogoHint(payload.templateId, payload, brand, i).catch(() => null)),
      );
      return NextResponse.json({ hint: hints[0] ?? null, hints });
    }

    const slideIndex = Math.max(0, Number(body.slideIndex ?? 0) || 0);
    const hint = await computeLogoHint(payload.templateId, payload, brand, slideIndex);
    return NextResponse.json({ hint, hints: [hint] });
  } catch (e) {
    // Fail-open: utan hint faller mallen tillbaka på sitt gamla val, aldrig ett tomt kort.
    return NextResponse.json({ hint: null, hints: [], error: (e as Error).message });
  }
}
