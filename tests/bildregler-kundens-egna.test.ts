// KUNDENS EGNA BILDREGLER — Håkans beställning 2026-08-15:
// "min kund ska själv kunna lägga till regler för bildskapande, det är en styrka."
//
// ⚠ FYNDET SOM GJORDE ETAPPEN NÖDVÄNDIG, mätt i koden 15/8: rutorna FANNS redan i den
//   grafiska profilen, men bar inte hela vägen. "Får innehålla människor" skrevs in i en
//   mening som börjar "Visual treatment (applies to colour and light only, never change
//   the subject…)" — en motivregel inuti ett förbud mot motivändringar. Samtidigt delade
//   personrotationen ut "en kvinna som tittar på skärmen". Kunden kryssade i rutan och
//   ingenting hände.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { imageDirectiveSuffix, tolkaPersoner, NEUTRAL_DIRECTIVES, type KitDirectives } from "@/lib/studio/kit";

const kit = (over: Partial<KitDirectives>): KitDirectives => ({ ...NEUTRAL_DIRECTIVES, ...over });

describe("getKitDirectives BYGGER imageMotiv ur people/motiv, mockad DB", () => {
  // Samma mönster som tests/bild7-bildprompt.test.ts: DB mockas, KIT styr svaret.
  let KIT: Record<string, unknown> = {};
  beforeEach(() => { vi.resetModules(); KIT = {}; });

  async function laddaMedMock() {
    vi.doMock("@/lib/supabase-admin", () => ({
      supabaseService: () => ({
        from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { kit: KIT } }) }) }) }),
      }),
      supabaseServer: () => ({}),
    }));
    return import("@/lib/studio/kit");
  }

  it('imageStyle.people = "aldrig" ger imageMotiv OCH personer = "aldrig"', async () => {
    KIT = { imageStyle: { people: "aldrig" } };
    const { getKitDirectives } = await laddaMedMock();
    const d = await getKitDirectives("client-1");
    expect(d.personer).toBe("aldrig");
    expect(d.imageMotiv).toMatch(/no people at all/);
  });

  it('imageStyle.people = "alltid" kräver en person i bild', async () => {
    KIT = { imageStyle: { people: "alltid" } };
    const { getKitDirectives } = await laddaMedMock();
    const d = await getKitDirectives("client-1");
    expect(d.personer).toBe("alltid");
    expect(d.imageMotiv).toMatch(/at least one real person/);
  });

  it('"ibland" (default) lägger inget motivkrav om människor', async () => {
    KIT = { imageStyle: { people: "ibland" } };
    const { getKitDirectives } = await laddaMedMock();
    const d = await getKitDirectives("client-1");
    expect(d.personer).toBe("ibland");
    expect(d.imageMotiv).not.toMatch(/people/);
  });

  it('fritextfältet "Visa alltid" hamnar i imageMotiv, inte i imageExtra', async () => {
    KIT = { imageStyle: { motiv: "Våra egna produkter i verklig miljö" } };
    const { getKitDirectives } = await laddaMedMock();
    const d = await getKitDirectives("client-1");
    expect(d.imageMotiv).toContain("Våra egna produkter i verklig miljö");
    expect(d.imageExtra).not.toContain("Våra egna produkter");
  });
});

