// OFFERT-2 / O-1a — tolkar leverantörens produktdatabas (produktdatabas.xlsx) till rader som
// kan skrivas till offert_inkop_*. Ren funktion: läser en buffert, returnerar data + varningar.
// Ingen databas, ingen HTTP — därför testbar mot den riktiga filen.
//
// ★ HELA POÄNGEN: en tom fraktcell och en nolla är olika saker. Tom cell = leverantören har inte
//   offererat fraktsättet, priset är OKÄNT. Nolla = uttryckligen offererat till noll (golvstativ
//   och väggfäste vid 1 st, de följer med skärmen). Därför blir en tom cell INGEN rad i
//   `frakt[]`, aldrig ett nollvärde. Motorn kan då inte råka räkna med den.
//
// Kolumnerna slås upp på RUBRIKTEXT, inte på position. Flyttar leverantören en kolumn ska
// importen antingen hitta rätt eller säga ifrån — aldrig läsa fel kolumn tyst.

import ExcelJS from "exceljs";
import { createHash } from "node:crypto";

export const FRAKTSATT = ["bat", "tag", "lastbil", "flyg", "dhl", "fedex"] as const;
export type Fraktsatt = (typeof FRAKTSATT)[number];

/** Visningsnamn. Samma ord som i filen, så en flagga går att jämföra med kalkylbladet. */
export const FRAKTSATT_ETIKETT: Record<Fraktsatt, string> = {
  bat: "Båt",
  tag: "Tåg",
  lastbil: "Lastbil",
  flyg: "Flyg",
  dhl: "DHL",
  fedex: "Fedex",
};

/** Leverantörens egna ord i Prislistedata → normaliserat fraktsätt. */
const LEVERANTORSORD: Record<string, Fraktsatt> = {
  sjofrakt: "bat",
  bat: "bat",
  tag: "tag",
  lastbil: "lastbil",
  flygfrakt: "flyg",
  flyg: "flyg",
  dhl: "dhl",
  fedex: "fedex",
};

export interface ImportFrakt {
  fraktsatt: Fraktsatt;
  frakt_styck: number;
  kalla_kolumn: string;
}

export interface ImportTrappa {
  produktnyckel: string;
  modellnr: string | null;
  produkt: string | null;
  antal: number;
  exw_styck: number;
  ledtid: string | null;
  prislista_datum: string | null;
  kallfil: string | null;
  notering: string | null;
  kalla_rad: number;
  frakt: ImportFrakt[];
}

export interface ImportProdukt {
  produktnyckel: string;
  leverantor: string;
  modellnr: string | null;
  produktnamn: string;
  produkttyp: string | null;
  storlek: string | null;
  ljusstyrka: string | null;
  miljo: string | null;
  ledtid: string | null;
  moq: number | null;
  garanti: string | null;
  prislista_datum: string | null;
  prisandring: string | null;
  senast_uppdaterad: string | null;
  kallfil: string | null;
  kalla_rad: number;
}

export interface ImportPrislistedata {
  produktnyckel: string;
  leverantor: string | null;
  modellnr: string | null;
  produkt: string | null;
  antal: number | null;
  fraktsatt_leverantor: string | null;
  fraktsatt: Fraktsatt | null;
  exw_styck: number | null;
  exw_totalt: number | null;
  frakt_styck: number | null;
  frakt_totalt: number | null;
  totalt_order: number | null;
  prislistans_total: number | null;
  kontroll: string | null;
  kallfil: string | null;
  notering: string | null;
  kalla_rad: number;
}

export interface TolkatResultat {
  sha256: string;
  produkter: ImportProdukt[];
  trappor: ImportTrappa[];
  prislistedata: ImportPrislistedata[];
  radantal: { produkter: number; trappor: number; fraktceller: number; tomma_fraktceller: number; prislistedata: number };
  varningar: string[];
}

/** Fel som gör att filen inte går att importera alls (layouten är inte den vi kan läsa). */
export class ImportFel extends Error {}

// ── cellhjälp ────────────────────────────────────────────────────────────────

type Cell = ExcelJS.CellValue;

