// LIKVID-1 — kassaflödesprognos och pipelinesummor för Founder HQ.
//
// Allt här är RENA funktioner utan databas, utan nätverk och utan `new Date()` som
// hämtar dagens datum. Dagens datum skickas alltid in. Skälet: prognoser som läser
// klockan går inte att testa, och ett test som beter sig olika på tisdag och söndag
// bevisar ingenting.
//
// ⚠ Vunnet härleds ALDRIG ur GHL:s status-fält (alla DT-affärer svarar "open" även när
// de står i vinststeget). Den här modulen tar emot `harledd_status`, som redan är
// härledd ur STEGET i lib/hq/pipeline.ts.
//
// Ingen automatisk moms- eller skatteberäkning. Sådant läggs in som poster av ägaren.
// En schablon som är fel är sämre än en rad som saknas och syns att den saknas.

export type Bolag = "grip" | "dt";
export type Trafikljus = "gron" | "gul" | "rod" | "okand";

/** En affär med sin betalstatus. Beloppen i kronor, datumen som ÅÅÅÅ-MM-DD. */
export interface AffarFinans {
  id: string;
  varde: number;
  fakturerat: number;
  betalt: number;
  forvantat_betaldatum: string | null;
  forfallodatum: string | null;
  harledd_status: "open" | "won" | "lost";
  /** 0 till 100. Används bara för affärer i spel. Vinststeget räknas alltid som 100. */
  sannolikhet: number;
}

export interface CashPost {
  id: string;
  titel: string;
  /** Positivt = pengar in, negativt = pengar ut. */
  belopp: number;
  datum: string;
}

export interface PrognosIn {
  bolag: Bolag;
  /** Dagens datum i svensk tid, ÅÅÅÅ-MM-DD. Injiceras alltid. */
  idag: string;
  /** Senaste inlagda banksaldot. null = inget saldo inlagt, då går prognosen inte att göra. */
  startSaldo: number | null;
  saldoDatum: string | null;
  affarer: AffarFinans[];
  /** Summa aktiva intäktsrader per månad för bolaget. */
  mrrPerManad: number;
  /** Fasta kostnader per månad, omräknade till kronor. */
  fastaSek: number;
  poster: CashPost[];
  buffertmal: number;
  gulGransVeckor: number;
  antalVeckor?: number;
}

export interface PrognosRad {
  titel: string;
  belopp: number;
}

export interface PrognosVecka {
  index: number;
  start: string;
  slut: string;
  veckonummer: number;
  ingaende: number;
  in: number;
  ut: number;
  utgaende: number;
  rader: PrognosRad[];
}

export interface Prognos {
  bolag: Bolag;
  saknarSaldo: boolean;
  startSaldo: number;
  saldoDatum: string | null;
  veckor: PrognosVecka[];
  lagsta: { belopp: number; veckonummer: number; start: string };
  /** Första veckan som bryter mot buffertmålet eller mot noll. null = ingen brytning. */
  brytVecka: { veckonummer: number; start: string; belopp: number } | null;
  trafikljus: Trafikljus;
  klartext: string;
  /** Affärer utan förväntat betaldatum. Räknas ALDRIG in i prognosen. */
  ejDaterade: { summa: number; antal: number };
  /** Buffertbrott som ligger senare än larmgränsen. Visas som notering, inte som gult. */
  senareVarning: { veckonummer: number; start: string; belopp: number } | null;
  buffertmal: number;
  gulGransVeckor: number;
}

const DAG_MS = 86400000;
const tillMs = (dag: string): number => Date.parse(`${dag}T12:00:00Z`);
const tillDag = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/** Måndagen i den vecka datumet ligger i. Svenska veckor börjar på måndag. */
export function mandagen(dag: string): string {
  const veckodag = new Date(tillMs(dag)).getUTCDay(); // 0 = söndag
  const steg = veckodag === 0 ? 6 : veckodag - 1;
  return tillDag(tillMs(dag) - steg * DAG_MS);
}

/** ISO-veckonummer, alltså det veckonummer som står i en svensk kalender. */
export function isoVecka(dag: string): number {
  const torsdag = tillMs(mandagen(dag)) + 3 * DAG_MS;
  const ar = new Date(torsdag).getUTCFullYear();
  const arsstart = tillMs(`${ar}-01-01`);
  return Math.floor((torsdag - arsstart) / DAG_MS / 7) + 1;
}

/**
 * Standardsannolikhet för ett steg, uträknad ur stegets plats i pipelinen.
 * Formeln är (plats + 1) delat med (antal steg i spel + 1), avrundat till hela procent.
 * Sju steg i spel ger alltså 13, 25, 38, 50, 63, 75 och 88 procent.
 *
 * Den här stegen är en UTGÅNGSPUNKT, inte ett facit. Ägaren sätter sina egna siffror i
 * vyn, och då används de i stället. Poängen är att aldrig väga med en siffra som ingen
 * har tagit ställning till utan att det syns var den kom ifrån.
 */
