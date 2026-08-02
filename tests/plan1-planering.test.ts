import { describe, it, expect } from "vitest";
import {
  klassificera, klassa, fordelning, nyckeltal, flaggor, mallForslag,
  veckoSpann, veckodag, svensktDatum, svenskMinut, svenskTidpunkt, timmar,
  type Tidstyp, type MallRad,
} from "@/lib/hq/planering";
import { veckansSpann } from "@/app/api/hq/route";
import type { Handelse } from "@/lib/hq/kalender";

// PLAN-1 — reglerna bakom planeringsvyn, mätta mot en HANDRÄKNAD vecka.
// Testveckan är Håkans riktiga vecka 2026-08-03 till 2026-08-09, hämtad ur hans kalender.

const TYPER: Tidstyp[] = [
  { id: "t-egen", namn: "Egen tid", farg_ramp: "teal", sortering: 10, nyckelord: ["ledig", "semester", "träning", "familj"] },
  { id: "t-coach", namn: "Coaching och kunder", farg_ramp: "coral", sortering: 20, nyckelord: ["coaching", "onboarding", "kund", "möte", "pionjär"] },
  { id: "t-dt", namn: "DT och sälj", farg_ramp: "blue", sortering: 30, nyckelord: ["offert", "dt", "sälj", "uppföljning", "produktion"] },
  { id: "t-inlagg", namn: "Inlägg", farg_ramp: "purple", sortering: 40, nyckelord: ["inlägg", "batch", "content", "publicering"] },
  { id: "t-rutin", namn: "Rutiner", farg_ramp: "gray", sortering: 50, nyckelord: ["kvitto", "bokföring", "fokus", "rutin"] },
];

const bas = {
  kalender_id: "primary", beskrivning: null, plats: null, status: "confirmed",
  event_type: "DEFAULT", serie_id: null, html_lank: null, uppdaterad_google: null,
  senast_synkad: "2026-08-02T18:00:00.000Z", start_datum: null, slut_datum: null, heldag: false,
};

/** Tidsatt händelse angiven i svensk lokaltid (sommartid, alltså +02:00). */
const h = (id: string, titel: string, datum: string, start: string, slut: string): Handelse => ({
  ...bas, google_event_id: id, titel,
  start_tid: `${datum}T${start}:00+02:00`, slut_tid: `${datum}T${slut}:00+02:00`,
});

const heldag = (id: string, titel: string, fran: string, till: string, typ = "DEFAULT"): Handelse => ({
  ...bas, google_event_id: id, titel, heldag: true, event_type: typ,
  start_tid: null, slut_tid: null, start_datum: fran, slut_datum: till,
});

// Håkans riktiga vecka, exakt som den låg i kalendern 2026-08-02.
const VECKAN: Handelse[] = [
  h("m1", "Fokus idag (white space-dag)", "2026-08-03", "08:00", "08:30"),
  h("m2", "Pipeline-genomgång: uppföljningsdatum + betalstatus på 21 kort", "2026-08-03", "09:00", "09:30"),
  h("m3", "Onboarding kund 1 (MySales Pro)", "2026-08-03", "10:00", "11:00"),
  h("m4", "Onboarding kund 2 (MySales Pro)", "2026-08-03", "13:00", "14:00"),
  h("m5", "Kundcontent-batch (flyttad hit denna vecka), publicering 20:00", "2026-08-03", "14:30", "16:30"),
  heldag("h1", "Stay at Haymarket by Scandic", "2026-08-04", "2026-08-06", "FROM_GMAIL"),
  heldag("h2", "Ledig: Stockholm med sambon", "2026-08-04", "2026-08-06"),
  h("t1", "Maskindag: produktion (Cockpit, offerter, kampanjer)", "2026-08-06", "09:00", "12:00"),
  h("t2", "Kvittojakt (flyttad denna månad)", "2026-08-06", "12:30", "13:00"),
  h("t3", "Kundcontent-batch: Ingela, Rickhard, Carl-Fredrik", "2026-08-06", "13:00", "14:30"),
  h("f1", "Fokus idag (white space-dag)", "2026-08-07", "08:00", "08:30"),
];

const klassad = klassa(VECKAN, {}, TYPER);
const namnPa = (id: string) => klassad.find((k) => k.google_event_id === id)?.tidstyp?.namn;

