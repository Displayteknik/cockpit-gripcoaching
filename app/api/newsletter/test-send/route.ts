import { NextRequest, NextResponse } from "next/server";
import { getActiveClientId } from "@/lib/client-context";
import { requireAdminOrCustomer } from "@/lib/api-auth";
import { hasModule } from "@/lib/entitlements";
import { sendEmail, emailConfigured } from "@/lib/email";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/newsletter/test-send — { to, subject, html, text? }
// Skickar ETT testmejl till en adress användaren anger (aldrig massutskick i v1).
export async function POST(req: NextRequest) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;
  try {
    const clientId = await getActiveClientId();
    if (!(await hasModule(clientId, "newsletter").catch(() => false))) {
      return NextResponse.json({ error: "Nyhetsbrev ingår inte i ditt paket" }, { status: 403 });
    }
    if (!emailConfigured()) {
      return NextResponse.json({ error: "E-postutskick är inte konfigurerat (RESEND_API_KEY saknas). Du kan kopiera HTML:en och skicka via ditt eget verktyg så länge." }, { status: 400 });
    }

    const b = await req.json().catch(() => ({}));
    const to = String(b.to || "").trim().toLowerCase();
    const subject = String(b.subject || "").trim().slice(0, 200);
    const html = typeof b.html === "string" ? b.html : "";
    const text = typeof b.text === "string" ? b.text : undefined;

    if (!EMAIL_RE.test(to)) return NextResponse.json({ error: "Ogiltig e-postadress" }, { status: 400 });
    if (!subject || !html) return NextResponse.json({ error: "Ämnesrad och innehåll krävs" }, { status: 400 });

    const res = await sendEmail({ to, subject: `[TEST] ${subject}`, html, text });
    if (!res.sent) return NextResponse.json({ error: `Kunde inte skicka: ${res.reason || "okänt fel"}` }, { status: 502 });
    return NextResponse.json({ sent: true, id: res.id });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
