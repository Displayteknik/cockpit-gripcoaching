// ONBOARD-2 — märkesfärg med belägg, eller ingen färg alls.
//
// ⚠ VARFÖR DEN HÄR FILEN FINNS, OCH VARFÖR FREKVENS INTE DUGER SOM METOD
//
// Provkörningen mot displayteknik.se gav `#188bf6` som primärfärg. Färgen var inte
// påhittad — den förekom 23 gånger på sidan, mot 3 för den riktiga knappfärgen `#004E89`.
// Frekvensen hade rätt och svaret var ändå fel: `#188bf6` är GoHighLevels egen standardblå
// ur plattformens tema-CSS, inte kundens färg.
//
// Det är inte ett kantfall. Sajter byggda i GHL, Wix, Squarespace, Hemsida24 och Bootstrap
// bär alltid mer plattforms-CSS än egen CSS. På just de sajterna — alltså merparten av
// kunderna — vinner plattformens färg varje gång man räknar förekomster.
//
// Därför två skiften:
//   1. Plattformarnas kända standardfärger räknas bort helt. De är aldrig kundens val.
//   2. Färger som används på KNAPPAR och RUBRIKER väger tyngre än färger som bara
//      förekommer ofta. En knappfärg är ett aktivt designbeslut; en bakgrundston är det
//      sällan.
//
// Överlever ingen färg är fältet TOMT och flaggat. Färg är inget GHL kräver för att skapa
// kontot, alltså finns ingen ursäkt för ett standardvärde här. Se STANDARD_TILLATNA.

import { tomt, funnet, type Falt } from "./typer";

/**
 * Kända plattforms- och ramverksfärger. Att en av dem är vanligast på sidan säger bara
 * vilket verktyg sajten är byggd i — aldrig vilken färg företaget valt.
 *
 * Håll listan konservativ: hellre missa en plattformsfärg än att kasta bort en kund som
 * faktiskt valt samma blå. Alla poster nedan är verifierade standardvärden.
 */
const PLATTFORMSFARGER = new Map<string, string>([
  ["#188bf6", "GoHighLevels standardblå"],
  ["#2563eb", "Tailwind blue-600 (ramverkets standard)"],
  ["#3b82f6", "Tailwind blue-500 (ramverkets standard)"],
  ["#0d6efd", "Bootstrap 5 primary"],
  ["#007bff", "Bootstrap 4 primary"],
  ["#4285f4", "Google-blå (inbäddade widgets)"],
  ["#1877f2", "Facebooks varumärkesblå (delningsknappar)"],
  ["#25d366", "WhatsApp-grön (chattknappar)"],
  ["#e60023", "Pinterest-röd (delningsknappar)"],
  ["#ff0000", "YouTube-röd (inbäddade spelare)"],
  ["#0a66c2", "LinkedIn-blå (delningsknappar)"],
  ["#1da1f2", "Twitter/X-blå (delningsknappar)"],
  ["#405de6", "Instagram-blå (delningsknappar)"],
  ["#3897f0", "Instagram-knappblå"],
  ["#5e6ad2", "Linear/SaaS-mallars standardlila"],
  ["#6772e5", "Stripe-lila (betalwidgets)"],
]);

/** Normaliserar #abc och #AABBCC till gemener i sexsiffrig form. */
export function normaliseraHex(ra: string): string | null {
  const m = ra.trim().toLowerCase().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (!m) return null;
  const h = m[1];
  return `#${h.length === 3 ? h[0] + h[0] + h[1] + h[1] + h[2] + h[2] : h}`;
}

const kanaler = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

/**
 * Gråskala, nästan-svart och nästan-vitt är text- och bakgrundsfärger, inte märkesfärger.
 * Mättnaden mäts som skillnaden mellan högsta och lägsta kanal.
 */
function arNeutral(hex: string): boolean {
  const [r, g, b] = kanaler(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max - min < 24) return true;      // grått
  if (max < 28) return true;             // nästan svart
  if (min > 232) return true;            // nästan vitt
  return false;
}

