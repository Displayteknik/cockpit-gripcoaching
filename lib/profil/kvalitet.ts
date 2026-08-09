// lib/profil/kvalitet.ts — EN källa för "hur komplett är profilen?" (PROFIL-1/F-mätare).
//
// Grundprincip (Håkans beslut 2026-08-01):
//   Ett fält räknas bara om det innehåller något som bara den här klienten kunde ha skrivit.
//
// Bakgrund: den gamla mätaren räknade `trim().length >= tröskel` och ingenting annat.
// 593 tecken tomfraser plus sex uppladdningar gav 100 % och "Klar att producera",
// medan Displaytekniks 9 507 tecken riktiga profil gav 89 %. Mätaren belönade alltså
// ifyllnad och straffade substans (PROFIL-RAPPORT.md 0.2).
//
// Allt här är DETERMINISTISKT — ingen AI, inga nätanrop, ingen DB. Modulen får bara
// rena datastrukturer in och lämnar en rapport ut, så den kan enhetstestas exakt.
//
// Kriterier och vikter (godkända):
//   K1 Berättelser              25   — enda källan sanningskravet accepterar för kundcase
//   K2 Kundens röst             20   — bär klientens ordförråd
//   K3 GÖR INTE                 15   — eget hårt block sist i prompten, väger tyngst där
//   K4 Verifierade siffror      15   — enda vägen till konkretion under sanningskravet
//   K5 Vinnande exempel         10   — starkast röstimitation när det fungerar
//   K6 Egen röst (lager 4)      10   — tonregler + råmaterial + fingerprintkällor
//   K7 Grundfakta                5   — nödvändigt men inte särskiljande
//   Förankring (K6 i rapporten)  grind, ej poäng: kapar nivån och varnar (v1, ingen blockering)
//   Generisk-detektor (K7 i rapporten): diskvalificerar fält, sänker dem inte bara
//   Dubblettkontroll (K8): identiskt råmaterial räknas en gång

// ── Nivåer (uppsättning A — beskriver konsekvensen, inte kunden) ─────────────
export type Niva = 1 | 2 | 3 | 4 | 5;

// FIX-1-REST C2 (språkgenomgång, 9/8): namnen talade fackspråk medan konsekvenstexterna
// bredvid dem var klarspråk. Måttstock: en 55-årig terapeut ska förstå ordet UTAN
// förklaringen. "Belagd" föll direkt — det betyder "styrkt av bevis" för den som redan
// vet, och ingenting för alla andra. "Grund" var tvetydigt: grundsten eller grunt vatten?
// Namnen härleds nu ur konsekvenstexten som redan stod där och var bra.
export const NIVAER: { niva: Niva; namn: string; konsekvens: string }[] = [
  { niva: 1, namn: "Tom", konsekvens: "texterna blir gissningar" },
  { niva: 2, namn: "Skiss", konsekvens: "texterna blir korrekta men utbytbara" },
  { niva: 3, namn: "Som branschen", konsekvens: "texterna låter som branschen, inte som du" },
  { niva: 4, namn: "Egen röst", konsekvens: "texterna går att känna igen" },
  { niva: 5, namn: "Med bevis", konsekvens: "texterna kan använda dina siffror och dina kunders ord" },
];

// ── Indata ───────────────────────────────────────────────────────────────────
export interface KvalitetsIndata {
  /** hm_brand_profile-raden (null = ingen profil alls) */
  profil: Record<string, unknown> | null;
  /** client_assets, status active */
  assets: { asset_type: string; category?: string | null; subcategory?: string | null; body?: string | null }[];
  /** customer_voice, ej arkiverade */
  kundroster: { phrase: string; category?: string | null; context?: string | null }[];
  /** linkedin_posts med source_module='intake' (story-bank) */
  berattelser: { hook?: string | null; idea_seed?: string | null; notes?: string | null }[];
  /** client_voice_profile */
  fingerprint: { signature_phrases?: string[] | null; source_asset_count?: number | null } | null;
  /** clients-raden — bär branschvokabulären för förankringskontrollen */
  klient: { name?: string | null; industry?: string | null } | null;
}

export interface Kriterium {
  key: string;
  label: string;
  vikt: number;
  /** 0–1: hur stor del av minimikravet som är uppfyllt */
  andel: number;
  antal: number;
  krav: number;
  /** Vad användaren ska göra, i imperativ. Tom när kriteriet är uppfyllt. */
  atgard: string;
  /** Kort förklaring av varför kriteriet finns */
  varfor: string;
}

