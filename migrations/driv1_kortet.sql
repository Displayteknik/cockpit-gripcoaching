-- DRIV-1 — kortet (tidslinje + läget) och engångsstädningen.
--
-- Återanvänder hellre än bygger om: hq_pipeline_cache (affärer+epost), hq_kalender_cache
-- (möten) och hq_kontakt_status (Gmail-bollen) från HQ/KONTAKT-1 rörs INTE här. Två
-- tabeller är genuint nya:
--
--   driv_lankar      — identitetsmatchningen (1A). Den enda länken mellan en GHL-kontakt
--                       och en Gmail-adress/kalenderhändelse som är OSÄKER nog att behöva
--                       ett mänskligt beslut. Säkra länkar (kontaktens egen e-post i GHL)
--                       kräver ingen rad här — de är redan sanning i hq_pipeline_cache.epost.
--   driv_kort_cache   — det sammansatta kortet (tidslinje + läget) per affär, med en
--                       hämtad-tidsstämpel. Listvyer (framtida DRIV-4-kön) läser cachen;
--                       att ÖPPNA ett kort tvingar alltid färsk hämtning (1D).
--
-- 1C: ingen mejlkropp eller GHL-meddelandekropp lagras NÅGONSTANS i de här tabellerna.
-- driv_kort_cache.payload bär bara metadata (avsändare/ämne/datum/riktning/snippet ≤200
-- tecken) — exakt samma disciplin som hq_kontakt_status redan bevisat hålla för Gmail.
--
-- RLS på utan policies = bara service-role. Samma mönster som onboarding_korningar.

create table if not exists public.driv_lankar (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.clients(id) on delete cascade,
  ghl_contact_id  text not null,
  ghl_opportunity_id text,                     -- satt när länken gäller en specifik affär (t.ex. ett kalendermöte)
  ref_typ         text not null check (ref_typ in ('gmail_trad', 'kalenderhandelse')),
  ref_id          text not null,               -- gmail thread-id eller google_event_id
  kalla           text not null check (kalla in ('email', 'telefon', 'manuell')),
  belagg          text not null,               -- det matchande värdet, alltid synligt i UI:t
  status          text not null default 'foreslagen' check (status in ('bekraftad', 'foreslagen', 'avvisad')),
  beslutad_av     text,
  beslutad_tid    timestamptz,
  created_at      timestamptz not null default now()
);
-- En och samma föreslagna koppling ska inte skapas om vid varje kortöppning.
create unique index if not exists driv_lankar_unik_idx
  on public.driv_lankar (tenant_id, ghl_contact_id, ref_typ, ref_id);
create index if not exists driv_lankar_kontakt_idx on public.driv_lankar (ghl_contact_id, status);
alter table public.driv_lankar enable row level security;

comment on table public.driv_lankar is
  'DRIV-1: osäkra kopplingar mellan en GHL-kontakt och en Gmail-tråd/kalenderhändelse. Säkra kopplingar (kontaktens egen e-post) behöver ingen rad här.';

create table if not exists public.driv_kort_cache (
  ghl_opportunity_id text primary key,
  tenant_id           uuid not null references public.clients(id) on delete cascade,
  payload             jsonb not null,          -- { lage: {...}, tidslinje: [...] } — aldrig meddelandekroppar
  hamtad_tidsstampel  timestamptz not null default now()
);
create index if not exists driv_kort_cache_tenant_idx on public.driv_kort_cache (tenant_id);
alter table public.driv_kort_cache enable row level security;

comment on table public.driv_kort_cache is
  'DRIV-1: sammansatt kort per affär (tidslinje+läget). Öppning av ett kort tvingar alltid färsk hämtning — cachen är bara för listvyer.';

notify pgrst, 'reload schema';
