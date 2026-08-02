// ETAPP K2-1 — creditledgern. Testar det som avgör om kunden får rätt saldo:
// periodgränsen i svensk tid, saldoräkningen, videons påbörjade klipp och prisfallbacken.
//
// De rena funktionerna testas direkt. Kontoflödet (reset, dragning, spärr, påfyllning)
// testas mot en fejkad Supabase-klient så hela kedjan körs utan databas.

import { describe, expect, it, vi, beforeEach } from "vitest";
import { aktuellPeriod, raknaSaldo, videoKlipp, STANDARDKVOT, type Konto } from "@/lib/credits";

const konto = (o: Partial<Konto> = {}): Konto => ({
  tenant_id: "t1",
  monthly_quota: STANDARDKVOT,
  extra_credits: 0,
  period_start: "2026-08-01",
  used_this_period: 0,
  ...o,
});

describe("K2 · periodgränsen räknas i svensk tid", () => {
  it("mitt i månaden ger innevarande månads första dag", () => {
    expect(aktuellPeriod(new Date("2026-08-15T12:00:00Z"))).toBe("2026-08-01");
  });

  it("⚠ strax efter midnatt svensk tid den 1:a hör till den NYA månaden", () => {
    // Servern kör UTC. 31 juli 23:30 UTC är redan 1 augusti 01:30 i Sverige — utan
    // tidszonen hade den genereringen räknats mot juli och kunden fått fel saldo.
    expect(aktuellPeriod(new Date("2026-07-31T23:30:00Z"))).toBe("2026-08-01");
  });

  it("strax före midnatt svensk tid hör fortfarande till den gamla månaden", () => {
    expect(aktuellPeriod(new Date("2026-07-31T21:30:00Z"))).toBe("2026-07-01");
  });

  it("fungerar över årsskiftet", () => {
    expect(aktuellPeriod(new Date("2025-12-31T23:30:00Z"))).toBe("2026-01-01");
  });
});

describe("K2 · saldo", () => {
  it("saldo = kvot plus köpta credits minus förbrukat", () => {
    const s = raknaSaldo(konto({ extra_credits: 100, used_this_period: 120 }));
    expect(s.saldo).toBe(280);
    expect(s.anvant).toBe(120);
  });

  it("förvarningen slår till under 15 procent kvar", () => {
    const s = raknaSaldo(konto({ used_this_period: 260 })); // 40 av 300 kvar
    expect(s.procentKvar).toBeCloseTo(13.33, 1);
    expect(s.procentKvar).toBeLessThan(15);
  });

  it("saldot går aldrig under noll i procenttalet", () => {
    expect(raknaSaldo(konto({ used_this_period: 400 })).procentKvar).toBe(0);
  });
});

describe("K2 · video prissätts per PÅBÖRJAT femsekundersklipp", () => {
  it("fem sekunder är ett klipp, sex är två", () => {
    expect(videoKlipp(5)).toBe(1);
    expect(videoKlipp(6)).toBe(2);
    expect(videoKlipp(10)).toBe(2);
    expect(videoKlipp(11)).toBe(3);
  });

  it("noll eller okänd längd räknas som ett klipp, aldrig noll", () => {
    expect(videoKlipp(0)).toBe(1);
    expect(videoKlipp(NaN)).toBe(1);
  });
});

// ── Kontoflödet mot en fejkad databas ──────────────────────────────────────

interface FakeRad { [k: string]: unknown }

/** Samma konto som `konto()`, men som en indexerbar rad i den fejkade tabellen. */
const rad = (o: Partial<Konto> = {}): FakeRad => ({ ...konto(o) });

