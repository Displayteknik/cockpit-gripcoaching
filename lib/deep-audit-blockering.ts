// BLOCKERINGSRAPPORTEN — RAPPORT-1, beslut 2 (Håkan 2026-08-13).
//
// När crawlen bara delvis kom fram genereras den här i stället för den vanliga rapporten.
// Den skrivs DETERMINISTISKT i kod, ingen modell tillfrågas. Två skäl:
//
//   1. Det finns inget innehållsunderlag att skriva ur. En modell som får en halv crawl
//      och ombeds skriva en rapport fyller luckorna, det var precis det som hände 13/8.
//   2. Ett tekniskt faktum ska inte formuleras om av en språkmodell. Statuskoden är vad
//      den är, och texten ska se likadan ut varje gång.
//
// Innehållet är begränsat till det vi FAKTISKT mätte: serverfelet, vilka URL:er som föll,
// robots.txt och AI robotarna, sitemapens form, och startsidans mätvärden. Inga
// innehållsrekommendationer, inga klistra in texter, ingen innehållsplan.
//
// ⚠ NOLL TANKSTRECK i utdatan. Texten går rakt till kund och ska klara samma språkkrav
//   som allt annat vi levererar.

import type { SiteAudit } from "@/lib/seo-deep";
import type { TackningsDom } from "@/lib/deep-audit-tackning";
import { aiRobotsAtgard } from "@/lib/seo/ai-robots";

export interface BlockeringsIndata {
  klientnamn: string;
  url: string;
  datum: string;
  /** Kundens namn på sin webbplattform, redan översatt. Null när den är okänd. */
  plattform: string | null;
}

/** Klartext om vad ett tekniskt fel betyder för kundens synlighet. Aldrig skräckretorik. */
function konsekvens(status: number | null): string {
  if (status !== null && status >= 500) {
    return (
      "Det drabbar inte bara vårt verktyg. Googles robot får samma fel när den hämtar en sida " +
      "som inte redan ligger sparad, och sidor som upprepat svarar med fel riskerar att tappas " +
      "ur Google."
    );
  }
  if (status === 403) {
    return "Servern nekar automatiska besökare. Samma spärr träffar sökmotorernas robotar.";
  }
  if (status === 404) {
    return (
      "Adresserna står i sajtens egen innehållsförteckning eller meny men svarar att de inte " +
      "finns. Det skickar både besökare och sökmotorer till återvändsgränder."
    );
  }
  if (status === null) {
    return "Servern svarade inte alls inom tidsgränsen. Samma sak händer för en besökare med långsam uppkoppling.";
  }
  return "Sidorna kunde inte läsas, vilket gör att de inte kan bedömas.";
}

function atgard(status: number | null, plattform: string | null): string {
  const vem = plattform ? `din webbleverantör (${plattform})` : "din webbleverantör";
  if (status !== null && status >= 500) {
    return (
      `Kontakta ${vem} och be dem titta på att ursprungsservern svarar med fel ${status} när en ` +
      `sida inte ligger i cachen. Det är inget du kan rätta själv inifrån redigeringsläget.`
    );
  }
  if (status === 403) return `Be ${vem} kontrollera brandväggen eller botskyddet framför sajten.`;
  if (status === 404) return `Rätta länkarna, eller be ${vem} ta bort adresserna ur sajtens innehållsförteckning.`;
  return `Kontakta ${vem} med listan nedan.`;
}