/** Råvärde ur en cell. Formelceller ger sitt uträknade resultat. Tom cell ger null. */
function varde(c: Cell): string | number | Date | null {
  if (c === null || c === undefined) return null;
  if (typeof c === "number" || typeof c === "string") return c === "" ? null : c;
  if (c instanceof Date) return c;
  if (typeof c === "object") {
    const o = c as { result?: unknown; richText?: { text: string }[]; text?: string; error?: string };
    if (o.error) return null;
    if (Array.isArray(o.richText)) {
      const t = o.richText.map((r) => r.text).join("").trim();
      return t === "" ? null : t;
    }
    if ("result" in o) {
      const r = o.result;
      if (r === null || r === undefined || r === "") return null;
      if (typeof r === "number" || typeof r === "string") return r;
      if (r instanceof Date) return r;
      return null;
    }
    if (typeof o.text === "string") return o.text.trim() === "" ? null : o.text.trim();
  }
  return null;
}

function text(c: Cell): string | null {
  const v = varde(c);
  if (v === null) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  return s === "" ? null : s;
}

/**
 * Tal ur en cell. Returnerar null för tom cell OCH för text — men 0 för en nolla.
 * Det är hela skillnaden mellan "okänt" och "gratis", så den får aldrig kollapsa.
 */
function tal(c: Cell): number | null {
  const v = varde(c);
  if (v === null || v instanceof Date) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).replace(/\s/g, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null; // "Frakt ej ifylld" är text, inte en nolla
  return Number(s);
}

function datum(c: Cell): string | null {
  const v = varde(c);
  if (v === null) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
}

