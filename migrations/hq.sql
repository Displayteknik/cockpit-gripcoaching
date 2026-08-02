-- HQ-1 — Founder HQ, ägarens kommandobrygga (/dashboard/hq).
--
-- Fyra tabeller. Alla server-only: RLS på, INGEN policy skapas, så anon-nyckeln kommer
-- aldrig åt en enda rad. All läsning och skrivning går via service-role i /api/hq, som
-- i sin tur grindas på huvudadmin (owner). Samma mönster som fasta_kostnader.
--
-- Viktig princip: affärspipelinen ägs av MySales (GHL). HQ läser den, skriver aldrig.
-- Därför finns ingen offerttabell här — bara en spegel (hq_pipeline_cache).

-- ── 1. Återkommande intäkt (MRR-motorn) ────────────────────────────────────
create table if not exists public.hq_mrr_entries (
  id              uuid primary key default gen_random_uuid(),
  bolag           text not null check (bolag in ('grip','dt')),
  kund            text not null,
  niva            text not null default 'ovrigt'
                  check (niva in ('grund','pro','gdam','bollplanket','konsult','ovrigt')),
  belopp_ex_moms  numeric not null default 0,
  startdatum      date,                        -- null = okänt. Hitta ALDRIG på ett datum.
  status          text not null default 'aktiv' check (status in ('aktiv','pausad','avslutad')),
  notering        text,
  skapad          timestamptz not null default now(),
  uppdaterad      timestamptz not null default now()
);
create index if not exists hq_mrr_bolag_idx on public.hq_mrr_entries (bolag, status);
alter table public.hq_mrr_entries enable row level security;

-- ── 2. Fasta kostnader per bolag ───────────────────────────────────────────
-- Skild från public.fasta_kostnader (som mäter plattformens API-abonnemang i
-- kostnadsmodulen). Den här listan är Håkans egna bolagskostnader, delade på grip/dt.
create table if not exists public.hq_fasta_kostnader (
  id              uuid primary key default gen_random_uuid(),
  bolag           text not null check (bolag in ('grip','dt')),
  tjanst          text not null,
  belopp_per_man  numeric not null default 0,
  valuta          text not null default 'SEK' check (valuta in ('SEK','USD','EUR')),
  notering        text,
  skapad          timestamptz not null default now(),
  uppdaterad      timestamptz not null default now()
);
create index if not exists hq_fasta_bolag_idx on public.hq_fasta_kostnader (bolag, tjanst);
alter table public.hq_fasta_kostnader enable row level security;

-- ── 3. Egna uppgifter (matar morgonlistan tillsammans med pipelinen) ───────
create table if not exists public.hq_tasks (
  id              uuid primary key default gen_random_uuid(),
  titel           text not null,
  bolag           text not null default 'grip' check (bolag in ('grip','dt','privat')),
  datum           date,
  klar            boolean not null default false,
  skapad          timestamptz not null default now(),
  uppdaterad      timestamptz not null default now()
);
create index if not exists hq_tasks_oppna_idx on public.hq_tasks (klar, datum);
alter table public.hq_tasks enable row level security;

-- ── 4. Spegel av MySales-pipelinen (READ-ONLY) ─────────────────────────────
-- Fylls av /api/hq, aldrig av en människa. HQ skriver ALDRIG tillbaka till GHL.
-- ⚠ GHL rapporterar status 'open' även för vunna och förlorade affärer (verifierat live
-- 2026-08-02: alla 51 DT-affärer har status='open', varav 11 står i steget "Vunnen").
-- Därför bär raden BÅDE det råa status-fältet och en härledd status ur steg-id:t.
create table if not exists public.hq_pipeline_cache (
  ghl_opportunity_id  text primary key,
  location_id         text not null,
  namn                text,
  kontakt             text,
  foretag             text,
  ghl_contact_id      text,
  pipeline_id         text,
  pipeline_namn       text,
  steg_id             text,
  steg_namn           text,
  steg_position       int,
  varde               numeric not null default 0,
  status              text,                    -- rått från GHL
  harledd_status      text not null default 'open'
                      check (harledd_status in ('open','won','lost')),
  steg_sedan          timestamptz,             -- lastStageChangeAt
  senast_uppdaterad   timestamptz,             -- updatedAt hos GHL
  uppfoljning_datum   timestamptz,             -- tidigaste öppna uppgiftens dueDate
  uppfoljning_titel   text,
  antal_uppgifter     int not null default 0,
  senast_synkad       timestamptz not null default now()
);
create index if not exists hq_pipeline_uppfoljning_idx on public.hq_pipeline_cache (uppfoljning_datum);
create index if not exists hq_pipeline_status_idx on public.hq_pipeline_cache (harledd_status);
alter table public.hq_pipeline_cache enable row level security;

-- ── Startdata ──────────────────────────────────────────────────────────────
-- MRR: pionjärerna på pro-nivå plus konsultuppdraget. startdatum lämnas tomt —
-- ett påhittat startdatum är värre än inget.
insert into public.hq_mrr_entries (bolag, kund, niva, belopp_ex_moms, status)
select * from (values
  ('grip','Gitte',        'pro',     1990::numeric, 'aktiv'),
  ('grip','Carina',       'pro',     1990::numeric, 'aktiv'),
  ('grip','Pionjär 3',    'pro',     1990::numeric, 'aktiv'),
  ('grip','Madeleine',    'pro',     1990::numeric, 'aktiv'),
  ('grip','Orwix Studio', 'konsult', 7500::numeric, 'aktiv')
) as v(bolag, kund, niva, belopp_ex_moms, status)
where not exists (select 1 from public.hq_mrr_entries);

-- Fasta kostnader. Beloppet 0 med noteringen "belopp okänt, fyll i" är AVSIKTLIGT
-- för de poster Håkan inte gett en siffra på. En påhittad månadskostnad är värre än en tom.
insert into public.hq_fasta_kostnader (bolag, tjanst, belopp_per_man, valuta, notering)
select * from (values
  ('grip','GoHighLevel konto 1',  90.87::numeric, 'USD', null),
  ('grip','GoHighLevel konto 2',      0::numeric, 'USD', 'belopp okänt, fyll i'),
  ('grip','Google Cloud AI',        300::numeric, 'SEK', 'rörlig'),
  ('grip','Zoom',                   221::numeric, 'SEK', null),
  ('grip','Anthropic',                0::numeric, 'SEK', 'belopp okänt, fyll i'),
  ('dt',  'AWS via mellanhand',    1200::numeric, 'SEK', null),
  ('dt',  'DigitalOcean',             0::numeric, 'SEK', 'belopp okänt, fyll i'),
  ('dt',  'Tell Sverige',          1114::numeric, 'SEK', null),
  ('dt',  'hallon företag',         211::numeric, 'SEK', null),
  ('dt',  'Codesys',                  0::numeric, 'SEK', 'belopp okänt, fyll i')
) as v(bolag, tjanst, belopp_per_man, valuta, notering)
where not exists (select 1 from public.hq_fasta_kostnader);

notify pgrst, 'reload schema';
