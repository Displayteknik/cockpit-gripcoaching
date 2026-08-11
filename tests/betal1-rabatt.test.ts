import { describe, expect, it } from "vitest";
import { raknaEfterRabatt, rabattPa } from "@/lib/billing/import";

// BETAL-1c — rabatter. Hakan ger kampanjkoder i Stripe, sa en kund kan ha listpris
// 2 490 men faktiskt betala 1 990. Laser vi bara price.unit_amount visar Cockpit fel
// belopp pa hennes betalsida och raknar upp intakten med pengar som aldrig kommer in.

describe("rabattPa", () => {
  it("laser procentrabatt ur den nya listan", () => {
    const r = rabattPa({ discounts: [{ coupon: { percent_off: 20, name: "Kampanj" } }] });
    expect(r.procent).toBe(20);
    expect(r.text).toContain("20 procent");
  });

  it("laser kronrabatt och raknar om fran oren", () => {
    const r = rabattPa({ discounts: [{ coupon: { amount_off: 50000, name: "Vanpris" } }] });
    expect(r.kronor_av).toBe(500);
    expect(r.text).toContain("500 kr");
  });

  it("laser aven det aldre enskilda faltet", () => {
    const r = rabattPa({ discount: { coupon: { percent_off: 10 } } });
    expect(r.procent).toBe(10);
  });

  it("flaggar nar kupongen bara galler forsta betalningen", () => {
    // En engangsrabatt ar inte en permanent intaktssankning och far inte se ut som en.
    const r = rabattPa({ discount: { coupon: { percent_off: 50, duration: "once" } } });
    expect(r.text).toContain("bara första betalningen");
  });

  it("ett oexpanderat id gar inte att rakna pa och far inte gissas", () => {
    const r = rabattPa({ discounts: ["di_123"] });
    expect(r.procent).toBe(0);
    expect(r.kronor_av).toBe(0);
    expect(r.text).toBeNull();
  });

  it("ingen rabatt ger noll, inte NaN", () => {
    expect(rabattPa({}).procent).toBe(0);
    expect(rabattPa(null).kronor_av).toBe(0);
  });
});

describe("raknaEfterRabatt", () => {
  it("Hakans fall: 2 490 med 20 procent blir 1 992", () => {
    expect(raknaEfterRabatt(2490, { procent: 20, kronor_av: 0 })).toBe(1992);
  });

  it("kronrabatt dras rakt av", () => {
    expect(raknaEfterRabatt(2490, { procent: 0, kronor_av: 500 })).toBe(1990);
  });

  it("utan rabatt ar listpriset orort", () => {
    expect(raknaEfterRabatt(700, { procent: 0, kronor_av: 0 })).toBe(700);
  });

  it("gar aldrig under noll", () => {
    expect(raknaEfterRabatt(700, { procent: 0, kronor_av: 5000 })).toBe(0);
  });

  it("procent och kronor kan galla samtidigt", () => {
    // 1000 minus 10 procent = 900, sedan 100 kr av = 800.
    expect(raknaEfterRabatt(1000, { procent: 10, kronor_av: 100 })).toBe(800);
  });
});
