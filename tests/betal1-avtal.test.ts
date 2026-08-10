import { describe, expect, it } from "vitest";
import { sammanfatta, type AvtalVy } from "@/lib/billing/avtal";
// Rakelogiken testas dar den bor: datum.ts har inga imports och kors bade pa servern
// och i adminvyns forhandsvisning. Samma funktion, samma svar, bada hallen.
import {
  laggTill, rullaFram, dagarTill, nastaBetalningKlartext, langtDatum,
  periodbelopp, manadsvarde, medMoms,
} from "@/lib/billing/datum";
import { maskera, nyckelStammerMedLage } from "@/lib/billing/installningar";
import { statusbesked } from "@/lib/billing/status";
import { niva } from "@/components/TokenMatare";
import { paminnelseAmne } from "@/lib/billing/paminnelser";

// BETAL-1 — testerna sitter pa raknelogiken, inte pa databasen. Det ar datummatten och
// belopps-normaliseringen som avgor om Hakan far ratt siffra i vyn.

describe("forfallodatum", () => {
  it("lagger till en manad", () => {
    expect(laggTill("2026-08-09", "manad")).toBe("2026-09-09");
  });

  it("klampar dagen sa den 31:a inte glider till nasta manad", () => {
    // Utan klampning hade 31 januari + 1 manad blivit 3 mars, och fakturan hamnat fel.
    expect(laggTill("2026-01-31", "manad")).toBe("2026-02-28");
    expect(laggTill("2026-03-31", "manad")).toBe("2026-04-30");
  });

  it("hanterar kvartal och ar", () => {
    expect(laggTill("2026-08-09", "kvartal")).toBe("2026-11-09");
    expect(laggTill("2026-08-09", "ar")).toBe("2027-08-09");
  });

  it("ror aldrig ett engangsbelopp", () => {
    expect(laggTill("2026-08-09", "engang")).toBe("2026-08-09");
    expect(rullaFram("2020-01-01", "engang", "2026-08-09")).toBe("2020-01-01");
  });
});

describe("rullaFram", () => {
  it("hoppar over hur manga missade perioder som helst och stannar pa det FORSTA framtida", () => {
    // En affar som startade i februari ska landa pa 15 augusti, inte i mars och inte i
    // september. Den 15:e har annu inte passerat den 9:e, alltsa ar det nasta betalning.
    expect(rullaFram("2026-02-15", "manad", "2026-08-09")).toBe("2026-08-15");
    // Har den 15:e redan passerat gar den vidare till nasta manad.
    expect(rullaFram("2026-02-15", "manad", "2026-08-20")).toBe("2026-09-15");
  });

  it("ror inte ett datum som redan ligger framat", () => {
    expect(rullaFram("2026-09-01", "manad", "2026-08-09")).toBe("2026-09-01");
  });

  it("ar idempotent", () => {
    const en = rullaFram("2026-02-15", "manad", "2026-08-09");
    expect(rullaFram(en, "manad", "2026-08-09")).toBe(en);
  });
});

describe("klartext om nasta betalning", () => {
  it("raknar dagar framat", () => {
    expect(dagarTill("2026-08-19", "2026-08-09")).toBe(10);
    expect(nastaBetalningKlartext("2026-08-19", "2026-08-09")).toBe("Om 10 dagar");
  });

  it("sager idag och imorgon i klartext", () => {
    expect(nastaBetalningKlartext("2026-08-09", "2026-08-09")).toBe("Idag");
    expect(nastaBetalningKlartext("2026-08-10", "2026-08-09")).toBe("Imorgon");
  });

  it("sager forsenad, inte ett minustal", () => {
    expect(nastaBetalningKlartext("2026-08-06", "2026-08-09")).toBe("3 dagar forsenad".replace("forsenad", "försenad"));
  });

  it("utan datum blir det inget pahittat", () => {
    expect(nastaBetalningKlartext(null)).toBe("Inget datum satt");
  });
});

