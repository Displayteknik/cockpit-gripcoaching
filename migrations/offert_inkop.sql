-- OFFERT-2 / O-1a: inköpsdatabasen (leverantörsprislistor med kvantitetstrappor och fraktsätt).
-- Cockpit-native (client_id = clients.id), RLS på, all åtkomst via service-role i app-lagret.
-- Ligger BREDVID offert_products — den platta katalogen rörs inte.
--
-- ★ KÄRNREGEL I SCHEMAT: en tom fraktcell i källfilen blir en FRÅNVARANDE RAD i
--   offert_inkop_frakt, aldrig NULL i en kolumn. Number(null) === 0 i JavaScript, och en
--   nolla betyder "leverantören offererade fraktsättet gratis" medan tomt betyder "priset är
--   okänt". Två tecken skiljer dem åt i kod; i schemat är skillnaden absolut.

-- 1. Prisbok = en import = en version av källfilen.
create table if not exists public.offert_inkop_prisbok (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  kallfil text not null,
  kallfil_sha256 text not null,
  storage_path text,
  importerad_at timestamptz not null default now(),
  aktiv boolean not null default false,
  radantal jsonb,
  notering text
);
create index if not exists offert_inkop_prisbok_client on public.offert_inkop_prisbok(client_id, importerad_at desc);
-- Högst en aktiv prisbok per klient. Byte av aktiv version är då en enda UPDATE — en halvskriven
-- import kan aldrig träffa ett uppslag.
create unique index if not exists offert_inkop_prisbok_aktiv on public.offert_inkop_prisbok(client_id) where aktiv;
-- Samma fil två gånger ska inte ge två prisböcker.
create unique index if not exists offert_inkop_prisbok_sha on public.offert_inkop_prisbok(client_id, kallfil_sha256);
alter table public.offert_inkop_prisbok enable row level security;

-- 2. Produktregistret (fliken "Alla produkter").
-- Kolumn I/J/K/L (lägsta pris, billigaste fraktsätt, vid antal) importeras medvetet INTE — de är
-- formler över Fraktkalkyl och skulle bli en andra sanning. De räknas fram ur trapporna vid uppslag.
create table if not exists public.offert_inkop_produkt (
  id uuid primary key default gen_random_uuid(),
  prisbok_id uuid not null references public.offert_inkop_prisbok(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  produktnyckel text not null,
  leverantor text not null,
  modellnr text,
  produktnamn text not null,
  produkttyp text,
  storlek text,
  ljusstyrka text,
  miljo text,
  ledtid text,
  moq integer,
  garanti text,
  prislista_datum date,
  prisandring text,
  senast_uppdaterad date,
  kallfil text,
  kalla_rad integer not null,
  unique (prisbok_id, produktnyckel)
);
create index if not exists offert_inkop_produkt_client on public.offert_inkop_produkt(client_id, prisbok_id);
alter table public.offert_inkop_produkt enable row level security;

-- 3. Kvantitetstrappa: en rad per (produkt, antal). Fliken Fraktkalkyl, kolumn A–F + AA–AD.
create table if not exists public.offert_inkop_trappa (
  id uuid primary key default gen_random_uuid(),
  prisbok_id uuid not null references public.offert_inkop_prisbok(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  produktnyckel text not null,
  modellnr text,
  produkt text,
  antal integer not null check (antal > 0),
  exw_styck numeric not null,
  valuta text not null default 'USD',
  incoterm text not null default 'EXW Shenzhen',
  ledtid text,
  prislista_datum date,
  kallfil text,
  notering text,
  kalla_rad integer not null,
  unique (prisbok_id, produktnyckel, antal)
);
create index if not exists offert_inkop_trappa_client on public.offert_inkop_trappa(client_id, prisbok_id, produktnyckel);
alter table public.offert_inkop_trappa enable row level security;

-- 4. ★ Frakt: EN RAD PER OFFERERAT FRAKTSÄTT. Tom cell i källan = ingen rad här.
create table if not exists public.offert_inkop_frakt (
  id uuid primary key default gen_random_uuid(),
  trappa_id uuid not null references public.offert_inkop_trappa(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  fraktsatt text not null check (fraktsatt in ('bat','tag','lastbil','flyg','dhl','fedex')),
  frakt_styck numeric not null check (frakt_styck >= 0),
  kalla_kolumn text not null,
  unique (trappa_id, fraktsatt)
);
create index if not exists offert_inkop_frakt_client on public.offert_inkop_frakt(client_id);
alter table public.offert_inkop_frakt enable row level security;

-- 5. Revisionsspår, 1:1 med fliken Prislistedata (inkl. raderna "Kombinerad leverans").
-- Skrivs BARA av importen. Ingen route rör tabellen efteråt — förbudet ligger i att ingen
-- skrivväg byggs, inte i en kommentar.
create table if not exists public.offert_inkop_prislistedata (
  id uuid primary key default gen_random_uuid(),
  prisbok_id uuid not null references public.offert_inkop_prisbok(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  produktnyckel text not null,
  leverantor text,
  modellnr text,
  produkt text,
  antal integer,
  fraktsatt_leverantor text,
  fraktsatt text,
  exw_styck numeric,
  exw_totalt numeric,
  frakt_styck numeric,
  frakt_totalt numeric,
  totalt_order numeric,
  prislistans_total numeric,
  kontroll text,
  kallfil text,
  notering text,
  kalla_rad integer not null
);
create index if not exists offert_inkop_prislistedata_client on public.offert_inkop_prislistedata(client_id, prisbok_id, produktnyckel);
alter table public.offert_inkop_prislistedata enable row level security;

-- 6. Offertraden ska kunna peka tillbaka på exakt trappa + fraktsätt, och bära sin priskedja
-- fryst (så en gammal offert går att förklara även efter att prisboken bytts — O-2).
alter table public.offert_quote_items add column if not exists inkop_trappa_id uuid;
alter table public.offert_quote_items add column if not exists fraktsatt text;
alter table public.offert_quote_items add column if not exists priskedja jsonb;

notify pgrst, 'reload schema';
