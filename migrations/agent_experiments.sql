-- Iterations-loop logging. Korresponderar mot lib/iterate.ts.
-- Mata in via Supabase Management API (per Hakans setup).

create table if not exists public.agent_experiments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid,
  type text not null,
  variants int not null default 1,
  winner_score int,
  runner_up_score int,
  spread int,
  model text,
  created_at timestamptz not null default now()
);

create index if not exists agent_experiments_client_idx on public.agent_experiments (client_id, created_at desc);
create index if not exists agent_experiments_type_idx on public.agent_experiments (type, created_at desc);

-- RLS oppen i dev. Stang innan auth.
alter table public.agent_experiments enable row level security;
create policy "open dev" on public.agent_experiments for all using (true) with check (true);
