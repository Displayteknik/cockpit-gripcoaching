-- HM Motor webb-leads (kontaktform + intresseanmälan per fordon)
create table if not exists public.hm_leads (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null default '00000000-0000-0000-0000-000000000001',
  created_at timestamptz not null default now(),
  name text not null,
  email text,
  phone text,
  message text,
  interest text,
  vehicle_slug text,
  vehicle_title text,
  source text default 'webb',
  status text default 'new',
  user_agent text
);

create index if not exists hm_leads_client_created_idx
  on public.hm_leads (client_id, created_at desc);

-- Service role (servern) bypassar RLS. Inga publika policies = anon kan aldrig läsa leads.
alter table public.hm_leads enable row level security;
