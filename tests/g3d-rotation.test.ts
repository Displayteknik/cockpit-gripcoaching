// G-3d — rotationen över tid.
//
// Det som ska bevisas är inte att en Supabase-fråga går att skriva. Det är tre saker som
// alla har gått fel förut i det här repot:
//   1. att öppningen PLOCKAS rätt ur varje flödes egen tabell (fel fält = tyst tom lista,
//      och en tom lista ser exakt ut som "rotationen är inkopplad")
//   2. att en trasig läsning aldrig kan stoppa en generering (fail-open)
//   3. att undvik-listan faktiskt når fram till prompten som ett synligt lager
//
// Supabase mockas: testet ska mäta plockningen och fail-open, inte nätverket.

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mockad supabase-service ───────────────────────────────────────────────────
// Kedjan .from().select().eq().order().limit() är en THENABLE BYGGARE hela vägen —
// supabase-js kör inte frågan förrän någon awaitar. Det spelar roll här: källornas egna
// filter läggs på EFTER .limit(), och en mock som returnerade en Promise därifrån hade
// gett tre falska röda tester om kod som fungerar.
let svar: { data: unknown; error: unknown } = { data: [], error: null };
let kastar = false;
const sedda: { tabell: string; valj: string; sortera: string; eq: Record<string, string>; limit: number } = {
  tabell: "", valj: "", sortera: "", eq: {}, limit: 0,
};

vi.mock("@/lib/supabase-admin", () => ({
  supabaseService: () => {
    if (kastar) throw new Error("SUPABASE_SERVICE_ROLE_KEY saknas");
    const kedja = {
      select(v: string) { sedda.valj = v; return kedja; },
      eq(k: string, v: string) { sedda.eq[k] = v; return kedja; },
      order(k: string) { sedda.sortera = k; return kedja; },
      limit(n: number) { sedda.limit = n; return kedja; },
      then(res: (v: unknown) => unknown) { return Promise.resolve(svar).then(res); },
    };
    return { from(t: string) { sedda.tabell = t; return kedja; } };
  },
}));

const { hamtaNyligen } = await import("@/lib/rotation");

beforeEach(() => {
  svar = { data: [], error: null };
  kastar = false;
  sedda.tabell = ""; sedda.valj = ""; sedda.sortera = ""; sedda.eq = {}; sedda.limit = 0;
});

