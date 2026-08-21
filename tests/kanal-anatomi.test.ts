// KANAL-2 (HELG-1 DEL 5): kanalanatomier som data, samma mönster som format-anatomi.
import { describe, it, expect } from "vitest";
import {
  KANAL_NYCKLAR, KANAL_ANATOMI, kanalGuideText, kanalForGhlPlatform,
  arAnsluten, arUtgangen, synligaKanaler, type KanalKey, type GhlKonto,
} from "@/lib/kanal-anatomi";

describe("KANAL_ANATOMI — alla nio kanaler har en fullständig specifikation", () => {
  for (const k of KANAL_NYCKLAR) {
    it(`${k} har namn, ton, hashtagbruk, ctaForm och en innehållstypskrav`, () => {
      const a = KANAL_ANATOMI[k];
      expect(a.namn.length).toBeGreaterThan(0);
      expect(a.ton.length).toBeGreaterThan(10);
      expect(a.hashtagbruk.length).toBeGreaterThan(0);
      expect(a.ctaForm.length).toBeGreaterThan(0);
      expect(["bild", "video", "vilken"]).toContain(a.kravInnehallstyp);
      expect(a.maxLangd).toBeGreaterThan(0);
    });
  }
});

describe("kanalForGhlPlatform — GHL platform-sträng → KanalKey", () => {
  it("matchar de fyra mätta plattformarna", () => {
    expect(kanalForGhlPlatform("instagram")).toBe("ig");
    expect(kanalForGhlPlatform("facebook")).toBe("fb");
    expect(kanalForGhlPlatform("linkedin")).toBe("li");
    expect(kanalForGhlPlatform("google")).toBe("google");
  });
  it("är skiftläges-okänslig (GHL kan variera)", () => {
    expect(kanalForGhlPlatform("Google")).toBe("google");
    expect(kanalForGhlPlatform("INSTAGRAM")).toBe("ig");
  });
  it("PROVAD GENOM ATT BRYTAS: en okänd plattform ger null, aldrig en gissning", () => {
    expect(kanalForGhlPlatform("myspace")).toBeNull();
    expect(kanalForGhlPlatform("")).toBeNull();
  });
});

describe("kanalGuideText — samma text prompten och adapt-channel delar", () => {
  it("innehåller kanalens namn, ton och tecken-tak", () => {
    const t = kanalGuideText("google" as KanalKey);
    expect(t).toContain("Google Business Profile");
    expect(t).toContain("1500");
  });
});

describe("Innehållstypskrav — DEL 5 punkt 3: video-/bildkanaler visas bara när innehållet passar", () => {
  it("YouTube och TikTok kräver video", () => {
    expect(KANAL_ANATOMI.youtube.kravInnehallstyp).toBe("video");
    expect(KANAL_ANATOMI.tiktok.kravInnehallstyp).toBe("video");
  });
  it("Google Business Profile och Pinterest kräver bild (stillbild/karusell, ingen video-post byggd)", () => {
    expect(KANAL_ANATOMI.google.kravInnehallstyp).toBe("bild");
    expect(KANAL_ANATOMI.pinterest.kravInnehallstyp).toBe("bild");
  });
});

describe("arAnsluten / arUtgangen — DEL 5 punkt 4: en utgången koppling är inte 'ej kopplad'", () => {
  const aktivtGoogle: GhlKonto[] = [{ platform: "google", isExpired: false }];
  const utgangetGoogle: GhlKonto[] = [{ platform: "google", isExpired: true }];
  const ingaKonton: GhlKonto[] = [];

  it("ett aktivt konto är anslutet, inte utgånget", () => {
    expect(arAnsluten("google", aktivtGoogle)).toBe(true);
    expect(arUtgangen("google", aktivtGoogle)).toBe(false);
  });
  it("PROVAD GENOM ATT BRYTAS: ett utgånget konto är INTE 'ansluten' men ÄR 'utgången' — det är precis skillnaden beställningen vill ha", () => {
    expect(arAnsluten("google", utgangetGoogle)).toBe(false);
    expect(arUtgangen("google", utgangetGoogle)).toBe(true);
  });
  it("inget konto alls: varken ansluten eller utgången — det är 'aldrig kopplad', en tredje sak", () => {
    expect(arAnsluten("google", ingaKonton)).toBe(false);
    expect(arUtgangen("google", ingaKonton)).toBe(false);
  });
});

describe("synligaKanaler — DEL 5 punkt 1+3, DoD-scenariot ordagrant", () => {
  it("GBP dyker upp som kanal hos en tenant med GBP kopplad", () => {
    const konton: GhlKonto[] = [{ platform: "facebook", isExpired: false }, { platform: "google", isExpired: false }];
    expect(synligaKanaler(konton, false)).toContain("google");
  });
  it("tenant UTAN GBP ser den inte", () => {
    const konton: GhlKonto[] = [{ platform: "facebook", isExpired: false }];
    expect(synligaKanaler(konton, false)).not.toContain("google");
  });
  it("en utgången GBP-koppling visas ÄNDÅ (så den kan få \"behöver förnyas\"-etiketten) — försvinner aldrig tyst", () => {
    const konton: GhlKonto[] = [{ platform: "google", isExpired: true }];
    expect(synligaKanaler(konton, false)).toContain("google");
  });
  it("ig/fb/li syns alltid, även helt utan GHL-koppling", () => {
    expect(synligaKanaler([], false)).toEqual(expect.arrayContaining(["ig", "fb", "li"]));
  });
  it("video-kanal (YouTube) syns bara för videoinnehåll, även om den är kopplad", () => {
    const konton: GhlKonto[] = [{ platform: "youtube", isExpired: false }];
    expect(synligaKanaler(konton, false)).not.toContain("youtube");
    expect(synligaKanaler(konton, true)).toContain("youtube");
  });
  it("bild-kanal (GBP) syns bara för icke-video, även om den är kopplad", () => {
    const konton: GhlKonto[] = [{ platform: "google", isExpired: false }];
    expect(synligaKanaler(konton, true)).not.toContain("google");
    expect(synligaKanaler(konton, false)).toContain("google");
  });
});
