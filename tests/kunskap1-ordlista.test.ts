// KUNSKAP-1 — tenantens egna ord vinner över allmän kunskap, i alla flöden.
//
// Beställningen antog att blogg- och inläggsvägen hämtar kunskap olika. Sonderingen visade
// att de INTE gör det: alla fyra flöden fick identisk profiltext (10 879 tecken), identisk
// klippning, och ordet "regression" fanns med i allihop. Rotorsaken var att ordet aldrig
// DEFINIERAS — det står som produktrad och prisrad, aldrig som förklaring. Ett tomrum, och
// tomrum fyller en språkmodell med sin allmänna kunskap.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  amnesordBlock,
  amnesordIProfilen,
  ordlistaBlock,
  tolkaOrdlista,
  type Ordpost,
} from "@/lib/ordlista";

const las = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("KUNSKAP-1 · tolkning av fältet", () => {
  it("tar både = och : som avdelare", () => {
    expect(tolkaOrdlista("regression = terapi")).toEqual([{ ord: "regression", betydelse: "terapi" }]);
    expect(tolkaOrdlista("regression: terapi")).toEqual([{ ord: "regression", betydelse: "terapi" }]);
  });

  it("betydelsen får själv innehålla = och :", () => {
    const p = tolkaOrdlista("regression = terapi: en resa bakåt = inte statistik");
    expect(p[0].betydelse).toBe("terapi: en resa bakåt = inte statistik");
  });

  it("listmarkörer, tomma rader och rubriker städas bort", () => {
    const p = tolkaOrdlista("# Våra ord\n\n- regression = terapi\n* kropp: hela människan\n\n");
    expect(p).toEqual([
      { ord: "regression", betydelse: "terapi" },
      { ord: "kropp", betydelse: "hela människan" },
    ]);
  });

  it("rader utan betydelse hoppas över i stället för att bli halva poster", () => {
    expect(tolkaOrdlista("regression\nbara text utan avdelare")).toEqual([]);
    expect(tolkaOrdlista("regression =")).toEqual([]);
  });

  it("tomt fält ger tom lista, inte en krasch", () => {
    expect(tolkaOrdlista(null)).toEqual([]);
    expect(tolkaOrdlista(undefined)).toEqual([]);
    expect(tolkaOrdlista("   ")).toEqual([]);
  });
});

describe("KUNSKAP-1 · promptblocket säger att betydelsen vinner", () => {
  const poster: Ordpost[] = [{ ord: "regression", betydelse: "regressionsterapi, aldrig statistik" }];
  const block = ordlistaBlock(poster);

  it("tom lista ger tomt block — ingen rubrik utan innehåll", () => {
    expect(ordlistaBlock([])).toBe("");
  });

  it("blocket säger uttryckligen att kundens betydelse gäller före den allmänna", () => {
    expect(block).toContain("gäller ALLTID före allmän betydelse");
    expect(block).toMatch(/även om ordet betyder något helt annat/);
  });

  it("ordet och betydelsen står med, ordagrant", () => {
    expect(block).toContain('"regression" betyder här: regressionsterapi, aldrig statistik');
  });

  // Utan det här förbehållet blir ordlistan en bakväg förbi sanningskravet: "betyder X"
  // är inte samma sak som "X är sant", och en betydelse får aldrig legitimera en siffra.
  it("blocket säger att betydelse inte är sanning", () => {
    expect(block).toContain("säger ingenting om vad som är sant");
    expect(block).toMatch(/inget tillstånd att hitta på siffror/);
  });
});