/** Minimal Supabase-stub: räcker för de anrop lib/credits gör. */
function fakeDb() {
  const tabeller: Record<string, FakeRad[]> = {
    credit_accounts: [],
    credit_transactions: [],
    credit_pricing: [
      { action: "social-bild", credits: 3, active: true },
      { action: "hero-bild", credits: 8, active: true },
      { action: "video", credits: 15, active: true },
    ],
    topup_orders: [],
  };

  function from(namn: string) {
    let rader = tabeller[namn];
    const filter: Array<[string, unknown]> = [];
    let uppdatering: FakeRad | null = null;
    let insats: FakeRad | null = null;
    const matchar = (r: FakeRad) => filter.every(([k, v]) => r[k] === v);

    const api = {
      select() { return api; },
      eq(k: string, v: unknown) { filter.push([k, v]); return api; },
      lt(k: string, v: string) { rader = rader.filter((r) => String(r[k]) < v); return api; },
      limit() { return api; },
      insert(rad: FakeRad) { insats = rad; return api; },
      update(rad: FakeRad) { uppdatering = rad; return api; },
      async maybeSingle() {
        if (insats) { tabeller[namn].push(insats); return { data: insats }; }
        if (uppdatering) {
          const traff = tabeller[namn].find(matchar);
          if (!traff) return { data: null };
          Object.assign(traff, uppdatering);
          return { data: traff };
        }
        return { data: tabeller[namn].filter(matchar)[0] ?? null };
      },
      then(lös: (v: { data: FakeRad[] }) => unknown) {
        if (insats) { tabeller[namn].push(insats); return Promise.resolve({ data: [insats] }).then(lös); }
        if (uppdatering) {
          const träffar = tabeller[namn].filter(matchar);
          träffar.forEach((t) => Object.assign(t, uppdatering));
          return Promise.resolve({ data: träffar }).then(lös);
        }
        return Promise.resolve({ data: rader.filter(matchar) }).then(lös);
      },
    };
    return api;
  }
  return { tabeller, klient: { from } };
}

let db: ReturnType<typeof fakeDb>;
vi.mock("@/lib/supabase-admin", () => ({ supabaseService: () => db.klient }));
vi.mock("@/lib/entitlements", () => ({ hasModule: async () => true }));

beforeEach(async () => {
  db = fakeDb();
  const { nollstallCreditPrisCache, nollstallCreditModulCache } = await import("@/lib/credits");
  nollstallCreditPrisCache();
  nollstallCreditModulCache();
});

describe("K2 · månadsreset", () => {
  it("nytt konto får standardkvoten och innevarande period", async () => {
    const { sakerstallKonto } = await import("@/lib/credits");
    const k = await sakerstallKonto("t1", new Date("2026-08-10T09:00:00Z"));
    expect(k?.monthly_quota).toBe(STANDARDKVOT);
    expect(k?.period_start).toBe("2026-08-01");
    expect(k?.used_this_period).toBe(0);
  });

  it("gammal period nollställer förbrukningen och loggar en reset-transaktion", async () => {
    const { sakerstallKonto } = await import("@/lib/credits");
    db.tabeller.credit_accounts.push(rad({ period_start: "2026-07-01", used_this_period: 210 }));

    const k = await sakerstallKonto("t1", new Date("2026-08-02T09:00:00Z"));
    expect(k?.period_start).toBe("2026-08-01");
    expect(k?.used_this_period).toBe(0);
    const reset = db.tabeller.credit_transactions.filter((t) => t.type === "monthly_reset");
    expect(reset).toHaveLength(1);
  });

  it("ingen rollover: köpta credits överlever, oanvänd kvot gör det inte", async () => {
    const { sakerstallKonto, raknaSaldo: rakna } = await import("@/lib/credits");
    db.tabeller.credit_accounts.push(rad({ period_start: "2026-07-01", used_this_period: 10, extra_credits: 50 }));
    const k = await sakerstallKonto("t1", new Date("2026-08-02T09:00:00Z"));
    // 290 oanvända credits från juli följer INTE med — saldot är kvot + köpta, inget mer.
    expect(rakna(k!).saldo).toBe(STANDARDKVOT + 50);
  });

  it("samma period rör ingenting och loggar inget", async () => {
    const { sakerstallKonto } = await import("@/lib/credits");
    db.tabeller.credit_accounts.push(rad({ used_this_period: 42 }));
    const k = await sakerstallKonto("t1", new Date("2026-08-20T09:00:00Z"));
    expect(k?.used_this_period).toBe(42);
    expect(db.tabeller.credit_transactions).toHaveLength(0);
  });
});

