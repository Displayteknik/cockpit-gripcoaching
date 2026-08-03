// SEO-1 / S-1 — SKARP verifiering mot forbalance.se. Riktiga nätverksanrop.
// Kör: npx tsx scripts/seo1-verifiering.mts
//
// Del 1: den riktiga hämtningsvägen (hamtaSida) mot forbalance.se → statuskod + byte.
// Del 2: samma väg med en blockerad user-agent (GPTBot/1.0) injicerad → ska bli ett FEL,
//        inte ett tomt resultat. UA:n injiceras genom att wrappa global fetch, så själva
//        koden är orörd — bara identiteten byts, precis som en riktig blockering.
// Del 3: crawlSite mot forbalance.se → pageCount, misslyckade, homepageText.

import { hamtaSida, arSidaEjLast, SEO_USER_AGENT } from "../lib/seo-hamta";
import { extractPageSignals, crawlSite } from "../lib/seo-deep";

const URL_MAL = "https://forbalance.se/";

function rad(txt: string) { process.stdout.write(txt + "\n"); }

async function del1() {
  rad("── DEL 1 · riktig hämtningsväg, verktygets egen UA ──");
  rad(`UA: ${SEO_USER_AGENT}`);
  try {
    const { logg } = await hamtaSida(URL_MAL);
    rad(`OK   status=${logg.status} byte=${logg.bytes} slutUrl=${logg.slutUrl} ms=${logg.ms}`);
    rad(`DoD S-1: 200 och över 480 000 byte → ${logg.status === 200 && (logg.bytes ?? 0) > 480000 ? "UPPFYLLT" : "EJ UPPFYLLT"}`);
  } catch (e) {
    const l = arSidaEjLast(e) ? e.logg : null;
    rad(`FEL  ${(e as Error).message} | status=${l?.status ?? "-"} byte=${l?.bytes ?? "-"}`);
  }

  const s = await extractPageSignals(URL_MAL, { skipLighthouse: true, skipRobotsSitemap: true });
  rad(`Mätvärden: ord=${s.wordCount} bilder=${s.images?.total} utan alt=${s.images?.withoutAlt} title=${JSON.stringify(s.title)}`);
}

async function del2() {
  rad("");
  rad("── DEL 2 · samma väg med blockerad UA (GPTBot/1.0) ──");
  const original = globalThis.fetch;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers as HeadersInit);
    headers.set("User-Agent", "GPTBot/1.0");
    return original(input, { ...init, headers });
  }) as typeof fetch;
  try {
    const { logg } = await hamtaSida(URL_MAL);
    rad(`OVÄNTAT OK status=${logg.status} byte=${logg.bytes} — blockeringen slog inte till`);
  } catch (e) {
    const l = arSidaEjLast(e) ? e.logg : null;
    rad(`FEL (förväntat) status=${l?.status ?? "-"} byte=${l?.bytes ?? "-"} orsak=${l?.orsak ?? "-"}`);
    rad(`Meddelande: ${(e as Error).message}`);
    rad(`DoD S-1: blockerad UA ger FEL, inte tomt resultat → ${arSidaEjLast(e) ? "UPPFYLLT" : "EJ UPPFYLLT"}`);
  } finally {
    globalThis.fetch = original;
  }
}

async function del3() {
  rad("");
  rad("── DEL 3 · crawlSite mot forbalance.se ──");
  const site = await crawlSite(URL_MAL, { maxPages: 25, skipLighthouse: true });
  rad(`pageCount(lästa)=${site.pageCount} pageCountForsokt=${site.pageCountForsokt} misslyckade=${site.misslyckade.length}`);
  rad(`sitemapUrlCount=${site.sitemapUrlCount} sitemapFel=${site.sitemapFel ?? "-"}`);
  rad(`robotsTxt=${JSON.stringify(site.robotsTxt)} robotsTxtFel=${site.robotsTxtFel ?? "-"}`);
  rad(`homepageText=${site.homepageText == null ? "null (EJ LÄST)" : site.homepageText.length + " tecken"}`);
  rad(`crossPage.totalImagesNoAlt=${site.crossPage.totalImagesNoAlt} avgInternalLinks=${site.crossPage.avgInternalLinks}`);
  for (const p of site.pages) {
    rad(`  ${p.hamtning.ok ? "OK " : "FEL"} ${p.url} | status=${p.hamtning.status} byte=${p.hamtning.bytes} ord=${p.wordCount} bilder=${p.imagesTotal} seo=${p.seo}`);
  }
  for (const m of site.misslyckade) rad(`  MISSLYCKAD ${m.url} status=${m.status} — ${m.fel}`);
}

await del1();
await del2();
await del3();
