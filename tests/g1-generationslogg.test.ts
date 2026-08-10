// G-1 — generationsloggen och promptversionen.
//
// Två saker bevisas här:
//  1. **Promptversionen räknas ur regeltexten.** Den är deterministisk (samma regler ger
//     samma sträng) och den är LÅST till ett känt värde nedan. Ändrar någon en regel i
//     prompt-core faller det här testet — det är avsikten. Ett handhållet versionsnummer
//     hade blivit fel exakt den gång det spelade roll.
//  2. **Loggningen fäller aldrig flödet.** En trasig mätning får kosta mätdata, aldrig en
//     kunds text. Samma beslut som loggaHandelse i lib/ai-usage.

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Supabase-attrapp ────────────────────────────────────────────────────────
// Kedjan som lib/generationslogg använder: insert().select().maybeSingle() och
// update().eq().select().maybeSingle(). Attrappen kan också kasta på begäran.
const svar = { data: null as unknown, kasta: false };
const sista = { tabell: "", rad: null as Record<string, unknown> | null };

function byggKedja() {
  const k: Record<string, unknown> = {};
  const steg = () => {
    if (svar.kasta) throw new Error("databasen svarar inte");
    return k;
  };
  k.insert = (rad: Record<string, unknown>) => { sista.rad = rad; return steg(); };
  k.update = (rad: Record<string, unknown>) => { sista.rad = rad; return steg(); };
  k.eq = () => steg();
  k.select = () => steg();
  k.maybeSingle = async () => { if (svar.kasta) throw new Error("databasen svarar inte"); return { data: svar.data }; };
  return k;
}

vi.mock("@/lib/supabase-admin", () => ({
  supabaseService: () => ({
    from: (t: string) => { sista.tabell = t; return byggKedja(); },
  }),
}));

import { promptVersion } from "@/lib/prompt-core";
import { loggaGenerering, kopplaTillInlagg, markeraKasserad, loggFormat, loggFunnel } from "@/lib/generationslogg";

// Låst värde. Faller det här testet har en regel i prompt-core ändrats — kontrollera att
// det var avsiktligt och skriv in den nya versionen. Det är hela poängen: en regeländring
// ska aldrig kunna passera obemärkt och göra före/efter-mätningen omöjlig att tolka.
// 2026-08-09: G-2 lade till storyns anatomi (712d3248 → 5082a4b7), G-3 byggde om
// variantregeln ur hooktypslistan (5082a4b7 → 32a4ec3d). Testet fällde båda innan de
// kunde passera tyst — det är exakt det förloppet låset finns för.
// 2026-08-09: G-4 lade till bevislagret (32a4ec3d → b9ab87e2). BÅDA grenarna versioneras:
// den med material ("använd dessa siffror, priser är inte bevis") och den utan
// ("du har inget att belägga med — skriv utan sifferpåståenden"). Skillnaden i utfall
// mellan de två grenarna är hela det G-4 ska gå att mäta.
// 2026-08-10: G-5 lade till CTA-typkravet (b9ab87e2 → 3b3ea753). Den MJUKA grenen
// versioneras nu separat — det var den som ändrades: mjukningen gällde förut även
// CTA-typen, så nivån OCH typen blev valfria tillsammans. Nu är typen hård i alla tre
// grenarna (satt compass, mjuk default, ingen compass).
const LAST_VERSION = "v1-3b3ea753";

beforeEach(() => {
  svar.data = null;
  svar.kasta = false;
  sista.tabell = "";
  sista.rad = null;
});

describe("G-1 · promptversionen", () => {
  it("är deterministisk — samma regler ger samma sträng", () => {
    expect(promptVersion()).toBe(promptVersion());
  });

  it("har formen v<major>-<hash>", () => {
    expect(promptVersion()).toMatch(/^v\d+-[0-9a-f]{8}$/);
  });

  it("är låst till ett känt värde (ändrad regel ska fälla testet, inte passera tyst)", () => {
    expect(promptVersion()).toBe(LAST_VERSION);
  });
});

describe("G-1 · loggFormat: karusell är ett eget format", () => {
  it("karusell vinner över bildstorleken", () => {
    // G0 0.4 punkt 2: karusell och statisk bild blev samma rad eftersom formatet
    // härleddes ur URL:en. En karusell är inte 1080x1350 som råkar ha flera slides.
    expect(loggFormat({ format: "1080x1350", karusell: true })).toBe("karusell");
  });

  it("utan karusell används bildstorleken", () => {
    expect(loggFormat({ format: "1080x1920" })).toBe("1080x1920");
  });

  it("ren text har inget format — null, inte tom sträng", () => {
    expect(loggFormat({})).toBeNull();
    expect(loggFormat({ format: "" })).toBeNull();
  });
});

