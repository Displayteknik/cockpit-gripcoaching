-- ETAPP K2 (STEG 3) — Cockpit Credits, månadskvot per tenant.
--
-- Credits är en VY ovanpå KOSTNAD-1:s ledger, aldrig en egen parallell mätning: varje
-- usage-transaktion pekar på raden i ai_usage_events som orsakade den. Vid konflikt mellan
-- de två siffrorna är ai_usage_events sanningen.
--
-- Affärsregler i kod (lib/credits.ts): 300 credits per månad som default, ingen rollover,
-- förnyas den 1:a 00:00 svensk tid. Texten drar INGA credits — credits gäller media.
-- Den hårda kostnadsgränsen på 200 kr per tenant och månad gäller oavsett creditsaldo.
--
-- Server-only. Ingen anon-policy: allt går via service-role från lib/credits.ts.

create table if not exists public.credit_accounts (
  tenant_id         uuid primary key,
  monthly_quota     int  not null default 300,
  extra_credits     int  not null default 0,   -- köpta/manuellt insatta, överlever inte månadsskiftet om noll
  period_start      date not null,             -- första dagen i innevarande period (svensk tid)
  used_this_period  int  not null default 0,
  updated_at        timestamptz not null default now()
);
alter table public.credit_accounts enable row level security;

create table if not exists public.credit_transactions (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null,
  created_at     timestamptz not null default now(),
  delta          int  not null,                -- negativt = förbrukning, positivt = påfyllning
  type           text not null check (type in ('monthly_reset','usage','topup','manual_grant')),
  -- ⚠ Kopplingen till ledgern. En usage-rad UTAN den här är ett fel: då mäter credits
  -- något annat än vad som faktiskt kostade pengar.
  usage_event_id uuid references public.ai_usage_events(id) on delete set null,
  note           text,
  created_by     text
);
create index if not exists credit_transactions_tenant_idx on public.credit_transactions (tenant_id, created_at desc);
create index if not exists credit_transactions_event_idx  on public.credit_transactions (usage_event_id);
alter table public.credit_transactions enable row level security;

-- Ägarstyrd creditprislista. Ändras utan deploy.
create table if not exists public.credit_pricing (
  action     text primary key,
  credits    int  not null,
  label      text not null,
  active     boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.credit_pricing enable row level security;

insert into public.credit_pricing (action, credits, label) values
  ('social-bild', 3,  'Bild till ett inlägg'),
  ('hero-bild',   8,  'Stor bild till webb eller blogg'),
  ('video',       15, 'Video, per påbörjat femsekundersklipp')
on conflict (action) do nothing;

-- Påfyllningsbeställningar. Ingen Stripe: kunden beställer, owner godkänner, faktura utanför systemet.
create table if not exists public.topup_orders (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null,
  credits    int  not null,
  price_sek  numeric not null,
  status     text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by text,
  note       text
);
create index if not exists topup_orders_tenant_idx on public.topup_orders (tenant_id, created_at desc);
create index if not exists topup_orders_pending_idx on public.topup_orders (created_at desc) where status = 'pending';
alter table public.topup_orders enable row level security;

-- K2-4: utrullning bakom entitlement, DEFAULT AV. Övriga tenants mäts i ledgern utan
-- kundvänd creditvy.
insert into public.platform_modules (id, label, description, href, icon, owner_area, sort_order, active, in_pro_default)
values ('credits', 'Bilder och video', 'Månadskvot för bilder och video som skapas åt kunden.', '/k/credits', 'Coins', 'Innehåll', 130, true, false)
on conflict (id) do nothing;

notify pgrst, 'reload schema';
