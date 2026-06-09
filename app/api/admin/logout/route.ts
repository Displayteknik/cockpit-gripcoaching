import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const c = await cookies();
  c.delete(ADMIN_COOKIE);
  return NextResponse.redirect(new URL("/logga-in", req.url), { status: 303 });
}
