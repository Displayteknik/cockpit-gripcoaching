-- Generisk Offertmotor, Fas 2: produktkatalog per klient.
-- Körd 2026-07-18 via Management API. Cockpit-native (client_id = clients.id), RLS på, service-role.
-- Branschoberoende: produkt ↔ leverantör ↔ inpris ↔ frakt ↔ ledtid ↔ pålägg.
create table if not exists public.offert_products (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  category text,
  unit text default 'st',
  supplier_name text,
  sku text,
  purchase_price numeric,   -- inpris per enhet
  freight numeric,          -- frakt per enhet
  currency text default 'SEK',
  lead_time_days integer,
  markup_pct numeric,       -- pålägg %
  image_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists offert_products_client on public.offert_products(client_id);
alter table public.offert_products enable row level security;
notify pgrst, 'reload schema';
