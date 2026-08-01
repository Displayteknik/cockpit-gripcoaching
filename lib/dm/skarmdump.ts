// lib/dm/skarmdump.ts — DM-lead ur en skärmdump (KVALITET-3 punkt 10).
// Ren, testbar modul: inga nätanrop, ingen DB, dagens datum injiceras alltid.
// Ansvar:
//   1. Talarattribution — vem sa vad (placering avgör, aldrig innehållet).
//   2. Fas + utfall ur samtalet (BOKNING/BOKAD osv), inte ur gissningar.
//   3. Relativ tid ("måndag kl 10") → konkret tidpunkt i svensk tid.
//   4. Påminnelse inför mötet + färdig text till "nästa steg".
//   5. Prompten som bildläsningen använder (samma regler, en källa).
//
// Bakgrund: skarptestet tillskrev kontakten det tenanten sa, namnet nådde aldrig
// formuläret och Messenger-kontakter blockerades av kravet på IG-användarnamn.

export type Kanal = "instagram" | "messenger" | "linkedin" | "annat";
export type Talare = "tenant" | "kontakt";
export type Sida = "hoger" | "vanster";

/** DM-pipelinens steg (samma som /dashboard/dm och /k/dm). */
export type Steg = "new" | "acknowledge" | "connect" | "offer" | "won" | "lost";

/** Var i samtalet parterna står. */
export type Fas = "hej" | "dialog" | "erbjudande" | "bokning";

/** Vad fasen landade i. */
export type Utfall = "bokad" | "vantar" | "inget";

/** Hur varmt läget är — bär skillnaden mellan "kontakten föreslog" och "du föreslog". */
export type Varme = "het" | "varm" | "ljummen" | "kall";

export interface Bubbla {
  /** Placering i bilden. Sanningen om vem som skrev. */
  sida: Sida;
  /** Vad bildläsningen trodde. Skrivs över av sidan när sidan är känd. */
  talare?: Talare | null;
  text: string;
}

/** Rå JSON från bildläsningen — allt är osäkert tills det normaliserats. */
export interface RaExtraktion {
  namn?: string | null;
  kanal?: string | null;
  kanal_indikationer?: string | null;
  anvandarnamn?: string | null;
  telefon?: string | null;
  mejl?: string | null;
  bubblor?: Bubbla[] | null;
  motestid_text?: string | null;
  motestid_foreslogs_av?: string | null;
  motestid_bekraftad_av?: string | null;
}

export interface Tolkning {
  namn: string;
  kanal: Kanal;
  anvandarnamn: string;
  telefon: string;
  mejl: string;
  bubblor: Array<Bubbla & { talare: Talare }>;
  /** Vem som föreslog mötestiden — härlett ur placeringen, aldrig ur innehållet. */
  foreslogAv: Talare | null;
  bekraftadAv: Talare | null;
  motestidText: string;
  /** Konkret tidpunkt (ISO) när den relativa tiden gick att räkna om. */
  motestidISO: string | null;
  /** Läsbar svensk tid, t.ex. "måndag 3 augusti kl 10:00". */
  motestidLasbar: string;
  fas: Fas;
  utfall: Utfall;
  steg: Steg;
  varme: Varme;
  /** Påminnelse inför mötet (ISO) — vardagen före, kl 09:00 svensk tid. */
  paminnelseISO: string | null;
  paminnelseLasbar: string;
  /** Färdig text till fältet "nästa steg". */
  nastaSteg: string;
  /** Sammanfattning med rätt talare — ersätter den fria AI-sammanfattningen. */
  sammanfattning: string;
}

// ── Tid i svensk tidszon ──────────────────────────────────────────────────────
// Servern kör UTC. Utan tidszon blir "måndag kl 10" fel tid i kalendern.

const TZ = "Europe/Stockholm";
const VECKODAGAR = ["söndag", "måndag", "tisdag", "onsdag", "torsdag", "fredag", "lördag"];
const MANADER = [
  "januari", "februari", "mars", "april", "maj", "juni",
  "juli", "augusti", "september", "oktober", "november", "december",
];

