import { describe, it, expect } from "vitest";
import { citatFinns } from "@/lib/onboard/harled";
import { stadaOrt, adressUrNod } from "@/lib/onboard/extrahera";
import { normalisera, klassaRoll } from "@/lib/onboard/upptack";
import {
  domanAv, sluggify, byggCustomValues, subAccountStegUtanByratoken,
} from "@/lib/onboard/provisionera";
import { profilUrlFranLankar, bokadirektLankUrSidor } from "@/lib/onboard/bokadirekt";
import { funnet, tomt, harVarde, type Forslag, type OnboardSida } from "@/lib/onboard/typer";
import { rensaMarkdown } from "@/lib/onboard/hamta";
import { underlagDuger } from "@/lib/deep-audit-generate";
import type { SiteAudit } from "@/lib/seo-deep";

// Testerna nedan skyddar de grindar som avgör om FEL DATA hamnar i ett kundkonto.
// Alla utom det sista blocket är rena funktioner — inga nätanrop, inget AI.

describe("citatgrinden — anti-fabrikation", () => {
  const kalla =
    "Vi har även en hel del tandvårdsrädda patienter och fått mycket beröm för gott bemötande. Öppet vardagar.";

  it("släpper igenom ett citat som står ordagrant i källan", () => {
    expect(citatFinns("en hel del tandvårdsrädda patienter", kalla)).toBe(true);
  });

  it("tål annan whitespace, andra citattecken och andra bindestreck", () => {
    expect(citatFinns("en  hel   del\ntandvårdsrädda   patienter", kalla)).toBe(true);
  });

  it("FÖRKASTAR ett citat som inte finns i källan — även om det låter rimligt", () => {
    expect(citatFinns("vi erbjuder marknadens bästa tandvård", kalla)).toBe(false);
  });

  it("förkastar för korta citat som inte belägger något", () => {
    // "Öppet" står i källan men pekar inte ut något — för kort för att vara belägg.
    expect(citatFinns("Öppet", kalla)).toBe(false);
  });

  it("förkastar tomt och saknat citat", () => {
    expect(citatFinns(null, kalla)).toBe(false);
    expect(citatFinns("", kalla)).toBe(false);
  });
});

describe("stadaOrt — menyord får inte bli del av ortnamnet", () => {
  it("klipper bort menylänk efter orten", () => {
    // Verkligt utfall från linnetandvarden.se respektive sturehof.com före rättningen.
    expect(stadaOrt("Göteborg Integritetspolicy")).toBe("Göteborg");
    expect(stadaOrt("Stockholm Karta")).toBe("Stockholm");
  });

  it("behåller riktiga tvåordsorter", () => {
    expect(stadaOrt("Upplands Väsby")).toBe("Upplands Väsby");
    expect(stadaOrt("Stora Höga")).toBe("Stora Höga");
  });

  it("ger null när inget dugligt återstår", () => {
    expect(stadaOrt("Kontakt")).toBeNull();
  });
});

describe("URL-normalisering och idempotensnyckel", () => {
  it("gör www, protokoll, query och släpande slash till samma sak", () => {
    const varianter = ["https://foo.se", "http://www.foo.se/", "foo.se", "https://foo.se/#kontakt", "https://www.foo.se/?utm_source=x"];
    const nycklar = new Set(varianter.map(domanAv));
    expect(nycklar.size).toBe(1);
    expect([...nycklar][0]).toBe("foo.se");
  });

  it("normalisera dedupar sökvägar", () => {
    const o = "https://foo.se";
    expect(normalisera("https://foo.se/kontakt/", o)).toBe(normalisera("https://foo.se/kontakt?utm=1", o));
  });
});

describe("rollklassning styr vilka sidor som läses", () => {
  const rot = "https://foo.se/";
  it("känner igen de fakta-tunga rollerna, svenska och engelska", () => {
    expect(klassaRoll("https://foo.se/kontakt", rot).roll).toBe("kontakt");
    expect(klassaRoll("https://foo.se/about-us", rot).roll).toBe("om");
    expect(klassaRoll("https://foo.se/priser", rot).roll).toBe("priser");
    expect(klassaRoll("https://foo.se/behandlingar", rot).roll).toBe("tjanster");
    expect(klassaRoll("https://foo.se/referenser", rot).roll).toBe("omdomen");
  });

  it("ger startsidan högst vikt", () => {
    expect(klassaRoll(rot, rot).roll).toBe("start");
    expect(klassaRoll(rot, rot).vikt).toBeGreaterThan(klassaRoll("https://foo.se/kontakt", rot).vikt);
  });
});

