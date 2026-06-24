import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminSession, passwordMatches, ADMIN_COOKIE, ADMIN_TTL_SECONDS } from "@/lib/admin-auth";
import { setActiveClientId, HM_MOTOR_ID } from "@/lib/client-context";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const expected = process.env.ADMIN_PASSWORD;          // full admin (alla klienter)
  const hmExpected = process.env.HMMOTOR_PASSWORD;      // HM Motor-egen, låst till HM Motor
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

  // Full admin → ingen scope. HM Motor-lösenord → session låst till HM Motor.
  let scope: string | null = null;
  if (await passwordMatches(password, expected)) {
    scope = null;
  } else if (hmExpected && (await passwordMatches(password, hmExpected))) {
    scope = HM_MOTOR_ID;
  } else {
    return NextResponse.json({ error: "Fel lösenord" }, { status: 401 });
  }

  const token = await createAdminSession(secret, scope || undefined);
  const c = await cookies();
  c.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // localhost kör http → annars sätts ingen cookie
    sameSite: "lax",
    maxAge: ADMIN_TTL_SECONDS,
    path: "/",
  });
  // Pinna aktiv klient direkt för scopad inloggning (server-side pinnas den ändå i getActiveClientId).
  if (scope) await setActiveClientId(scope);
  return NextResponse.json({ ok: true });
}
