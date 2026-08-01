// /api/profile/quality — profilens kvalitet, EN källa (PROFIL-1/F-mätare).
//
// Före: fem dimensioner som räknade `trim().length >= tröskel`. 593 tecken tomfraser
// plus sex uppladdningar gav 100 % och "Klar att producera"; Displaytekniks riktiga
// profil gav 89 %. Mätaren belönade ifyllnad och straffade substans.
//
// Nu: lib/profil/kvalitet.ts — deterministiska kriterier (K1–K8), viktade, med
// generisk-detektor, dubblettkontroll och förankringsgrind. Ingen AI i beräkningen.
// Svaret bär NIVÅ (uppsättning A), inte procent: procenttalet visas aldrig i UI:t.

import { NextResponse } from "next/server";
import { getActiveClientId } from "@/lib/client-context";
import { requireAdminOrCustomer } from "@/lib/api-auth";
import { profilKvalitet } from "@/lib/profil/las";
import { racker } from "@/lib/profil/kvalitet";

export const runtime = "nodejs";

export async function GET() {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;
  try {
    const clientId = await getActiveClientId();
    const rapport = await profilKvalitet(clientId);

    return NextResponse.json({
      niva: rapport.niva,
      niva_namn: rapport.nivaNamn,
      niva_konsekvens: rapport.nivaKonsekvens,
      ready_to_produce: racker(rapport),
      forankringsflagga: rapport.forankringsflagga,
      forankring_varning: rapport.forankringsVarning,
      tak_orsak: rapport.takOrsak,
      atgarder: rapport.atgarder,
      kriterier: rapport.kriterier,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
