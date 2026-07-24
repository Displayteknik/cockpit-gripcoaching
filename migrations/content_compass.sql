-- Content Compass CC-1 — datamodell. ADDITIV: bara nya nullbara kolumner + ny tabell + modul.
-- Rör INTE befintliga policies/kolumner. Befintliga flöden fungerar oförändrat när fälten är null.

-- 1. Metadata-kolumner på de fyra innehållstabellerna.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['studio_posts','hm_social_posts','linkedin_posts','hm_blog'] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS funnel_level text', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS four_a text', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS disc text[]', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS compass_source text', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS compass_confidence numeric(3,2)', t);
    -- CHECK-constraints (tål omkörning)
    BEGIN
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (funnel_level IS NULL OR funnel_level IN (''tofu'',''mofu'',''bofu''))', t, t||'_funnel_chk');
    EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (four_a IS NULL OR four_a IN (''analytical'',''aspirational'',''actionable'',''authentic''))', t, t||'_foura_chk');
    EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (compass_source IS NULL OR compass_source IN (''schedule'',''manual'',''auto''))', t, t||'_csrc_chk');
    EXCEPTION WHEN duplicate_object THEN NULL; END;
  END LOOP;
END $$;

-- 2. Per-tenant schema (speglar studio_brand_kits: en jsonb-blob per tenant).
CREATE TABLE IF NOT EXISTS public.content_compass_schedules (
  client_id  uuid PRIMARY KEY REFERENCES public.clients(id) ON DELETE CASCADE,
  schedule   jsonb NOT NULL,
  cadence    text NOT NULL DEFAULT '7' CHECK (cadence IN ('7','4','2-3')),
  source     text DEFAULT 'standard',
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.content_compass_schedules ENABLE ROW LEVEL SECURITY;
-- Inga anon-policies. Service-role (app) bypassar RLS. Speglar studio_brand_kits säkerhetsmodell.

-- 3. Registrera modulen (default AV: in_pro_default=false, active=true så den kan grindas per tenant).
INSERT INTO public.platform_modules (id, label, description, href, icon, owner_area, sort_order, active, in_pro_default)
VALUES ('compass', 'Content Compass', 'Automatisk funnel-, 4A- och DISC-profil på allt innehåll.', '/dashboard/content-compass', 'Compass', 'content', 95, true, false)
ON CONFLICT (id) DO NOTHING;

-- 4. Ladda om PostgREST-schemat så nya kolumner syns direkt.
NOTIFY pgrst, 'reload schema';