/** Svensk tidszons offset (minuter) för ett givet ögonblick — tål sommartid. */
function offsetMinuter(d: Date): number {
  const utc = new Date(d.toLocaleString("en-US", { timeZone: "UTC" }));
  const lokal = new Date(d.toLocaleString("en-US", { timeZone: TZ }));
  return Math.round((lokal.getTime() - utc.getTime()) / 60000);
}

/** Kalenderdatum + klockslag i svensk tid → exakt ögonblick. */
export function franVaggklocka(ar: number, manad0: number, dag: number, timme: number, minut: number): Date {
  const vagg = Date.UTC(ar, manad0, dag, timme, minut);
  let ut = new Date(vagg);
  for (let i = 0; i < 2; i++) ut = new Date(vagg - offsetMinuter(ut) * 60000);
  return ut;
}

/** Datumdelarna i svensk tid för ett ögonblick. */
export function vaggklocka(d: Date): { ar: number; manad0: number; dag: number; timme: number; minut: number; veckodag: number } {
  const delar = new Intl.DateTimeFormat("sv-SE", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false,
  }).formatToParts(d);
  const hamta = (t: string) => delar.find((p) => p.type === t)?.value || "";
  const kort = hamta("weekday").toLowerCase().replace(/\.$/, "");
  const veckodag = ["sön", "mån", "tis", "ons", "tors", "fre", "lör"].findIndex((v) => kort.startsWith(v.slice(0, 3)));
  return {
    ar: Number(hamta("year")),
    manad0: Number(hamta("month")) - 1,
    dag: Number(hamta("day")),
    timme: Number(hamta("hour")) % 24,
    minut: Number(hamta("minute")),
    veckodag: veckodag < 0 ? new Date(d).getUTCDay() : veckodag,
  };
}

/** "måndag 3 augusti kl 10:00" — samma formulering överallt. */
export function lasbarTid(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const v = vaggklocka(d);
  const kl = `${String(v.timme).padStart(2, "0")}:${String(v.minut).padStart(2, "0")}`;
  return `${VECKODAGAR[v.veckodag]} ${v.dag} ${MANADER[v.manad0]} kl ${kl}`;
}

/** "fredag 31 juli" — datum utan klockslag. */
export function lasbarDag(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const v = vaggklocka(d);
  return `${VECKODAGAR[v.veckodag]} ${v.dag} ${MANADER[v.manad0]}`;
}

// ── Relativ tid → konkret datum ───────────────────────────────────────────────

const VECKODAG_MONSTER: Array<{ test: RegExp; dag: number }> = [
  { test: /\bsön(dag)?\b/i, dag: 0 },
  { test: /\bmån(dag)?\b/i, dag: 1 },
  { test: /\btis(dag)?\b/i, dag: 2 },
  { test: /\bons(dag)?\b/i, dag: 3 },
  { test: /\btors(dag)?\b/i, dag: 4 },
  { test: /\bfre(dag)?\b/i, dag: 5 },
  { test: /\blör(dag)?\b/i, dag: 6 },
];

/** Plockar klockslag ur "kl 10", "10.30", "kl. 09:15", "klockan 14". Default 09:00. */
function klockslag(text: string): { timme: number; minut: number; fanns: boolean } {
  const m = text.match(/\b(?:kl\.?|klockan)?\s*([01]?\d|2[0-3])[.:]([0-5]\d)\b/i) ||
    text.match(/\b(?:kl\.?|klockan)\s*([01]?\d|2[0-3])\b/i);
  if (!m) return { timme: 9, minut: 0, fanns: false };
  return { timme: Number(m[1]), minut: m[2] ? Number(m[2]) : 0, fanns: true };
}

/**
 * "måndag kl 10" → konkret tidpunkt. `nu` injiceras så tester aldrig blir tidsberoende.
 * Stödjer veckodag, idag/imorgon/i övermorgon och "3 augusti". Returnerar null när
 * texten inte räcker för ett datum — vi gissar hellre inte än sätter fel tid.
 */
