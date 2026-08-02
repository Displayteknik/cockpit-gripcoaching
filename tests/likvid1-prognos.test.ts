import { describe, it, expect } from "vitest";
import {
  byggPrognos,
  isoVecka,
  mandagen,
  pipelineSummor,
  standardSannolikhet,
  type AffarFinans,
} from "@/lib/hq/likviditet";

// LIKVID-1 — prognoslogiken. Alla tester matar in ett fast "idag", aldrig klockan:
// ett test som beter sig olika på tisdag och söndag bevisar ingenting.

describe("veckor och veckonummer", () => {
  it("måndagen i veckan hittas oavsett vilken dag man frågar om", () => {
    expect(mandagen("2026-08-05")).toBe("2026-08-03"); // onsdag
    expect(mandagen("2026-08-03")).toBe("2026-08-03"); // måndag
    expect(mandagen("2026-08-09")).toBe("2026-08-03"); // söndag hör till veckan som började i måndags
  });

  it("veckonumret är det som står i en svensk kalender", () => {
    expect(isoVecka("2026-01-01")).toBe(1);
    expect(isoVecka("2026-08-03")).toBe(32);
    expect(isoVecka("2026-08-10")).toBe(33);
    expect(isoVecka("2026-12-28")).toBe(53);
  });
});

describe("standardSannolikhet", () => {
  // Sju steg i spel i Kund pipeline DT ger stegen 13, 25, 38, 50, 63, 75 och 88.
  it("stiger jämnt genom pipelinen", () => {
    expect(standardSannolikhet(0, 7)).toBe(13);
    expect(standardSannolikhet(3, 7)).toBe(50);
    expect(standardSannolikhet(6, 7)).toBe(88);
  });

  it("når aldrig 100, det är vinststegets plats", () => {
    for (let n = 1; n <= 12; n++) expect(standardSannolikhet(n - 1, n)).toBeLessThan(100);
  });
});

describe("pipelineSummor: en delbetald affär blandas inte in i i spel", () => {
  const affarer: AffarFinans[] = [
    // Delbetald: 100 000 kr, 40 000 fakturerat varav 15 000 betalt.
    {
      id: "A",
      varde: 100000,
      fakturerat: 40000,
      betalt: 15000,
      forvantat_betaldatum: "2026-08-12",
      forfallodatum: "2026-08-31",
      harledd_status: "open",
      sannolikhet: 50,
    },
    // Vunnen och helt betald.
    {
      id: "B",
      varde: 200000,
      fakturerat: 200000,
      betalt: 200000,
      forvantat_betaldatum: "2026-07-01",
      forfallodatum: "2026-07-15",
      harledd_status: "won",
      sannolikhet: 100,
    },
    // Förlorad men fakturan är skickad och obetald. Fordran finns kvar.
    {
      id: "C",
      varde: 50000,
      fakturerat: 50000,
      betalt: 0,
      forvantat_betaldatum: null,
      forfallodatum: "2026-07-01",
      harledd_status: "lost",
      sannolikhet: 0,
    },
  ];
  const s = pipelineSummor(affarer, "2026-08-05");

  it("i spel räknar bara det ofakturerade, viktat på steget", () => {
    // (100 000 minus 40 000) gånger 50 procent = 30 000
    expect(s.iSpelOfakturerat).toBe(30000);
    expect(s.antalISpel).toBe(1);
  });

  it("fakturerat och obetalt är oviktat och gäller alla affärer", () => {
    // 25 000 från den delbetalda plus 50 000 från den förlorade
    expect(s.fakturreratObetalt).toBe(75000);
    expect(s.antalFakturerade).toBe(2);
  });

  it("betalt summeras för alla affärer", () => {
    expect(s.betalt).toBe(215000);
  });

  it("äldsta förfallodatum syns och passerade fakturor räknas", () => {
    expect(s.aldstaForfallodatum).toBe("2026-07-01");
    expect(s.antalForfallna).toBe(1);
  });

  it("en helt betald affär lämnar inget kvar i fakturerat obetalt", () => {
    const bara = pipelineSummor([affarer[1]], "2026-08-05");
    expect(bara.fakturreratObetalt).toBe(0);
    expect(bara.aldstaForfallodatum).toBeNull();
  });
});

