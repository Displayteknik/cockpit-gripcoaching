// ONBOARD-1 — hämtningstrappan.
//
// Kravet som styr hela filen: "Sajter som blockerar robots eller renderas med JavaScript
// måste hanteras, annars faller hela flödet på just de kunder som behöver hjälpen mest.
// Visa tydligt när skrapningen misslyckats istället för att leverera tomma fält."
//
// Tre steg, i ordning. Varje steg som faller lämnar ett spår vidare:
//
//   1. `hamtaSida` (lib/seo-hamta) — produktens kanoniska hämtväg. En user-agent, bara
//      HTTP 200, minst 500 byte, hela hämtningen loggad. Kastar `SidaEjLast` med bevis.
//   2. JS-avkodning — `decodePayload` (lib/seo-deep) gör client-side-renderad markup
//      sökbar. Det räcker för GHL- och Next-sajter där innehållet ligger i payloaden.
//      ⚠ Detta är anledningen till att en GHL-sajt inte ska bedömas på rå HTML — se
//      [[lesson_ghl_client_side_verify]].
//   3. Renderingstjänst — för sajter som antingen svarade 403/429 (blockerar oss) eller
//      svarade 200 med nästan ingen text (allt renderas i webbläsaren).
//
// ★ VI BYTER ALDRIG USER-AGENT FÖR ATT SMYGA FÖRBI EN SPÄRR. `SEO_USER_AGENT` är
//   produktens enda identitet (regel 1 i lib/seo-hamta) och att presentera sig som en
//   vanlig webbläsare för att kringgå ett blockeringsbeslut vore att ljuga för kundens
//   server. Blockeras vi går vi via renderingstjänsten eller rapporterar ärligt att
//   sajten inte gick att läsa.

import { hamtaSida, arSidaEjLast, type HamtLogg } from "@/lib/seo-hamta";
import { decodePayload } from "@/lib/seo-deep";
import type { HamtVag } from "./typer";

/**
 * Under så här många tecken läsbar text är ett 200-svar inte en läst sida — det är ett
 * SPA-skal. Satt lågt med flit: en tunn kontaktsida kan vara kort på riktigt, och då är
 * det bättre att rendera en gång för mycket än att tolka tomhet som fakta.
 */
const TUNN_TEXT_GRANS = 350;

/** Renderingstjänst som kör sidan i en riktig webbläsare och returnerar läsbar text. */
const RENDER_BAS = process.env.ONBOARD_RENDER_BAS || "https://r.jina.ai/";

/** Sätts bara om Håkan skaffar en nyckel för högre kvot. Utan nyckel gäller gratiskvoten. */
const RENDER_NYCKEL = process.env.ONBOARD_RENDER_NYCKEL || process.env.JINA_API_KEY || "";

/**
 * HTML → läsbar text. ETT rensningslager för ALLA källor — läggs fler källor till
 * (Bokadirekt, Facebook, Google) ska de gå genom samma funktion, annars måste varje
 * framtida lagning göras i lika många parsrar som det finns källor.
 *
 * ★ ORDNINGEN ÄR INTE VALFRI. Kommentarer måste bort FÖRE den generiska tagg-regeln.
 *
 * En kommentar som innehåller markup — `<!-- <div class="x">DIN TEXT</div> -->` — plockas
 * annars isär av `<[^>]+>`: den matchar fram till första `>` inuti kommentaren, och kvar
 * blir `DIN TEXT -->` som vanlig brödtext. Det gav tjänsten
 * "65 tum Större format DIN TEXT -->" i provkörningen mot displayteknik.se, alltså en
 * kommentar som såg ut som en produkt.
 */