export function standardSannolikhet(plats: number, antalStegISpel: number): number {
  if (antalStegISpel <= 0) return 50;
  return Math.round((100 * (plats + 1)) / (antalStegISpel + 1));
}

export interface PipelineSummor {
  iSpelOfakturerat: number;
  antalISpel: number;
  fakturreratObetalt: number;
  antalFakturerade: number;
  aldstaForfallodatum: string | null;
  antalForfallna: number;
  betalt: number;
}

/**
 * De tre summorna som ersätter den gamla klumpsumman.
 *
 * 1. I spel, ofakturerat: bara affärer i spel, beloppet minus det som redan fakturerats,
 *    viktat med stegets sannolikhet. En delbetald affär ska inte ligga kvar med hela
 *    sitt belopp i "i spel", det var hela felet med den gamla siffran.
 * 2. Fakturerat, obetalt: fakturerat minus betalt för ALLA affärer, oviktat. En skickad
 *    faktura är inte en sannolikhet, den är en fordran.
 * 3. Betalt: allt som är markerat som betalt.
 */
export function pipelineSummor(affarer: AffarFinans[], idag: string): PipelineSummor {
  let iSpelOfakturerat = 0;
  let antalISpel = 0;
  let fakturreratObetalt = 0;
  let antalFakturerade = 0;
  let betalt = 0;
  let aldstaForfallodatum: string | null = null;
  let antalForfallna = 0;

  for (const a of affarer) {
    betalt += a.betalt;

    if (a.harledd_status === "open") {
      const ofakturerat = Math.max(0, a.varde - a.fakturerat);
      if (ofakturerat > 0) {
        iSpelOfakturerat += ofakturerat * vikt(a);
        antalISpel += 1;
      }
    }

    const obetalt = Math.max(0, a.fakturerat - a.betalt);
    if (obetalt > 0) {
      fakturreratObetalt += obetalt;
      antalFakturerade += 1;
      if (a.forfallodatum) {
        if (!aldstaForfallodatum || a.forfallodatum < aldstaForfallodatum) aldstaForfallodatum = a.forfallodatum;
        if (a.forfallodatum < idag) antalForfallna += 1;
      }
    }
  }

  return {
    iSpelOfakturerat,
    antalISpel,
    fakturreratObetalt,
    antalFakturerade,
    aldstaForfallodatum,
    antalForfallna,
    betalt,
  };
}

/** Vikten en affär räknas med. Vinststeget är 100 procent, i spel styrs av stegets siffra. */
function vikt(a: AffarFinans): number {
  if (a.harledd_status === "won") return 1;
  if (a.harledd_status === "lost") return 0;
  return Math.min(1, Math.max(0, a.sannolikhet / 100));
}

const BOLAGSNAMN: Record<Bolag, string> = { grip: "GripCoaching", dt: "Displayteknik" };

/**
 * Tolv veckor framåt, vecka för vecka. Prognosen börjar i måndagen på den vecka som
 * innehåller `idag` och utgår från senaste inlagda banksaldot.
 *
 * Regeln för vad som hamnar var: ett datum som ligger före fönstret räknas ändå med i
 * första veckan om det ligger EFTER banksaldots datum. Pengarna rörde sig efter att
 * saldot lästes av, alltså syns de inte i saldot och måste med. Ligger datumet före
 * saldodatumet är beloppet redan inräknat i saldot och räknas inte en gång till.
 */