export function raknaUtTidpunkt(text: string, nu: Date): string | null {
  const t = (text || "").trim();
  if (!t) return null;
  const nuV = vaggklocka(nu);
  const { timme, minut, fanns } = klockslag(t);

  // Explicit datum: "3 augusti" / "3 aug".
  const md = t.match(new RegExp(`\\b(\\d{1,2})\\s*(${MANADER.map((m) => m.slice(0, 3)).join("|")})[a-zåäö]*\\b`, "i"));
  if (md) {
    const dag = Number(md[1]);
    const manad0 = MANADER.findIndex((m) => m.startsWith(md[2].toLowerCase()));
    if (manad0 >= 0 && dag >= 1 && dag <= 31) {
      let ar = nuV.ar;
      const kandidat = franVaggklocka(ar, manad0, dag, timme, minut);
      if (kandidat.getTime() < nu.getTime()) ar += 1; // datumet har passerat → nästa år
      return franVaggklocka(ar, manad0, dag, timme, minut).toISOString();
    }
  }

  if (/\bi\s*övermorgon\b/i.test(t)) return skjutDagar(nu, 2, timme, minut);
  if (/\bimorgon|i\s+morgon\b/i.test(t)) return skjutDagar(nu, 1, timme, minut);
  if (/\bidag|i\s+dag\b/i.test(t)) return skjutDagar(nu, 0, timme, minut);

  for (const { test, dag } of VECKODAG_MONSTER) {
    if (!test.test(t)) continue;
    let steg = (dag - nuV.veckodag + 7) % 7;
    if (steg === 0) {
      // Samma veckodag: idag om tiden inte passerat, annars nästa vecka.
      const idag = franVaggklocka(nuV.ar, nuV.manad0, nuV.dag, timme, minut);
      if (idag.getTime() > nu.getTime()) return idag.toISOString();
      steg = 7;
    }
    // "nästa måndag" när det redan är samma vecka → en vecka till.
    if (/\bnästa\b/i.test(t) && steg < 7) steg += 7;
    return skjutDagar(nu, steg, timme, minut);
  }

  // Bara ett klockslag utan dag ger ingen konkret tidpunkt — vi gissar inte vilken dag.
  void fanns;
  return null;
}

function skjutDagar(nu: Date, dagar: number, timme: number, minut: number): string {
  const v = vaggklocka(nu);
  return franVaggklocka(v.ar, v.manad0, v.dag + dagar, timme, minut).toISOString();
}

/** Påminnelsen läggs i slutet av arbetsdagen före mötet. */
export const PAMINNELSE_TIMME = 16;

/**
 * Påminnelse inför mötet: sista vardagen före mötet kl 16:00 svensk tid. Landar
 * dagen före på en helg backar vi till fredagen — ett måndagsmöte påminns alltså
 * på fredagen. Har tidpunkten redan passerat är påminnelsen akut: den sätts till nu.
 */
export function paminnelseFor(motesISO: string | null, nu: Date): string | null {
  if (!motesISO) return null;
  const mote = new Date(motesISO);
  if (Number.isNaN(mote.getTime())) return null;
  const v = vaggklocka(mote);
  const slot = (dagarBak: number) => franVaggklocka(v.ar, v.manad0, v.dag - dagarBak, PAMINNELSE_TIMME, 0);

  // 1) Sista vardagen före mötet.
  for (let dagarBak = 1; dagarBak <= 7; dagarBak++) {
    const kandidat = slot(dagarBak);
    const kv = vaggklocka(kandidat);
    if (kv.veckodag === 0 || kv.veckodag === 6) continue; // helg → backa
    if (kandidat.getTime() >= nu.getTime()) return kandidat.toISOString();
    break; // vardagen har passerat → fall vidare
  }
  // 2) Har den passerat: dagen före mötet, även om det är helg — bättre en påminnelse
  //    kvällen innan än ingen alls.
  const dagenInnan = slot(1);
  if (dagenInnan.getTime() >= nu.getTime()) return dagenInnan.toISOString();
  // 3) Mötet är nära inpå: påminnelsen är akut.
  return nu.toISOString();
}

// ── Talarattribution ──────────────────────────────────────────────────────────

/**
 * FIX 1: placeringen avgör. Högerställda/färgade bubblor är tenanten (den som tog
 * skärmdumpen), vänsterställda är kontakten. Gäller Messenger, Instagram DM och
 * LinkedIn lika. Bildläsningens egen gissning skrivs över när sidan är känd.
 */
export function talareForSida(sida: Sida): Talare {
  return sida === "hoger" ? "tenant" : "kontakt";
}

