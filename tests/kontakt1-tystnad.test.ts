import { describe, it, expect } from "vitest";
import {
  harledBollen, dagarSedanKontakt, tystnadsniva, sortera, regelrader, adressUr,
  type Rad, type Regel,
} from "@/lib/hq/kontakt";

// KONTAKT-1 — reglerna bakom tystnadslistan.
// Kärnan: vem har bollen. En kund som väntar på svar går alltid före en gammal uppföljning.

const REGLER: Regel[] = [
  { id: "r1", regelnamn: "Kunden väntar på svar", villkor: "bollen_hos_oss", troskel_dagar: 1, steg_namn: null, aktiv: true, sortering: 10 },
  { id: "r2", regelnamn: "Offert utan kontakt", villkor: "steg_utan_kontakt", troskel_dagar: 7, steg_namn: "Offert skickad", aktiv: true, sortering: 20 },
  { id: "r3", regelnamn: "Affär på väg att rinna ut", villkor: "oppen_utan_kontakt", troskel_dagar: 21, steg_namn: null, aktiv: true, sortering: 30 },
];

const rad = (o: Partial<Rad> & { opportunity_id: string }): Rad => ({
  namn: "Affär", varde: 0, steg_namn: "Offert skickad", epost: "kund@exempel.se",
  dagar: 0, bollen: "kund", senasteAmne: null, matbar: true,
  ghl_contact_id: "c1", location_id: "loc1", ...o,
});

describe("bollen_hos", () => {
  // De tre testfallen ur beställningen.
  it("kunden svarade sist ger oss bollen", () => {
    expect(harledBollen("2026-07-24T10:00:00Z", "2026-07-20T10:00:00Z")).toBe("oss");
  });
  it("vi mejlade sist ger kunden bollen", () => {
    expect(harledBollen("2026-07-17T09:04:10Z", "2026-07-24T08:23:52Z")).toBe("kund");
  });
  it("ingen historik ger okänt", () => {
    expect(harledBollen(null, null)).toBe("okant");
  });

  it("bara inkommande ger oss bollen, bara utgående ger kunden", () => {
    expect(harledBollen("2026-07-24T10:00:00Z", null)).toBe("oss");
    expect(harledBollen(null, "2026-07-24T10:00:00Z")).toBe("kund");
  });

  // Kortändringar säger något om VÅR aktivitet, ingenting om vem som är skyldig ett svar.
  it("kortändringar påverkar aldrig vem som har bollen", () => {
    const a = harledBollen("2026-07-24T10:00:00Z", "2026-07-20T10:00:00Z");
    expect(a).toBe("oss");
    // Samma indata, oavsett hur färsk kortändringen är: funktionen tar inte ens emot den.
    expect(dagarSedanKontakt("2026-07-24T10:00:00Z", "2026-07-20T10:00:00Z", "2026-08-02T10:00:00Z", Date.parse("2026-08-02T12:00:00Z"))).toBe(0);
    expect(a).toBe("oss");
  });
});

describe("dagar sedan kontakt", () => {
  const nu = Date.parse("2026-08-02T12:00:00Z");

  // Stickprov ur Håkans riktiga Gmail: Louise Ribbing, in 17 juli, ut 24 juli.
  it("räknar från den senaste händelsen, inte den första", () => {
    expect(dagarSedanKontakt("2026-07-17T09:04:10Z", "2026-07-24T08:23:52Z", null, nu)).toBe(9);
  });

  // Ett loggat samtal ska nollställa tystnaden, annars ser varje telefonaffär tyst ut.
  it("kortändring räknas som kontakt", () => {
    expect(dagarSedanKontakt("2026-06-01T10:00:00Z", "2026-06-02T10:00:00Z", "2026-08-01T10:00:00Z", nu)).toBe(1);
  });

  it("utan mätpunkt är svaret null, inte noll", () => {
    expect(dagarSedanKontakt(null, null, null, nu)).toBeNull();
  });

  it("färgtrösklarna: under 7 neutral, 7 till 20 gul, över 20 röd", () => {
    expect(tystnadsniva(6)).toBe("neutral");
    expect(tystnadsniva(7)).toBe("gul");
    expect(tystnadsniva(20)).toBe("gul");
    expect(tystnadsniva(21)).toBe("rod");
    expect(tystnadsniva(null)).toBe("neutral");
  });
});

describe("sorteringen", () => {
  it("bollen hos oss ligger överst oavsett antal dagar", () => {
    const rader = [
      rad({ opportunity_id: "gammal", dagar: 90, bollen: "kund" }),
      rad({ opportunity_id: "fersk", dagar: 1, bollen: "oss" }),
      rad({ opportunity_id: "mellan", dagar: 30, bollen: "kund" }),
    ];
    // Ettdagarsaffären går före nittiodagarsaffären enbart för att bollen ligger hos oss.
    // Därefter sorteras resten fallande på dagar.
    expect(sortera(rader).map((r) => r.opportunity_id)).toEqual(["fersk", "gammal", "mellan"]);
  });

  it("omätbara kort hamnar sist", () => {
    const rader = [
      rad({ opportunity_id: "utan", dagar: null, bollen: "okant", matbar: false, epost: null }),
      rad({ opportunity_id: "med", dagar: 3, bollen: "kund" }),
    ];
    expect(sortera(rader).map((r) => r.opportunity_id)).toEqual(["med", "utan"]);
  });

  it("flera med bollen hos oss sorteras inbördes på dagar", () => {
    const rader = [
      rad({ opportunity_id: "a", dagar: 2, bollen: "oss" }),
      rad({ opportunity_id: "b", dagar: 8, bollen: "oss" }),
    ];
    expect(sortera(rader).map((r) => r.opportunity_id)).toEqual(["b", "a"]);
  });
});