/**
 * ★ PLATTFORMENS EGNA SELEKTORER — starkare signal än någon hex-lista.
 *
 * Första försöket rensade bort kända plattformsfärger på HEX-värde. Det höll inte:
 * provkörningen mot displayteknik.se gav då `#3a8ea8` ur regeln
 *   `:where([data-ghl-form-element]) .ghl-button { background-color: #3a8ea8 }`
 * — alltså GoHighLevels formulärknapp, med en färg som inte står i någon lista eftersom
 * plattformen färgar sina widgets olika per sajt.
 *
 * Rätt skiljelinje är alltså inte VILKEN färg det är, utan VEM som äger selektorn. Ett
 * regelnamn med plattformens prefix beskriver plattformens komponent, aldrig kundens
 * märke — oavsett vilken färg som står i den.
 */
const PLATTFORMS_SELEKTOR =
  /(^|[^a-z])(ghl[-_]|data-ghl|hl[-_]form|wixui|wix-|sqs-|squarespace|elementor|wp-block|woocommerce|shopify|jet-|brz-|gjs-|hs-(button|form)|mailchimp|mc4wp|tve[-_]|et[-_]pb|fl-builder|vc[-_]|swiper|fa-|cookie|consent|cky-|iubenda|cc-banner|recaptcha|intercom|drift|tawk|zendesk|hubspot)/i;

/** Selektorer och egenskaper som pekar ut ett aktivt designbeslut snarare än en bakgrund. */
const KNAPP_KONTEXT = /(btn|button|cta|primary|knapp|call-to-action|submit|\bhero\b)/i;
const RUBRIK_KONTEXT = /(^|[^a-z])(h1|h2|h3|heading|rubrik|title)([^a-z]|$)/i;

interface Kandidat {
  hex: string;
  antal: number;
  /** Högsta vikt färgen fått av sitt sammanhang. */
  vikt: number;
  /** Kortaste CSS-regel färgen sågs i — används som citat. */
  belagg: string;
}

/**
 * Läser färger ur HTML:ens style-block och inline-stilar, med det sammanhang de står i.
 *
 * Vi tolkar inte extern CSS. Det är ett medvetet avkall: en extern fil kan vara megabyte
 * plattformstema, och att räkna färger där gör problemet ovan värre, inte bättre.
 */
