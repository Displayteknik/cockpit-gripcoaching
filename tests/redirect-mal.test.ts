// Enhetstester för sakertRedirectMal — vart man skickas efter inloggning.
// Bakgrund: djuplänkarna i leadaviseringsmejlet bär sin nyckel i query-strängen
// (/dashboard/offert?lead=…), så `from` måste överleva inloggningen HEL. Samtidigt får
// den inte gå att använda för att skicka en nyss inloggad användare till en främmande sajt.

import { describe, expect, it } from "vitest";
import { sakertRedirectMal, STANDARD_MAL } from "@/lib/redirect-mal";

describe("sakertRedirectMal", () => {
  it("behåller query-strängen — annars tappas vilket lead som avsågs", () => {
    expect(sakertRedirectMal("/dashboard/offert?lead=90c37c36-e3b9-4509-88df-a54b27348b1c"))
      .toBe("/dashboard/offert?lead=90c37c36-e3b9-4509-88df-a54b27348b1c");
    expect(sakertRedirectMal("/dashboard/leads?id=abc")).toBe("/dashboard/leads?id=abc");
  });

  it("vanlig sökväg släpps igenom", () => {
    expect(sakertRedirectMal("/dashboard")).toBe("/dashboard");
  });

  it("protokoll-relativ adress är INTE ett internt mål", () => {
    expect(sakertRedirectMal("//evil.example")).toBe(STANDARD_MAL);
    expect(sakertRedirectMal("//evil.example/dashboard")).toBe(STANDARD_MAL);
  });

  it("bakstreck-varianten som webbläsare tolkar som värdnamn stoppas också", () => {
    expect(sakertRedirectMal("/\\evil.example")).toBe(STANDARD_MAL);
  });

  it("absolut adress avvisas", () => {
    expect(sakertRedirectMal("https://evil.example")).toBe(STANDARD_MAL);
    expect(sakertRedirectMal("javascript:alert(1)")).toBe(STANDARD_MAL);
  });

  it("tomt eller saknat värde ger standardmålet", () => {
    expect(sakertRedirectMal(null)).toBe(STANDARD_MAL);
    expect(sakertRedirectMal(undefined)).toBe(STANDARD_MAL);
    expect(sakertRedirectMal("")).toBe(STANDARD_MAL);
  });
});
