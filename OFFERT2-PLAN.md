# OFFERT2-PLAN — Produktdatabasen in i Offertmotorn (O-0)

**Datum:** 2026-08-02 · **Status:** UTKAST — inväntar Håkans godkännande. **Ingen kod är ändrad, ingen migration körd.**
**Omfattning:** O-0 (denna plan). O-1/O-2/O-3 byggs först efter OK. Prompt-core och pågående KVALITET-/HANDBOK-arbete rörs inte.

---

## 1. TL;DR — tre beslut jag vill ha OK på

1. **Importera filen till egna tabeller i Supabase** — läs den inte direkt vid uppslag. Filen ligger på din dator (`C:\Users\hakan\Downloads\Prislistor\`); Vercel kan inte nå den alls. Varje importerad rad bär med sig flik, rad och källfil, så varje tal går att peka tillbaka till en cell. Filen förblir kanonisk källa och arkiveras per version.
2. **Ny tabellfamilj `offert_inkop_*` bredvid `offert_products`** — inte in i den. Den befintliga katalogen är platt (ett inpris, en frakt per produkt) och kan fysiskt inte hålla 3 kvantitetstrappor × 6 fraktsätt. Bevis finns redan i din databas, se §2.3.
3. **Tom fraktcell modelleras som frånvarande rad, inte som `NULL` i en kolumn.** Då kan koden aldrig råka läsa 0 för ett okänt fraktpris — `Number(null) === 0` i JavaScript, och den fällan är hela poängen med regeln. Samma lärdom som `null ≠ 0` från K3-INKÖP.

**Rekommenderad byggordning efter OK:** O-1 (import + uppslag, inköpssidan i USD, ingen SEK) → hårt stopp och verifiering mot filen → O-2 (påslagslagret) → O-3 (uppdateringsrutin). O-1 har värde i sig även om O-2 dröjer.

---

## 2. Kartläggning (verifierat, inte antaget)

### 2.1 Filen

Läst med openpyxl 2026-08-02. Strukturen stämmer med beskrivningen i `produktdatabas_for_offertmotorn.md` på varje punkt jag kontrollerat:

| Flik | Rubrikrader | Datarader | Kolumner |
|---|---|---|---|
| Fraktkalkyl | 1–2 | 3–26 (24 st) | A–AD (30) |
| Alla produkter | 1 | 2–17 (16 st) | A–S (19) |
| Prislistedata | 1 | 2–52 (51 st) | A–O (15) |
| Topdisplay | 1 | 2–17 | A–S (spegel av Alla produkter) |
| Läs mig | — | — | för människor |

16 unika produktnycklar i båda dataflikarna, plus 2 nycklar för kombinerad leverans som bara finns i Prislistedata.

**Trapporna som faktiskt är offererade:**
- 1 och 10 st: de fyra 500 nits-produkterna + 43″ 3500 nits med stativ
- 1 och 5 st: TOPDK-0043, TOPDK-0055, golvstativ, väggfäste
- bara 1 st: samtliga åtta utomhusprodukter

**Fraktrutnätet är mest hål.** 24 rader × 6 fraktsätt = 144 celler. **45 är ifyllda, 99 är tomma, 6 av de ifyllda är en uttrycklig nolla.** Per fraktsätt: Flyg 14, Båt 13, Lastbil 8, DHL 6, Fedex 4, **Tåg 0**. Det är alltså inte ett randfall att fraktpris saknas — det är normalfallet i två fall av tre. Motorns "fraktpris saknas, begär offert" är huvudvägen, inte undantaget.

### 2.2 Offertmotorn i Cockpit i dag

Modulen `offert` är **påslagen för Displayteknik** (`tenant_modules`, `a6a33547-…`). Vyn är `/k/offert`.

| Lager | Fil | Vad den gör |
|---|---|---|
| Sida | `app/k/offert/page.tsx` → `components/OffertClient.tsx` | Mall + katalog + offertlista |
| Katalog | `components/OffertKatalog.tsx` | CRUD + "Importera prislista" (docx/pdf → Gemini) |
| Bygg offert | `components/OffertSkapa.tsx` | Kund ur pipeline + rader + TB/marginal live + golvvarning |
| Dokument | `components/OffertDokument.tsx` | Preview + PDF; prissektionen skrivs aldrig av AI |
| Kalkyl | `lib/offert/kalkyl.ts` | `landat` / `prisFranPalagg` / `tb` / `overGolv` / `summera` |
| Valuta | `lib/offert/fx.ts` | Riksbanken SWEA, spot × 1,03, 6 h cache |
| Data | `offert_blueprint`, `offert_products`, `offert_quotes`, `offert_quote_items` | client_id-nycklade, RLS på, service-role |

`lib/inkop/` är **inte** relaterad — den är KOSTNAD-1/K3 (AI- och API-kostnader). Nya filer läggs under `lib/offert/` så namnrymderna inte krockar.

### 2.3 Bevis för att den platta modellen inte räcker

Displayteknik har redan **10 rader** i `offert_products`, alla importerade 2026-07-18 ur en Top-Display-PDF. De är i praktiken 5 produkter × 2 trappor, för att modellen inte kunde hålla trappan:

```
TOPWK-0043 | 43 inch high brightness window display | 700 USD | frakt —
TOPWK-0043 | 43 inch high brightness window display | 668 USD | frakt 138  (not: "Fraktsätt: truck DDP")
TOPWK-0055 | 55 inch high brightness window display | 835 USD | frakt —
TOPWK-0055 | 55 inch high brightness window display | 800 USD | frakt 168
TOPWK-0065 | 65 inch high brightness window display | 1380 USD | frakt —
… + golvstativ och väggfäste i samma dubblettmönster
```

Tre saker att notera, alla relevanta för migreringen:

- **Dubbletterna är oundvikliga i dagens schema.** En rad per trappa är enda sättet att få in två priser — och då är det inte längre en produktkatalog.
- **Modellnumren är fel mot den nya filen.** `TOPWK-0055` och `TOPWK-0065` finns inte; de riktiga nycklarna är `TOPDK-0055` respektive TOPDK-familjen. Slår man upp på modellnr träffar man fel produkt — precis det filen varnar för.
- **Priserna matchar inte den nya filen.** 5-styckspriset står som 668/800/1350 USD, filen säger 690/820 (och har ingen 65″ high brightness alls). De 10 raderna kommer ur en **äldre eller annan prislista**. Jag har inte kunnat härleda vilken, så jag ändrar dem inte — se öppen fråga 1.

`offert_quotes` är **tom för samtliga klienter**. Ingen offert har sparats i produktion ännu, så det finns inga historiska rader vars kostnad skulle bli fel av en omläggning. Det gör tidpunkten ovanligt billig.

### 2.4 Var offerter byggs i övrigt (så att inget byggs dubbelt)

Tre motorer existerar parallellt. Detta bygge rör **bara nummer 1**:

1. **Cockpit `/k/offert`** — generisk, branschoberoende, `offert_*`-tabeller, klientnycklad. Aktiv för DT. **Här bygger vi.**
2. **mysales-coach standalone Offertmotorn** — DT-låst, `om_*`-tabeller, Nonbye-mall, GHL-uppföljningsloop. Rörs inte. Ligger kvar som fungerande väg.
3. **supplier-quotes-portalen** — leverantörsoffert via WhatsApp-parser, egen sajt. Rörs inte.

Inköpsdatabasen hör hemma i 1, eftersom det är den motor som har produktkatalog, valutakurs och kalkyl på plats. Får den trappor och fraktsätt blir den också den enda av de tre som kan räkna en landad kostnad korrekt.

---

## 3. Beslut: lagring — importera eller läsa filen direkt

| | Läsa `.xlsx` direkt vid uppslag | **Importera till Supabase (rekommenderas)** |
|---|---|---|
| Går det alls i produktion? | Nej. Filen ligger på din dator. Kräver att den laddas upp till Storage och parsas per anrop. | Ja. |
| Uppslagstid | Hela filen (≈36 kB zip, ~5 000 celler) tolkas per förfrågan | Indexerad SELECT |
| Versionshantering | Filen är versionen — enkelt | Prisbok per import + originalfilen arkiverad = samma spårbarhet, plus prishistorik som går att fråga |
| Spårbarhet till cell | Naturlig | Bevaras: varje rad bär flik + radnummer + källfil |
| Filen uppdateras under drift | Halvläst fil mitt i ett uppslag | Ny prisbok skrivs klart, byter sedan aktiv-flagga (atomiskt) |
| Kostnad | Ingen ny tabell | 5 tabeller + en importrutin |

**Rekommendation: importera.** Motiveringen som väger tyngst är inte prestanda utan att filen fysiskt inte är nåbar från Vercel, samt att kravet "motorn ska tåla att filen uppdateras under drift" bara går att uppfylla rent med en aktiv-flagga över en färdigskriven prisbok.

Invändningen i uppgiften — att xlsx som källa gör versionshantering enklare — löses genom att **behålla xlsx som kanonisk källa**: varje import laddar upp originalfilen till Storage med sin sha256, och prisboken pekar på den. Filen är fortfarande facit; databasen är bara ett läsbart index över den.

**Beroende som behövs:** en xlsx-läsare. Repot har `mammoth` (docx) men ingen xlsx-parser. Jag föreslår **`exceljs`** (underhållet på npm). Jag avråder från npm-paketet `xlsx` — SheetJS distribuerar inte längre via npm och versionen som ligger där är gammal. Alternativet utan nytt beroende är att jag genererar en seed vid varje prisuppdatering, men då kan du inte uppdatera själv, och det är fel riktning. **Beslut behövs (öppen fråga 3).**

---

## 4. Föreslagen datamodell

Namnrymd `offert_inkop_*`. Alla tabeller `client_id`-nycklade mot `clients(id)`, RLS på, åtkomst via service-role i app-lagret precis som övriga `offert_*`. Leverantörsagnostisk från början: `leverantor` är en kolumn, aldrig en tabellstruktur.

```sql
-- 1. Prisbok = en import = en version av filen.
create table public.offert_inkop_prisbok (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  kallfil text not null,              -- 'produktdatabas.xlsx'
  kallfil_sha256 text not null,       -- identifierar exakt filversion
  storage_path text,                  -- arkiverat original
  importerad_at timestamptz not null default now(),
  aktiv boolean not null default false,
  radantal jsonb,                     -- {"fraktkalkyl":24,"produkter":16,"prislistedata":51}
  notering text
);
-- Bara en aktiv prisbok per klient. Byte = en UPDATE, aldrig ett halvläst tillstånd.
create unique index offert_inkop_prisbok_aktiv on public.offert_inkop_prisbok(client_id) where aktiv;

-- 2. Produktregistret (fliken Alla produkter).
create table public.offert_inkop_produkt (
  id uuid primary key default gen_random_uuid(),
  prisbok_id uuid not null references public.offert_inkop_prisbok(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  produktnyckel text not null,        -- PRIMÄRNYCKELN. Aldrig modellnr.
  leverantor text not null,
  modellnr text,                      -- får finnas i dubblett, används aldrig för uppslag
  produktnamn text not null,
  produkttyp text,
  storlek text,                       -- text: tum i dag, pixel pitch i morgon
  ljusstyrka text,                    -- text: "5500 i rubriken, 3500 i specifikationen" är ett giltigt värde
  miljo text,                         -- "Utomhus, IP67"
  ledtid text,
  moq integer,
  garanti text,                       -- NY kolumn (O-3). Tom tills filen har den.
  prislista_datum date,               -- tom överallt i dag
  prisandring text,
  senast_uppdaterad date,
  kallfil text,
  kalla_rad integer not null,         -- radnummer i fliken
  unique (prisbok_id, produktnyckel)
);
```

**Kolumn I/J/K/L i Alla produkter (lägsta pris, billigaste fraktsätt, vid antal) importeras inte.** De är formler över Fraktkalkyl, och lagrade blir de en andra sanning som kan gå isär med trapporna. De räknas fram vid uppslag ur trapporna i stället. Bieffekt: problemet med texten "Frakt ej ifylld" i en numerisk kolumn uppstår aldrig — den saknade frakten uttrycks som frånvaro av fraktrader.

```sql
-- 3. Kvantitetstrappa: en rad per (produkt, antal). Fliken Fraktkalkyl, kolumn A–F.
create table public.offert_inkop_trappa (
  id uuid primary key default gen_random_uuid(),
  prisbok_id uuid not null references public.offert_inkop_prisbok(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  produktnyckel text not null,
  antal integer not null,
  exw_styck numeric not null,         -- kolumn E, alltid ifylld
  valuta text not null default 'USD',
  incoterm text not null default 'EXW Shenzhen',
  ledtid text,
  prislista_datum date,
  kallfil text,
  notering text,                      -- kolumn AD, avvikelsetexten för just den raden
  kalla_rad integer not null,
  unique (prisbok_id, produktnyckel, antal)
);

-- 4. ★ Frakt: EN RAD PER OFFERERAT FRAKTSÄTT. Tom cell = ingen rad.
create table public.offert_inkop_frakt (
  id uuid primary key default gen_random_uuid(),
  trappa_id uuid not null references public.offert_inkop_trappa(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  fraktsatt text not null check (fraktsatt in ('bat','tag','lastbil','flyg','dhl','fedex')),
  frakt_styck numeric not null,       -- NOT NULL: en nolla är ett pris, en tom cell finns inte
  kalla_kolumn text not null,         -- 'G'..'L' — pekar ut cellen
  unique (trappa_id, fraktsatt)
);

-- 5. Revisionsspår 1:1 med fliken Prislistedata, inkl. de två kombinerade leveranserna.
create table public.offert_inkop_prislistedata (
  id uuid primary key default gen_random_uuid(),
  prisbok_id uuid not null references public.offert_inkop_prisbok(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  produktnyckel text not null,
  leverantor text, modellnr text, produkt text,
  antal integer,
  fraktsatt_leverantor text,          -- leverantörens egna ord: "Sjöfrakt DDP"
  fraktsatt text,                     -- normaliserat, null om raden saknar fraktsätt
  exw_styck numeric, exw_totalt numeric,
  frakt_styck numeric, frakt_totalt numeric,
  totalt_order numeric, prislistans_total numeric,
  kontroll text,                      -- 'OK' | 'Prislistans total avser EXW utan frakt' | …
  kallfil text, notering text,
  kalla_rad integer not null
);
```

**Prislistedata skrivs bara av importen.** Ingen route rör tabellen efter det. Förbudet ligger i att ingen skrivväg byggs, inte i en kommentar.

### Varför inte sex nullbara fraktkolumner på trappan

Det vore färre tabeller, men `Number(null)` är `0` i JavaScript och `coalesce(frakt_bat, 0)` är en rimlig SQL-reflex. Två tecken skiljer "okänt" från "gratis", och felet syns inte i en offert förrän marginalen är uppäten. Med en rad per offererat fraktsätt är "saknas" frånvaro av data, och `not null` gör att en tom cell inte kan smyga in som nolla ens vid en slarvig import. Regeln bor i schemat i stället för i disciplin.

---

## 5. O-1: uppslaget och var det hakar i

### 5.1 Nytt bibliotek

**`lib/offert/inkopsdata.ts`** (server-only, service-role) blir **enda vägen** in i prisboken — samma princip som `lib/inkop/index.ts` har i K3. Både katalogvyn och offertbyggaren går genom den, så de kan aldrig räkna olika.

```ts
export interface Fraktalternativ {
  fraktsatt: 'bat'|'tag'|'lastbil'|'flyg'|'dhl'|'fedex';
  frakt_styck: number;          // finns bara när leverantören offererat
  landat_styck: number;         // exw_styck + frakt_styck
  landat_order: number;         // antal × landat_styck
  kalla: string;                // "Fraktkalkyl!G11"
}

export interface Uppslag {
  produkt: Produkt;
  antal: number;
  exw_styck: number;
  valuta: 'USD';
  alternativ: Fraktalternativ[];        // BARA offererade
  saknade: Fraktsatt[];                 // resten — presenteras som "begär offert", aldrig som tal
  billigast: Fraktalternativ | null;    // null när inget fraktsätt är offererat
  flaggor: Flagga[];
  trappor: number[];                    // alla offererade antal för produkten
}

// Antal som inte är en offererad trappa → { typ: 'trappa_saknas', trappor: [1,5] }. Aldrig en uträkning.
export async function slaUpp(clientId: string, produktnyckel: string, antal: number): Promise<Uppslag | TrappaSaknas>
export async function sokProdukter(clientId: string, q: string, filter?: {miljo?, storlek?, ljusstyrka?}): Promise<Produkt[]>
```

### 5.2 Flaggor — härledda, inte hårdkodade

Avvikelserna 1–7 ligger redan i filen (notkolumnen per rad, ljusstyrketexten, kontrollkolumnen, tomma datum). Därför byggs **ingen avvikelsetabell**; `flaggor()` härleder dem vid uppslag och de följer automatiskt med när filen uppdateras:

| Flagga | Utlöses av | Nivå |
|---|---|---|
| Fraktpris saknas | inga rader i `offert_inkop_frakt` för valt fraktsätt | blockerande för det fraktsättet |
| Ingen frakt alls offererad | `alternativ.length === 0` (de fyra 65/86″) | blockerande — hänvisa till kombinerad leverans i Prislistedata |
| Trappa saknas | begärt antal finns inte | blockerande |
| Leverantörsnot på raden | `trappa.notering` ej tom (t.ex. omkastad frakt, avvikelse 1) | varning — bekräfta med leverantören |
| Ljusstyrka tvetydig | `ljusstyrka` innehåller icke-numerisk text (avvikelse 4) | varning |
| Underlagets ålder | prislistans datum saknas + 15 dagars giltighet i alla sex listor | varning, se nedan |
| Priset rörde sig nyss | `prisandring` ej tom | information |

**Åldersvarningen behöver ett datum som filen inte har.** Prislistans datum är tomt överallt (avvikelse 6). Jag använder `prisbok.importerad_at` som konservativ nedre gräns och skriver ut vad varningen bygger på: *"Underlaget importerades 2026-08-02. Prislistorna anger 15 dagars giltighet men saknar tryckt datum — begär bekräftelse innan bindande offert."* Ingen påhittad giltighetsberäkning på ett datum som inte finns.

### 5.3 Var i offertflödet

**Katalogvyn (`OffertKatalog.tsx`)** får en andra sektion: *"Inköpsdatabas (Topdisplay)"* — skrivskyddad lista över de 16 produkterna med trappor, ifyllda fraktsätt och landad kostnad i USD. `offert_products` blir kvar orörd för manuellt inlagda produkter och andra leverantörer. Två källor sida vid sida, tydligt märkta.

**Offertbyggaren (`OffertSkapa.tsx`)** — radväljaren får ett tredje val vid sidan av "Ur katalog" och "Fri rad": **"Ur inköpsdatabasen"**. Flödet:

1. sök/välj produkt (matchar på storlek, ljusstyrka, inne/ute — precis stegen i uppgiftens steg 1)
2. välj **antal** ur de offererade trapporna. Skriver du ett annat antal: *"Offererat: 1 eller 5 st. Priset räknas inte om — både produktpris och frakt ändras med volymen. Välj en trappa eller begär ny offert."* Ingen interpolering.
3. välj **fraktsätt**. De sex visas alltid; de utan offert är gråa och märkta *"Fraktpris saknas — begär offert"*. De går inte att välja. Billigaste offererade är förvalt.
4. raden läggs till med `cost` = landad kostnad, källhänvisning synlig, och de flaggor som gäller.

**Radmodellen** (`offert_quote_items`) utökas med `inkop_trappa_id uuid`, `fraktsatt text`, `priskedja jsonb`. Kedjan fryses vid sparning så en offert kan förklaras även efter att prisboken bytts.

**Utan O-2 är `cost` i USD.** Fram till påslagslagret är klart visar byggaren landad kostnad i USD med en tydlig markering att svenskt pris inte är framräknat, och `unit_price` sätts för hand. Så bryter O-1 ingenting och kan levereras ensamt.

### 5.4 Nya routes

| Route | Metod | Vad |
|---|---|---|
| `/api/offert/inkop/import` | POST (multipart xlsx) | Ny prisbok. **Admin-grind** (`requireAdmin`), inte kund. |
| `/api/offert/inkop/produkter` | GET `?q=&miljo=&storlek=` | Sök i aktiv prisbok |
| `/api/offert/inkop/uppslag` | GET `?nyckel=&antal=` | Ett `Uppslag` enligt §5.1 |
| `/api/offert/inkop/prisbok` | GET | Versioner, aktiv, radantal, importdatum |

### 5.5 DoD O-1

- Godtycklig produkt + trappa ger landad kostnad per styck och för ordern i USD, med källhänvisning på formen `Fraktkalkyl!M11`.
- Saknad frakt ger *"fraktpris saknas, begär offert"* — aldrig ett tal, aldrig 0.
- Okänt antal ger trappförslag — aldrig en uträkning.
- Importen är idempotent: samma fil två gånger ger samma prisbok (sha256), inte dubbletter.
- Test `tests/offert2-inkopsdata.test.ts` mot en fixtur av den riktiga filen. Minst: de 6 nollorna läses som 0, de 99 tomma som saknade, TOPWK-0043 träffar tre olika produkter på nyckel men aldrig på modellnr, de fyra 65/86″ ger "ingen frakt offererad", 43″ med stativ bär avvikelse 1 som varning.

---

## 6. O-2: påslagslagret (svenskt pris)

Byggs efter O-1 och efter separat OK. Skiss så att du kan säga ja eller nej till principen nu.

### 6.1 Konfiguration (tre små tabeller, alla klientnycklade)

```sql
-- Låst växelkurs, med datum och vem som satte den.
create table public.offert_kurs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  valuta text not null,               -- 'USD'
  kurs numeric not null,              -- SEK per enhet
  buffert numeric not null default 1.03,
  kalla text not null,                -- 'riksbanken' | 'manuell'
  satt_datum date not null,
  aktiv boolean not null default true
);

-- Marginalregel per produktkategori. Ingen kategori = default.
create table public.offert_paslag (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  kategori text,                      -- null = gäller allt som inte har egen regel
  marginal_pct numeric not null,
  avrundning text not null default 'narmaste_100',  -- 'ingen'|'narmaste_100'|'narmaste_500'|'slutar_pa_900'
  aktiv boolean not null default true
);

-- Fasta kostnader: installation, inrikesfrakt, tull.
create table public.offert_fast_kostnad (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  namn text not null,
  typ text not null check (typ in ('per_styck','per_order','procent_av_landat')),
  belopp numeric not null,
  aktiv boolean not null default true
);
```

Moms hör inte hemma här. B2B-offerter anges ex moms; momsen läggs på som egen rad sist i dokumentet och påverkar aldrig marginalen.

### 6.2 Kedjan är själva leveransen

`lib/offert/paslag.ts` — ren, testbar funktion utan databasanrop. Den returnerar inte ett pris, den returnerar **kedjan**, och priset är sista steget.

Exempel på formen. De två översta raderna är riktiga värden ur filen (TOPDK-0043, 1 st, Båt). **Kurs och påslag nedan är illustrativa** — de sätts av dig i §6.1, jag hittar inte på dem:

```
EXW/st                          700 USD    Fraktkalkyl!E11
Frakt/st (Båt)                  340 USD    Fraktkalkyl!G11
= Landat/st                   1 040 USD    Fraktkalkyl!M11
Kurs USD→SEK                   [ej satt]   Riksbanken-spot × 1,03, låses av dig med datum
= Landat/st                       … SEK
Påslag % (High brightness)     [ej satt]
Installation (per styck)       [ej satt]
Inrikesfrakt (per order)       [ej satt]
Tull                           [ej satt]
Avrundning, närmaste 100              …
= Listpris/st ex moms             … SEK
```

Varje steg bär källa. Steg utan konfigurerat värde skrivs som `[ej satt]` — inte som 0 — och offerten flaggas som ofullständig tills du fyllt i eller uttryckligen kryssat "gäller inte".

**Ingen offert går till kund utan att kedjan visats.** Konkret: knappen "Skapa offertdokument" är låst tills kedjan är öppnad och kvitterad för offerten. Kedjan sparas som `priskedja` på raden så att en gammal offert kan förklaras även efter en prisuppdatering.

### 6.3 Vad jag behöver av dig för att O-2 ska ge riktiga tal

Marginalprocent per kategori, installationskostnad, inrikesfrakt, och om tull ska räknas alls. Jag fyller inte i platshållarsiffror som ser ut som beslut. Tills fälten är satta räknar lagret vidare och markerar de tomma stegen.

---

## 7. O-3: uppdateringsrutin och fler leverantörer

- **Ny prislista:** PDF/bild läggs i `Prislistor` → filen uppdateras (samma rutin som byggde den) → du drar in nya `produktdatabas.xlsx` i importvyn → **ny prisbok** skrivs klart → aktiv-flaggan byter. Ingen halvläst fil kan träffa ett uppslag. Gamla prisböcker ligger kvar; sparade offerter pekar på den prisbok de prissattes ur.
- **Prishistorik faller ut gratis.** Två prisböcker över samma produktnyckel går att jämföra i SQL. Importvyn kan visa "TOPDK-0043 5 st: 690 → 668 USD sedan förra importen" utan att kolumnen Prisändring behöver läsas.
- **Källfilerna rörs aldrig.** Importen läser; den skriver bara till Supabase.
- **Leverantörsagnostiskt från dag ett:** `leverantor` är kolumn, produktnyckeln är primärnyckel, en leverantörsflik i filen blir inte en tabell utan bara fler rader. Fabulux kräver ingen schemaändring.
- **Garanti** läggs till som kolumn nu (§4) och fylls när filen fått den. 2 år för 500 nits, 3 år för high brightness 43/55″, 2 år för utomhus — men de siffrorna ska in i **filen**, inte hårdkodas i motorn.

---

## 8. Hårda regler som byggs in

| Regel | Var den lever |
|---|---|
| Skriv aldrig till Prislistedata | ingen skrivväg byggs efter importen |
| Tom fraktcell är aldrig 0 | `not null` + rad-per-offererat-fraktsätt (§4) |
| Ingen interpolering till annat antal | `slaUpp` returnerar `TrappaSaknas`, aldrig ett räknat pris |
| Modellnr är inte unikt | alla uppslag går på `produktnyckel`; `modellnr` är visningsfält |
| Ingen SEK ur denna fil ensam | O-1 arbetar i USD; SEK kräver `offert_kurs` + `offert_paslag` |
| Inget tal utan cell | varje steg i kedjan bär källa; steg utan värde skrivs `[ej satt]` |

---

## 9. Byggordning och stopp

| Steg | Innehåll | Stopp |
|---|---|---|
| **O-0** | denna plan | **här** — inväntar OK |
| O-1a | migration (5 tabeller) + `lib/offert/xlsx-import.ts` + importroute + test mot riktig fil | verifiering mot filen redovisas |
| O-1b | `lib/offert/inkopsdata.ts` + uppslagsroutes + test | hårt stopp |
| O-1c | UI: inköpsdatabas i katalogvyn + "Ur inköpsdatabasen" i byggaren | hårt stopp, du testar |
| O-2a | tre konfigtabeller + `lib/offert/paslag.ts` + test på kedjan | hårt stopp |
| O-2b | UI: påslagsinställningar + kedjevyn + låsning av dokumentknappen | hårt stopp |
| O-3 | prisbokshistorik, jämförelsevy, garanti-kolumn | — |

Atomära ändringar, en verifiering per steg. Ingen deploy utan att du sagt till.

---

## 10. Öppna frågor (tre, med standardval)

1. **De 10 gamla raderna i `offert_products`** (§2.3) — priser och modellnr matchar inte den nya filen och källan går inte att härleda. Ta bort dem, eller låta dem ligga kvar märkta "äldre underlag"? *Om du inte vet: låt dem ligga, men märk dem — inget är förlorat och inköpsdatabasen är ändå den nya vägen.*
2. **Avvikelse 1 (43″ med stativ: båt 1050 vs flyg 300 vid 1 st)** — ska motorn spärra den produkten helt tills Sam bekräftat, eller släppa igenom med varning? *Om du inte vet: varning, inte spärr — värdena är avlästa korrekt och du ser flaggan innan du skickar.*
3. **`exceljs` som nytt beroende** (§3) — ja eller nej? *Om du inte vet: ja. Utan det kan du inte uppdatera prisboken själv.*

## 11. Antaganden

- Bygget sker i Cockpit `/k/offert` för Displayteknik. De andra två offertmotorerna rörs inte.
- Filen ligger kvar i `Prislistor` och laddas upp manuellt vid varje uppdatering — ingen automatisk mappbevakning (den skulle kräva något som körs på din dator).
- Alla belopp i filen är USD, EXW Shenzhen. Jag tolkar inga siffror som SEK.
- Inköpsdata är intern. Den syns i offertbyggaren men aldrig i det genererade kunddokumentet.

## 12. Risker

| Risk | Följd | Motmedel |
|---|---|---|
| Ett tomt fraktpris läses som 0 | offert med uppäten marginal, upptäcks vid faktura | schemat gör det omöjligt (§4) + test |
| Uppslag på modellnr | fel produkt i offert (TOPWK-0043 = tre produkter) | modellnr är visningsfält, aldrig sökväg |
| Prisboken byts mitt i ett offertbygge | rad prissatt ur en version, rad ur en annan | `inkop_trappa_id` + fryst `priskedja` per rad |
| Fem sjättedelar av utomhussortimentet saknar frakt | motorn känns trasig när den mest säger "begär offert" | UI:t säger vad som saknas och vad man ska fråga Sam om — inte bara att det saknas |
| O-2 med tomma fasta kostnader | listpris som ser färdigt ut men saknar installation | `[ej satt]` + offerten märks ofullständig |
