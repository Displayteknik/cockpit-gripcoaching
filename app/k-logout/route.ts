import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

// Logga ut sker BARA via POST (aktivt klick på knappen).
// En passiv GET (förladdning, länk-skanning av tillägg, antivirus) får ALDRIG
// logga ut kunden — den skickas bara tillbaka till portalen.
export async function POST(req: NextRequest) {
  const c = await cookies();
  c.delete("customer_token");
  c.delete("customer_client_id");
  c.delete("active_client_id");
  return NextResponse.redirect(new URL("/k-utloggad", req.url), { status: 303 });
}

export async function GET(req: NextRequest) {
  // Ingen utloggning på GET — bara tillbaka till portalen.
  return NextResponse.redirect(new URL("/k", req.url));
}
