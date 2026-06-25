import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession, getSessionScope, ADMIN_COOKIE } from "@/lib/admin-auth";

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

// ── /api-grind ──────────────────────────────────────────────────────────────
// Default: ALLA /api-rutter kräver admin-session (fail-closed). Undantagen nedan.
const pfx = (path: string, p: string) => path === p || path.startsWith(p + "/");

// Avsiktligt publika (självskyddande/scopade — verifierat i granskning).
function isPublicApi(path: string): boolean {
  if (path === "/api/admin/login") return true;            // själva inloggningen
  if (path === "/api/google/callback") return true;        // OAuth-retur (Google, ingen cookie)
  if (path === "/api/ikigai/public") return true;          // publik lead-magnet
  if (pfx(path, "/api/track")) return true;                // spårningspixel
  if (pfx(path, "/api/lead")) return true;                 // publikt lead-formulär
  if (pfx(path, "/api/indexnow")) return true;             // IndexNow-ping
  if (path.startsWith("/api/share/")) return true;         // publik kund-godkännandelänk (token i path)
  return false;                                            // OBS: /api/share (skapa) = admin
}

// Cron-rutter: Vercel Cron autentiserar via CRON_SECRET INNE i routen (fail-closed efter steg 3).
// proxy:n får inte blockera dem (de har ingen admin-cookie).
const CRON_PATHS = new Set([
  "/api/agents/night-iterate",
  "/api/blog/cron",
  "/api/fordon/sync-cron",
  "/api/google/gsc/cron",
  "/api/instagram/publish-internal",
  "/api/reports/weekly-cron",
  "/api/scheduler/cron",
]);

// Rutter som BÅDE admin och kundportalen (/k) använder. Grindas i routen med
// requireAdminOrCustomer() (admin- ELLER kund-session). proxy:n släpper igenom.
function isCustomerServedApi(path: string): boolean {
  if (path.startsWith("/api/customer/")) return true;
  return (
    path === "/api/seo/analytics" ||
    path === "/api/seo/audit" ||
    path === "/api/seo/content-audit" ||
    path === "/api/seo/keywords" ||
    path === "/api/seo/keyword-ideas"
  );
}

// True om routen ska admin-grindas av proxy:n.
function isGuardedApi(path: string): boolean {
  if (!path.startsWith("/api/")) return false;
  if (isPublicApi(path)) return false;
  if (CRON_PATHS.has(path)) return false;
  if (isCustomerServedApi(path)) return false;
  return true;
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
    // Klient-scopad session (t.ex. HM Motor): bara fordons-sidorna. Allt annat
    // (HQ, andra moduler, Puck-editorn) → tillbaka till Fordon. Datan är redan
    // pinnad server-side, detta håller även UI:t låst till deras egen yta.
    const scope = secret ? await getSessionScope(token, secret) : null;
    if (scope) {
      // Scopad klient får: Fordon, Sidor (sidlista) och Puck-editorn (/admin) —
      // allt pinnat till deras egen tenant. Övriga moduler → tillbaka till Fordon.
      const allowed =
        path === "/dashboard/fordon" || path.startsWith("/dashboard/fordon/") ||
        path === "/dashboard/sidor" || path.startsWith("/dashboard/sidor/") ||
        path === "/admin" || path.startsWith("/admin/");
      if (!allowed) {
        return NextResponse.redirect(new URL("/dashboard/fordon", req.url));
      }
    }
  }

  // API-grind: alla /api-rutter kräver admin-session UTOM publika/cron/kund-betjänade
  // (se isGuardedApi). Detta är "steg 2" — route handlers täcks inte av sid-grinden ovan.
  if (isGuardedApi(path)) {
    const secret = process.env.ADMIN_SESSION_SECRET;
    const token = req.cookies.get(ADMIN_COOKIE)?.value;
    const ok = secret ? await verifyAdminSession(token, secret) : false;
    if (!ok) {
      return NextResponse.json({ error: "ej inloggad" }, { status: 401 });
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
