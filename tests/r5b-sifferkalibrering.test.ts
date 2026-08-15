// R-5b — de tre kalibreringsfelen i siffergrinden (Håkans granskning av Makzy-rapporten).
//
// Varje fall här är hämtat ur den SKARPA rapporten (asset 45bf59c4, 14/8), inte påhittat.
// Före-läget: sex luckor, och alla sex var kalibreringsfel — inte en enda av dem var en
// uppgift Makzy skulle fylla i. Skarp mätning: `scripts/r5b-dod.mts`.
import { describe, it, expect } from "vitest";
import {
  grindaSiffror, arStrukturtal, arSeoFakta, arCrawlMatvarde, arTenantTal, radRunt,
} from "@/lib/deep-audit-siffror";

/** Makzys verkliga underlag: 59 belagda tal, inget GSC-data, ett litet kunskapsfält. */
const indata = (belagda: string[] = []) => ({
  belagda: new Set(belagda),
  kunskapsfalt: null,
  gscTal: new Set<string>(),
});

/** Kör grinden på en rad och svara: rördes texten, och hur många beslut föll? */
const kor = (rad: string, belagda: string[] = []) => {
  const r = grindaSiffror(rad, indata(belagda));
  return { text: r.text, beslut: r.beslut, luckor: r.luckor.map((l) => l.tal) };
};

describe("R-5b punkt 1 · strukturtal undantas helt", () => {
  it("listnumrering står kvar och ger inget beslut", () => {
    const rad = "  4. Kontrollera att bara EN H1 finns kvar per sida";
    const r = kor(rad);
    expect(r.text).toBe(rad);
    expect(r.beslut).toHaveLength(0);
  });

  it("rubriknumrering står kvar", () => {
    // Skarpt fall: "## 4. Inga kundcitat …" blev "## [DIN SIFFRA]. Inga kundcitat …"
    const rad = "## 4. Inga kundcitat eller konkreta siffror, Ger leads";
    expect(kor(rad).text).toBe(rad);
  });

  it("rubriknumreringen tas, men mätvärdet i samma rubrik döms", () => {
    // "## 5. 51 bilder saknar alt-text" — femman är numrering, 51 är en mätning.
    const rad = "## 5. 51 bilder saknar alt-text";
    const r = kor(rad);
    expect(r.text).toBe(rad);
    expect(r.beslut.map((b) => b.tal)).toEqual(["51"]);
  });

  it("tabellens radnummer står kvar, men innehållet i raden döms", () => {
    const rad = "| 7 | Så här mäter du för måttbeställda gardiner | mäta gardiner |";
    const r = kor(rad);
    expect(r.text).toBe(rad);
    expect(r.beslut).toHaveLength(0);
  });

  it("en tabellcell som INTE bara är ett tal döms som vanligt", () => {
    // "| Startsida | 59 tecken ✅ | …" — 59 är ett mätvärde, inte ett radnummer.
    const rad = "| Startsida | 59 tecken | static |";
    expect(kor(rad).beslut.map((b) => b.tal)).toContain("59");
  });

  it("datumet i sidhuvudet ger inga beslut", () => {
    const rad = "**Datum:** 2026-08-14";
    const r = kor(rad);
    expect(r.text).toBe(rad);
    expect(r.beslut).toHaveLength(0);
  });

  it("skrivet datum räknas som datum", () => {
    expect(kor("Rapporten skrevs 14 augusti 2026.").beslut).toHaveLength(0);
  });

  it("FAQ-numrering står kvar", () => {
    const rad = "**Fråga 4:** Syr ni bara gardiner, eller även kuddar och dukar?";
    expect(kor(rad).text).toBe(rad);
  });

  it("UNDANTAGET GÄLLER PLATSEN, INTE TALET", () => {
    // Hela poängen: samma fyra som är rubriknumrering på en rad är ett påstående på en
    // annan. Före R-5b gav rubriken beslutet, och beslutet gällde hela dokumentet.
    const r = kor("Leveranstiden är vanligtvis 4 veckor från godkänd offert.");
    expect(r.luckor).toContain("4");
    expect(r.text).toContain("[DIN SIFFRA] veckor");
  });

  it("poängkolumnen 78/72 läses inte som ett datum", () => {
    // ⚠ Mätt under bygget: den lösa datumformen tog "78/72" och undantog HELA raden,
    //   alltså fem mätvärden på en gång.
    const rad = "| Startsida | 59 tecken | 143 | 78/72 |";
    const tal = kor(rad).beslut.map((b) => b.tal);
    expect(tal).toEqual(expect.arrayContaining(["78", "72", "143"]));
  });

  it("arStrukturtal läser positionen, inte raden", () => {
    const rad = "## 5. 51 bilder saknar alt-text";
    expect(arStrukturtal(rad, rad.indexOf("5."), "5")).toBe(true);
    expect(arStrukturtal(rad, rad.indexOf("51"), "51")).toBe(false);
  });

  it("radRunt hittar rätt rad i en flerradig text", () => {
    const text = "första raden\n  2. andra raden\ntredje";
    const { rad, iRaden } = radRunt(text, text.indexOf("2."));
    expect(rad).toBe("  2. andra raden");
    expect(iRaden).toBe(2);
  });
});

