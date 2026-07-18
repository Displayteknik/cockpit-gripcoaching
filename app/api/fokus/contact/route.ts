import { NextResponse } from "next/server";
import { requireAdminOrCustomer } from "@/lib/api-auth";
import { getActiveClientId } from "@/lib/client-context";
import { resolveCoachGhl } from "@/lib/coach-bridge";

export const runtime = "nodejs";

const BASE = "https://services.leadconnectorhq.com";

// GET /api/fokus/contact?contactId=... — kontaktuppgifter till coach-faktarutan (tel, mejl).
// Läser GHL-kontakten via klientens token (bryggan). Read-only.
export async function GET(req: Request) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;

  const contactId = new URL(req.url).searchParams.get("contactId");
  if (!contactId) return NextResponse.json({ error: "contactId krävs" }, { status: 400 });

  const clientId = await getActiveClientId();
  const { token } = await resolveCoachGhl(clientId);
  if (!token) return NextResponse.json({ linked: false });

  const gh = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Version: "2021-07-28" };
  const r = await fetch(`${BASE}/contacts/${contactId}`, { headers: gh });
  if (!r.ok) return NextResponse.json({ error: `GHL ${r.status}` }, { status: 200 });
  const c = (await r.json())?.contact;
  if (!c) return NextResponse.json({ error: "Kontakt ej hittad" }, { status: 200 });

  const namn = [c.firstName, c.lastName].filter(Boolean).join(" ") || c.contactName || c.name || "";
  return NextResponse.json({
    linked: true,
    namn,
    email: c.email || "",
    telefon: c.phone || "",
    foretag: c.companyName || "",
  });
}
