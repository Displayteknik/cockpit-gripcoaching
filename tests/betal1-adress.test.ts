import { afterEach, beforeEach, describe, expect, it } from "vitest";

// BETAL-1 — basadressen. Buggen den har filen finns for att fanga:
//
// VERCEL_URL satts ALLTID pa Vercel och pekar pa den enskilda deployen
// (hmmotor-next-abc123.vercel.app). Med den som fallback hade en kund som betalat i
// Stripe landat pa en adress hon aldrig sett, och paminnelsemejlen hade lankat dit.

const ORIGINAL = { ...process.env };

async function basadress() {
  // Modulen laser env vid anrop, men vi importerar om for att vara sakra pa att
  // ingen cachning smyger in om filen andras.
  const m = await import("@/lib/billing/adress");
  return m.basadress();
}

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.VERCEL_ENV;
  delete process.env.VERCEL_URL;
});

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("basadress", () => {
  it("skarp deploy anvander riktiga domanen, ALDRIG deployens egen adress", async () => {
    process.env.VERCEL_ENV = "production";
    process.env.VERCEL_URL = "hmmotor-next-abc123.vercel.app";
    expect(await basadress()).toBe("https://cockpit.gripcoaching.se");
  });

  it("en uttrycklig instalning vinner over allt", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://minegen.se";
    process.env.VERCEL_ENV = "production";
    expect(await basadress()).toBe("https://minegen.se");
  });

  it("avslutande snedstreck tas bort sa lankarna inte far dubbla", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://minegen.se/";
    expect(await basadress()).toBe("https://minegen.se");
  });

  it("forhandsvisning pa Vercel anvander deployens adress, dar ar den ratt", async () => {
    process.env.VERCEL_ENV = "preview";
    process.env.VERCEL_URL = "hmmotor-next-abc123.vercel.app";
    expect(await basadress()).toBe("https://hmmotor-next-abc123.vercel.app");
  });

  it("lokalt blir det localhost", async () => {
    expect(await basadress()).toBe("http://localhost:3480");
  });
});

describe("webhookAdress", () => {
  it("hangs pa ratt sokvag", async () => {
    process.env.VERCEL_ENV = "production";
    process.env.VERCEL_URL = "hmmotor-next-abc123.vercel.app";
    const m = await import("@/lib/billing/adress");
    expect(m.webhookAdress()).toBe("https://cockpit.gripcoaching.se/api/stripe/webhook");
  });
});