export function normaliseraBubblor(bubblor: Bubbla[] | null | undefined): Array<Bubbla & { talare: Talare }> {
  return (bubblor || [])
    .filter((b) => b && typeof b.text === "string")
    .map((b) => {
      const sida: Sida = b.sida === "hoger" || b.sida === "vanster" ? b.sida : "vanster";
      return { sida, text: b.text.trim(), talare: talareForSida(sida) };
    })
    .filter((b) => b.text.length > 0);
}

const BEKRAFTELSE = /\b(toppen|perfekt|passar|funkar|låter bra|later bra|ja tack|absolut|kör|kor på|okej|ok|det blir bra|ses då|ses da|bokat|deal)\b/i;
const FRAGA_OM_TID = /\?/;
const ERBJUDANDE = /\b(pris|priset|kostar|offert|erbjudande|paket|kampanj|rabatt|kr\b|:-)/i;

/** Bubblan där mötestiden föreslås — matchas mot den avlästa tidstexten först. */
function hittaForslag(bubblor: Array<Bubbla & { talare: Talare }>, motestidText: string): number {
  const nyckel = motestidText.toLowerCase().replace(/[^a-zåäö0-9 :.]/g, " ").trim();
  if (nyckel) {
    const bitar = nyckel.split(/\s+/).filter((o) => o.length > 1);
    let bast = -1;
    let bastPoang = 0;
    bubblor.forEach((b, i) => {
      const txt = b.text.toLowerCase();
      const poang = bitar.filter((o) => txt.includes(o)).length;
      if (poang > bastPoang) { bastPoang = poang; bast = i; }
    });
    if (bast >= 0 && bastPoang >= Math.max(1, Math.ceil(bitar.length / 2))) return bast;
  }
  // Fallback: sista bubblan som både nämner en veckodag/tid och ställer en fråga.
  for (let i = bubblor.length - 1; i >= 0; i--) {
    const txt = bubblor[i].text;
    if (VECKODAG_MONSTER.some((v) => v.test.test(txt)) && FRAGA_OM_TID.test(txt)) return i;
  }
  return -1;
}

/** Första bekräftelsen EFTER förslaget, från motparten. */
function hittaBekraftelse(bubblor: Array<Bubbla & { talare: Talare }>, forslagIdx: number): Talare | null {
  if (forslagIdx < 0) return null;
  const forslagare = bubblor[forslagIdx].talare;
  for (let i = forslagIdx + 1; i < bubblor.length; i++) {
    const b = bubblor[i];
    if (b.talare === forslagare) continue;
    if (BEKRAFTELSE.test(b.text)) return b.talare;
  }
  return null;
}

// ── Fas, steg och värme ───────────────────────────────────────────────────────

export function harledFas(input: {
  bubblor: Array<Bubbla & { talare: Talare }>;
  motestidText: string;
  foreslogAv: Talare | null;
  bekraftadAv: Talare | null;
}): { fas: Fas; utfall: Utfall; steg: Steg; varme: Varme } {
  const { bubblor, motestidText, foreslogAv, bekraftadAv } = input;
  const harTid = !!motestidText.trim();

  if (harTid && bekraftadAv && foreslogAv && bekraftadAv !== foreslogAv) {
    // Kontakten föreslog och du sa ja = varmaste läget: initiativet kom utifrån.
    const varme: Varme = foreslogAv === "kontakt" ? "het" : "varm";
    return { fas: "bokning", utfall: "bokad", steg: "won", varme };
  }
  if (harTid) {
    return { fas: "bokning", utfall: "vantar", steg: "offer", varme: foreslogAv === "kontakt" ? "varm" : "ljummen" };
  }
  if (bubblor.some((b) => ERBJUDANDE.test(b.text))) {
    return { fas: "erbjudande", utfall: "vantar", steg: "offer", varme: "ljummen" };
  }
  const franKontakt = bubblor.filter((b) => b.talare === "kontakt").length;
  const franTenant = bubblor.filter((b) => b.talare === "tenant").length;
  if (franKontakt > 0 && franTenant > 0 && bubblor.length >= 3) {
    return { fas: "dialog", utfall: "inget", steg: "connect", varme: "ljummen" };
  }
  if (franTenant > 0) return { fas: "hej", utfall: "inget", steg: "acknowledge", varme: "kall" };
  return { fas: "hej", utfall: "inget", steg: "new", varme: "kall" };
}

