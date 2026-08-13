// KUNSKAP-1 — tenantens egen ordlista. Håkans beställning 2026-08-12 efter For Balance.
//
// FYNDET, mätt innan något byggdes: bloggen om regression blev rätt, ett inlägg om samma
// ämne blev fel. Beställningen antog att blogg- och inläggsvägen hämtar kunskap olika.
// Det gör de INTE — alla fyra flöden (blogg, social, caption, studio-text) fick identisk
// profiltext, 10 879 tecken, samma klippning, och ordet fanns med i allihop.
//
// Den verkliga orsaken: ordet är aldrig DEFINIERAT. Hos For Balance står "regression"
// på exakt två ställen, båda som uppräkning och ingen som förklaring:
//   · "Erbjudande: tjänster"  — "Regression, resa till ett tidigare liv: två tillfällen…"
//   · "Erbjudande: priser"    — en prisrad, i den sektion som är märkt "skrivs aldrig ut"
//
// En 1000-ordsartikel har plats för sammanhanget bredvid ("resa till ett tidigare liv"),
// så bloggen landade rätt. Ett kort inlägg har ingen sådan plats, och då vinner modellens
// allmänna betydelse: statistisk regression. Det är alltså inte ett hämtningsfel utan ett
// TOMRUM — och tomrum fyller en språkmodell alltid med sin allmänna kunskap.
//
// ⚠ Därför ligger ordlistan i ett EGET lager och inte i profil-markdownen. Två skäl:
//   1. Profilen klipps (KLIPPORDNING) när den är för lång. En definition som kan klippas
//      är ingen definition — den är ett löfte som håller ibland.
//   2. Kravet är att tenantens betydelse ALLTID vinner över allmän kunskap. Det måste stå
//      som en regel, sent i prompten där reglerna väger tyngst, inte som en rad bland
//      hundra andra profilrader.
//
// ⚠ Ordlistan definierar BETYDELSE, aldrig sanning. Den får inte bli en bakväg för
// påhittade siffror eller påståenden — sanningskravet och prisregeln gäller oförändrat
// ovanpå. Det står uttryckligen i blocket.

/** En rad i ordlistan: ordet användaren skrev, och vad det betyder hos den här kunden. */
export interface Ordpost {
  ord: string;
  betydelse: string;
}

/**
 * Tolkar fritextfältet. En rad per ord, `ord = betydelse` eller `ord: betydelse`.
 * Tomma rader, rubriker och listmarkörer tas bort — Håkan skriver i samma fält-stil som
 * resten av profilformuläret, inte i ett format han måste minnas.
 */
export function tolkaOrdlista(raa: string | null | undefined): Ordpost[] {
  if (!raa || !raa.trim()) return [];
  const ut: Ordpost[] = [];
  for (const rad of raa.split("\n")) {
    const ren = rad.replace(/^\s*[-*•]\s*/, "").trim();
    if (!ren || ren.startsWith("#")) continue;
    // Första = eller : delar raden. Betydelsen får själv innehålla båda tecknen.
    const m = ren.match(/^([^=:]{1,60})[=:]\s*(.+)$/);
    if (!m) continue;
    const ord = m[1].trim();
    const betydelse = m[2].trim();
    if (!ord || !betydelse) continue;
    ut.push({ ord, betydelse });
  }
  return ut;
}

/**
 * Promptblocket. Tom sträng när ordlistan är tom — ett tomt block är en rubrik utan
 * innehåll, och modellen läser det som att kunden inte har några egna ord.
 */
/**
 * Läser tenantens ordlista. Service-role av samma skäl som profilen: `hm_brand_profile`
 * har strikt RLS, och med anon-nyckeln föll profilen tyst bort ur ALL generering en gång
 * (lesson_brand_profile_anon_rls_silent_drop). Läsningen är tenant-låst på client_id.
 *
 * Kastar aldrig. En trasig ordlista får inte fälla textflödet — då hade en tom kolumn
 * kunnat stoppa all generering hos en kund.
 */
