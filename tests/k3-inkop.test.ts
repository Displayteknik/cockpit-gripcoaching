// K3-INKÖP — enhetstester på prognos-, larm- och rekommendationslogiken.
//
// Allt datum injiceras. Inget test läser klockan, så sviten beter sig likadant på
// tisdag som på söndag och i januari som i augusti.

import { describe, expect, it } from "vitest";
import {
  TROSKLAR_STANDARD,
  avrundaUppat,
  avrundaUppatJamnt,
  bedomLarm,
  byggRekommendation,
  dagarKvar,
  dagarMellan,
  laggTillDagar,
  larmtext,
  prognosManad,
  raknaMarginal,
  raknaTakt,
  summeraMarginal,
  type Dagskostnad,
} from "@/lib/inkop/berakning";

const IDAG = "2026-08-02";

/** Jämn förbrukning: `kr` kronor per dag de senaste `dagar` dagarna fram till IDAG. */
function jamn(kr: number, dagar: number, till = IDAG): Dagskostnad[] {
  return Array.from({ length: dagar }, (_, i) => ({ dag: laggTillDagar(till, -i), kostnadSek: kr }));
}

describe("datumhjälpare", () => {
  it("räknar dagar mellan två datum", () => {
    expect(dagarMellan("2026-08-01", "2026-08-02")).toBe(1);
    expect(dagarMellan("2026-07-31", "2026-08-02")).toBe(2);
    expect(dagarMellan("2026-08-02", "2026-08-01")).toBe(0);
  });

  it("lägger till dagar över månadsskifte", () => {
    expect(laggTillDagar("2026-07-30", 5)).toBe("2026-08-04");
    expect(laggTillDagar("2026-08-02", -7)).toBe("2026-07-26");
  });
});

describe("raknaTakt", () => {
  it("räknar snitt per dag över sjudagarsfönstret", () => {
    const t = raknaTakt(jamn(10, 30), IDAG, 7, "2026-06-01");
    expect(t.summa).toBe(70);
    expect(t.snittPerDag).toBe(10);
    expect(t.namnare).toBe(7);
    expect(t.tunt).toBe(false);
  });

  it("räknar snitt per dag över trettiodagarsfönstret", () => {
    const t = raknaTakt(jamn(10, 30), IDAG, 30, "2026-06-01");
    expect(t.summa).toBe(300);
    expect(t.snittPerDag).toBe(10);
  });

  it("kortar nämnaren till den faktiska mätperioden", () => {
    // Mätningen startade för fem dagar sedan. 100 kr på fem dagar är 20 kr per dag,
    // inte 3,33 kr som det blivit om summan delats på trettio.
    const rader = jamn(20, 5);
    const t = raknaTakt(rader, IDAG, 30, laggTillDagar(IDAG, -4));
    expect(t.summa).toBe(100);
    expect(t.namnare).toBe(5);
    expect(t.snittPerDag).toBe(20);
  });

  it("flaggar tunt underlag när mätningen är yngre än tre dagar", () => {
    const t = raknaTakt(jamn(20, 2), IDAG, 30, laggTillDagar(IDAG, -1));
    expect(t.tunt).toBe(true);
  });

  it("flaggar tunt underlag när ingenting förbrukats", () => {
    expect(raknaTakt([], IDAG, 7, null).tunt).toBe(true);
    expect(raknaTakt([], IDAG, 7, null).snittPerDag).toBe(0);
  });

  it("räknar aldrig med dagar utanför fönstret", () => {
    const rader: Dagskostnad[] = [
      { dag: IDAG, kostnadSek: 5 },
      { dag: laggTillDagar(IDAG, -8), kostnadSek: 1000 },
      { dag: laggTillDagar(IDAG, 3), kostnadSek: 999 },
    ];
    expect(raknaTakt(rader, IDAG, 7, "2026-06-01").summa).toBe(5);
  });
});