export function byggPrognos(inn: PrognosIn): Prognos {
  const antalVeckor = inn.antalVeckor ?? 12;
  const forsta = mandagen(inn.idag);

  const veckor: PrognosVecka[] = [];
  for (let i = 0; i < antalVeckor; i++) {
    const start = tillDag(tillMs(forsta) + i * 7 * DAG_MS);
    veckor.push({
      index: i,
      start,
      slut: tillDag(tillMs(start) + 6 * DAG_MS),
      veckonummer: isoVecka(start),
      ingaende: 0,
      in: 0,
      ut: 0,
      utgaende: 0,
      rader: [],
    });
  }
  const sista = veckor[veckor.length - 1].slut;

  const veckaFor = (dag: string): number | null => {
    if (dag > sista) return null;
    if (dag < forsta) return inn.saldoDatum && dag > inn.saldoDatum ? 0 : null;
    return Math.floor((tillMs(mandagen(dag)) - tillMs(forsta)) / (7 * DAG_MS));
  };

  const in_ = (i: number, titel: string, belopp: number) => {
    if (belopp <= 0) return;
    veckor[i].in += belopp;
    veckor[i].rader.push({ titel, belopp });
  };
  const ut_ = (i: number, titel: string, belopp: number) => {
    if (belopp <= 0) return;
    veckor[i].ut += belopp;
    veckor[i].rader.push({ titel, belopp: -belopp });
  };

  // ── In: kundinbetalningar ────────────────────────────────────────────────
  // Förlorade affärer betalar ingenting och räknas inte alls. Vinststeget räknas
  // fullt ut, affärer i spel viktas med stegets sannolikhet.
  let ejDateradeSumma = 0;
  let ejDateradeAntal = 0;
  for (const a of inn.affarer) {
    if (a.harledd_status === "lost") continue;
    const kvar = Math.max(0, a.varde - a.betalt);
    if (kvar <= 0) continue;
    if (!a.forvantat_betaldatum) {
      ejDateradeSumma += kvar;
      ejDateradeAntal += 1;
      continue;
    }
    const v = veckaFor(a.forvantat_betaldatum);
    if (v === null) continue;
    in_(v, "Kundinbetalning", kvar * vikt(a));
  }

  // ── Månadsposter: intäktsrader in, fasta kostnader ut ────────────────────
  // Båda läggs på månadens första vecka. Ligger den första i en månad före fönstret
  // räknas den bara med om saldot är äldre än så, annars är den redan betald.
  const manader = new Set<string>();
  for (const v of veckor) {
    manader.add(v.start.slice(0, 7));
    manader.add(v.slut.slice(0, 7));
  }
  for (const m of [...manader].sort()) {
    const v = veckaFor(`${m}-01`);
    if (v === null) continue;
    in_(v, "Månadsintäkt", inn.mrrPerManad);
    ut_(v, "Fasta kostnader", inn.fastaSek);
  }

  // ── Egna poster: leverantörsbetalningar, moms, skatt, lån och annat ──────
  for (const p of inn.poster) {
    const v = veckaFor(p.datum);
    if (v === null) continue;
    if (p.belopp >= 0) in_(v, p.titel, p.belopp);
    else ut_(v, p.titel, -p.belopp);
  }

  // ── Saldot rullar ───────────────────────────────────────────────────────
  const startSaldo = inn.startSaldo ?? 0;
  let saldo = startSaldo;
  for (const v of veckor) {
    v.ingaende = saldo;
    v.utgaende = saldo + v.in - v.ut;
    saldo = v.utgaende;
  }

  const lagstaVecka = veckor.reduce((min, v) => (v.utgaende < min.utgaende ? v : min), veckor[0]);
  const lagsta = { belopp: lagstaVecka.utgaende, veckonummer: lagstaVecka.veckonummer, start: lagstaVecka.start };

  const saknarSaldo = inn.startSaldo === null;

  const underNoll = veckor.find((v) => v.utgaende < 0) || null;
  const larmfonster = veckor.slice(0, Math.max(1, inn.gulGransVeckor));
  const underBuffertTidigt = larmfonster.find((v) => v.utgaende < inn.buffertmal) || null;
  const senare = veckor.slice(Math.max(1, inn.gulGransVeckor)).find((v) => v.utgaende < inn.buffertmal) || null;

  let trafikljus: Trafikljus = "gron";
  let brytVecka: Prognos["brytVecka"] = null;
  if (saknarSaldo) {
    trafikljus = "okand";
  } else if (underNoll) {
    trafikljus = "rod";
    brytVecka = { veckonummer: underNoll.veckonummer, start: underNoll.start, belopp: underNoll.utgaende };
  } else if (underBuffertTidigt) {
    trafikljus = "gul";
    brytVecka = {
      veckonummer: underBuffertTidigt.veckonummer,
      start: underBuffertTidigt.start,
      belopp: underBuffertTidigt.utgaende,
    };
  }

  const namn = BOLAGSNAMN[inn.bolag];
  const kr = (n: number) => `${Math.round(n).toLocaleString("sv-SE")} kr`;
  let klartext: string;
  if (saknarSaldo) {
    klartext = `Likviditet ${namn}: inget banksaldo inlagt, prognosen går inte att räkna.`;
  } else if (trafikljus === "rod" && brytVecka) {
    klartext = `Likviditet ${namn}: rött läge vecka ${brytVecka.veckonummer}, lägsta ${kr(lagsta.belopp)}`;
  } else if (trafikljus === "gul" && brytVecka) {
    klartext = `Likviditet ${namn}: gult läge vecka ${brytVecka.veckonummer}, lägsta ${kr(lagsta.belopp)}`;
  } else {
    klartext = `Likviditet ${namn}: grönt läge, lägsta ${kr(lagsta.belopp)} vecka ${lagsta.veckonummer}`;
  }

  return {
    bolag: inn.bolag,
    saknarSaldo,
    startSaldo,
    saldoDatum: inn.saldoDatum,
    veckor,
    lagsta,
    brytVecka,
    trafikljus,
    klartext,
    ejDaterade: { summa: ejDateradeSumma, antal: ejDateradeAntal },
    senareVarning:
      !saknarSaldo && trafikljus === "gron" && senare
        ? { veckonummer: senare.veckonummer, start: senare.start, belopp: senare.utgaende }
        : null,
    buffertmal: inn.buffertmal,
    gulGransVeckor: inn.gulGransVeckor,
  };
}
