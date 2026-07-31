// lib/content/sasong.ts — BILD-5b: datum- och säsongsmedvetenhet.
// Ren, testbar modul (datum som parameter, ingen DB, inget nät). Ger svenska
// säsongsmarkörer + årstid för ett datum, promptrader (sv/en) och detektering
// av säsongsord i fritext (används av bildredigeringen).
//
// Skarpt fel som föranledde modulen: generering i juli föreslog semla.

export type Arstid = "vinter" | "vår" | "sommar" | "höst";
export type ArstidEn = "winter" | "spring" | "summer" | "autumn";

export interface SasongsInfo {
  datumStr: string; // "31 juli 2026"
  datumStrEn: string; // "31 July 2026"
  arstid: Arstid;
  arstidEn: ArstidEn;
  narmasteMarkorer: string[]; // t.ex. ["kräftskivesäsongen (8 augusti)", "skolstart (17 augusti)"]
  narmasteMarkorerEn: string[];
}

const MANADER = ["januari", "februari", "mars", "april", "maj", "juni", "juli", "augusti", "september", "oktober", "november", "december"];
const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// Markör-fönster: nyss passerade (−7 d) t.o.m. kommande (+45 d) — nog för att
// februari ska bära semlan och juli kräftskivan, utan att dra in fel säsong.
const FONSTER_FORE_DAGAR = 7;
const FONSTER_EFTER_DAGAR = 45;

// Påskdagen enligt den anonyma gregorianska algoritmen (computus).
export function paskdagen(ar: number): Date {
  const a = ar % 19;
  const b = Math.floor(ar / 100);
  const c = ar % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const manad = Math.floor((h + l - 7 * m + 114) / 31); // 3 = mars, 4 = april
  const dag = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ar, manad - 1, dag);
}

function addDagar(d: Date, dagar: number): Date {
  const ut = new Date(d);
  ut.setDate(ut.getDate() + dagar);
  return ut;
}

// Första datum med given veckodag (0=sön..6=lör) i intervallet [start, start+6].
function veckodag(ar: number, manadIdx: number, startDag: number, dag: number): Date {
  for (let i = 0; i < 7; i++) {
    const d = new Date(ar, manadIdx, startDag + i);
    if (d.getDay() === dag) return d;
  }
  return new Date(ar, manadIdx, startDag);
}

interface Markor {
  namn: string;
  namnEn: string;
  datum: Date;
}

// Årets svenska säsongsmarkörer (rörliga helger beräknas).
export function markorerForAr(ar: number): Markor[] {
  const pask = paskdagen(ar);
  return [
    { namn: "trettondedag jul", namnEn: "Epiphany", datum: new Date(ar, 0, 6) },
    { namn: "fettisdagen (semmeldags)", namnEn: "Shrove Tuesday (semla day)", datum: addDagar(pask, -47) },
    { namn: "påsk", namnEn: "Easter", datum: pask },
    { namn: "valborg", namnEn: "Walpurgis Night", datum: new Date(ar, 3, 30) },
    // Midsommarafton: fredagen 19–25 juni.
    { namn: "midsommar", namnEn: "Midsummer", datum: veckodag(ar, 5, 19, 5) },
    { namn: "kräftskivesäsongen", namnEn: "crayfish party season", datum: new Date(ar, 7, 8) },
    { namn: "skolstart", namnEn: "school year start", datum: new Date(ar, 7, 17) },
    // Alla helgons dag: lördagen 31 okt–6 nov.
    { namn: "alla helgons dag", namnEn: "All Saints' weekend", datum: veckodagAllhelgona(ar) },
    { namn: "lucia", namnEn: "Lucia", datum: new Date(ar, 11, 13) },
    { namn: "jul", namnEn: "Christmas", datum: new Date(ar, 11, 24) },
    { namn: "nyår", namnEn: "New Year", datum: new Date(ar, 11, 31) },
  ];
}

function veckodagAllhelgona(ar: number): Date {
  const okt31 = new Date(ar, 9, 31);
  return okt31.getDay() === 6 ? okt31 : veckodag(ar, 10, 1, 6);
}

