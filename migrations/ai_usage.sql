-- KOSTNAD-1 — central AI-kostnadsmätning (K1, K2, K4).
--
-- Bakgrund: AI-anrop loggades inte centralt. Betalningsspärren på Google Cloud 1/8 syntes
-- bara som en statuskod utan svarskropp och kostade en timmes felsökning på en påhittad
-- bugg. Efter det gäller: svarskroppen loggas ALLTID vid fel.
--
-- Server-only. Ingen anon-policy på någon tabell här — allt skrivs och läses via
-- service-role från lib/ai-usage.ts. Matas in via Supabase Management API (Håkans setup).

-- ── K1: central anropslogg ────────────────────────────────────────────────
create table if not exists public.ai_usage_events (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  tenant_id          uuid,                       -- null = owner-flöde utan tenant
  provider           text not null,              -- gemini | anthropic | fal | fireworks | pexels
  model              text not null,
  flow               text not null,              -- studio-caption | blogg | dm-bildlasning | prata-in …
  tokens_in          int  not null default 0,
  tokens_out         int  not null default 0,
  media_units        numeric not null default 0, -- bilder (st) eller video (sekunder)
  estimated_cost_sek numeric not null default 0,
  status             text not null check (status in ('ok','error')),
  error_class        text check (error_class in ('billing','quota','auth','model','other')),
  http_status        int,
  -- ⚠ Regeln från betalningsspärren: HELA svarskroppen, aldrig bara statuskoden.
  error_body         text,
  latency_ms         int not null default 0
);

create index if not exists ai_usage_events_tid_idx      on public.ai_usage_events (created_at desc);
create index if not exists ai_usage_events_tenant_idx   on public.ai_usage_events (tenant_id, created_at desc);
create index if not exists ai_usage_events_provider_idx on public.ai_usage_events (provider, created_at desc);
create index if not exists ai_usage_events_fel_idx      on public.ai_usage_events (created_at desc) where status = 'error';

alter table public.ai_usage_events enable row level security;

-- ── K1: prislista, ägarstyrd utan deploy ──────────────────────────────────
create table if not exists public.ai_pricing (
  id                 uuid primary key default gen_random_uuid(),
  provider           text not null,
  model              text not null,
  pris_in_per_mtoken numeric,          -- per 1M input-tokens, i `valuta`
  pris_ut_per_mtoken numeric,          -- per 1M output-tokens, i `valuta`
  pris_per_media     numeric,          -- per bild eller per sekund video
  media_enhet        text check (media_enhet in ('bild','sekund')),
  valuta             text not null default 'USD',
  vaxelkurs          numeric not null default 10.5,  -- till SEK
  aktiv              boolean not null default true,
  uppdaterad         timestamptz not null default now()
);

create unique index if not exists ai_pricing_modell_idx on public.ai_pricing (provider, model);
alter table public.ai_pricing enable row level security;

-- ── K4: budgetgrindar ─────────────────────────────────────────────────────
-- Per tenant. Saknas raden gäller kodens default (200 kr/månad).
create table if not exists public.ai_tenant_budget (
  tenant_id     uuid primary key,
  tak_sek       numeric not null default 200,
  uppdaterad    timestamptz not null default now(),
  uppdaterad_av text
);
alter table public.ai_tenant_budget enable row level security;

-- Globalt månadstak för hela plattformen. Exakt en rad.
create table if not exists public.ai_platform_budget (
  id              smallint primary key default 1 check (id = 1),
  tak_sek         numeric,            -- null = inget globalt tak
  varning_procent int not null default 90,
  uppdaterad      timestamptz not null default now(),
  uppdaterad_av   text
);
alter table public.ai_platform_budget enable row level security;
insert into public.ai_platform_budget (id, tak_sek) values (1, null) on conflict (id) do nothing;

-- ── K2: provider-hälsa ────────────────────────────────────────────────────
-- Senaste lyckade anrop, senaste fel och felklassen bakom det, per provider.
create or replace view public.ai_provider_health as
select
  provider,
  max(created_at) filter (where status = 'ok')    as senaste_ok,
  max(created_at) filter (where status = 'error') as senaste_fel,
  (array_agg(error_class  order by created_at desc) filter (where status = 'error'))[1] as senaste_felklass,
  (array_agg(http_status  order by created_at desc) filter (where status = 'error'))[1] as senaste_httpstatus,
  (array_agg(error_body   order by created_at desc) filter (where status = 'error'))[1] as senaste_svarskropp,
  count(*) filter (where status = 'error' and created_at > now() - interval '1 hour')   as fel_senaste_timmen,
  count(*) filter (where status = 'ok'    and created_at > now() - interval '1 hour')   as ok_senaste_timmen
from public.ai_usage_events
group by provider;

revoke all on public.ai_provider_health from anon, authenticated;

-- ── Startprislista (2026-08, riktvärden — justeras i adminvyn utan deploy) ─
insert into public.ai_pricing (provider, model, pris_in_per_mtoken, pris_ut_per_mtoken, valuta, vaxelkurs)
values
  ('gemini',    'gemini-2.5-flash',       0.30,  2.50, 'USD', 10.5),
  ('gemini',    'gemini-2.5-pro',         1.25, 10.00, 'USD', 10.5),
  ('anthropic', 'claude-sonnet-4-5',      3.00, 15.00, 'USD', 10.5),
  ('anthropic', 'claude-haiku-4-5-20251001', 1.00, 5.00, 'USD', 10.5)
on conflict (provider, model) do nothing;

insert into public.ai_pricing (provider, model, pris_per_media, media_enhet, valuta, vaxelkurs)
values
  ('gemini', 'gemini-2.5-flash-image',          0.039, 'bild', 'USD', 10.5),
  ('gemini', 'gemini-3.1-flash-image-preview',  0.039, 'bild', 'USD', 10.5),
  ('fal',    'fal-ai/flux/schnell',             0.003, 'bild', 'USD', 10.5),
  ('pexels', 'search',                          0,     'bild', 'USD', 10.5)
on conflict (provider, model) do nothing;

notify pgrst, 'reload schema';
