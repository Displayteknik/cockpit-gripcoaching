// ONBOARD-7: en kunds steg — läs och bocka av.
import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrCustomer } from "@/lib/api-auth";
import { hamtaOnboarding, sattStegStatus } from "@/lib/onboard/steg-status";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;
  const { id } = await ctx.params;
  const vy = await hamtaOnboarding(id);
  if (!vy) return NextResponse.json({ error: "Onboardingen hittades inte." }, { status: 404 });
  return NextResponse.json({ onboarding: vy });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;
  const { id } = await ctx.params;
  let b: { nyckel?: string; status?: string; notering?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 }); }

  const tillatna = ["vantar", "pagar", "klart", "blockerat", "hoppat"];
  if (!b.nyckel || !b.status || !tillatna.includes(b.status)) {
    return NextResponse.json({ error: "nyckel och giltig status krävs" }, { status: 400 });
  }
  const r = await sattStegStatus(id, b.nyckel, b.status as never, b.notering ?? null);
  if (!r.ok) return NextResponse.json({ error: r.fel }, { status: 500 });
  return NextResponse.json({ onboarding: await hamtaOnboarding(id) });
}
