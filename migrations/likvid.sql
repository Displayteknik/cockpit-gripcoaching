-- LIKVID-1 — betalstatus per affär och likviditetsprognos i Founder HQ.
--
-- Bygger OVANPÅ HQ-1. Inget av det som redan finns byggs om: hq_pipeline_cache är
-- fortfarande spegeln av MySales, hq_fasta_kostnader är fortfarande bolagskostnaderna
-- och hq_tasks matar fortfarande morgonlistan.
--
-- Samma mönster som resten av HQ: RLS på, INGEN policy. Anon-nyckeln ser noll rader.
-- All åtkomst går via service-role i /api/hq, som grindas på huvudadmin.
--
-- ⚠ Betalstatusen ligger HÄR och inte i GHL:s anpassade fält. Behörigheten fanns:
-- PIT:en kunde både skapa fält på opportunity-modellen (201) och skriva värden (200).
-- Provkörningen 2026-08-02 visade tre saker som avgjorde:
--   1. Ett skrivet värde går INTE att radera. customFields: [], field_value null, tom
--      sträng och 0 svarar alla 200 och lämnar värdet orört. Ett felskrivet fakturabelopp
--      hade bara gått att skriva över, aldrig ta bort.
--   2. Värdet överlever att fältet raderas och ligger kvar som föräldralöst i API-svaret.
--   3. Bulkläsningen är eftersläpande: värdet saknades i /opportunities/search direkt
--      efter skrivningen och dök upp först senare, i ett annat format än enskild-hämtningen.
-- Till det: HQ skriver ALDRIG till MySales. Med fälten i GHL hade betalstatusen behövt
-- underhållas i GHL:s eget gränssnitt, och redigering i HQ:s DT-tabell hade krävt just
-- de skrivningar som är uteslutna. Valet är reversibelt: skulle fälten ändå önskas kan
-- den här tabellen fyllas ur dem utan att prognosen ändras.

-- ── 1. Betalstatus per affär ───────────────────────────────────────────────
-- Nyckeln är GHL:s opportunity-id, samma nyckel som hq_pipeline_cache. Ingen främmande
-- nyckel: spegeln töms och fylls om vid varje synk, och en affär som försvinner ur
-- MySales ska inte ta ägarens fakturauppgifter med sig i fallet.
--
-- "Kvar att fakturera" lagras ALDRIG. Den räknas alltid som affärens belopp minus
-- fakturerat, så att två fält inte kan säga emot varandra.
create table if not exists public.hq_deal_finance (
  opportunity_id        text primary key,
  fakturerat            numeric not null default 0,
  betalt                numeric not null default 0,
  forvantat_betaldatum  date,                    -- null = odaterad, räknas INTE i prognosen
  forfallodatum         date,
  notering              text,
  skapad                timestamptz not null default now(),
  uppdaterad            timestamptz not null default now()
);
alter table public.hq_deal_finance enable row level security;

-- ── 2. Banksaldo, manuell inmatning ────────────────────────────────────────
-- Senaste raden per bolag gäller. Historiken sparas, så det går att se när saldot
-- lästes av och hur det rört sig. Ingen bankkoppling, ingen automatik.
create table if not exists public.hq_bank_saldo (
  id        uuid primary key default gen_random_uuid(),
  bolag     text not null check (bolag in ('grip','dt')),
  saldo     numeric not null,
  datum     date not null,
  notering  text,
  skapad    timestamptz not null default now()
);
create index if not exists hq_bank_saldo_idx on public.hq_bank_saldo (bolag, datum desc, skapad desc);
alter table public.hq_bank_saldo enable row level security;

-- ── 3. Kända in- och utbetalningar ─────────────────────────────────────────
-- Positivt belopp = pengar in, negativt = pengar ut. Moms och skatt läggs in HÄR av
-- ägaren. Det finns med flit ingen automatisk momsberäkning i v1: en schablon som är
-- fel är sämre än en rad som saknas och syns att den saknas.
create table if not exists public.hq_cash_items (
  id        uuid primary key default gen_random_uuid(),
  bolag     text not null check (bolag in ('grip','dt')),
  titel     text not null,
  belopp    numeric not null,
  datum     date not null,
  typ       text not null default 'ovrigt'
            check (typ in ('leverantorsbetalning','moms','skatt','inkasso','lan','ovrigt')),
  status    text not null default 'planerad' check (status in ('planerad','klar')),
  notering  text,
  skapad    timestamptz not null default now(),
  uppdaterad timestamptz not null default now()
);
create index if not exists hq_cash_items_idx on public.hq_cash_items (bolag, datum);
alter table public.hq_cash_items enable row level security;

-- ── 4. Inställningar per bolag ─────────────────────────────────────────────
-- usd_kurs ligger här och inte i koden: en växelkurs ändras, en deploy ska inte behövas
-- för att rätta den. Kursen VISAS i vyn, så det aldrig är oklart vad omräkningen bygger på.
create table if not exists public.hq_likvid_konfig (
  bolag             text primary key check (bolag in ('grip','dt')),
  buffertmal        numeric not null default 0,
  gul_grans_veckor  int not null default 4,
  usd_kurs          numeric not null default 11.0,
  notering          text,
  uppdaterad        timestamptz not null default now()
);
alter table public.hq_likvid_konfig enable row level security;

insert into public.hq_likvid_konfig (bolag, buffertmal, gul_grans_veckor, usd_kurs, notering)
values
  ('grip', 0, 4, 11.0, 'buffertmål 0 tills du satt ditt eget, då larmar bara rött läge'),
  ('dt',   0, 4, 11.0, 'buffertmål 0 tills du satt ditt eget, då larmar bara rött läge')
on conflict (bolag) do nothing;

-- ── 5. Sannolikhet per steg ────────────────────────────────────────────────
-- Viktningen i "I spel, ofakturerat" och i prognosens kundinbetalningar måste bygga på
-- en siffra per steg. Den siffran får inte vara påhittad i kod utan att synas, därför
-- ligger den i en tabell som ägaren kan ändra. Raderna fylls på vid synk med en
-- utgångspunkt räknad ur stegets plats i pipelinen (se standardSannolikhet i
-- lib/hq/likviditet.ts). En rad som ägaren rört skrivs ALDRIG över av synken.
create table if not exists public.hq_steg_sannolikhet (
  steg_id      text primary key,
  pipeline_id  text,
  steg_namn    text,
  position     int,
  procent      int not null default 50 check (procent between 0 and 100),
  agarsatt     boolean not null default false,
  uppdaterad   timestamptz not null default now()
);
alter table public.hq_steg_sannolikhet enable row level security;

notify pgrst, 'reload schema';
