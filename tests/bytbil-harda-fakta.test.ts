import { describe, it, expect } from "vitest";
import { effektIHk, rensaUtrustning, mergeSpecs, mapCarToVehicle, SYNKADE_SPEC_NYCKLAR, type BytbilCar } from "@/lib/bytbil";

// Bakgrund: sajten visade Bytbils `enginePower` med etiketten "hk". Fältet är kilowatt.
// 39 av 64 synliga fordon underskattades — Volvo V60 stod som 158 hk i stället för 215 hk.

describe("effektIHk", () => {
  it("använder Bytbils exakta registervärde när det finns", () => {
    // Volvo V60 D5: enginePower 158 (kW), registret säger 215 hk
    expect(effektIHk({ enginePower: 158, additionalVehicleData: { engineEffectKw: 158, engineEffectHp: 215 } })).toBe(215);
    // Dacia Lodgy: 85 kW = 116 hk
    expect(effektIHk({ enginePower: 85, additionalVehicleData: { engineEffectKw: 85, engineEffectHp: 116 } })).toBe(116);
  });

  it("räknar om kW till hk när registervärde saknas (ATV, moped, släp)", () => {
    // CFMOTO CFORCE 1000: 63 kW
    expect(effektIHk({ enginePower: 63 })).toBe(86);
    // CFMOTO CFORCE 850: 52 kW
    expect(effektIHk({ enginePower: 52 })).toBe(71);
    expect(effektIHk({ enginePower: 30, additionalVehicleData: { engineEffectKw: null, engineEffectHp: null } })).toBe(41);
  });

  it("returnerar aldrig kW-talet rakt av", () => {
    expect(effektIHk({ enginePower: 125, additionalVehicleData: { engineEffectHp: 170 } })).not.toBe(125);
  });

  it("ger null när effekt saknas helt", () => {
    expect(effektIHk({})).toBeNull();
    expect(effektIHk({ enginePower: 0 })).toBeNull();
  });
});

describe("rensaUtrustning", () => {
  it("slänger rena tal — Respo-släpen skickar 24 och 36 som utrustning", () => {
    expect(rensaUtrustning(["Stödhjul", 24, "Kåpa", 36])).toEqual(["Stödhjul", "Kåpa"]);
  });

  it("slänger tomma och trimmar", () => {
    expect(rensaUtrustning(["  AC  ", "", "   ", null, undefined])).toEqual(["AC"]);
  });

  it("behåller text som innehåller siffror", () => {
    expect(rensaUtrustning(["7-sits", "12V-UTTAG", "ACC 2 klimatzoner"])).toEqual(["7-sits", "12V-UTTAG", "ACC 2 klimatzoner"]);
  });
});

describe("mergeSpecs — Bytbil äger hårda fakta, Håkan äger resten", () => {
  it("skriver om synk-ägda nycklar med Bytbils värde", () => {
    const ut = mergeSpecs({ Miltal: "9 000 mil", Effekt: "92 hk" }, { Miltal: "11 500 mil", Effekt: "125 hk" });
    expect(ut.Miltal).toBe("11 500 mil");
    expect(ut.Effekt).toBe("125 hk");
  });

  it("behåller egna spec-rader som Bytbil inte känner till", () => {
    const ut = mergeSpecs({ Miltal: "9 000 mil", Servicebok: "Ja, komplett" }, { Miltal: "11 500 mil" });
    expect(ut.Servicebok).toBe("Ja, komplett");
    expect(ut.Miltal).toBe("11 500 mil");
  });

  it("rör inte en synk-ägd nyckel som saknas i feeden", () => {
    const ut = mergeSpecs({ "Reg.nr": "ABC123", Miltal: "9 000 mil" }, { Miltal: "11 500 mil" });
    expect(ut["Reg.nr"]).toBe("ABC123");
  });

  it("klarar tomma befintliga specs", () => {
    expect(mergeSpecs(null, { Miltal: "0 mil" })).toEqual({ Miltal: "0 mil" });
  });
});

describe("mapCarToVehicle", () => {
  const car: BytbilCar = {
    id: 18422415,
    title: "Volvo V60 D5 AWD Geartronic Momentum",
    data: {
      make: "Volvo", model: "V60", modelYear: 2012, vehicleType: "car", bodyType: "Kombi",
      fuel: "Diesel", gearBox: "Automatisk", enginePower: 158, freetextColor: "Vit",
      regNo: "TDL933", regNoHidden: false, milage: 25300,
      equipment: ["ABS-bromsar", 24, "Dragkrok"],
      additionalVehicleData: { engineEffectKw: 158, engineEffectHp: 215 },
      price: { value: 119900 },
    },
  };

  it("bygger specs med rätt hästkrafter och rensad utrustning", () => {
    const v = mapCarToVehicle(car, "klient-1", "2026-08-05T00:00:00Z");
    expect(v.specs.Effekt).toBe("215 hk");
    expect(v.specs.Utrustning).toBe("ABS-bromsar, Dragkrok");
    expect(v.specs.Miltal.replace(/\s/g, " ")).toBe("25 300 mil");
    expect(v.specs["Årsmodell"]).toBe("2012");
    expect(v.price).toBe(119900);
  });

  it("producerar bara nycklar synken äger, plus inga överraskningar", () => {
    const v = mapCarToVehicle(car, "klient-1", "2026-08-05T00:00:00Z");
    for (const nyckel of Object.keys(v.specs)) {
      expect(SYNKADE_SPEC_NYCKLAR).toContain(nyckel);
    }
  });
});
