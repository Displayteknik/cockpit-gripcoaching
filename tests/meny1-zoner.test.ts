// MENY-1 — menyn grupperas efter VEM SOM KOMMER ÅT INNEHÅLLET. Håkans beslut 2026-08-10.
//
// Bakgrunden: han öppnade Planering, bytte kund och såg samma ifyllda vecka i två konton.
// Veckan var hans EGEN kalender (owner-grindad route, ingen klientkolumn) — men sidan låg i
// samma meny som kundsakerna, under klientväljaren, och lästes därför som kundens vecka.
// Felet satt i menyn, inte i datat.
//
// Tre zoner:
//   eget    — bara du. Byter inte när du växlar kund.
//   byra    — om den valda kunden, men kunden ser inte det.
//   kundens — samma innehåll som kunden når i sin portal (/k/...).
//
// Grinden läser källkoden och kontrollerar tre saker som en läsning av filen inte kan
// garantera: att ingen sida försvann i omgrupperingen, att varje ägarsida ligger i "eget",
// och att varje post i "kundens" har en portal-sida som FAKTISKT finns på disk.

import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";

const ROT = new URL("../", import.meta.url);
const kod = readFileSync(new URL("app/dashboard/layout.tsx", ROT), "utf8");
// Bara byråmenyn läses. Den bantade klientvyn (buildScopedNavSections) har inga zoner och
// hade annars hamnat i den SISTA sektionen — första körningen räknade dess Sidor och SEO
// som dubbletter, vilket är exakt den sortens tysta mätfel som gör ett test värdelöst.
const BYRAMENY = kod.slice(0, kod.indexOf("function buildScopedNavSections"));

/** Sektionerna med sin zon, i den ordning de står i filen. */
function sektioner(): { zon: string; label: string; hrefs: string[]; kundHrefs: string[] }[] {
  const ut: { zon: string; label: string; hrefs: string[]; kundHrefs: string[] }[] = [];
  // Varje sektion börjar med `zon: "..."` och slutar där nästa börjar (eller vid funktionens slut).
  const bitar = BYRAMENY.split(/\n\s*\{\s*\n\s*zon:\s*"/).slice(1);
  for (const bit of bitar) {
    const zon = bit.slice(0, bit.indexOf('"'));
    const kropp = bit.split(/\n\s*\},\s*\n\s*\n/)[0];
    const label = /label:\s*"([^"]+)"/.exec(kropp)?.[1] ?? "";
    ut.push({
      zon,
      label,
      hrefs: [...kropp.matchAll(/href:\s*"(\/dashboard[^"]*)"/g)].map((m) => m[1]),
      kundHrefs: [...kropp.matchAll(/kundHref:\s*"([^"]+)"/g)].map((m) => m[1]),
    });
  }
  return ut;
}

const SEKTIONER = sektioner();
const ALLA_HREFS = SEKTIONER.flatMap((s) => s.hrefs);

describe("MENY-1 · zonerna finns och är förklarade", () => {
  it("källan går att läsa — annars mäter resten av testet ingenting", () => {
    expect(SEKTIONER.length).toBeGreaterThanOrEqual(6);
    expect(ALLA_HREFS.length).toBeGreaterThanOrEqual(25);
  });

  it("varje sektion tillhör en av de tre zonerna", () => {
    for (const s of SEKTIONER) {
      expect(["eget", "byra", "kundens"], `${s.label}`).toContain(s.zon);
    }
  });

  it("varje zon har både rubrik och förklaring — ett ord räcker inte", () => {
    for (const zon of ["eget", "byra", "kundens"]) {
      const rad = new RegExp(`id:\\s*"${zon}",\\s*rubrik:\\s*"([^"]+)",\\s*forklaring:\\s*"([^"]+)"`).exec(kod);
      expect(rad, zon).toBeTruthy();
      expect(rad![1].length, `${zon} rubrik`).toBeGreaterThan(3);
      expect(rad![2].length, `${zon} förklaring`).toBeGreaterThan(15);
    }
  });

  it("zonerna står i ordning: ditt eget först, kundens sist", () => {
    const ordning = [...new Set(SEKTIONER.map((s) => s.zon))];
    expect(ordning).toEqual(["eget", "byra", "kundens"]);
  });

  it("ingen sida ligger i två zoner", () => {
    expect(new Set(ALLA_HREFS).size, `dubbletter: ${ALLA_HREFS.filter((h, i) => ALLA_HREFS.indexOf(h) !== i).join(", ")}`).toBe(ALLA_HREFS.length);
  });
});