describe("dagarKvar", () => {
  it("delar saldot på sjudagarssnittet", () => {
    expect(dagarKvar(100, 10)).toBe(10);
  });

  it("svarar null utan uppmätt förbrukning i stället för att gissa", () => {
    expect(dagarKvar(100, 0)).toBeNull();
  });

  it("svarar null utan inlagt saldo", () => {
    expect(dagarKvar(null, 10)).toBeNull();
  });
});

describe("prognosManad", () => {
  it("multiplicerar trettiodagarssnittet med trettio", () => {
    expect(prognosManad(12.5)).toBe(375);
  });
});

describe("bedomLarm — förbetalt", () => {
  const bas = {
    typ: "forbetalt" as const,
    prognosSek: 0,
    forraFakturanSek: null,
    billingfelSenasteDygnet: false,
    trosklar: TROSKLAR_STANDARD,
  };

  it("är grönt över fjorton dagar", () => {
    expect(bedomLarm({ ...bas, dagarKvar: 20 }).niva).toBe("gron");
  });

  it("är gult strax under fjorton dagar", () => {
    const b = bedomLarm({ ...bas, dagarKvar: 13.9 });
    expect(b.niva).toBe("gul");
    expect(b.orsak).toContain("13 dagar");
  });

  it("är exakt fjorton dagar fortfarande grönt", () => {
    expect(bedomLarm({ ...bas, dagarKvar: 14 }).niva).toBe("gron");
  });

  it("är rött under fem dagar", () => {
    expect(bedomLarm({ ...bas, dagarKvar: 4.9 }).niva).toBe("rod");
  });

  it("skriver dag i ental när det är en dag kvar", () => {
    expect(bedomLarm({ ...bas, dagarKvar: 1.2 }).orsak).toContain("1 dag till");
  });

  it("larmar inte när dagar kvar inte går att räkna", () => {
    expect(bedomLarm({ ...bas, dagarKvar: null }).niva).toBe("gron");
  });

  it("följer sänkta trösklar", () => {
    const trosklar = { gulDagar: 1000, rodDagar: 5, gulPrognosProcent: 150 };
    expect(bedomLarm({ ...bas, dagarKvar: 400, trosklar }).niva).toBe("gul");
  });
});

describe("bedomLarm — efterskott", () => {
  const bas = {
    typ: "efterskott" as const,
    dagarKvar: null,
    billingfelSenasteDygnet: false,
    trosklar: TROSKLAR_STANDARD,
  };

  it("är gult när prognosen överstiger 150 procent av förra fakturan", () => {
    const b = bedomLarm({ ...bas, prognosSek: 1600, forraFakturanSek: 1000 });
    expect(b.niva).toBe("gul");
    expect(b.orsak).toContain("160 procent");
  });

  it("är grönt vid exakt 150 procent", () => {
    expect(bedomLarm({ ...bas, prognosSek: 1500, forraFakturanSek: 1000 }).niva).toBe("gron");
  });

  it("larmar inte när förra fakturan saknas", () => {
    expect(bedomLarm({ ...bas, prognosSek: 999999, forraFakturanSek: null }).niva).toBe("gron");
  });
});

describe("bedomLarm — billing-fel", () => {
  it("ett betalningsfel senaste dygnet är alltid rött, oavsett saldo", () => {
    const b = bedomLarm({
      typ: "forbetalt",
      dagarKvar: 900,
      prognosSek: 0,
      forraFakturanSek: null,
      billingfelSenasteDygnet: true,
      trosklar: TROSKLAR_STANDARD,
    });
    expect(b.niva).toBe("rod");
    expect(b.orsak).toContain("betalningsfel");
  });

  it("gäller även efterskottskonton", () => {
    expect(
      bedomLarm({
        typ: "efterskott",
        dagarKvar: null,
        prognosSek: 1,
        forraFakturanSek: 100000,
        billingfelSenasteDygnet: true,
        trosklar: TROSKLAR_STANDARD,
      }).niva,
    ).toBe("rod");
  });
});

