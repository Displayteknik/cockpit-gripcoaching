import { NextRequest, NextResponse } from "next/server";
import { resolveCustomerToken } from "@/lib/customer-context";

export const runtime = "nodejs";

// GET /k/[token] — kundens ingång till MySales Pro
// Validerar token, sätter session-cookies, omdirigerar till kund-dashboard.
// Som route handler kan vi sätta cookies på samma response som redirecten.
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await resolveCustomerToken(token);

  if (!session) {
    return NextResponse.redirect(new URL("/k-utloggad", req.url));
  }

  const res = NextResponse.redirect(new URL("/k", req.url));
  res.cookies.set("customer_token", token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  res.cookies.set("customer_client_id", session.client_id, {
    httpOnly: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  res.cookies.set("active_client_id", session.client_id, {
    httpOnly: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return res;
}
