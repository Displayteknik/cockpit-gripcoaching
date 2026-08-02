-- KOSTNAD-1b — fasta månadskostnader.
--
-- Håkans krav 2026-08-02: ALLA API:er han betalar för ska synas på ett överblickbart sätt.
-- Anrops-baserade tjänster mäts i ai_usage_events. Men Vercel, Supabase, GoHighLevel,
-- domäner och liknande faktureras per månad oavsett hur mycket de används — de går inte
-- att mäta per anrop, och utan dem är totalen i vyn inte sann.
--
-- Därför en ägarstyrd lista: en rad per abonnemang, redigerbar i adminvyn utan deploy.
-- Server-only, ingen anon-policy.

create table if not exists public.fasta_kostnader (
  id          uuid primary key default gen_random_uuid(),
  namn        text not null,
  kategori    text not null default 'ovrigt'
              check (kategori in ('hosting','databas','crm','domän','mejl','ai','ovrigt')),
  belopp_sek  numeric not null default 0,   -- per månad
  note        text,
  aktiv       boolean not null default true,
  sort_order  int not null default 100,
  uppdaterad  timestamptz not null default now()
);
create index if not exists fasta_kostnader_sort_idx on public.fasta_kostnader (sort_order, namn);
alter table public.fasta_kostnader enable row level security;

-- Startrader med belopp 0 — namnen är säkra, siffrorna är Håkans att fylla i.
-- ⚠ Hitta ALDRIG på priser: en påhittad månadskostnad är värre än en tom.
insert into public.fasta_kostnader (namn, kategori, belopp_sek, note, sort_order) values
  ('Vercel',        'hosting', 0, 'Fyll i det fakturerade beloppet per månad.', 10),
  ('Supabase',      'databas', 0, 'Fyll i det fakturerade beloppet per månad.', 20),
  ('GoHighLevel',   'crm',     0, 'Fyll i det fakturerade beloppet per månad.', 30),
  ('Domäner',       'domän',   0, 'Årsavgifter delade på tolv.',               40)
on conflict do nothing;

notify pgrst, 'reload schema';
