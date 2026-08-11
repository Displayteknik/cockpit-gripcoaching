// T-6b-GRIND — uppfunna minnen om en enskild kund fälls PROGRAMMATISKT. Håkans fynd 10/8.
//
// Fyndet: alla tre captionvarianter för For Balance öppnade med "Jag minns en kvinna som kom
// till mig med panikångest, flera attacker om dagen. Hon hade levt så länge med det att hon
// inte mindes ett liv utan ångest." Kontrollerat i profilen: den kvinnan finns INTE i
// Kundberättelser. Det som finns är en ordagrann Bokadirekt-recension under Kundernas egna
// ord — "Jag har gått från att ha mellan 15-30 panikångestattack per dag, till att inte
// minnas när jag senast hade en" — daterad, från en verklig, identifierbar person, med
// profilens egen anmärkning "Använd bara efter Gittes godkännande, och alltid avidentifierat".
//
// Modellen gjorde alltså en SCEN av ett CITAT, och satte terapeuten som ögonvittne. Två fel
// i ett: ett minne som aldrig ägt rum enligt vår data, och en verklig klients känsliga
// uppgifter återberättade i tredje person.
//
// ⚠ Instruktionen förbjöd redan detta i klartext (krok-vinkeln "Berättelse" i captionvägen
// säger uttryckligen "Skriv ALDRIG 'jag minns en kund', 'en kvinna som kom hit'"). Den höll
// inte. En regel som bara finns i prompten är ett önskemål — därför den här grinden.
//
// Strukturell orsak som förklarar VARFÖR modellen fyllde luckan: `KLIPPORDNING` i prompt-core
// klipper "Story-bank" FÖRST när profilen är för lång. Vinkeln ber om en händelse ur
// story-banken samtidigt som story-banken kan ha lyfts ut ur samma prompt. Utan material och
// med ett uttryckligt uppdrag att berätta tar modellen det närmaste som liknar en händelse:
// kundcitatet. Grinden fäller resultatet; anroparen ska dessutom aldrig BE om en scen när
// story-banken saknas (se `harStorybank` i suggest-caption).

/**
 * Mönster som beskriver en scen om EN enskild person, berättad av verksamheten själv.
 * Medvetet snäva: de kräver både en person OCH en händelse. "Många som hör av sig till oss"
 * och "Vi möter ofta" är generella igenkänningsscener och ska passera fritt — de är just det
 * vinkeln ska falla tillbaka på.
 */
export const MINNES_MONSTER: { namn: string; re: RegExp }[] = [
  { namn: "jag minns", re: /\bjag\s+minns\b/i },
  { namn: "jag hade en kund", re: /\bjag\s+(hade|fick|träffade|mötte)\s+(en|ett)\s+(kvinna|man|kund|klient|patient|person|tjej|kille|par)\b/i },
  { namn: "en av mina kunder", re: /\ben\s+av\s+(mina|våra)\s+(kunder|klienter|patienter)\b/i },
  // ⚠ "skrev" är MEDVETET utelämnat. "En kund skrev själv: ..." är hur man tillskriver ett
  // ordagrant citat — tillåtet, och det enda sättet att återge kundens egna ord ärligt.
  // Första versionen hade med det och fällde exakt den formen (fångat av test).
  { namn: "person som kom till mig", re: /\b(en|ett)\s+(kvinna|man|kund|klient|patient|person|tjej|kille|par)\s+(som\s+)?(kom|hörde av sig|ringde|sökte|satt|bokade)\b/i },
  { namn: "hon kom till mig", re: /\b(hon|han|hen)\s+(kom|ringde|sökte|bokade)\s+(till\s+)?(mig|oss)\b/i },
  { namn: "för en tid sedan kom", re: /\bför\s+(ett\s+par|några|en|två|tre)\s+(dagar|veckor|månader|år)\s+sedan\s+\w*\s*(kom|ringde|hörde|satt|bokade)\b/i },
];

/**
 * Fraserna i texten som läser som ett minne om en enskild kund. Tom lista = inget att fälla.
 * Rör aldrig ordagranna citat — ett citat inom citattecken är kundens egna ord, inte en scen
 * verksamheten påstår sig minnas. Citaten plockas därför bort före mätningen.
 */
export function hittaUppfunnetMinne(text: string): string[] {
  if (!text?.trim()) return [];
  // Ta bort citerade partier: "..." och ”...” och '...'. Ett citat är en referens, inte en scen.
  const utanCitat = text
    .replace(/[”"«][^”"»]{10,}[”"»]/g, " ")
    .replace(/'[^']{20,}'/g, " ");
  const traffar: string[] = [];
  for (const m of MINNES_MONSTER) {
    const t = m.re.exec(utanCitat);
    if (t) traffar.push(t[0].trim());
  }
  return traffar;
}

/**
 * Skärpningen vid omgenerering. Säger vad som ska bort OCH vad som ska stå i stället —
 * ett förbud utan alternativ ger en text som bara tappar sin öppning.
 */
export const MINNE_SKARPNING = [
  "=== FÖRBJUDET: UPPFUNNET MINNE OM EN ENSKILD KUND ===",
  "Förra försöket berättade om en enskild person som om du mindes henne ('jag minns en kvinna som kom till mig...'). Det är förbjudet, och det finns ingen sådan händelse i varumärkesprofilens Kundberättelser att bygga den på.",
  "Kundernas egna ord (recensioner, omdömen, citat) är SPRÅK — inte händelser. De har varken person, tidpunkt eller plats, och får aldrig göras till en scen. Att en recension är äkta gör inte scenen sann: den beskriver en verklig, identifierbar människas hälsa, och den återberättas aldrig i tredje person.",
  "Skriv om öppningen som en GENERELL igenkänning, utan huvudperson och utan att du minns något: 'Många som hör av sig...', 'Det vi möter oftast är...', 'En vanlig situation är...'.",
  "Inga datum, inga platser, inga åldrar, ingen enskild person — och skriv aldrig 'jag minns'.",
].join("\n");

/**
 * Krok-instruktionen för berättelse-vinkeln NÄR story-banken saknas i prompten. Att be om en
 * händelse som inte finns är samma sak som att beställa en påhittad — det var den beställningen
 * som gav fyndet 10/8.
 */
export const BERATTELSE_UTAN_STORYBANK =
  "Öppna med en GENERELL igenkänningsscen — ingen huvudperson, ingen enskild kund, inget minne. " +
  "Varumärkesprofilen innehåller ingen story-bank med verkliga händelser, så det finns ingenting att berätta ur. " +
  "Använd formen 'Många som hör av sig...', 'Det vi möter oftast...', 'En vanlig situation är...'. " +
  "Kundernas egna ord och recensioner är SPRÅK, inte händelser: de får aldrig bli en scen, en person eller ett minne. " +
  "Skriv ALDRIG 'jag minns', 'en kvinna som kom till mig', 'en av mina klienter', ett datum, en ålder eller en plats.";

/** Har profilprompten en story-bank att berätta ur? Klipps sektionen bort är svaret nej. */
export function harStorybank(profilText: string): boolean {
  if (!profilText) return false;
  const i = profilText.search(/story-?bank/i);
  if (i < 0) return false;
  // Rubriken räcker inte — det ska stå något efter den. Ett tomt fält är ingen story-bank.
  return profilText.slice(i).replace(/story-?bank\s*:?/i, "").trim().length > 40;
}
