import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession, ADMIN_COOKIE } from "@/lib/admin-auth";

// Multi-host routing + admin-grind.
// - cockpit.gripcoaching.se     → cockpit-app (/dashboard, /admin, /api, /granska, /api/track)
//   blockerar HM Motors publika sajt på denna domän
// - hmmotor-next.vercel.app     → standard (publika HM Motor + dashboard)
// - hmmotor.se (framtid)        → bara publika HM Motor
const COCKPIT_HOSTS = ["cockpit.gripcoaching.se"];

// Adminytan (sid-navigering). Skyddas av HMAC-signerad admin_session-cookie.
// OBS: detta skyddar sidor — route handlers/Server Actions måste härdas separat
// (se Next-docs: proxy täcker inte Server Functions). Det är steg 2.
function isAdminArea(path: string): boolean {
  return (
    path === "/dashboard" ||
    path.startsWith("/dashboard/") ||
    path === "/admin" ||
    path.startsWith("/admin/")
  );
}

export async function proxy(req: NextRequest) {
  const host = req.headers.get("host") || "";
  const path = req.nextUrl.pathname;

  // Admin-grind: kräver giltig signerad session för /dashboard + /admin.
  if (isAdminArea(path)) {
    const secret = process.env.ADMIN_SESSION_SECRET;
    const token = req.cookies.get(ADMIN_COOKIE)?.value;
    const ok = secret ? await verifyAdminSession(token, secret) : false;
    if (!ok) {
      const url = new URL("/logga-in", req.url);
      url.searchParams.set("from", path);
      return NextResponse.redirect(url);
    }
  }

  // Lokal utveckling — root → dashboard så testning fungerar
  const isLocalhost = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  if (isLocalhost && path === "/") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (COCKPIT_HOSTS.includes(host)) {
    // Tillåt: dashboard, admin, api, granska, /, statiska
    if (path === "/") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    // Blockera publika sajt-rutter (HM Motor specifika)
    const blocked = ["/fordon", "/blogg", "/kontakt", "/om-oss", "/finansiering", "/just-nu"];
    if (blocked.some((p) => path === p || path.startsWith(p + "/"))) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  // Skicka med sökvägen så root-layouten kan grinda bort HM Motor-globaler
  // (schema, Clarity, spårning, widget) på gripcoaching-ytor som /ikigai.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", path);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    // Allt utom statiska assets
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|js|css)$).*)",
  ],
};
