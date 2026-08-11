// BILD-10 — bildmodellen skriver ingen text. Håkans beslut 2026-08-10.
//
// Skarpt fall: AluCon fick en bild där skylten sa "HÄLLBARA PROFILER FÖR FRAMITDEN".
// Två felstavningar i tre ord, i en bild som var på väg ut till kund.
//
// Rotorsaken satt inte i stavningsgrinden utan i BESTÄLLNINGEN: `DEPICTED_MESSAGE` krävde
// att varje synlig skylt SKULLE bära en kort svensk rad. Bildmodellen kan inte stava
// svenska, och grinden fångar inte allt (2 av 20 gick igenom i BILD-8:s egen DoD). Vi
// beställde alltså felstavningarna själva och hoppades att en grind skulle rädda oss.
//
// Nya ordningen, och den är strukturell:
//   1. Fria bildmotiv har INGEN läsbar text — inga ord, siffror, prislappar eller logotyper.
//   2. Text i en bild kommer bara från fältet "Text i bilden" (B3), där vi ritar den själva.
//   3. Hittar stavningsgrinden ändå text som är fel går bilden INTE ut. Förut släpptes den
//      igenom när omtagen eller tidsbudgeten tog slut — tyst.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  DEPICTED_CONTENT_EN,
  DEPICTED_CONTENT_SV,
  DEPICTED_CONTENT_MED_BUDSKAP_EN,
  DEPICTED_CONTENT_MED_BUDSKAP_SV,
  DEPICTED_NO_TEXT_EN,
  DEPICTED_NO_TEXT_SV,
  DEPICTED_MESSAGE_EN,
} from "@/lib/images";

const las = (fil: string) => readFileSync(new URL(`../${fil}`, import.meta.url), "utf8");

describe("BILD-10 · textförbudet är hårt och gäller allt som bär bokstäver", () => {
  it("förbudet räknar upp ytorna, inte bara 'skyltar'", () => {
    // Modellen skriver på arbetskläder, väggar och fordon när skylten är förbjuden.
    for (const yta of ["signs", "screens", "boards", "posters", "packaging", "workwear", "vehicles"]) {
      expect(DEPICTED_NO_TEXT_EN, yta).toContain(yta);
    }
    for (const yta of ["skyltar", "skärmar", "affischer", "förpackningar", "arbetskläder", "fordon"]) {
      expect(DEPICTED_NO_TEXT_SV, yta).toContain(yta);
    }
  });

  it("siffror och logotyper är text de också", () => {
    expect(DEPICTED_NO_TEXT_EN).toContain("numbers");
    expect(DEPICTED_NO_TEXT_EN).toContain("logos");
    expect(DEPICTED_NO_TEXT_SV).toContain("siffror");
    expect(DEPICTED_NO_TEXT_SV).toContain("logotyper");
  });

  it("en TOM skylt är inte lösningen — den läses som trasig", () => {
    // BILD-8:s kvarleva 2: kravet "rätt stavat eller blankt" gav vita skärmar i 6 av 20.
    expect(DEPICTED_NO_TEXT_EN).toContain("blank");
    expect(DEPICTED_NO_TEXT_SV).toContain("tom skylt");
    expect(DEPICTED_NO_TEXT_SV).toContain("trasig");
  });

  it("regeln är branschneutral", () => {
    const alla = `${DEPICTED_NO_TEXT_EN} ${DEPICTED_NO_TEXT_SV}`.toLowerCase();
    for (const namn of ["displayteknik", "alucon", "annas", "hm motor", "engens", "opticur"]) {
      expect(alla, namn).not.toContain(namn);
    }
  });
});

