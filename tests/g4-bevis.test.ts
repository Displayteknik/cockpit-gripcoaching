// G-4 — bevis-motorn.
//
// Det farligaste med den här etappen är att den ber modellen om ett BEVIS. Görs det fel
// blir lagret en beställning att fabricera — precis den risk som höll bevis-sliden
// avstängd fram till nu. Testerna nedan bevakar därför tre saker i tur och ordning:
//
//   1. PRISER ÄR ALDRIG BEVIS. Håkans beslut 31/7 + 9/8, och den regel som kostar mest
//      om den glider: pricing_notes får inte bli citatmaterial via bakvägen.
//   2. UTAN MATERIAL BLIR LAGRET ETT FÖRBUD, inte ett tomt block. Ett tomt lager plus
//      en anatomi som kräver bevis ÄR instruktionen att hitta på.
//   3. SIFFRAN BEHÅLLER SIN MENING. "sedan 1998" är ett bevis, "1998" är ett tal.

import { describe, expect, it } from "vitest";
import { bevisBlock, taBevisRader, INGET_BEVIS, type BevisLage } from "@/lib/bevis";

const medMaterial = (over: Partial<BevisLage> = {}): BevisLage => ({
  siffror: ["Vi har satt upp över 400 skyltar sedan 1998"],
  citat: ["Kunden vågade inte byta — nu står skylten kvar efter fem vintrar"],
  harVinnande: false,
  kanKravaBevis: true,
  ...over,
});

describe("G-4 · priser är aldrig bevis", () => {
  it("blocket säger uttryckligen att priser inte får skrivas ut, även när bevis finns", () => {
    // Den farligaste stunden är just när modellen HAR bevismaterial och behöver
    // konkretion: då ligger priset närmast till hands.
    expect(bevisBlock(medMaterial())).toContain("PRISER ÄR INTE BEVIS");
  });

  it("pricing_notes står inte bland fälten bevis plockas ur", async () => {
    // Grinden ligger i källkoden, inte i en körning: ett tillagt fält ska fälla testet.
    const kod = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("../lib/bevis.ts", import.meta.url), "utf8"),
    );
    const falt = kod.slice(kod.indexOf("const SIFFERFALT"), kod.indexOf("] as const"));
    expect(falt).toContain("verified_numbers");
    expect(falt).not.toContain("pricing_notes");
  });

  it("profilmätaren räknar inte längre priser som siffror vi får använda", async () => {
    const kod = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("../lib/profil/kvalitet.ts", import.meta.url), "utf8"),
    );
    // BEVISFALT = PROMPTFALT minus pricing_notes plus verified_numbers.
    expect(kod).toContain('BEVISFALT = PROMPTFALT.filter((f) => f !== "pricing_notes")');
    expect(kod).toContain('.concat("verified_numbers")');
    // Åtgärdstexten bad tidigare kunden om "pris" som exempel på en bevissiffra.
    expect(kod).not.toContain("siffror med enhet (pris, årtal");
  });
});

describe("G-4 · utan material blir lagret ett förbud", () => {
  const utan = bevisBlock(INGET_BEVIS);

  it("säger rakt ut att klienten inte har något att belägga med", () => {
    expect(utan).toContain("INGET VERIFIERAT MATERIAL");
  });

  it("förbjuder sifferpåståenden i stället för att bara utelämna dem", () => {
    expect(utan).toContain("HELT utan sifferpåståenden");
  });

  it("stänger även den antydda mätningen — den luckan är hela poängen", () => {
    // "många kunder vittnar om" är ett bevispåstående utan bevis. Utan den raden
    // hade förbudet mot siffror bara flyttat fabriceringen till orden.
    expect(utan).toContain("LÅTER belagd utan att vara det");
  });

  it("INGET_BEVIS kan aldrig kräva ett bevis", () => {
    expect(INGET_BEVIS.kanKravaBevis).toBe(false);
  });
});

describe("G-4 · med material blir lagret en inbjudan", () => {
  it("räknar upp de verifierade siffrorna så de går att använda", () => {
    const b = bevisBlock(medMaterial());
    expect(b).toContain("VERIFIERADE SIFFROR");
    expect(b).toContain("Vi har satt upp över 400 skyltar sedan 1998");
  });

  it("kräver att siffror i texten kommer HÄRIFRÅN", () => {
    expect(bevisBlock(medMaterial())).toContain("skriv meningen utan tal");
  });

  it("story-bankens material återges som citat eller tredje person, aldrig som eget minne", () => {
    // Det var exakt felet sanningskravet byggdes för: "Jag minns en kund som..."
    const b = bevisBlock(medMaterial());
    expect(b).toContain("aldrig omskrivet till ett eget minne i jag-form");
  });

  it("bara siffror räcker för att kunna kräva bevis — citat är inte obligatoriskt", () => {
    const b = bevisBlock(medMaterial({ citat: [] }));
    expect(b).toContain("VERIFIERADE SIFFROR");
    expect(b).not.toContain("STORY-BANKEN");
  });

  it("vinnande exempel nämns inte som citatkälla, ens när de finns", () => {
    // De är stilreferens i sitt eget lager. En färdig text är ingen kontrollerad
    // uppgift — siffror inuti den kan vara avrundade eller inaktuella.
    const b = bevisBlock(medMaterial({ harVinnande: true }));
    expect(b).not.toContain("VINNANDE");
  });
});

describe("G-4 · siffran behåller sin mening", () => {
  it("plockar hela påståendet, inte det nakna talet", () => {
    expect(taBevisRader("Vi har levererat över 400 skyltar sedan 1998."))
      .toEqual(["Vi har levererat över 400 skyltar sedan 1998."]);
  });

  it("rader utan tal släpps igenom aldrig", () => {
    expect(taBevisRader("Vi är noggranna och trevliga.")).toEqual([]);
  });

  it("punktlistor utan skiljetecken delas per rad", () => {
    const ut = taBevisRader("- Offert inom 24 timmar\n- Grundat 1998\n- Vi gillar kaffe");
    expect(ut).toEqual(["Offert inom 24 timmar", "Grundat 1998"]);
  });

  it("dubbletter räknas en gång", () => {
    expect(taBevisRader("Sedan 1998.\nSedan 1998.")).toEqual(["Sedan 1998."]);
  });

  it("tomt fält ger tom lista, aldrig en rad med skräp", () => {
    expect(taBevisRader("")).toEqual([]);
    expect(taBevisRader("   \n  ")).toEqual([]);
  });
});

describe("G-4 · karusellens bevis-slide är gatad på material", () => {
  it("rollistan får en bevis-slide bara när den slås på", async () => {
    const { karusellRoller } = await import("@/lib/format-anatomi");
    const utan = karusellRoller({ punkter: 3, medInsats: true, medBevis: false });
    const med = karusellRoller({ punkter: 3, medInsats: true, medBevis: true });
    expect(utan).not.toContain("bevis");
    expect(med).toContain("bevis");
    // Bevis-sliden ligger sist före avslutet — den ska landa efter punkterna.
    expect(med[med.length - 2]).toBe("bevis");
  });

  it("carousel.ts styr slidens existens på bevisläget, inte på en hårdkodad flagga", async () => {
    const kod = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("../lib/studio/carousel.ts", import.meta.url), "utf8"),
    );
    expect(kod).toContain("medBevis: opts.medBevis ?? bevis.kanKravaBevis");
    // Den gamla hårda avstängningen får inte ligga kvar.
    expect(kod).not.toContain("medBevis: opts.medBevis === true");
  });
});
