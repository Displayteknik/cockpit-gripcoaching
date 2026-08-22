import { NextResponse } from "next/server";
import { resolveClientId } from "@/lib/client-context";
import { getGhlConfig, ghlListAccounts } from "@/lib/studio/ghl";
import { requireAdminOrCustomer } from "@/lib/api-auth";
import { KANAL_ANATOMI, KANAL_NYCKLAR, type GhlKonto } from "@/lib/kanal-anatomi";

export const runtime = "nodejs";

// KANAL-2 (HELG-1 DEL 5): fem av nio kanalers ghlPlatform-sträng (tiktok/pinterest/
// youtube/threads/bluesky) var en bästa gissning, aldrig mätt mot ett skarpt konto
// (se lib/kanal-anatomi.ts filhuvud). Håkans beslut 22/8: fail-closed är rätt
// (en fel sträng gör bara att kanalen aldrig syns som kopplad, ingen skada) — men
// den FÖRSTA riktiga inkopplingen ska loggas i stället för att tyst passera, så
// gissningen verifieras av verklig data i stället för att förbli en gissning för evigt.
export function loggaOverifieradePlattformar(clientId: string, accounts: GhlKonto[]) {
  for (const konto of accounts) {
    const platform = (konto.platform || "").toLowerCase().trim();
    const kanal = KANAL_NYCKLAR.find((k) => KANAL_ANATOMI[k].ghlPlatform === platform);
    if (kanal && !KANAL_ANATOMI[kanal].verifieradPlattformstrang) {
      // eslint-disable-next-line no-console
      console.log(
        `[kanal-anatomi] Overifierad plattformssträng bekräftad live: "${platform}" matchar kanalen ${KANAL_ANATOMI[kanal].namn} (${kanal}), tenant ${clientId}. Sätt verifieradPlattformstrang: true i lib/kanal-anatomi.ts.`,
      );
    }
  }
}

// GET /api/studio/ghl-accounts — kopplade sociala konton för aktiv klient (LÄS).
// { connected:false } om klienten saknar GHL-koppling. Admin ELLER kund (kunden får se om
// FB/LI är kopplat via MySales och publicera den vägen). Tenant-låst via getActiveClientId.
export async function GET() {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;
  try {
    const clientId = await resolveClientId();
    const cfg = await getGhlConfig(clientId);
    if (!cfg) return NextResponse.json({ connected: false, accounts: [] });
    const { accounts, error } = await ghlListAccounts(cfg);
    if (error) return NextResponse.json({ connected: true, accounts: [], error });
    loggaOverifieradePlattformar(clientId, accounts);
    return NextResponse.json({ connected: true, accounts });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