// ── Säsongsuttryck (BILD-7b) — samma säsong har många uttryck ────────────────
// Skarpt fel: två genereringar i rad landade i samma säsongsmarkör (kräftmotiv).
// Orsaken är att markörlistan bara innehåller HÖGTIDER — den närmaste vinner varje
// gång. Uttrycken nedan beskriver årstiden bredare: ljus, väder, växtlighet, rytm
// och miljö. De är avsiktligt BRANSCHNEUTRALA — ett uttryck får aldrig peka ut en
// produkt (det är tenantens verksamhet som bestämmer motivet), bara stämningen det
// ska bäras av. Plattformsregel: fungerar lika bra för blomsteraffär, bilhandlare
// och coach.
const UTTRYCK: Record<Arstid, { sv: string; en: string }[]> = {
  vinter: [
    { sv: "lågt vintersolljus mitt på dagen", en: "low winter sun at midday" },
    { sv: "tidig skymning och tända lampor inomhus", en: "early dusk with warm indoor lighting" },
    { sv: "snö, frost eller blöt asfalt", en: "snow, frost or wet asphalt" },
    { sv: "ytterkläder, mössor och varm dryck", en: "outerwear, hats and a warm drink" },
    { sv: "nystart och planering inför året", en: "fresh starts and planning for the year" },
    { sv: "inomhusmiljöer med mycket värme i ljuset", en: "indoor settings with plenty of warmth in the light" },
    { sv: "stilla, lugna dagar mellan högtiderna", en: "quiet, calm days between the holidays" },
    { sv: "kort dag, ljuset som resurs", en: "short daylight hours, light used deliberately" },
  ],
  vår: [
    { sv: "klart, skarpt vårljus", en: "clear, crisp spring light" },
    { sv: "knoppar, tidiga blommor och grönt som spirar", en: "buds, early flowers and fresh green shoots" },
    { sv: "vårstädning och iordningställande", en: "spring cleaning and getting things in order" },
    { sv: "lättare kläder, jacka men ingen mössa", en: "lighter clothing, a jacket but no hat" },
    { sv: "regnskurar och blöta trottoarer i solsken", en: "rain showers and wet pavements in sunshine" },
    { sv: "längre kvällar, ljus efter arbetsdagen", en: "longer evenings, daylight after the working day" },
    { sv: "utomhusarbete som återupptas", en: "outdoor work starting up again" },
    { sv: "planering inför sommaren", en: "planning ahead for the summer" },
  ],
  sommar: [
    { sv: "varmt kvällsljus, långa skuggor", en: "warm evening light, long shadows" },
    { sv: "uteserveringar och öppna dörrar", en: "outdoor seating and open doors" },
    { sv: "skörd, mognad och full grönska", en: "harvest, ripeness and full greenery" },
    { sv: "lediga dagar och lugnare tempo", en: "days off and a slower pace" },
    { sv: "återstart efter semestern, back to business", en: "getting back to business after the holidays" },
    { sv: "kortärmat, sol och skugga i samma bild", en: "short sleeves, sun and shade in the same frame" },
    { sv: "sen kväll som fortfarande är ljus", en: "late evening that is still bright" },
    { sv: "vatten, bad och utomhusliv", en: "water, swimming and outdoor life" },
  ],
  höst: [
    { sv: "gyllene lövverk och lågt ljus", en: "golden foliage and low light" },
    { sv: "regn, dimma och blöta ytor", en: "rain, mist and wet surfaces" },
    { sv: "tända skyltfönster i mörknande eftermiddag", en: "lit shop windows in a darkening afternoon" },
    { sv: "lager på lager, halsduk och jacka", en: "layered clothing, scarf and jacket" },
    { sv: "ny termin, nya rutiner", en: "new term, new routines" },
    { sv: "inomhusvärme och mysbelysning", en: "indoor warmth and cosy lighting" },
    { sv: "förberedelser inför vintern", en: "getting ready for winter" },
    { sv: "skörd som tas in, avslut på säsongen", en: "the last of the harvest, the season closing" },
  ],
};

