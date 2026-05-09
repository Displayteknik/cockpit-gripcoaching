-- Per-dag GSC-data for tidsserier i analytics-dashboard.
-- Tidigare gsc_queries hade bara aggregerade rader per period_end.
-- Med daily-tabellen kan vi rita 7d/14d/30d/90d-grafer korrekt.

create table if not exists public.gsc_queries_daily (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null,
  date date not null,                  -- per-dag granularitet fran searchAnalytics (date-dim)
  query text,                          -- null nar dimensions=[date] (sajtens totala dagsdata)
  page text,
  clicks int default 0,
  impressions int default 0,
  ctr numeric(8,6) default 0,
  position numeric(8,3) default 0,
  synced_at timestamptz not null default now(),
  unique (client_id, date, query)
);

create index if not exists gsc_daily_client_date_idx on public.gsc_queries_daily (client_id, date desc);
create index if not exists gsc_daily_client_query_idx on public.gsc_queries_daily (client_id, query, date desc);

alter table public.gsc_queries_daily enable row level security;
create policy "open dev" on public.gsc_queries_daily for all using (true) with check (true);
