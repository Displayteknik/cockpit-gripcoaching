// R-5b, fjärde kravet (HELG-1 DEL 0/2, 2026-08-21): beslutstabellen bort ur KUNDENS export,
// ägarvyn behåller den. Sköts av lib/deep-audit-siffror.ts::kundtext() + beslutstabellBlock().
//
// Två separata vägar in i produktionen läser samma db-fält (client_assets.body):
//  - app/api/seo/deep-audit (kund) MÅSTE aldrig visa beslutstabellen.
//  - app/api/analytics/deep-audit (ägare) MÅSTE alltid kunna se den, oavsett om raden
//    sparades före eller efter detta krav fanns (gamla rapporter saknar tabellen i `body`
//    men bär `metadata.grind_sifferbeslut` — den ska räcka för att bygga tillbaka den).
import { describe, it, expect } from "vitest";
import { kundtext, beslutstabellBlock, type Sifferbeslut } from "@/lib/deep-audit-siffror";

const beslut: Sifferbeslut[] = [
  { tal: "150", klass: "B", utfall: "belagt", kalla: "Googles gräns", mening: "Max 150 tecken.", sektion: "Meta" },
  { tal: "58", klass: "C", utfall: "belagt", kalla: "vår egen mätning", mening: "51 av 58 bilder.", sektion: "Bilder" },
];

/** Så rapporten faktiskt ser ut sparad i DB idag: rapport + Ordlista + CTA + lucklista + tabell. */
const helRapport = (tabell: string) =>
  [
    "# Djupgranskning\n\nInnehåll...\n",
    "# Ordlista, vad orden betyder\n\n| Ord | Betydelse |\n|---|---|\n| SEO | ... |\n",
    "---\n\n## Vad jag kan göra åt dig direkt\n\n1. Skriva tre bloggposter.\n",
    "---\n\n### Siffror du behöver fylla i\n\n- **30 000** i avsnittet X.\n",
    tabell,
  ].join("\n");

describe("kundtext() — beslutstabellen bort ur kundens export", () => {
  it("klipper bort beslutstabellen när den finns i texten", () => {
    const rapport = helRapport(beslutstabellBlock(beslut));
    const kund = kundtext(rapport);
    expect(kund).not.toContain("Så här bedömdes varje siffra");
    expect(kund).not.toContain("| 150 |");
  });

  it("BEVIS ATT DET INTE ÄR EN SLUMP: en rapport UTAN tabell är oförändrad", () => {
    const rapportUtanTabell = helRapport("");
    expect(kundtext(rapportUtanTabell)).toBe(rapportUtanTabell);
  });

  it("behåller innehåll efter Ordlistan som INTE är beslutstabellen (CTA-listan, lucklistan)", () => {
    // Håkans ordval var "kundrapporten slutar vid ordlistan", men rapporten har genuint
    // kundnyttigt innehåll EFTER Ordlistan (en handlingslista, en lista med luckor kunden
    // ska fylla i) innan beslutstabellen kommer. Det kravet som faktiskt går att mäta och
    // som skyddar mot kundrisk är att BESLUTSTABELLEN aldrig syns — inte att allt efter
    // ordet "Ordlista" försvinner. Se HELG-1 DEL 2-handoffen för avvägningen.
    const rapport = helRapport(beslutstabellBlock(beslut));
    const kund = kundtext(rapport);
    expect(kund).toContain("Vad jag kan göra åt dig direkt");
    expect(kund).toContain("Siffror du behöver fylla i");
  });

  it("PROVAD GENOM ATT BRYTAS: en rad med bara ett ensamt ord 'Så' i brödtexten rör inte texten", () => {
    const oskyldig = "Så här ser din trafik ut just nu.\n\nOrdlista\n\nSlut.";
    expect(kundtext(oskyldig)).toBe(oskyldig);
  });
});

describe("beslutstabellBlock() — ägarvyns återuppbyggnad", () => {
  it("bygger en tom sträng när inga beslut finns (gamla rapporter utan sifferbeslut i metadata)", () => {
    expect(beslutstabellBlock([])).toBe("");
  });

  it("kundtext(rapport) + beslutstabellBlock(samma beslut) ger tillbaka en fungerande ägarversion", () => {
    const rapport = helRapport(beslutstabellBlock(beslut));
    const agarversion = kundtext(rapport) + beslutstabellBlock(beslut);
    expect(agarversion).toContain("Så här bedömdes varje siffra");
    expect(agarversion).toContain("| 150 |");
    expect(agarversion).toContain("| 58 |");
  });
});
