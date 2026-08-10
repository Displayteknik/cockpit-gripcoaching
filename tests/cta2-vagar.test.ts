// CTA-2 — tre varianter ska vara tre VAL, inte tre öppningar på samma avslut.
//
// Håkans fynd 10/8 i egen verifiering: han bad om tre captions och fick fråga, påstående
// och berättelse — som alla tre slutade "Skicka en bild på platsen så får du en offert inom
// 24 timmar", och två av dem med samma avslutande fråga.
//
// Orsaken: krok-vinklarna varierade ÖPPNINGEN, ingenting varierade vägen framåt. Profilens
// starkaste CTA vinner då varje gång. Varianterna genereras dessutom parallellt och kan inte
// se varandra — vägen måste delas ut per variant.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { CTA_VAGAR, CTA_VAG_ETIKETT, VINKEL_PERSPEKTIV, ctaVagForVariant, perspektivForVariant, vagarForFunnel, vinkelMedVag } from "@/lib/cta-vagar";

const las = (fil: string) => readFileSync(new URL(`../${fil}`, import.meta.url), "utf8");

describe("CTA-2 · vägarna är olika, och olika på det som syns", () => {
  it("det finns minst fyra vägar — captionvägen kan begära upp till fyra varianter", () => {
    expect(CTA_VAGAR.length).toBeGreaterThanOrEqual(4);
  });

  it("varje väg har ett eget namn och en egen instruktion", () => {
    expect(new Set(CTA_VAGAR.map((v) => v.namn)).size).toBe(CTA_VAGAR.length);
    expect(new Set(CTA_VAGAR.map((v) => v.instruktion)).size).toBe(CTA_VAGAR.length);
  });

  it("de tre första varianterna får ALDRIG samma väg", () => {
    const tre = [0, 1, 2].map((i) => ctaVagForVariant(i).namn);
    expect(new Set(tre).size).toBe(3);
  });

  it("fördelningen är deterministisk — samma variantnummer och nivå ger samma väg", () => {
    expect(ctaVagForVariant(0, "mofu").namn).toBe(ctaVagForVariant(0, "mofu").namn);
    expect(ctaVagForVariant(1, "mofu").namn).not.toBe(ctaVagForVariant(0, "mofu").namn);
    // Går man förbi urvalets slut börjar det om, och negativa index kraschar inte.
    const urval = vagarForFunnel("mofu");
    expect(ctaVagForVariant(urval.length, "mofu").namn).toBe(urval[0].namn);
    expect(ctaVagForVariant(-1, "mofu").namn).toBeTruthy();
  });

  it("varje väg SPÄRRAR de andras avslut — annars konvergerar de ändå", () => {
    // Det räcker inte att peka ut en väg: modellen lägger gärna till "eller skicka ett
    // meddelande" och då är de lika igen. Varje instruktion säger därför uttryckligen
    // vad varianten INTE ska be om.
    for (const v of CTA_VAGAR) {
      expect(v.instruktion, v.namn).toMatch(/\b(aldrig|inte)\b/i);
    }
  });
});

describe("CTA-2 · vägarna håller sig inom reglerna som redan gäller", () => {
  it("alla vägar kräver en uppmaning i imperativ — CTA-golvet (G-5) är orört", () => {
    for (const v of CTA_VAGAR) {
      expect(v.instruktion, v.namn).toContain("uppmaning i imperativ");
    }
  });

  it("ingen väg får skriva ut URL eller telefonnummer", () => {
    const egen = CTA_VAGAR.find((v) => v.namn === "egen-kanal")!;
    expect(egen.instruktion).toContain("ALDRIG ut en URL eller ett telefonnummer");
    // Och den hittar inte på en kanal kunden saknar — då faller den tillbaka.
    expect(egen.instruktion).toContain("står i varumärkesprofilen");
    expect(egen.instruktion).toContain("kommentarsfältet i stället");
  });

  it("meddelande-vägen lovar ingen tid eller siffra som inte står i profilen", () => {
    // Fyndets egen text bar "offert inom 24 timmar". Den siffran är DT:s äkta, men den
    // får bara komma ur profilen — prisregeln och sanningskravet gäller fortfarande.
    const m = CTA_VAGAR.find((v) => v.namn === "meddelande")!;
    expect(m.instruktion).toContain("som inte står i varumärkesprofilen");
  });

  it("vägarna är branschneutrala i sin FORM — exemplen får vara konkreta", () => {
    for (const v of CTA_VAGAR) {
      const t = v.instruktion.toLowerCase();
      for (const namn of ["displayteknik", "alucon", "annas blommor", "for balance", "opticur"]) {
        expect(t, `${v.namn}/${namn}`).not.toContain(namn);
      }
    }
  });

  it("vinkelMedVag lägger krok, perspektiv och väg i den ordningen", () => {
    const ut = vinkelMedVag("Öppna med en fråga.", CTA_VAGAR[0], VINKEL_PERSPEKTIV[0]);
    expect(ut.startsWith("Öppna med en fråga.\n")).toBe(true);
    expect(ut.indexOf(VINKEL_PERSPEKTIV[0])).toBeLessThan(ut.indexOf(CTA_VAGAR[0].instruktion));
  });

  it("perspektivet är valfritt — utan det byggs instruktionen som förut", () => {
    expect(vinkelMedVag("Kroken.", CTA_VAGAR[0])).toBe(`Kroken.\n${CTA_VAGAR[0].instruktion}`);
  });
});