describe("Falt — ett värde utan källa går inte att förväxla med ett med källa", () => {
  it("harVarde är falskt för tomt, tom sträng och tom lista", () => {
    expect(harVarde(tomt("saknas"))).toBe(false);
    expect(harVarde(funnet("", "sajt", null))).toBe(false);
    expect(harVarde(funnet<string[]>([], "sajt", null))).toBe(false);
    expect(harVarde(funnet("Displayteknik", "schema", "https://x.se"))).toBe(true);
  });

  it("tomt-fält bär alltid en förklaring", () => {
    expect(tomt("Ingen telefonlänk hittades.").saknasVarfor).toBeTruthy();
  });
});

describe("byggCustomValues — bara belagda värden går till GHL", () => {
  const bas = (): Forslag =>
    ({
      foretagsnamn: funnet("Testbolaget AB", "schema", "https://test.se"),
      kontaktperson: tomt("saknas"),
      epost: funnet("info@test.se", "sajt", "https://test.se"),
      telefon: tomt("Ingen telefonlänk hittades."),
      adress: tomt("saknas"),
      postnummer: tomt("saknas"),
      ort: funnet("Söderhamn", "schema", "https://test.se"),
      land: funnet("SE", "standard", null),
      tidszon: funnet("Europe/Stockholm", "standard", null),
      hemsida: funnet("https://test.se", "sajt", "https://test.se"),
      bransch: funnet("Bygg", "harlett", "https://test.se"),
      tagline: tomt("saknas"),
      malgruppPrimar: tomt("saknas"),
      malgruppSekundar: tomt("saknas"),
      smartpunkter: tomt("saknas"),
      tonlage: tomt("saknas"),
      erbjudanden: funnet([{ namn: "Takbyte", pris: "från 45 000 kr" }], "sajt", "https://test.se"),
      kundcitat: tomt("saknas"),
      usp: tomt("saknas"),
      oppettider: tomt("saknas"),
      bokningslank: funnet("https://www.bokadirekt.se/places/testbolaget-999", "sajt", "https://test.se"),
      socialaLankar: tomt("saknas"),
      logotyp: tomt("saknas"),
      fargpalett: tomt("saknas"),
      gbpKategori: tomt("saknas"),
      gbpBetyg: tomt("saknas"),
      gbpAntalRecensioner: tomt("saknas"),
    }) as unknown as Forslag;

  // ★ Nycklarna är ASCII med FLIT: GHL härleder merge-taggen ur namnet vid skapandet och
  // slänger å/ä/ö ("Öppettider" → `custom_values.ppettider`), och taggen går inte att laga
  // i efterhand. Testet skrevs mot de svenska namnen och stod rött efter MALL-1 utan att
  // något var fel i koden — se lesson_nyskrivet_test_kan_ha_fel. Rättat 2026-08-09.
  it("tar med det som finns och utelämnar det som saknas", () => {
    const cv = byggCustomValues(bas());
    expect(cv["Foretagsnamn"]).toBe("Testbolaget AB");
    expect(cv["Ort"]).toBe("Söderhamn");
    expect(cv["Telefon"]).toBeUndefined();
    expect(cv["Adress"]).toBeUndefined();
  });

  // ONBOARD-3: bokningslänken går till GHL — det är den kunden klistrar in i DM och mejl.
  it("skickar bokningslänken till GHL när den är belagd", () => {
    const cv = byggCustomValues(bas());
    expect(cv["Bokningslank"]).toBe("https://www.bokadirekt.se/places/testbolaget-999");
  });

  // Nycklarna är ett kontrakt mot mallkontot: bara det som ska kunna klistras in i en DM,
  // ett mejl eller ett SMS bor i GHL. Tjänster och priser bor i hm_brand_profile — två
  // sanningar om samma sak glider isär, och den som glider är den ingen tittar på.
  it("skickar INTE tjänster och priser till GHL — de bor i varumärkesprofilen", () => {
    const cv = byggCustomValues(bas());
    expect(cv["Tjanster"]).toBeUndefined();
    expect(cv["Tjänster"]).toBeUndefined();
    expect(Object.keys(cv).every((k) => /^[\x20-\x7E]+$/.test(k))).toBe(true);
  });
});