describe("R-5b punkt 2 · generisk SEO-fakta är branschfakta", () => {
  it("meta-beskrivningens 150-160 tecken maskas inte", () => {
    // Skarpt fall: blev "max cirka [DIN SIFFRA] tecken" i ordlistan — och eftersom
    // beslutet gäller per tal maskades även "över 150 tyger" längre ned i rapporten.
    const rad = "| Meta-beskrivning | Texten under titeln i Google-resultatet, max cirka 150-160 tecken |";
    const r = kor(rad);
    expect(r.text).toBe(rad);
    expect(r.luckor).toHaveLength(0);
    expect(r.beslut.every((b) => b.klass === "B" && b.utfall === "belagt")).toBe(true);
  });

  it("sidtitelns 50-60 tecken är också fakta", () => {
    expect(kor("Sidtiteln bör vara 50-60 tecken lång.").luckor).toHaveLength(0);
  });

  it("statuskoder är fakta", () => {
    expect(kor("En 301 är en permanent omdirigering, en 404 betyder att sidan saknas.").luckor).toHaveLength(0);
  });

  it("källan namnger vilken standard det gäller", () => {
    const b = kor("Meta-beskrivningen kapas efter cirka 160 tecken.").beslut[0];
    expect(b.kalla).toContain("generisk SEO-standard");
    expect(b.kalla).toContain("meta-beskrivningen");
  });

  it("faktalistan är kort med flit: ett tal utan känt gränsvärde är ingen fakta", () => {
    expect(arSeoFakta("Meta-beskrivningen är 319 tecken lång.", "319")).toBeNull();
  });

  it("ett tal utan SEO-term är ingen SEO-fakta", () => {
    expect(arSeoFakta("Vi har 160 kunder i Norrköping.", "160")).toBeNull();
  });
});

describe("R-5b punkt 3 · crawlens egna mätvärden är alltid belagda", () => {
  it("bildantalet maskas inte", () => {
    // Skarpt fall: "51 av 58 bilder saknar beskrivning" blev "51 av [DIN SIFFRA] bilder".
    const rad = "| Alt-text | 51 av 58 bilder saknar beskrivning |";
    const r = kor(rad);
    expect(r.text).toBe(rad);
    expect(r.luckor).toHaveLength(0);
    expect(r.beslut.map((b) => b.klass)).toEqual(["C", "C"]);
  });

  it("ordantalet maskas inte", () => {
    expect(kor("Alla sidor är tunna, mellan 111 och 180 ord.").luckor).toHaveLength(0);
  });

  it("källan säger att det är VÅR mätning", () => {
    expect(kor("Sajten har 6 interna länkar per sida i snitt.").beslut[0].kalla)
      .toContain("crawlens egen mätning");
  });

  it("tenantens eget påstående vinner över mätordet", () => {
    // "sida" finns i meningen, men "kr" och "från" gör talet till ett pris.
    const mening = "Våra priser börjar från 500 kr per sida.";
    expect(arTenantTal(mening)).toBe(true);
    expect(kor(mening).luckor).toContain("500");
  });

  it("arCrawlMatvarde kräver ett mätord", () => {
    expect(arCrawlMatvarde("Vi har levererat 47 uppdrag.")).toBe(false);
    expect(arCrawlMatvarde("Sajten har 12 sidor.")).toBe(true);
  });
});

describe("R-5b · två fel till som den OMKÖRDA rapporten visade (15/8)", () => {
  it("postnumret i adressen maskas inte", () => {
    const rad = "Kontrollera att adressen står rätt: Husby, 602 95 Norrköping.";
    expect(kor(rad).text).toBe(rad);
  });

  it("rapportens egen tidsuppskattning maskas inte", () => {
    // "## Steg 2, vecka 2-3 → ~4 timmar" blev "→ ~[DIN SIFFRA] timmar". Kunden kan inte
    // fylla i vår egen uppskattning av hur lång tid VÅRT åtgärdsförslag tar.
    expect(kor("## Steg 2, vecka 2-3 → ~4 timmar").luckor).toHaveLength(0);
    expect(kor("- **Tid:** ~30 min (för alla 51 bilder)").luckor).toHaveLength(0);
  });

  it("men ett påstående om verksamheten grindas fortfarande", () => {
    // Tildet är signalen, inte ordet "cirka" — annars hade varje påhittad leveranstid
    // sluppit igenom bara den skrevs ungefärligt.
    expect(kor("Första mötet tar cirka 30 minuter.").luckor).toContain("30");
    expect(kor("Leveranstiden är vanligtvis 4 veckor.").luckor).toContain("4");
  });
});

describe("R-5b · det som INTE fick ändras", () => {
  it("ett obackat tenant-tal blir fortfarande en lucka", () => {
    expect(kor("Vi har levererat 47 projekt sedan starten.").luckor).toContain("47");
  });

  it("ett belagt tal står kvar", () => {
    expect(kor("Vi syr av över 200 tyger.", ["200"]).luckor).toHaveLength(0);
  });

  it("branschfakta utan kunskapsfält märks fortfarande som riktvärde", () => {
    expect(kor("En vanlig TV har 300 nits.").text).toContain("riktvärde");
  });

  it("telefonnumret i ett kundcitat rörs inte", () => {
    const rad = "Ring oss på 070 498 15 22 så hjälper vi dig.";
    expect(kor(rad).text).toBe(rad);
  });
});