describe("avrundning", () => {
  it("avrundar uppåt till providerns steg när det är känt", () => {
    expect(avrundaUppat(112, 25)).toBe(125);
    expect(avrundaUppat(100, 25)).toBe(100);
  });

  it("avrundar till jämnt belopp när steget är okänt", () => {
    expect(avrundaUppatJamnt(12)).toBe(20);
    expect(avrundaUppatJamnt(112)).toBe(150);
    expect(avrundaUppatJamnt(1120)).toBe(1500);
    expect(avrundaUppatJamnt(11200)).toBe(12000);
    expect(avrundaUppatJamnt(0)).toBe(0);
  });
});

describe("byggRekommendation", () => {
  it("räknar 45 dagars förbrukning och växlar till kontots valuta", () => {
    // 10 kr per dag i 45 dagar är 450 kr. Med kursen 10,5 blir det 42,86 USD,
    // avrundat uppåt till 50 USD.
    const r = byggRekommendation({
      etikett: "Fal.ai",
      snitt30PerDag: 10,
      dagarKvar: 12,
      valuta: "USD",
      kurs: 10.5,
      pafyllningssteg: null,
      idag: IDAG,
      rodDagar: 5,
    });
    expect(r.beloppSek).toBe(450);
    expect(r.belopp).toBe(50);
    expect(r.valuta).toBe("USD");
  });

  it("sätter sista dagen vid rödgränsen, inte när saldot är slut", () => {
    const r = byggRekommendation({
      etikett: "Fal.ai",
      snitt30PerDag: 10,
      dagarKvar: 12,
      valuta: "USD",
      kurs: 10.5,
      pafyllningssteg: null,
      idag: IDAG,
      rodDagar: 5,
    });
    expect(r.senast).toBe("2026-08-09"); // 2 aug + (12 - 5) dagar
  });

  it("sätter sista dagen till idag när rödgränsen redan är passerad", () => {
    const r = byggRekommendation({
      etikett: "Fal.ai",
      snitt30PerDag: 10,
      dagarKvar: 2,
      valuta: "USD",
      kurs: 10.5,
      pafyllningssteg: null,
      idag: IDAG,
      rodDagar: 5,
    });
    expect(r.senast).toBe(IDAG);
  });

  it("utelämnar datumet när dagar kvar inte går att räkna", () => {
    const r = byggRekommendation({
      etikett: "46elks (SMS)",
      snitt30PerDag: 2,
      dagarKvar: null,
      valuta: "SEK",
      kurs: 1,
      pafyllningssteg: null,
      idag: IDAG,
      rodDagar: 5,
    });
    expect(r.senast).toBeNull();
    // 2 kr per dag i 45 dagar är 90 kr, redan ett jämnt tiotal.
    expect(r.klartext).toBe("Fyll på 46elks (SMS) med ca 90 SEK.");
  });

  it("använder providerns påfyllningssteg när det är känt", () => {
    const r = byggRekommendation({
      etikett: "Fal.ai",
      snitt30PerDag: 10,
      dagarKvar: 8,
      valuta: "USD",
      kurs: 10.5,
      pafyllningssteg: 25,
      idag: IDAG,
      rodDagar: 5,
    });
    expect(r.belopp).toBe(50); // 42,86 upp till närmaste 25
  });

  it("skriver en mening som går att läsa rakt av", () => {
    const r = byggRekommendation({
      etikett: "Fal.ai",
      snitt30PerDag: 20,
      dagarKvar: 10,
      valuta: "USD",
      kurs: 10.5,
      pafyllningssteg: null,
      idag: IDAG,
      rodDagar: 5,
    });
    // 20 kr per dag i 45 dagar är 900 kr, med kursen 10,5 blir det 85,71 USD, uppåt till 90.
    expect(r.klartext).toBe("Fyll på Fal.ai med ca 90 USD före 2026-08-07.");
  });

  it("innehåller inga tankstreck", () => {
    const r = byggRekommendation({
      etikett: "Fal.ai",
      snitt30PerDag: 20,
      dagarKvar: 10,
      valuta: "USD",
      kurs: 10.5,
      pafyllningssteg: null,
      idag: IDAG,
      rodDagar: 5,
    });
    expect(r.klartext).not.toMatch(/[–—]/);
  });
});