// ── Kanal ─────────────────────────────────────────────────────────────────────

export const KANALER: Array<{ id: Kanal; label: string; harHandle: boolean }> = [
  { id: "instagram", label: "Instagram", harHandle: true },
  { id: "messenger", label: "Messenger (Facebook)", harHandle: false },
  { id: "linkedin", label: "LinkedIn", harHandle: false },
  { id: "annat", label: "Annat", harHandle: false },
];

export function normaliseraKanal(v: string | null | undefined): Kanal {
  const s = (v || "").toLowerCase().trim();
  if (/insta|^ig$/.test(s)) return "instagram";
  if (/messenger|facebook|^fb$/.test(s)) return "messenger";
  if (/linkedin|^li$/.test(s)) return "linkedin";
  return "annat";
}

/** Etikett till UI:t. Saknas kanalen men ett IG-handle finns → Instagram. */
export function kanalEtikett(kanal: string | null | undefined, anvandarnamn: string | null | undefined): string {
  const k = kanal ? normaliseraKanal(kanal) : anvandarnamn ? "instagram" : "annat";
  return KANALER.find((x) => x.id === k)?.label || "Annat";
}

// ── Sammanfattning + nästa steg ───────────────────────────────────────────────

function citat(text: string): string {
  const rent = text.replace(/\s+/g, " ").trim();
  return rent.length > 120 ? `${rent.slice(0, 117)}…` : rent;
}

/**
 * Sammanfattning med rätt talare. Byggs ur bubblorna, inte ur en fri AI-text —
 * det var den fria texten som kastade om vem som föreslog mötet.
 */
export function formuleraSammanfattning(t: Omit<Tolkning, "sammanfattning" | "nastaSteg">): string {
  const namn = t.namn || "Kontakten";
  const rader: string[] = [];
  rader.push(`${namn} · ${kanalEtikett(t.kanal, t.anvandarnamn)}`);

  if (t.motestidText) {
    const vem = t.foreslogAv === "kontakt" ? namn : t.foreslogAv === "tenant" ? "Du" : null;
    const tid = t.motestidLasbar || t.motestidText;
    if (vem) rader.push(`${vem} föreslog ${t.motestidText}.`);
    if (t.bekraftadAv) {
      const bekraftare = t.bekraftadAv === "kontakt" ? namn : "Du";
      const bubbla = [...t.bubblor].reverse().find((b) => b.talare === t.bekraftadAv && BEKRAFTELSE.test(b.text));
      rader.push(`${bekraftare} bekräftade${bubbla ? `: ”${citat(bubbla.text)}”` : ""}.`);
      rader.push(`Mötet är bokat ${tid}.`);
    } else {
      rader.push(`Ingen bekräftelse än på ${tid}.`);
    }
  } else {
    const sista = t.bubblor[t.bubblor.length - 1];
    if (sista) {
      const vem = sista.talare === "kontakt" ? namn : "Du";
      rader.push(`Senast i tråden: ${vem} skrev ”${citat(sista.text)}”.`);
    }
  }
  return rader.join(" ");
}

export function formuleraNastaSteg(t: Omit<Tolkning, "sammanfattning" | "nastaSteg">): string {
  const namn = t.namn || "kontakten";
  if (t.utfall === "bokad") {
    const tid = t.motestidLasbar || t.motestidText;
    return `Förbered mötet med ${namn}${tid ? ` – ${tid}` : ""}.`;
  }
  if (t.fas === "bokning") return `Följ upp tiden du föreslog till ${namn}.`;
  if (t.fas === "erbjudande") return `Följ upp erbjudandet till ${namn}.`;
  if (t.fas === "dialog") return `Fortsätt dialogen med ${namn} och föreslå en tid.`;
  return `Svara ${namn} och starta samtalet.`;
}

// ── Hela tolkningen ───────────────────────────────────────────────────────────

