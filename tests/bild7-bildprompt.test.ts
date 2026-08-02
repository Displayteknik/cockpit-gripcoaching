// BILD-7 — bildpromptens kärnregler. Plattformsregler i centrala lager, aldrig per
// tenant: samma krav ska gälla blomsteraffär, bilhandlare och coach.
//   7a  avbildat exempelinnehåll har RELEVANS *och* BUDSKAP
//   7b  säsongslagret varierar markörerna mellan genereringar
//   7c  färgtemperaturen ur den grafiska profilen bärs av bildprompten
// All DB mockas; testerna kör utan nycklar och utan nät.

import { describe, expect, it, vi } from "vitest";

// studio/kit läser studio_brand_kits — mockat kit styrs via KIT nedan.
let KIT: Record<string, unknown> = {};
vi.mock("@/lib/supabase-admin", () => ({
  supabaseService: () => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { kit: KIT } }) }) }) }),
  }),
  supabaseServer: () => ({}),
}));

import {
  DEPICTED_CONTENT_EN,
  DEPICTED_CONTENT_SV,
  DEPICTED_MESSAGE_EN,
  DEPICTED_MESSAGE_SV,
  DEPICTED_RELEVANCE_EN,
  DEPICTED_RELEVANCE_SV,
  NO_DASH_IN_IMAGE_EN,
} from "@/lib/images";
import { sasongsPromptRad, sasongsUttryck, seasonPromptLineEn } from "@/lib/content/sasong";
import { fargTon, getKitDirectives, imageDirectiveSuffix } from "@/lib/studio/kit";

const SENSOMMAR = new Date(2026, 7, 3); // 3 augusti — kräftskivan är närmaste markör

describe("BILD-7a — avbildat exempelinnehåll: relevans OCH budskap", () => {
  it("relevansregeln räknar upp bärarna och förbjuder dekorativ utfyllnad", () => {
    for (const barare of ["screens", "signs", "menu boards", "posters", "documents", "packaging"]) {
      expect(DEPICTED_RELEVANCE_EN, barare).toContain(barare);
    }
    expect(DEPICTED_RELEVANCE_EN).toContain("relevant BOTH to this business and to the message of the post");
    expect(DEPICTED_RELEVANCE_EN).toContain("never decorative filler");
    expect(DEPICTED_RELEVANCE_EN).toContain("abstract glowing swirls");
    // Poängen: syns produkten/miljön ska bilden demonstrera verklig användning.
    expect(DEPICTED_RELEVANCE_EN).toContain("REAL USE");
    expect(DEPICTED_RELEVANCE_SV).toContain("VERKLIG ANVÄNDNING");
  });

  it("budskapsregeln kräver BÅDE motiv och en kort trovärdig rad, med exemplen", () => {
    expect(DEPICTED_MESSAGE_EN).toContain("BOTH a recognisable subject AND a short, believable message");
    expect(DEPICTED_MESSAGE_EN).toContain("an offer, a price, an event or a time");
    expect(DEPICTED_MESSAGE_EN).toContain("DAGENS LUNCH 129 KR");
    expect(DEPICTED_MESSAGE_SV).toContain("DAGENS LUNCH 129 KR");
    expect(DEPICTED_MESSAGE_SV).toContain("skyltfönstret visar det butiken faktiskt säljer");
  });

  it("budskapstexten följer textreglerna: svenska, rätt stavning och ingen konkurrerande CTA", () => {
    expect(DEPICTED_MESSAGE_EN).toContain("in Swedish");
    expect(DEPICTED_MESSAGE_EN).toContain("competes with the post's own");
    expect(DEPICTED_MESSAGE_EN).toContain("RING NU");
    expect(DEPICTED_MESSAGE_SV).toContain("konkurrerar med inläggets egen");
    // Skarptestet: bildmodellen skrev "IDÅG" och "VÄKLLOMMEN" — å/ä/ö sattes dit de
    // inte hör hemma. Regeln pekar ut båda felen med namn.
    for (const fel of ["IDÅG", "VÄKLLOMMEN"]) {
      expect(DEPICTED_MESSAGE_EN, fel).toContain(fel);
      expect(DEPICTED_MESSAGE_SV, fel).toContain(fel);
    }
    expect(DEPICTED_MESSAGE_EN).toContain("spelled correctly");
    expect(DEPICTED_MESSAGE_SV).toContain("rättstavade");
  });

  it("bakgrundsskyltar får inte annonsera högtider eller datum (BILD-8c)", () => {
    // Skarpt fall (BILD-8 DoD, kvarleva 6): `KRÄFTSKIVA 8 AUGUSTI` dök upp på en
    // griffeltavla i bakgrunden i två bilder. BILD-7b:s rotation styr bildprompten,
    // inte vad modellen ritar på en tavla som inte är motivet.
    expect(DEPICTED_MESSAGE_EN).toContain("not itself the subject of the post");
    expect(DEPICTED_MESSAGE_EN).toContain("never announce a holiday or a dated event");
    expect(DEPICTED_MESSAGE_SV).toContain("inte är inläggets ämne");
    expect(DEPICTED_MESSAGE_SV).toContain("högtid eller ett daterat evenemang");
  });

  it("den fulla regeln bär BILD-6a:s tankstrecksförbud vidare (bygger på, ersätter inte)", () => {
    expect(DEPICTED_CONTENT_EN).toContain(NO_DASH_IN_IMAGE_EN);
    expect(DEPICTED_CONTENT_EN).toContain(DEPICTED_RELEVANCE_EN);
    expect(DEPICTED_CONTENT_EN).toContain(DEPICTED_MESSAGE_EN);
    expect(DEPICTED_CONTENT_SV).toContain("tankstreck");
  });

  it("regeln är branschneutral — inga tenant- eller branschnamn hårdkodade", () => {
    const alla = `${DEPICTED_CONTENT_EN} ${DEPICTED_CONTENT_SV}`.toLowerCase();
    for (const namn of ["displayteknik", "annas", "hm motor", "engens", "opticur", "gripcoaching"]) {
      expect(alla, namn).not.toContain(namn);
    }
  });
});

