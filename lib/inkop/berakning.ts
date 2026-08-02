// K3-INKÖP — förbrukningstakt, prognos, larmnivå och köprekommendation.
//
// Allt här är RENA funktioner: ingen databas, inget nätverk och aldrig `new Date()` som
// hämtar dagens datum. Dagens datum skickas alltid in. Samma skäl som i lib/hq/likviditet:
// en prognos som läser klockan går inte att testa, och ett test som beter sig olika på
// tisdag och söndag bevisar ingenting.
//
// Grundregeln: förbrukningen kommer ur KOSTNAD-1:s ledger (ai_usage_events). Ingen egen
// mätning, ingen parallell sanning. Saknas underlag SÄGS det, det gissas aldrig fram.

/** Kontotyp. Förbetalt = pengar ligger på kontot, efterskott = faktura i efterhand. */
export type Inkopstyp = "forbetalt" | "efterskott";
export type Larmniva = "gron" | "gul" | "rod";

export interface Trosklar {
  /** Gult under så här många dagar kvar (förbetalt). */
  gulDagar: number;
  /** Rött under så här många dagar kvar (förbetalt). */
  rodDagar: number;
  /** Gult när prognosen överstiger så här många procent av förra fakturan (efterskott). */
  gulPrognosProcent: number;
}

/** De beställda startvärdena. Ägaren kan ändra dem i inkop_konfig utan deploy. */
export const TROSKLAR_STANDARD: Trosklar = { gulDagar: 14, rodDagar: 5, gulPrognosProcent: 150 };

/** En dags uppmätt kostnad i kronor. Datumet är ÅÅÅÅ-MM-DD i svensk tid. */
export interface Dagskostnad {
  dag: string;
  kostnadSek: number;
}

const DAG_MS = 86400000;
const tillMs = (dag: string): number => Date.parse(`${dag}T12:00:00Z`);
const tillDag = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/** Antal dagar mellan två datum, `till` minus `fran`. Negativt blir noll. */
export function dagarMellan(fran: string, till: string): number {
  return Math.max(0, Math.round((tillMs(till) - tillMs(fran)) / DAG_MS));
}

export function laggTillDagar(dag: string, antal: number): string {
  return tillDag(tillMs(dag) + Math.round(antal) * DAG_MS);
}

export interface Takt {
  /** Snittkostnad per dag i kronor över fönstret. */
  snittPerDag: number;
  /** Summan i fönstret. */
  summa: number;
  /** Fönstrets nominella längd i dagar (7 eller 30). */
  fonster: number;
  /**
   * Nämnaren som faktiskt användes. Har mätningen bara pågått i två dagar delas summan
   * på två, inte på trettio — annars ser takten fyra gånger för låg ut och prognosen
   * blir farligt optimistisk.
   */
  namnare: number;
  /** true = för kort mätperiod för att lita på siffran. Sägs ut i vyn. */
  tunt: boolean;
}

/**
 * Snittkostnad per dag över de senaste `fonster` dagarna, dagen `idag` inräknad.
 *
 * `matningStartade` är första dagen det finns någon mätning alls. Ligger den inne i
 * fönstret kortas nämnaren till den faktiska mätperioden. Är den null finns ingen
 * mätning och takten är noll med `tunt: true`.
 */
export function raknaTakt(
  dagskostnader: Dagskostnad[],
  idag: string,
  fonster: number,
  matningStartade: string | null,
): Takt {
  const forsta = laggTillDagar(idag, -(fonster - 1));
  const summa = dagskostnader
    .filter((d) => d.dag >= forsta && d.dag <= idag)
    .reduce((s, d) => s + (Number(d.kostnadSek) || 0), 0);

  const matdagar = matningStartade ? dagarMellan(matningStartade, idag) + 1 : 0;
  const namnare = Math.max(1, Math.min(fonster, matdagar));
  const tunt = matdagar < 3 || summa <= 0;

  return { snittPerDag: summa / namnare, summa, fonster, namnare, tunt };
}

/**
 * Dagar kvar på ett förbetalt saldo, räknat på sjudagarssnittet.
 * null = går inte att räkna (ingen uppmätt förbrukning eller inget saldo inlagt).
 * Att svara null är hela poängen: en påhittad siffra hade sett ut som ett lugnt läge.
 */
export function dagarKvar(saldoSek: number | null, snitt7PerDag: number): number | null {
  if (saldoSek === null || !Number.isFinite(saldoSek)) return null;
  if (!(snitt7PerDag > 0)) return null;
  return saldoSek / snitt7PerDag;
}

