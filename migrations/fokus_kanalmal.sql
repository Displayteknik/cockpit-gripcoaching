-- FIX-1-REST C3c — kanaler och veckomål per tenant.
--
-- Bakgrund (Håkans fynd 7/8): Inflödet visade LinkedIn 20 inlägg/vecka för ALLA kunder.
-- För en terapeut är det inte ett mål, det är en dom — och kanallistan i sig (LinkedIn,
-- Instagram, Facebook, Hemsida, ICP) passar inte varje verksamhet.
--
-- Listan låg som en konstant i app/api/fokus/inflode/route.ts. Den blir nu en DEFAULT
-- i koden och en valfri override här: en tenant utan rader får plattformens standard,
-- en tenant med rader får sina egna kanaler i sin egen ordning. Ingen tenant tvingas
-- städa bort en kanal hon aldrig bad om.
--
-- Server-only. Ingen anon-policy — skrivs och läses via service-role.

create table if not exists public.fokus_kanalmal (
  client_id  uuid not null,
  kanal      text not null,
  -- Veckomål. 0 = kanalen visas men utan mål (följs upp, jagas inte).
  mal        int  not null default 0 check (mal >= 0),
  -- Visningsordning. Lika värden sorteras på kanalnamn, så listan aldrig hoppar runt.
  sort       int  not null default 0,
  uppdaterad timestamptz not null default now(),
  primary key (client_id, kanal)
);

create index if not exists fokus_kanalmal_klient_idx on public.fokus_kanalmal (client_id, sort);

alter table public.fokus_kanalmal enable row level security;
revoke all on public.fokus_kanalmal from anon, authenticated;

notify pgrst, 'reload schema';
