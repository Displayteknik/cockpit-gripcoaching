-- Generisk Offertmotor, Fas 1: offert-blueprint per klient (inlärd offertstruktur).
-- Körd 2026-07-18 via Management API. Cockpit-native (client_id = clients.id), ej coach-bryggan.
-- RLS på, service-role; app-lagret tenant-låser via getActiveClientId.
create table if not exists public.offert_blueprint (
  client_id uuid primary key references public.clients(id) on delete cascade,
  sektioner jsonb not null default '[]'::jsonb,   -- [{rubrik, syfte, exempeltext}] i ordning
  villkor jsonb not null default '{}'::jsonb,      -- {betalning, garanti, giltighet, leverans, ovrigt[]}
  ton text,
  sprak text default 'svenska',
  valuta text default 'SEK',
  meta jsonb not null default '{}'::jsonb,          -- {rubrik_stil, signatur}
  source_name text,
  raw_excerpt text,
  updated_at timestamptz not null default now()
);
alter table public.offert_blueprint enable row level security;
notify pgrst, 'reload schema';