describe("BILD-7b — säsongslagret varierar markörerna mellan genereringar", () => {
  it("uttrycken roterar: olika frö ger olika urval, samma frö ger samma", () => {
    const a = sasongsUttryck("sommar", { fro: 1 }).map((u) => u.en);
    const b = sasongsUttryck("sommar", { fro: 999 }).map((u) => u.en);
    const aIgen = sasongsUttryck("sommar", { fro: 1 }).map((u) => u.en);
    expect(a).toEqual(aIgen);
    expect(a).not.toEqual(b);
    expect(a).toHaveLength(3);
  });

  it("sensommaren har fler uttryck än kräftskivan — kvällsljus, skörd, uteserveringar, back to business", () => {
    const alla = sasongsUttryck("sommar", { fro: 7, antal: 99 }).map((u) => u.en).join(" | ");
    for (const uttryck of ["evening light", "harvest", "outdoor seating", "back to business"]) {
      expect(alla, uttryck).toContain(uttryck);
    }
    // Uttrycken är stämning, aldrig produkt — annars styr säsongslagret motivet.
    expect(alla.toLowerCase()).not.toContain("crayfish");
  });

  it("bildraden (en) bär variationsregeln och lyfter fram uttryck", () => {
    const rad = seasonPromptLineEn(SENSOMMAR, { fro: 42 });
    expect(rad).toContain("VARY THE SEASONAL CUE");
    expect(rad).toContain("the nearest holiday is only one of them");
    expect(rad).toContain("Lean on these expressions this time:");
    // Högtidsmarkören finns kvar — variationen ersätter den inte.
    expect(rad).toContain("crayfish party season");
  });

  it("textraden (sv) bär samma regel utan att tappa de gamla kraven", () => {
    const rad = sasongsPromptRad(SENSOMMAR, { fro: 42 });
    expect(rad).toContain("AKTUELL TID: 3 augusti 2026, sommar");
    expect(rad).toContain("föreslå ALDRIG produkter/motiv ur fel säsong");
    expect(rad).toContain("VARIERA SÄSONGSUTTRYCKET");
    expect(rad).toContain("Återanvänd aldrig samma säsongsmotiv två gånger i rad");
  });

  it("nyligen använda motiv renderas som 'välj ett annat' — trimmat, tak 5", () => {
    const motiv = Array.from({ length: 8 }, (_, i) => `  motiv ${i}  `);
    const en = seasonPromptLineEn(SENSOMMAR, { fro: 1, nyligenMotiv: motiv });
    expect(en).toContain("RECENTLY USED MOTIFS (pick a different one this time):");
    expect(en).toContain("motiv 0");
    expect(en).toContain("motiv 4");
    expect(en).not.toContain("motiv 5");
    const sv = sasongsPromptRad(SENSOMMAR, { fro: 1, nyligenMotiv: ["kräftskiva på bryggan"] });
    expect(sv).toContain("NYLIGEN ANVÄNDA MOTIV (välj ett annat den här gången): kräftskiva på bryggan.");
  });

  it("utan nyligen-lista finns inget sådant block (tomma strängar räknas inte)", () => {
    expect(seasonPromptLineEn(SENSOMMAR, { fro: 1 })).not.toContain("RECENTLY USED MOTIFS");
    expect(seasonPromptLineEn(SENSOMMAR, { fro: 1, nyligenMotiv: ["", "  "] })).not.toContain("RECENTLY USED MOTIFS");
    expect(sasongsPromptRad(SENSOMMAR, { fro: 1 })).not.toContain("NYLIGEN ANVÄNDA MOTIV");
  });

  it("två anrop i rad utan frö ger olika uttryck (rotationen är hela poängen)", () => {
    // Sannolikheten att 12 dragningar i rad ger samma urval ur 8 uttryck är försumbar.
    const rader = Array.from({ length: 12 }, () => seasonPromptLineEn(SENSOMMAR));
    expect(new Set(rader).size).toBeGreaterThan(1);
  });
});

