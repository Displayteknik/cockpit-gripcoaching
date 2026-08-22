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

export interface KvalitetTenantRad {
  tenantId: string | null;
  /** null = ingen tenant (ägarflöde) ELLER en tenant utan matchande rad i clients. `tenantId` skiljer dem åt. */
  tenantNamn: string | null;
  syfte: string;
  antal: number;
  kasserade: number;
  publicerade: number;
  utanKostnadskoppling: number;
  forsta: string | null;
  senaste: string | null;
  andelPublicerade: number | null;
  andelKasserade: number | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const sb = supabaseService();
    const [{ data, error }, { data: tenantData, error: tenantError }] = await Promise.all([
      sb.from("generation_per_promptversion").select("*"),
      sb.from("generation_per_tenant").select("*"),
    ]);

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

    // Tenant-namnen slås upp separat — generation_per_tenant vet inte vad en tenant HETER,
    // bara dess id. Ingen matchning ELLER ett null-id blir "null" i svaret, aldrig ett
    // påhittat namn.
    // ⚠ Samma SAKNAS-regel som resten av sidan: om vyn inte går att läsa (t.ex. migrationen
    // `generation_per_tenant.sql` inte körd än) ska svaret säga det uttryckligen — INTE se
    // ut som "noll tenant-genereringar", vilket vore precis den typen av fel sidans egen
    // kommentar (rad 5-14) finns till för att förhindra.
    let tenantRader: KvalitetTenantRad[] = [];
    const tenantFel = tenantError ? tenantError.message : null;
    if (!tenantError && tenantData) {
      const tenantIds = Array.from(
        new Set(
          (tenantData as Record<string, unknown>[])
            .map((r) => (r.tenant_id ? String(r.tenant_id) : null))
            .filter((id): id is string => !!id && UUID_RE.test(id)),
        ),
      );
      const { data: clients } = tenantIds.length
        ? await sb.from("clients").select("id, name").in("id", tenantIds)
        : { data: [] as { id: string; name: string }[] };
      const namnPerId = new Map((clients ?? []).map((c) => [c.id, c.name]));

      tenantRader = (tenantData as Record<string, unknown>[]).map((r) => {
        const antal = Number(r.antal ?? 0);
        const publicerade = Number(r.publicerade ?? 0);
        const kasserade = Number(r.kasserade ?? 0);
        const nogMycket = antal >= MIN_FOR_ANDEL;
        const tenantId = r.tenant_id ? String(r.tenant_id) : null;
        return {
          tenantId,
          tenantNamn: tenantId ? namnPerId.get(tenantId) ?? null : null,
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
      tenantRader.sort((a, b) => b.antal - a.antal);
    }

    return NextResponse.json({
      rader,
      tenantRader,
      tenantFel,
      minForAndel: MIN_FOR_ANDEL,
      totalt: rader.reduce((s, r) => s + r.antal, 0),
      utanKostnadskoppling: rader.reduce((s, r) => s + r.utanKostnadskoppling, 0),
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, rader: null }, { status: 500 });
  }
}
