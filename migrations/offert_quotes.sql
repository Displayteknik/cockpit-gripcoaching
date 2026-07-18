-- Generisk Offertmotor, Fas 3: offerter + rader.
-- Körd 2026-07-18 via Management API. Cockpit-native (client_id = clients.id), RLS på, service-role.
create table if not exists public.offert_quotes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  quote_number text,
  customer_name text,
  customer_company text,
  ghl_contact_id text,
  ghl_opportunity_id text,
  status text not null default 'draft',   -- draft/sent/won/lost
  currency text default 'SEK',
  total numeric,          -- ordervärde (utpris)
  cost_total numeric,     -- intern kostnad
  margin_pct numeric,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  won_at timestamptz
);
create index if not exists offert_quotes_client on public.offert_quotes(client_id, created_at desc);
alter table public.offert_quotes enable row level security;

create table if not exists public.offert_quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.offert_quotes(id) on delete cascade,
  product_id uuid,        -- valfri koppling till offert_products
  name text not null,
  qty numeric not null default 1,
  unit_price numeric,     -- utpris/enhet
  cost numeric,           -- kostnad/enhet (landat)
  lead_time_days integer,
  sort integer not null default 0
);
create index if not exists offert_quote_items_quote on public.offert_quote_items(quote_id);
alter table public.offert_quote_items enable row level security;
notify pgrst, 'reload schema';
