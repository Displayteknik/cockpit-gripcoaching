// POST /api/fokus/synk — "Synka nu". Hämtar affärerna ur MySales och uppdaterar spegeln.
//
// Läser bara. Ingenting skrivs till MySales härifrån — pipelinen ägs där, och den som
// flyttar ett kort gör det i MySales.
import { NextResponse } from "next/server";
import { requireAdminOrCustomer } from "@/lib/api-auth";
import { getActiveClientId } from "@/lib/client-context";
import { synkaFokus, senastSynkadFokus } from "@/lib/fokus/synk";

export const runtime = "nodejs";

export async function POST() {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;

  const clientId = await getActiveClientId();
  const res = await synkaFokus(clientId, true);

  let senastSynkad: string | null = null;
  try {
    senastSynkad = await senastSynkadFokus(res.ids);
  } catch {
    /* åldern kunde inte läsas — vyn säger "okänd ålder", aldrig "färsk" */
  }

  return NextResponse.json({
    ok: res.ok,
    antal: res.antal ?? null,
    borttagna: res.borttagna ?? 0,
    senastSynkad,
    fel: res.ok ? null : res.fel || "Okänt fel mot MySales",
  });
}
