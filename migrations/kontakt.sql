-- KONTAKT-1 — tystnadsmätare och kontaktriktning per affär.
--
-- Bygger ovanpå HQ-1 och LIKVID-1. Ingenting befintligt byggs om.
-- Server-only: RLS på, ingen policy, all åtkomst via service-role bakom ägargrinden.
--
-- Kärnan: inte "när hörde vi av oss sist" utan VEM SOM HAR BOLLEN. En kund som väntar
-- på svar från oss är alltid viktigare än en uppföljning som råkar vara gammal.

-- Kontaktens e-post behövs för att matcha mot Gmail. Den fanns i MySales-svaret men
-- sparades aldrig, så kolumnen läggs till och fylls vid nästa pipeline-synk.
alter table public.hq_pipeline_cache add column if not exists epost text;
create index if not exists hq_pipeline_epost_idx on public.hq_pipeline_cache (lower(epost));

create table if not exists public.hq_kontakt_status (
  opportunity_id       text primary key,
  epost                text,
  senaste_in_datum     timestamptz,   -- senaste meddelandet FRÅN kontakten
  senaste_in_amne      text,
  senaste_ut_datum     timestamptz,   -- senaste meddelandet TILL kontakten
  senaste_ut_amne      text,
  senaste_kortandring  timestamptz,   -- aktivitet i MySales, eller ett loggat samtal
  logg_notering        text,          -- vad som sades vid det loggade samtalet
  dagar_sedan_kontakt  int,           -- härledd, sparas för sortering utan omräkning
  bollen_hos           text not null default 'okant' check (bollen_hos in ('kund','oss','okant')),
  senast_synkad        timestamptz not null default now()
);
create index if not exists hq_kontakt_bollen_idx on public.hq_kontakt_status (bollen_hos, dagar_sedan_kontakt desc);
alter table public.hq_kontakt_status enable row level security;

-- Reglerna som föder morgonlistan. Trösklarna är ägarens att ändra utan ny version.
create table if not exists public.hq_kontakt_regler (
  id            uuid primary key default gen_random_uuid(),
  regelnamn     text not null unique,
  villkor       text not null check (villkor in ('bollen_hos_oss','steg_utan_kontakt','oppen_utan_kontakt')),
  troskel_dagar int not null default 7,
  steg_namn     text,          -- används av villkoret steg_utan_kontakt
  aktiv         boolean not null default true,
  sortering     int not null default 100,
  uppdaterad    timestamptz not null default now()
);
alter table public.hq_kontakt_regler enable row level security;

insert into public.hq_kontakt_regler (regelnamn, villkor, troskel_dagar, steg_namn, sortering)
select * from (values
  ('Kunden väntar på svar',        'bollen_hos_oss',      1, null,             10),
  ('Offert utan kontakt',          'steg_utan_kontakt',   7, 'Offert skickad', 20),
  ('Affär på väg att rinna ut',    'oppen_utan_kontakt', 21, null,             30)
) as v(regelnamn, villkor, troskel_dagar, steg_namn, sortering)
where not exists (select 1 from public.hq_kontakt_regler);

notify pgrst, 'reload schema';
