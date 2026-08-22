// Pionjär-städningen (22/8) — /api/cockpit/coach-users saknade admin-grinden helt:
// vem som helst kunde hämta hela pionjärlistan (GHL-location-id, pipeline-namn,
// kontaktantal) utan inloggning. Rättat, och namn-fallbacket mot clients testas här
// så det aldrig kan skriva över en pionjärs egen identitet.

import { beforeEach, describe, expect, it, vi } from "vitest";

let adminDenied: Response | null = null;
let coachUsersSvar: { data: unknown; error: unknown } = { data: [], error: null };
let lobbySvar: { data: unknown; error: unknown } = { data: [], error: null };
let clientsSvar: { data: unknown; error: unknown } = { data: [], error: null };

vi.mock("@/lib/api-auth", () => ({ requireAdmin: async () => adminDenied }));
vi.mock("@/lib/supabase-admin", () => ({
  supabaseServer: () => ({
    from: (table: string) => {
      if (table === "coach_users") return { select: () => ({ order: () => Promise.resolve(coachUsersSvar) }) };
      if (table === "lobby_contacts") return { select: () => Promise.resolve(lobbySvar) };
      if (table === "clients") return { select: () => ({ in: () => Promise.resolve(clientsSvar) }) };
      throw new Error(`oväntad tabell i testet: ${table}`);
    },
  }),
}));

const { GET } = await import("@/app/api/cockpit/coach-users/route");

const rad = (over: Record<string, unknown> = {}) => ({
  id: "440e6cf2-ae93-4ab8-9515-2f738861ef31",
  ghl_location_id: null,
  ghl_api_token: null,
  ghl_pipeline_name: null,
  personal_os: null,
  created_at: "2026-08-01T10:00:00Z",
  updated_at: "2026-08-01T10:00:00Z",
  ...over,
});

beforeEach(() => {
  adminDenied = null;
  coachUsersSvar = { data: [], error: null };
  lobbySvar = { data: [], error: null };
  clientsSvar = { data: [], error: null };
});

describe("coach-users · admin-grind (säkerhetsfyndet)", () => {
  it("en icke-admin nekas — routen svarar aldrig ut listan utan grind", async () => {
    adminDenied = new Response(JSON.stringify({ error: "not admin" }), { status: 403 });
    const r = await GET();
    expect(r.status).toBe(403);
  });

  it("en admin släpps igenom", async () => {
    coachUsersSvar = { data: [rad()], error: null };
    const r = await GET();
    expect(r.status).toBe(200);
  });
});

describe("coach-users · client_name-fallback", () => {
  it("en pionjär utan eget namn/brand får clients.name som fallback", async () => {
    coachUsersSvar = { data: [rad({ personal_os: null })], error: null };
    clientsSvar = { data: [{ id: "440e6cf2-ae93-4ab8-9515-2f738861ef31", name: "Ledarskapskultur" }], error: null };
    const d = await (await GET()).json();
    expect(d.users[0].client_name).toBe("Ledarskapskultur");
    expect(d.users[0].display_name).toBeNull();
  });

  it("en pionjär MED eget display_name behåller det — fallbacket skriver aldrig över", async () => {
    coachUsersSvar = { data: [rad({ personal_os: { display_name: "Egna Namnet" } })], error: null };
    clientsSvar = { data: [{ id: "440e6cf2-ae93-4ab8-9515-2f738861ef31", name: "Ledarskapskultur" }], error: null };
    const d = await (await GET()).json();
    expect(d.users[0].display_name).toBe("Egna Namnet");
    // client_name finns fortfarande med i svaret (frontend väljer ordning), bara inte
    // det som visas — men den ska inte ha ersatt display_name på serversidan.
    expect(d.users[0].client_name).toBe("Ledarskapskultur");
  });

  it("en demo-pionjär (icke-UUID-id) matchas aldrig mot clients, får null", async () => {
    coachUsersSvar = { data: [rad({ id: "demo-coach-erik-001" })], error: null };
    const d = await (await GET()).json();
    expect(d.users[0].client_name).toBeNull();
    expect(d.users[0].status).toBe("demo");
  });

  it("ingen matchande clients-rad ger null, aldrig ett påhittat namn", async () => {
    coachUsersSvar = { data: [rad({ id: "00000000-0000-4000-8000-000000000099" })], error: null };
    clientsSvar = { data: [], error: null };
    const d = await (await GET()).json();
    expect(d.users[0].client_name).toBeNull();
  });
});
