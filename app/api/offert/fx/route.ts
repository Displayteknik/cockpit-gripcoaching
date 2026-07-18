import { NextResponse } from "next/server";
import { requireAdminOrCustomer } from "@/lib/api-auth";
import { getRatesToSEK } from "@/lib/offert/fx";

export const runtime = "nodejs";

// GET /api/offert/fx — dagens SEK-kurser (USD/EUR/CNY) + buffert, för landat-pris-kalkyl i klienten.
export async function GET() {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;
  const fx = await getRatesToSEK();
  return NextResponse.json(fx);
}