describe("BILD-10 · budskapsregeln är URKOPPLAD, inte raderad", () => {
  it("den fulla regeln som flödena använder ber aldrig om en rad på skylten", () => {
    expect(DEPICTED_CONTENT_EN).toContain(DEPICTED_NO_TEXT_EN);
    expect(DEPICTED_CONTENT_SV).toContain(DEPICTED_NO_TEXT_SV);
    expect(DEPICTED_CONTENT_EN).not.toContain("MUST CARRY A MESSAGE");
    expect(DEPICTED_CONTENT_SV).not.toContain("SKA BÄRA ETT BUDSKAP");
    expect(DEPICTED_CONTENT_EN).not.toContain("DAGENS LUNCH 129 KR");
  });

  it("den gamla regeln finns kvar som dokumentation — för den dag en modell kan stava", () => {
    expect(DEPICTED_CONTENT_MED_BUDSKAP_EN).toContain(DEPICTED_MESSAGE_EN);
    expect(DEPICTED_CONTENT_MED_BUDSKAP_SV).toContain("SKA BÄRA ETT BUDSKAP");
  });

  it("men INGET flöde använder den gamla regeln", () => {
    // Grinden läser källkoden: kopplas budskapsregeln in igen någonstans faller testet.
    for (const fil of [
      "app/api/studio/suggest-image/route.ts",
      "app/api/studio/reels/media/route.ts",
      "lib/images.ts",
      "lib/studio/text-in-image.tsx",
    ]) {
      let kod: string;
      try { kod = las(fil); } catch { continue; }
      const anvander = kod
        .split("\n")
        .filter((r) => !r.trim().startsWith("//") && !r.trim().startsWith("*"))
        .filter((r) => /DEPICTED_(MESSAGE|CONTENT_MED_BUDSKAP)_(EN|SV)/.test(r))
        // Deklarationerna i lib/images.ts är själva definitionen, inte ett bruk.
        .filter((r) => !/^export const DEPICTED_/.test(r.trim()));
      expect(anvander, `${fil} kopplar in budskapsregeln igen: ${anvander.join(" | ")}`).toEqual([]);
    }
  });

  it("scenbeskrivningen ber om textfrihet när ingen textyta begärts", () => {
    const kod = las("lib/images.ts");
    expect(kod).toContain("opts?.textYta ? \"\" : DEPICTED_NO_TEXT_SV");
  });
});

describe("BILD-10 · en funnen felstavning stoppar bilden", () => {
  // Förut: stavningsgrinden hittade felet, gjorde sina omtag, och släppte sedan igenom
  // bilden ändå när tidsbudgeten var slut (`return { image: bild, ... }`). Kunden såg
  // felet i stället för koden. Nu svarar routen 502 med ett besked som pekar på de två
  // vägar som faktiskt är säkra.
  const route = las("app/api/studio/suggest-image/route.ts");

  it("friprompt-vägen släpper inte igenom en bild med funnet stavfel", () => {
    expect(route).toMatch(/if \(!grind\.utfall\.ok\)/);
    expect(route).toContain("Text i bilden");
  });

  it("båda bildvägarna är stängda, inte bara den ena", () => {
    // En av dem är friprompten, den andra "Text i bilden" (bakgrundstext i B3-bilden).
    expect(route.match(/if \(!grind\.utfall\.ok\)/g)?.length).toBe(2);
  });

  it("felet loggas med orden som fälldes — annars går det inte att felsöka", () => {
    expect(route).toContain("grind.utfall.fel");
  });
});

describe("BILD-12 · bilden PÅ en avbildad skärm hör till köparens värld", () => {
  // Håkans fynd 11/8: han testade bildskapande för ett skyltbolag och fick berg, isberg och
  // frukt på skärmarna. "vem visar ett isberg på en skärm … bara tok som visas på skärmarna".
  //
  // ⚠ Det var MITT eget textförbud (BILD-10) som öppnade dörren: raden slutade "om en skärm
  // måste synas visar den ett foto eller produkten, aldrig text" — och "ett foto" läste
  // modellen som fritt val. Värst just i den här branschen: för ett skyltbolag ÄR innehållet
  // på skärmen produkten, så en fjällbild säger att vi inte förstått affären.
  it("dekormotiven är utpekade med namn, inte antydda", () => {
    for (const ord of ["mountains", "icebergs", "forests", "sunsets", "space", "abstract art", "wildlife"]) {
      expect(DEPICTED_NO_TEXT_EN, ord).toContain(ord);
    }
    for (const ord of ["berg", "isberg", "skogar", "solnedgångar", "rymd", "abstrakt konst", "vilda djur"]) {
      expect(DEPICTED_NO_TEXT_SV, ord).toContain(ord);
    }
  });

  it("undantaget finns: säljer verksamheten fjällbilder får den visa fjäll", () => {
    expect(DEPICTED_NO_TEXT_EN).toContain("unless the business itself sells exactly that");
    expect(DEPICTED_NO_TEXT_SV).toContain("om inte verksamheten säljer just det");
  });

  it("och det finns en väg ut som inte är en tom skylt-lögn", () => {
    // En SLÄCKT skärm är ärlig. Det är skillnaden mot BILD-8:s kvarleva, där en TOM
    // upplyst skylt lästes som trasig.
    expect(DEPICTED_NO_TEXT_EN).toContain("switched off");
    expect(DEPICTED_NO_TEXT_SV).toContain("visa den släckt");
  });

  it("regeln säger vad som SKA visas, inte bara vad som är förbjudet", () => {
    expect(DEPICTED_NO_TEXT_EN).toContain("BUYER'S OWN WORLD");
    expect(DEPICTED_NO_TEXT_SV).toContain("KÖPARENS EGEN VÄRLD");
  });
});
