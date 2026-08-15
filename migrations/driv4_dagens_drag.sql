-- DRIV-4 — morgonkön "Dagens drag".
--
-- ⚠ Beräknas ON-DEMAND (när Fokus idag öppnas, en gång per dag, cachat) i stället för
-- enbart på en extern cron. Skälet står redan mätt i det här repot:
-- `.github/workflows/scheduler.yml` dokumenterar att GitHub Actions cron drev i snitt
-- 102 minuter och värst 3,8 timmar över 30 körningar. En morgonkö som bara byggs av en
-- flaky extern klocka kan stå tom eller gammal precis den morgon Håkan öppnar sidan.
-- On-demand med en per-dag-spärr (unikt index på (tenant_id, dag)) ger samma resultat
-- som en pålitlig cron hade gett, utan att vara beroende av en.
--
-- RLS på utan policies = bara service-role. Samma mönster som övriga DRIV-tabeller.

create table if not exists public.driv_ko (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.clients(id) on delete cascade,
  dag               date not null,                     -- idempotensnyckel: en kö per dag
  ghl_opportunity_id text,                              -- null för rena mötesförberedelse-kort utan affär
  typ               text not null check (typ in ('uppgift_forfallen','obesvarat','offert_uppfoljning','mote_forberedelse','steg_aldrat')),
  varfor_nu         text not null,                      -- en mening, fakta
  foreslaget_drag   text not null,                      -- en mening
  forberett_utkast  jsonb,                               -- { kanal, text, motpart, amne? } — bara för 'obesvarat'
  prioritet         numeric not null default 0,          -- Fokusmotorns formel (lib/fokus/priority.ts, återanvänd)
  status            text not null default 'oppen' check (status in ('oppen','klar','senare_idag','vecka')),
  uppdaterad_at     timestamptz not null default now(),
  created_at        timestamptz not null default now()
);
create index if not exists driv_ko_dag_idx on public.driv_ko (tenant_id, dag, status, prioritet desc);
alter table public.driv_ko enable row level security;

comment on table public.driv_ko is
  'DRIV-4: dagens morgonkö. En rad per skäl-att-agera. Beräknad on-demand, en gång per (tenant_id, dag).';

-- Ägarredigerbara trösklar — spec: "inte hårdkodad".
create table if not exists public.driv_ko_installningar (
  tenant_id                 uuid primary key references public.clients(id) on delete cascade,
  troskel_obesvarat_timmar  int not null default 24,
  uppdaterad_at             timestamptz not null default now()
);
alter table public.driv_ko_installningar enable row level security;

notify pgrst, 'reload schema';
