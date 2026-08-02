// BILD-8 DoD — regressionstester för de två felen som den skarpa bevisningen avslöjade.
// Rå-strängarna nedan är EXAKT vad gemini-2.5-flash svarade under körningen
// (docs/studio/bild8-exempel/) — inga påhittade indata.

import { describe, expect, it } from "vitest";
import {
  parsaTeckenTranskription,
  ordStatus,
  strukturfel,
  misstanktaOrd,
  okandaOrd,
  stavningsgrind,
  normaliseraTecken,
  type StavUtfall,
} from "@/lib/bildtext";

const ok = (u: Partial<StavUtfall> = {}): StavUtfall => ({ ok: true, text: "", ord: [], fel: [], orsak: "godkand", ...u });
const nej = (fel: string[]): StavUtfall => ({ ok: false, text: fel.join(" "), ord: fel, fel, orsak: "felstavning" });

describe("BILD-8 · transkriptionen: | är ibland teckenavgränsare, ibland ordavgränsare", () => {
  it("| mellan varje TECKEN ger hela ord — inte en bokstav per ord (skarpt fall a1)", () => {
    // Fällde tidigare 13 'ord' (enstaka bokstäver ligger ett steg från riktiga ord).
    expect(parsaTeckenTranskription("N | Y | H | E | T | ! / E | N | D | A | S | T | | 8 | 9 | 9 | 0 | | K | R | ."))
      .toEqual(["NYHET!", "ENDAST", "8990", "KR."]);
  });

  it("| mellan ORDEN tolkas fortfarande som ordgräns (skarpt fall a1, andra avläsningen)", () => {
    expect(parsaTeckenTranskription("V E C K A N S | E R B J U O N D E : / K Ö P | 2 | F Å | 1"))
      .toEqual(["VECKANS", "ERBJUONDE:", "KÖP", "2", "FÅ", "1"]);
  });

  it("rader utan | limmas ihop per rad (skarpt fall a6)", () => {
    expect(parsaTeckenTranskription("H E L G E N S / B U K E T T / K R Ä F T S K I V A / 8 | A U G U S T I"))
      .toEqual(["HELGENS", "BUKETT", "KRÄFTSKIVA", "8", "AUGUSTI"]);
  });

  it("INGEN och tomt svar ger inga ord", () => {
    expect(parsaTeckenTranskription("INGEN")).toEqual([]);
    expect(parsaTeckenTranskription("   ")).toEqual([]);
  });

  it("teckenseparerat INGEN är fortfarande ett ord för parsern — sentinelen ägs av avläsaren", () => {
    // Dokumenterar gränsen: parsern limmar ihop "I N G E N" till ordet INGEN, och
    // lasOrdTeckenvis är den som tolkar det som sentinel (skarpt fall a8, tom skylt).
    expect(parsaTeckenTranskription("I N G E N")).toEqual(["INGEN"]);
  });

  it("baklängesläsningen vänds tillbaka till läsbara ord (skarpt fall a8)", () => {
    // Modellens svar 4/4 på affischen som SÄGER "HÖSTENS NYHIETER" — framlängesläsningen
    // autokorrigerade den till "NYHETER" varje gång.
    const bak = parsaTeckenTranskription("S N E T S Ö H | R E T E I H Y N / T S E F E D R Ö K S | T R A N S");
    expect(bak.map((o) => Array.from(o).reverse().join(""))).toEqual(["HÖSTENS", "NYHIETER", "SKÖRDEFEST", "SNART"]);
  });
});

