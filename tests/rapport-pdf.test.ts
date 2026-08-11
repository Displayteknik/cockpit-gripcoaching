import { describe, it, expect } from "vitest";
import { byggRapportHtml, lasStatusTabell, lasFynd, lasTider } from "@/lib/seo/rapport-pdf";

// Grafiken i rapporten ritas ENBART ur det som redan står i texten. Testerna nedan skyddar
// den kopplingen: går parsningen sönder ska figuren försvinna, aldrig visa fel siffror.

const RAPPORT = `# SEO & AEO-rapport — Testklienten (https://test.se)

**Datum:** 2026-08-11
**Vad jag granskat:** hela sajten (1 sida) + ingen Google-sökdata (ny sajt)

---

# Det här fungerar redan (nuläge)

| Område | Status | Kommentar |
|---|---|---|
| Robots.txt | ✅ | Finns och blockerar inte sajten |
| Title | ⚠️ | Finns men för kort (3 tecken: "Hem") |
| Meta-beskrivning | ❌ | Saknas helt |
| Bilder alt-text | ❌ | 12 av 17 bilder saknar alt-text |
| Ordmängd | ✅ | 1057 ord — bra grundmängd text |

# Det som hindrar dig i Google

## 1. Allt innehåll ligger på en sida — du syns inte — Ger leads
- **Tid:** ~15 min

## 2. Canonical saknas — Teknisk hygien
- **Tid:** ~10 min

# Att göra — i prioritetsordning

## Steg 1 — denna vecka (snabbt + störst effekt) → ~4 timmar

1. Gör det här

## Steg 2 — vecka 2-3 → ~2 timmar

1. Sedan det här

## Steg 3 — månad 2 → ~1,5 timmar

1. Till sist det här

## Löpande

1. Ingen tid angiven — ska inte bli en stapel
`;

describe("lasStatusTabell — nulägets siffror kommer ur tabellen, inte ur luften", () => {
  it("läser område, status och kommentar per rad", () => {
    const r = lasStatusTabell(RAPPORT);
    expect(r).toHaveLength(5);
    expect(r[0]).toEqual({ omrade: "Robots.txt", status: "god", kommentar: "Finns och blockerar inte sajten" });
  });

  it("skiljer på de tre statusmärkena", () => {
    const r = lasStatusTabell(RAPPORT);
    expect(r.filter((x) => x.status === "god")).toHaveLength(2);
    expect(r.filter((x) => x.status === "varning")).toHaveLength(1);
    expect(r.filter((x) => x.status === "kritisk")).toHaveLength(2);
  });

  it("tar inte med avgränsarraden eller rubrikraden", () => {
    expect(lasStatusTabell(RAPPORT).map((r) => r.omrade)).not.toContain("Område");
  });

  it("ger tom lista när ingen tabell finns — då ritas ingen figur", () => {
    expect(lasStatusTabell("# Rubrik\n\nBara text.")).toEqual([]);
  });
});

describe("lasFynd — effektklassen skiljs från rubriken", () => {
  it("delar på sista tankstrecket", () => {
    const f = lasFynd(RAPPORT);
    expect(f).toHaveLength(2);
    expect(f[0].rubrik).toBe("Allt innehåll ligger på en sida — du syns inte");
    expect(f[0].kategori).toBe("Ger leads");
    expect(f[1].kategori).toBe("Teknisk hygien");
  });
});

describe("lasTider — skiljetecknet före tiden är en PIL, inte ett tankstreck", () => {
  // Mönstret delade först på tankstreck. Etiketterna INNEHÅLLER tankstreck, så ingenting
  // matchade och tidsfiguren försvann tyst. Exakt den sortens tysta tomhet som ska testas.
  it("hittar alla tre stegen trots tankstreck i etiketten", () => {
    const t = lasTider(RAPPORT);
    expect(t).toHaveLength(3);
    expect(t.map((x) => x.minuter)).toEqual([240, 120, 90]);
  });

  it("klipper bort parentesen ur etiketten", () => {
    expect(lasTider(RAPPORT)[0].steg).toBe("Steg 1 — denna vecka");
  });

  it("hoppar över steg utan tidsangivelse", () => {
    expect(lasTider(RAPPORT).map((t) => t.steg)).not.toContain("Löpande");
  });

  it("förstår både minuter och timmar, och decimalkomma", () => {
    expect(lasTider(RAPPORT)[2]).toMatchObject({ minuter: 90, text: "1,5 tim" });
  });
});

describe("byggRapportHtml — dokumentet", () => {
  const html = byggRapportHtml(RAPPORT, { klientNamn: "Testklienten", url: "https://test.se", primarFarg: "#8FBFA9" });

  it("sätter kundens namn i omslaget och i titeln", () => {
    expect(html).toContain("Så syns Testklienten");
    expect(html).toContain("<title>SEO- och AEO-rapport — Testklienten</title>");
  });

  it("ritar översikten med siffror ur rapporten", () => {
    expect(html).toContain("Nuläget — 5 kontrollerade områden");
    expect(html).toContain("1057");
    expect(html).toContain("12/17");
  });

  it("bär statusfärg OCH ikon OCH ord — färgen ensam får aldrig betyda något", () => {
    expect(html).toContain("#0ca30c");
    expect(html).toMatch(/Klart|klart/);
    expect(html).toContain("Åtgärda");
  });

  it("summerar tiden korrekt i figurens rubrik", () => {
    expect(html).toContain("7,5 timmar totalt");
  });

  it("dubblerar inte rapportens eget huvud under omslaget", () => {
    // Titelraden lyfts ur brödtexten — annars står rubriken två gånger på första sidan.
    expect(html.match(/SEO &amp; AEO-rapport — Testklienten/g) ?? []).toHaveLength(0);
  });

  // ★ Rapporten går rakt in i ett dokument kunden lämnar ifrån sig. Ett skript som slinker
  //   igenom vore en läcka i kundens namn, inte bara ett fult tecken.
  it("escapar HTML i rapporttexten", () => {
    const h = byggRapportHtml("# T\n\nEtt <script>alert(1)</script> och <b>fet</b>.", {
      klientNamn: "X", url: "https://x.se", primarFarg: "#000000",
    });
    expect(h).not.toContain("<script>alert(1)</script>");
    expect(h).toContain("&lt;script&gt;");
  });

  it("escapar även kundnamnet", () => {
    const h = byggRapportHtml("# T", { klientNamn: '"><script>x</script>', url: "", primarFarg: "#000000" });
    expect(h).not.toContain("<script>x</script>");
  });

  it("vägrar en påhittad färg och faller tillbaka på standard", () => {
    const h = byggRapportHtml("# T", { klientNamn: "X", url: "", primarFarg: "javascript:alert(1)" });
    expect(h).not.toContain("javascript:");
    expect(h).toContain("#1A6B3C");
  });

  it("klarar en rapport helt utan tabell — då ritas ingen översikt", () => {
    const h = byggRapportHtml("# Rubrik\n\nBara löptext utan tabell.", {
      klientNamn: "X", url: "https://x.se", primarFarg: "#8FBFA9",
    });
    expect(h).not.toContain("Nuläget —");
    expect(h).toContain("Bara löptext");
  });

  it("bevarar kodblock ordagrant — de färdiga texterna ska gå att kopiera", () => {
    const h = byggRapportHtml('# T\n\n```json\n{"@type": "LocalBusiness"}\n```', {
      klientNamn: "X", url: "", primarFarg: "#000000",
    });
    expect(h).toContain("{&quot;@type&quot;: &quot;LocalBusiness&quot;}");
  });
});
