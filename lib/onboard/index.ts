// ONBOARD-1 — orkestreringen. Från en webbadress till ett granskningsbart förslag.
//
// Ordningen är inte godtycklig. Hårda fakta läses först och vinner alltid över det
// AI:n härleder: står telefonnumret i sajtens JSON-LD ska ingen modell få tycka något
// om saken. Först när en källa saknas faller vi ned ett steg.
//
//   1. Hämta startsidan (lib/onboard/hamta — direkt → JS-avkodning → rendering)
//   2. Upptäck vilka fler sidor som bär företagsfakta (lib/onboard/upptack)
//   3. Läs dem parallellt
//   4. Läs hårda fakta deterministiskt (lib/onboard/extrahera)
//   5. Härled profilen ur texterna, med citatgrind (lib/onboard/harled)
//   6. Färger och logotyp via befintliga brand-agenten (lib/studio/brand-agent)
//   7. Google Business Profile som komplettering (lib/onboard/gbp) — får aldrig fälla flödet
//
// Steg 7 är medvetet sist och medvetet frivilligt: kravet säger "om det går".

import { assertSafePublicUrl } from "@/lib/safe-url";
import { analyzeSite } from "@/lib/studio/brand-agent";
import { hamtaOnboardSida } from "./hamta";
import { upptackSidor, normalisera } from "./upptack";
import {
  foretagsNod, namnUrSidor, adressUrNod, telefonUrSidor, epostUrSidor,
  socialaUrSidor, oppettiderUrNod, priserUrSidor, betygUrNod, omdomenUrNod,
} from "./extrahera";
import { harledProfil } from "./harled";
import { hamtaGbp } from "./gbp";
import { fargpalett } from "./farg";
import {
  funnet, tomt, harVarde, medKonflikt, arStandardTillaten,
  type Analys, type Falt, type Forslag, type ForslagNyckel,
  type Evenemang, type Konflikt, type OnboardMiss, type OnboardSida, type Tjanst,
} from "./typer";

/**
 * ONBOARD-2 — väljer mellan flera källor UTAN att dölja att de sa olika saker.
 *
 * Första kandidaten med värde vinner (anroparen skickar dem i prioritetsordning). Men om
 * en senare kandidat bär ett ANNAT värde bevaras båda som konflikt, och fältet kräver ett
 * aktivt val i granskningsvyn. Tidigare försvann den förlorande källan spårlöst — och en
 * tyst vald uppgift blir aldrig kontrollerad av någon.
 */
function valj<T>(kandidater: (Falt<T> | null)[], jamfor?: (v: T) => string): Falt<T> | null {
  const med = kandidater.filter((k): k is Falt<T> => !!k && harVarde(k));
  if (!med.length) return null;
  const nyckel = (f: Falt<T>): string =>
    jamfor ? jamfor(f.varde as T) : String(f.varde).trim().toLowerCase();

  const vinnare = med[0];
  const avvikande = med.filter((k) => nyckel(k) !== nyckel(vinnare));
  if (!avvikande.length) return vinnare;

  const alla: Konflikt<T>[] = [vinnare, ...avvikande].map((k) => ({
    varde: k.varde as T,
    kalla: k.kalla!,
    kallUrl: k.kallUrl,
    citat: k.citat,
  }));
  return medKonflikt(vinnare, alla);
}

/** Standardvärden enligt kravet. Sätts som `standard` — Håkan ser att de inte är lästa. */
export const LAND_STANDARD = "SE";
export const TIDSZON_STANDARD = "Europe/Stockholm";

/** Hur många sidor vi läser. Håller körningen inom en Vercel-request. */
const MAX_SIDOR = 8;

/** Hur många sidor vi läser samtidigt. Samma takt som SEO-motorns crawl. */
const PARALLELLT = 4;

/**
 * Under så här många tecken sammanlagd sidtext är sajten inte analyserad — den är
 * oläsbar. Se underlagsgrinden nedan. Satt strax över en typisk "sidan under
 * uppbyggnad"-text men långt under en verklig ensidig företagssajt.
 */
