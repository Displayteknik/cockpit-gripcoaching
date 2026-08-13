// RAPPORT-1 — djupgranskningen ska bli pålitlig nog att visa för kund.
//
// Bakgrund (Håkans beställning 13/8): rapporten för forbalance.se var pedagogiskt stark
// men byggde på ett falskt sakpåstående. Den påstod att sajten har 3 sidor och att alla
// behandlingar bor på startsidan. Sajten har 17 URL:er, och rapportens dyraste
// rekommendation ("skapa fem undersidor") vilade därför på ett crawlfel.
//
// R-0 mätte rotorsakerna:
//   1. `crawlSite` byggde sidlistan ENBART på /sitemap.xml och följde aldrig en länk.
//   2. forbalance.se:s /sitemap.xml ÄR ett index. De två <loc>-värdena är sitemapFILER,
//      och de crawlades som om de vore sidor. Därav "3 sidor".
//   3. Sajten svarar 500 på varje cache-miss, för ALLA user-agents (även Chrome och
//      Googlebot). Det är sajtens fel, inte vår identitet.
//   4. robots.txt spärrar ett 40-tal AI-robotar, medan rapporten rekommenderade att
//      synas i ChatGPT och Perplexity.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { analyseraAiRobots, aiRobotsAtgard, parsaGrupper } from "@/lib/seo/ai-robots";
import { arMaskinfil, lankarIHtml, socialaProfilerIHtml, normalisera } from "@/lib/lankupptackt";
import { bedomTackning, hittaInkonsistens } from "@/lib/deep-audit-tackning";
import { byggBlockeringsrapport } from "@/lib/deep-audit-blockering";
import {
  granskaRapport, saneraTankstreck, delaVidKlistraIn, luckorForObackadeSiffror,
  markeraPlatshallarcitat, tillatnaTalFranKallor,
} from "@/lib/deep-audit-granska";
import { plattformIText, plattformKundnamn, oversattPlattformIText } from "@/lib/plattform-namn";
import type { SiteAudit } from "@/lib/seo-deep";

const las = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

// ── R-1: EN länkupptäckt ─────────────────────────────────────────────────────
describe("R-1 · en enda länkupptäckt i hela plattformen", () => {
  it("onboardingen bygger ingen egen upptäckt längre", () => {
    const upptack = las("lib/onboard/upptack.ts");
    expect(upptack).toContain('from "@/lib/lankupptackt"');
    // Den gamla lokala sitemapläsningen är borta, inte kopierad.
    expect(upptack).not.toContain("async function sitemapUrler");
  });

  it("varningen om att SEO-motorn gör fel är borttagen — den är inte sann längre", () => {
    // Kunskapen fanns i kodbasen som en KOMMENTAR i stället för som delad kod. Det var
    // precis så buggen kunde uppstå.
    const upptack = las("lib/onboard/upptack.ts");
    expect(upptack).not.toContain("bygger sin sidlista ENBART");
  });

  it("djupgranskningen läser inte längre sitemap på egen hand", () => {
    const deep = las("lib/seo-deep.ts");
    expect(deep).not.toContain("async function fetchSitemapUrls");
    expect(deep).toContain("upptackUrler");
  });

  it("filtret är konfiguration per konsument: onboardingen tar bort bloggen, granskningen behåller den", () => {
    const upptack = las("lib/onboard/upptack.ts");
    const deep = las("lib/seo-deep.ts");
    expect(upptack).toContain("hoppaMonster: [SKIP_MONSTER, SKIP_MASKIN]");
    // Djupgranskningen skickar INGET hoppaMonster: bloggen ska granskas.
    const anrop = deep.slice(deep.indexOf("await upptackUrler("), deep.indexOf("await upptackUrler(") + 260);
    expect(anrop).not.toContain("hoppaMonster");
  });
});

