// TEXT-1 — röktest: verifierar att shimen + env + klientupplösning fungerar under tsx
// innan hela batchen körs. Ingen AI-generering här.
import { readFileSync } from "node:fs";
import path from "node:path";

// 1) Ladda .env.local manuellt (tsx laddar inte env-filer själv)
const envPath = path.resolve(process.cwd(), ".env.local");
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}

// 2) Shim-kakor: signerad admin-session + aktiv klient
const { __setBatchCookie } = await import("next/headers") as unknown as {
  __setBatchCookie: (n: string, v: string) => void;
};
const { createAdminSession, ADMIN_COOKIE } = await import("@/lib/admin-auth");
const secret = process.env.ADMIN_SESSION_SECRET!;
__setBatchCookie(ADMIN_COOKIE, await createAdminSession(secret));
__setBatchCookie("active_client_id", "a6a33547-5ca7-475f-9a62-43ff2c74d000"); // Displayteknik

// 3) Verifiera upplösning
const { getActiveClientId, getActiveClient } = await import("@/lib/client-context");
const id = await getActiveClientId();
const client = await getActiveClient();
console.log("resolved clientId:", id);
console.log("client name:", client?.name);

// 4) Profil-läsning (via resolveClientId → shim-kakan)
const { getProfileAsMarkdown } = await import("@/lib/knowledge");
const profile = await getProfileAsMarkdown();
console.log("profile length:", profile.length, "| innehåller Displayteknik:", /displayteknik/i.test(profile));

// 5) Auth-grinden som route-handlers använder
const { requireAdminOrCustomer } = await import("@/lib/api-auth");
console.log("requireAdminOrCustomer denied?:", (await requireAdminOrCustomer()) !== null);

// 6) next/server importerbar? (route-filer importerar NextRequest/NextResponse)
const ns = await import("next/server");
console.log("next/server ok:", typeof ns.NextResponse?.json === "function");

// 7) writing-rules helpers
const wr = await import("@/lib/content/writing-rules");
console.log("raknaCta('boka nu'):", wr.raknaCta("boka nu"), "| harSvagHook('Många företag...'):", wr.harSvagHook("Många företag gör fel"));
