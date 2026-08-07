// ONBOARD-1 — härledning av brand-profilen ur sajtens texter.
//
// Samma motor som "Förbättra inlägg" använder: Gemini via `lib/gemini`, med
// `skrivregler: false` eftersom detta är EXTRAKTION, inte kundtext (se kommentaren i
// lib/gemini.ts GenerateOptions.skrivregler).
//
// ★ ANTI-FABRIKATIONSGRINDEN ÄR KODAD, INTE PROMPTAD.
//
// Att be en modell "hitta inte på" är nödvändigt men inte tillräckligt —
// [[lesson_modellen_ekar_prompten_som_svar]] och
// [[lesson_fri_ai_sammanfattning_kastar_om_talare]] visar båda att prompten ensam inte
// håller. Därför kräver vi ett ORDAGRANT CITAT för varje härlett fält, och sedan
// KONTROLLERAR vi i kod att citatet faktiskt förekommer i den text vi matade in.
// Hittas inte citatet kastas fältet — oavsett hur rimligt värdet lät.
//
// Det gör skillnaden mellan "modellen påstår att målgruppen är småföretagare" och
// "sajten skriver ordagrant 'vi hjälper småföretagare', därför är målgruppen det".

import { generateJSON } from "@/lib/gemini";
import { funnet, tomt, type Falt } from "./typer";
import type { OnboardSida } from "./typer";

/** Max tecken sajttext som skickas till modellen. Räcker gott för 6–8 sidor. */
const MAX_TECKEN = 24000;

interface HarlettFalt {
  varde: string | null;
  citat: string | null;
  kallUrl?: string | null;
}

interface HarlettSvar {
  bransch: HarlettFalt;
  tagline: HarlettFalt;
  malgrupp_primar: HarlettFalt;
  malgrupp_sekundar: HarlettFalt;
  tonlage: HarlettFalt;
  usp: HarlettFalt;
  kontaktperson: HarlettFalt;
  smartpunkter: { varde: string; citat: string }[];
  erbjudanden: { namn: string; pris: string | null; citat: string }[];
  kundcitat: { varde: string; citat: string }[];
}

/**
 * Normalisering inför citatkontrollen. Modellen återger nästan alltid citatet med
 * annan whitespace, andra citattecken eller annat bindestreck än källan. Att kräva
 * teckenidentitet hade förkastat sanna fält; att inte normalisera alls hade släppt
 * igenom falska. Detta är mitten: samma bokstäver och siffror, i samma ordning.
 */
const nyckla = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/**
 * Sant när citatet verkligen står i källtexten.
 *
 * Korta citat (< 15 tecken normaliserat) godtas inte — "kvalitet" förekommer på var
 * tredje sajt och belägger ingenting. Ett citat ska vara långt nog att peka på EN plats.
 */
export function citatFinns(citat: string | null | undefined, kalla: string): boolean {
  if (!citat) return false;
  const c = nyckla(citat);
  if (c.length < 15) return false;
  return nyckla(kalla).includes(c);
}

/** Bygger textunderlaget och håller reda på vilken sida varje avsnitt kom ifrån. */
function byggUnderlag(sidor: OnboardSida[]): { text: string; sidText: string } {
  const delar: string[] = [];
  let kvar = MAX_TECKEN;
  // Startsidan och de fakta-tunga rollerna först, så de aldrig klipps bort.
  const ordning = ["start", "om", "tjanster", "priser", "omdomen", "kontakt", "ovrig"];
  const sorterade = [...sidor].sort((a, b) => ordning.indexOf(a.roll) - ordning.indexOf(b.roll));

  for (const s of sorterade) {
    if (kvar <= 200) break;
    const bit = s.text.slice(0, Math.min(6000, kvar));
    delar.push(`### SIDA (${s.roll}): ${s.url}\n${bit}`);
    kvar -= bit.length;
  }
  return { text: delar.join("\n\n"), sidText: sorterade.map((s) => s.text).join("\n") };
}

const SYSTEM = `Du läser en svensk företagswebbplats och fyller i en företagsprofil åt en byrå.

DETTA ÄR EXTRAKTION, INTE COPYWRITING. Du beskriver vad som står — du säljer ingenting.

ABSOLUTA REGLER:
1. Varje fält du fyller i MÅSTE beläggas med ett ordagrant citat ur texten du fått.
   Citatet ska vara 15-200 tecken och kopieras EXAKT, tecken för tecken.
2. Står det inte i texten: sätt varde till null. Ett tomt fält är rätt svar när
   underlaget saknas. Gissa aldrig utifrån bransch, ortnamn eller vad som vore rimligt.
3. Hitta ALDRIG på telefonnummer, adresser, priser, siffror, namn eller årtal.
4. Ett citat får inte konstrueras, förkortas med ... eller slås ihop från två ställen.
   Kopiera en sammanhängande bit text.
5. Svara på svenska. Använd korrekta å, ä och ö.

FÄLTEN:
- bransch: kort benämning, t.ex. "Tandvård", "Digital skyltning", "Bygg och renovering".
- tagline: företagets egen slogan om den finns utskriven. Skriv aldrig en ny.
- malgrupp_primar: vem de tydligast vänder sig till.
- malgrupp_sekundar: näst tydligaste målgruppen, om en sådan framgår.
- tonlage: hur de skriver, 1-2 meningar. T.ex. "Sakligt och tryggt, du-tilltal, korta meningar."
- usp: det de själva lyfter fram som skiljer dem från andra.
- kontaktperson: namngiven person som är ägare, grundare eller kontaktperson.
- smartpunkter: problem hos kunden som sajten beskriver. Max 5.
- erbjudanden: tjänster eller produkter. pris ENDAST om det står utskrivet, ordagrant. Max 10.
- kundcitat: ordagranna omdömen FRÅN KUNDER. Företagets egen text är inte ett kundcitat. Max 5.

Svara med enbart JSON:
{"bransch":{"varde":null,"citat":null},"tagline":{"varde":null,"citat":null},
"malgrupp_primar":{"varde":null,"citat":null},"malgrupp_sekundar":{"varde":null,"citat":null},
"tonlage":{"varde":null,"citat":null},"usp":{"varde":null,"citat":null},
"kontaktperson":{"varde":null,"citat":null},
"smartpunkter":[{"varde":"","citat":""}],"erbjudanden":[{"namn":"","pris":null,"citat":""}],
"kundcitat":[{"varde":"","citat":""}]}`;

