// Säkerhetsfyndet 22/8 — getActiveClientId() grenen för "ingen session alls" litade
// tidigare på active_client_id-cookien utan att verifiera NÅGON session. httpOnly
// hindrar bara JS i en riktig webbläsare, inte en anropare som sätter cookien direkt
// i en rå HTTP-request. Bevisat live mot /api/studio/posts/[id] (200 OK, ingen
// inloggning, förfalskad cookie). Detta test bevakar att grenen ALDRIG mer litar på
// cookien utan en verifierad admin- eller kund-session bakom den.

import { beforeEach, describe, expect, it, vi } from "vitest";

let cookieStore = new Map<string, string>();
let refererValue = "";

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieStore.has(name) ? { value: cookieStore.get(name) } : undefined),
  }),
  headers: async () => ({
    get: (name: string) => (name.toLowerCase() === "referer" ? refererValue : null),
  }),
}));

vi.mock("@/lib/admin-auth", () => ({
  ADMIN_COOKIE: "admin_session",
  verifyAdminSession: async () => false, // ingen giltig admin-session i dessa test
  getSessionScope: async () => null,
}));

vi.mock("@/lib/customer-context", () => ({
  getCustomerSession: async () => null, // ingen giltig kund-session i dessa test
}));

const FORFALSKAD_TENANT = "440e6cf2-ae93-4ab8-9515-2f738861ef31";
const DEFAULT_CLIENT_ID = "00000000-0000-0000-0000-000000000001";

beforeEach(() => {
  cookieStore = new Map();
  refererValue = "";
});

describe("getActiveClientId · ingen session, ingen cookie-tillit (säkerhetsfixen)", () => {
  it("en förfalskad active_client_id-cookie utan session ger DEFAULT, inte cookiens värde", async () => {
    cookieStore.set("active_client_id", FORFALSKAD_TENANT);
    const { getActiveClientId } = await import("@/lib/client-context");
    const id = await getActiveClientId();
    expect(id).toBe(DEFAULT_CLIENT_ID);
    expect(id).not.toBe(FORFALSKAD_TENANT);
  });

  it("ingen cookie alls ger också DEFAULT (samma gren, samma utfall)", async () => {
    const { getActiveClientId } = await import("@/lib/client-context");
    const id = await getActiveClientId();
    expect(id).toBe(DEFAULT_CLIENT_ID);
  });

  it("resolveClientId (den delade wrappern rutterna faktiskt anropar) ärver samma skydd", async () => {
    cookieStore.set("active_client_id", FORFALSKAD_TENANT);
    const { resolveClientId } = await import("@/lib/client-context");
    const id = await resolveClientId();
    expect(id).toBe(DEFAULT_CLIENT_ID);
  });

  it("en förfalskad cookie + falsk referer till /k utan äkta kund-session ger fortfarande DEFAULT", async () => {
    // customer_token-cookien saknas (mockad getCustomerSession → null) trots referer-spoofing.
    cookieStore.set("active_client_id", FORFALSKAD_TENANT);
    refererValue = "https://cockpit.gripcoaching.se/k/studio";
    const { getActiveClientId } = await import("@/lib/client-context");
    const id = await getActiveClientId();
    expect(id).toBe(DEFAULT_CLIENT_ID);
  });
});
