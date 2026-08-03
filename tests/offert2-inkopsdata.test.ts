// OFFERT-2 — enhetstester på inköpsdatabasens tolkning och flaggor.
//
// Fixturen byggs i minnet och återger den riktiga filens EGENSKAPER, inte dess innehåll:
// två rubrikrader i Fraktkalkyl, tomma fraktceller bredvid nollor, text i en numerisk kolumn,
// samma modellnummer på flera produktnycklar, och en produkt helt utan offererad frakt.
// Leverantörens verkliga inköpspriser hör inte hemma i git.
//
// Allt datum injiceras — inget test läser klockan.

import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import {
  FRAKTSATT_ETIKETT,
  ImportFel,
  normaliseraFraktsatt,
  tolkaProduktdatabas,
} from "@/lib/offert/xlsx-import";
import { byggFlaggor, GILTIGHET_DAGAR, type Fraktalternativ, type Produkt } from "@/lib/offert/inkopsdata";

// ── fixtur ───────────────────────────────────────────────────────────────────

const FRAKTNAMN = ["Båt", "Tåg", "Lastbil", "Flyg", "DHL", "Fedex"];

/** `null` = tom cell (okänt pris). En nolla är en nolla. */
type Fraktrad = [number | null, number | null, number | null, number | null, number | null, number | null];

interface FixturTrappa {
  nyckel: string;
  modellnr: string | null;
  produkt: string;
  antal: number;
  exw: number | string | null;
  frakt: Fraktrad;
  not?: string;
}

interface FixturProdukt {
  nyckel: string;
  modellnr: string | null;
  namn: string;
  storlek?: string;
  ljusstyrka?: string;
  miljo?: string;
  lagstaTotal?: number | string;
}

const PRODUKTER: FixturProdukt[] = [
  { nyckel: "AAA-0001 32 tum", modellnr: "AAA-0001", namn: "32 tum inomhus", storlek: "32 tum", ljusstyrka: "500", miljo: "Inomhus" },
  { nyckel: "AAA-0001 43 tum", modellnr: "AAA-0001", namn: "43 tum inomhus", storlek: "43 tum", ljusstyrka: "500", miljo: "Inomhus" },
  { nyckel: "Golvstativ", modellnr: null, namn: "Golvstativ, följer med skärmen" },
  { nyckel: "BBB-0065 65 tum ute", modellnr: "BBB-0065", namn: "65 tum utomhus", storlek: "65 tum", ljusstyrka: "5500 i rubriken, 3500 i specifikationen", miljo: "Utomhus, IP67", lagstaTotal: "Frakt ej ifylld" },
];

const TRAPPOR: FixturTrappa[] = [
  // 1 st: bara DHL offererad. Resten tomma = okända.
  { nyckel: "AAA-0001 32 tum", modellnr: "AAA-0001", produkt: "32 tum inomhus", antal: 1, exw: 320, frakt: [null, null, null, null, 240, null] },
  { nyckel: "AAA-0001 32 tum", modellnr: "AAA-0001", produkt: "32 tum inomhus", antal: 10, exw: 310, frakt: [75, null, null, null, 220, null] },
  // Samma modellnr, annan produktnyckel — får inte slås ihop.
  { nyckel: "AAA-0001 43 tum", modellnr: "AAA-0001", produkt: "43 tum inomhus", antal: 1, exw: 380, frakt: [null, null, null, 300, 280, null], not: "Frakten ser omkastad ut mot 10 st. Kontrollera med leverantören." },
  // ★ Nollor: uttryckligen offererat till noll, inte okänt.
  { nyckel: "Golvstativ", modellnr: null, produkt: "Golvstativ", antal: 1, exw: 100, frakt: [0, null, 0, 0, null, null] },
  { nyckel: "Golvstativ", modellnr: null, produkt: "Golvstativ", antal: 5, exw: 100, frakt: [100, null, 120, 220, null, null] },
  // Inget fraktsätt alls offererat.
  { nyckel: "BBB-0065 65 tum ute", modellnr: "BBB-0065", produkt: "65 tum utomhus", antal: 1, exw: 2400, frakt: [null, null, null, null, null, null] },
];