describe("KUNSKAP-1 · skyddsnätet för ord som inte står i listan", () => {
  const profil = "## Erbjudande\n- Regression, resa till ett tidigare liv\n- Hypnoterapi vid stress";

  it("hittar ämnesord som faktiskt står i profilen", () => {
    expect(amnesordIProfilen("Ett inlägg om hypnoterapi", profil)).toEqual(["hypnoterapi"]);
  });

  it("ord som redan står i ordlistan flaggas inte igen — de har ju en betydelse", () => {
    const poster: Ordpost[] = [{ ord: "regression", betydelse: "terapi" }];
    expect(amnesordIProfilen("om regression", profil, poster)).toEqual([]);
  });

  it("vanliga ord flaggas aldrig, annars träffar varje ämne", () => {
    expect(amnesordIProfilen("kunden och företaget arbetar", profil)).toEqual([]);
  });

  it("korta ord flaggas inte — de träffar av en slump", () => {
    expect(amnesordIProfilen("liv", profil)).toEqual([]);
  });

  it("matchas mot den KLIPPTA profiltexten — ett bortklippt ord finns inte i prompten", () => {
    // Står ordet i en sektion som klipptes bort vore påminnelsen en hänvisning till
    // tomma luften: modellen ser ingen profilrad att hämta betydelsen ur.
    expect(amnesordIProfilen("om hypnoterapi", "## Företagsnamn\nFor Balance")).toEqual([]);
  });

  it("blocket är tomt när inget träffade", () => {
    expect(amnesordBlock([])).toBe("");
  });

  it("blocket pekar på profilens betydelse och förbjuder påhittade definitioner", () => {
    const b = amnesordBlock(["hypnoterapi"]);
    expect(b).toContain("hypnoterapi");
    // Radbrytning mitt i meningen — matcha över den, inte runt den.
    expect(b).toMatch(/aldrig\s+en allmän betydelse/);
    expect(b).toMatch(/hitta aldrig på en definition/);
  });
});

describe("KUNSKAP-1 · lagret sitter i kärnan, inte i ett flöde", () => {
  const core = las("lib/prompt-core.ts");

  it("prompt-core läser ordlistan — alltså får ALLA flöden den", () => {
    expect(core).toContain('await import("@/lib/ordlista")');
    expect(core).toContain("hamtaOrdlista(p.clientId)");
  });

  it("skyddsnätet matchas mot profilText, inte mot den råa profilen", () => {
    expect(core).toContain("amnesordIProfilen(amne, profilText, poster)");
  });

  it("lagret ligger FÖRE sanningskravet men efter profilen — sent = tyngst", () => {
    const iOrdlista = core.indexOf("lager.ordlista = true");
    const iProfil = core.indexOf("lager.brandProfil = true");
    const iSanning = core.indexOf("lager.sanningskrav = true");
    expect(iProfil).toBeGreaterThan(-1);
    expect(iOrdlista).toBeGreaterThan(iProfil);
    expect(iSanning).toBeGreaterThan(iOrdlista);
  });

  it("ordlistan ligger UTANFÖR profilklippningen", () => {
    // Hela poängen: en definition som kan klippas bort är ingen definition. Om ordlistan
    // hamnade i KLIPPORDNING vore löftet "vinner alltid" bara sant för korta profiler.
    const klipp = core.slice(core.indexOf("const KLIPPORDNING"), core.indexOf("export function klippProfil"));
    expect(klipp.toLowerCase()).not.toContain("ordlista");
  });

  it("en trasig ordlista fäller aldrig textflödet", () => {
    expect(core).toContain("[prompt-core] ordlistan kunde inte hämtas");
  });
});

describe("KUNSKAP-1 · fältet går att fylla i", () => {
  it("profilformuläret har fältet med ett exempel i hjälptexten", () => {
    const sida = las("app/dashboard/profil/page.tsx");
    expect(sida).toContain('update("ordlista", v)');
    expect(sida).toContain("Ord som betyder något särskilt hos er");
    // Hjälptexten ska visa formatet — annars gissar användaren.
    expect(sida).toMatch(/regression = regressionsterapi/);
  });

  it("migrationen finns och skriver aldrig över en ifylld ordlista", () => {
    const sql = las("migrations/kunskap1_ordlista.sql");
    expect(sql).toContain("add column if not exists ordlista");
    expect(sql).toMatch(/ordlista is null or btrim\(ordlista\) = ''/);
  });
});