// ── Handräknat fyraveckorsexempel ──────────────────────────────────────────
// Redovisas i rapporten. Varje siffra nedan går att räkna för hand.
//
// Start: 100 000 kr, avläst 2026-07-31. Idag är onsdag 2026-08-05.
// Veckorna blir 32 (3 aug), 33 (10 aug), 34 (17 aug) och 35 (24 aug).
//
// v32: månadsintäkt 20 000 in, fasta kostnader 30 000 ut. Den 1 augusti ligger före
//      fönstret men EFTER saldodatumet, alltså har pengarna rört sig sedan avläsningen
//      och hamnar i första veckan.  100 000 + 20 000 - 30 000 =  90 000
// v33: affär A, 100 000 kr, inget betalt, förväntat 12 aug, i spel med 50 procent.
//      90 000 + 50 000 = 140 000
// v34: affär B, 200 000 kr varav 50 000 betalt, förväntat 20 aug, i vinststeget.
//      Kvar 150 000 räknas till 100 procent.  140 000 + 150 000 = 290 000
// v35: momsinbetalning 120 000 ut den 26 aug.  290 000 - 120 000 = 170 000
//
// Affär C (80 000 kr) saknar förväntat betaldatum och räknas INTE in.
// Affär D är förlorad och räknas inte alls.
// Posten den 15 september ligger utanför fyraveckorsfönstret.
//
// Lägsta läge: 90 000 kr, vecka 32. Buffertmålet är 100 000 kr, alltså gult läge.
describe("byggPrognos: handräknat fyraveckorsexempel", () => {
  const p = byggPrognos({
    bolag: "dt",
    idag: "2026-08-05",
    startSaldo: 100000,
    saldoDatum: "2026-07-31",
    antalVeckor: 4,
    mrrPerManad: 20000,
    fastaSek: 30000,
    buffertmal: 100000,
    gulGransVeckor: 4,
    affarer: [
      { id: "A", varde: 100000, fakturerat: 0, betalt: 0, forvantat_betaldatum: "2026-08-12", forfallodatum: null, harledd_status: "open", sannolikhet: 50 },
      { id: "B", varde: 200000, fakturerat: 200000, betalt: 50000, forvantat_betaldatum: "2026-08-20", forfallodatum: null, harledd_status: "won", sannolikhet: 100 },
      { id: "C", varde: 80000, fakturerat: 0, betalt: 0, forvantat_betaldatum: null, forfallodatum: null, harledd_status: "open", sannolikhet: 50 },
      { id: "D", varde: 60000, fakturerat: 0, betalt: 0, forvantat_betaldatum: "2026-08-25", forfallodatum: null, harledd_status: "lost", sannolikhet: 0 },
    ],
    poster: [
      { id: "m1", titel: "Moms", belopp: -120000, datum: "2026-08-26" },
      { id: "m2", titel: "Kundinbetalning utanför fönstret", belopp: 10000, datum: "2026-09-15" },
    ],
  });

  it("veckorna är fyra, börjar på måndag och bär rätt veckonummer", () => {
    expect(p.veckor.map((v) => v.veckonummer)).toEqual([32, 33, 34, 35]);
    expect(p.veckor.map((v) => v.start)).toEqual(["2026-08-03", "2026-08-10", "2026-08-17", "2026-08-24"]);
  });

  it("utgående saldo stämmer vecka för vecka", () => {
    expect(p.veckor.map((v) => v.utgaende)).toEqual([90000, 140000, 290000, 170000]);
  });

  it("in och ut ligger på rätt vecka", () => {
    expect(p.veckor[0].in).toBe(20000);
    expect(p.veckor[0].ut).toBe(30000);
    expect(p.veckor[1].in).toBe(50000);
    expect(p.veckor[2].in).toBe(150000);
    expect(p.veckor[3].ut).toBe(120000);
  });

  it("lägsta punkten pekas ut i klartext", () => {
    expect(p.lagsta).toEqual({ belopp: 90000, veckonummer: 32, start: "2026-08-03" });
    // sv-SE skiljer tusental med hårt blanksteg, normaliseras innan jämförelsen.
    expect(p.klartext.replace(/ /g, " ")).toBe("Likviditet Displayteknik: gult läge vecka 32, lägsta 90 000 kr");
  });

  it("trafikljuset är gult när saldot går under buffertmålet men aldrig under noll", () => {
    expect(p.trafikljus).toBe("gul");
    expect(p.brytVecka?.veckonummer).toBe(32);
  });

  it("affären utan förväntat betaldatum står utanför prognosen", () => {
    expect(p.ejDaterade).toEqual({ summa: 80000, antal: 1 });
  });

  it("en förlorad affär betalar ingenting", () => {
    const summa = p.veckor.reduce((s, v) => s + v.in, 0);
    expect(summa).toBe(20000 + 50000 + 150000); // affär D:s 60 000 finns inte med
  });
});