describe("BILD-8 · domen: struktur fälls direkt, närmiss är bara en misstanke", () => {
  it("FÅ är rättstavat och fälls INTE av ordlistan trots avståndet till 'får' (skarpt fall a1)", () => {
    expect(ordStatus("FÅ")).toBe("narmiss");
    expect(strukturfel(["FÅ"])).toEqual([]); // ← ingen dom utan bekräftelse
    expect(misstanktaOrd(["FÅ"])).toEqual(["FÅ"]);
  });

  it("glyfer utanför svenskan fälls direkt, utan att någon tillfrågas", () => {
    expect(ordStatus("Öıpet")).toBe("otillaten");
    expect(strukturfel(["Öıpet"])).toEqual(["Öıpet"]);
  });

  it("bokstavsgröt fälls direkt", () => {
    expect(ordStatus("VÄLLLKOMMEN")).toBe("dubblering");
    expect(strukturfel(["VÄLLLKOMMEN"])).toEqual(["VÄLLLKOMMEN"]);
  });

  it("de dokumenterade felstavningarna hamnar hos den som ska bedöma dem", () => {
    // Varken frikända av ordlistan eller strukturellt omöjliga → misstänkta/okända.
    const misstankt = [...misstanktaOrd(["IDÅG", "ERBJUONDE", "NYHIETES"]), ...okandaOrd(["IDÅG", "ERBJUONDE", "NYHIETES"])];
    expect(misstankt).toContain("IDÅG");
    expect(misstankt).toContain("ERBJUONDE");
    expect(misstankt).toContain("NYHIETES");
    expect(strukturfel(["IDÅG", "ERBJUONDE", "NYHIETES"])).toEqual([]);
  });

  it("vanliga skyltord och siffror går fria", () => {
    for (const o of ["DAGENS", "LUNCH", "129", "KR", "VÄLKOMMEN", "ÖPPETTIDER", "HELGENS"]) {
      expect(strukturfel([o])).toEqual([]);
      expect(misstanktaOrd([o])).toEqual([]);
    }
  });
});

describe("BILD-8 · grinden: omtag, tom skylt som sista utväg, fail-open", () => {
  it("godkänd första avläsningen → ingen generering alls", async () => {
    let gen = 0;
    const r = await stavningsgrind({
      bild: "b0",
      kontrollera: async () => ok(),
      generera: async () => { gen++; return { image: "x" }; },
    });
    expect(gen).toBe(0);
    expect(r.omtag).toBe(0);
    expect(r.image).toBe("b0");
  });

  it("felstavning → omtag med skärpt instruktion, godkänt omtag används", async () => {
    const skarpningar: string[] = [];
    const r = await stavningsgrind({
      bild: "b0",
      kontrollera: async (b) => (b === "b0" ? nej(["ERBJUONDE"]) : ok()),
      generera: async ({ skarpning }) => { skarpningar.push(skarpning); return { image: "b1" }; },
    });
    expect(r.omtag).toBe(1);
    expect(r.image).toBe("b1");
    expect(r.blank).toBe(false);
    expect(skarpningar[0]).toContain("SPELLING");
  });

  it("envis felstavning → sista försöket ber om TOM skylt", async () => {
    const blanka: boolean[] = [];
    const r = await stavningsgrind({
      bild: "b0",
      kontrollera: async (b) => (b === "blank" ? ok({ orsak: "ingen-text" }) : nej(["ERBJUONDE"])),
      generera: async ({ blank }) => { blanka.push(blank); return { image: blank ? "blank" : "b" }; },
    });
    expect(blanka).toEqual([false, false, true]);
    expect(r.blank).toBe(true);
    expect(r.utfall.orsak).toBe("ingen-text");
  });

  it("tom skylt är FÖRBJUDEN när ett annat lager äger texten (B3)", async () => {
    const blanka: boolean[] = [];
    await stavningsgrind({
      bild: "b0",
      ignorera: "VECKANS BUKETT",
      kontrollera: async () => nej(["ERBJUONDE"]),
      generera: async ({ blank }) => { blanka.push(blank); return { image: "b" }; },
    });
    expect(blanka.every((b) => b === false)).toBe(true);
  });

  it("genereringen nere → bilden vi har behålls, flödet blockeras aldrig", async () => {
    const r = await stavningsgrind({
      bild: "b0",
      kontrollera: async () => nej(["ERBJUONDE"]),
      generera: async () => ({ error: "kvot slut" }),
    });
    expect(r.image).toBe("b0");
  });

  it("tidsbudgeten stoppar omtagen", async () => {
    let t = 0;
    let gen = 0;
    const r = await stavningsgrind({
      bild: "b0",
      tidsbudgetMs: 1000,
      nu: () => (t += 2000), // varje avläsning äter mer än hela budgeten
      kontrollera: async () => nej(["ERBJUONDE"]),
      generera: async () => { gen++; return { image: "b" }; },
    });
    expect(gen).toBe(0);
    expect(r.image).toBe("b0");
  });

  it("teckenjämförelsen struntar i mellanrum men aldrig i å/ä/ö", () => {
    expect(normaliseraTecken("V Ä L K O M M E N")).toBe(normaliseraTecken("VÄLKOMMEN"));
    expect(normaliseraTecken("IDAG")).not.toBe(normaliseraTecken("IDÅG"));
  });
});