describe("BILD-7c — färgtemperatur ur den grafiska profilen", () => {
  it("warm ger en varm ton som uttryckligen slår neutral/dämpad behandling", async () => {
    KIT = { imageStyle: { colorGrade: "warm" } };
    const d = await getKitDirectives("klient-1");
    expect(d.imageExtra).toContain("warm colour temperature throughout");
    expect(d.imageExtra).toContain("never desaturated");
    expect(d.imageExtra).toContain("takes precedence over any neutral or muted treatment");
    // Fortfarande bara färg och ljus — motivet ägs av budskapet.
    expect(imageDirectiveSuffix(d)).toContain("applies to colour and light only");
  });

  it("cool ger motsvarande kall ton", async () => {
    KIT = { imageStyle: { colorGrade: "cool" } };
    const d = await getKitDirectives("klient-1");
    expect(d.imageExtra).toContain("cool colour temperature throughout");
    expect(d.imageExtra).toContain("never yellow or muddy");
  });

  it("fritext-värden tolkas — brand-kit-agenten skriver svenska ('varm-naturlig')", async () => {
    expect(fargTon("varm-naturlig")).toBe("warm");
    expect(fargTon("warm")).toBe("warm");
    expect(fargTon("sval och ren")).toBe("cool");
    expect(fargTon("cool")).toBe("cool");
    expect(fargTon("neutral")).toBe("");
    expect(fargTon("")).toBe("");
    expect(fargTon(undefined)).toBe("");
    // Skarpt fall: Annas Blommor har "varm-naturlig" i sitt kit och tappade tidigare tonen.
    KIT = { imageStyle: { colorGrade: "varm-naturlig" } };
    expect((await getKitDirectives("klient-1")).imageExtra).toContain("warm colour temperature throughout");
  });

  it("neutral (eller osatt) ger ingen färgtemperatur alls", async () => {
    KIT = { imageStyle: { colorGrade: "neutral" } };
    expect((await getKitDirectives("klient-1")).imageExtra).not.toContain("colour temperature");
    KIT = {};
    expect((await getKitDirectives("klient-1")).imageExtra).not.toContain("colour temperature");
  });

  it("färgtonen överlever tillsammans med signaturens behandling (båda i suffixet)", async () => {
    KIT = { signature: { enabled: true, preset: "mork-kontrast" }, imageStyle: { colorGrade: "warm" } };
    const suffix = imageDirectiveSuffix(await getKitDirectives("klient-1"));
    expect(suffix).toContain("warm colour temperature throughout");
    expect(suffix).toContain("takes precedence");
  });
});
