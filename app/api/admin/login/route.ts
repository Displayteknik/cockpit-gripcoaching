import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminSession, passwordMatches, ADMIN_COOKIE, ADMIN_TTL_SECONDS } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const expected = process.env.ADMIN_PASSWORD;
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!expected || !secret) {
    return NextResponse.json({ error: "Admin-auth är inte konfigurerad på servern." }, { status: 500 });
  }

  let password = "";
  try {
    ({ password } = await req.json());
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan" }, { status: 400 });
  }

  if (!(await passwordMatches(password, expected))) {
    return NextResponse.json({ error: "Fel lösenord" }, { status: 401 });
  }

  const token = await createAdminSession(secret);
  const c = await cookies();
  c.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: ADMIN_TTL_SECONDS,
    path: "/",
  });
  return NextResponse.json({ ok: true });
}