describe("MENY-1 · det som är ditt ligger under Ditt eget", () => {
  // Listan är fyndets egen kärna: det här är sidor som INTE byter innehåll med
  // klientväljaren. Hamnar någon av dem i en kundzon är vi tillbaka i missförståndet.
  const EGNA = [
    "/dashboard/hq",
    "/dashboard/hq/planering",
    "/dashboard/hq/uppstart",
    "/dashboard/hq/kontakt",
    "/dashboard/mysales-kunder",
    "/dashboard/kvalitet",
    "/dashboard/betalning",
    "/dashboard/kostnader",
    "/dashboard/specialister",
    "/dashboard/setup",
    "/dashboard/setup/onboard",
    "/dashboard/onboarding",
    "/dashboard/installningar",
  ];

  for (const href of EGNA) {
    it(`${href} ligger i zonen "eget"`, () => {
      const s = SEKTIONER.find((x) => x.hrefs.includes(href));
      expect(s, `${href} finns inte i menyn`).toBeTruthy();
      expect(s!.zon, `${href} ligger i "${s!.zon}" (${s!.label})`).toBe("eget");
    });
  }

  it("Planering ligger inte kvar bland kundsidorna", () => {
    const s = SEKTIONER.find((x) => x.hrefs.includes("/dashboard/hq/planering"))!;
    expect(s.zon).toBe("eget");
    expect(s.label).toBe("Din vecka");
  });
});

describe("MENY-1 · Kundens egna ytor är bevisat kundens", () => {
  const kundzon = SEKTIONER.filter((s) => s.zon === "kundens");

  it("varje post i zonen namnger kundens motsvarande sida", () => {
    for (const s of kundzon) {
      expect(s.kundHrefs.length, `${s.label}: ${s.hrefs.length} poster men ${s.kundHrefs.length} kundHref`).toBe(s.hrefs.length);
    }
  });

  it("och den sidan finns FAKTISKT under app/k/ — påståendet är inte en bedömning", () => {
    for (const kundHref of kundzon.flatMap((s) => s.kundHrefs)) {
      const fil = new URL(`app${kundHref}/page.tsx`, ROT);
      expect(existsSync(fil), `${kundHref} har ingen sida på disk`).toBe(true);
    }
  });

  it("ingen post UTANFÖR kundzonen påstår sig vara kundens", () => {
    for (const s of SEKTIONER.filter((x) => x.zon !== "kundens")) {
      expect(s.kundHrefs, `${s.label}`).toEqual([]);
    }
  });
});

describe("MENY-1 · omgrupperingen tappade ingen sida", () => {
  // Alla poster som fanns i menyn FÖRE omgrupperingen (commit 3ad04ca). En sida som
  // försvinner ur menyn finns inte längre — det vore en tystare regression än en bugg.
  const FORE = [
    "/dashboard", "/dashboard/hq", "/dashboard/hq/uppstart", "/dashboard/hq/kontakt",
    "/dashboard/hq/planering", "/dashboard/mysales-kunder", "/dashboard/kvalitet",
    "/dashboard/profil", "/dashboard/brand-kit", "/dashboard/konkurrenter", "/dashboard/analysator",
    "/dashboard/innehall", "/dashboard/studio", "/dashboard/studio/blogg", "/dashboard/studio/kalender",
    "/dashboard/linkedin", "/dashboard/mejl", "/dashboard/nyhetsbrev", "/dashboard/agents",
    "/dashboard/seo", "/dashboard/webbdata-demo", "/dashboard/sidor", "/dashboard/blogg",
    "/dashboard/onboarding", "/dashboard/fokus", "/dashboard/leads", "/dashboard/offert",
    "/dashboard/godkannande", "/dashboard/rapport", "/dashboard/paket", "/dashboard/kund-access",
    "/dashboard/ikigai", "/dashboard/setup/onboard", "/dashboard/setup", "/dashboard/specialister",
    "/dashboard/sms-paminnelse", "/dashboard/studio/reels", "/dashboard/betalning",
    "/dashboard/kostnader", "/dashboard/handbok", "/dashboard/installningar",
  ];

  it("varje sida som fanns i menyn finns kvar", () => {
    const saknas = FORE.filter((h) => !ALLA_HREFS.includes(h));
    expect(saknas, `försvunna ur menyn: ${saknas.join(", ")}`).toEqual([]);
  });

  it("de resursberoende posterna (fordon/verk) ligger kvar i sin egen lista", () => {
    // Fordon och Verk läggs till efter resursmodul och står därför inte som href i zonen.
    expect(kod).toContain("...resourceItems");
  });
});
