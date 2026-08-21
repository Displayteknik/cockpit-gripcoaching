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

describe("KUNSKAP-1 · systemet läser ut betydelsen själv", () => {
  // Håkans invändning: det ska inte behöva STÅ "regression" någonstans i systemet — det
  // ska fatta vad Gitte menar. En ordlista han måste fylla i är ingen förståelse.
  const profil = [
    "## Erbjudande: tjänster och produkter",
    "- Regression, resa till ett tidigare liv: två tillfällen",
    "- Hypnoterapi vid stress och sömnproblem",
    "## Erbjudande: priser (SANNINGSUNDERLAG — skrivs aldrig ut)",
    "- Regression, resa till ett tidigare liv: 3 600 kr + 1 300 kr",
  ].join("\n");

  it("plockar ut kundens EGNA rader som betydelse, inte bara ordet", () => {
    const t = amnesordIProfilen("Ett inlägg om regression", profil);
    expect(t).toHaveLength(1);
    expect(t[0].ord).toBe("regression");
    expect(t[0].rader[0]).toContain("resa till ett tidigare liv");
  });

  // Det viktigaste testet i filen. Ordet står i BÅDE tjänste- och prissektionen hos
  // For Balance. Utan filtreringen hade prisraden följt med in i prompten som
  // "förklaring" — en bakväg förbi prisregeln, exakt det G-4 stängde.
  it("prisraden följer ALDRIG med som betydelse", () => {
    const t = amnesordIProfilen("regression", profil);
    const allt = t[0].rader.join(" ");
    expect(allt).not.toContain("3 600");
    expect(allt).not.toContain("kr");
  });

  it("hittar flera ord i samma ämne", () => {
    const t = amnesordIProfilen("regression och hypnoterapi", profil);
    expect(t.map((x) => x.ord).sort()).toEqual(["hypnoterapi", "regression"]);
  });

  it("ord som redan står i ordlistan tas inte upp igen — de har ju en betydelse", () => {
    const poster: Ordpost[] = [{ ord: "regression", betydelse: "terapi" }];
    expect(amnesordIProfilen("om regression", profil, poster)).toEqual([]);
  });

  it("vanliga ord tas aldrig upp, annars träffar varje ämne", () => {
    expect(amnesordIProfilen("kunden och företaget arbetar", profil)).toEqual([]);
  });

  it("korta ord tas inte upp — de träffar av en slump", () => {
    expect(amnesordIProfilen("liv", profil)).toEqual([]);
  });

  it("ett ord utan rad i profilen ger ingen träff", () => {
    expect(amnesordIProfilen("om hypnoterapi", "## Företagsnamn\nFor Balance")).toEqual([]);
  });

  it("blocket är tomt när inget träffade", () => {
    expect(amnesordBlock([])).toBe("");
  });

  it("blocket lär ut betydelsen med kundens egna ord", () => {
    const b = amnesordBlock([{ ord: "regression", rader: ["Regression, resa till ett tidigare liv"] }]);
    expect(b).toContain("SÅ ANVÄNDER DEN HÄR KUNDEN ORDEN");
    expect(b).toContain("Regression, resa till ett tidigare liv");
    expect(b).toMatch(/även om\s+ordet betyder något helt annat/);
  });

  it("blocket skiljer betydelse från fakta — annars byts ett fel mot ett annat", () => {
    const b = amnesordBlock([{ ord: "regression", rader: ["Regression, resa till ett tidigare liv"] }]);
    expect(b).toMatch(/betydelse, inte fakta att återge/);
    expect(b).toMatch(/Sanningskravet och prisregeln gäller oförändrat/);
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

  it("migrationen skapar fältet men seedar INGEN kund", () => {
    const sql = las("migrations/kunskap1_ordlista.sql");
    expect(sql).toContain("add column if not exists ordlista");
    // Håkans rättelse: ingen ska behöva ha ordet inskrivet för att systemet ska fatta.
    // En seedad rad hade dolt att den självlärda vägen är huvudmekanismen.
    expect(sql).toContain("INGEN SEEDNING");
    expect(sql).not.toMatch(/^\s*update hm_brand_profile/im);
  });
});

describe("KUNSKAP-1 · DEL 6 omvänt test (HELG-1, 2026-08-21): en tenants betydelse läcker aldrig till en annan", () => {
  // Gittes (For Balance) riktiga profilrad, ordagrant ur den skarpa DoD-körningen.
  const gittesProfil = "## Erbjudande: tjänster\n- Regression, resa till ett tidigare liv: två tillfällen…\n";
  // En annan tenants profil (skyltbolag) som råkar nämna ordet i en helt annan mening —
  // t.ex. en ekonomisk regression i en marknadsanalys. Ingen påhittad data: bara ett
  // konstruerat motexempel för att bevisa att den ENA tenantens rader aldrig läcker in.
  const annanTenantsProfil = "## Marknad\n- Vi ser en regression i efterfrågan på fysiska skyltar sedan 2020.\n";

  it("PROVAD GENOM ATT BRYTAS: samma ämnesord (\"regression\") ger OLIKA träffar beroende på VILKEN profiltext som skickas in", () => {
    const gittesTraffar = amnesordIProfilen("regression", gittesProfil);
    const andraTraffar = amnesordIProfilen("regression", annanTenantsProfil);
    expect(gittesTraffar[0]?.rader.join(" ")).toContain("tidigare liv");
    expect(andraTraffar[0]?.rader.join(" ")).toContain("efterfrågan");
    // Beviset: ingen av de två träfflistorna innehåller den ANDRA tenantens rad.
    expect(gittesTraffar[0]?.rader.join(" ")).not.toContain("efterfrågan");
    expect(andraTraffar[0]?.rader.join(" ")).not.toContain("tidigare liv");
  });

  it("en tenant utan ordet i sin profil får inga träffar alls — aldrig en gissning ur en annan tenants data", () => {
    const dtLiknandeProfil = "## Om oss\n- Vi levererar LED-skärmar och digital skyltning sedan 2015.\n";
    expect(amnesordIProfilen("regression", dtLiknandeProfil)).toEqual([]);
  });

  it("hamtaOrdlista() är explicit client_id-scopad i sin egen fråga (ingen global tabell, inget delat cache)", () => {
    const kod = las("lib/ordlista.ts");
    expect(kod).toContain('.eq("client_id", clientId)');
  });
});
