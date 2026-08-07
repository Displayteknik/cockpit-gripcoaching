// ONBOARD-7: listvyn — alla pågående onboardingar med stegstatus.
import { NextResponse } from "next/server";
import { requireAdminOrCustomer } from "@/lib/api-auth";
import { listaOnboardingar } from "@/lib/onboard/steg-status";

export const runtime = "nodejs";

export async function GET() {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;
  try {
    return NextResponse.json({ onboardingar: await listaOnboardingar() });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
