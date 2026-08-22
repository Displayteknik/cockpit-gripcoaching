// G-9 tillägg — "Per tenant"-vyn på Kvalitet-sidan.
//
// Samma hårda regel som resten av G-9: en nolla får aldrig se ut som ett mätvärde,
// och "vyn kunde inte läsas" (t.ex. migrationen generation_per_tenant.sql inte körd
// än) får aldrig se ut som "ingen tenant har genererat något".

import { beforeEach, describe, expect, it, vi } from "vitest";

let versionSvar: { data: unknown; error: unknown } = { data: [], error: null };
let tenantSvar: { data: unknown; error: unknown } = { data: [], error: null };
let clientsSvar: { data: unknown; error: unknown } = { data: [], error: null };

vi.mock("@/lib/supabase-admin", () => ({
  supabaseService: () => ({
    from: (table: string) => {
      if (table === "generation_per_promptversion") return { select: () => Promise.resolve(versionSvar) };
      if (table === "generation_per_tenant") return { select: () => Promise.resolve(tenantSvar) };
      if (table === "clients") return { select: () => ({ in: () => Promise.resolve(clientsSvar) }) };
      throw new Error(`oväntad tabell i testet: ${table}`);
    },
  }),
}));
vi.mock("@/lib/api-auth", () => ({ requireAdmin: async () => null }));

const { GET } = await import("@/app/api/kvalitet/route");

const tenantRad = (over: Record<string, unknown> = {}) => ({
  tenant_id: "440e6cf2-ae93-4ab8-9515-2f738861ef31",
  syfte: "caption",
  antal: 100,
  kasserade: 10,
  publicerade: 40,
  utan_kostnadskoppling: 0,
  forsta: "2026-08-01T10:00:00Z",
  senaste: "2026-08-09T10:00:00Z",
  ...over,
});

beforeEach(() => {
  versionSvar = { data: [], error: null };
  tenantSvar = { data: [], error: null };
  clientsSvar = { data: [], error: null };
});

describe("G-9 tenant · namnet slås upp mot clients, aldrig påhittat", () => {
  it("en tenant med matchande clients-rad får sitt riktiga namn", async () => {
    tenantSvar = { data: [tenantRad()], error: null };
    clientsSvar = { data: [{ id: "440e6cf2-ae93-4ab8-9515-2f738861ef31", name: "Ledarskapskultur" }], error: null };
    const d = await (await GET()).json();
    expect(d.tenantRader[0].tenantNamn).toBe("Ledarskapskultur");
    expect(d.tenantRader[0].tenantId).toBe("440e6cf2-ae93-4ab8-9515-2f738861ef31");
  });

  it("en tenant UTAN matchande clients-rad får null-namn, inte ett hittepå-namn", async () => {
    tenantSvar = { data: [tenantRad({ tenant_id: "00000000-0000-4000-8000-000000000099" })], error: null };
    clientsSvar = { data: [], error: null };
    const d = await (await GET()).json();
    expect(d.tenantRader[0].tenantNamn).toBeNull();
    expect(d.tenantRader[0].tenantId).toBe("00000000-0000-4000-8000-000000000099");
  });

  it("null tenant_id (ägarflöde) ger tenantId null och tenantNamn null, skiljs från en okänd tenant via id", async () => {
    tenantSvar = { data: [tenantRad({ tenant_id: null })], error: null };
    const d = await (await GET()).json();
    expect(d.tenantRader[0].tenantId).toBeNull();
    expect(d.tenantRader[0].tenantNamn).toBeNull();
  });
});

describe("G-9 tenant · SAKNAS-regeln gäller även tenant-vyn", () => {
  it("vyn saknas (migration ej körd) ger tenantFel, INTE en tom lista", async () => {
    tenantSvar = { data: null, error: { message: 'relation "generation_per_tenant" does not exist' } };
    const d = await (await GET()).json();
    expect(d.tenantFel).toContain("generation_per_tenant");
    expect(d.tenantRader).toEqual([]);
    // Huvudsvaret (per promptversion) ska fortfarande fungera även om tenant-vyn saknas —
    // ett fel i tillägget får inte ta ner resten av sidan.
    expect(await (await GET()).status).toBe(200);
  });

  it("vyn läst men genuint tom ger tenantFel = null (skiljer sig från felet ovan)", async () => {
    tenantSvar = { data: [], error: null };
    const d = await (await GET()).json();
    expect(d.tenantFel).toBeNull();
    expect(d.tenantRader).toEqual([]);
  });
});

describe("G-9 tenant · för få genereringar ger andel = null, samma regel som per-version-vyn", () => {
  it("0 publicerade av 3 för en tenant blir null, inte 0 %", async () => {
    tenantSvar = { data: [tenantRad({ antal: 3, publicerade: 0, kasserade: 0 })], error: null };
    const d = await (await GET()).json();
    expect(d.tenantRader[0].andelPublicerade).toBeNull();
    expect(d.tenantRader[0].publicerade).toBe(0);
  });
});
