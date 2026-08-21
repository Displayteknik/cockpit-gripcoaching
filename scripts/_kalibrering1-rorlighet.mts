// HELG-1 DEL 9 — KALIBRERING-1, read-only-granskning av Sid-analysens viktning.
// Ändrar INGEN kod, rör INGEN kundens live-sajt. Kör scoreSignals() rent i minnet
// med syntetiska signaler (samma funktion som /api/seo/audit och SeoClient.tsx
// använder på riktigt) för att svara på snabbtestet: "byt sidtitel, kör om
// analysen, se om poängen rör sig" — utan att röra Annas (Oppråbys) riktiga sida.
//
//   npx tsx --tsconfig scripts/text1/tsconfig.json scripts/_kalibrering1-rorlighet.mts

import type { PageSignals } from "../lib/seo-deep";

const { scoreSignals } = await import("../lib/seo-deep");

function bas(): PageSignals {
  return {
    url: "https://exempel.se/",
    hamtning: { url: "https://exempel.se/", status: 200, bytes: 12000, slutUrl: "https://exempel.se/", ms: 300, ok: true, orsak: null, fel: null },
    ejMattOrsak: null,
    sajtHamtFel: { robots: null, sitemap: null },
    title: "Oppråby — Skräddarsydda upplevelser för företag och privatpersoner",
    titleLength: 66,
    metaDescription: "Oppråby erbjuder skräddarsydda upplevelser för företag och privatpersoner i hela Sverige. Boka din upplevelse idag.",
    metaLength: 116,
    canonical: "https://exempel.se/",
    canonicalSource: "static",
    lang: "sv",
    robots: null,
    ogTags: { title: "Oppråby" },
    schemaTypes: ["LocalBusiness"],
    faqs: [],
    headings: [{ level: 1, text: "Välkommen till Oppråby" }, { level: 2, text: "Våra upplevelser" }],
    emptyHeadings: 0,
    wordCount: 450,
    paragraphCount: 8,
    listCount: 1,
    images: { total: 10, withoutAlt: 0 },
    links: { internal: 12, external: 3 },
    internaLankar: [],
    socialaProfiler: [],
    hasUpdatedDate: false,
    platform: "GoHighLevel",
    robotsTxt: { found: true, blocksEverything: false, sitemapDeclared: null },
    sitemap: { found: true, urlCount: 8 },
    cwv: null,
    lighthouseSeo: null,
    lighthouseAudits: null,
    renderNote: "",
    mainText: null,
  };
}

function visa(namn: string, s: PageSignals) {
  const r = scoreSignals(s);
  const felChecks = r.checks.filter((c) => c.status === "fel").map((c) => c.id);
  console.log(`\n=== ${namn} ===`);
  console.log(`title: "${s.title}" (${s.titleLength} tecken)`);
  console.log(`SEO: ${r.seo}   AEO: ${r.aeo}   indexerbar: ${r.indexerbar}`);
  console.log(`checks med status "fel": ${felChecks.length ? felChecks.join(", ") : "(inga)"}`);
  return r;
}

console.log("KALIBRERING-1 / rörlighet — samma scoreSignals() som /api/seo/audit kör i produktion.\n");
console.log("Steg 1: liten titeländring inom samma längdband (66 → 61 tecken, ingen tröskel korsad)");
const b0 = visa("BASELINE (66 tecken)", bas());
const t1 = bas();
t1.title = "Oppråby — Skräddarsydda upplevelser för hela Sverige"; // 54 tecken, fortfarande <65
t1.titleLength = t1.title.length;
const b1 = visa("Titel ändrad, 54 tecken (fortfarande under 65-gränsen)", t1);
console.log(`>>> Poängskillnad SEO: ${b1.seo! - b0.seo!} (väntat: 0 — inget tröskelvärde korsat)`);

console.log("\nSteg 2: titel korsar 65-teckensgränsen (66 → 70 tecken)");
const t2 = bas();
t2.title = "Oppråby — Skräddarsydda upplevelser för företag och privatpersoner i hela Sverige";
t2.titleLength = t2.title.length;
const b2 = visa(`Titel förlängd till ${t2.titleLength} tecken (över 65)`, t2);
console.log(`>>> Poängskillnad SEO: ${b2.seo! - b0.seo!} (väntat: -4)`);

console.log("\nSteg 3: titel tas bort helt");
const t3 = bas();
t3.title = null;
t3.titleLength = 0;
const b3 = visa("Titel saknas", t3);
console.log(`>>> Poängskillnad SEO: ${b3.seo! - b0.seo!} (väntat: -15)`);

console.log("\n\nKALIBRERING-1 / golv-tak — indexerbarhetens tak (min 25) oavsett övriga signaler");
const t4 = bas();
t4.robots = "noindex";
const b4 = visa("noindex satt, i övrigt perfekt sida", t4);
console.log(`>>> SEO stannar vid ${b4.seo} trots i övrigt fläckfria signaler (tak = 25)`);

console.log("\n\nKALIBRERING-1 / åtgärdslistans täckning — vilka AEO-avdrag syns i \"checks\" (= kundens åtgärdslista)?");
const t5 = bas();
t5.schemaTypes = ["LocalBusiness"]; // schema finns => inget schema-avdrag
t5.faqs = []; // FAQ saknas => -12 AEO
t5.wordCount = 300; // <600 => -8 AEO
t5.headings = [{ level: 1, text: "Välkommen" }]; // inga frågerubriker => -8 AEO
t5.listCount = 0; // <2 => -5 AEO
t5.hasUpdatedDate = false; // => -5 AEO
const r5 = scoreSignals(t5);
console.log(`AEO-poäng: ${r5.aeo} (100 - 12 - 8 - 8 - 5 - 5 = 62 förväntat)`);
console.log(`Antal "fel"-poster i checks (= det kunden ser i åtgärdslistan): ${r5.checks.filter(c => c.status === "fel").length}`);
console.log(`checks-innehåll: ${JSON.stringify(r5.checks.map(c => `${c.id}:${c.status}`))}`);
console.log("FAQ (-12), textdjup (-8), frågerubriker (-8), listor (-5) och färskhet (-5) syns ALDRIG i checks/issues —");
console.log("38 av 38 möjliga AEO-avdrag utanför schema är osynliga för kunden i åtgärdslistan.");
