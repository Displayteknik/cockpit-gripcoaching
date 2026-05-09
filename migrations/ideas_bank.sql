-- Idé-bank for auto-genererade utkast fran night-iterate-cron.
-- Hakan/klient godkanner -> blir client_assets eller publiceras.

create table if not exists public.ideas_bank (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null,
  type text not null,                  -- linkedin_post, mejl, blog_idea, etc.
  body text not null,
  voice_score int,
  variant_count int default 1,
  source text default 'night-iterate', -- night-iterate, manual, etc.
  status text default 'pending',       -- pending, approved, rejected, used
  approved_at timestamptz,
  used_at timestamptz,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ideas_bank_client_status_idx on public.ideas_bank (client_id, status, created_at desc);
create index if not exists ideas_bank_type_idx on public.ideas_bank (type, created_at desc);

alter table public.ideas_bank enable row level security;
create policy "open dev" on public.ideas_bank for all using (true) with check (true);