describe("R-1 · sitemap-index läses som index, inte som sidlista", () => {
  it("XML-filer räknas som maskinfiler och kan aldrig bli sidor", () => {
    // forbalance-buggen i en rad: sitemap_pages.xml och sitemap_blog.xml crawlades som sidor.
    expect(arMaskinfil("https://forbalance.se/sitemap_pages.xml")).toBe(true);
    expect(arMaskinfil("https://forbalance.se/sitemap_blog.xml")).toBe(true);
    expect(arMaskinfil("https://forbalance.se/broschyr.pdf")).toBe(true);
    expect(arMaskinfil("https://forbalance.se/om-gitte")).toBe(false);
    expect(arMaskinfil("https://forbalance.se/blog/lugnets-vag")).toBe(false);
  });

  it("länkar plockas även ur JS-payload (client-side-renderad meny)", () => {
    const payload = `{"html":"\\u003Ca href=\\"/om-gitte\\"\\u003EOm\\u003C/a\\u003E"}`;
    expect(lankarIHtml(payload, "https://forbalance.se")).toContain("https://forbalance.se/om-gitte");
  });

  it("normaliseringen gör /x, /x/ och /x?utm till samma sida", () => {
    const o = "https://kund.se";
    expect(normalisera("/kontakt/", o)).toBe(normalisera("/kontakt?utm=a", o));
  });

  it("sociala profiler plockas ur sajtens egen HTML, inte ur gissningar", () => {
    const html = `<a href="https://www.facebook.com/gitte4balance">FB</a>
      <a href="https://instagram.com/forbalancegitte">IG</a>
      <a href="https://www.facebook.com/sharer/sharer.php?u=x">dela</a>`;
    const funna = socialaProfilerIHtml(html);
    expect(funna).toContain("https://www.facebook.com/gitte4balance");
    expect(funna).toContain("https://instagram.com/forbalancegitte");
    expect(funna.some((f) => f.includes("sharer"))).toBe(false);
  });
});

// ── R-1/beslut 2: täckningsgrinden ───────────────────────────────────────────
const bas = (over: Partial<SiteAudit>): SiteAudit =>
  ({
    root: "https://kund.se/", origin: "https://kund.se", pageCount: 5, pageCountForsokt: 5,
    misslyckade: [], homepageText: "x".repeat(900), sitemapFel: null, sitemapUrlCount: 5,
    upptackt: { franSitemap: [], franLankar: [], sitemapArIndex: false, barnSitemaps: [], bortfiltrerade: [], overTaket: [], maxPages: 25 },
    aiRobots: analyseraAiRobots("User-agent: *\nAllow: /"),
    socialaProfiler: [], pages: [], domainRedirect: { primaryHost: "kund.se", redirectWorks: true, note: "ok" },
    ...over,
  }) as unknown as SiteAudit;

describe("R-1 · täckningsgrinden har TRE utfall", () => {
  it("full täckning ger vanlig rapport", () => {
    expect(bedomTackning(bas({})).utfall).toBe("full");
  });

  it("partiell täckning ger blockeringsrapport, inte avbrott", () => {
    // Dagens forbalance-läge: startsidan ligger i cachen och svarar, undersidorna 500:ar.
    const dom = bedomTackning(bas({
      pageCount: 1, pageCountForsokt: 4,
      misslyckade: [
        { url: "https://kund.se/om", status: 500, bytes: 0, orsak: "http", fel: "HTTP 500" },
        { url: "https://kund.se/zon", status: 500, bytes: 0, orsak: "http", fel: "HTTP 500" },
        { url: "https://kund.se/blog", status: 500, bytes: 0, orsak: "http", fel: "HTTP 500" },
      ],
    }));
    expect(dom.utfall).toBe("partiell");
    expect(dom.ejLasta).toHaveLength(3);
    expect(dom.huvudfel?.status).toBe(500);
    expect(dom.huvudfel?.monster).toContain("500");
  });

  it("totalfel när inte ens startsidan gick att läsa", () => {
    expect(bedomTackning(bas({ pageCount: 0, homepageText: null })).utfall).toBe("totalfel");
    expect(bedomTackning(bas({ homepageText: null, pageCount: 2 })).utfall).toBe("totalfel");
    expect(bedomTackning(bas({ homepageText: "Under uppbyggnad." })).utfall).toBe("totalfel");
  });

  it("en oläsbar sitemap räknas som partiell — den kan dölja sidor vi aldrig försökte hämta", () => {
    expect(bedomTackning(bas({ sitemapFel: "sitemap.xml gav HTTP 500" })).utfall).toBe("partiell");
  });

  it("taket fäller INTE körningen, men redovisas", () => {
    const dom = bedomTackning(bas({
      upptackt: { ...bas({}).upptackt, overTaket: ["https://kund.se/sida26", "https://kund.se/sida27"] },
    }));
    expect(dom.utfall).toBe("full");
    expect(dom.overTaket).toHaveLength(2);
  });
});

