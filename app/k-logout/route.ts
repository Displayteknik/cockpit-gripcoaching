import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const c = await cookies();
  c.delete("customer_token");
  c.delete("customer_client_id");
  return NextResponse.redirect(new URL("/k-utloggad", req.url));
}