/** Prognostiserad månadskostnad för ett efterskottskonto: trettiodagarssnittet gånger 30. */
export function prognosManad(snitt30PerDag: number): number {
  return snitt30PerDag * 30;
}

export interface Larmunderlag {
  typ: Inkopstyp;
  dagarKvar: number | null;
  prognosSek: number;
  /** Förra fakturans belopp i kronor. null = inte ifyllt, då går jämförelsen inte att göra. */
  forraFakturanSek: number | null;
  /** true = provider-hälsan har flaggat ett billing-fel det senaste dygnet. */
  billingfelSenasteDygnet: boolean;
  trosklar: Trosklar;
}

export interface Larmbedomning {
  niva: Larmniva;
  /** Kort orsak i klarspråk. Tom sträng vid grönt. */
  orsak: string;
}

/**
 * Larmnivån för ett konto.
 *
 * Ett billing-fel senaste dygnet är ALLTID rött, oavsett saldo: då har spärren redan
 * slagit till. Det var precis det som hände 1 augusti, och det är det enda larmet som
 * inte kräver att någon hunnit fylla i en siffra.
 */
export function bedomLarm(u: Larmunderlag): Larmbedomning {
  if (u.billingfelSenasteDygnet) {
    return { niva: "rod", orsak: "leverantören svarade med ett betalningsfel det senaste dygnet" };
  }

  if (u.typ === "forbetalt") {
    if (u.dagarKvar === null) return { niva: "gron", orsak: "" };
    const dagar = Math.floor(u.dagarKvar);
    if (u.dagarKvar < u.trosklar.rodDagar) {
      return { niva: "rod", orsak: `saldot räcker ${dagar} ${dagar === 1 ? "dag" : "dagar"} till` };
    }
    if (u.dagarKvar < u.trosklar.gulDagar) {
      return { niva: "gul", orsak: `saldot räcker ${dagar} dagar till` };
    }
    return { niva: "gron", orsak: "" };
  }

  // Efterskott: jämförelsen kräver en riktig faktura att jämföra mot. Saknas den
  // larmas inget, och vyn säger att fältet behöver fyllas i.
  if (u.forraFakturanSek !== null && u.forraFakturanSek > 0) {
    const andel = (u.prognosSek / u.forraFakturanSek) * 100;
    if (andel > u.trosklar.gulPrognosProcent) {
      return {
        niva: "gul",
        orsak: `månaden ser ut att landa på ${Math.round(andel)} procent av förra fakturan`,
      };
    }
  }
  return { niva: "gron", orsak: "" };
}

/**
 * Avrunda uppåt till ett jämnt belopp när providerns påfyllningssteg är okänt.
 * Steget växer med beloppet: tio under hundra, femtio under tusen, och så vidare.
 */
export function avrundaUppatJamnt(belopp: number): number {
  if (!(belopp > 0)) return 0;
  const steg = belopp < 100 ? 10 : belopp < 1000 ? 50 : belopp < 10000 ? 500 : 1000;
  return Math.ceil(belopp / steg) * steg;
}

export function avrundaUppat(belopp: number, steg: number | null): number {
  if (steg && steg > 0) return Math.ceil(belopp / steg) * steg;
  return avrundaUppatJamnt(belopp);
}

export interface RekommendationIn {
  etikett: string;
  /** Trettiodagarssnittet i kronor per dag. */
  snitt30PerDag: number;
  dagarKvar: number | null;
  /** Kontots valuta, och kursen som gör om kronor till den valutan. SEK = kurs 1. */
  valuta: string;
  kurs: number;
  pafyllningssteg: number | null;
  idag: string;
  rodDagar: number;
}

export interface Rekommendation {
  /** Beloppet i kontots valuta, avrundat uppåt. */
  belopp: number;
  valuta: string;
  /** Samma belopp i kronor, före avrundning. */
  beloppSek: number;
  /** Sista dagen att fylla på: den dag saldot är nere på rödgränsen. */
  senast: string | null;
  /** Färdig mening att läsa rakt av. */
  klartext: string;
}

/**
 * Rekommenderat påfyllningsbelopp: 45 dagars förbrukning enligt trettiodagarssnittet,
 * avrundat uppåt till providerns steg om det är känt, annars till ett jämnt belopp.
 *
 * Datumet är inte den dag saldot tar slut utan den dag det är nere på rödgränsen, så
 * det finns marginal kvar när påminnelsen kommer. Aldrig något automatiskt köp.
 */