describe("CTA-2 · varianterna tittar inte på samma sak", () => {
  // Andra halvan av fyndet: alla tre frågade i praktiken samma sak, för de såg samma sak i
  // ämnet — solen som gör skylten svart. Krok-typen styr HUR texten öppnar, inte VAD den
  // tittar på, och tre parallella varianter kan inte välja bort varandras iakttagelse.
  it("de tre första varianterna får tre olika perspektiv", () => {
    const tre = [0, 1, 2].map((i) => perspektivForVariant(i));
    expect(new Set(tre).size).toBe(3);
  });

  it("perspektiven riktar blicken, de sätter aldrig svaret", () => {
    for (const p of VINKEL_PERSPEKTIV) {
      expect(p, p.slice(0, 30)).toContain("PERSPEKTIV:");
      // Inget perspektiv får bära ett tal — det vore en beställning att fabricera.
      expect(p, p.slice(0, 30)).not.toMatch(/\d+\s*(%|kr|nits|timmar)/i);
    }
  });

  it("perspektiv och väg roterar i olika takt — samma par återkommer inte direkt", () => {
    expect(VINKEL_PERSPEKTIV.length).not.toBe(CTA_VAGAR.length);
  });

  it("captionvägen delar ut perspektivet per variant", () => {
    expect(las("app/api/studio/suggest-caption/route.ts")).toContain("perspektivForVariant(i)");
  });
});

describe("CTA-2 · captionvägen delar faktiskt ut vägarna", () => {
  const route = las("app/api/studio/suggest-caption/route.ts");

  it("varje variant får sin väg via variantnumret", () => {
    expect(route).toContain("ctaVagForVariant(i, bygg.meta.funnel)");
    expect(route).toContain("vinkelMedVag(v.instruktion, vag, perspektivForVariant(i))");
  });

  it("vägen följer med i svaret så gränssnittet kan visa den", () => {
    expect(route).toContain("ctaVag: vag.namn");
  });

  it("etiketten som kunden ser är klarspråk, inte systemord", () => {
    for (const namn of CTA_VAGAR.map((v) => v.namn)) {
      const etikett = CTA_VAG_ETIKETT[namn];
      expect(etikett, namn).toBeTruthy();
      expect(etikett, namn).not.toMatch(/cta|variant|_/i);
    }
  });

  it("variantkortet visar vägen — annars syns skillnaden först efter att man läst allt", () => {
    const ui = las("components/StudioMaker.tsx");
    expect(ui).toContain("CTA_VAG_ETIKETT[v.ctaVag]");
  });
});

describe("CTA-3 · steget följer nivån — inget sälj på första mötet", () => {
  // Håkans fynd 10/8: ett TOFU-inlägg om ångest slutade "Boka ett första samtal via länken
  // i profilen". Nivån var rätt, uppmaningen var för stor. Regeln står i prompt-core, men
  // den ligger också i URVALET här: en tofu-variant kan inte FÅ den vägen.
  it("varje väg har en stegstorlek", () => {
    for (const v of CTA_VAGAR) {
      expect(["litet", "mellan", "stort"], v.namn).toContain(v.steg);
    }
  });

  it("tofu får aldrig en väg som ber om kontakt", () => {
    const vagar = vagarForFunnel("tofu");
    expect(vagar.length).toBeGreaterThanOrEqual(3);
    expect(vagar.some((v) => v.steg === "stort")).toBe(false);
    expect(vagar.map((v) => v.namn)).not.toContain("meddelande");
  });

  it("...och det gäller varje variant, inte bara den första", () => {
    for (let i = 0; i < 12; i++) {
      expect(ctaVagForVariant(i, "tofu").steg, `variant ${i}`).not.toBe("stort");
    }
  });

  it("bofu får be om kontakt — det är hela poängen med nivån", () => {
    expect(vagarForFunnel("bofu").some((v) => v.steg === "stort")).toBe(true);
  });

  it("mofu får hela bredden", () => {
    expect(vagarForFunnel("mofu").length).toBe(CTA_VAGAR.length);
  });

  it("okänd eller saknad nivå behandlas som tofu — försiktigt, inte modigt", () => {
    for (const okant of [null, undefined, "", "nonsens"]) {
      expect(vagarForFunnel(okant).some((v) => v.steg === "stort"), String(okant)).toBe(false);
    }
  });

  it("tre tofu-varianter får fortfarande tre OLIKA vägar", () => {
    const tre = [0, 1, 2].map((i) => ctaVagForVariant(i, "tofu").namn);
    expect(new Set(tre).size).toBe(3);
  });

  it("captionvägen skickar in nivån som faktiskt gällde", () => {
    // bygg.meta.funnel är den effektiva nivån (flödets egen, annars syftets mjuka default).
    expect(las("app/api/studio/suggest-caption/route.ts")).toContain("ctaVagForVariant(i, bygg.meta.funnel)");
  });

  it("prompt-core förbjuder bokning på tofu, i klartext", () => {
    const kod = las("lib/prompt-core.ts");
    expect(kod).toContain("STEGETS STORLEK FÖLJER NIVÅN");
    expect(kod).toMatch(/- TOFU:[\s\S]{0,500}FÖRBJUDET/);
    // Kryphålen som fyndet gick igenom: länk i profilen, kostnadsfritt, "veta mer".
    expect(kod).toContain("även via länk i profilen");
    expect(kod).toContain("även kostnadsfritt");
  });
});