export const rensaText = (html: string): string =>
  html
    // Kommentarer, villkorskommentarer och CDATA — före allt annat.
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, " ")
    // En oavslutad kommentar skulle annars läcka resten av dokumentet som text.
    .replace(/<!--[\s\S]*$/g, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&(?:quot|#34);/gi, '"')
    .replace(/&(?:apos|#39);/gi, "'")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

export interface HamtatResultat {
  ok: boolean;
  url: string;
  /** Rå HTML. Null när sidan bara kunde läsas via renderingstjänsten. */
  html: string | null;
  /** Läsbar text. Tom sträng bara när ok === false. */
  text: string;
  via: HamtVag;
  /** Klartext på svenska när sidan inte gick att läsa. Null när ok. */
  fel: string | null;
  /** Statuskod från det direkta försöket, när ett svar nådde fram. */
  status: number | null;
  /** True när det direkta försöket blockerades (403/429) — sajten stänger ute robotar. */
  blockerad: boolean;
}

/** 403/429 = servern förstod oss och sa nej. Det är blockering, inte ett nätverksfel. */
const arBlockering = (status: number | null): boolean => status === 403 || status === 429 || status === 401;

/**
 * Hämtar EN sida genom hela trappan. Kastar aldrig — allt hamnar i resultatet, för
 * en tyst nolla här blir ett tomt fält i förslaget längre fram.
 */
export async function hamtaOnboardSida(url: string, opts?: { timeoutMs?: number }): Promise<HamtatResultat> {
  const timeoutMs = opts?.timeoutMs ?? 20000;

  let html: string | null = null;
  let status: number | null = null;
  let direktFel: string | null = null;

  try {
    const svar = await hamtaSida(url, { timeoutMs });
    html = svar.text;
    status = svar.logg.status;
  } catch (e) {
    if (arSidaEjLast(e)) {
      const logg = (e as { logg: HamtLogg }).logg;
      status = logg.status;
      direktFel = logg.fel;
    } else {
      direktFel = e instanceof Error ? e.message : String(e);
    }
  }

  const blockerad = arBlockering(status);

  if (html != null) {
    // Steg 2: avkoda JS-payloaden innan vi mäter textmängden. En GHL-sajt ser tom ut
    // i rå HTML men bär hela innehållet escapat i payloaden.
    const text = rensaText(decodePayload(html));
    if (text.length >= TUNN_TEXT_GRANS) {
      return { ok: true, url, html, text, via: "direkt", fel: null, status, blockerad: false };
    }
    // 200 men nästan ingen text → sidan renderas i webbläsaren. Gå vidare till steg 3,
    // men behåll HTML:en: den bär fortfarande färger, logotyp och länkar.
    const renderad = await hamtaViaRendering(url, timeoutMs);
    if (renderad.ok) {
      return { ok: true, url, html, text: renderad.text, via: "rendering", fel: null, status, blockerad: false };
    }
    // Renderingen föll också. Den tunna texten är allt vi har — lämna den, men var ärlig
    // om att den är tunn så att extraktionen inte tolkar tystnad som fakta.
    return {
      ok: text.length > 0,
      url,
      html,
      text,
      via: "direkt",
      fel: text.length > 0 ? null : "Sidan svarade 200 men innehöll ingen läsbar text, och renderingen misslyckades.",
      status,
      blockerad: false,
    };
  }

  // Steg 3: direkt hämtning föll helt (blockering, timeout, fel status).
  const renderad = await hamtaViaRendering(url, timeoutMs);
  if (renderad.ok) {
    return { ok: true, url, html: null, text: renderad.text, via: "rendering", fel: null, status, blockerad };
  }

  const varfor = blockerad
    ? `Sajten blockerar automatisk läsning (HTTP ${status}) och renderingstjänsten kom inte heller igenom: ${renderad.fel}`
    : `${direktFel || "Sidan kunde inte läsas."} Renderingstjänsten kom inte heller igenom: ${renderad.fel}`;

  return { ok: false, url, html: null, text: "", via: "direkt", fel: varfor, status, blockerad };
}

/**
 * Steg 3 — kör sidan genom en renderingstjänst som exekverar JavaScript och returnerar
 * läsbar text. Detta är vägen för sajter som annars aldrig hade gett något innehåll.
 */
async function hamtaViaRendering(url: string, timeoutMs: number): Promise<{ ok: boolean; text: string; fel: string | null }> {
  const mal = `${RENDER_BAS.replace(/\/+$/, "")}/${url}`;
  try {
    const headers: Record<string, string> = { Accept: "text/plain" };
    if (RENDER_NYCKEL) headers.Authorization = `Bearer ${RENDER_NYCKEL}`;

    const r = await fetch(mal, { headers, signal: AbortSignal.timeout(timeoutMs + 15000) });
    const kropp = await r.text();

    if (!r.ok) {
      return { ok: false, text: "", fel: `renderingen svarade HTTP ${r.status}` };
    }
    // Tjänsten svarar markdown med ett litet huvud (Title/URL Source/Markdown Content).
    const text = rensaMarkdown(kropp);
    if (text.length < 80) return { ok: false, text: "", fel: "renderingen gav inget innehåll" };
    return { ok: true, text, fel: null };
  } catch (e) {
    const namn = (e as { name?: string })?.name;
    if (namn === "TimeoutError" || namn === "AbortError") return { ok: false, text: "", fel: "renderingen hann inte klart" };
    return { ok: false, text: "", fel: `renderingen gick inte att nå (${e instanceof Error ? e.message : String(e)})` };
  }
}

/** Plockar bort markdown-syntax men BEHÅLLER länkmålen — de bär mejl, telefon och socialt. */
export function rensaMarkdown(md: string): string {
  return md
    .replace(/^Title:.*$/im, " ")
    .replace(/^URL Source:.*$/im, " ")
    .replace(/^Markdown Content:.*$/im, " ")
    .replace(/!\[[^\]]*\]\(([^)]*)\)/g, " ") // bilder bort
    .replace(/\[([^\]]*)\]\(([^)]*)\)/g, "$1 $2 ") // länktext + mål kvar
    .replace(/[#*_>`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
