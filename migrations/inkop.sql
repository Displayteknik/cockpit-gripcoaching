-- K3-INKÖP (STEG 3b) — leverantörssaldon, prognos, larm och köprekommendation.
--
-- Motivet: Gemini-betalningsspärren 1 augusti 2026 syntes bara som en statuskod
-- (403 "Lightning dunning decision is deny") och stoppade allt som gick genom Google.
-- Ingen visste att det var på väg. Den här modulen svarar på frågan INNAN det händer:
-- hur mycket finns kvar hos varje leverantör, hur fort går det åt, och när tar det slut.
--
-- Bygger OVANPÅ KOSTNAD-1: förbrukningstakten räknas ur ai_usage_events, felläget ur
-- vyn ai_provider_health. Ingen egen mätning, ingen parallell sanning.
--
-- Server-only. Ingen anon-policy på någon tabell här: allt läses och skrivs via
-- service-role bakom huvudadmin-grinden i /api/kostnader.

-- ── Ett konto per leverantör ──────────────────────────────────────────────
create table if not exists public.provider_accounts (
  id                   uuid primary key default gen_random_uuid(),
  -- Kontots leverantör. Skiljer sig med flit från ai_usage_events.provider: ett konto
  -- kan bära flera provider-nycklar (google_cloud betalar både Gemini och PageSpeed).
  provider             text not null unique
                       check (provider in ('fal','google_cloud','anthropic','resend','elks46','ovrig')),
  etikett              text not null,
  -- forbetalt = pengar ligger på kontot i förväg, efterskott = faktura i efterhand.
  typ                  text not null check (typ in ('forbetalt','efterskott')),
  saldo_belopp         numeric,
  saldo_valuta         text not null default 'SEK',
  -- api = hämtat automatiskt med befintlig nyckel, manuellt = ägaren skrev in det.
  -- ⚠ Gissa ALDRIG ett saldo. Saknas API:t står det "manuellt" med sin ålder i vyn.
  saldo_kalla          text not null default 'manuellt' check (saldo_kalla in ('api','manuellt')),
  saldo_uppdaterad     timestamptz,
  -- Gick den automatiska hämtningen fel sparas orsaken här och visas i vyn. Ett gammalt
  -- saldo med synlig orsak är sant; ett tyst nollat saldo är en lögn.
  saldo_fel            text,
  betalkort_sista_fyra text,
  -- Efterskott: förra fakturans belopp i kronor. Prognosen jämförs mot den.
  forra_fakturan_sek   numeric,
  forra_fakturan_datum date,
  -- Providerns påfyllningssteg i kontots valuta, om det är känt. NULL = okänt, då
  -- avrundas rekommendationen till ett jämnt belopp i stället.
  pafyllningssteg      numeric,
  fakturalank          text,
  notering             text,
  aktiv                boolean not null default true,
  sort_order           int not null default 100,
  uppdaterad           timestamptz not null default now()
);
create index if not exists provider_accounts_sort_idx on public.provider_accounts (sort_order, etikett);
alter table public.provider_accounts enable row level security;

-- ── Larmtrösklarna, ägarstyrda utan deploy ────────────────────────────────
-- Startvärdena är de beställda: gult under 14 dagar kvar eller prognos över 150 procent
-- av förra fakturan, rött under 5 dagar. De ligger i en tabell och inte i kod av två
-- skäl: ägaren ska kunna skruva dem, och larmkedjan ska gå att bevisa skarpt genom att
-- sänka tröskeln och se raden dyka upp i båda vyerna.
create table if not exists public.inkop_konfig (
  id                  smallint primary key default 1 check (id = 1),
  gul_dagar           int not null default 14,
  rod_dagar           int not null default 5,
  gul_prognos_procent int not null default 150,
  uppdaterad          timestamptz not null default now()
);
alter table public.inkop_konfig enable row level security;
insert into public.inkop_konfig (id) values (1) on conflict (id) do nothing;

-- ── Marginal per kund: koppling mellan intäktsraden och tenanten ──────────
-- Intäkten bor redan i hq_mrr_entries (LIKVID-1/HQ-1). Den byggs INTE om. Här läggs
-- bara en frivillig koppling till klienten, så marginalen kan räknas utan att gissa på
-- namnlikhet. Är kolumnen tom faller uträkningen tillbaka på exakt namnmatchning.
alter table public.hq_mrr_entries add column if not exists client_id uuid;
create index if not exists hq_mrr_entries_client_idx on public.hq_mrr_entries (client_id);

-- ── Förberedelse för lead-credits (ingen ICP-byggnad här) ─────────────────
-- Raderna finns men är AVSTÄNGDA och kostar noll. Prissättningen sätts först när
-- ICP-motorns kostnadskarta finns ur verklig drift, inte gissad i förväg.
alter table public.credit_pricing add column if not exists note text;

insert into public.credit_pricing (action, credits, label, active, note) values
  ('lead_niva_a', 0, 'Lead nivå A', false,
   'Priset sätts när ICP-motorns kostnadskarta finns ur verklig drift. Raden är avstängd och kostar noll tills dess.'),
  ('lead_niva_b', 0, 'Lead nivå B', false,
   'Priset sätts när ICP-motorns kostnadskarta finns ur verklig drift. Raden är avstängd och kostar noll tills dess.')
on conflict (action) do nothing;

-- ── Startrader ────────────────────────────────────────────────────────────
-- Saldo och belopp lämnas TOMMA med flit. Ett påhittat saldo är värre än ett tomt:
-- 46elks och Fal.ai fyller sina själva vid första sidladdningen, resten är Håkans
-- att skriva in. pafyllningssteg är null överallt eftersom stegen inte är verifierade.
insert into public.provider_accounts (provider, etikett, typ, saldo_valuta, saldo_kalla, fakturalank, sort_order, notering) values
  ('fal',          'Fal.ai',                          'forbetalt', 'USD', 'api',
   'https://fal.ai/dashboard/billing',            10,
   'Saldot läses automatiskt med befintlig FAL_KEY, högst en gång i timmen.'),
  ('elks46',       '46elks (SMS)',                    'forbetalt', 'SEK', 'api',
   'https://dashboard.46elks.com/',               20,
   'Saldot läses automatiskt med befintliga 46elks-nycklar, högst en gång i timmen.'),
  ('google_cloud', 'Google Cloud (Gemini, PageSpeed)','efterskott','SEK', 'manuellt',
   'https://console.cloud.google.com/billing',    30,
   'Faktureras i efterskott. Fyll i förra fakturans belopp så jämförs prognosen mot den. Det var här spärren slog till 1 augusti.'),
  ('anthropic',    'Anthropic',                       'forbetalt', 'USD', 'manuellt',
   'https://console.anthropic.com/settings/billing', 40,
   'Saldot går inte att läsa med den vanliga API-nyckeln. Skriv in det från konsolen, så räknas dagar kvar på samma sätt som för Fal.ai.'),
  ('resend',       'Resend (mejl)',                   'efterskott','SEK', 'manuellt',
   'https://resend.com/settings/billing',         50,
   'Faktureras i efterskott. Fyll i förra fakturans belopp så jämförs prognosen mot den.')
on conflict (provider) do nothing;

notify pgrst, 'reload schema';
