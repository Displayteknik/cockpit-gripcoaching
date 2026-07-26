-- SMS-påminnelse-verktyg: logg över utskick (historik). Endast huvudadmin skriver
-- hit via service-role. Mata in via Supabase Management API (per Hakans setup).

create table if not exists public.sms_sends (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  sender       text not null,                 -- avsändarnamn som användes
  body         text not null,                 -- meddelandemallen (med [förnamn])
  source       text,                          -- csv | paste | manual
  mode         text not null check (mode in ('test','live')),
  dryrun       boolean not null default true, -- true = validerat men inget skickat
  total        int not null default 0,        -- antal mottagare i utskicket
  ok_count     int not null default 0,
  fail_count   int not null default 0,
  cost_kr      numeric,                       -- summerad kostnad (kr) från 46elks
  results      jsonb not null default '[]'::jsonb, -- [{to,name,ok,status,error,costKr}]
  created_by   text                           -- 'owner' (huvudadmin)
);

create index if not exists sms_sends_created_idx on public.sms_sends (created_at desc);

alter table public.sms_sends enable row level security;
-- Ingen anon-policy: tabellen skrivs och läses enbart via service-role (huvudadmin).

notify pgrst, 'reload schema';