// Liten deterministisk generator: samma frö → samma urval. Utan frö slumpas det,
// vilket är hela poängen — två genereringar i rad ska INTE få samma uttryck.
function blanda<T>(lista: T[], fro: number): T[] {
  const ut = [...lista];
  let s = fro >>> 0 || 1;
  for (let i = ut.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [ut[i], ut[j]] = [ut[j], ut[i]];
  }
  return ut;
}

export interface VariationsVal {
  /** Motiv som nyligen använts — renderas som "välj något annat". */
  nyligenMotiv?: string[];
  /** Frö för urvalet. Utelämnat = slumpas (rotation mellan genereringar). */
  fro?: number;
  /** Antal uttryck att lyfta fram. Default 3. */
  antal?: number;
}

/** Roterande urval av årstidens uttryck. Exporterad för test och återanvändning. */
export function sasongsUttryck(arstid: Arstid, opts?: VariationsVal): { sv: string; en: string }[] {
  const antal = Math.max(1, Math.min(opts?.antal ?? 3, UTTRYCK[arstid].length));
  const fro = opts?.fro ?? Math.floor(Math.random() * 0xffffffff);
  return blanda(UTTRYCK[arstid], fro).slice(0, antal);
}

// Nyligen använda motiv → kort rad. Trimmas och tak-begränsas defensivt (samma
// mönster som prompt-cores nyligen-lager).
function nyligenRad(motiv: string[] | undefined, sprak: "sv" | "en"): string {
  const rensade = (motiv ?? [])
    .map((m) => String(m ?? "").replace(/\s+/g, " ").trim().slice(0, 120))
    .filter(Boolean)
    .slice(0, 5);
  if (!rensade.length) return "";
  return sprak === "sv"
    ? ` NYLIGEN ANVÄNDA MOTIV (välj ett annat den här gången): ${rensade.join(" | ")}.`
    : ` RECENTLY USED MOTIFS (pick a different one this time): ${rensade.join(" | ")}.`;
}

export function arstidFor(datum: Date): Arstid {
  const m = datum.getMonth();
  if (m === 11 || m <= 1) return "vinter";
  if (m <= 4) return "vår";
  if (m <= 7) return "sommar";
  return "höst";
}

const ARSTID_EN: Record<Arstid, ArstidEn> = { vinter: "winter", vår: "spring", sommar: "summer", höst: "autumn" };

export function sasongsInfo(datum: Date = new Date()): SasongsInfo {
  const fran = addDagar(datum, -FONSTER_FORE_DAGAR).getTime();
  const till = addDagar(datum, FONSTER_EFTER_DAGAR).getTime();
  const ar = datum.getFullYear();
  const alla = [...markorerForAr(ar - 1), ...markorerForAr(ar), ...markorerForAr(ar + 1)];
  const nara = alla
    .filter((mk) => mk.datum.getTime() >= fran && mk.datum.getTime() <= till)
    .sort((x, y) => x.datum.getTime() - y.datum.getTime());

  const arstid = arstidFor(datum);
  return {
    datumStr: `${datum.getDate()} ${MANADER[datum.getMonth()]} ${datum.getFullYear()}`,
    datumStrEn: `${datum.getDate()} ${MONTHS_EN[datum.getMonth()]} ${datum.getFullYear()}`,
    arstid,
    arstidEn: ARSTID_EN[arstid],
    narmasteMarkorer: nara.map((mk) => `${mk.namn} (${mk.datum.getDate()} ${MANADER[mk.datum.getMonth()]})`),
    narmasteMarkorerEn: nara.map((mk) => `${mk.namnEn} (${mk.datum.getDate()} ${MONTHS_EN[mk.datum.getMonth()]})`),
  };
}