describe("larmtext", () => {
  it("sätter ihop orsak och rekommendation utan tankstreck", () => {
    const t = larmtext("Fal.ai", { niva: "gul", orsak: "saldot räcker 9 dagar till" }, "Fyll på Fal.ai med ca 100 USD före 2026-08-07.");
    expect(t).toBe("Fal.ai: saldot räcker 9 dagar till. Fyll på Fal.ai med ca 100 USD före 2026-08-07.");
    expect(t).not.toMatch(/[–—]/);
  });

  it("klarar sig utan rekommendation", () => {
    expect(larmtext("Resend (mejl)", { niva: "gul", orsak: "månaden ser ut att landa på 200 procent av förra fakturan" }, null))
      .toBe("Resend (mejl): månaden ser ut att landa på 200 procent av förra fakturan.");
  });
});

describe("raknaMarginal", () => {
  it("räknar intäkt minus AI-kostnad i kronor och procent", () => {
    const [r] = raknaMarginal([
      { tenantId: "t1", namn: "Displayteknik", abonnemangSek: 2000, topupSek: 149, aiKostnadSek: 349 },
    ]);
    expect(r.intaktSek).toBe(2149);
    expect(r.marginalSek).toBe(1800);
    expect(r.marginalProcent).toBeCloseTo(83.76, 1);
    expect(r.prisSaknas).toBe(false);
  });

  it("ger ALDRIG en falsk nolla när priset saknas", () => {
    const [r] = raknaMarginal([
      { tenantId: "t2", namn: "Utan pris", abonnemangSek: null, topupSek: 0, aiKostnadSek: 42 },
    ]);
    expect(r.prisSaknas).toBe(true);
    expect(r.marginalSek).toBeNull();
    expect(r.marginalProcent).toBeNull();
    expect(r.intaktSek).toBeNull();
  });

  it("visar negativ marginal när kostnaden överstiger intäkten", () => {
    const [r] = raknaMarginal([
      { tenantId: "t3", namn: "Dyr kund", abonnemangSek: 100, topupSek: 0, aiKostnadSek: 250 },
    ]);
    expect(r.marginalSek).toBe(-150);
    expect(r.marginalProcent).toBe(-150);
  });
});

describe("summeraMarginal", () => {
  it("summerar bara kunder med ifyllt pris och räknar resten separat", () => {
    const rader = raknaMarginal([
      { tenantId: "t1", namn: "A", abonnemangSek: 1000, topupSek: 0, aiKostnadSek: 100 },
      { tenantId: "t2", namn: "B", abonnemangSek: 2000, topupSek: 500, aiKostnadSek: 400 },
      { tenantId: "t3", namn: "C", abonnemangSek: null, topupSek: 0, aiKostnadSek: 900 },
    ]);
    const s = summeraMarginal(rader);
    expect(s.intaktSek).toBe(3500);
    expect(s.aiKostnadSek).toBe(500);
    expect(s.marginalSek).toBe(3000);
    expect(s.marginalProcent).toBeCloseTo(85.71, 1);
    expect(s.utanPris).toBe(1);
  });

  it("kostnaden hos en kund utan pris drar inte ner totalen tyst", () => {
    const rader = raknaMarginal([
      { tenantId: "t1", namn: "A", abonnemangSek: 1000, topupSek: 0, aiKostnadSek: 100 },
      { tenantId: "t3", namn: "C", abonnemangSek: null, topupSek: 0, aiKostnadSek: 5000 },
    ]);
    expect(summeraMarginal(rader).marginalSek).toBe(900);
  });
});