export function byggRekommendation(inn: RekommendationIn): Rekommendation {
  const beloppSek = inn.snitt30PerDag * 45;
  const kurs = inn.kurs > 0 ? inn.kurs : 1;
  const belopp = avrundaUppat(beloppSek / kurs, inn.pafyllningssteg);

  const senast =
    inn.dagarKvar === null
      ? null
      : laggTillDagar(inn.idag, Math.max(0, Math.floor(inn.dagarKvar - inn.rodDagar)));

  const beloppText = `${belopp.toLocaleString("sv-SE")} ${inn.valuta}`;
  const klartext = senast
    ? `Fyll på ${inn.etikett} med ca ${beloppText} före ${senast}.`
    : `Fyll på ${inn.etikett} med ca ${beloppText}.`;

  return { belopp, valuta: inn.valuta, beloppSek, senast, klartext };
}

// ── Larmrad till morgonlistan och till kostnadsvyns banner ─────────────────

/**
 * Larmraden. Formen är exakt densamma som LIKVID-1:s rader i HQ:s morgonlista, plus
 * etikett och länk, så båda vyerna kan rendera samma objekt utan egen logik.
 */
export interface Larmrad {
  id: string;
  text: string;
  niva: "gul" | "rod";
  etikett: string;
  lank: string;
}

export function larmtext(etikett: string, bedomning: Larmbedomning, rekommendation: string | null): string {
  const start = `${etikett}: ${bedomning.orsak}`;
  return rekommendation ? `${start}. ${rekommendation}` : `${start}.`;
}

// ── Marginal per kund ─────────────────────────────────────────────────────

export interface MarginalIn {
  tenantId: string;
  namn: string;
  /** Abonnemangspris per månad i kronor. null = inget pris ifyllt. */
  abonnemangSek: number | null;
  /** Sålda påfyllningar innevarande månad, i kronor. */
  topupSek: number;
  /** Faktisk AI-kostnad innevarande månad, ur ai_usage_events. */
  aiKostnadSek: number;
}

export interface MarginalRad extends MarginalIn {
  intaktSek: number | null;
  marginalSek: number | null;
  marginalProcent: number | null;
  /** true = abonnemangspriset saknas. Då visas ingen marginal alls, aldrig en falsk nolla. */
  prisSaknas: boolean;
}

/**
 * Bruttomarginal per kund: månadsintäkt minus faktisk AI-kostnad.
 *
 * ⚠ En kund utan ifyllt abonnemangspris får INTE marginalen noll. Noll ser ut som en
 * mätning och är i själva verket en lucka. Raden flaggas "pris saknas" i stället, och
 * summeringen räknar inte med den.
 */
export function raknaMarginal(rader: MarginalIn[]): MarginalRad[] {
  return rader.map((r) => {
    const prisSaknas = r.abonnemangSek === null;
    if (prisSaknas) {
      return { ...r, intaktSek: null, marginalSek: null, marginalProcent: null, prisSaknas: true };
    }
    const intaktSek = (r.abonnemangSek || 0) + r.topupSek;
    const marginalSek = intaktSek - r.aiKostnadSek;
    return {
      ...r,
      intaktSek,
      marginalSek,
      marginalProcent: intaktSek > 0 ? (marginalSek / intaktSek) * 100 : null,
      prisSaknas: false,
    };
  });
}

export interface MarginalSumma {
  intaktSek: number;
  aiKostnadSek: number;
  marginalSek: number;
  marginalProcent: number | null;
  /** Antal kunder som inte kunde räknas med för att priset saknas. */
  utanPris: number;
}

/** Summan räknar BARA kunder med ifyllt pris. Övriga redovisas som antal. */
export function summeraMarginal(rader: MarginalRad[]): MarginalSumma {
  const med = rader.filter((r) => !r.prisSaknas);
  const intaktSek = med.reduce((s, r) => s + (r.intaktSek || 0), 0);
  const aiKostnadSek = med.reduce((s, r) => s + r.aiKostnadSek, 0);
  const marginalSek = intaktSek - aiKostnadSek;
  return {
    intaktSek,
    aiKostnadSek,
    marginalSek,
    marginalProcent: intaktSek > 0 ? (marginalSek / intaktSek) * 100 : null,
    utanPris: rader.length - med.length,
  };
}