/** Jämförbar rubriktext: gemener, utan parenteser, utan diakriter och skiljetecken. */
function nyckelform(s: string | null): string {
  if (!s) return "";
  return s
    .replace(/\([^)]*\)/g, " ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Rubrikrad → { nyckelform: kolumnnummer }. */
function rubriker(ws: ExcelJS.Worksheet, rad: number): Map<string, number> {
  const m = new Map<string, number>();
  const r = ws.getRow(rad);
  for (let c = 1; c <= ws.columnCount; c++) {
    const t = nyckelform(text(r.getCell(c).value));
    if (t && !m.has(t)) m.set(t, c);
  }
  return m;
}

/** Hittar en kolumn på rubrikens början. Kastar om den saknas och `kravs`. */
function kol(m: Map<string, number>, prefix: string, kravs: true): number;
function kol(m: Map<string, number>, prefix: string, kravs?: false): number | null;
function kol(m: Map<string, number>, prefix: string, kravs = false): number | null {
  const p = nyckelform(prefix);
  for (const [k, v] of m) if (k === p || k.startsWith(p + " ")) return v;
  if (kravs) throw new ImportFel(`Hittar ingen kolumn som börjar med "${prefix}". Har filens rubriker ändrats?`);
  return null;
}

function bokstav(ws: ExcelJS.Worksheet, c: number): string {
  return ws.getColumn(c).letter || String(c);
}

/** Rubrikraden = första raden där kolumn A är "Produktnyckel". */
function hittaRubrikrad(ws: ExcelJS.Worksheet): number {
  for (let r = 1; r <= Math.min(10, ws.rowCount); r++) {
    if (nyckelform(text(ws.getRow(r).getCell(1).value)) === "produktnyckel") return r;
  }
  throw new ImportFel(`Fliken "${ws.name}" saknar rubriken "Produktnyckel" i kolumn A.`);
}

// ── flikarna ─────────────────────────────────────────────────────────────────

function lasFraktkalkyl(ws: ExcelJS.Worksheet, varningar: string[]) {
  const hr = hittaRubrikrad(ws);
  const h = rubriker(ws, hr);
  const cNyckel = kol(h, "produktnyckel", true);
  const cModell = kol(h, "modellnr");
  const cProdukt = kol(h, "produkt");
  const cAntal = kol(h, "antal", true);
  const cExw = kol(h, "exw per styck", true);
  const cLedtid = kol(h, "ledtid");
  const cDatum = kol(h, "prislistans datum");
  const cKallfil = kol(h, "kallfil") ?? kol(h, "kalla");
  const cNot = kol(h, "not");

  // Fraktblocket: rubriken "Frakt per styck" står över sammanslagna celler på rubrikraden,
  // fraktsättens namn på raden under. Vi läser namnen och kräver att de sex stämmer.
  const cFraktStart = kol(h, "frakt per styck", true);
  const underrad = ws.getRow(hr + 1);
  const fraktKol: { fraktsatt: Fraktsatt; kolumn: number; bokstav: string }[] = [];
  for (let i = 0; i < FRAKTSATT.length; i++) {
    const c = cFraktStart + i;
    const namn = nyckelform(text(underrad.getCell(c).value));
    const vantat = nyckelform(FRAKTSATT_ETIKETT[FRAKTSATT[i]]);
    if (namn !== vantat) {
      throw new ImportFel(
        `Fraktkolumn ${bokstav(ws, c)} heter "${text(underrad.getCell(c).value) ?? "(tom)"}" men förväntades vara "${FRAKTSATT_ETIKETT[FRAKTSATT[i]]}". ` +
          `Fraktsätten måste ligga i ordningen ${FRAKTSATT.map((f) => FRAKTSATT_ETIKETT[f]).join(", ")}.`,
      );
    }
    fraktKol.push({ fraktsatt: FRAKTSATT[i], kolumn: c, bokstav: bokstav(ws, c) });
  }

  // Data börjar på första raden efter rubrikerna som har en produktnyckel och ett antal.
  let start = hr + 1;
  while (start <= ws.rowCount) {
    const rad = ws.getRow(start);
    if (text(rad.getCell(cNyckel).value) && tal(rad.getCell(cAntal).value) !== null) break;
    start++;
  }

  const trappor: ImportTrappa[] = [];
  let fraktceller = 0;
  let tommaFraktceller = 0;
  const sedda = new Set<string>();

  for (let r = start; r <= ws.rowCount; r++) {
    const rad = ws.getRow(r);
    const nyckel = text(rad.getCell(cNyckel).value);
    if (!nyckel) continue;
    const antal = tal(rad.getCell(cAntal).value);
    const exw = tal(rad.getCell(cExw).value);
    if (antal === null || !Number.isInteger(antal) || antal <= 0) {
      varningar.push(`Fraktkalkyl rad ${r} (${nyckel}): antal saknas eller är inte ett heltal — raden hoppas över.`);
      continue;
    }
    if (exw === null) {
      varningar.push(`Fraktkalkyl rad ${r} (${nyckel}, ${antal} st): EXW-pris saknas — raden hoppas över, kostnad går inte att räkna fram.`);
      continue;
    }
    const dubblettnyckel = `${nyckel}|${antal}`;
    if (sedda.has(dubblettnyckel)) {
      varningar.push(`Fraktkalkyl rad ${r}: ${nyckel} vid ${antal} st finns redan tidigare i fliken — den senare raden hoppas över.`);
      continue;
    }
    sedda.add(dubblettnyckel);

    const frakt: ImportFrakt[] = [];
    for (const fk of fraktKol) {
      const v = tal(rad.getCell(fk.kolumn).value);
      if (v === null) {
        tommaFraktceller++; // okänt pris — blir medvetet INGEN rad
        continue;
      }
      fraktceller++;
      frakt.push({ fraktsatt: fk.fraktsatt, frakt_styck: v, kalla_kolumn: fk.bokstav });
    }

    trappor.push({
      produktnyckel: nyckel,
      modellnr: cModell ? text(rad.getCell(cModell).value) : null,
      produkt: cProdukt ? text(rad.getCell(cProdukt).value) : null,
      antal,
      exw_styck: exw,
      ledtid: cLedtid ? text(rad.getCell(cLedtid).value) : null,
      prislista_datum: cDatum ? datum(rad.getCell(cDatum).value) : null,
      kallfil: cKallfil ? text(rad.getCell(cKallfil).value) : null,
      notering: cNot ? text(rad.getCell(cNot).value) : null,
      kalla_rad: r,
      frakt,
    });
  }

  return { trappor, fraktceller, tommaFraktceller };
}

function lasProdukter(ws: ExcelJS.Worksheet, varningar: string[]): ImportProdukt[] {
  const hr = hittaRubrikrad(ws);
  const h = rubriker(ws, hr);
  const c = {
    nyckel: kol(h, "produktnyckel", true),
    leverantor: kol(h, "leverantor"),
    modellnr: kol(h, "modellnr"),
    namn: kol(h, "produktnamn"),
    typ: kol(h, "produkttyp"),
    storlek: kol(h, "storlek"),
    ljus: kol(h, "ljusstyrka"),
    miljo: kol(h, "inomhus eller utomhus"),
    ledtid: kol(h, "ledtid"),
    moq: kol(h, "moq"),
    garanti: kol(h, "garanti"), // finns inte i dagens fil — läses när den tillkommer
    datum: kol(h, "prislistans datum"),
    prisandring: kol(h, "prisandring"),
    uppdaterad: kol(h, "senast uppdaterad"),
    kallfil: kol(h, "kallfil"),
  };

  const ut: ImportProdukt[] = [];
  const sedda = new Set<string>();
  for (let r = hr + 1; r <= ws.rowCount; r++) {
    const rad = ws.getRow(r);
    const nyckel = text(rad.getCell(c.nyckel).value);
    if (!nyckel) continue;
    if (sedda.has(nyckel)) {
      varningar.push(`Alla produkter rad ${r}: produktnyckeln "${nyckel}" finns redan — den senare raden hoppas över. Nyckeln måste vara unik.`);
      continue;
    }
    sedda.add(nyckel);
    ut.push({
      produktnyckel: nyckel,
      leverantor: (c.leverantor ? text(rad.getCell(c.leverantor).value) : null) || "Okänd leverantör",
      modellnr: c.modellnr ? text(rad.getCell(c.modellnr).value) : null,
      produktnamn: (c.namn ? text(rad.getCell(c.namn).value) : null) || nyckel,
      produkttyp: c.typ ? text(rad.getCell(c.typ).value) : null,
      storlek: c.storlek ? text(rad.getCell(c.storlek).value) : null,
      ljusstyrka: c.ljus ? text(rad.getCell(c.ljus).value) : null,
      miljo: c.miljo ? text(rad.getCell(c.miljo).value) : null,
      ledtid: c.ledtid ? text(rad.getCell(c.ledtid).value) : null,
      moq: c.moq ? tal(rad.getCell(c.moq).value) : null,
      garanti: c.garanti ? text(rad.getCell(c.garanti).value) : null,
      prislista_datum: c.datum ? datum(rad.getCell(c.datum).value) : null,
      prisandring: c.prisandring ? text(rad.getCell(c.prisandring).value) : null,
      senast_uppdaterad: c.uppdaterad ? datum(rad.getCell(c.uppdaterad).value) : null,
      kallfil: c.kallfil ? text(rad.getCell(c.kallfil).value) : null,
      kalla_rad: r,
    });
  }
  return ut;
}

/** Leverantörens ord ("Sjöfrakt DDP") → normaliserat fraktsätt. Okänt ord ger null, inte en gissning. */
export function normaliseraFraktsatt(ord: string | null): Fraktsatt | null {
  if (!ord) return null;
  const n = nyckelform(ord);
  for (const [del, fs] of Object.entries(LEVERANTORSORD)) {
    if (n === del || n.startsWith(del + " ") || n.split(" ")[0] === del) return fs;
  }
  return null;
}

function lasPrislistedata(ws: ExcelJS.Worksheet): ImportPrislistedata[] {
  const hr = hittaRubrikrad(ws);
  const h = rubriker(ws, hr);
  const c = {
    nyckel: kol(h, "produktnyckel", true),
    leverantor: kol(h, "leverantor"),
    modellnr: kol(h, "modellnr"),
    produkt: kol(h, "produkt eller leveransalternativ") ?? kol(h, "produkt"),
    antal: kol(h, "antal"),
    fraktsatt: kol(h, "fraktsatt enligt prislistan") ?? kol(h, "fraktsatt"),
    exwStyck: kol(h, "exw per styck"),
    exwTotalt: kol(h, "exw totalt"),
    fraktStyck: kol(h, "frakt per styck"),
    fraktTotalt: kol(h, "frakt totalt"),
    total: kol(h, "totalt for ordern"),
    angivenTotal: kol(h, "prislistans angivna total"),
    kontroll: kol(h, "kontroll"),
    kallfil: kol(h, "kallfil"),
    not: kol(h, "not"),
  };

  const ut: ImportPrislistedata[] = [];
  for (let r = hr + 1; r <= ws.rowCount; r++) {
    const rad = ws.getRow(r);
    const nyckel = text(rad.getCell(c.nyckel).value);
    if (!nyckel) continue;
    const levOrd = c.fraktsatt ? text(rad.getCell(c.fraktsatt).value) : null;
    ut.push({
      produktnyckel: nyckel,
      leverantor: c.leverantor ? text(rad.getCell(c.leverantor).value) : null,
      modellnr: c.modellnr ? text(rad.getCell(c.modellnr).value) : null,
      produkt: c.produkt ? text(rad.getCell(c.produkt).value) : null,
      antal: c.antal ? tal(rad.getCell(c.antal).value) : null,
      fraktsatt_leverantor: levOrd,
      fraktsatt: normaliseraFraktsatt(levOrd),
      exw_styck: c.exwStyck ? tal(rad.getCell(c.exwStyck).value) : null,
      exw_totalt: c.exwTotalt ? tal(rad.getCell(c.exwTotalt).value) : null,
      frakt_styck: c.fraktStyck ? tal(rad.getCell(c.fraktStyck).value) : null,
      frakt_totalt: c.fraktTotalt ? tal(rad.getCell(c.fraktTotalt).value) : null,
      totalt_order: c.total ? tal(rad.getCell(c.total).value) : null,
      prislistans_total: c.angivenTotal ? tal(rad.getCell(c.angivenTotal).value) : null,
      kontroll: c.kontroll ? text(rad.getCell(c.kontroll).value) : null,
      kallfil: c.kallfil ? text(rad.getCell(c.kallfil).value) : null,
      notering: c.not ? text(rad.getCell(c.not).value) : null,
      kalla_rad: r,
    });
  }
  return ut;
}

/** Hittar en flik på namn, oberoende av versaler och mellanslag. */
function flik(wb: ExcelJS.Workbook, namn: string): ExcelJS.Worksheet {
  const n = nyckelform(namn);
  const ws = wb.worksheets.find((w) => nyckelform(w.name) === n);
  if (!ws) throw new ImportFel(`Filen saknar fliken "${namn}". Flikar i filen: ${wb.worksheets.map((w) => w.name).join(", ")}.`);
  return ws;
}

// ── ingång ───────────────────────────────────────────────────────────────────

export async function tolkaProduktdatabas(buf: Buffer): Promise<TolkatResultat> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
  } catch (e) {
    throw new ImportFel("Kunde inte öppna filen som Excel-arbetsbok: " + (e as Error).message);
  }

  const varningar: string[] = [];
  const produkter = lasProdukter(flik(wb, "Alla produkter"), varningar);
  const { trappor, fraktceller, tommaFraktceller } = lasFraktkalkyl(flik(wb, "Fraktkalkyl"), varningar);
  const prislistedata = lasPrislistedata(flik(wb, "Prislistedata"));

  if (!produkter.length) throw new ImportFel('Fliken "Alla produkter" innehåller inga produkter.');
  if (!trappor.length) throw new ImportFel('Fliken "Fraktkalkyl" innehåller inga användbara rader.');

  // Korsvis kontroll mellan flikarna. Produktnyckeln är enda kopplingen — går den isär är
  // uppslaget trasigt, och det ska synas i bekräftelseskärmen innan något sparas.
  const produktNycklar = new Set(produkter.map((p) => p.produktnyckel));
  const trappNycklar = new Set(trappor.map((t) => t.produktnyckel));

  for (const n of trappNycklar) {
    if (!produktNycklar.has(n)) varningar.push(`Fraktkalkyl har nyckeln "${n}" som saknas i Alla produkter — produkten kan prissättas men inte beskrivas.`);
  }
  for (const p of produkter) {
    if (!trappNycklar.has(p.produktnyckel)) varningar.push(`"${p.produktnyckel}" finns i Alla produkter men saknar rader i Fraktkalkyl — ingen kostnad går att räkna fram.`);
  }
  for (const t of trappor) {
    if (!t.frakt.length)
      varningar.push(`${t.produktnyckel} vid ${t.antal} st: inget fraktsätt är offererat (Fraktkalkyl rad ${t.kalla_rad}) — kostnad går inte att räkna fram, offert måste begäras.`);
  }
  const okandaLevord = new Set(
    prislistedata.filter((p) => p.fraktsatt_leverantor && !p.fraktsatt).map((p) => p.fraktsatt_leverantor as string),
  );
  for (const ord of okandaLevord) varningar.push(`Prislistedata: fraktsättet "${ord}" går inte att översätta till något av de sex kända — jämförelse mot Fraktkalkyl blir ofullständig.`);

  return {
    sha256: createHash("sha256").update(buf).digest("hex"),
    produkter,
    trappor,
    prislistedata,
    radantal: { produkter: produkter.length, trappor: trappor.length, fraktceller, tomma_fraktceller: tommaFraktceller, prislistedata: prislistedata.length },
    varningar,
  };
}
