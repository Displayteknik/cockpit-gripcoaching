// Enhetstester för taBortTankstreckHtml (TEXT-1 justeringsrundan v2).
// HTML-brödtext (blogg) kunde inte gå genom taBortTankstreck rakt av — taggar,
// attribut (href="x-y") och hex-färger i style får aldrig röras. Funktionen
// splittar på taggar och sanerar ENDAST textnoderna. Inga nycklar, inget nät.

import { describe, expect, it } from "vitest";
import {
  fixaTerminologi,
  harPrisuppgift,
  hittaPrisuppgifter,
  raknaCta,
  sanitizeGenerated,
  taBortFloskler,
  taBortTankstreck,
  taBortTankstreckHtml,
} from "@/lib/content/writing-rules";

describe("taBortTankstreckHtml", () => {
  it("tankstreck i löptext försvinner (både – och —)", () => {
    const ut = taBortTankstreckHtml("<p>Det låter dyrt – men det är det inte.</p><p>En skärm—inte en TV.</p>");
    expect(ut).toBe("<p>Det låter dyrt, men det är det inte.</p><p>En skärm, inte en TV.</p>");
  });

  it('<a href="x-y"> lämnas orörd, texten i länken saneras', () => {
    const ut = taBortTankstreckHtml('<p>Läs <a href="/blogg/led-vagg-guide">guiden – steg för steg</a> här.</p>');
    expect(ut).toContain('href="/blogg/led-vagg-guide"');
    expect(ut).toContain("guiden, steg för steg");
  });

  it("hex-färger i style-attribut rörs inte", () => {
    const html = '<p style="color:#a1b2c3;background:#fff">Text – med paus.</p>';
    const ut = taBortTankstreckHtml(html);
    expect(ut).toContain('style="color:#a1b2c3;background:#fff"');
    expect(ut).toContain("Text, med paus.");
  });

  it("punktlistor i HTML: markup orörd, em dash efter inline-tagg blir komma", () => {
    const ut = taBortTankstreckHtml("<ul><li><strong>Alltid på</strong> — skärmen rullar dygnet runt.</li><li>Punkt två</li></ul>");
    expect(ut).toBe("<ul><li><strong>Alltid på</strong>, skärmen rullar dygnet runt.</li><li>Punkt två</li></ul>");
  });

  it("bindestreck i sammansatta ord och sifferintervall lämnas", () => {
    const ut = taBortTankstreckHtml("<p>En LED-vägg för 2020–2024 med före/efter-bilder.</p>");
    expect(ut).toBe("<p>En LED-vägg för 2020–2024 med före/efter-bilder.</p>");
  });

  it("tom sträng och HTML utan tankstreck passerar oförändrat", () => {
    expect(taBortTankstreckHtml("")).toBe("");
    const ren = "<h2>Rubrik</h2><p>Vanlig text.</p>";
    expect(taBortTankstreckHtml(ren)).toBe(ren);
  });

  it("ren text (inga taggar) beter sig som taBortTankstreck", () => {
    const s = "Först – sedan. En lista:\n- punkt ett\n- punkt två";
    expect(taBortTankstreckHtml(s)).toBe(taBortTankstreck(s));
  });
});

// ── KVALITET-3 / punkt 7 ─────────────────────────────────────────────────────
describe("punkt 7 — raknaCta räknar CTA-golvets egna verb", () => {
  it("skicka, ring, mejla, kommentera och svara räknas var för sig", () => {
    for (const verb of ["Skicka", "Ring", "Mejla", "Kommentera", "Svara"]) {
      expect(raknaCta(`${verb} oss i dag.`), verb).toBe(1);
    }
  });

  it("CTA-golvets exempelmening räknas som exakt en CTA (räknades förr som noll)", () => {
    expect(raknaCta("Skicka en bild på platsen du vill skylta, få en offert inom 24 timmar.")).toBe(1);
  });

  it("två uppmaningar ger två träffar, ren text ger noll", () => {
    expect(raknaCta("Boka ett möte. Mejla oss också.")).toBe(2);
    expect(raknaCta("Vi bygger skyltar i Krokom sedan 2009.")).toBe(0);
  });

  it("maila stavat med i räknas också", () => {
    expect(raknaCta("Maila oss så hörs vi.")).toBe(1);
  });
});

describe("punkt 7 — terminologi: högt ljus blir hög ljusstyrka", () => {
  it("byter uttrycket och behåller versal i meningsbörjan", () => {
    expect(fixaTerminologi("Skärmen har högt ljus.")).toBe("Skärmen har hög ljusstyrka.");
    expect(fixaTerminologi("Högt ljus gör den läsbar i sol.")).toBe("Hög ljusstyrka gör den läsbar i sol.");
    expect(fixaTerminologi("Ännu högre ljus än förra modellen.")).toBe("Ännu högre ljusstyrka än förra modellen.");
  });

  it("sammansättningar med ljus- rörs inte (ordgräns)", () => {
    const orort = "Rummet har högt ljusinsläpp och högt i tak.";
    expect(fixaTerminologi(orort)).toBe(orort);
  });

  it("fixen körs ALLTID: både i full sanering och i floskelgolvet (flagga av)", () => {
    expect(taBortFloskler("Högt ljus, riktigt kraftfullt.")).toContain("Hög ljusstyrka");
    expect(sanitizeGenerated("Skärmen har högt ljus.")).toBe("Skärmen har hög ljusstyrka.");
  });
});

// ── KVALITET-3 / punkt 5 ─────────────────────────────────────────────────────
describe("punkt 5 — prisdetektering (grind och undantag)", () => {
  it("hittar priser med valutamarkör, även med hårt blanksteg", () => {
    expect(harPrisuppgift("Kostar från 21 000 kr.")).toBe(true);
    expect(harPrisuppgift("Kostar från 21 000 kr.")).toBe(true);
    expect(harPrisuppgift("Servicebesök 1 850:-")).toBe(true);
    expect(harPrisuppgift("995 kr/mån")).toBe(true);
    expect(harPrisuppgift("SEK 400 för montaget")).toBe(true);
    expect(harPrisuppgift("Priset är 300kr")).toBe(true);
  });

  it("tal UTAN valutamarkör är inget pris (43 tum, årtal, telefonnummer)", () => {
    expect(harPrisuppgift("En 43 tums skärm från 2026.")).toBe(false);
    expect(harPrisuppgift("Vi svarar inom 24 timmar.")).toBe(false);
  });

  it('"3 sek" är en videolängd, inte ett pris (reels-flödet)', () => {
    expect(harPrisuppgift("Scenen är 3 sek lång.")).toBe(false);
    expect(harPrisuppgift("5 sekunder kvar.")).toBe(false);
  });

  it("hittaPrisuppgifter listar träffarna för logg och granskning", () => {
    expect(hittaPrisuppgifter("Från 21 000 kr, service 1 850:-")).toEqual(["21 000 kr", "1 850:-"]);
    expect(hittaPrisuppgifter("")).toEqual([]);
  });
});
