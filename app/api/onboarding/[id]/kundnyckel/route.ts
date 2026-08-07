// ONBOARD-7 steg 4: Håkan klistrar in kundnyckeln, systemet verifierar och bockar av.
import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrCustomer } from "@/lib/api-auth";
import { hamtaOnboarding, verifieraKundnyckel } from "@/lib/onboard/steg-status";

export const runtime = "nodejs";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;
  const { id } = await ctx.params;

  let b: { nyckel?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 }); }

  const vy = await hamtaOnboarding(id);
  if (!vy) return NextResponse.json({ error: "Onboardingen hittades inte." }, { status: 404 });
  if (!vy.locationId) return NextResponse.json({ error: "GHL-kontot är inte skapat än (steg 3)." }, { status: 400 });

  // Nyckeln loggas ALDRIG — varken vid träff eller miss. Se lib/onboard/steg-status.ts.
  const r = await verifieraKundnyckel(vy.locationId, b.nyckel ?? "");
  if (!r.ok) return NextResponse.json({ error: r.fel, saknadeScopes: r.saknadeScopes }, { status: 400 });
  return NextResponse.json({ ok: true, onboarding: await hamtaOnboarding(id) });
}