describe("klassificering", () => {
  it("sätter rätt tidstyp på alla elva händelser i den riktiga veckan", () => {
    expect(namnPa("m1")).toBe("Rutiner");            // "fokus"
    expect(namnPa("m2")).toBe("DT och sälj");        // "uppföljning"
    expect(namnPa("m3")).toBe("Coaching och kunder");// "onboarding"
    expect(namnPa("m4")).toBe("Coaching och kunder");
    expect(namnPa("m5")).toBe("Inlägg");             // "publicering" slår "kund"
    expect(namnPa("h1")).toBe("Egen tid");           // inget nyckelord, faller ut som egen tid
    expect(namnPa("h2")).toBe("Egen tid");           // "ledig"
    expect(namnPa("t1")).toBe("DT och sälj");        // "produktion"
    expect(namnPa("t2")).toBe("Rutiner");            // "kvitto"
    expect(namnPa("t3")).toBe("Inlägg");             // "content" slår "kund"
    expect(namnPa("f1")).toBe("Rutiner");
    // DoD-kravet är 8 av 10. Elva av elva.
    expect(klassad.filter((k) => k.tidstyp).length).toBe(11);
  });

  // Rotorsaken till längsta-träffen-vinner: "Kundcontent-batch" innehåller "kund".
  // Med första-träffen-vinner blev veckans batch ett kundmöte, och flaggan om saknad
  // batch hade utlösts i en vecka där batchen faktiskt låg där.
  it("längsta nyckelordet vinner över det första i sorteringen", () => {
    expect(klassificera({ google_event_id: "x", titel: "Kundcontent-batch" }, {}, TYPER)?.namn).toBe("Inlägg");
    expect(klassificera({ google_event_id: "x", titel: "Kund uppföljning" }, {}, TYPER)?.namn).toBe("DT och sälj");
  });

  it("manuell override slår alltid nyckelorden", () => {
    const med = klassa([h("m3", "Onboarding kund 1", "2026-08-03", "10:00", "11:00")], { m3: "t-egen" }, TYPER);
    expect(med[0].tidstyp?.namn).toBe("Egen tid");
  });

  it("okänd titel faller ut som Egen tid, aldrig som arbete", () => {
    expect(klassificera({ google_event_id: "x", titel: "Något helt annat" }, {}, TYPER)?.namn).toBe("Egen tid");
    expect(klassificera({ google_event_id: "x", titel: null }, {}, TYPER)?.namn).toBe("Egen tid");
  });

  it("en override som pekar på en borttagen tidstyp faller tillbaka, kastar aldrig", () => {
    expect(klassificera({ google_event_id: "x", titel: "Kvittojakt" }, { x: "finns-inte" }, TYPER)?.namn).toBe("Rutiner");
  });
});

describe("nyckeltal mot handräknad vecka", () => {
  const kt = nyckeltal(klassad);

  // Handräkningen, block för block:
  //   mån 0,5 + 0,5 + 1 + 1 + 2 = 5,0    tors 3 + 0,5 + 1,5 = 5,0    fre 0,5
  //   summa 10,5 timmar. Inget tidsatt block är Egen tid, alltså är allt arbetstid.
  it("bokade timmar är 10,5", () => expect(kt.bokadeTimmar).toBeCloseTo(10.5, 5));
  it("arbetstimmar är 10,5 eftersom inget tidsatt block är egen tid", () => expect(kt.arbetstimmar).toBeCloseTo(10.5, 5));
  it("white space bär 5,5 timmar (måndag 5,0 plus fredag 0,5)", () => expect(kt.timmarWhiteSpace).toBeCloseTo(5.5, 5));
  it("två möten, de båda onboardingarna", () => expect(kt.antalMoten).toBe(2));
  it("Lifestyle är 5,0 av 10,5, alltså 47,6 procent", () => expect(kt.lifestyle).toBeCloseTo((5 / 10.5) * 100, 5));

  it("arbetsdagar plus white space är hela arbetstiden", () => {
    const paArbetsdag = kt.arbetstimmar - kt.timmarWhiteSpace;
    expect(paArbetsdag + kt.timmarWhiteSpace).toBeCloseTo(kt.arbetstimmar, 5);
    expect(paArbetsdag).toBeCloseTo(5, 5);
  });

  it("heldagshändelser bidrar med noll timmar", () => {
    expect(timmar(VECKAN.find((x) => x.google_event_id === "h2")!)).toBe(0);
  });

  // En tom vecka har ingen efterlevnad att mäta. Noll procent vore en lögn, hundra också.
  it("vecka utan arbetstid ger null, aldrig 0 eller 100", () => {
    expect(nyckeltal(klassa([heldag("x", "Ledig", "2026-08-03", "2026-08-04")], {}, TYPER)).lifestyle).toBeNull();
    expect(nyckeltal([]).lifestyle).toBeNull();
  });

  it("en vecka helt på tisdag och torsdag ger 100 procent", () => {
    const bara = klassa([
      h("a", "Kundmöte", "2026-08-04", "09:00", "12:00"),
      h("b", "Produktion", "2026-08-06", "09:00", "12:00"),
    ], {}, TYPER);
    expect(nyckeltal(bara).lifestyle).toBeCloseTo(100, 5);
    expect(nyckeltal(bara).timmarWhiteSpace).toBe(0);
  });

  // Egen tid på en white space-dag är precis vad modellen VILL ha. Räknades den som
  // arbete skulle en välplanerad vecka se ut som ett brott mot modellen.
  it("egen tid på måndag drar inte ner Lifestyle", () => {
    const med = klassa([
      h("a", "Kundmöte", "2026-08-04", "09:00", "12:00"),
      h("b", "Träning", "2026-08-03", "09:00", "10:00"),
    ], {}, TYPER);
    expect(nyckeltal(med).lifestyle).toBeCloseTo(100, 5);
    expect(nyckeltal(med).timmarWhiteSpace).toBe(0);
    expect(nyckeltal(med).bokadeTimmar).toBeCloseTo(4, 5);
  });
});