describe("byggPrognos: trafikljus och gränser", () => {
  const bas = {
    bolag: "dt" as const,
    idag: "2026-08-05",
    saldoDatum: "2026-08-04",
    antalVeckor: 12,
    mrrPerManad: 0,
    fastaSek: 0,
    affarer: [],
    poster: [],
    buffertmal: 50000,
    gulGransVeckor: 4,
  };

  it("grönt när saldot ligger över buffertmålet hela perioden", () => {
    expect(byggPrognos({ ...bas, startSaldo: 200000 }).trafikljus).toBe("gron");
  });

  it("rött så fort saldot går under noll någon vecka, även sent i perioden", () => {
    const p = byggPrognos({
      ...bas,
      startSaldo: 200000,
      poster: [{ id: "x", titel: "Stor betalning", belopp: -250000, datum: "2026-10-12" }],
    });
    expect(p.trafikljus).toBe("rod");
    expect(p.brytVecka?.veckonummer).toBe(isoVecka("2026-10-12"));
  });

  it("rött väger tyngre än gult", () => {
    const p = byggPrognos({
      ...bas,
      startSaldo: 40000,
      poster: [{ id: "x", titel: "Stor betalning", belopp: -100000, datum: "2026-09-14" }],
    });
    expect(p.trafikljus).toBe("rod");
  });

  it("ett buffertbrott efter larmgränsen ger grönt med en notering, inte gult", () => {
    const p = byggPrognos({
      ...bas,
      startSaldo: 60000,
      gulGransVeckor: 4,
      poster: [{ id: "x", titel: "Betalning", belopp: -20000, datum: "2026-10-05" }],
    });
    expect(p.trafikljus).toBe("gron");
    expect(p.senareVarning?.veckonummer).toBe(isoVecka("2026-10-05"));
  });

  it("utan banksaldo räknas ingen prognos och inget larm går", () => {
    const p = byggPrognos({ ...bas, startSaldo: null, saldoDatum: null });
    expect(p.saknarSaldo).toBe(true);
    expect(p.trafikljus).toBe("okand");
    expect(p.klartext).toContain("inget banksaldo inlagt");
  });
});

describe("byggPrognos: dubbelräkning mot banksaldot", () => {
  const bas = {
    bolag: "grip" as const,
    idag: "2026-08-05",
    antalVeckor: 12,
    startSaldo: 100000,
    affarer: [],
    mrrPerManad: 0,
    fastaSek: 0,
    buffertmal: 0,
    gulGransVeckor: 4,
  };

  it("en post som ligger före banksaldots datum räknas inte en gång till", () => {
    const p = byggPrognos({
      ...bas,
      saldoDatum: "2026-08-04",
      poster: [{ id: "x", titel: "Redan betald", belopp: -25000, datum: "2026-08-01" }],
    });
    expect(p.veckor[0].ut).toBe(0);
    expect(p.veckor[0].utgaende).toBe(100000);
  });

  it("en post efter banksaldots datum men före veckans början hamnar i första veckan", () => {
    const p = byggPrognos({
      ...bas,
      saldoDatum: "2026-07-28",
      poster: [{ id: "x", titel: "Betald efter avläsningen", belopp: -25000, datum: "2026-08-01" }],
    });
    expect(p.veckor[0].ut).toBe(25000);
    expect(p.veckor[0].utgaende).toBe(75000);
  });

  it("månadsposter läggs på månadens första vecka, en gång per månad", () => {
    const p = byggPrognos({
      ...bas,
      saldoDatum: "2026-07-28",
      mrrPerManad: 15000,
      fastaSek: 5000,
      poster: [],
    });
    // Augusti hamnar i vecka 0 (den 1 augusti ligger efter avläsningen), september och
    // oktober på sina respektive första veckor. Tolv veckor från 3 augusti når 25 oktober.
    const veckorMedIn = p.veckor.filter((v) => v.in > 0);
    expect(veckorMedIn.map((v) => v.in)).toEqual([15000, 15000, 15000]);
    expect(veckorMedIn.map((v) => v.start)).toEqual(["2026-08-03", "2026-08-31", "2026-09-28"]);
  });
});

describe("byggPrognos: viktningen", () => {
  it("vinststeget räknas till 100 procent även om sannolikheten säger något annat", () => {
    const p = byggPrognos({
      bolag: "dt",
      idag: "2026-08-05",
      startSaldo: 0,
      saldoDatum: "2026-08-04",
      antalVeckor: 4,
      mrrPerManad: 0,
      fastaSek: 0,
      buffertmal: 0,
      gulGransVeckor: 4,
      poster: [],
      affarer: [
        { id: "A", varde: 100000, fakturerat: 0, betalt: 0, forvantat_betaldatum: "2026-08-12", forfallodatum: null, harledd_status: "won", sannolikhet: 13 },
      ],
    });
    expect(p.veckor[1].in).toBe(100000);
  });

  it("det som redan är betalt räknas inte in som en kommande inbetalning", () => {
    const p = byggPrognos({
      bolag: "dt",
      idag: "2026-08-05",
      startSaldo: 0,
      saldoDatum: "2026-08-04",
      antalVeckor: 4,
      mrrPerManad: 0,
      fastaSek: 0,
      buffertmal: 0,
      gulGransVeckor: 4,
      poster: [],
      affarer: [
        { id: "A", varde: 100000, fakturerat: 100000, betalt: 100000, forvantat_betaldatum: "2026-08-12", forfallodatum: null, harledd_status: "won", sannolikhet: 100 },
      ],
    });
    expect(p.veckor[1].in).toBe(0);
    expect(p.ejDaterade.summa).toBe(0);
  });
});