interface FixturVal {
  fraktnamn?: string[];
  extraTrappor?: FixturTrappa[];
  extraProdukter?: FixturProdukt[];
  prislistedata?: (string | number | null)[][];
}

async function byggFixtur(val: FixturVal = {}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const namn = val.fraktnamn ?? FRAKTNAMN;
  const trappor = [...TRAPPOR, ...(val.extraTrappor ?? [])];
  const produkter = [...PRODUKTER, ...(val.extraProdukter ?? [])];

  // Alla produkter — en rubrikrad.
  const ap = wb.addWorksheet("Alla produkter");
  ap.addRow([
    "Produktnyckel", "Leverantör", "Modellnr", "Produktnamn", "Produkttyp", "Storlek (tum eller pixel pitch)",
    "Ljusstyrka (nits)", "Inomhus eller utomhus", "Lägsta inköpspris EXW USD", "Lägsta totalpris per styck inkl frakt USD",
    "Billigaste fraktsätt", "Vid antal (st)", "Antal rader i Fraktkalkyl", "MOQ (lägsta offererade antal)", "Ledtid",
    "Prislistans datum", "Källfil", "Prisändring", "Senast uppdaterad",
  ]);
  for (const p of produkter) {
    ap.addRow([
      p.nyckel, "Testleverantör", p.modellnr, p.namn, "Skylt", p.storlek ?? null, p.ljusstyrka ?? null, p.miljo ?? null,
      null, p.lagstaTotal ?? null, null, null, null, 1, "10 till 15 dagar", null, "kalla.pdf", null, "2026-08-02",
    ]);
  }

  // Fraktkalkyl — TVÅ rubrikrader, data från rad 3.
  const fk = wb.addWorksheet("Fraktkalkyl");
  fk.addRow([
    "Produktnyckel", "Modellnr", "Produkt", "Antal (st)", "EXW per styck USD", "EXW totalt USD",
    "Frakt per styck USD", null, null, null, null, null,
    "Totalt per styck inkl frakt USD", null, null, null, null, null,
    "Totalt för ordern USD", null, null, null, null, null,
    "Lägsta totalpris per styck USD", "Billigaste fraktsätt", "Ledtid", "Prislistans datum", "Källfil", "Not",
  ]);
  fk.addRow([null, null, null, null, null, null, ...namn, ...namn, ...namn]);
  for (const t of trappor) {
    fk.addRow([
      t.nyckel, t.modellnr, t.produkt, t.antal, t.exw, typeof t.exw === "number" ? t.exw * t.antal : null,
      ...t.frakt,
      ...t.frakt.map((f) => (f === null || typeof t.exw !== "number" ? null : t.exw + f)),
      ...t.frakt.map((f) => (f === null || typeof t.exw !== "number" ? null : (t.exw + f) * t.antal)),
      null, null, "10 till 15 dagar", null, "kalla.pdf", t.not ?? null,
    ]);
  }

  // Prislistedata — revisionsspår.
  const pl = wb.addWorksheet("Prislistedata");
  pl.addRow([
    "Produktnyckel", "Leverantör", "Modellnr", "Produkt eller leveransalternativ", "Antal (st)",
    "Fraktsätt enligt prislistan", "EXW per styck USD", "EXW totalt USD", "Frakt per styck USD", "Frakt totalt USD",
    "Totalt för ordern USD", "Prislistans angivna total USD", "Kontroll mot prislistan", "Källfil", "Not",
  ]);
  const rader = val.prislistedata ?? [
    ["AAA-0001 32 tum", "Testleverantör", "AAA-0001", "32 tum", 1, "DHL", 320, 320, 240, 240, 560, 560, "OK", "kalla.pdf", null],
    ["AAA-0001 32 tum", "Testleverantör", "AAA-0001", "32 tum", 10, "Sjöfrakt DDP", 310, 3100, 75, 750, 3850, 3850, "OK", "kalla.pdf", null],
    ["Kombinerad leverans BBB-0065 och BBB-0086", "Testleverantör", "BBB-0065 + BBB-0086", "Båda i samma leverans", 2, "DHL", null, 6600, null, 5200, 11800, 11800, "OK", "kalla.pdf", "Gemensam frakt."],
  ];
  for (const r of rader) pl.addRow(r);

  wb.addWorksheet("Läs mig").addRow(["Förklaring", "för människor"]);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const trappaFor = (res: Awaited<ReturnType<typeof tolkaProduktdatabas>>, nyckel: string, antal: number) => {
  const t = res.trappor.find((x) => x.produktnyckel === nyckel && x.antal === antal);
  if (!t) throw new Error(`Fixturen saknar ${nyckel} @ ${antal}`);
  return t;
};

// ── tolkning ─────────────────────────────────────────────────────────────────

describe("tolkaProduktdatabas — struktur", () => {
  it("hittar data trots två rubrikrader i Fraktkalkyl", async () => {
    const res = await tolkaProduktdatabas(await byggFixtur());
    expect(res.radantal.trappor).toBe(TRAPPOR.length);
    expect(res.radantal.produkter).toBe(PRODUKTER.length);
    // Rubrik på 1 och 2 → första dataraden är 3, precis som i den riktiga filen.
    expect(trappaFor(res, "AAA-0001 32 tum", 1).kalla_rad).toBe(3);
  });

  it("läser alla tre flikarna och räknar rätt antal rader", async () => {
    const res = await tolkaProduktdatabas(await byggFixtur());
    expect(res.radantal.prislistedata).toBe(3);
    expect(res.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("kastar ImportFel om fraktsätten inte ligger i förväntad ordning", async () => {
    const fel = await byggFixtur({ fraktnamn: ["Båt", "Lastbil", "Tåg", "Flyg", "DHL", "Fedex"] });
    await expect(tolkaProduktdatabas(fel)).rejects.toBeInstanceOf(ImportFel);
  });

  it("kastar ImportFel när en flik saknas", async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet("Alla produkter").addRow(["Produktnyckel"]);
    await expect(tolkaProduktdatabas(Buffer.from(await wb.xlsx.writeBuffer()))).rejects.toBeInstanceOf(ImportFel);
  });
});

describe("tolkaProduktdatabas — tom cell är inte noll", () => {
  it("gör ingen fraktrad av en tom cell", async () => {
    const res = await tolkaProduktdatabas(await byggFixtur());
    const t = trappaFor(res, "AAA-0001 32 tum", 1);
    expect(t.frakt.map((f) => f.fraktsatt)).toEqual(["dhl"]);
    // De fem tomma får inte finnas — varken som 0 eller som null.
    expect(t.frakt.find((f) => f.fraktsatt === "bat")).toBeUndefined();
    expect(t.frakt.every((f) => typeof f.frakt_styck === "number")).toBe(true);
  });

  it("behåller en uttrycklig nolla som ett pris", async () => {
    const res = await tolkaProduktdatabas(await byggFixtur());
    const t = trappaFor(res, "Golvstativ", 1);
    expect(t.frakt.map((f) => [f.fraktsatt, f.frakt_styck])).toEqual([
      ["bat", 0],
      ["lastbil", 0],
      ["flyg", 0],
    ]);
    // Tåg, DHL och Fedex var tomma → tre rader, inte sex.
    expect(t.frakt).toHaveLength(3);
  });

  it("räknar tomma och ifyllda fraktceller var för sig", async () => {
    const res = await tolkaProduktdatabas(await byggFixtur());
    const ifyllda = TRAPPOR.flatMap((t) => t.frakt).filter((v) => v !== null).length;
    expect(res.radantal.fraktceller).toBe(ifyllda);
    expect(res.radantal.tomma_fraktceller).toBe(TRAPPOR.length * 6 - ifyllda);
  });

  it("tolkar text i en numerisk kolumn som saknat värde, inte som noll", async () => {
    // "Frakt ej ifylld" står i Lägsta totalpris-kolumnen i den riktiga filen.
    const res = await tolkaProduktdatabas(await byggFixtur());
    const p = res.produkter.find((x) => x.produktnyckel === "BBB-0065 65 tum ute")!;
    expect(p).toBeDefined();
    // Kolumnen importeras inte alls — därför kan texten aldrig bli en nolla någonstans.
    expect(Object.values(p)).not.toContain(0);
    expect(trappaFor(res, "BBB-0065 65 tum ute", 1).frakt).toHaveLength(0);
  });

  it("hoppar över en rad utan EXW-pris i stället för att räkna med noll", async () => {
    const res = await tolkaProduktdatabas(
      await byggFixtur({
        extraTrappor: [{ nyckel: "AAA-0001 32 tum", modellnr: "AAA-0001", produkt: "32 tum", antal: 25, exw: null, frakt: [50, null, null, null, null, null] }],
      }),
    );
    expect(res.trappor.find((t) => t.antal === 25)).toBeUndefined();
    expect(res.varningar.some((v) => v.includes("EXW-pris saknas"))).toBe(true);
  });
});

describe("tolkaProduktdatabas — nyckel och modellnummer", () => {
  it("håller isär två produkter som delar modellnummer", async () => {
    const res = await tolkaProduktdatabas(await byggFixtur());
    const delar = res.produkter.filter((p) => p.modellnr === "AAA-0001");
    expect(delar).toHaveLength(2);
    expect(new Set(delar.map((p) => p.produktnyckel)).size).toBe(2);
    // Trapporna hänger på nyckeln, inte på modellnumret.
    expect(trappaFor(res, "AAA-0001 32 tum", 1).exw_styck).toBe(320);
    expect(trappaFor(res, "AAA-0001 43 tum", 1).exw_styck).toBe(380);
  });

  it("varnar men fortsätter när en produktnyckel saknar rader i Fraktkalkyl", async () => {
    const res = await tolkaProduktdatabas(
      await byggFixtur({ extraProdukter: [{ nyckel: "CCC-0099 ny", modellnr: "CCC-0099", namn: "Ny produkt utan pris" }] }),
    );
    expect(res.produkter).toHaveLength(PRODUKTER.length + 1);
    expect(res.varningar.some((v) => v.includes("CCC-0099 ny") && v.includes("saknar rader i Fraktkalkyl"))).toBe(true);
  });

  it("varnar för varje trappa utan offererad frakt", async () => {
    const res = await tolkaProduktdatabas(await byggFixtur());
    expect(res.varningar.filter((v) => v.includes("inget fraktsätt är offererat"))).toHaveLength(1);
  });
});

describe("normaliseraFraktsatt", () => {
  it("översätter leverantörens egna ord", () => {
    expect(normaliseraFraktsatt("Sjöfrakt DDP")).toBe("bat");
    expect(normaliseraFraktsatt("Lastbil DDP")).toBe("lastbil");
    expect(normaliseraFraktsatt("Flygfrakt DDP")).toBe("flyg");
    expect(normaliseraFraktsatt("DHL")).toBe("dhl");
    expect(normaliseraFraktsatt("Fedex")).toBe("fedex");
  });

  it("gissar aldrig på ett okänt ord", () => {
    expect(normaliseraFraktsatt("Rälsbunden expressleverans")).toBeNull();
    expect(normaliseraFraktsatt(null)).toBeNull();
    expect(normaliseraFraktsatt("")).toBeNull();
  });

  it("mappar de sex fraktsätten till samma etiketter som filen använder", () => {
    expect(FRAKTSATT_ETIKETT.bat).toBe("Båt");
    expect(FRAKTSATT_ETIKETT.tag).toBe("Tåg");
  });
});

// ── flaggor ──────────────────────────────────────────────────────────────────

const NU = new Date("2026-08-20T09:00:00Z");
const PRISBOK = { kallfil: "produktdatabas.xlsx", importerad_at: "2026-08-18T09:00:00Z" };
const ALT: Fraktalternativ = { fraktsatt: "bat", etikett: "Båt", frakt_styck: 340, landat_styck: 1040, landat_order: 1040, kalla: "Fraktkalkyl!G11" };
const PRODUKT: Produkt = {
  produktnyckel: "X", leverantor: "Topdisplay", modellnr: "X", produktnamn: "X", produkttyp: null,
  storlek: "43 tum", ljusstyrka: "3500", miljo: "Inomhus", ledtid: null, moq: 1, garanti: null,
  prisandring: null, kallfil: null, kalla_rad: 11,
};

describe("byggFlaggor", () => {
  it("blockerar när inget fraktsätt är offererat", () => {
    const f = byggFlaggor(
      { trappa: { antal: 1, notering: null, kalla_rad: 23 }, produkt: PRODUKT, alternativ: [], saknade: [], prisbok: PRISBOK },
      NU,
    );
    const blockerande = f.find((x) => x.kod === "frakt_saknas_helt");
    expect(blockerande?.niva).toBe("blockerande");
    expect(blockerande?.text).toContain("begär offert");
  });

  it("nämner vilka fraktsätt som saknas utan att blockera resten", () => {
    const f = byggFlaggor(
      {
        trappa: { antal: 1, notering: null, kalla_rad: 11 },
        produkt: PRODUKT,
        alternativ: [ALT],
        saknade: [{ fraktsatt: "tag", etikett: "Tåg" }],
        prisbok: PRISBOK,
      },
      NU,
    );
    expect(f.some((x) => x.kod === "frakt_saknas_helt")).toBe(false);
    expect(f.find((x) => x.kod === "frakt_saknas_delvis")?.text).toContain("Tåg");
  });

  it("lyfter leverantörens not på raden som varning", () => {
    const f = byggFlaggor(
      {
        trappa: { antal: 1, notering: "Prislistan anger högre frakt för båt än för flyg vid 1 st.", kalla_rad: 9 },
        produkt: PRODUKT,
        alternativ: [ALT],
        saknade: [],
        prisbok: PRISBOK,
      },
      NU,
    );
    const not = f.find((x) => x.kod === "leverantorsnot");
    expect(not?.niva).toBe("varning");
    expect(not?.text).toContain("rad 9");
  });

  it("varnar när ljusstyrkan inte är ett rent tal", () => {
    const f = byggFlaggor(
      {
        trappa: { antal: 1, notering: null, kalla_rad: 21 },
        produkt: { ...PRODUKT, ljusstyrka: "5500 i rubriken, 3500 i specifikationen" },
        alternativ: [ALT],
        saknade: [],
        prisbok: PRISBOK,
      },
      NU,
    );
    expect(f.find((x) => x.kod === "ljusstyrka_tvetydig")?.niva).toBe("varning");
  });

  it("varnar inte för en ljusstyrka som är ett rent tal", () => {
    const f = byggFlaggor(
      { trappa: { antal: 1, notering: null, kalla_rad: 11 }, produkt: PRODUKT, alternativ: [ALT], saknade: [], prisbok: PRISBOK },
      NU,
    );
    expect(f.some((x) => x.kod === "ljusstyrka_tvetydig")).toBe(false);
  });

  it("varnar för underlagets ålder först när giltigheten passerats", () => {
    const fars = byggFlaggor(
      { trappa: { antal: 1, notering: null, kalla_rad: 11 }, produkt: PRODUKT, alternativ: [ALT], saknade: [], prisbok: PRISBOK },
      NU, // 2 dagar gammalt
    );
    expect(fars.some((x) => x.kod === "underlagets_alder")).toBe(false);

    const gammalt = byggFlaggor(
      { trappa: { antal: 1, notering: null, kalla_rad: 11 }, produkt: PRODUKT, alternativ: [ALT], saknade: [], prisbok: PRISBOK },
      new Date(new Date(PRISBOK.importerad_at).getTime() + (GILTIGHET_DAGAR + 1) * 86_400_000),
    );
    const alder = gammalt.find((x) => x.kod === "underlagets_alder");
    expect(alder?.niva).toBe("varning");
    expect(alder?.text).toContain("saknar tryckt datum");
  });

  it("visar en prisändring som information, inte som varning", () => {
    const f = byggFlaggor(
      {
        trappa: { antal: 1, notering: null, kalla_rad: 11 },
        produkt: { ...PRODUKT, prisandring: "tidigare 415 USD (2025-11-14)" },
        alternativ: [ALT],
        saknade: [],
        prisbok: PRISBOK,
      },
      NU,
    );
    const p = f.find((x) => x.kod === "prisandring");
    expect(p?.niva).toBe("info");
    expect(p?.text).toContain("415 USD");
  });
});
