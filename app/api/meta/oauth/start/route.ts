import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { requireAdmin } from "@/lib/api-auth";
import { buildAuthUrl } from "@/lib/meta-oauth";

export const runtime = "nodejs";

// ANSLUT-1: startar ägar-OAuth. State (slumpad nonce) sätts som httpOnly-cookie och
// skickas med i dialogen; callbacken jämför → CSRF-skydd. Bara admin får starta.
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const state = crypto.randomBytes(16).toString("hex");
  const res = NextResponse.redirect(buildAuthUrl(state));
  res.cookies.set("meta_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    maxAge: 600,
    path: "/",
  });
  return res;
}
