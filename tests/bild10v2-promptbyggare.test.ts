// BILD-10 v2 — bilden ska bevisa poängen, alla tenants, alla format.
//
// Skarptestet av DT-karusellen (5 slides) visade tre systematiska fel:
//   1. skärmar i bild visade nonsens (en tallrik mat i stället för en annons)
//   2. bilden illustrerade inte slidens poäng ("hårdvara som inte håller" fick en intakt skärm)
//   3. motivmonotoni (samma man vid samma skärm i samtliga fem bilder)
//
// K0 mätte varför: bildprompter byggdes på nio ställen, de delade reglerna nådde två av
// dem, och rotationen (BILD-9) satt i legacy-vägen som Studio inte använder.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  harledBevismening, branschRekvisita, personKategorier, personKategoriFor,
  fogaSamman, LJUSVAKT_EN,
} from "@/lib/bild/promptbyggare";

const las = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("K2 · bevismeningen härleds ur poängen", () => {
  it("hårdvara som inte håller ger ett SYNLIGT fel, inte en intakt skärm", () => {
    // Exakt fallet ur Håkans skarptest.
    const b = harledBevismening("Hårdvara som inte håller", "Billiga paneler slutar fungera efter ett år.");
    expect(b).toMatch(/failure|fault|damage/i);
  });

  it("fel ljusstyrka ger en urblekt skärm i solljus", () => {
    const b = harledBevismening("Fel ljusstyrka för miljön", "Skärmen syns inte i solljus.");
    expect(b).toMatch(/washed out|daylight/i);
  });

  it("utan träff blir beviset verklig användning, aldrig en symbol", () => {
    const b = harledBevismening("Vi finns i Krokom", "");
    expect(b).toMatch(/real, specific use/i);
  });

  it("meningen bär ämnet, så bilden vet vad den handlar om", () => {
    expect(harledBevismening("Fel ljusstyrka för miljön", "")).toContain("Fel ljusstyrka");
  });
});

describe("K1 · rekvisita och miljöregler per bransch", () => {
  it("skyltbolag: skärmen kör en RIKTIG KAMPANJ, inte en tavla", () => {
    // ⚠ LÅSET ÄNDRAT TVÅ GÅNGER 15/8, och andra gången tog tillbaka det första tog bort.
    //   Först: "CAMPAIGN LAYOUT" med "headline band" och "price block" gav läsbara ord
    //   ("FRESH-BAKED", "KANELBULLE"), så jag bytte till ett foto av köparens vara.
    //   Sedan Håkan: "skärmar visar inte bara en bulle eller pizza sådär, det är inte
    //   relevant" — ett foto som fyller panelen är en TAVLA, och för ett skyltbolag ÄR
    //   skärminnehållet produkten de säljer. Layouten är tillbaka (BILD-7a); orden hålls
    //   borta med LÄSBARHET i stället för genom att ta bort kompositionen.
    const r = branschRekvisita("Digital signage & storformatsdisplayer");
    expect(r).toMatch(/REAL CAMPAIGN/);
    expect(r).toMatch(/offer or price block/i);
    expect(r).toMatch(/never one big photograph filling the whole panel/i);
    expect(r).toMatch(/[Nn]ever a decorative stock subject/);
    expect(r).toMatch(/icebergs/); // BILD-12: fjällpanoramat är namngivet, inte antytt
  });

  it("monteringen är en PLATTFORMSregel, inte en skyltbolagsregel", async () => {
    // ⚠ Håkans fynd 15/8 på DoD-bilden: skärmen satt på snedden i skyltfönstret. "Så
    //   skulle det aldrig sättas." Ordet "at an angle" i den förra lydelsen var min egen
    //   inbjudan till det. Hans andra rättning samma dag: "gör inte missarna bara för DT,
    //   se det systemmässigt" — därför K5, som gäller varje bransch.
    const { VERKLIGHETSVAKT_EN } = await import("@/lib/bild/promptbyggare");
    expect(VERKLIGHETSVAKT_EN).toMatch(/level, upright, square to the wall/);
    expect(VERKLIGHETSVAKT_EN).toMatch(/[Nn]othing is tilted, leaning, rotated/);
    expect(VERKLIGHETSVAKT_EN).toMatch(/no ladders/);
    // Ingen bransch får ha "sett i vinkel" kvar som en inbjudan till snedhängd rekvisita.
    for (const bransch of ["digital signage", "terapi", "bilhandel", "bageri", "bygg", "konsult"]) {
      expect(branschRekvisita(bransch)).not.toMatch(/seen at an angle/);
    }
  });

  it("beställs en layout måste OLÄSLIGHETEN beställas i samma andetag", () => {
    // Rotorsaken i punkt 5, låst i sin nya form: en modell kan inte rita en rubrikzon utan
    // bokstavsformer — men den kan visa den på avstånd, i vinkel eller ur fokus. Varje
    // regel som ber om en layout måste därför bära kravet på att inget ord går att läsa.
    for (const bransch of ["digital signage", "bageri och café", "bilhandel", "konsult", "terapi", "bygg"]) {
      const r = branschRekvisita(bransch);
      if (/layout|campaign|heading zone|price block/i.test(r)) {
        expect(r, bransch).toMatch(/no single word can be read|nothing can be read|nothing on them can be read/i);
      }
    }
  });

  it("modellbegränsningen är inbakad: inget ord går att läsa, på något språk", () => {
    // BILD-10 (10/8) stängde av textbeställningen för att modellen inte kan stava
    // svenska (AluCon: "HÄLLBARA PROFILER FÖR FRAMITDEN").
    expect(branschRekvisita("digital signage")).toMatch(/no single word can be read, in any language/i);
  });

  it("terapeut får trovärdig miljö i sin bransch, inte skyltregler", () => {
    const r = branschRekvisita("Hypnoterapi, samtalsterapi & energibehandling");
    expect(r).toMatch(/treatment room|chairs/i);
    expect(r).not.toMatch(/CAMPAIGN LAYOUT/);
  });

  it("okänd bransch får en generell regel, aldrig ingen regel alls", () => {
    expect(branschRekvisita("konsult inom nischat område")).toMatch(/real working environment/i);
  });
});

