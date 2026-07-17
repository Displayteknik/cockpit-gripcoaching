-- ============================================================================
-- MYSALES PRO — PLATTFORMEN: roller, modulregister & entitlements (Fas 1)
-- ============================================================================
-- Affärsmodell: MySales Pro = GHL-bas + ett konfigurerbart urval Cockpit-moduler.
-- Detta bygger DB-lagret: modulregistret (EN källa), Pro-standarduppsättning
-- (EN plats), kampanjmekanik, per-tenant-overrides och per-användar-roller.
--
-- Säkerhet (Path A, godkänd 2026-07-17): app-nivå-lås består (service-role +
-- getActiveClientId). Alla NYA tabeller får STRIKT RLS från start — RLS på,
-- INGA anon-policies → anon nekas allt, endast service-role via /api/* som
-- verifierar tenant. Enum-fält har CHECK-constraint (lärdom: okänt värde →
-- tyst insert-fel). Matchar konventionen i client_assets.sql.
-- ============================================================================

-- ── 1. clients.plan ─────────────────────────────────────────────────────────
-- Alla nuvarande Cockpit-klienter = 'pro'. 'mysales' = bara basen (inga
-- Cockpit-moduler utom manuella tillägg via tenant_modules).
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'pro'
    CHECK (plan IN ('mysales','pro'));


-- ── 2. platform_modules — modulregistret (EN källa) ─────────────────────────
-- Ersätter den hårdkodade CUSTOMER_FEATURES-listan som sanningskälla.
-- Pro-standard = raderna med in_pro_default=true  → ändras på ETT ställe,
-- slår mot ALLA pro-tenants. Kampanjfälten ligger här (det finns EN Pro-
-- uppsättning; tenant-specifika prisplaner = v2).
CREATE TABLE IF NOT EXISTS public.platform_modules (
  id             text PRIMARY KEY,            -- maskinnyckel ('seo','skapa' …)
  label          text NOT NULL,              -- kundvänligt svenskt namn
  description    text,                        -- en rad
  href           text,                        -- /k-route
  icon           text,                        -- lucide-namn (ikon-map i TS)
  owner_area     text,                        -- nav-grupp (informativt)
  sort_order     integer NOT NULL DEFAULT 100,
  active         boolean NOT NULL DEFAULT true,   -- false = registrerad, ingen kundvy än
  in_pro_default boolean NOT NULL DEFAULT false,  -- ★ ingår i MySales Pro-standard
  campaign       boolean NOT NULL DEFAULT false,  -- ★ "Ingår just nu"-kampanj
  campaign_label text,                            -- "Just nu ingår även Instagram-motorn"
  campaign_until date,                            -- valfritt utgångsdatum
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_modules ENABLE ROW LEVEL SECURITY;
-- Inga anon-policies → endast service-role (via /api). Katalogen läses serverside.

DROP TRIGGER IF EXISTS platform_modules_set_updated_at ON public.platform_modules;
CREATE TRIGGER platform_modules_set_updated_at
  BEFORE UPDATE ON public.platform_modules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ── 3. tenant_modules — per-tenant-overrides (ge/ta enskild modul) ──────────
-- enabled=true  → manuellt tillägg (utanför Pro-standard, t.ex. GDÅM-kund)
-- enabled=false → manuellt avdrag (dra en standard-modul för en kund)
-- source spåras för admin Vy 2-visning (Standard/Kampanj/Manuell).
CREATE TABLE IF NOT EXISTS public.tenant_modules (
  client_id   uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  module_id   text NOT NULL REFERENCES public.platform_modules(id) ON DELETE CASCADE,
  enabled     boolean NOT NULL,
  source      text NOT NULL DEFAULT 'manuell'
                CHECK (source IN ('standard','kampanj','manuell')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (client_id, module_id)
);

CREATE INDEX IF NOT EXISTS tenant_modules_client_idx ON public.tenant_modules(client_id);

ALTER TABLE public.tenant_modules ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS tenant_modules_set_updated_at ON public.tenant_modules;
CREATE TRIGGER tenant_modules_set_updated_at
  BEFORE UPDATE ON public.tenant_modules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ── 4. platform_users — per-användar-mappning (email → tenant + roll) ───────
-- Inga delade konton, aldrig lösenord i klartext. Magic-link-token per användare
-- (ersätter den delade klient-token:en). Löser sig ovanpå den befintliga
-- HttpOnly kund-session-cookien. 'customer_member' reserverat, ingen UI byggs.
-- Owner (Håkan) = client_id NULL; hans befintliga admin-session är oförändrad.
CREATE TABLE IF NOT EXISTS public.platform_users (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email            text NOT NULL,
  client_id        uuid REFERENCES public.clients(id) ON DELETE CASCADE,  -- NULL = owner
  role             text NOT NULL CHECK (role IN ('owner','customer','customer_member')),
  login_token      text UNIQUE,              -- per-användar magic-link
  token_expires_at timestamptz,
  invited_at       timestamptz NOT NULL DEFAULT now(),
  activated_at     timestamptz,
  active           boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- E-post unik per tenant (samma person kan vara owner + kund i olika tenants).
CREATE UNIQUE INDEX IF NOT EXISTS platform_users_email_client_idx
  ON public.platform_users(lower(email), coalesce(client_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX IF NOT EXISTS platform_users_client_idx ON public.platform_users(client_id);

ALTER TABLE public.platform_users ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS platform_users_set_updated_at ON public.platform_users;
CREATE TRIGGER platform_users_set_updated_at
  BEFORE UPDATE ON public.platform_users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ── 5. Seed modulregistret ──────────────────────────────────────────────────
-- 7 live-moduler (Pro-standard) + 3 kommande (registrerade, active=false tills
-- en /k-vy byggs i senare session). Idempotent: uppdaterar label/beskrivning
-- men RÖR ALDRIG in_pro_default/campaign (de styrs av admin Vy 1 efter seed).
INSERT INTO public.platform_modules
  (id, label, description, href, icon, owner_area, sort_order, active, in_pro_default)
VALUES
  ('profil',    'Varumärke & röst',       'Din röst, dina kunder och din ICP — grunden AI:n skriver utifrån.', '/k/profil',    'Target',     'Varumärke',  10, true,  true),
  ('seo',       'SEO & AEO',              'Sid-analys, åtgärdslista och sökords-tracker för din egen sajt.',   '/k/seo',       'TrendingUp', 'SEO & sajt', 20, true,  true),
  ('besokare',  'Statistik & synlighet',  'Besök, kanaler, Google-sök och AI-synlighet på ett ställe.',        '/k/besokare',  'Globe',      'Kunder',     30, true,  true),
  ('skapa',     'Innehållsstudio',        'Skapa on-brand inlägg, bilder, karuseller och reels i din röst.',   '/k/skapa',     'Sparkles',   'Innehåll',   40, true,  true),
  ('ideer',     'Idé-bank',               'Granska och godkänn AI-genererade idéer och utkast.',               '/k/ideer',     'Lightbulb',  'Innehåll',   50, true,  true),
  ('veckoplan', 'Veckoplan',              'Sju färdiga inlägg enligt veckorytmen.',                            '/k/veckoplan', 'Calendar',   'Innehåll',   60, true,  true),
  ('dm',        'DM & Pipeline',          'Följ kontakter från kommentar till bokad kund.',                    '/k/dm',        'Users',      'Kunder',     70, true,  true),
  ('linkedin',  'LinkedIn-motorn',        'Skriv och planera LinkedIn-innehåll i din röst.',                   '/k/linkedin',  'Linkedin',   'Innehåll',   80, false, false),
  ('mejl',      'Mejl-motorn',            'Bygg mejl-kampanjer och sekvenser.',                                '/k/mejl',      'Mail',       'Innehåll',   90, false, false),
  ('ikigai',    'Ikigai-motor',           'Lead-magnet som fångar och kvalificerar intressenter.',             '/k/ikigai',    'Compass',    'Kunder',    100, false, false)
ON CONFLICT (id) DO UPDATE SET
  label       = EXCLUDED.label,
  description = EXCLUDED.description,
  href        = EXCLUDED.href,
  icon        = EXCLUDED.icon,
  owner_area  = EXCLUDED.owner_area,
  sort_order  = EXCLUDED.sort_order,
  updated_at  = now();
-- Not: active/in_pro_default sätts BARA vid första insert (ej i DO UPDATE) så
-- Håkans admin-val i Vy 1 aldrig skrivs över av en ny körning.

-- ── PGRST schema-reload (annars 404 mot nya tabeller) ───────────────────────
NOTIFY pgrst, 'reload schema';
