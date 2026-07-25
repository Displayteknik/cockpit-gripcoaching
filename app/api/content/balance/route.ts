import { NextResponse } from "next/server";
import { getActiveClientId } from "@/lib/client-context";
import { getContentOverview } from "@/lib/content/overview";
import { getCompassSchedule } from "@/lib/content-compass/schedule";
import { CADENCE_DAYS } from "@/lib/content-compass/data";
import { analyzeMix, warningsFor } from "@/lib/content-compass/rules";
import { hasModule } from "@/lib/entitlements";
import { requireAdminOrCustomer } from "@/lib/api-auth";

export const runtime = "nodejs";

// GET /api/content/balance — CC-3 balansmätare.
// Faktisk innehållsmix (rullande 30 dagar) mot tenantens schema-mål + varningar.
// Admin ELLER kund (grindas här, tenant-låst via getActiveClientId).
export async function GET() {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;
  try {
    const clientId = await getActiveClientId();
    if (!clientId) return NextResponse.json({ error: "Ingen aktiv klient" }, { status: 400 });

    const enabled = await hasModule(clientId, "compass").catch(() => false);
    const [overview, schedule] = await Promise.all([
      getContentOverview(clientId),
      getCompassSchedule(clientId),
    ]);

    const items = overview.items.map((i) => ({ funnel_level: i.funnel_level, four_a: i.four_a, when: i.when }));
    const mix = analyzeMix(items, 30);
    const warnings = warningsFor(items);

    // Mål-mix ur schemat (aktiva dagar per kadens).
    const active = CADENCE_DAYS[schedule.cadence];
    let tTofu = 0, tMofu = 0, tBofu = 0;
    for (const dk of active) {
      const f = schedule.days[dk]?.funnel;
      if (f === "tofu") tTofu++; else if (f === "mofu") tMofu++; else if (f === "bofu") tBofu++;
    }
    const tTotal = tTofu + tMofu + tBofu || 1;
    const target = {
      perWeek: active.length,
      tofuShare: tTofu / tTotal,
      mofuShare: tMofu / tTotal,
      bofuShare: tBofu / tTotal,
    };

    return NextResponse.json({ enabled, cadence: schedule.cadence, mix, warnings, target });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