describe("K3 · person och perspektiv delas UT, önskas inte", () => {
  it("fem slides ger minst tre olika personkategorier", () => {
    const valda = [0, 1, 2, 3, 4].map((i) => personKategoriFor("digital signage", i));
    expect(new Set(valda).size).toBeGreaterThanOrEqual(3);
  });

  it("samma kategori kommer aldrig två gånger i rad", () => {
    for (let i = 0; i < 12; i++) {
      expect(personKategoriFor("digital signage", i)).not.toBe(personKategoriFor("digital signage", i + 1));
    }
  });

  it("kategorierna är POSITIVT formulerade — modeller hanterar negationer dåligt", () => {
    // "ingen man vid skärmen" ger en man vid skärmen. "no people at all" följt av vad
    // bilden ska bäras av är däremot en instruktion om vad som SKA finnas.
    for (const k of personKategorier("digital signage")) {
      expect(k).not.toMatch(/\bingen\b|\binte\b/i);
    }
  });

  it("mannen i arbetskläder är begränsad till en gång i serien", () => {
    const k = personKategorier("digital signage");
    const man = k.filter((x) => /a man in work clothing/.test(x));
    expect(man).toHaveLength(1);
    expect(man[0]).toMatch(/at most once/);
  });

  it("branschen styr värdena, mekaniken är densamma", () => {
    expect(personKategorier("terapi")).not.toEqual(personKategorier("digital signage"));
    expect(personKategorier("terapi").length).toBeGreaterThanOrEqual(4);
  });
});

describe("K4 · ljusvakten", () => {
  it("huvudmotivet måste synas, även i miniatyr", () => {
    expect(LJUSVAKT_EN).toMatch(/clearly and unmistakably visible/);
    expect(LJUSVAKT_EN).toMatch(/thumbnail/);
  });

  it("mörka miljöer tillåts, men bara med motivet upplyst", () => {
    expect(LJUSVAKT_EN).toMatch(/Dark or evening settings are allowed only when/);
  });
});

describe("BILD-10 v2 · allt hänger ihop i EN prompt", () => {
  const p = fogaSamman({
    scen: "A shop interior with a screen above the counter.",
    bevismening: "visible failure in the panel",
    rekvisita: "Screens show campaign layout.",
    personkategori: "no people at all",
    kitSuffix: "Visual treatment: warm.",
  });

  it("bevisfrågan står FÖRST efter scenen och får styra kompositionen", () => {
    expect(p.indexOf("WHAT THE PICTURE MUST PROVE")).toBeLessThan(p.indexOf("PROPS AND SETTING"));
    expect(p).toMatch(/If the scene does not show it, change the scene/);
  });

  it("alla fyra kraven finns med i samma prompt", () => {
    expect(p).toContain("WHAT THE PICTURE MUST PROVE");
    expect(p).toContain("PROPS AND SETTING");
    expect(p).toContain("PEOPLE AND VIEWPOINT");
    expect(p).toContain("EXPOSURE");
  });

  it("BILD-10-regeln står kvar: ingen läsbar text i bilden", () => {
    expect(p).toMatch(/no readable text anywhere in the image/i);
  });
});

describe("K0 · flödena går genom den delade byggaren", () => {
  it("Studios bildväg bygger ingen egen prompt längre", () => {
    const route = las("app/api/studio/suggest-image/route.ts");
    expect(route).toContain("byggBildPrompt");
  });

  it("karusellen skickar sin position i serien", () => {
    // Utan position kan rotationen inte dela ut något, och fem slides blev fem likadana.
    const maker = las("components/StudioMaker.tsx");
    expect(maker).toContain("serieIndex: n");
    expect(maker).toContain("serieAntal: list.length");
  });

  it("bevismening och personkategori loggas per bild", () => {
    const route = las("app/api/studio/suggest-image/route.ts");
    expect(route).toContain("bevis:");
    expect(route).toContain("person:");
  });
});
