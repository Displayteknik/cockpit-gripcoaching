import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { berakna } from "@/lib/pris/kabinettkalkylator";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await req.json();
  const bredd = Number(body.bredd_m);
  const hojd = Number(body.hojd_m);
  const dubbelsidig = !!body.dubbelsidig;
  const prisKrPerKvm = Number(body.prisKrPerKvm);
  if (!bredd || !hojd || !prisKrPerKvm) {
    return NextResponse.json({ error: "bredd_m, hojd_m och prisKrPerKvm krävs" }, { status: 400 });
  }
  return NextResponse.json(berakna(bredd, hojd, dubbelsidig, prisKrPerKvm));
}
