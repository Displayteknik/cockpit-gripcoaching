import { NextResponse } from "next/server";

export const runtime = "nodejs";

// PENSIONERAD (AKUT-KARUSELL b, 2026-08-09) — samma mönster som /dashboard/skapa.
//
// Detta var plattformens ANDRA karusellmotor: egen generateJSON + eget röstblock (alltså
// utanför lib/prompt-core, utan sanningskrav, perspektivregel och prisregel), och den
// renderade 1080x1080 medan Studios ark-karusell renderar i inläggets format (4:5 som
// standard). Två motorer med olika mått och olika regeltäckning gav olika kvalitet
// beroende på vilken knapp kunden råkade trycka på. G-0 avsnitt 0.1 och 0.2.
//
// Ersättare: Studios karusell (lib/studio/carousel.ts → ArkKarusell → klient-render),
// som går genom prompt-core och sedan AKUT-KARUSELL a exporterar och publicerar alla
// slides. Ingen funktion är borttagen — den har flyttat.
//
// 410 Gone, inte 404: en försvunnen väg ska säga att den ÄR pensionerad och vart man
// ska, annars felsöker någon en bugg som inte finns.
const SVAR = {
  error: "Karusellerna byggs numera i Studio, där alla slides får inläggets format och exporteras som en bild var.",
  href: "/dashboard/studio",
  pensionerad: "2026-08-09",
};

export async function POST() {
  return NextResponse.json(SVAR, { status: 410 });
}

export async function GET() {
  return NextResponse.json(SVAR, { status: 410 });
}