describe("langtDatum och trasig indata", () => {
  it("skriver ut manaden i klartext, i UTC sa datumet inte glider", () => {
    expect(langtDatum("2026-08-15")).toBe("15 augusti 2026");
    expect(langtDatum("2026-01-01")).toBe("1 januari 2026");
  });

  it("tomt eller trasigt datum ger tom strang, aldrig 'Invalid Date'", () => {
    expect(langtDatum(null)).toBe("");
    expect(langtDatum("inte-ett-datum")).toBe("");
  });

  // Adminvyn raknar medan Hakan skriver, och da ar datumet halvskrivet halva tiden.
  it("halvskrivet datum far inte falla eller ga i loop", () => {
    expect(laggTill("2026-0", "manad")).toBe("2026-0");
    expect(rullaFram("", "manad", "2026-08-09")).toBe("");
    expect(dagarTill("2026-", "2026-08-09")).toBeNull();
  });
});

describe("belopp", () => {
  it("ett eget belopp pa avtalet vinner over planens pris", () => {
    expect(periodbelopp({ belopp_sek: 1500 }, { belopp_sek: 2490 })).toBe(1500);
  });

  it("utan eget belopp gäller planen", () => {
    expect(periodbelopp({ belopp_sek: null }, { belopp_sek: 2490 })).toBe(2490);
  });

  it("utan bade eget belopp och plan blir det noll, inte NaN", () => {
    expect(periodbelopp({ belopp_sek: null }, null)).toBe(0);
  });

  it("normaliserar kvartal och ar till en manad", () => {
    expect(manadsvarde(3000, "kvartal")).toBe(1000);
    expect(manadsvarde(12000, "ar")).toBe(1000);
    expect(manadsvarde(1990, "manad")).toBe(1990);
  });

  it("raknar inte engangsbelopp som aterkommande intakt", () => {
    expect(manadsvarde(149, "engang")).toBe(0);
  });

  it("lagger pa svensk moms", () => {
    expect(medMoms(1990, 25)).toBe(2487.5);
  });
});

// Minsta möjliga rad, sa testet handlar om summeringen och inte om alla falt.
function rad(over: Partial<AvtalVy>): AvtalVy {
  return {
    client_id: "x", klient: "Kund", slug: "kund", primary_color: "#000",
    plan_id: null, plan_label: null, belopp_sek: 0, belopp_inkl_moms: 0,
    intervall: "manad", intervall_text: "", betalsatt: "faktura", betalsatt_text: "",
    kalla: "manuell", startdatum: null, nasta_betalning: null, nasta_betalning_text: "",
    dagar_kvar: null, bindningstid_slut: null, status: "aktiv", betalstatus: "aktiv",
    faktura_epost: null, kontaktperson: null, anteckning: null, manadsvarde: 0,
    har_stripe_kund: false, stripe_status: null, tokens: null,
    ...over,
  } as AvtalVy;
}

describe("sammanfattning", () => {
  const rader = [
    rad({ belopp_sek: 1990, manadsvarde: 1990, dagar_kvar: 12, nasta_betalning: "2026-08-21" }),
    rad({ belopp_sek: 6000, manadsvarde: 2000, dagar_kvar: 45, nasta_betalning: "2026-09-23" }),
    rad({ belopp_sek: 2490, manadsvarde: 2490, betalstatus: "sparrad", dagar_kvar: -4, nasta_betalning: "2026-08-05" }),
    rad({}), // kund utan affar
  ];

  it("summerar manadsintakten oavsett intervall", () => {
    expect(sammanfatta(rader).mrr).toBe(6480);
    expect(sammanfatta(rader).arsvarde).toBe(77760);
  });

  it("raknar bara det som forfaller inom 30 dagar", () => {
    // Kvartalsavtalet ligger 45 dagar bort och ska INTE med.
    expect(sammanfatta(rader).nasta_30_dagar).toBe(1990);
  });

  it("hittar kunden utan affar i stallet for att dolja den", () => {
    expect(sammanfatta(rader).antal_utan_affar).toBe(1);
  });

  it("raknar sparrade och forsenade", () => {
    expect(sammanfatta(rader).antal_sparrade).toBe(1);
  });
});