describe("K2 · dragning och spärr", () => {
  it("en bild drar sitt pris och transaktionen pekar på ledgerraden", async () => {
    const { dragCredits } = await import("@/lib/credits");
    db.tabeller.credit_accounts.push(rad());

    const kostnad = await dragCredits({ tenantId: "t1", atgard: "social-bild", usageEventId: "evt-1" });
    expect(kostnad).toBe(3);
    expect(db.tabeller.credit_accounts[0].used_this_period).toBe(3);

    const tx = db.tabeller.credit_transactions.find((t) => t.type === "usage");
    expect(tx?.delta).toBe(-3);
    // ★ Kärnkravet: utan den här kopplingen mäter credits något annat än det som kostade pengar.
    expect(tx?.usage_event_id).toBe("evt-1");
  });

  it("video drar per påbörjat femsekundersklipp", async () => {
    const { dragCredits } = await import("@/lib/credits");
    db.tabeller.credit_accounts.push(rad());
    expect(await dragCredits({ tenantId: "t1", atgard: "video", antal: 2, usageEventId: "evt-2" })).toBe(30);
  });

  it("tomt saldo spärrar med ett vänligt besked, utan kronor", async () => {
    const { kontrolleraCredits } = await import("@/lib/credits");
    db.tabeller.credit_accounts.push(rad({ used_this_period: STANDARDKVOT }));

    const lage = await kontrolleraCredits("t1", "social-bild");
    expect(lage.tillaten).toBe(false);
    expect(lage.besked).toContain("förnyas den 1:a");
    expect(lage.besked).not.toMatch(/\bkr\b|kronor/);
  });

  it("för lite kvar för en dyr åtgärd spärrar, men en billig släpps igenom", async () => {
    const { kontrolleraCredits } = await import("@/lib/credits");
    db.tabeller.credit_accounts.push(rad({ used_this_period: STANDARDKVOT - 5 })); // 5 kvar

    expect((await kontrolleraCredits("t1", "hero-bild")).tillaten).toBe(false); // 8 credits
    expect((await kontrolleraCredits("t1", "social-bild")).tillaten).toBe(true); // 3 credits
  });

  it("utan tenant gäller inga credits (byråns egna körningar)", async () => {
    const { kontrolleraCredits } = await import("@/lib/credits");
    const lage = await kontrolleraCredits(null, "social-bild");
    expect(lage.tillaten).toBe(true);
    expect(lage.aktiv).toBe(false);
  });
});

describe("K2 · påfyllning", () => {
  it("insättning ökar saldot och kräver en notering", async () => {
    const { laggTillCredits, hamtaSaldo } = await import("@/lib/credits");
    db.tabeller.credit_accounts.push(rad());

    expect(await laggTillCredits({ tenantId: "t1", credits: 100, typ: "manual_grant", note: "" })).toBe(false);
    expect(await laggTillCredits({ tenantId: "t1", credits: 100, typ: "manual_grant", note: "Kompensation för misslyckad körning" })).toBe(true);

    expect((await hamtaSaldo("t1"))?.saldo).toBe(STANDARDKVOT + 100);
    expect(db.tabeller.credit_transactions.find((t) => t.type === "manual_grant")?.delta).toBe(100);
  });

  it("en beställning i taget: en andra ger samma besked utan ny rad", async () => {
    const { skapaTopupOrder } = await import("@/lib/credits");
    const forsta = await skapaTopupOrder("t1");
    expect(forsta.besked).toContain("beställd");
    db.tabeller.topup_orders[0].status = "pending";

    const andra = await skapaTopupOrder("t1");
    expect(andra.ok).toBe(true);
    expect(andra.besked).toContain("redan");
    expect(db.tabeller.topup_orders).toHaveLength(1);
  });

  it("godkänd beställning sätter in creditsen och stämplar beslutet", async () => {
    const { skapaTopupOrder, beslutaTopupOrder, hamtaSaldo } = await import("@/lib/credits");
    db.tabeller.credit_accounts.push(rad());
    await skapaTopupOrder("t1");
    const order = db.tabeller.topup_orders[0];
    order.id = "o1";
    order.status = "pending";

    expect(await beslutaTopupOrder("o1", true, "owner")).toBe(true);
    expect(order.status).toBe("approved");
    expect(order.decided_by).toBe("owner");
    expect((await hamtaSaldo("t1"))?.saldo).toBe(STANDARDKVOT + 100);
  });

  it("en redan beslutad beställning kan inte godkännas igen", async () => {
    const { beslutaTopupOrder } = await import("@/lib/credits");
    db.tabeller.topup_orders.push({ id: "o2", tenant_id: "t1", credits: 100, status: "approved" });
    expect(await beslutaTopupOrder("o2", true)).toBe(false);
  });
});
