-- Reels Creator R2 — mediabank med proveniens + reel-objektet.
-- Plan: docs/studio/REELS-PLAN.md §4
--
-- Varför en egen mediabank i stället för client_assets: Instagram Graph måste kunna
-- HÄMTA filen publikt vid publicering. client_assets ligger i en privat bucket med
-- signerade URL:er som går ut efter en timme, alltså oanvändbar för reels. Studio-media
-- ligger kvar i de publika bucketarna studio-images och studio-videos; den här tabellen
-- lägger bara proveniens ovanpå (källa, samtycke, koppling till leadkort), vilket
-- storage.list() aldrig kan ge.
--
-- Strikt RLS utan anon-policies: läses och skrivs enbart med service-role, samma
-- mönster som studio_posts. Se lesson_brand_profile_anon_rls_silent_drop.

create table if not exists public.studio_media (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clients(id) on delete cascade,
  kind          text not null default 'image' check (kind in ('image', 'video')),
  bucket        text not null default 'studio-images',
  path          text not null,
  url           text not null,
  -- Aktighetsflaggan bor här: uploaded och email räknas som äkta material,
  -- ai kräver bekräftelse i mallen Före och efter innan rendering.
  source        text not null check (source in ('uploaded', 'email', 'ai', 'stock')),
  source_detail text,
  mime          text,
  bytes         bigint,
  width         integer,
  height        integer,
  duration_s    numeric,
  -- Kundmaterial kan knytas till ett leadkort (R6 inmejlning, R7 automatiska utkast).
  dm_contact_id uuid references public.cockpit_dm_contacts(id) on delete set null,
  consent       text not null default 'ej_tillfragad' check (consent in ('ja', 'nej', 'ej_tillfragad')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists studio_media_client_idx on public.studio_media (client_id, created_at desc);
create index if not exists studio_media_contact_idx on public.studio_media (dm_contact_id) where dm_contact_id is not null;
create unique index if not exists studio_media_bucket_path_idx on public.studio_media (bucket, path);

alter table public.studio_media enable row level security;

create table if not exists public.studio_reels (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clients(id) on delete cascade,
  title         text,
  template_key  text not null,
  storyboard    jsonb not null default '{}'::jsonb,
  -- forslag = R7:s automatiska utkast. Renderas aldrig automatiskt, publiceras aldrig sjalvt.
  status        text not null default 'utkast' check (status in ('utkast', 'renderad', 'publicerad', 'forslag')),
  video_url     text,
  cover_url     text,
  caption       text,
  ai_generated  boolean not null default false,
  dm_contact_id uuid references public.cockpit_dm_contacts(id) on delete set null,
  duration_ms   integer,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists studio_reels_client_idx on public.studio_reels (client_id, updated_at desc);

alter table public.studio_reels enable row level security;

-- updated_at-trigger, samma hjalpfunktion som ovriga tabeller anvander.
create or replace function public.studio_reels_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists studio_media_set_updated_at on public.studio_media;
create trigger studio_media_set_updated_at
  before update on public.studio_media
  for each row execute function public.studio_reels_touch();

drop trigger if exists studio_reels_set_updated_at on public.studio_reels;
create trigger studio_reels_set_updated_at
  before update on public.studio_reels
  for each row execute function public.studio_reels_touch();

notify pgrst, 'reload schema';
