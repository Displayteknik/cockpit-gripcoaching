// Enhetstester för mysalesKontaktUrl.
//
// Bakgrund: två konkurrerande adressformer låg i koden samtidigt. Den verifierade
// (mot en riktig kund-URL) är /location/<loc>/customers/detail/<id>. GHL:s egen
// /v2/location/<loc>/contacts/detail/<id> fanns i HQ, Tystnadslistan och FokusClient
// och ledde fel — FokusClient hade till och med båda formerna i samma fil.
// Testet finns för att den varianten aldrig ska smyga tillbaka.

import { describe, expect, it } from "vitest";
import { mysalesKontaktUrl } from "@/lib/mysales";

const LOC = "abc123";
const KONTAKT = "kontakt789";

describe("mysalesKontaktUrl", () => {
  it("bygger den verifierade formen", () => {
    expect(mysalesKontaktUrl(LOC, KONTAKT)).toBe(
      "https://app.mysales.se/location/abc123/customers/detail/kontakt789",
    );
  });

  it("använder ALDRIG GHL:s /v2/contacts-form", () => {
    const url = mysalesKontaktUrl(LOC, KONTAKT) || "";
    expect(url).not.toContain("/v2/");
    expect(url).not.toContain("/contacts/detail/");
  });

  it("saknad kontakt ger null — hellre ingen knapp än en trasig", () => {
    expect(mysalesKontaktUrl(LOC, null)).toBeNull();
    expect(mysalesKontaktUrl(LOC, undefined)).toBeNull();
    expect(mysalesKontaktUrl(LOC, "")).toBeNull();
  });

  it("saknad location ger null", () => {
    expect(mysalesKontaktUrl(null, KONTAKT)).toBeNull();
    expect(mysalesKontaktUrl("", KONTAKT)).toBeNull();
  });
});