export async function hamtaOrdlista(clientId: string): Promise<Ordpost[]> {
  try {
    const { supabaseService } = await import("./supabase-admin");
    const { data } = await supabaseService()
      .from("hm_brand_profile")
      .select("ordlista")
      .eq("client_id", clientId)
      .maybeSingle();
    return tolkaOrdlista((data as { ordlista?: string } | null)?.ordlista);
  } catch (e) {
    console.error("[ordlista] kunde inte hämtas:", e);
    return [];
  }
}

export function ordlistaBlock(poster: Ordpost[]): string {
  if (!poster.length) return "";
  const rader = poster.map((p) => `- "${p.ord}" betyder här: ${p.betydelse}`);
  return [
    "=== KUNDENS EGNA ORD (gäller ALLTID före allmän betydelse) ===",
    ...rader,
    "",
    "Står ett av orden ovan i ämnet eller i texten du skriver är det DEN betydelsen som gäller,",
    "även om ordet betyder något helt annat i vardagsspråk eller i ett annat yrke. Skriv aldrig",
    "om den allmänna betydelsen, och blanda aldrig ihop de två i samma text.",
    "Ordlistan säger vad ett ord BETYDER — den säger ingenting om vad som är sant. Sanningskravet",
    "och prisregeln gäller oförändrat: en betydelse är inget tillstånd att hitta på siffror,",
    "resultat eller kundfall.",
  ].join("\n");
}

// Ord som finns i varje svensk text och inte säger något om ämnet. Utan den här listan
// skulle nästan varje ämne "träffa" profilen och varningen tappa all betydelse.
const STOPPORD = new Set([
  "och", "eller", "men", "för", "att", "det", "den", "som", "med", "till", "från", "över",
  "under", "efter", "innan", "utan", "kunden", "kunder", "företag", "arbete", "arbetar",
  "tjänst", "tjänster", "hjälp", "hjälper", "själv", "sedan", "andra", "något", "detta",
  "mycket", "riktigt", "alltid", "aldrig", "genom", "varför", "vilket", "eftersom",
]);

/**
 * Skyddsnätet för ord som ännu inte står i ordlistan.
 *
 * Beställningens krav gäller "tenantens egen kunskap ELLER profil". Ordlistan täcker det
 * kunden hunnit skriva in; det här täcker resten: ett ämnesord som faktiskt förekommer i
 * profilen får en uttrycklig påminnelse om att profilens betydelse gäller. Deterministiskt,
 * ingen AI, inga nya anrop.
 *
 * Medvetet snålt: minst 5 tecken, inga stoppord, och ordet måste finnas i profilTEXTEN som
 * modellen faktiskt får se — inte i den råa profilen. Står ordet i en sektion som klipptes
 * bort finns det inte i prompten, och då vore påminnelsen en hänvisning till tomma luften.
 */
export function amnesordIProfilen(amne: string, profilText: string, redanIOrdlistan: Ordpost[] = []): string[] {
  if (!amne?.trim() || !profilText) return [];
  const kanda = new Set(redanIOrdlistan.map((p) => p.ord.toLowerCase()));
  const profilLower = profilText.toLowerCase();
  const traffar = new Set<string>();
  for (const rått of amne.split(/[^a-zA-ZåäöÅÄÖ0-9-]+/)) {
    const ord = rått.toLowerCase();
    if (ord.length < 5 || STOPPORD.has(ord) || kanda.has(ord)) continue;
    if (profilLower.includes(ord)) traffar.add(ord);
  }
  return [...traffar];
}

/** Påminnelsen för orden ovan. Tom sträng när inget träffade. */
export function amnesordBlock(ord: string[]): string {
  if (!ord.length) return "";
  return [
    `=== ORD UR ÄMNET SOM FINNS I KUNDENS PROFIL: ${ord.join(", ")} ===`,
    "De här orden står i kundens egen profil. Använd den betydelse profilen ger dem, aldrig",
    "en allmän betydelse från ett annat område. Är profilens betydelse otydlig: skriv om ordet",
    "på ett sätt som stämmer med kundens verksamhet, och hitta aldrig på en definition.",
  ].join("\n");
}
