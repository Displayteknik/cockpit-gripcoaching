-- PLAN-1 — planeringsmodulen i Founder HQ (/dashboard/hq/planering).
--
-- Bygger ovanpå HQ-1. Ingenting befintligt byggs om.
-- Alla tabeller server-only: RLS på, INGEN policy, all åtkomst via service-role bakom
-- ägargrinden i /api/hq/planering. Samma mönster som hq.sql och likvid.sql.
--
-- Modellen: tisdag och torsdag är arbetsdagar, resten white space. Vyn ska visa hur
-- veckan FAKTISKT ligger mot den modellen, inte tvinga fram fler fält att fylla i.

-- ── 1. Ägarens Google-koppling ─────────────────────────────────────────────
-- EGEN koppling, skild från den klientdelade google_connections. Skälet: den delade
-- SCOPES-listan i lib/google.ts gäller varje klient som kopplar Search Console. Lägger
-- man kalender där skulle VARJE klient få frågan om kalenderåtkomst. Ägarens kalender
-- är ägarens ensak, alltså egen rad, eget scope, egen livscykel.
-- En enda rad (id = 1). Tokens lämnar aldrig servern.
create table if not exists public.hq_google_koppling (
  id              int primary key default 1 check (id = 1),
  email           text,
  kalender_id     text not null default 'primary',
  access_token    text,
  refresh_token   text,
  expires_at      timestamptz,
  scopes          text,
  ansluten        timestamptz,
  uppdaterad      timestamptz not null default now()
);
alter table public.hq_google_koppling enable row level security;

-- ── 2. Tidstyper ───────────────────────────────────────────────────────────
create table if not exists public.hq_tidstyper (
  id          uuid primary key default gen_random_uuid(),
  namn        text not null unique,
  farg_ramp   text not null,
  nyckelord   text[] not null default '{}',
  sortering   int not null default 100
);
alter table public.hq_tidstyper enable row level security;

-- ── 3. Spegel av Google Kalender (READ-mostly) ─────────────────────────────
-- Fylls av /api/hq/planering. Ägaren skriver aldrig direkt hit: en ändring går till
-- Google först och speglas sedan, annars kan vyn visa något kalendern inte har.
-- ⚠ Heldagshändelser har inget klockslag (start.date, inte start.dateTime) och kan inte
-- ritas på tidsaxeln. De bär heldag = true och renderas som egen rad överst i dagen.
create table if not exists public.hq_kalender_cache (
  google_event_id   text primary key,
  kalender_id       text not null default 'primary',
  titel             text,
  beskrivning       text,
  plats             text,
  start_tid         timestamptz,
  slut_tid          timestamptz,
  start_datum       date,              -- satt endast för heldagshändelser
  slut_datum        date,
  heldag            boolean not null default false,
  status            text,
  event_type        text,              -- DEFAULT, FROM_GMAIL, OUT_OF_OFFICE, FOCUS_TIME …
  serie_id          text,              -- recurringEventId, satt för instanser i en serie
  html_lank         text,
  uppdaterad_google timestamptz,
  senast_synkad     timestamptz not null default now()
);
create index if not exists hq_kal_start_idx on public.hq_kalender_cache (start_tid);
create index if not exists hq_kal_datum_idx on public.hq_kalender_cache (start_datum);
alter table public.hq_kalender_cache enable row level security;

-- ── 4. Manuell tidstyp per händelse (override) ─────────────────────────────
-- Vinner ALLTID över nyckelorden. Raden överlever att händelsen faller ur cachen, så en
-- serie som återkommer nästa vecka behåller sin typ.
create table if not exists public.hq_handelse_typ (
  google_event_id text primary key,
  tidstyp_id      uuid not null references public.hq_tidstyper(id) on delete cascade,
  uppdaterad      timestamptz not null default now()
);
alter table public.hq_handelse_typ enable row level security;

-- ── 5. Mallveckan ──────────────────────────────────────────────────────────
-- veckodag: 1 = måndag … 7 = söndag (ISO), samma räkning som veckovyn.
create table if not exists public.hq_mallvecka (
  id          uuid primary key default gen_random_uuid(),
  titel       text not null,
  veckodag    int not null check (veckodag between 1 and 7),
  starttid    time not null,
  sluttid     time not null,
  tidstyp_id  uuid references public.hq_tidstyper(id) on delete set null,
  aktiv       boolean not null default true,
  uppdaterad  timestamptz not null default now()
);
create index if not exists hq_mallvecka_dag_idx on public.hq_mallvecka (veckodag, starttid);
alter table public.hq_mallvecka enable row level security;

-- ── Startdata: tidstyperna ─────────────────────────────────────────────────
-- Nyckelorden är svenska och matchas skiftlägesokänsligt mot händelsens titel.
insert into public.hq_tidstyper (namn, farg_ramp, nyckelord, sortering)
select * from (values
  ('Egen tid',            'teal',   array['ledig','semester','träning','familj'],                    10),
  ('Coaching och kunder', 'coral',  array['coaching','onboarding','kund','möte','pionjär'],          20),
  ('DT och sälj',         'blue',   array['offert','dt','sälj','uppföljning','produktion'],          30),
  ('Inlägg',              'purple', array['inlägg','batch','content','publicering'],                 40),
  ('Rutiner',             'gray',   array['kvitto','bokföring','fokus','rutin'],                     50)
) as v(namn, farg_ramp, nyckelord, sortering)
where not exists (select 1 from public.hq_tidstyper);

-- ── Startdata: mallveckan enligt ägarens modell ────────────────────────────
insert into public.hq_mallvecka (titel, veckodag, starttid, sluttid, tidstyp_id)
select v.titel, v.veckodag, v.starttid::time, v.sluttid::time, t.id
from (values
  ('Kundmöten och säljsamtal', 2, '09:00', '12:00', 'Coaching och kunder'),
  ('Uppföljningar',            2, '13:00', '16:00', 'DT och sälj'),
  ('Produktion',               4, '09:00', '12:00', 'DT och sälj'),
  ('Kundcontent-batch',        4, '13:00', '14:30', 'Inlägg'),
  ('Fokus idag',               1, '08:00', '08:30', 'Rutiner'),
  ('Fokus idag',               3, '08:00', '08:30', 'Rutiner'),
  ('Fokus idag',               5, '08:00', '08:30', 'Rutiner')
) as v(titel, veckodag, starttid, sluttid, typnamn)
left join public.hq_tidstyper t on t.namn = v.typnamn
where not exists (select 1 from public.hq_mallvecka);

notify pgrst, 'reload schema';