describe("G-1 · loggFunnel: hellre null än ett påhittat läge", () => {
  it("släpper igenom de tre riktiga nivåerna", () => {
    expect(loggFunnel("tofu")).toBe("tofu");
    expect(loggFunnel("mofu")).toBe("mofu");
    expect(loggFunnel("bofu")).toBe("bofu");
  });

  it("allt annat blir null", () => {
    for (const v of ["TOFU", "mitten", "", null, undefined, 3, {}]) {
      expect(loggFunnel(v)).toBeNull();
    }
  });
});

describe("G-1 · loggaGenerering", () => {
  it("skriver raden och returnerar id:t", async () => {
    svar.data = { id: "gen-1" };
    const id = await loggaGenerering({
      tenantId: "t-1",
      aiUsageEventId: "u-9",
      syfte: "karusell",
      format: "karusell",
      promptVersion: "v1-abcdef01",
      funnel: "tofu",
      lager: { sanningskrav: true },
      varianter: 3,
    });
    expect(id).toBe("gen-1");
    expect(sista.tabell).toBe("generation_log");
    expect(sista.rad).toMatchObject({
      tenant_id: "t-1",
      ai_usage_event_id: "u-9",
      syfte: "karusell",
      format: "karusell",
      prompt_version: "v1-abcdef01",
      funnel: "tofu",
      status: "ok",
      varianter: 3,
    });
  });

  it("saknad kostnadskoppling skrivs som null — aldrig en gissning", async () => {
    // En rad utan usage-id är en generering vi inte kan prissätta. Vyn räknar dem
    // separat; att fylla i något hade gjort mätningen osann i stället för ofullständig.
    svar.data = { id: "gen-2" };
    await loggaGenerering({ syfte: "caption", promptVersion: "v1-abcdef01" });
    expect(sista.rad?.ai_usage_event_id).toBeNull();
    expect(sista.rad?.tenant_id).toBeNull();
    expect(sista.rad?.format).toBeNull();
  });

  it("varianter är minst 1 — noll varianter finns inte", async () => {
    svar.data = { id: "gen-3" };
    await loggaGenerering({ syfte: "caption", promptVersion: "v1-abcdef01", varianter: 0 });
    expect(sista.rad?.varianter).toBe(1);
  });

  it("utan promptversion skrivs ingenting — en omätbar rad är värre än ingen", async () => {
    const id = await loggaGenerering({ syfte: "caption", promptVersion: "" });
    expect(id).toBeNull();
    expect(sista.tabell).toBe("");
  });

  it("en trasig databas fäller ALDRIG flödet", async () => {
    // Kärnan: mätningen får kosta mätdata, aldrig kundens text.
    svar.kasta = true;
    await expect(loggaGenerering({ syfte: "caption", promptVersion: "v1-abcdef01" })).resolves.toBeNull();
  });
});

describe("G-1 · kopplingen till inlägget", () => {
  it("skriver både tabell och id — id ensamt säger inte vilken ID-rymd det är", async () => {
    // studio_posts.ghl_post_id bär redan två ID-rymder i samma kolumn (G0 0.5).
    // Det felet upprepas inte här.
    svar.data = { id: "gen-1" };
    await expect(kopplaTillInlagg("gen-1", { tabell: "studio_posts", id: "p-77" })).resolves.toBe(true);
    expect(sista.rad).toEqual({ anvand_i_tabell: "studio_posts", anvand_i_id: "p-77" });
  });

  it("utan generations-id eller inläggs-id händer ingenting", async () => {
    await expect(kopplaTillInlagg(null, { tabell: "studio_posts", id: "p-77" })).resolves.toBe(false);
    await expect(kopplaTillInlagg("gen-1", { tabell: "studio_posts", id: "" })).resolves.toBe(false);
    expect(sista.tabell).toBe("");
  });

  it("en rad som inte fanns ger false, inte ett tyst true", async () => {
    svar.data = null;
    await expect(kopplaTillInlagg("finns-inte", { tabell: "studio_posts", id: "p-1" })).resolves.toBe(false);
  });

  it("en trasig databas fäller ALDRIG flödet", async () => {
    svar.kasta = true;
    await expect(kopplaTillInlagg("gen-1", { tabell: "studio_posts", id: "p-1" })).resolves.toBe(false);
  });
});

describe("G-1 · kasserade genereringar", () => {
  it("markeras som kasserade i stället för att försvinna", async () => {
    // En mätning som bara ser det publicerade läser bort exakt de fall där kvaliteten föll.
    svar.data = { id: "gen-5" };
    await expect(markeraKasserad("gen-5")).resolves.toBe(true);
    expect(sista.rad).toEqual({ status: "kasserad" });
  });

  it("utan id händer ingenting, och en trasig databas fäller inte flödet", async () => {
    await expect(markeraKasserad(null)).resolves.toBe(false);
    svar.kasta = true;
    await expect(markeraKasserad("gen-5")).resolves.toBe(false);
  });
});