// ── ONBOARD-3: Bokadirekt-källan ─────────────────────────────────────────────

describe("profilUrlFranLankar — bokningslänken hittas oavsett skrivsätt", () => {
  it("bygger profil-URL ur en djuplänk till en enskild tjänst", () => {
    expect(
      profilUrlFranLankar([
        "https://www.bokadirekt.se/boka-tjanst/gitte-ostling-for-balance-20545/forsta-motet-1044315",
      ]),
    ).toBe("https://www.bokadirekt.se/places/gitte-ostling-for-balance-20545");
  });

  // ★ Skarpt fall: Oppråby Gamla Skola länkar med å i slugen. Teckenklassen [a-z0-9-]
  //   missade den tyst och hela källan försvann för kunden som behövde den mest.
  it("tål svenska tecken i slugen (Oppråby)", () => {
    expect(
      profilUrlFranLankar(["https://bokadirekt.se/places/oppråby-gamla-skola-58298"]),
    ).toBe("https://www.bokadirekt.se/places/oppråby-gamla-skola-58298");
  });

  it("väljer den längsta slugen när samma id skrivs olika", () => {
    expect(
      profilUrlFranLankar([
        "https://www.bokadirekt.se/places/gitte-ostling-20545",
        "https://www.bokadirekt.se/places/gitte-ostling-for-balance-20545",
      ]),
    ).toBe("https://www.bokadirekt.se/places/gitte-ostling-for-balance-20545");
  });

  it("ger null när ingen bokadirekt-länk finns", () => {
    expect(profilUrlFranLankar(["https://www.facebook.com/nagon", "https://kund.se/boka"])).toBeNull();
  });
});

describe("bokadirektLankUrSidor — länken plockas ur lästa sidor, inte ur crawlen", () => {
  const sida = (over: Partial<OnboardSida>): OnboardSida =>
    ({ url: "https://kund.se/", html: null, text: "", via: "direkt", roll: "start", ...over }) as OnboardSida;

  it("hittar länken i HTML", () => {
    const s = sida({ html: `<a href="https://www.bokadirekt.se/places/oppråby-gamla-skola-58298">Boka</a>` });
    expect(bokadirektLankUrSidor([s])).toBe("https://www.bokadirekt.se/places/oppråby-gamla-skola-58298");
  });

  it("hittar länken i ren text när sidan kom via rendering (html = null)", () => {
    const s = sida({ via: "rendering", text: "Boka på https://www.bokadirekt.se/places/kund-123 idag" });
    expect(bokadirektLankUrSidor([s])).toBe("https://www.bokadirekt.se/places/kund-123");
  });

  it("ger null när sidorna saknar bokadirekt-länkar", () => {
    expect(bokadirektLankUrSidor([sida({ html: "<a href='/kontakt'>Kontakt</a>" })])).toBeNull();
  });
});

describe("postnummer-fallbacken — ett salongs-id är inte ett postnummer", () => {
  const sida = (text: string): OnboardSida =>
    ({ url: "https://kund.se/", html: null, text, via: "direkt", roll: "start" }) as OnboardSida;

  // ★ Skarpt fall: "gitte-ostling-for-balance-20545" i sidtexten gav postnummer 20545.
  it("FÖRKASTAR fem siffror som sitter i en slug", () => {
    const d = adressUrNod(null, null, [sida("Boka via gitte-ostling-for-balance-20545 Västerås idag")]);
    expect(harVarde(d.postnummer)).toBe(false);
  });

  it("läser fortfarande ett riktigt postnummer med ort", () => {
    const d = adressUrNod(null, null, [sida("Besök oss på Storgatan 1, 826 34 Söderhamn")]);
    expect(d.postnummer.varde).toBe("826 34");
    expect(d.ort.varde).toBe("Söderhamn");
  });
});

