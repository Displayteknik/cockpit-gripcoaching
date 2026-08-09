import { describe, it, expect } from "vitest";
import { citatFinns } from "@/lib/onboard/harled";
import { stadaOrt } from "@/lib/onboard/extrahera";
import { normalisera, klassaRoll } from "@/lib/onboard/upptack";
import { domanAv, sluggify, byggCustomValues } from "@/lib/onboard/provisionera";
import { funnet, tomt, harVarde, type Forslag } from "@/lib/onboard/typer";
import { rensaMarkdown } from "@/lib/onboard/hamta";

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