describe("R-1 · blockeringsrapporten säger vad som är fel, inte 'kan ej leverera'", () => {
  const dom = bedomTackning(bas({
    pageCount: 1, pageCountForsokt: 3,
    misslyckade: [
      { url: "https://forbalance.se/om-gitte", status: 500, bytes: 0, orsak: "http", fel: "HTTP 500" },
      { url: "https://forbalance.se/zon", status: 500, bytes: 0, orsak: "http", fel: "HTTP 500" },
    ],
    pages: [{ url: "https://forbalance.se/", ejMattOrsak: null, title: "For Balance", titleLength: 12, h1: "Välkommen", schemaTypes: [], wordCount: 907 }] as never,
  }));
  const md = byggBlockeringsrapport(
    bas({ pageCount: 1, pageCountForsokt: 3, pages: [{ url: "https://forbalance.se/", ejMattOrsak: null, title: "For Balance", titleLength: 12, h1: "Välkommen", schemaTypes: [], wordCount: 907 }] as never }),
    dom,
    { klientnamn: "For Balance", url: "https://forbalance.se", datum: "2026-08-13", plattform: "Hemsida24" },
  );

  it("serverfelet är fynd nummer ett, i klarspråk", () => {
    expect(md).toContain("Det viktigaste först");
    expect(md).toMatch(/1\.\s+\*\*Din server svarar med fel/);
  });

  it("konsekvensen för Google står med — det är därför det är brådskande", () => {
    expect(md).toContain("Googles robot");
    expect(md).toContain("tappas");
  });

  it("varje oläsbar adress listas", () => {
    expect(md).toContain("https://forbalance.se/om-gitte");
    expect(md).toContain("https://forbalance.se/zon");
  });

  it("kunden får veta VEM hon ska kontakta, med sitt eget plattformsnamn", () => {
    expect(md).toContain("Hemsida24");
    expect(md).not.toContain("BaseKit");
  });

  it("INGA innehållsrekommendationer, inga klistra-in-texter, ingen innehållsplan", () => {
    // Rubrikerna får inte finnas. Att RÄKNA UPP dem som saknade är däremot hela poängen:
    // kunden ska veta exakt vad hon får när servern är lagad.
    expect(md).not.toMatch(/^#{1,3}\s*Färdiga texter att klistra in/m);
    expect(md).not.toMatch(/^#{1,3}\s*Innehållsplan/m);
    expect(md).toContain("Det här kan vi inte säga något om ännu");
    expect(md).toContain("- Färdiga texter att klistra in");
  });

  it("noll tankstreck", () => {
    expect(md.match(/[–—]/g)).toBeNull();
  });
});

// ── R-2: sanningsgrind och skrivregler ───────────────────────────────────────
describe("R-2 · skrivreglerna gäller hela rapporten", () => {
  it("rapportgeneratorn går genom skrivreglerna", () => {
    const gen = las("lib/deep-audit-generate.ts");
    expect(gen).toContain("WRITING_RULES_BLOCK");
    expect(gen).toContain("SIFFER_SKARPNING");
  });

  it("tankstreck saneras i löptext men kodblock lämnas orörda", () => {
    const md = 'Titeln är för lång — kapas troligen.\n\n```json\n{"namn":"A — B"}\n```\n';
    const ut = saneraTankstreck(md);
    expect(ut.text).toContain("Titeln är för lång, kapas troligen.");
    expect(ut.text).toContain('{"namn":"A — B"}'); // schemat rörs inte
    expect(ut.antal).toBe(1);
  });

  it("markdown-tabeller överlever saneringen", () => {
    const md = "| Område | Status |\n|---|---|\n| Titel | ok |\n";
    expect(saneraTankstreck(md).text).toContain("|---|---|");
  });
});

describe("R-2 · siffergrinden på klistra-in-texterna", () => {
  const tillatna = new Set(tillatnaTalFranKallor("Kursen kostar 1 200 kr och pågår i 7 veckor. Max 9 deltagare."));

  it("hittar var de färdiga texterna börjar", () => {
    const { fore, efter } = delaVidKlistraIn("# Rapport\n\ntext\n\n# Färdiga texter att klistra in\n\nFAQ\n");
    expect(fore).toContain("# Rapport");
    expect(efter).toContain("FAQ");
  });

  it('"en serie om tio tillfällen" hade ALDRIG passerat', () => {
    // Det verkliga fabricerade påståendet ur 13/8-rapporten, skrivet med bokstäver.
    const { text, luckor } = luckorForObackadeSiffror("Vi erbjuder en serie om tio tillfällen, varannan vecka.", tillatna);
    expect(text).toContain("[DIN SIFFRA]");
    expect(luckor.length).toBeGreaterThan(0);
  });

  it("siffror utan källa blir luckor, siffror med källa står kvar", () => {
    const { text } = luckorForObackadeSiffror("Max 8 deltagare, kursen pågår i 7 veckor.", tillatna);
    expect(text).toContain("[DIN SIFFRA] deltagare"); // 8 saknar källa (Bokadirekt säger 9)
    expect(text).toContain("7 veckor");               // 7 finns i underlaget
  });

  it("exempelcitat markeras som platshållare som måste bytas", () => {
    const md = '"Jag kände skillnad direkt och sover bättre än på flera år."\n\nAnna, 42\n';
    const { text, funna } = markeraPlatshallarcitat(md);
    expect(funna).toContain("Anna, 42");
    expect(text).toContain("PLATSHÅLLARE");
    expect(text).toContain("innan du publicerar");
  });
});

describe("R-2 · plattformsnamnet är det kunden loggar in i", () => {
  it("BaseKit visas som Hemsida24", () => {
    expect(plattformKundnamn("BaseKit")).toBe("Hemsida24");
    expect(oversattPlattformIText("Logga in i BaseKit och ändra titeln.").text).toContain("Hemsida24");
  });

  it("GoHighLevel visas som MySales — samma fel, våra egna kunder", () => {
    expect(plattformKundnamn("GoHighLevel")).toBe("MySales");
  });

  it("okänd plattform skrivs som 'din webbplattform', aldrig som en gissning", () => {
    expect(plattformIText("okänd")).toBe("din webbplattform");
    expect(plattformIText(null)).toBe("din webbplattform");
  });
});

describe("R-2 · rapporten får inte motsäga sin egen sidlista", () => {
  it("fångar hänvisning till bloggposter när crawlen inte hittade någon blogg", () => {
    // 13/8-rapporten gjorde exakt det: hänvisade till "bloggposterna" och påstod
    // samtidigt att sajten har tre sidor.
    const traffar = hittaInkonsistens(
      "Lägg internlänkar i dina blogginlägg till startsidan.",
      ["https://kund.se/", "https://kund.se/om"],
    );
    expect(traffar.length).toBe(1);
  });

  it("ingen falsklarm när bloggen faktiskt crawlades", () => {
    const traffar = hittaInkonsistens(
      "Lägg internlänkar i dina blogginlägg till startsidan.",
      ["https://kund.se/", "https://kund.se/blog/lugnets-vag"],
    );
    expect(traffar).toHaveLength(0);
  });
});

describe("R-2 · hela grinden i ett svep", () => {
  it("rättar språk, siffror, plattform och citat i samma körning", () => {
    const md = [
      "# Rapport", "", "Logga in i BaseKit — det tar tio minuter.", "",
      "# Färdiga texter att klistra in", "",
      "Vi erbjuder en serie om tio tillfällen.", "",
      '"Det förändrade allt för mig, jag rekommenderar det till alla."', "", "Anna, 42", "",
    ].join("\n");
    const g = granskaRapport(md, { tillatnaTal: ["45"], crawladeUrler: ["https://kund.se/"] });

    expect(g.text.match(/[–—]/g)).toBeNull();
    expect(g.text).toContain("Hemsida24");
    expect(g.text).toContain("[DIN SIFFRA]");
    expect(g.text).toContain("PLATSHÅLLARE");
    // R-5: lucklistan har kontext numera (sida, sektion och meningen talet står i).
    expect(g.text).toContain("Siffror du behöver fylla i");
    expect(g.avvikelser.map((a) => a.typ)).toEqual(
      expect.arrayContaining(["tankstreck", "plattformsnamn", "obackad-siffra", "platshallare"]),
    );
  });

  it("grinden körs på ALLT som kommer tillbaka från batchen", () => {
    expect(las("lib/deep-audit-finalize.ts")).toContain("granskaRapport(text");
  });
});

// ── R-3: AEO-teknikkontrollen ────────────────────────────────────────────────
describe("R-3 · släpper robots.txt in AI-sökmotorerna?", () => {
  // Formen forbalance.se använder: många User-agent-rader i följd, ETT Disallow.
  const FORBALANCE = [
    "Sitemap: https://forbalance.se/sitemap.xml",
    "User-agent: anthropic-ai", "User-agent: ClaudeBot", "User-agent: GPTBot",
    "User-agent: CCBot", "User-agent: Google-Extended", "User-agent: PerplexityBot",
    "Disallow: /", "", "User-agent: *", "Allow: /",
  ].join("\n");

  it("flera user-agent-rader i följd delar samma regler", () => {
    const g = parsaGrupper(FORBALANCE);
    expect(g[0].agenter.length).toBe(6);
    expect(g[0].regler).toEqual([{ typ: "disallow", vag: "/" }]);
    expect(g[1].agenter).toEqual(["*"]);
  });

  it("fångar det verkliga fallet: AI-robotarna spärrade, vanliga robotar insläppta", () => {
    const dom = analyseraAiRobots(FORBALANCE);
    expect(dom.matt).toBe(true);
    expect(dom.blockerade).toContain("GPTBot");
    expect(dom.blockerade).toContain("ClaudeBot");
    expect(dom.blockerade).toContain("PerplexityBot");
    expect(dom.allaBlockerade).toBe(false);
    expect(dom.sammanfattning).toContain("spärrade");
  });

  it("grön bock när robotarna släpps in", () => {
    const dom = analyseraAiRobots("User-agent: *\nAllow: /");
    expect(dom.blockerade).toHaveLength(0);
    expect(dom.sammanfattning).toContain("släpps in");
  });

  it("robots.txt som inte kunde läsas ger INGET påstående", () => {
    const dom = analyseraAiRobots(null);
    expect(dom.matt).toBe(false);
    expect(dom.sammanfattning).toContain("vet inte");
  });

  it("åtgärdstexten är färdig att klistra in och varnar för att det kan vara leverantörens standard", () => {
    const text = aiRobotsAtgard(analyseraAiRobots(FORBALANCE))!;
    expect(text).toContain("User-agent: GPTBot");
    expect(text).toContain("Allow: /");
    expect(text).toContain("supportärende");
  });

  it("ingen åtgärdstext när inget är spärrat", () => {
    expect(aiRobotsAtgard(analyseraAiRobots("User-agent: *\nAllow: /"))).toBeNull();
  });

  it("kontrollen körs som del av crawlen, inte som ett extra steg någon kan glömma", () => {
    const deep = las("lib/seo-deep.ts");
    expect(deep).toContain("analyseraAiRobots(robotsRa)");
    expect(deep).toContain("aiRobots: rs.aiRobots");
  });
});

describe("R-3 · lokala verksamheter, förbättra-spåret och schemat", () => {
  const gen = las("lib/deep-audit-generate.ts");

  it("Google-företagsprofil och Search Console är obligatoriska i steg 1 för lokala kunder", () => {
    expect(gen).toContain("Syns du där kunderna letar lokalt");
    expect(gen).toContain("Google-företagsprofil");
    expect(gen).toContain("Google Search Console");
    expect(gen).toContain("Lokal verksamhet:");
  });

  it("anspråksstatus skrivs som öppen fråga när den inte går att mäta", () => {
    expect(gen).toContain("ÖPPEN FRÅGA");
  });

  it("förbättra befintliga sidor i stället för att föreslå nya som redan finns", () => {
    expect(gen).toContain("FÖRBÄTTRA-SPÅRET");
    expect(gen).toContain("dyraste felet");
  });

  it("aggregateRating från tredjepartskällor är förbjudet i schemat", () => {
    expect(gen).toContain("aggregateRating");
    expect(gen).toContain("Bokadirekt");
  });

  it("sameAs får bara innehålla profiler vi MÄTT på sajten", () => {
    expect(gen).toContain("sameAs");
    expect(gen).toContain("sociala profiler");
  });
});

describe("RAPPORT-1 · rapporterna är fortfarande dolda i kundvyn", () => {
  it("spärren står kvar tills Håkan godkänt en omkörd rapport manuellt", () => {
    expect(las("app/api/seo/deep-audit/route.ts")).toContain("const DOLJ_RAPPORTER_I_KUNDVYN = true");
  });
});