/** Rå bildläsning → färdig, korrekt attribuerad tolkning. `nu` injiceras för tester. */
export function tolka(ra: RaExtraktion, nu: Date): Tolkning {
  const bubblor = normaliseraBubblor(ra.bubblor);
  const motestidText = (ra.motestid_text || "").trim();
  const forslagIdx = motestidText ? hittaForslag(bubblor, motestidText) : -1;
  // Placeringen vinner alltid över bildläsningens egen gissning om talaren.
  const foreslogAv: Talare | null = forslagIdx >= 0 ? bubblor[forslagIdx].talare : null;
  const bekraftadAv = hittaBekraftelse(bubblor, forslagIdx);

  const motestidISO = motestidText ? raknaUtTidpunkt(motestidText, nu) : null;
  const { fas, utfall, steg, varme } = harledFas({ bubblor, motestidText, foreslogAv, bekraftadAv });
  const paminnelseISO = utfall === "bokad" ? paminnelseFor(motestidISO, nu) : null;

  const bas: Omit<Tolkning, "sammanfattning" | "nastaSteg"> = {
    namn: (ra.namn || "").trim(),
    kanal: normaliseraKanal(ra.kanal),
    anvandarnamn: (ra.anvandarnamn || "").replace(/^@/, "").trim(),
    telefon: (ra.telefon || "").trim(),
    mejl: (ra.mejl || "").trim(),
    bubblor,
    foreslogAv,
    bekraftadAv,
    motestidText,
    motestidISO,
    motestidLasbar: lasbarTid(motestidISO),
    fas,
    utfall,
    steg,
    varme,
    paminnelseISO,
    paminnelseLasbar: lasbarDag(paminnelseISO),
  };
  return { ...bas, sammanfattning: formuleraSammanfattning(bas), nastaSteg: formuleraNastaSteg(bas) };
}

// ── Prompten till bildläsningen ───────────────────────────────────────────────

/**
 * En källa för reglerna. Talarattributionen står först eftersom det var den som
 * fallerade skarpt: sammanfattningen tillskrev kontakten det tenanten hade sagt.
 */
export function skarmdumpPrompt(idagISO: string): string {
  return `Dagens datum: ${idagISO}

Detta är en skärmdump av en chatt: Messenger, Instagram DM eller LinkedIn.

VEM SKREV VAD — viktigast av allt:
- Bubblor till HÖGER, med färgad bakgrund (blå, lila, grön), är skrivna av kontoägaren, alltså den som tog skärmdumpen. Kalla den "tenant".
- Bubblor till VÄNSTER, oftast grå eller vita och ofta med den andra personens profilbild bredvid, är skrivna av den andra personen. Kalla den "kontakt".
- Avgör ALLTID utifrån placeringen, aldrig utifrån vad texten säger. Ett meddelande kan låta som kunden och ändå vara skrivet av kontoägaren.
- Samma regel gäller i Messenger, Instagram DM och LinkedIn.

KANAL — gissa utifrån gränssnittet:
- Messenger: inmatningsfältet har "Aa", GIF- och klistermärkesknappar, bubblorna är blå eller lila.
- Instagram DM: fältet säger "Meddelande…", kamera- och hjärtikon, ofta ett @-användarnamn högst upp.
- LinkedIn: "Skriv ett meddelande", blå/vit yta, ofta titel och företag under namnet.
- Går det inte att avgöra: "annat".

NAMN: kontaktens namn står oftast i sidhuvudet, ovanför konversationen. Ta det ordagrant.

Returnera ENBART ett rått JSON-objekt, utan markdown:
{
  "namn": "kontaktens namn ur sidhuvudet, annars ''",
  "kanal": "instagram" | "messenger" | "linkedin" | "annat",
  "kanal_indikationer": "vad i gränssnittet som avslöjade kanalen",
  "anvandarnamn": "@-handle om ett syns, annars ''",
  "telefon": "",
  "mejl": "",
  "bubblor": [
    { "sida": "hoger" | "vanster", "talare": "tenant" | "kontakt", "text": "meddelandet ordagrant" }
  ],
  "motestid_text": "tiden EXAKT som den står i chatten, t.ex. 'måndag kl 10'. Räkna inte om till datum.",
  "motestid_foreslogs_av": "tenant" | "kontakt" | "",
  "motestid_bekraftad_av": "tenant" | "kontakt" | ""
}

Regler:
- Ta med bubblorna i den ordning de står, uppifrån och ned. Delvis skymda bubblor tas med om texten går att läsa.
- Hittar du inget fält: tom sträng. Hitta aldrig på namn, tider eller kontaktuppgifter.
- Svara på svenska.`;
}