export function lasFargkandidater(html: string): Kandidat[] {
  const karta = new Map<string, Kandidat>();

  const registrera = (raHex: string, kontext: string, vikt: number) => {
    const hex = normaliseraHex(raHex);
    if (!hex) return;
    if (arNeutral(hex)) return;
    if (PLATTFORMSFARGER.has(hex)) return;
    const kort = kontext.replace(/\s+/g, " ").trim().slice(0, 120);
    const fanns = karta.get(hex);
    if (fanns) {
      fanns.antal += 1;
      if (vikt > fanns.vikt) { fanns.vikt = vikt; fanns.belagg = kort; }
      else if (kort.length < fanns.belagg.length && vikt === fanns.vikt) fanns.belagg = kort;
    } else {
      karta.set(hex, { hex, antal: 1, vikt, belagg: kort });
    }
  };

  // CSS-regler: "selektor { ... färg ... }". Sammanhanget är hela regeln.
  for (const m of html.matchAll(/([^{}]{1,200})\{([^{}]{1,600})\}/g)) {
    const selektor = m[1];
    const kropp = m[2];
    // Plattformens egna komponenter beskriver plattformen, inte kunden. Hoppas helt.
    if (PLATTFORMS_SELEKTOR.test(selektor)) continue;
    let vikt = 1;
    if (KNAPP_KONTEXT.test(selektor)) vikt = 4;
    else if (RUBRIK_KONTEXT.test(selektor)) vikt = 3;
    // En färg satt som `background` på en knapp är starkare signal än en `border-color`.
    for (const f of kropp.matchAll(/(background(?:-color)?|color|border-color|fill)\s*:\s*(#[0-9a-fA-F]{3,6})/g)) {
      const egenskap = f[1];
      const extra = /^background/.test(egenskap) ? 1 : 0;
      registrera(f[2], `${selektor.trim()} { ${egenskap}: ${f[2]} }`, vikt + extra);
    }
  }

  // ── CSS-variabler: sajtens DEKLARERADE palett ────────────────────────────
  //
  // ★ Detta är den starkaste signalen som finns, och den missades först.
  //
  // Ett tidigt försök letade bara efter variabler med talande namn (--primary, --brand).
  // Men sidbyggare döper kundens färger med ogenomskinliga id:n. Displaytekniks riktiga
  // märkesfärg står i HTML:en som `--color-l1guhk3v:#004E89` — det är exakt den färg
  // Håkan valde i GHL:s editor, och namnet avslöjar ingenting.
  //
  // Alla egendefinierade färgvariabler räknas därför, utom de rent generiska (--white,
  // --black, --gray-500) som varje tema deklarerar oavsett kund.
  // Generiska temavariabler. Utöver de självklara (--white, --gray-500) räknas även rena
  // FÄRGNAMN bort: GHL deklarerar en hel namngiven palett (--cobalt, --indigo, --crimson)
  // som följer med temat oavsett kund. Kundens egna val ligger i stället under
  // ogenomskinliga id:n som `--color-l1guhk3v`. Ett färgnamn är temats, ett id är kundens.
  const GENERISK_VARIABEL =
    /^--(white|black|transparent|current|gray|grey|slate|zinc|neutral|stone|light|dark|muted|border|shadow|overlay|backdrop|text|bg|background|foreground|cobalt|indigo|crimson|teal|azure|amber|emerald|rose|violet|cyan|lime|fuchsia|magenta|turquoise|coral|olive|navy|maroon|plum|mint|peach|lavender|gold|silver|bronze|red|blue|green|yellow|orange|purple|pink|brown|beige|ivory|salmon|khaki|tan)([-_]|\d|$)/i;

  for (const m of html.matchAll(/(--[a-z0-9_-]+)\s*:\s*(#[0-9a-fA-F]{3,6})\b/gi)) {
    if (GENERISK_VARIABEL.test(m[1])) continue;
    registrera(m[2], `${m[1]}: ${m[2]}`, 6);
  }

  return [...karta.values()].sort((a, b) => b.vikt - a.vikt || b.antal - a.antal);
}

/**
 * Märkesfärgen med belägg, eller ett tomt fält med förklaring.
 *
 * `kandidaterFranAgent` är brand-agentens frekvenslista. Den används bara som sista utväg
 * och rensas då mot samma plattformslista — annars vore hela poängen borta.
 */
export function fargpalett(
  html: string | null,
  startUrl: string,
  kandidaterFranAgent?: string[] | null,
): Falt<string[]> {
  const funna = html ? lasFargkandidater(html) : [];

  if (funna.length) {
    const palett = funna.slice(0, 5).map((k) => k.hex);
    const basta = funna[0];
    // Vikt 1 betyder att färgen bara dök upp i en vanlig regel utan knapp-, rubrik- eller
    // variabelsammanhang. Den är läst, men den är inte ett belagt designbeslut.
    const sakerhet = basta.vikt >= 4 ? "hog" : basta.vikt >= 3 ? "medel" : "lag";
    return funnet(palett, "sajt", startUrl, {
      citat: basta.belagg,
      sakerhet,
    });
  }

  // Fallback: brand-agentens lista, rensad. Aldrig orensad — se filhuvudet.
  const rensade = (kandidaterFranAgent ?? [])
    .map(normaliseraHex)
    .filter((h): h is string => !!h && !arNeutral(h) && !PLATTFORMSFARGER.has(h));

  if (rensade.length) {
    return funnet(rensade.slice(0, 5), "sajt", startUrl, {
      citat: `${rensade.length} färger räknade i sajtens CSS (plattformsfärger bortrensade)`,
      sakerhet: "lag",
    });
  }

  const bortrensat = (kandidaterFranAgent ?? [])
    .map(normaliseraHex)
    .filter((h): h is string => !!h && PLATTFORMSFARGER.has(h));

  if (bortrensat.length) {
    const namn = bortrensat.map((h) => `${h} (${PLATTFORMSFARGER.get(h)})`).join(", ");
    return tomt<string[]>(
      `Enda färgerna som gick att läsa var plattformens egna: ${namn}. De är standardfärger i verktyget sajten är byggd i, inte företagets val — därför lämnas fältet tomt. Ange märkesfärgen manuellt.`,
    );
  }

  return tomt<string[]>("Ingen färg kunde läsas ur sajtens CSS.");
}
