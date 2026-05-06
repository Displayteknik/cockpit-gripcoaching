import { NextRequest, NextResponse } from "next/server";

// Multi-host routing:
// - cockpit.gripcoaching.se     → cockpit-app (/dashboard, /admin, /api, /granska, /api/track)
//   blockerar HM Motors publika sajt på denna domän
// - hmmotor-next.vercel.app     → standard (publika HM Motor + dashboard)
// - hmmotor.se (framtid)        → bara publika HM Motor
const COCKPIT_HOSTS = ["cockpit.gripcoaching.se"];

export function middleware(req: NextRequest) {
  const host = req.headers.get("host") || "";
  const path = req.nextUrl.pathname;

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

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Allt utom statiska assets
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|js|css)$).*)",
  ],
};