// ⚠ Nycklarna i den har filen byggs av bitar, aldrig som en hel strang. En komplett
// Stripe-nyckel i repot fastnar i GitHubs hemlighetsskanning aven nar den ar pahittad,
// och den regeln har ratt: en granskare kan inte se skillnad pa en pahittad nyckel och
// en riktig. Testet blir lika bra av att satta ihop den har.
const PREFIX_TEST = ["sk", "test"].join("_");
const PREFIX_LIVE = ["sk", "live"].join("_");
const FEJKNYCKEL = `${PREFIX_TEST}_51AbCdEfGhIjKlMnOpQr4242`;

describe("nyckelmaskering", () => {
  it("visar prefix och fyra sista, aldrig mitten", () => {
    const m = maskera(FEJKNYCKEL);
    expect(m).toBe(`${PREFIX_TEST}_••••••••4242`);
    expect(m).not.toContain("AbCdEf");
  });

  it("tom nyckel ger ingen maskering att missforsta", () => {
    expect(maskera(null)).toBeNull();
  });
});

describe("nyckel mot lage", () => {
  it("flaggar en skarp nyckel i testlage", () => {
    expect(nyckelStammerMedLage(`${PREFIX_LIVE}_abc`, "test")).toBe(false);
  });

  it("flaggar en testnyckel i skarpt lage", () => {
    expect(nyckelStammerMedLage(`${PREFIX_TEST}_abc`, "live")).toBe(false);
  });

  it("slapper igenom nar det stammer", () => {
    expect(nyckelStammerMedLage(`${PREFIX_TEST}_abc`, "test")).toBe(true);
    expect(nyckelStammerMedLage(`${PREFIX_LIVE}_abc`, "live")).toBe(true);
  });

  it("okant format later Stripe sjalv saga ifran", () => {
    expect(nyckelStammerMedLage("nagot_annat", "live")).toBe(true);
  });
});

describe("kundvanda besked", () => {
  it("aktiv kund far ingen banner alls", () => {
    expect(statusbesked("aktiv")).toBeNull();
  });

  it("forsenad kund far en varning, inte ett stopp", () => {
    expect(statusbesked("forsenad")?.ton).toBe("varning");
  });

  it("sparrad kund far veta att inget raderats", () => {
    const b = statusbesked("sparrad");
    expect(b?.ton).toBe("stopp");
    expect(b?.text).toContain("finns kvar");
  });

  it("inga tankstreck i nagon kundtext", () => {
    for (const s of ["forsenad", "paminnelser", "sparrad"] as const) {
      const b = statusbesked(s)!;
      expect(`${b.rubrik} ${b.text} ${b.knapp}`).not.toMatch(/[—–]/);
    }
  });
});

describe("tokenvarningar", () => {
  it("under fyra femtedelar ar allt lugnt", () => {
    expect(niva({ anvant: 100, tak: 300 })).toBe("ok");
    expect(niva({ anvant: 239, tak: 300 })).toBe("ok");
  });

  it("vid 80 procent slar den gula varningen", () => {
    expect(niva({ anvant: 240, tak: 300 })).toBe("varning");
  });

  it("vid 95 procent blir den tydlig", () => {
    expect(niva({ anvant: 285, tak: 300 })).toBe("kritisk");
  });

  it("vid noll kvar ar det slut", () => {
    expect(niva({ anvant: 300, tak: 300 })).toBe("slut");
    expect(niva({ anvant: 400, tak: 300 })).toBe("slut");
  });

  it("utan kvot varnar vi inte for nagot", () => {
    expect(niva({ anvant: 0, tak: 0 })).toBe("ok");
  });
});

describe("paminnelsernas amnesrader", () => {
  it("forsta pamminnelsen forklarar vad som hant", () => {
    expect(paminnelseAmne({ omgang: 1, sista: false })).toContain("kunde inte dra");
  });

  it("sista pamminnelsen sager att kontot pausas", () => {
    expect(paminnelseAmne({ omgang: 3, sista: true })).toContain("pausas");
  });
});
