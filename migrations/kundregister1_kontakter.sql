-- KUNDREGISTER-1 — läsande spegel av tenantens MySales-kontakter.
--
-- EN KÄLLA: MySales (GoHighLevel) äger kontakterna. Den här tabellen är en spegel, inget
-- annat. Cockpit skriver hit efter att ha läst MySales — aldrig utifrån någon annan tabell,
-- och aldrig tillbaka till MySales. Redigering sker där, Cockpit läser. Samma modell som
-- `fokus_opportunities` (lib/fokus/synk.ts), av samma skäl: två speglar som härleds ur
-- varandra driver isär i sak, och då vet ingen längre vilken som stämmer.
--
-- Nycklad på (tenant_id, ghl_contact_id): en location kan delas av flera coach_users
-- (Displayteknik har två), och båda måste få sin rad — annars ser den ena användaren en
-- spegel som aldrig uppdateras.
--
-- ⚠ PII. Tabellen bär namn, e-post och telefon. RLS på, inga anon-policies: kontakterna
-- läses bara genom server-routes med service-role, aldrig från webbläsaren.
-- (Se FAS 1-containment: `dm_pipeline_contacts` låstes av precis det skälet.)

create table if not exists kundregister_kontakter (
  tenant_id         uuid        not null,
  ghl_contact_id    text        not null,
  namn              text,
  foretag           text,
  epost             text,
  telefon           text,
  taggar            text[]      not null default '{}',
  kalla             text,
  -- MySales dateUpdated. Vad "senaste aktivitet" betyder ägs av MySales, inte av oss.
  senast_aktivitet  timestamptz,
  skapad_i_mysales  timestamptz,
  location_id       text,
  updated_at        timestamptz not null default now(),
  primary key (tenant_id, ghl_contact_id)
);

-- Listvyn sorterar på senaste aktivitet och filtrerar på tagg. Utan index blir båda
-- långsamma redan vid några tusen kontakter, och DT ligger på 137 i dag.
create index if not exists kundregister_kontakter_tenant_aktivitet_idx
  on kundregister_kontakter (tenant_id, senast_aktivitet desc nulls last);
create index if not exists kundregister_kontakter_taggar_idx
  on kundregister_kontakter using gin (taggar);

alter table kundregister_kontakter enable row level security;

comment on table kundregister_kontakter is
  'KUNDREGISTER-1: lasande spegel av MySales-kontakter per tenant. Skrivs enbart av '
  'lib/kundregister/synk.ts efter lasning mot GHL. Redigering sker i MySales.';

notify pgrst, 'reload schema';
