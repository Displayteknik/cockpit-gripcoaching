// PLAN-2 — planeringen är ÄGARENS egen kalender, och sidan ska säga det.
//
// Håkans fynd 10/8: han bytte klient (Life i Balans → For Balance) och såg samma ifyllda
// vecka i båda, utan att ha fyllt i något. Slutsatsen han drog var rimlig: veckoplanen
// ligger ifylld hos flera kunder.
//
// Vad koden faktiskt gör:
//   · `/api/hq/planering` kräver huvudadmin — `getAdminScope() !== null` ger 403.
//   · Tabellerna (`hq_tidstyper`, `hq_handelse_typ`, `hq_mallvecka`) och kalenderspegeln har
//     INGEN klientkolumn. Det finns alltså en enda uppsättning, inte en per kund.
//   · Blocken kommer ur ägarens egen Google-kalender, inte ur någon generering.
//
// Alltså: ingen kunddata korsas, och ingenting är ifyllt i en kunds namn. Felet var att
// sidan inte SA det — den ligger under klientväljaren, och då läses veckan som den valda
// kundens. Beskedet fanns bara i det okopplade läget, exakt där det inte behövdes.
//
// Testet låser båda halvorna: att grinden finns kvar, och att sidan säger vems kalender det är.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const las = (fil: string) => readFileSync(new URL(`../${fil}`, import.meta.url), "utf8");
const route = las("app/api/hq/planering/route.ts");
const sida = las("app/dashboard/hq/planering/page.tsx");

describe("PLAN-2 · modulen är grindad på ägaren", () => {
  it("routen kräver huvudadmin, inte bara admin", () => {
    expect(route).toContain("requireAdmin()");
    // En klient-scopad adminsession (kundens egen inloggning) nekas.
    expect(route).toMatch(/getAdminScope\(\)\) !== null/);
    expect(route).toContain("Endast huvudadmin har åtkomst");
  });

  it("ingen läsning filtrerar på klient — det finns bara EN uppsättning", () => {
    // Skulle någon lägga till en klientkolumn här måste den också skrivas, filtreras och
    // migreras. Att den inte finns är designen; testet fångar dagen någon halvvägs inför den.
    expect(route).not.toMatch(/client_id|resolveClientId/);
    expect(las("lib/hq/planering.ts")).not.toMatch(/client_id|clientId/);
  });
});

describe("PLAN-2 · sidan säger vems kalender det är", () => {
  it("rubriken säger det direkt, inte längst ner", () => {
    expect(sida).toContain("Din egen kalender, inte kundens");
  });

  it("och den säger att innehållet inte följer klientväljaren", () => {
    expect(sida).toContain("Det här är din egen kalender.");
    expect(sida).toContain("byter inte när du växlar kund");
  });

  it("beskedet visas i det KOPPLADE läget — där veckan syns", () => {
    // Före fixen stod det bara i "Koppla din kalender"-rutan, alltså bara innan det fanns
    // någon vecka att missförstå.
    const kopplat = sida.indexOf("Det här är din egen kalender.");
    const veckan = sida.indexOf("data?.kopplad && kt && (");
    expect(kopplat).toBeGreaterThan(0);
    expect(kopplat).toBeLessThan(veckan);
  });

  it("språket är klarspråk — inga systemord i det kunden eller ägaren läser", () => {
    for (const ord of ["tenant", "scope", "client_id", "hq_"]) {
      const rad = sida.split("\n").filter((r) => r.includes("Det här är din egen kalender.") && r.includes(ord));
      expect(rad, ord).toEqual([]);
    }
  });
});
