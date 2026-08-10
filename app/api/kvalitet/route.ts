// G-9 — kvalitetssidans data. Byråvy, aldrig kundvänd (ej i isCustomerServedApi).
//
// Läser vyn generation_per_promptversion (G-1). Vyn räknar bara det som är MÄTT — den
// fabricerar aldrig ett kvalitetsvärde, och det ansvaret ärver den här routen.
//
// ⚠ NOLL ÄR INTE SAMMA SAK SOM SAKNAS. Det är hela skälet till att routen finns i stället
// för att sidan läser vyn rakt av. SEO-verktyget gick ut till kund med nollor som såg ut
// som mätvärden, och det upprepas inte:
//   - "0 publicerade av 115" är en MÄTNING: texterna genererades och användes aldrig.
//   - En andel (publicerade/antal) är MENINGSLÖS när antalet är litet — 0 av 1 säger
//     ingenting om kvalitet. Routen räknar därför ingen procent under ett minimum, utan
//     lämnar fältet null och låter sidan skriva "för få för att mäta".
//   - `utan_kostnadskoppling` är inte ett fel i sig, men en rad utan kostnad går inte att
//     prissätta. Den siffran redovisas som en LUCKA, inte som en nolla.

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { supabaseService } from "@/lib/supabase-admin";

export const runtime = "nodejs";

/** Under så här många genereringar räknas ingen andel. En andel ur 3 rader lurar ögat. */
const MIN_FOR_ANDEL = 20;

export interface KvalitetRad {
  promptVersion: string;
  syfte: string;
  antal: number;
  kasserade: number;
  publicerade: number;
  utanKostnadskoppling: number;
  forsta: string | null;
  senaste: string | null;
  /** null = för få genereringar för att en andel ska betyda något. */
  andelPublicerade: number | null;
  andelKasserade: number | null;
}

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { data, error } = await supabaseService()
      .from("generation_per_promptversion")
      .select("*");

    if (error) {
      // Ärligt fel i stället för en tom lista som ser ut som "inga genereringar".
      return NextResponse.json({ error: "Kunde inte läsa mätdatan.", rader: null }, { status: 500 });
    }

    const rader: KvalitetRad[] = ((data ?? []) as Record<string, unknown>[]).map((r) => {
      const antal = Number(r.antal ?? 0);
      const publicerade = Number(r.publicerade ?? 0);
      const kasserade = Number(r.kasserade ?? 0);
      const nogMycket = antal >= MIN_FOR_ANDEL;
      return {
        promptVersion: String(r.prompt_version ?? ""),
        syfte: String(r.syfte ?? ""),
        antal,
        kasserade,
        publicerade,
        utanKostnadskoppling: Number(r.utan_kostnadskoppling ?? 0),
        forsta: r.forsta ? String(r.forsta) : null,
        senaste: r.senaste ? String(r.senaste) : null,
        andelPublicerade: nogMycket ? publicerade / antal : null,
        andelKasserade: nogMycket ? kasserade / antal : null,
      };
    });

    rader.sort((a, b) => (b.senaste ?? "").localeCompare(a.senaste ?? ""));

    return NextResponse.json({
      rader,
      minForAndel: MIN_FOR_ANDEL,
      totalt: rader.reduce((s, r) => s + r.antal, 0),
      utanKostnadskoppling: rader.reduce((s, r) => s + r.utanKostnadskoppling, 0),
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, rader: null }, { status: 500 });
  }
}
