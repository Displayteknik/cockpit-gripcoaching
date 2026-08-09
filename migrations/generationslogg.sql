-- G-1 — generationsloggen.
--
-- Bakgrund (G0-RAPPORT 0.4): `ai_usage_events` vet att ett anrop kostade 0,04 kr, men
-- inte vilken bild eller vilken text det blev. Fyra saker saknas för att kunna svara på
-- "blev texterna bättre efter att sanningskravet skärptes?":
--   1. ingen tabell binder ihop anropet med inlägget det hamnade i
--   2. `flow` härleds ur URL:en → karusell och statisk bild blir samma flow, formatet syns inte
--   3. ingen promptversionering finns
--   4. `studio_media` har proveniens men ingen koppling till anropet som skapade filen
--
-- Den här tabellen ERSÄTTER INTE ai_usage_events — den PEKAR PÅ den, precis som
-- credit_transactions gör. Samma mönster, samma ansvarsfördelning: ledgern äger pengarna,
-- generationsloggen äger kvaliteten.
--
-- Server-only. Ingen anon-policy. Skrivs och läses via service-role ur lib/generationslogg.ts.

create table if not exists public.generation_log (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  tenant_id          uuid,                      -- null = ägarflöde utan tenant

  -- Kopplingen till pengarna. null när anropet inte gick genom lib/ai-usage (får hända,
  -- ska synas): en rad utan usage-id är en generering vi inte kan prissätta.
  ai_usage_event_id  uuid references public.ai_usage_events (id) on delete set null,

  -- ── Vad som genererades ──
  syfte              text not null,             -- TextSyfte: caption | karusell | linkedin | reel | dm-svar …
  format             text,                      -- 1080x1350 | 1080x1080 | 1080x1920 | karusell | null (ren text)
  prompt_version     text not null,             -- lib/prompt-core promptVersion(), t.ex. v1-3f8a21c4

  -- ── De fyra dragen G-0 pekade ut som osynliga ──
  hook_typ           text,                      -- G-3 äger listan; loggen bär värdet redan nu
  motiv_kategori     text,                      -- bildflöden: vilken motivkategori som valdes
  funnel             text check (funnel is null or funnel in ('tofu','mofu','bofu')),
  lager              jsonb,                     -- vilka promptlager som var på (ByggdPrompt.meta.lager)

  -- ── Var det tog vägen ──
  -- Skrivs när genereringen faktiskt landar i ett inlägg. Två kolumner i stället för en
  -- polymorf nyckel: `studio_posts.ghl_post_id` bär redan två ID-rymder i samma kolumn
  -- (G0 0.5) och det felet upprepas inte här. Tabellnamnet säger vilken rymd id:t tillhör.
  anvand_i_tabell    text,                      -- studio_posts | studio_media | hm_social_posts | linkedin_posts …
  anvand_i_id        text,

  -- ── Utfall ──
  status             text not null default 'ok' check (status in ('ok','error','kasserad')),
  -- 'kasserad' = genererat men förkastat (omgenerering, användaren valde en annan variant).
  -- Utan det läser en mätning bort just de fall där kvaliteten faktiskt föll.
  varianter          int not null default 1     -- antal varianter anropet gav
);

create index if not exists generation_log_tid_idx     on public.generation_log (created_at desc);
create index if not exists generation_log_tenant_idx  on public.generation_log (tenant_id, created_at desc);
create index if not exists generation_log_syfte_idx   on public.generation_log (syfte, created_at desc);
create index if not exists generation_log_version_idx on public.generation_log (prompt_version, created_at desc);
create index if not exists generation_log_usage_idx   on public.generation_log (ai_usage_event_id);
-- Uppslag "vilken generering blev det här inlägget?" — bakvägen är lika viktig som framvägen.
create index if not exists generation_log_anvand_idx  on public.generation_log (anvand_i_tabell, anvand_i_id);

alter table public.generation_log enable row level security;
revoke all on public.generation_log from anon, authenticated;

-- ── Före/efter per promptversion ──────────────────────────────────────────
-- Den fråga hela G-1 finns för: skiljer sig utfallet mellan två regeluppsättningar?
-- Vyn räknar bara det som är MÄTT — den fabricerar aldrig ett kvalitetsvärde.
create or replace view public.generation_per_promptversion as
select
  prompt_version,
  syfte,
  min(created_at)                                          as forsta,
  max(created_at)                                          as senaste,
  count(*)                                                 as antal,
  count(*) filter (where status = 'kasserad')               as kasserade,
  count(*) filter (where anvand_i_id is not null)           as publicerade,
  count(*) filter (where ai_usage_event_id is null)         as utan_kostnadskoppling
from public.generation_log
group by prompt_version, syfte;

revoke all on public.generation_per_promptversion from anon, authenticated;

notify pgrst, 'reload schema';