describe("kundens motivregler ligger UTANFÖR färg-och-ljus-meningen", () => {
  it("motivregeln står i en egen mening och säger att den väger tyngst", () => {
    const s = imageDirectiveSuffix(kit({ imageMotiv: "no people at all in the picture", imageExtra: "warm colour temperature" }));
    expect(s).toMatch(/THE CUSTOMER'S OWN IMAGE RULES/);
    expect(s).toMatch(/these override the guidance above/);
    // Och den ligger INTE inuti stilmeningen, som förbjuder motivändringar.
    const stilStart = s.indexOf("Visual treatment");
    const motivStart = s.indexOf("THE CUSTOMER'S OWN IMAGE RULES");
    expect(stilStart).toBeGreaterThan(-1);
    expect(motivStart).toBeGreaterThan(stilStart);
    expect(s.slice(stilStart, motivStart)).not.toMatch(/no people/);
  });

  it("stilraden är orörd och gäller fortfarande bara färg och ljus", () => {
    const s = imageDirectiveSuffix(kit({ imageExtra: "warm colour temperature" }));
    expect(s).toMatch(/applies to colour and light only/);
    expect(s).not.toMatch(/CUSTOMER'S OWN IMAGE RULES/);
  });

  it('"undvik" ligger kvar som egen mening', () => {
    expect(imageDirectiveSuffix(kit({ imageNegative: "stock photo grins" }))).toMatch(/Avoid: stock photo grins\./);
  });

  it("tomt kit ger inget tillägg alls", () => {
    expect(imageDirectiveSuffix(NEUTRAL_DIRECTIVES)).toBe("");
  });
});

describe("fältet läses likadant oavsett hur det skrevs", () => {
  it("boolean från den gamla kryssrutan", () => {
    expect(tolkaPersoner(false)).toBe("aldrig");
    expect(tolkaPersoner(true)).toBe("ibland");
  });

  it("svenska ord från brand-kit-agenten", () => {
    // Skarp data 15/8: Annas Blommor har people = "ibland" i databasen.
    expect(tolkaPersoner("ibland")).toBe("ibland");
    expect(tolkaPersoner("aldrig")).toBe("aldrig");
    expect(tolkaPersoner("nej")).toBe("aldrig");
    expect(tolkaPersoner("alltid")).toBe("alltid");
  });

  it("tomt eller okänt värde betyder ibland, aldrig ett tyst förbud", () => {
    expect(tolkaPersoner(undefined)).toBe("ibland");
    expect(tolkaPersoner("")).toBe("ibland");
    expect(tolkaPersoner("kanske")).toBe("ibland");
  });

  it("ytan och prompten läser fältet med SAMMA regel", () => {
    // Två tolkningar som glider isär visar ett val i rutan och gör ett annat i bilden.
    const sida = readFileSync(path.join(process.cwd(), "app/dashboard/brand-kit/page.tsx"), "utf8");
    expect(sida).toMatch(/function tolkaPersonval/);
    expect(sida).toMatch(/aldrig\|never\|nej\|no\|inga\|utan/);
    expect(sida).toMatch(/alltid\|always\|krav\|ska/);
  });
});

describe('"aldrig människor" stänger AV personrotationen', () => {
  it("byggaren väljer en no-people-kategori på VARJE position i serien, inte bara position 0", async () => {
    // Rotationen kan inte övertalas av en mening i prompten — den måste tystas. Mäts
    // genom BETEENDE, med kitet mockat (samma mönster som tests/akut-dm.test.ts): fem
    // positioner i en femslidesserie ska alla ge "no people", inte bara den positionen
    // rotationen ändå råkar ge det på.
    vi.resetModules();
    vi.doMock("@/lib/studio/kit", () => ({
      getKitDirectives: async () => ({ ...NEUTRAL_DIRECTIVES, personer: "aldrig", imageMotiv: "no people at all in the picture" }),
      imageDirectiveSuffix,
    }));
    const { byggBildPrompt } = await import("@/lib/bild/promptbyggare");
    for (let i = 0; i < 5; i++) {
      const byggd = await byggBildPrompt({ clientId: "x", niche: "digital signage", syfte: "karusell-slide", rubrik: "Kvinnan som stannar utanför skärmen", serie: { index: i, antal: 5 } });
      expect(byggd.personkategori, `position ${i}`).toMatch(/^no people/);
      expect(byggd.prompt).toMatch(/CUSTOMER'S OWN IMAGE RULES/);
    }
    vi.doUnmock("@/lib/studio/kit");
    vi.resetModules();
  });

  it("kunden når fälten i sin egen vy", () => {
    // /k/brand-kit renderar samma komponent, och bildreglerna ligger inte bakom !kundlage.
    const sida = readFileSync(path.join(process.cwd(), "app/dashboard/brand-kit/page.tsx"), "utf8");
    const i = sida.indexOf("Dina egna bildregler");
    expect(i).toBeGreaterThan(-1);
    const fore = sida.slice(0, i);
    const oppnade = (fore.match(/\{!kundlage && \(/g) || []).length;
    const stangda = (fore.match(/^\s*\)\}$/gm) || []).length;
    expect(oppnade, "bildreglerna får inte ligga inuti ett !kundlage-block").toBeLessThanOrEqual(stangda);
  });
});