const MIN_UNDERLAG_TECKEN = 600;

export interface AnalysOpts {
  /** Skickas vidare till kostnadsloggen (lib/ai-usage). */
  tenantId?: string | null;
  /** Hoppa över Google Business Profile (för test och för att spara kvot). */
  hoppaGbp?: boolean;
}

export class SkrapningMisslyckades extends Error {
  readonly detaljer: { url: string; status: number | null; blockerad: boolean };
  constructor(meddelande: string, detaljer: { url: string; status: number | null; blockerad: boolean }) {
    super(meddelande);
    this.name = "SkrapningMisslyckades";
    this.detaljer = detaljer;
  }
}

/** Normaliserar det Håkan klistrar in. "displayteknik.se" ska funka lika bra som full URL. */
export function tolkaUrl(rå: string): string {
  const t = rå.trim();
  if (!t) throw new Error("Ingen webbadress angavs.");
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

export async function analyseraSajt(råUrl: string, opts?: AnalysOpts): Promise<Analys> {
  const url = tolkaUrl(råUrl);

  // SSRF-grind. Samma skydd som /api/seo/audit — en URL från ett formulär får aldrig
  // peka in i vårt eget nät.
  const säker = await assertSafePublicUrl(url);
  const rotUrl = säker.toString();

  // ── 1. Startsidan ──────────────────────────────────────────────────────────
  const start = await hamtaOnboardSida(rotUrl);
  if (!start.ok) {
    // Hårt stopp. Utan startsida finns inget underlag, och att leverera ett tomt
    // förslag hade sett ut som ett svar. Kravet är uttryckligt på den punkten.
    throw new SkrapningMisslyckades(
      start.blockerad
        ? `Sajten blockerar automatisk läsning och gick inte att läsa ens via rendering. ${start.fel}`
        : `Startsidan kunde inte läsas. ${start.fel}`,
      { url: rotUrl, status: start.status, blockerad: start.blockerad },
    );
  }

  const origin = new URL(rotUrl).origin;
  const startNorm = normalisera(rotUrl, origin)!;

  const sidor: OnboardSida[] = [
    { url: startNorm, html: start.html, text: start.text, via: start.via, roll: "start" },
  ];
  const missar: OnboardMiss[] = [];

  // ── 2 + 3. Fler sidor ──────────────────────────────────────────────────────
  const upptackta = (await upptackSidor(rotUrl, start.html, MAX_SIDOR)).filter((s) => s.url !== startNorm);

  for (let i = 0; i < upptackta.length; i += PARALLELLT) {
    const grupp = upptackta.slice(i, i + PARALLELLT);
    const svar = await Promise.all(grupp.map((s) => hamtaOnboardSida(s.url, { timeoutMs: 15000 })));
    svar.forEach((r, j) => {
      if (r.ok) {
        sidor.push({ url: r.url, html: r.html, text: r.text, via: r.via, roll: grupp[j].roll });
      } else {
        missar.push({ url: r.url, status: r.status, orsak: r.fel || "Okänt fel" });
      }
    });
  }

  const behovdeRendering = sidor.some((s) => s.via === "rendering");

  // ── Underlagsgrind ─────────────────────────────────────────────────────────
  // En parkerad domän eller ett tomt SPA-skal svarar 200 och ser ut som en läst sajt.
  // Provkörningen mot stockholmsjuristerna.se gav 36 tecken text — och ett "förslag"
  // vars företagsnamn var en URL ur <title>. Det är precis det kravet förbjuder:
  // hellre ett tydligt fel än tomma fält som ser ut som ett svar.
  const totaltTecken = sidor.reduce((a, s) => a + s.text.trim().length, 0);
  if (totaltTecken < MIN_UNDERLAG_TECKEN) {
    throw new SkrapningMisslyckades(
      `Sajten svarade, men innehöll bara ${totaltTecken} tecken läsbar text på ${sidor.length} ${sidor.length === 1 ? "sida" : "sidor"} — för lite för att fylla i något. Vanligaste orsaken är en parkerad domän, en sida under uppbyggnad, eller ett skal som kräver inloggning. Kontrollera adressen.`,
      { url: rotUrl, status: start.status, blockerad: start.blockerad },
    );
  }

  // ── 4. Hårda fakta ─────────────────────────────────────────────────────────
  const nodTraff = foretagsNod(sidor);
  const nod = nodTraff?.nod ?? null;
  const nodUrl = nodTraff?.url ?? null;

  const namn = namnUrSidor(sidor, nod, nodUrl);
  const adress = adressUrNod(nod, nodUrl, sidor);
  const telefonSchema = nod && typeof nod.telephone === "string" && nod.telephone.trim()
    ? funnet(nod.telephone.trim().replace(/[\s\-()]/g, ""), "schema", nodUrl, { citat: `"telephone": "${nod.telephone}"`, sakerhet: "hog" })
    : null;
  const epostSchema = nod && typeof nod.email === "string" && nod.email.trim()
    ? funnet(nod.email.trim().toLowerCase().replace(/^mailto:/, ""), "schema", nodUrl, { citat: `"email": "${nod.email}"`, sakerhet: "hog" })
    : null;

  // Schemat väger tyngst, men om brödtexten säger ett ANNAT nummer ska båda visas.
  // Ett fel telefonnummer i ett kundkonto ser rätt ut och upptäcks aldrig av sig självt.
  // ⚠ Jämförelsen måste normalisera svensk nummerform, annars blir "+46725410102" och
  //   "0725410102" en falsk konflikt — samma nummer, två skrivsätt. En konfliktflagga som
  //   larmar på ingenting lär användaren att klicka bort den, och då tystnar den även när
  //   den har rätt.
  const telNyckel = (v: unknown): string => {
    const d = String(v).replace(/[^\d+]/g, "");
    if (d.startsWith("+46")) return `+46${d.slice(3).replace(/^0+/, "")}`;
    if (d.startsWith("0046")) return `+46${d.slice(4).replace(/^0+/, "")}`;
    if (d.startsWith("0")) return `+46${d.slice(1)}`;
    return d;
  };
  const telefon =
    valj([telefonSchema, telefonUrSidor(sidor)], telNyckel) ?? telefonUrSidor(sidor);
  const epost =
    valj([epostSchema, epostUrSidor(sidor)], (v) => String(v).trim().toLowerCase()) ??
    epostUrSidor(sidor);
  const sociala = socialaUrSidor(sidor);
  const oppettider = oppettiderUrNod(nod, nodUrl);
  const priser = priserUrSidor(sidor);
  const { betyg: betygSchema, antal: antalSchema } = betygUrNod(nod, nodUrl);
  const omdomenSchema = omdomenUrNod(nod, nodUrl);

  // ── 5 + 6 + 7. Härledning, grafik och GBP parallellt ───────────────────────
  const [harlett, grafik, gbp] = await Promise.all([
    harledProfil(sidor, { tenantId: opts?.tenantId ?? null }),
    analyzeSite(rotUrl, undefined, start.html).catch(() => null),
    opts?.hoppaGbp
      ? Promise.resolve(null)
      : hamtaGbp({
          namn: namn.varde,
          ort: adress.ort.varde,
          hemsida: origin,
        }).catch(() => null),
  ]);

  // ── Slå ihop. Hårda fakta vinner, härlett fyller luckorna. ─────────────────
  const erbjudanden: Falt<Tjanst[]> = harVarde(priser)
    ? priser
    : harVarde(harlett.erbjudanden)
      ? (harlett.erbjudanden as Falt<Tjanst[]>)
      : tomt("Inga tjänster eller priser gick att belägga på sajten.");

  const kundcitat: Falt<string[]> = harVarde(omdomenSchema) ? omdomenSchema : harlett.kundcitat;

  const forslag: Forslag = {
    foretagsnamn: namn,
    kontaktperson: harlett.kontaktperson,
    epost,
    telefon,
    adress: adress.adress,
    postnummer: adress.postnummer,
    ort: harVarde(adress.ort) ? adress.ort : gbpFalt(gbp?.ort ?? null, gbp?.kallUrl ?? null, "Ingen ort hittades."),
    land: funnet(LAND_STANDARD, "standard", null, { sakerhet: "hog" }),
    tidszon: funnet(TIDSZON_STANDARD, "standard", null, { sakerhet: "hog" }),
    hemsida: funnet(origin, "sajt", startNorm, { sakerhet: "hog" }),

    bransch: harlett.bransch,
    tagline: harlett.tagline,
    malgruppPrimar: harlett.malgruppPrimar,
    malgruppSekundar: harlett.malgruppSekundar,
    smartpunkter: harlett.smartpunkter,
    tonlage: harlett.tonlage,
    erbjudanden,
    kundcitat,
    usp: harlett.usp,

    // ONBOARD-3: fylls av bokningsplattformen. Hemsidan bär sällan kursdatum i läsbar form,
    // och ett evenemang utan datum är bara en tjänst — då hör det hemma i `erbjudanden`.
    evenemang: tomt<Evenemang[]>("Inga kurser eller workshops med datum hittades. Bokningsplattformen är källan för dem."),

    oppettider: harVarde(oppettider)
      ? oppettider
      : gbp?.oppettider?.length
        ? funnet(gbp.oppettider, "gbp", gbp.kallUrl, { sakerhet: "hog" })
        : tomt("Inga öppettider hittades, varken på sajten eller i Google-profilen."),
    socialaLankar: sociala,
    logotyp: grafik?.logo?.primaryUrl
      ? funnet(grafik.logo.primaryUrl, "sajt", startNorm, { citat: `hittad via ${grafik.found.logoSource}`, sakerhet: "medel" })
      : tomt("Ingen logotyp kunde identifieras på startsidan."),
    // ONBOARD-2: färg läses med sammanhang och plattformsfärger rensas bort. Överlever
    // ingen färg lämnas fältet TOMT — färg är inget GHL kräver för att skapa kontot.
    fargpalett: fargpalett(start.html, startNorm, grafik?.found.colorCandidates ?? null),

    gbpKategori: gbpFalt(gbp?.kategori ?? null, gbp?.kallUrl ?? null, gbpVarfor(gbp, "kategori")),
    gbpBetyg: harVarde(betygSchema)
      ? betygSchema
      : gbpTal(gbp?.betyg ?? null, gbp?.kallUrl ?? null, gbpVarfor(gbp, "betyg")),
    gbpAntalRecensioner: harVarde(antalSchema)
      ? antalSchema
      : gbpTal(gbp?.antalRecensioner ?? null, gbp?.kallUrl ?? null, gbpVarfor(gbp, "antal recensioner")),
  };

  // ── ONBOARD-2: STANDARDGRINDEN ─────────────────────────────────────────────
  //
  // Regeln "belägg eller tomt" är bara värd något om den inte går att glida på. Här
  // kontrolleras den maskinellt: får något fält utanför STANDARD_TILLATNA källan
  // `standard` töms det på plats och förklaringen skrivs ut i klartext.
  //
  // Grinden är avsiktligt en OMSKRIVNING och inte ett undantag som kastas. Ett halvt
  // förslag är fortfarande användbart för Håkan; ett standardvärde som smugit sig in är
  // det inte. Vi vill inte fälla körningen — vi vill vägra leverera värdet.
  for (const nyckel of Object.keys(forslag) as ForslagNyckel[]) {
    const falt = forslag[nyckel] as Falt<unknown>;
    if (falt?.kalla === "standard" && !arStandardTillaten(nyckel)) {
      (forslag[nyckel] as Falt<unknown>) = tomt(
        `Fältet fylldes med ett standardvärde utan belägg (${JSON.stringify(falt.varde)}). Bara land och tidszon får ha standardvärde, eftersom GHL kräver dem för att skapa kontot. Fyll i manuellt eller lämna tomt.`,
      );
    }
  }

  // ── Varning när underlaget är svagt ────────────────────────────────────────
  const varningar: string[] = [];
  if (behovdeRendering) {
    varningar.push("Sajten renderas med JavaScript eller blockerade direkt läsning — innehållet hämtades via rendering.");
  }
  if (missar.length) {
    varningar.push(`${missar.length} av ${missar.length + sidor.length} sidor kunde inte läsas.`);
  }
  if (harlett.forkastade > 0) {
    varningar.push(`${harlett.forkastade} AI-förslag förkastades för att citatet inte gick att hitta i sajtens text.`);
  }
  if (sidor.length === 1) {
    varningar.push("Bara startsidan kunde läsas — profilen bygger på ett tunt underlag.");
  }

  const saknade = (Object.keys(forslag) as ForslagNyckel[])
    .filter((k) => !harVarde(forslag[k] as Falt<unknown>))
    .map((k) => ({ falt: k, varfor: (forslag[k] as Falt<unknown>).saknasVarfor || "Okänd anledning." }));

  // ONBOARD-2: fält som bär ett värde men kräver ett aktivt beslut innan godkännande.
  const granskas = (Object.keys(forslag) as ForslagNyckel[])
    .filter((k) => harVarde(forslag[k] as Falt<unknown>))
    .map((k) => {
      const f = forslag[k] as Falt<unknown>;
      if (f.konflikt && f.konflikt.length > 1) {
        const varianter = f.konflikt
          .map((c) => `${JSON.stringify(c.varde)} (${c.kalla}${c.kallUrl ? `, ${c.kallUrl}` : ""})`)
          .join(" mot ");
        return { falt: k, varfor: `Källorna säger olika: ${varianter}. Välj vilken som gäller.` };
      }
      if (f.sakerhet === "lag") {
        return {
          falt: k,
          varfor: f.citat
            ? `Svagt belägg — kontrollera mot källan. Citat: ${f.citat.slice(0, 200)}`
            : "Svagt belägg — kontrollera mot källan innan du godkänner.",
        };
      }
      return null;
    })
    .filter((x): x is { falt: ForslagNyckel; varfor: string } => x !== null);

  if (granskas.length) {
    varningar.push(`${granskas.length} fält kräver ett aktivt val innan godkännande.`);
  }

  return {
    forslag,
    skrap: {
      rotUrl: startNorm,
      lastaSidor: sidor.map((s) => ({ url: s.url, roll: s.roll, via: s.via, tecken: s.text.length })),
      missar,
      behovdeRendering,
      varning: varningar.length ? varningar.join(" ") : null,
    },
    saknade,
    granskas,
  };
}

// ── Små hjälpare för GBP-fälten ──────────────────────────────────────────────

function gbpVarfor(gbp: { tillganglig: boolean; fel: string | null } | null, vad: string): string {
  if (!gbp) return `Google Business Profile kunde inte kontrolleras — ingen ${vad} hämtad.`;
  if (!gbp.tillganglig) return `Google Business Profile är inte aktiverat: ${gbp.fel}`;
  return `Ingen ${vad} fanns i företagets Google-profil.`;
}

function gbpFalt(varde: string | null, kallUrl: string | null, varfor: string): Falt {
  return varde ? funnet(varde, "gbp", kallUrl, { sakerhet: "hog" }) : tomt(varfor);
}

function gbpTal(varde: number | null, kallUrl: string | null, varfor: string): Falt<number> {
  return varde != null ? funnet<number>(varde, "gbp", kallUrl, { sakerhet: "hog" }) : tomt<number>(varfor);
}