describe("fördelningen", () => {
  const f = fordelning(klassad, TYPER);
  it("summerar till hundra procent", () => {
    expect(f.reduce((s, r) => s + r.procent, 0)).toBeCloseTo(100, 5);
  });
  it("räknar timmarna per typ", () => {
    const t = (namn: string) => f.find((r) => r.namn === namn)?.timmar || 0;
    expect(t("Rutiner")).toBeCloseTo(1.5, 5);       // 0,5 + 0,5 + 0,5
    expect(t("DT och sälj")).toBeCloseTo(3.5, 5);   // 0,5 + 3
    expect(t("Coaching och kunder")).toBeCloseTo(2, 5);
    expect(t("Inlägg")).toBeCloseTo(3.5, 5);        // 2 + 1,5
    expect(f.reduce((s, r) => s + r.timmar, 0)).toBeCloseTo(10.5, 5);
  });
  it("typer utan timmar listas inte", () => {
    expect(f.some((r) => r.namn === "Egen tid")).toBe(false); // bara heldagar, noll timmar
  });
});

describe("flaggorna", () => {
  it("utlöses för white space men inte för det som är i sin ordning", () => {
    const fl = flaggor(klassad, nyckeltal(klassad), true);
    const ids = fl.map((f) => f.id);
    expect(ids).toContain("white-space");
    expect(fl.find((f) => f.id === "white-space")!.text).toBe("5,5 timmar arbete ligger på white space-dagar denna vecka.");
    expect(ids).not.toContain("ingen-batch");      // batchen ligger där, två gånger
    expect(ids).not.toContain("ingen-egen-tid");   // "Ledig: Stockholm" räknas
    expect(ids.some((i) => i.startsWith("motestathet"))).toBe(false); // max två möten en dag
  });

  it("mer än fyra möten på en dag flaggas, exakt fyra gör det inte", () => {
    const fyra = klassa([1, 2, 3, 4].map((i) => h(`k${i}`, `Kundmöte ${i}`, "2026-08-04", `${String(i + 5).padStart(2, "0")}:00`, `${String(i + 5).padStart(2, "0")}:30`)), {}, TYPER);
    expect(flaggor(fyra, nyckeltal(fyra), false).some((f) => f.id.startsWith("motestathet"))).toBe(false);
    const fem = klassa([1, 2, 3, 4, 5].map((i) => h(`k${i}`, `Kundmöte ${i}`, "2026-08-04", `${String(i + 5).padStart(2, "0")}:00`, `${String(i + 5).padStart(2, "0")}:30`)), {}, TYPER);
    const fl = flaggor(fem, nyckeltal(fem), false);
    expect(fl.find((f) => f.id.startsWith("motestathet"))!.text).toBe("tisdag har 5 möten.");
  });

  it("vecka utan egen tid flaggas, men en tom vecka flaggas inte", () => {
    const utan = klassa([h("a", "Produktion", "2026-08-04", "09:00", "12:00")], {}, TYPER);
    expect(flaggor(utan, nyckeltal(utan), false).some((f) => f.id === "ingen-egen-tid")).toBe(true);
    expect(flaggor([], nyckeltal([]), false).length).toBe(0);
  });

  it("saknad batch flaggas bara när mallen säger att inlägg ska ut", () => {
    const utan = klassa([h("a", "Produktion", "2026-08-04", "09:00", "12:00")], {}, TYPER);
    expect(flaggor(utan, nyckeltal(utan), true).some((f) => f.id === "ingen-batch")).toBe(true);
    expect(flaggor(utan, nyckeltal(utan), false).some((f) => f.id === "ingen-batch")).toBe(false);
  });

  it("formuleringarna konstaterar, de tillrättavisar aldrig", () => {
    const alla = [...flaggor(klassad, nyckeltal(klassad), true)].map((f) => f.text.toLowerCase());
    for (const t of alla) {
      expect(t).not.toMatch(/\bdu (borde|måste|har brutit|glömde)\b|felaktig|dålig|misslyck/);
      expect(t).not.toContain("—");
    }
  });
});

