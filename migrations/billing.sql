-- ============================================================================
-- BETAL-1 — kundfakturering, Stripe och betalspärr
-- ============================================================================
-- Bygger OVANPÅ K2-creditsystemet och KOSTNAD-1:s ledger. River ingenting:
-- credit_accounts/credit_transactions/credit_pricing/topup_orders lämnas orörda,
-- och en Stripe-påfyllning krediterar via samma laggTillCredits() som förut.
--
-- Säkerhetsmodell = FAS 1B: RLS PÅ, INGA anon-policies → anon nekas allt, endast
-- service-role via /api/*. Enum-fält har CHECK-constraint (lärdom: okänt värde ger
-- tyst insert-fel). Inga kortuppgifter lagras någonsin — allt kortrelaterat bor hos
-- Stripe. Stripes hemliga nyckel lagras krypterad (AES-256-GCM, lib/crypto/token-vault).
--
-- clients rörs INTE (kolumnlåst i fas1b_columnlock_clients.sql). Betalstatus bor i
-- en egen tabell.
-- ============================================================================


-- ── 1. billing_settings — ownerns egna uppgifter, en enda rad ───────────────
-- Nycklarna fylls i från /dashboard/betalning, inte i env. Skälet: Håkan ska kunna
-- byta från testläge till skarpt läge utan deploy. Env-varianterna behålls som
-- fallback (behåll-fungerande-väg) och läses när DB-fältet är tomt.
CREATE TABLE IF NOT EXISTS public.billing_settings (
  id                    int PRIMARY KEY DEFAULT 1 CHECK (id = 1),

  -- Stripe. secret_key lagras ALLTID krypterad ("enc:v1:…"). Läses aldrig till webbläsaren.
  stripe_lage           text NOT NULL DEFAULT 'test' CHECK (stripe_lage IN ('test','live')),
  stripe_secret_key     text,
  stripe_webhook_secret text,
  stripe_publik_nyckel  text,          -- pk_… är publik, behöver ingen kryptering

  -- Företagsuppgifter som ska synas på kvitto och betalsida.
  foretagsnamn          text,
  org_nr                text,
  moms_nr               text,
  momssats              numeric NOT NULL DEFAULT 25,
  faktura_avsandare     text,          -- e-post som påminnelser skickas från

  -- Dunning. Antal och intervall styrs härifrån, utan deploy.
  antal_paminnelser     int NOT NULL DEFAULT 3,
  paminnelse_dagar      int[] NOT NULL DEFAULT '{0,7,14}',
  gracedagar            int NOT NULL DEFAULT 0,
  dunning_aktiv         boolean NOT NULL DEFAULT false,  -- ★ spärren är AV tills Håkan slår på den

  updated_at            timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.billing_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.billing_settings ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS billing_settings_set_updated_at ON public.billing_settings;
CREATE TRIGGER billing_settings_set_updated_at
  BEFORE UPDATE ON public.billing_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ── 2. billing_plans — produkter och priser, ägarstyrt utan deploy ──────────
-- Samma princip som credit_pricing: priset ändras i vyn, inte i koden.
CREATE TABLE IF NOT EXISTS public.billing_plans (
  id               text PRIMARY KEY,           -- 'pro_intro' | 'pro_ordinarie' | 'topup_100'
  label            text NOT NULL,              -- kundvänt namn
  beskrivning      text,                       -- vad som ingår, i klartext
  typ              text NOT NULL DEFAULT 'abonnemang'
                     CHECK (typ IN ('abonnemang','engang')),
  belopp_sek       numeric NOT NULL,           -- EX moms
  intervall        text NOT NULL DEFAULT 'manad'
                     CHECK (intervall IN ('manad','kvartal','ar','engang')),
  credits          int,                        -- antal tokens vid engångsköp
  stripe_price_id  text,                       -- fylls när priset skapats i Stripe
  stripe_product_id text,
  sort_order       int NOT NULL DEFAULT 100,
  active           boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.billing_plans (id, label, beskrivning, typ, belopp_sek, intervall, credits, sort_order)
VALUES
  ('pro_intro',      'MySales Pro (intropris)', 'Hela MySales Pro till introduktionspris.', 'abonnemang', 1990, 'manad', NULL, 10),
  ('pro_ordinarie',  'MySales Pro',             'Hela MySales Pro.',                        'abonnemang', 2490, 'manad', NULL, 20),
  ('topup_100',      '100 tokens',              'Extra tokens som läggs till direkt.',      'engang',      149, 'engang', 100, 30)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.billing_plans ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS billing_plans_set_updated_at ON public.billing_plans;
CREATE TRIGGER billing_plans_set_updated_at
  BEFORE UPDATE ON public.billing_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ── 3. billing_avtal — kundaffärerna, EN rad per kund ───────────────────────
-- ★ Den här tabellen är poängen med hela vyn: Håkan ska kunna föra in de affärer
-- som redan rullar (faktura utanför systemet) och direkt se när nästa betalning
-- kommer. När en kund flyttas till Stripe byter raden `kalla` till 'stripe' och
-- nästa betalning läses då ur abonnemanget i stället för ur fältet här.
CREATE TABLE IF NOT EXISTS public.billing_avtal (
  client_id        uuid PRIMARY KEY REFERENCES public.clients(id) ON DELETE CASCADE,
  plan_id          text REFERENCES public.billing_plans(id) ON DELETE SET NULL,

  -- Fritt belopp vinner över planens belopp (rabatt, specialavtal, gammalt pris).
  belopp_sek       numeric,                    -- EX moms. NULL = använd planens belopp
  intervall        text NOT NULL DEFAULT 'manad'
                     CHECK (intervall IN ('manad','kvartal','ar','engang')),
  betalsatt        text NOT NULL DEFAULT 'faktura'
                     CHECK (betalsatt IN ('stripe','faktura','swish','annat')),
  kalla            text NOT NULL DEFAULT 'manuell'
                     CHECK (kalla IN ('manuell','stripe')),

  startdatum       date,
  nasta_betalning  date,                       -- manuell källa: fylls i/räknas fram här
  bindningstid_slut date,
  status           text NOT NULL DEFAULT 'aktiv'
                     CHECK (status IN ('aktiv','pausad','avslutad')),

  faktura_epost    text,                       -- dit påminnelser går. clients saknar e-postkolumn
  kontaktperson    text,
  anteckning       text,

  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS billing_avtal_nasta_idx ON public.billing_avtal (nasta_betalning)
  WHERE status = 'aktiv';

ALTER TABLE public.billing_avtal ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS billing_avtal_set_updated_at ON public.billing_avtal;
CREATE TRIGGER billing_avtal_set_updated_at
  BEFORE UPDATE ON public.billing_avtal
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ── 4. billing_customers — en Stripe-kund per tenant ────────────────────────
CREATE TABLE IF NOT EXISTS public.billing_customers (
  client_id          uuid PRIMARY KEY REFERENCES public.clients(id) ON DELETE CASCADE,
  stripe_customer_id text NOT NULL UNIQUE,
  epost              text,
  lage               text NOT NULL DEFAULT 'test' CHECK (lage IN ('test','live')),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_customers ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS billing_customers_set_updated_at ON public.billing_customers;
CREATE TRIGGER billing_customers_set_updated_at
  BEFORE UPDATE ON public.billing_customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ── 5. billing_subscriptions — spegel av Stripe, aldrig sanningen ───────────
-- Stripe äger abonnemanget. Den här raden finns för att vyerna ska kunna visa
-- nästa debitering utan ett API-anrop per sidladdning.
CREATE TABLE IF NOT EXISTS public.billing_subscriptions (
  client_id              uuid PRIMARY KEY REFERENCES public.clients(id) ON DELETE CASCADE,
  stripe_subscription_id text NOT NULL UNIQUE,
  plan_id                text REFERENCES public.billing_plans(id) ON DELETE SET NULL,
  stripe_status          text,                 -- Stripes egna ord, orörda
  belopp_sek             numeric,
  intervall              text,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean NOT NULL DEFAULT false,
  updated_at             timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_subscriptions ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS billing_subscriptions_set_updated_at ON public.billing_subscriptions;
CREATE TRIGGER billing_subscriptions_set_updated_at
  BEFORE UPDATE ON public.billing_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ── 6. billing_status — statusmaskinen. ENDA källan för spärren ─────────────
-- aktiv → forsenad (första misslyckade debiteringen) → paminnelser → sparrad.
-- owner_override slår ALLTID automatiken, åt båda hållen.
CREATE TABLE IF NOT EXISTS public.billing_status (
  client_id            uuid PRIMARY KEY REFERENCES public.clients(id) ON DELETE CASCADE,
  status               text NOT NULL DEFAULT 'aktiv'
                         CHECK (status IN ('aktiv','forsenad','paminnelser','sparrad')),
  forsta_misslyckande  timestamptz,            -- dag 0 i påminnelsetrappan
  paminnelser_skickade int NOT NULL DEFAULT 0,
  senaste_paminnelse   timestamptz,
  sparrad_at           timestamptz,
  senaste_faktura_id   text,
  owner_override       text CHECK (owner_override IN ('frys','las_upp')),
  override_note        text,
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS billing_status_status_idx ON public.billing_status (status)
  WHERE status <> 'aktiv';

ALTER TABLE public.billing_status ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS billing_status_set_updated_at ON public.billing_status;
CREATE TRIGGER billing_status_set_updated_at
  BEFORE UPDATE ON public.billing_status
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ── 7. billing_invoices — kvittolistan ──────────────────────────────────────
-- Beloppen sparas i kronor (Stripe räknar i ören — omräkningen sker i koden, EN gång).
CREATE TABLE IF NOT EXISTS public.billing_invoices (
  stripe_invoice_id   text PRIMARY KEY,
  client_id           uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  nummer              text,
  belopp_ex_moms_sek  numeric,
  moms_sek            numeric,
  belopp_sek          numeric,
  valuta              text DEFAULT 'sek',
  status              text,                    -- paid | open | uncollectible | void | draft
  faktura_datum       timestamptz,
  betald_datum        timestamptz,
  forfallodatum       timestamptz,
  hosted_invoice_url  text,
  invoice_pdf_url     text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS billing_invoices_client_idx
  ON public.billing_invoices (client_id, faktura_datum DESC);

ALTER TABLE public.billing_invoices ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS billing_invoices_set_updated_at ON public.billing_invoices;
CREATE TRIGGER billing_invoices_set_updated_at
  BEFORE UPDATE ON public.billing_invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ── 8. billing_events — allt Stripe säger, ordagrant ────────────────────────
-- ★ stripe_event_id UNIQUE är idempotensen. Stripe levererar om samma händelse vid
-- nätverksstrul; utan det unika indexet skulle en påfyllning kunna krediteras dubbelt.
CREATE TABLE IF NOT EXISTS public.billing_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id text UNIQUE,
  client_id       uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  typ             text NOT NULL,
  sammanfattning  text,                        -- en rad på svenska, för ownervyn
  payload         jsonb,
  hanterad        boolean NOT NULL DEFAULT false,
  fel             text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS billing_events_created_idx ON public.billing_events (created_at DESC);
CREATE INDEX IF NOT EXISTS billing_events_client_idx  ON public.billing_events (client_id, created_at DESC);

ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;


-- ── 9. Kundens betalsida i modulregistret ───────────────────────────────────
-- in_pro_default = true: betalsidan ska finnas för ALLA betalande kunder. En spärrad
-- kund som inte når betalsidan kan inte betala sig ut ur spärren.
INSERT INTO public.platform_modules
  (id, label, description, href, icon, owner_area, sort_order, active, in_pro_default)
VALUES
  ('betalning', 'Abonnemang och kvitton', 'Nästa betalning, kvitton och betalkort.', '/k/betalning', 'CreditCard', 'Konto', 200, true, true)
ON CONFLICT (id) DO UPDATE SET
  label       = EXCLUDED.label,
  description = EXCLUDED.description,
  href        = EXCLUDED.href,
  icon        = EXCLUDED.icon,
  owner_area  = EXCLUDED.owner_area,
  updated_at  = now();


-- ── PGRST schema-reload (annars 404 mot nya tabeller) ───────────────────────
NOTIFY pgrst, 'reload schema';