export function byggBlockeringsrapport(site: SiteAudit, dom: TackningsDom, meta: BlockeringsIndata): string {
  const status = dom.huvudfel?.status ?? null;
  const lastaUrler = site.pages.filter((p) => p.ejMattOrsak == null).map((p) => p.url);
  const start = site.pages.find((p) => p.url === site.pages[0]?.url);

  const rader: string[] = [];
  const R = (s = "") => rader.push(s);

  R(`# SEO och AEO-rapport: ${meta.klientnamn} (${meta.url})`);
  R();
  R(`**Datum:** ${meta.datum}`);
  R(`**Vad jag granskat:** ${dom.lasta} av ${dom.forsokta} sidor. Resten gick inte att läsa, och det är rapportens viktigaste fynd.`);
  R();
  R(`> Den här granskningen är avsiktligt kort. Vi skriver inga råd om innehåll vi inte har läst. ` +
    `Så fort felet nedan är åtgärdat kör vi om granskningen och du får den fullständiga rapporten.`);
  R();
  R("---");
  R();
  R("## Det viktigaste först");
  R();
  R(`1. **Din server svarar med fel på sidor som inte redan ligger sparade.** ${dom.huvudfel?.monster ?? ""}`);
  R(`   ${konsekvens(status)}`);
  R(`   **Så här gör du:** ${atgard(status, meta.plattform)}`);
  R();

  const aiAtgard = aiRobotsAtgard(site.aiRobots);
  if (aiAtgard) {
    R(`2. **AI-sökmotorernas robotar är utestängda i robots.txt.** ${site.aiRobots.sammanfattning}`);
    R(`   Det gör att ChatGPT, Perplexity och Gemini inte kan citera dig, oavsett hur bra texterna är.`);
    R();
  }

  R("---");
  R();
  R("## Sidorna som inte kunde läsas");
  R();
  R("| Adress | Vad servern svarade |");
  R("|---|---|");
  for (const e of dom.ejLasta.slice(0, 40)) {
    R(`| ${e.url} | ${e.status ?? "inget svar"} |`);
  }
  if (dom.ejLasta.length > 40) R(`| ... | ${dom.ejLasta.length - 40} adresser till |`);
  R();
  if (dom.overTaket.length) {
    R(`Utöver dessa fanns ${dom.overTaket.length} adresser som inte hanns med i den här körningen ` +
      `(taket ligger på ${site.upptackt.maxPages} sidor). De är alltså varken lästa eller trasiga.`);
    R();
  }

  R("---");
  R();
  R("## Det vi faktiskt kunde mäta");
  R();
  R("| Kontroll | Resultat |");
  R("|---|---|");
  R(`| Sidor lästa | ${dom.lasta} av ${dom.forsokta} |`);
  R(`| Innehållsförteckning (sitemap) | ${site.sitemapUrlCount == null ? "kunde inte läsas" : `${site.sitemapUrlCount} adresser${site.upptackt.sitemapArIndex ? ", uppdelad i flera filer" : ""}`} |`);
  R(`| robots.txt | ${site.robotsTxt?.found ? "finns" : site.robotsTxtFel ? "kunde inte läsas" : "saknas"} |`);
  R(`| AI-sökmotorernas robotar | ${site.aiRobots.matt ? (site.aiRobots.blockerade.length ? `spärrade: ${site.aiRobots.blockerade.join(", ")}` : "släpps in") : "kunde inte bedömas"} |`);
  if (start && start.ejMattOrsak == null) {
    R(`| Startsidans titel | ${start.title ? `"${start.title}" (${start.titleLength} tecken)` : "saknas"} |`);
    R(`| Startsidans H1-rubrik | ${start.h1 ? `"${start.h1}"` : "saknas"} |`);
    R(`| Strukturerad data på startsidan | ${start.schemaTypes?.length ? start.schemaTypes.join(", ") : "ingen hittad"} |`);
    R(`| Ord på startsidan | ${start.wordCount ?? "okänt"} |`);
  }
  R(`| Domänvariant | ${site.domainRedirect.note} |`);
  R();

  if (aiAtgard) {
    R("---");
    R();
    R("## Släpp in AI-sökmotorerna");
    R();
    R(site.aiRobots.sammanfattning);
    R();
    R(aiAtgard);
    R();
  }

  R("---");
  R();
  R("## Det här kan vi inte säga något om ännu");
  R();
  R("Följande delar kräver att vi läst sidorna, och de saknas därför med flit i den här rapporten:");
  R();
  R("- Bedömning av texterna och hur de svarar mot vad folk söker på");
  R("- Färdiga texter att klistra in");
  R("- Innehållsplan och bloggrubriker");
  R("- Internlänkning mellan sidor");
  R("- Titlar och rubriker på undersidorna");
  R();
  R(`Vi läste ${lastaUrler.length} sida${lastaUrler.length === 1 ? "" : "r"}: ${lastaUrler.join(", ")}.`);
  R();
  R("---");
  R();
  R("## Nästa steg");
  R();
  R(`1. Skicka felet ovan till ${meta.plattform ? `din webbleverantör (${meta.plattform})` : "din webbleverantör"}.`);
  R("2. Hör av dig när de säger att det är åtgärdat.");
  R("3. Vi kör om granskningen och du får den fullständiga rapporten, utan extra kostnad.");
  R();

  return rader.join("\n");
}