describe("mallveckan", () => {
  const MALL: MallRad[] = [
    { id: "r1", titel: "Fokus idag", veckodag: 1, starttid: "08:00:00", sluttid: "08:30:00", tidstyp_id: "t-rutin", aktiv: true },
    { id: "r2", titel: "Kundmöten och säljsamtal", veckodag: 2, starttid: "09:00:00", sluttid: "12:00:00", tidstyp_id: "t-coach", aktiv: true },
    { id: "r3", titel: "Produktion", veckodag: 4, starttid: "09:00:00", sluttid: "12:00:00", tidstyp_id: "t-dt", aktiv: true },
    { id: "r4", titel: "Avstängd rad", veckodag: 3, starttid: "09:00:00", sluttid: "10:00:00", tidstyp_id: null, aktiv: false },
    { id: "r5", titel: "Säljsamtal", veckodag: 1, starttid: "10:00:00", sluttid: "11:00:00", tidstyp_id: "t-dt", aktiv: true },
  ];
  const vecka = veckoSpann("2026-08-05");
  const forslag = mallForslag(MALL, klassad, vecka);

  it("hoppar över avstängda rader", () => {
    expect(forslag.map((f) => f.mallId).sort()).toEqual(["r1", "r2", "r3", "r5"]);
  });

  it("lägger raderna på rätt datum i veckan", () => {
    expect(forslag.find((f) => f.mallId === "r1")!.datum).toBe("2026-08-03"); // måndag
    expect(forslag.find((f) => f.mallId === "r3")!.datum).toBe("2026-08-06"); // torsdag
  });

  // Utan den här kontrollen fylls veckan med dubbletter varje gång knappen trycks.
  it("ser att Fokus idag redan ligger där och skapar den inte igen", () => {
    expect(forslag.find((f) => f.mallId === "r1")!.finnsRedan).toBe(true);
  });

  // Mallraden "Produktion" ÄR hans "Maskindag: produktion" torsdag 09 till 12. Skulle
  // den skapas igen fick han två identiska block. Titeln är sällan ordagrant mallens.
  it("känner igen mallposten även när kalendern har ett längre namn på den", () => {
    expect(forslag.find((f) => f.mallId === "r3")!.finnsRedan).toBe(true);
  });

  it("visar krockar innan något skapas", () => {
    const p = forslag.find((f) => f.mallId === "r5")!; // Säljsamtal måndag 10 till 11
    expect(p.finnsRedan).toBe(false);                  // helt annan sak än onboardingen
    expect(p.krockar).toContain("Onboarding kund 1 (MySales Pro)");
  });

  it("en rad utan krock och utan dubblett är ren", () => {
    const p = forslag.find((f) => f.mallId === "r2")!;
    expect(p.finnsRedan).toBe(false);
    expect(p.krockar).toEqual([]);
  });
});

describe("tid och vecka", () => {
  it("veckan går måndag till söndag", () => {
    expect(veckoSpann("2026-08-05").start).toBe("2026-08-03");
    expect(veckoSpann("2026-08-05").slut).toBe("2026-08-09");
    expect(veckoSpann("2026-08-09").start).toBe("2026-08-03"); // söndag hör till sin egen vecka
    expect(veckoSpann("2026-08-03").dagar.length).toBe(7);
  });

  // Två veckoräkningar i samma produkt får aldrig glida isär. HQ:s morgonlista och
  // planeringsvyn ska alltid tala om samma vecka.
  it("stämmer med veckoräkningen i /api/hq", () => {
    for (const d of ["2026-08-03", "2026-08-05", "2026-08-09", "2026-01-01", "2026-12-31", "2027-03-28"]) {
      const min = veckoSpann(d);
      const deras = veckansSpann(new Date(`${d}T12:00:00Z`));
      expect({ start: min.start, slut: min.slut }).toEqual(deras);
    }
  });

  it("veckodag räknas ISO, måndag är 1", () => {
    expect(veckodag("2026-08-03")).toBe(1);
    expect(veckodag("2026-08-09")).toBe(7);
  });

  it("klockslag läses i svensk tid, inte i UTC", () => {
    // 06:00 UTC är 08:00 i Sverige på sommaren.
    expect(svenskMinut("2026-08-03T06:00:00.000Z")).toBe(8 * 60);
    expect(svensktDatum("2026-08-03T22:30:00.000Z")).toBe("2026-08-04");
  });

  it("svenskTidpunkt träffar rätt både sommar och vinter", () => {
    expect(svenskTidpunkt("2026-08-03", "08:00").toISOString()).toBe("2026-08-03T06:00:00.000Z"); // +02:00
    expect(svenskTidpunkt("2026-01-15", "08:00").toISOString()).toBe("2026-01-15T07:00:00.000Z"); // +01:00
  });
});
