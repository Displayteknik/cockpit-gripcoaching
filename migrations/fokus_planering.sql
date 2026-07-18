-- Fokus idag: planerade kontakter ("Att göra idag"-källan).
-- Körd 2026-07-18 via Management API. Service-role only (RLS på, inga policies);
-- Cockpit tenant-låser i app-lagret via coach-bridge (samma Path A som övriga fokus_*).
create table if not exists public.fokus_planering (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,                 -- coach_users.id (kanonisk tenant för affären)
  opportunity_id uuid,                     -- fokus_opportunities.id (spegelraden)
  ghl_opportunity_id text not null,
  ghl_contact_id text,
  kanal text not null default 'ring',      -- 'ring' | 'mejl'
  due_at timestamptz not null,
  note text,
  status text not null default 'open',     -- 'open' | 'done' | 'superseded'
  ghl_task_id text,                        -- id på ev. skapad GHL-uppgift
  created_at timestamptz not null default now(),
  done_at timestamptz
);
create index if not exists fokus_planering_tenant_due on public.fokus_planering(tenant_id, status, due_at);
create index if not exists fokus_planering_opp on public.fokus_planering(tenant_id, ghl_opportunity_id);
alter table public.fokus_planering enable row level security;
notify pgrst, 'reload schema';