describe("steg 2 utan byråtoken — ett steg som inget hade att göra är inget fel", () => {
  // ★ Skarpt fall 11/8 (Oppråby): kontot fanns redan, steget gjorde ingenting, och
  //   markerade sig ändå som 'fel'. Slutstatusen blev 'fel' — och det unika indexet på
  //   `doman` undantar just status='fel', så DOMÄNLÅSET SLÄPPTE och nästa körning hade
  //   kunnat skapa en dubblett. Byråtoken behövs bara för att SKAPA ett konto.
  it("säger 'hoppade' när kontot redan finns", () => {
    const s = subAccountStegUtanByratoken("8IwLH9CFouvrI2oUO9Hc");
    expect(s.status).toBe("hoppade");
    expect(s.detalj).toContain("8IwLH9CFouvrI2oUO9Hc");
  });

  it("säger 'fel' när inget konto finns — då blockerar det faktiskt körningen", () => {
    expect(subAccountStegUtanByratoken(null).status).toBe("fel");
  });
});

describe("sluggify — svenska tecken blir läsbara slugs", () => {
  it("översätter å ä ö", () => {
    expect(sluggify("Åkes Måleri & Bygg")).toBe("akes-maleri-bygg");
    expect(sluggify("Söderhamns Däck")).toBe("soderhamns-dack");
  });
  it("ger alltid något användbart", () => {
    expect(sluggify("!!!")).toBe("kund");
  });
});

describe("rensaMarkdown behåller länkmål (mejl och telefon ligger där)", () => {
  it("plockar ut både text och mål", () => {
    const ut = rensaMarkdown("Kontakta [oss](mailto:info@test.se) idag");
    expect(ut).toContain("info@test.se");
    expect(ut).toContain("oss");
  });
});

// ── Djupgranskningens underlagsgrind ─────────────────────────────────────────
//
// ★ VARFÖR DEN FINNS: hämtningen av forbalance.se föll med HTTP 500 i VÅRT led.
//   `crawlSite` kastar inte — den returnerar homepageText: null. Generatorn bad modellen
//   om en rapport ändå, och fick en självsäker åtgärdslista ur ingenting, inklusive rådet
//   att kunden skulle kontakta sitt webbhotell om vårt eget serverfel.
describe("underlagDuger — ingen rapport utan underlag", () => {
  const bas = (over: Partial<SiteAudit>): SiteAudit =>
    ({
      root: "https://kund.se/", origin: "https://kund.se", pageCount: 3, pageCountForsokt: 3,
      misslyckade: [], homepageText: "x".repeat(900),
      ...over,
    }) as unknown as SiteAudit;

  it("VÄGRAR när ingen enda sida gick att läsa", () => {
    const d = underlagDuger(bas({
      pageCount: 0, pageCountForsokt: 4,
      misslyckade: [{ url: "https://kund.se/", status: 500, bytes: null, orsak: null, fel: "Internal Server Error" }],
    }));
    expect(d.duger).toBe(false);
    expect(d.varfor).toContain("500");
  });

  it("VÄGRAR när startsidan inte kunde läsas, även om andra sidor gick", () => {
    const d = underlagDuger(bas({ homepageText: null, pageCount: 2 }));
    expect(d.duger).toBe(false);
    expect(d.varfor).toContain("Startsidan");
  });

  it("VÄGRAR när startsidan svarade men var i praktiken tom", () => {
    expect(underlagDuger(bas({ homepageText: "Sidan är under uppbyggnad." })).duger).toBe(false);
  });

  // Tröskeln får inte bli en kvalitetsdom: en enkel ensidig företagssajt ska gå att granska.
  it("SLÄPPER IGENOM en tunn men verklig ensidig sajt", () => {
    const d = underlagDuger(bas({ pageCount: 1, pageCountForsokt: 1, homepageText: "y".repeat(250) }));
    expect(d.duger).toBe(true);
    expect(d.varfor).toBeNull();
  });
});
