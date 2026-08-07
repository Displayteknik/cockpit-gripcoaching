-- ONBOARD-1 — automatisk provisionering av nya MySales Pro-kunder.
--
-- Tabellen är IDEMPOTENSENS FÖRSTAHANDSKÄLLA. Kravet är att samma sajt två gånger inte
-- får skapa dubbletter, och det går inte att lita på GHL för den saken: v3:s
-- /locations/search kan bara filtrera på companyId och e-post, inte på webbadress. Att
-- bläddra igenom alla sub-accounts och jämföra domän fungerar som extra kontroll, men
-- kapplöpningen mellan två samtidiga klick kan bara stängas här — med ett unikt index.
--
-- Nyckeln är `domän` (värdnamnet utan www och utan protokoll), INTE hela URL:en:
-- https://foo.se, http://www.foo.se/ och foo.se/#kontakt är samma kund.

create table if not exists public.onboarding_korningar (
  id                uuid primary key default gen_random_uuid(),

  -- Normaliserat värdnamn utan www. Idempotensnyckeln.
  doman             text not null,
  url               text not null,
  epost             text,

  -- skrapad  = analys klar, väntar på granskning
  -- godkand  = Håkan har godkänt, provisionering får köras
  -- kor      = provisionering pågår (spärrar dubbelklick)
  -- klar     = kontot finns i GHL och tenanten i Cockpit
  -- fel      = något föll; `fel` bär orsaken i klartext
  status            text not null default 'skrapad'
                    check (status in ('skrapad','godkand','kor','klar','fel')),

  -- Hela analysen med bevis (lästa sidor, missar, källa per fält).
  analys            jsonb,
  -- Förslaget som det ser ut EFTER Håkans redigeringar.
  forslag           jsonb,

  client_id         uuid references public.clients(id) on delete set null,
  ghl_location_id   text,
  ghl_snapshot_id   text,

  -- Steg-för-steg-resultat från provisioneringen, för felsökning och för UI:t.
  steg              jsonb not null default '[]'::jsonb,
  fel               text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ★ Idempotensgrinden. En misslyckad körning ska kunna göras om, därför räknas inte
--   status 'fel' med — men en pågående eller lyckad körning låser domänen.
create unique index if not exists onboarding_korningar_doman_aktiv_idx
  on public.onboarding_korningar (doman)
  where status <> 'fel';

create index if not exists onboarding_korningar_client_idx
  on public.onboarding_korningar (client_id);

create index if not exists onboarding_korningar_status_idx
  on public.onboarding_korningar (status, created_at desc);

-- RLS på utan policies = bara service-role kommer åt tabellen. Raderna bär kunddata
-- (e-post, kontaktuppgifter) och ska aldrig vara läsbara med anon-nyckeln.
-- Samma linje som platform_hardening_step2.sql drog för ideas_bank m.fl.
alter table public.onboarding_korningar enable row level security;

comment on table public.onboarding_korningar is
  'ONBOARD-1: en rad per onboardad webbplats. Unikt index på doman (utom status=fel) hindrar dubbletter.';
comment on column public.onboarding_korningar.doman is
  'Värdnamn utan www och protokoll. Idempotensnyckel — sätts av lib/onboard/provisionera.ts.';

-- PostgREST måste läsa om schemat efter DDL, annars svarar API:t 404 på den nya tabellen.
notify pgrst, 'reload schema';
