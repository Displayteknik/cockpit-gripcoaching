// PROFIL-2 — ytan för kundberättelser och kundernas egna ord.
//
// Etappen finns för att stänga ett UI-löfte utan täckning: mätaren har sagt "Lägg till 3
// kundberättelser" sedan PROFIL-1, men materialet gick bara att fylla i via intake-flödet
// som kunden aldrig ser.
//
// Det viktigaste testet här är INTE att formuläret sparar. Det är att materialet hamnar
// där mätaren faktiskt räknar — annars hade kunden skrivit in tre berättelser och sett
// mätaren stå stilla, vilket är ett värre löftesbrott än det vi rättade.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { KUNDORD_KATEGORIER } from "@/app/api/profile/material/route";
import { beraknaKvalitet } from "@/lib/profil/kvalitet";

const las = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

describe("PROFIL-2 · materialet hamnar där mätaren räknar", () => {
  const lasKalla = las("lib/profil/las.ts");
  const rutt = las("app/api/profile/material/route.ts");

  it("mätaren räknar BÅDE intake och manuell inmatning", () => {
    // Fanns bara "intake" förut. Hade det stått kvar rörde sig aldrig mätaren.
    expect(lasKalla).toContain('.in("source_module", ["intake", "profil"])');
  });

  it("rutten skriver berättelser med ursprunget 'profil'", () => {
    // Ursprunget hålls isär med flit — att stämpla manuellt material som "intake" hade
    // varit att ljuga om var det kom ifrån för att få en siffra att röra sig.
    expect(rutt).toContain('source_module: "profil"');
  });

  it("berättelser skrivs till samma tabell och fält som intake använder", () => {
    // Samma material på samma ställe oavsett väg in. Ingen parallell datamodell.
    for (const bit of ['from("linkedin_posts")', "hook: rubrik", "idea_seed: text", 'status: "idea"']) {
      expect(rutt).toContain(bit);
    }
  });

  it("kundord skrivs till customer_voice, oarkiverade", () => {
    expect(rutt).toContain('from("customer_voice")');
    expect(rutt).toContain("archived: false");
  });
});

describe("PROFIL-2 · kategorierna speglar intake-flödets egna värden", () => {
  it("är exakt de fyra intake skriver", () => {
    expect([...KUNDORD_KATEGORIER]).toEqual(["vocabulary", "catchphrase", "objection", "transformation"]);
  });
});

describe("PROFIL-2 · borttagning behandlar de två slagen olika, med skäl", () => {
  const rutt = las("app/api/profile/material/route.ts");

  it("kundord ARKIVERAS, raderas inte", () => {
    // Ett citat kan vara källa till en redan publicerad text. Historiken ska finnas kvar.
    expect(rutt).toMatch(/update\(\{ archived: true \}\)/);
  });

  it("bara kundens EGNA berättelser går att ta bort", () => {
    // Intake-material rörs inte härifrån — det skulle radera spårbarheten till sessionen.
    expect(rutt).toMatch(/\.eq\("source_module", "profil"\)[\s\S]{0,80}\.select\("id"\)/);
  });

  it("varje skrivning är tenant-låst", () => {
    const antalKlientlas = (rutt.match(/\.eq\("client_id", clientId\)/g) || []).length;
    expect(antalKlientlas).toBeGreaterThanOrEqual(4);
  });
});

describe("PROFIL-2 · åtgärderna mätaren visar pekar nu på en yta som finns", () => {
  const TOM = { profil: null, assets: [], kundroster: [], berattelser: [], fingerprint: null, klient: { name: "Test", industry: "Terapi" } };

  it("en tom profil ber om berättelser och kundcitat", () => {
    const r = beraknaKvalitet(TOM);
    const nycklar = r.kriterier.filter((k) => k.atgard).map((k) => k.key);
    expect(nycklar).toContain("berattelser");
    expect(nycklar).toContain("kundrost");
  });

  it("ytan finns monterad på profilsidan", () => {
    const sida = las("app/dashboard/profil/page.tsx");
    expect(sida).toContain("KundMaterial");
    expect(sida).toContain('id="sec-kundmaterial"');
  });
});