export interface HarlettResultat {
  bransch: Falt;
  tagline: Falt;
  malgruppPrimar: Falt;
  malgruppSekundar: Falt;
  tonlage: Falt;
  usp: Falt;
  kontaktperson: Falt;
  smartpunkter: Falt<string[]>;
  erbjudanden: Falt<{ namn: string; pris: string | null }[]>;
  kundcitat: Falt<string[]>;
  /** Antal fält modellen fyllde i som förkastades för att citatet inte fanns i källan. */
  forkastade: number;
}

/** Alla fält tomma, med samma förklaring. Används när underlaget inte räcker. */
function allaTomma(varfor: string): HarlettResultat {
  return {
    bransch: tomt(varfor),
    tagline: tomt(varfor),
    malgruppPrimar: tomt(varfor),
    malgruppSekundar: tomt(varfor),
    tonlage: tomt(varfor),
    usp: tomt(varfor),
    kontaktperson: tomt(varfor),
    smartpunkter: tomt(varfor),
    erbjudanden: tomt(varfor),
    kundcitat: tomt(varfor),
    forkastade: 0,
  };
}

export async function harledProfil(
  sidor: OnboardSida[],
  opts?: { tenantId?: string | null },
): Promise<HarlettResultat> {
  const lasta = sidor.filter((s) => s.text.trim().length > 0);
  if (!lasta.length) {
    return allaTomma("Ingen sidtext kunde läsas — det finns inget att härleda ur.");
  }

  const { text, sidText } = byggUnderlag(lasta);
  if (text.length < 300) {
    return allaTomma(`Endast ${text.length} tecken text kunde läsas — för tunt underlag för att härleda något.`);
  }

  let svar: HarlettSvar;
  try {
    svar = await generateJSON<HarlettSvar>({
      model: "gemini-2.5-pro",
      systemInstruction: SYSTEM,
      prompt: `Här är texten från företagets webbplats:\n\n${text}`,
      temperature: 0.2,
      maxOutputTokens: 8192,
      skrivregler: false,
      flow: "onboard/harled",
      tenantId: opts?.tenantId ?? null,
    });
  } catch (e) {
    return allaTomma(`Härledningen kunde inte köras: ${e instanceof Error ? e.message : String(e)}`);
  }

  let forkastade = 0;

  /** Släpper bara igenom fält vars citat bevisligen står i sajttexten. */
  const grinda = (f: HarlettFalt | undefined, namn: string): Falt => {
    const varde = f?.varde?.trim();
    if (!varde) return tomt(`Sajten säger inget om ${namn}.`);
    if (!citatFinns(f?.citat, sidText)) {
      forkastade++;
      return tomt(`Förslaget på ${namn} förkastades: citatet gick inte att hitta i sajtens text.`);
    }
    const kallUrl = hittaSidUrl(f!.citat!, lasta);
    return funnet(varde, "harlett", kallUrl, { citat: f!.citat!.slice(0, 200), sakerhet: "medel" });
  };

  const grindaLista = <T>(
    rader: { citat: string }[] | undefined,
    plocka: (r: never) => T,
    namn: string,
  ): Falt<T[]> => {
    const godkanda: T[] = [];
    let kallUrl: string | null = null;
    for (const r of rader ?? []) {
      if (!citatFinns(r?.citat, sidText)) {
        forkastade++;
        continue;
      }
      godkanda.push(plocka(r as never));
      kallUrl = kallUrl || hittaSidUrl(r.citat, lasta);
    }
    if (!godkanda.length) return tomt(`Sajten säger inget belagt om ${namn}.`);
    return funnet(godkanda, "harlett", kallUrl, { citat: `${godkanda.length} rader belagda med citat`, sakerhet: "medel" });
  };

  return {
    bransch: grinda(svar.bransch, "bransch"),
    tagline: grinda(svar.tagline, "tagline"),
    malgruppPrimar: grinda(svar.malgrupp_primar, "primär målgrupp"),
    malgruppSekundar: grinda(svar.malgrupp_sekundar, "sekundär målgrupp"),
    tonlage: grinda(svar.tonlage, "tonläge"),
    usp: grinda(svar.usp, "vad som skiljer dem från andra"),
    kontaktperson: grinda(svar.kontaktperson, "kontaktperson"),
    smartpunkter: grindaLista<string>(svar.smartpunkter, (r: { varde: string }) => r.varde, "kundens smärtpunkter"),
    erbjudanden: grindaLista<{ namn: string; pris: string | null }>(
      svar.erbjudanden,
      (r: { namn: string; pris: string | null }) => ({ namn: r.namn, pris: r.pris ?? null }),
      "erbjudanden",
    ),
    kundcitat: grindaLista<string>(svar.kundcitat, (r: { varde: string }) => r.varde, "kundcitat"),
    forkastade,
  };
}

/** Vilken sida stod citatet på? Ger granskningsvyn en klickbar källa. */
function hittaSidUrl(citat: string, sidor: OnboardSida[]): string | null {
  for (const s of sidor) {
    if (citatFinns(citat, s.text)) return s.url;
  }
  return null;
}
