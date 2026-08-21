-- KOSTNAD-2 (HELG-1 DEL 8, 2026-08-21) — saldoskydd som PUSH, inte bara en vy.
--
-- Bygger PÅ K3-INKÖP (rör den befintliga koden minimalt): samma provider_accounts,
-- samma inkop_konfig, samma byggInkop()-uträkning. Två tillägg:
--   1. Två nya, ägarstyrda kolumner på inkop_konfig — de absoluta kronorströsklarna
--      (200/100 kr) för konton med API-läsbart saldo, skilt från de befintliga
--      dagar-kvar-trösklarna (som gäller alla förbetalda konton oavsett belopp).
--   2. En ny liten tabell som håller reda på VILKEN larmnivå som senast SKICKADES per
--      konto — "max ett mail per nivå" går inte att garantera utan att komma ihåg vad
--      som redan gått ut. Escalerar (varning → akut) skickar ett nytt mail; ett saldo
--      som återhämtar sig över tröskeln nollställer, så nästa dropp under larmar igen.

alter table public.inkop_konfig
  add column if not exists saldo_varning_sek numeric not null default 200,
  add column if not exists saldo_akut_sek numeric not null default 100;

create table if not exists public.saldolarm_skickade (
  provider   text primary key references public.provider_accounts(provider) on delete cascade,
  niva       text not null check (niva in ('varning', 'akut')),
  skickad_at timestamptz not null default now()
);
alter table public.saldolarm_skickade enable row level security;

notify pgrst, 'reload schema';
