// Enhetstester för taBortTankstreckHtml (TEXT-1 justeringsrundan v2).
// HTML-brödtext (blogg) kunde inte gå genom taBortTankstreck rakt av — taggar,
// attribut (href="x-y") och hex-färger i style får aldrig röras. Funktionen
// splittar på taggar och sanerar ENDAST textnoderna. Inga nycklar, inget nät.

import { describe, expect, it } from "vitest";
import { taBortTankstreck, taBortTankstreckHtml } from "@/lib/content/writing-rules";

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