describe("reglerna in i morgonlistan", () => {
  it("bollen hos oss i mer än en dag ger en rad", () => {
    const r = regelrader([rad({ opportunity_id: "o1", namn: "Louise Ribbing", dagar: 2, bollen: "oss" })], REGLER);
    expect(r.length).toBe(1);
    expect(r[0].etikett).toBe("Bollen hos dig");
    expect(r[0].text).toBe("Louise Ribbing väntar på svar från dig sedan 2 dagar.");
    expect(r[0].lank).toContain("app.mysales.se");
  });

  it("under tröskeln ger ingen rad", () => {
    expect(regelrader([rad({ opportunity_id: "o1", dagar: 0, bollen: "oss" })], REGLER).length).toBe(0);
  });

  it("offert utan kontakt i sju dagar ger en rad", () => {
    const r = regelrader([rad({ opportunity_id: "o2", namn: "Pernilla", dagar: 9, steg_namn: "Offert skickad" })], REGLER);
    expect(r.map((x) => x.etikett)).toEqual(["Offert"]);
    expect(r[0].text).toBe("Pernilla står i Offert skickad och har varit tyst i 9 dagar.");
  });

  it("annat steg träffas inte av offertregeln", () => {
    expect(regelrader([rad({ opportunity_id: "o3", dagar: 9, steg_namn: "Uppföljning" })], REGLER).length).toBe(0);
  });

  it("öppen affär tyst i 21 dagar ger rinner-ut-raden", () => {
    const r = regelrader([rad({ opportunity_id: "o4", namn: "Maths", dagar: 30, steg_namn: "Uppföljning" })], REGLER);
    expect(r.map((x) => x.etikett)).toEqual(["Tystnad"]);
    expect(r[0].text).toContain("riskerar att rinna ut");
  });

  // Utan den här regeln står samma affär två gånger i morgonlistan, en gång per regel.
  it("en affär som träffas av två regler ger bara den strängare raden", () => {
    const r = regelrader([rad({ opportunity_id: "o5", dagar: 40, steg_namn: "Offert skickad" })], REGLER);
    expect(r.length).toBe(1);
    expect(r[0].etikett).toBe("Tystnad");
  });

  // En affär där kunden väntar på svar ska inte ALSO nagga som "tyst". Bollen går först.
  it("bollen hos oss utesluter tystnadsraderna för samma affär", () => {
    const r = regelrader([rad({ opportunity_id: "o6", dagar: 40, bollen: "oss", steg_namn: "Offert skickad" })], REGLER);
    expect(r.length).toBe(1);
    expect(r[0].etikett).toBe("Bollen hos dig");
  });

  it("omätbara affärer ger aldrig en tystnadsrad", () => {
    const r = regelrader([rad({ opportunity_id: "o7", dagar: null, bollen: "okant", matbar: false, epost: null })], REGLER);
    expect(r.length).toBe(0);
  });

  it("avstängd regel ger inga rader", () => {
    const av = REGLER.map((r) => ({ ...r, aktiv: false }));
    expect(regelrader([rad({ opportunity_id: "o8", dagar: 40, bollen: "oss" })], av).length).toBe(0);
  });

  it("formuleringarna konstaterar, de tillrättavisar aldrig", () => {
    const r = regelrader([
      rad({ opportunity_id: "a", dagar: 3, bollen: "oss" }),
      rad({ opportunity_id: "b", dagar: 30, steg_namn: "Uppföljning" }),
    ], REGLER);
    for (const x of r) {
      expect(x.text.toLowerCase()).not.toMatch(/\bdu (borde|måste|glömde|har misslyckats)\b|slarv|dålig/);
      expect(x.text).not.toContain("—");
    }
  });
});

describe("adressparsning", () => {
  it("plockar adressen ur en avsändarrubrik", () => {
    expect(adressUr('"Louise Ribbing" <Louise.Ribbing@riddarhuset.se>')).toBe("louise.ribbing@riddarhuset.se");
    expect(adressUr("hakan@displayteknik.se")).toBe("hakan@displayteknik.se");
  });

  // Gmail skriver adressen med olika versaler i olika rubriker. Matchas den skiftlägeskänsligt
  // faller inkommande bort och bollen hamnar fel.
  it("matchar oavsett versaler", () => {
    expect(adressUr("<HAKAN@Displayteknik.SE>")).toBe("hakan@displayteknik.se");
  });
});
