-- Nyhetsbrev-modul v1: utkast av blogg → nyhetsbrev (Resend testutskick).
create table if not exists newsletters (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  source_blog_id uuid,
  subject text not null default '',
  preheader text default '',
  content jsonb,          -- strukturerat innehåll (intro, sektioner, cta)
  html text,              -- renderad email-HTML
  status text not null default 'draft',  -- draft | sent
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists newsletters_client_idx on newsletters (client_id, created_at desc);

-- Strikt RLS (service-role only, som studio_posts) — inga anon-policies.
alter table newsletters enable row level security;

-- Registrera modulen (default AV, PÅ per tenant via tenant_modules).
insert into platform_modules (id, label, description, href, icon, owner_area, sort_order, active, in_pro_default)
values ('newsletter', 'Nyhetsbrev', 'Gör ett nyhetsbrev av din text (eller ett blogginlägg) och skicka i din röst.', '/dashboard/nyhetsbrev', 'Mail', 'content', 62, true, false)
on conflict (id) do nothing;

notify pgrst, 'reload schema';
