// Admin-grind för API-route-handlers. proxy.ts grindar bara SIDOR (/dashboard, /admin) —
// route handlers under /api måste grindas separat. Delad helper så alla admin-routes
// använder exakt samma kontroll (HMAC-session från admin-auth.ts).
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession, getSessionScope } from "./admin-auth";
import { getCustomerSession } from "./customer-context";

// True om aktuell request bär en giltig admin-session-cookie.
export async function isAdmin(): Promise<boolean> {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) return false; // fail-closed: ingen secret satt → ingen admin
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  return verifyAdminSession(token, secret);
}

// Klient-id som sessionen är LÅST till (t.ex. HM Motor), eller null för full admin.
// Routes använder detta för att neka klientväxling och filtrera klientlistor.
export async function getAdminScope(): Promise<string | null> {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) return null;
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  return getSessionScope(token, secret);
}

// Använd överst i en admin-route:
//   const denied = await requireAdmin();
//   if (denied) return denied;
// Returnerar 401-respons om ej admin, annars null (fortsätt).
export async function requireAdmin(): Promise<NextResponse | null> {
  if (await isAdmin()) return null;
  return NextResponse.json({ error: "ej inloggad" }, { status: 401 });
}

// För rutter som BÅDE admin-dashboarden och kundportalen (/k) anropar (delade SEO-rutter).
// Tillåt giltig admin-session ELLER giltig kund-session. Tenant-scopas redan via
// resolveClientId (referer-medveten). proxy:n släpper igenom dessa → grinden sker här.
export async function requireAdminOrCustomer(): Promise<NextResponse | null> {
  if (await isAdmin()) return null;
  if (await getCustomerSession()) return null;
  return NextResponse.json({ error: "ej inloggad" }, { status: 401 });
}