export interface KvalitetsRapport {
  niva: Niva;
  nivaNamn: string;
  nivaKonsekvens: string;
  /** Intern poäng 0–100. Visas ALDRIG bredvid nivån — nivån ersätter procenttalet. */
  poang: number;
  forankringsflagga: boolean;
  forankringsVarning: string | null;
  /** Varför nivån kapades (tungviktarregeln/förankring), om den kapades. */
  takOrsak: string | null;
  kriterier: Kriterium[];
  /** De tre åtgärder som höjer textkvaliteten mest just nu, tyngst först. */
  atgarder: string[];
}

// ── Textprimitiver ───────────────────────────────────────────────────────────

export function meningar(text: string): string[] {
  return String(text || "")
    .split(/(?<=[.!?])\s+|\n+/)
    .map((m) => m.trim())
    .filter((m) => m.length > 1);
}

export function rader(text: string): string[] {
  return String(text || "")
    .split(/\r?\n|(?:^|\s)[·•]\s/)
    .map((r) => r.replace(/^\s*[-–—*•]\s*/, "").trim())
    .filter(Boolean);
}

function normalisera(s: string): string {
  return String(s || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Siffror med enhet — kr, år, %, antal, mått, tid. Distinkta, normaliserade. */
export function siffrorMedEnhet(text: string): string[] {
  const t = String(text || "");
  const träffar =
    t.match(
      /\d[\d\s.,]*\s*(kr|kronor|sek|%|procent|år|st|stycken|mil|km|m2|m²|mm|cm|dm|meter|kg|liter|nits|tum|timmar|tim|minuter|min|dagar|dygn|veckor|månader|gånger|kunder|projekt)\b/gi,
    ) || [];
  // Årtal räknas också som verifierad siffra ("sedan 1998", "2011").
  const årtal = t.match(/\b(19|20)\d{2}\b/g) || [];
  return Array.from(new Set([...träffar, ...årtal].map((s) => s.replace(/\s+/g, " ").trim().toLowerCase())));
}

/** Egennamn = versal mitt i meningen (inte första ordet, inte enbart versaler). */
export function harEgennamn(mening: string): boolean {
  const ord = String(mening || "").trim().split(/\s+/).slice(1);
  return ord.some((o) => /^[A-ZÅÄÖ][a-zåäöéèü]{2,}/.test(o.replace(/[^\p{L}]/gu, "")));
}

export function harTidsuttryck(text: string): boolean {
  return /\b(19|20)\d{2}\b|\b(i|förra|senaste|efter|sedan)\s+(januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december|vintern|våren|sommaren|hösten|veckan|månaden|året)\b|\b\d{1,2}\s+(januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december)\b/i.test(
    String(text || ""),
  );
}

// Plattformens egna floskler (speglar taBortFloskler i lib/content/writing-rules.ts).
// En GÖR INTE-rad som bara upprepar de här tillför ingenting — plattformen tar dem ändå.
export const PLATTFORMSFLOSKLER = [
  "kraftfull",
  "banbrytande",
  "game-changer",
  "game changer",
  "handlar om",
  "nästa nivå",
  "holistisk",
  "skalbar",
];

// ── Generisk-detektorn (rapportens K7) ───────────────────────────────────────
// Ett fält räknas INTE om minst hälften av meningarna är tomfraser. Startlistan är
// hämtad ur skräpsimuleringen i PROFIL-RAPPORT.md 0.2 och är därmed direkt testbar.

function harBelagg(mening: string): boolean {
  return siffrorMedEnhet(mening).length > 0 || harEgennamn(mening) || harTidsuttryck(mening);
}

export function arGeneriskMening(mening: string): boolean {
  const m = String(mening || "").trim();
  if (!m) return true;
  const låg = m.toLowerCase();

  // "Vi är bäst i branschen" — superlativ utan belägg.
  if (/\b(bäst|bästa|störst|största|snabbast|ledande|marknadsledande)\b/.test(låg) && !harBelagg(m)) return true;
  // "bra kvalitet och bra service"
  if (/\bbra\s+(kvalitet|service|priser|pris|bemötande|jobb)\b/.test(låg)) return true;
  // "hög kvalitet" utan mätetal
  if (/\bhög(a|t)?\s+(kvalitet|klass|standard)\b/.test(låg) && !harBelagg(m)) return true;
  // "personlig service", "nöjda kunder", "lång erfarenhet" utan årtal
  if (/\b(personlig service|nöjda kunder|lång erfarenhet|mångårig erfarenhet)\b/.test(låg) && !harBelagg(m)) return true;
  // "Vi bryr oss." som hel mening
  if (/^vi\s+(bryr oss|finns här för dig|lyssnar|bryr oss om dig)\b[.!]?$/.test(låg)) return true;
  // "Vi levererar alltid i tid" — alltid/aldrig som ensamt kvalitetspåstående
  if (/\b(alltid|aldrig)\b/.test(låg) && !harBelagg(m)) return true;
  // Svag hook-öppning (samma mönster som harSvagHook i writing-rules)
  if (/^(många|de flesta|alla|i dagens|i en värld|det är viktigt|numera|nuförtiden|allt fler)\b/.test(låg)) return true;
  // Mening helt utan branschbärande substantiv: inga siffror, inga egennamn och
  // inget långt (sammansatt) ord. Svenska fackord är nästan alltid ≥8 tecken
  // ("trädfällning", "skyltfönster", "däckhotell") — tomfraser är det aldrig.
  const längstaOrd = Math.max(0, ...låg.replace(/[^\p{L}\s]/gu, " ").split(/\s+/).map((o) => o.length));
  if (!harBelagg(m) && längstaOrd < 8) return true;

  return false;
}

/** Fältet räknas inte om ≥ 50 % av meningarna är tomfraser (eller dubbletter). */
export function arGeneriskText(text: string): boolean {
  const ms = meningar(text);
  if (ms.length === 0) return true;
  const sedda = new Set<string>();
  let tomma = 0;
  for (const m of ms) {
    const n = normalisera(m);
    if (sedda.has(n)) {
      tomma++; // dubblett inom samma fält räknas som tomfras
      continue;
    }
    sedda.add(n);
    if (arGeneriskMening(m)) tomma++;
  }
  return tomma / ms.length >= 0.5;
}

// ── Dubblettkontroll på råmaterial (rapportens K8) ───────────────────────────
function tokens(s: string): string[] {
  return normalisera(s).split(" ").filter((w) => w.length > 3);
}

export function jaccard(a: string, b: string): number {
  const wa = new Set(tokens(a));
  const wb = new Set(tokens(b));
  if (wa.size === 0 || wb.size === 0) return 0;
  let inter = 0;
  for (const w of wa) if (wb.has(w)) inter++;
  return inter / (wa.size + wb.size - inter);
}

/** Distinkta poster: ≥ 150 tecken och < 60 % likhet mot varje redan räknad post. */
export function distinktaPoster(texter: (string | null | undefined)[], minTecken = 150): string[] {
  const ut: string[] = [];
  for (const t of texter) {
    const s = String(t || "").trim();
    if (s.length < minTecken) continue;
    if (ut.some((u) => jaccard(u, s) >= 0.6)) continue;
    ut.push(s);
  }
  return ut;
}

// ── Förankring (rapportens K6) ───────────────────────────────────────────────
const STOPPORD = new Set(["och", "eller", "samt", "med", "för", "till", "från", "ab", "hb", "the", "din", "ditt"]);

/**
 * Ankaret: fält som intake/Ikigai-flödet ALDRIG skriver (clients.industry,
 * clients.name, company_name, location, hashtags_base, dos, donts). Just därför är
 * de trovärdiga när man ska avgöra om identitetsfälten fortfarande handlar om rätt
 * företag. Att jämföra mot fält som samma flöde kan ha skrivit vore meningslöst.
 */
export function branschvokabular(indata: KvalitetsIndata): string[] {
  const kallor = [
    indata.klient?.industry,
    indata.klient?.name,
    indata.profil?.company_name,
    indata.profil?.location,
    indata.profil?.hashtags_base,
    indata.profil?.dos,
    indata.profil?.donts,
  ]
    .map((v) => String(v ?? ""))
    .join(" ");
  return Array.from(
    new Set(
      normalisera(kallor)
        .split(" ")
        .filter((o) => o.length >= 4 && !STOPPORD.has(o)),
    ),
  );
}

export function forankring(indata: KvalitetsIndata): { flagga: boolean; varning: string | null } {
  const skal: string[] = [];

  // 1. Handlar identitetsfälten över huvud taget om klientens bransch?
  const vokab = branschvokabular(indata);
  const identitet = normalisera(
    [indata.profil?.usp, indata.profil?.icp_primary, indata.profil?.services, indata.profil?.differentiators].map((v) => String(v ?? "")).join(" "),
  );
  if (vokab.length > 0 && identitet.length > 40) {
    // Prefixmatchning åt BÅDA håll (5 tecken) så "skyltfönster" i GÖR-listan träffar
    // "skyltfönsterskärmar" i USP:en, och tvärtom. Flaggan går bara upp när det inte
    // finns ett enda gemensamt ordstam — då handlar texten sannolikt om annat företag.
    const ankartext = vokab.join(" ");
    const identitetsord = identitet.split(" ").filter((o) => o.length >= 5);
    const träff =
      vokab.some((o) => identitet.includes(o.slice(0, Math.min(o.length, 5)))) ||
      identitetsord.some((o) => ankartext.includes(o.slice(0, 5)));
    if (!träff) {
      skal.push(
        `Profilen nämner inte ett enda ord ur er verksamhet (${vokab.slice(0, 3).join(", ")}) i det som beskriver vilka ni är. Kontrollera att texten handlar om rätt företag.`,
      );
    }
  }

  // 2. Kundröster vars context är en flödesetikett i klamrar, t.ex. "[Vad världen behöver]"
  // — då kommer "kundens ord" från ett wizardsteg, inte från en kund.
  const klamrar = indata.kundroster.filter((r) => /^\s*\[[^\]]+\]\s*$/.test(String(r.context ?? "")));
  if (klamrar.length > 0) {
    skal.push(`${klamrar.length} kundröster kommer från ett wizardsteg (${String(klamrar[0].context).trim()}), inte från en kund.`);
  }

  return { flagga: skal.length > 0, varning: skal.length ? skal.join(" ") : null };
}

// ── Kriterierna ──────────────────────────────────────────────────────────────

/** Fält som faktiskt når prompten (lager 3 efter PROFIL-1/F1). */
const PROMPTFALT = [
  "brand_story",
  "usp",
  "differentiators",
  "tone_rules",
  "icp_primary",
  "icp_secondary",
  "pain_points",
  "customer_quotes",
  "competitors",
  "customer_journey",
  "services",
  "pricing_notes",
  "dos",
  "donts",
];

function berattelser(indata: KvalitetsIndata): number {
  const kandidater: string[] = [];
  for (const s of indata.berattelser) {
    kandidater.push([s.hook, s.idea_seed, s.notes].filter(Boolean).join(" "));
  }
  kandidater.push(String(indata.profil?.brand_story ?? ""));
  kandidater.push(String(indata.profil?.customer_journey ?? ""));
  return kandidater.filter((t) => {
    const s = t.trim();
    if (s.length < 200) return false;
    if (arGeneriskText(s)) return false;
    return siffrorMedEnhet(s).length > 0 || harEgennamn(s) || harTidsuttryck(s);
  }).length;
}

function kundcitat(indata: KvalitetsIndata): { antal: number; kategorier: number } {
  const kategorier = new Set<string>();
  let antal = 0;

  for (const r of indata.kundroster) {
    const fras = String(r.phrase ?? "").trim();
    if (fras.length < 15) continue;
    // Förankringsregeln: en "kundröst" med wizardetikett i context är ingen kundröst.
    if (/^\s*\[[^\]]+\]\s*$/.test(String(r.context ?? ""))) continue;
    antal++;
    kategorier.add(String(r.category || "vocabulary"));
  }

  // customer_quotes räknas bara i citatform: minst 2 citattecken-par ELLER minst
  // 3 rader som var för sig är ≥ 40 tecken.
  const q = String(indata.profil?.customer_quotes ?? "");
  const citatpar = (q.match(/["”»„][^"”«]{10,}["”«]/g) || []).length;
  const langaRader = rader(q).filter((r) => r.length >= 40);
  if (citatpar >= 2) {
    antal += citatpar;
    kategorier.add("customer_quotes");
  } else if (langaRader.length >= 3) {
    antal += langaRader.length;
    kategorier.add("customer_quotes");
  }

  return { antal, kategorier: kategorier.size };
}

function egnaDonts(indata: KvalitetsIndata): { rader: number; specifika: number } {
  const rs = rader(String(indata.profil?.donts ?? "")).filter((r) => r.length >= 15);
  const specifika = rs.filter((r) => {
    const låg = r.toLowerCase();
    return !PLATTFORMSFLOSKLER.some((f) => låg.includes(f));
  });
  return { rader: rs.length, specifika: specifika.length };
}

function verifieradeSiffror(indata: KvalitetsIndata): number {
  const text = PROMPTFALT.map((f) => String(indata.profil?.[f] ?? "")).join("\n");
  return siffrorMedEnhet(text).length;
}

function vinnandeExempel(indata: KvalitetsIndata): number {
  return indata.assets.filter((a) => a.category === "winning_example" && String(a.body ?? "").trim().length >= 200).length;
}

function egenRost(indata: KvalitetsIndata): { andel: number; poster: number; kallor: number; tonOk: boolean } {
  const tone = String(indata.profil?.tone_rules ?? "");
  const tonOk = tone.trim().length >= 30 && !arGeneriskText(tone);
  const poster = distinktaPoster(indata.assets.filter((a) => a.asset_type === "post").map((a) => a.body)).length;
  const kallor = indata.fingerprint?.source_asset_count ?? 0;
  const andel = (tonOk ? 0.34 : 0) + 0.33 * Math.min(1, poster / 5) + 0.33 * Math.min(1, kallor / 5);
  return { andel: Math.min(1, andel), poster, kallor, tonOk };
}

function grundfakta(indata: KvalitetsIndata): { antal: number; saknas: string[] } {
  const p = indata.profil || {};
  const checkar: [string, boolean][] = [
    ["företagsnamn", String(p.company_name ?? "").trim().length > 1],
    ["plats", String(p.location ?? "").trim().length > 1],
    ["tjänster", String(p.services ?? "").trim().length >= 30],
    ["bokningslänk", /^https?:\/\/\S{4,}/i.test(String(p.booking_url ?? "").trim())],
  ];
  return { antal: checkar.filter(([, ok]) => ok).length, saknas: checkar.filter(([, ok]) => !ok).map(([namn]) => namn) };
}

// ── Huvudberäkningen ─────────────────────────────────────────────────────────
export function beraknaKvalitet(indata: KvalitetsIndata): KvalitetsRapport {
  const b = berattelser(indata);
  const k = kundcitat(indata);
  const d = egnaDonts(indata);
  const s = verifieradeSiffror(indata);
  const w = vinnandeExempel(indata);
  const r = egenRost(indata);
  const g = grundfakta(indata);

  const kundandel = Math.min(1, k.antal / 5) * (k.kategorier >= 2 ? 1 : 0.6);
  const dontandel = 0.5 * Math.min(1, d.rader / 5) + 0.5 * Math.min(1, d.specifika / 3);

  const kriterier: Kriterium[] = [
    {
      key: "berattelser",
      label: "Kundberättelser",
      vikt: 25,
      andel: Math.min(1, b / 3),
      antal: b,
      krav: 3,
      atgard: b >= 3 ? "" : `Lägg till ${3 - b} kundberättelse${3 - b === 1 ? "" : "r"} som innehåller en siffra, ett namn eller ett datum`,
      varfor: "Skrivhjälpen får bara berätta kundhistorier som står i profilen. Saknas de blir varje text en allmän observation.",
    },
    {
      key: "kundrost",
      label: "Kundernas egna ord",
      vikt: 20,
      andel: kundandel,
      antal: k.antal,
      krav: 5,
      atgard: k.antal >= 5 && k.kategorier >= 2 ? "" : `Klistra in ${Math.max(1, 5 - k.antal)} riktiga kundcitat, ordagrant som kunden sa det`,
      varfor: "Kundernas exakta ord är det enda som gör ditt ordförråd återanvändbart i texterna.",
    },
    {
      key: "donts",
      label: "Ord du undviker",
      vikt: 15,
      andel: dontandel,
      antal: d.specifika,
      krav: 5,
      atgard:
        d.rader >= 5 && d.specifika >= 3 ? "" : `Skriv ${Math.max(1, 5 - d.rader)} ord och vändningar just du undviker`,
      varfor: "Orden du undviker väger tyngst av allt du skriver här. De styr varje färdig text.",
    },
    {
      key: "siffror",
      label: "Siffror vi får använda",
      vikt: 15,
      andel: Math.min(1, s / 5),
      antal: s,
      krav: 5,
      atgard: s >= 5 ? "" : `Lägg in ${5 - s} siffror med enhet (pris, årtal, antal, mått) i profilen`,
      varfor: "Skrivhjälpen får bara använda tal som står i profilen. Saknas de blir texten svävande.",
    },
    {
      key: "vinnande",
      label: "Texter du är nöjd med",
      vikt: 10,
      andel: Math.min(1, w / 3),
      antal: w,
      krav: 3,
      atgard: w >= 3 ? "" : `Markera ${3 - w} inlägg du är nöjd med, så vet Skrivhjälpen vad du siktar på`,
      varfor: "Ett inlägg du själv är nöjd med är den tydligaste målbilden Skrivhjälpen kan få.",
    },
    {
      key: "egenrost",
      label: "Dina egna texter",
      vikt: 10,
      andel: r.andel,
      antal: r.poster,
      krav: 5,
      atgard:
        r.andel >= 1
          ? ""
          : !r.tonOk
          ? "Skriv tonregler som pekar på konkreta ord och meningar du använder"
          : `Lägg in ${Math.max(1, 5 - r.poster)} egna inlägg i kunskapsbanken`,
      varfor: "Skrivhjälpen härmar bara det den får se. Utan dina egna texter finns inget att härma.",
    },
    {
      key: "grundfakta",
      label: "Kontaktuppgifter och fakta",
      vikt: 5,
      andel: g.antal / 4,
      antal: g.antal,
      krav: 4,
      atgard: g.antal >= 4 ? "" : `Fyll i ${g.saknas.join(", ")}`,
      varfor: "Nödvändigt för att texterna ska kunna peka någonstans, men det särskiljer dig inte.",
    },
  ];

  const poang = Math.round(kriterier.reduce((sum, kr) => sum + kr.vikt * kr.andel, 0));

  // Nivå ur poängen …
  let niva: Niva = poang >= 80 ? 5 : poang >= 60 ? 4 : poang >= 35 ? 3 : poang >= 10 ? 2 : 1;
  let takOrsak: string | null = null;

  // … och sedan TUNGVIKTARREGELN. Alla lättviktsfält ifyllda men noll berättelser
  // ska ALDRIG kunna ge en hög nivå: det var precis så skräpprofilen nådde 100 %.
  if (b === 0 && niva > 3) {
    niva = 3;
    takOrsak = "Profilen saknar berättelser. Utan dem kan texterna inte bli personliga, hur mycket annat som än är ifyllt.";
  }
  if ((b < 3 || k.antal < 5) && niva > 4) {
    niva = 4;
    takOrsak = "Högsta nivån kräver både berättelser och kundernas egna ord.";
  }

  const f = forankring(indata);
  if (f.flagga && niva > 2) {
    niva = 2;
    takOrsak = "Profilen ser inte ut att handla om er verksamhet. Nivån är kapad tills det är kontrollerat.";
  }

  // De tre åtgärder som höjer textkvaliteten mest just nu: störst viktförlust först.
  const atgarder = kriterier
    .filter((kr) => kr.atgard)
    .map((kr) => ({ kr, forlust: kr.vikt * (1 - kr.andel) }))
    .sort((a, b2) => b2.forlust - a.forlust)
    .slice(0, 3)
    .map(({ kr }) => kr.atgard);

  const nivaInfo = NIVAER.find((n) => n.niva === niva)!;

  return {
    niva,
    nivaNamn: nivaInfo.namn,
    nivaKonsekvens: nivaInfo.konsekvens,
    poang,
    forankringsflagga: f.flagga,
    forankringsVarning: f.varning,
    takOrsak,
    kriterier,
    atgarder,
  };
}

/**
 * EN definition av "profilen räcker för att producera". Ersätter de fyra
 * konkurrerande varianterna (/api/profile/quality, /k/page.tsx, onboard-status,
 * KnowledgeBanks minRecommended). Nivå 4 = texterna går att känna igen.
 */
export function racker(rapport: KvalitetsRapport): boolean {
  return rapport.niva >= 4;
}

/** Onboardingens "Brand-profil klar" — samma källa, lägre ribba än racker(). */
export function brandProfilKlar(rapport: KvalitetsRapport): boolean {
  return rapport.niva >= 3 && !rapport.forankringsflagga;
}