describe("G-3d · varje flöde läser SIN EGEN tabell", () => {
  it("social läser hook ur hm_social_posts", async () => {
    svar = { data: [{ hook: "Tre saker ingen berättar om skyltar" }], error: null };
    expect(await hamtaNyligen("k1", "social")).toEqual(["Tre saker ingen berättar om skyltar"]);
    expect(sedda.tabell).toBe("hm_social_posts");
    expect(sedda.eq.client_id).toBe("k1");
  });

  it("caption plockar FÖRSTA raden — inte hela captionen", async () => {
    // Hela captionen som undvik-post hade fyllt prompten med brödtext och hashtags.
    // Det är öppningen som ska roteras.
    svar = { data: [{ caption: "\n\nDet här visste du inte.\n\nMassa brödtext.\n#skylt" }], error: null };
    expect(await hamtaNyligen("k1", "caption")).toEqual(["Det här visste du inte."]);
  });

  it("studio-text plockar headline1 ur payload, inte title", async () => {
    // `title` sätts av användaren vid sparning och är ofta "Namnlöst inlägg".
    svar = { data: [{ payload: { headline1: "Syns du i mörkret?", title: "Namnlöst inlägg" } }], error: null };
    expect(await hamtaNyligen("k1", "studio-text")).toEqual(["Syns du i mörkret?"]);
  });

  it("karusell plockar KROK-slidens rubrik och filtrerar på mallen", async () => {
    svar = {
      data: [{ payload: { slides: [
        { kind: "hook", headline: "Fem misstag med skyltfönster" },
        { kind: "point", headline: "Punkt ett" },
      ] } }],
      error: null,
    };
    expect(await hamtaNyligen("k1", "karusell")).toEqual(["Fem misstag med skyltfönster"]);
    // Utan filtret hade statiska affischer i samma tabell blandats in.
    expect(sedda.eq.template_id).toBe("ark-karusell");
  });

  it("reel plockar scen 1:s line1", async () => {
    svar = { data: [{ storyboard: { scenes: [{ line1: "Titta här" }, { line1: "Sen då" }] } }], error: null };
    expect(await hamtaNyligen("k1", "reel")).toEqual(["Titta här"]);
  });

  it("veckoplan läser bara veckogenererade rader", async () => {
    svar = { data: [{ title: "Måndagens hook" }], error: null };
    await hamtaNyligen("k1", "veckoplan");
    expect(sedda.eq.compass_source).toBe("schedule");
  });

  it("blogg sorterar på published_at — hm_blog har ingen created_at", async () => {
    svar = { data: [{ title: "Så väljer du rätt skylt" }], error: null };
    await hamtaNyligen("k1", "blogg");
    expect(sedda.tabell).toBe("hm_blog");
    expect(sedda.sortera).toBe("published_at");
  });

  it("idébanken kan filtreras på typ så LinkedIn inte undviker mejlens öppningar", async () => {
    svar = { data: [{ body: "En sak jag lärde mig i veckan.\nResten av texten." }], error: null };
    expect(await hamtaNyligen("k1", "idebank", { filter: { type: "linkedin_post" } }))
      .toEqual(["En sak jag lärde mig i veckan."]);
    expect(sedda.eq.type).toBe("linkedin_post");
  });
});

describe("G-3d · listan är städad innan den når prompten", () => {
  it("dubbletter räknas en gång", async () => {
    // Samma öppning två gånger gör inte regeln starkare, bara längre.
    svar = { data: [{ hook: "Samma hook" }, { hook: "samma hook" }, { hook: "Annan" }], error: null };
    expect(await hamtaNyligen("k1", "social")).toEqual(["Samma hook", "Annan"]);
  });

  it("tomma fält hoppas över utan att äta upp kvoten", async () => {
    svar = { data: [{ hook: "" }, { hook: null }, { hook: "Enda riktiga" }], error: null };
    expect(await hamtaNyligen("k1", "social")).toEqual(["Enda riktiga"]);
  });

  it("uteslut tar bort flödets egen utgångspunkt", async () => {
    // linkedin/draft bygger PÅ en vald hook. Den ska inte stå på undvik-listan.
    svar = { data: [{ hook: "Vald seed" }, { hook: "Gammal" }], error: null };
    expect(await hamtaNyligen("k1", "linkedin", { uteslut: ["Vald seed"] })).toEqual(["Gammal"]);
  });

  it("antal respekteras och hämtar med marginal ur databasen", async () => {
    svar = { data: Array.from({ length: 40 }, (_, i) => ({ hook: `Hook ${i}` })), error: null };
    const ut = await hamtaNyligen("k1", "social", { antal: 3 });
    expect(ut).toHaveLength(3);
    // Marginalen finns för att rader kan sakna fältet; utan den blir listan tom
    // för en tenant vars senaste rader är tomma utkast.
    expect(sedda.limit).toBeGreaterThan(3);
  });
});

describe("G-3d · fail-open — rotationen får aldrig fälla en generering", () => {
  it("kastad klient ger tom lista, inte ett fel", async () => {
    kastar = true;
    await expect(hamtaNyligen("k1", "social")).resolves.toEqual([]);
  });

  it("databasfel ger tom lista", async () => {
    svar = { data: null, error: { message: "relation saknas" } };
    await expect(hamtaNyligen("k1", "social")).resolves.toEqual([]);
  });

  it("utan clientId görs ingen läsning alls", async () => {
    expect(await hamtaNyligen(null, "social")).toEqual([]);
    expect(sedda.tabell).toBe("");
  });
});