// Kort kontextrad för textprompterna (svenska) — läggs i systemet av prompt-core.
// BILD-7b: variationsraden sist — högtidsmarkören får aldrig bli den enda ingången.
export function sasongsPromptRad(datum: Date = new Date(), opts?: VariationsVal): string {
  const i = sasongsInfo(datum);
  const markorer = i.narmasteMarkorer.length ? i.narmasteMarkorer.join(", ") : "inga särskilda högtider";
  const uttryck = sasongsUttryck(i.arstid, opts).map((u) => u.sv).join(", ");
  return (
    `AKTUELL TID: ${i.datumStr}, ${i.arstid}. Närmast: ${markorer}. ` +
    `Innehållet ska vara relevant för aktuell tid på året — föreslå ALDRIG produkter/motiv ur fel säsong om inte användaren uttryckligen ber om det. ` +
    `VARIERA SÄSONGSUTTRYCKET: samma årstid har många uttryck och högtiden är bara ett av dem. Luta den här gången åt: ${uttryck}. ` +
    `Återanvänd aldrig samma säsongsmotiv två gånger i rad.` +
    nyligenRad(opts?.nyligenMotiv, "sv")
  );
}

// Samma kontextrad för bildprompterna (engelska). Säsongen gäller HELA scenen —
// kläder, ljus, växtlighet, väder — aldrig bara produkten (Håkans tillägg).
// BILD-7b: uttrycken roterar mellan genereringar, och kända nyligen använda motiv
// skickas in som "välj ett annat" där flödet har historiken lättillgänglig.
export function seasonPromptLineEn(datum: Date = new Date(), opts?: VariationsVal): string {
  const i = sasongsInfo(datum);
  const markers = i.narmasteMarkorerEn.length ? i.narmasteMarkorerEn.join(", ") : "no major holidays";
  const uttryck = sasongsUttryck(i.arstid, opts).map((u) => u.en).join(", ");
  return (
    `CURRENT TIME: ${i.datumStrEn}, ${i.arstidEn} in Sweden. Nearby: ${markers}. ` +
    `The content must fit the actual time of year — NEVER suggest products or motifs from the wrong season unless the user explicitly asks. ` +
    `Season consistency applies to the ENTIRE scene: clothing, lighting, daylight length, vegetation, weather and environment must all match ${i.arstidEn} — never mix seasonal cues. ` +
    `VARY THE SEASONAL CUE: the season has many expressions and the nearest holiday is only one of them — do not fall back on the most obvious holiday motif every time. ` +
    `Lean on these expressions this time: ${uttryck}.` +
    nyligenRad(opts?.nyligenMotiv, "en")
  );
}

// ── Detektering av säsongsord i fritext (bildredigeringen, BILD-5b) ──────────
// Bestämda former för "vår" (våren/vårens/…) — bart "vår" är oftast possessivt
// ("vår butik") och får inte trigga. "jul" utan i efter — annars träffar juli/Julia.
const SASONGS_MONSTER: { namn: string; re: RegExp }[] = [
  { namn: "jul", re: /\bjul(?!i)/i },
  { namn: "nyår", re: /nyår/i },
  { namn: "trettonhelgen", re: /tretton(dag|helg)/i },
  { namn: "semla/fettisdagen", re: /seml(a|or|e)|fettisdag/i },
  { namn: "påsk", re: /påsk/i },
  { namn: "valborg", re: /valborg/i },
  { namn: "midsommar", re: /midsommar/i },
  { namn: "kräftskiva", re: /kräft(skiv|premiär)/i },
  { namn: "skolstart", re: /skolstart/i },
  { namn: "allhelgona/halloween", re: /allhelgona|alla helgon|halloween/i },
  { namn: "lucia", re: /\blucia\b/i },
  { namn: "vinter", re: /vinter/i },
  { namn: "vår (årstiden)", re: /vår(en|ens|dag|vinter|känsla)/i },
  { namn: "sommar", re: /sommar/i },
  { namn: "höst", re: /höst/i },
  ...MANADER.map((m) => ({ namn: m, re: new RegExp(`\\b${m}\\b`, "i") })),
];

// Vilka säsongs-/tidsord nämner texten? Tom lista = inga (vanlig redigering).
export function hittaSasongsord(text: string): string[] {
  if (!text) return [];
  const traffar: string[] = [];
  for (const { namn, re } of SASONGS_MONSTER) {
    if (re.test(text) && !traffar.includes(namn)) traffar.push(namn);
  }
  return traffar;
}
