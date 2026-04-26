-- MULTI-TENANT MIGRATION — lägg client_id på hm_blog, hm_pages, hm_vehicles
-- Befintliga rader backfillas till HM Motor-klienten

DO $$
DECLARE
  hm_id uuid := '00000000-0000-0000-0000-000000000001';
BEGIN
  -- hm_blog
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hm_blog' AND column_name='client_id') THEN
    ALTER TABLE public.hm_blog ADD COLUMN client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE;
    UPDATE public.hm_blog SET client_id = hm_id WHERE client_id IS NULL;
    ALTER TABLE public.hm_blog ALTER COLUMN client_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS hm_blog_client_idx ON public.hm_blog(client_id);
  END IF;

  -- hm_pages
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hm_pages' AND column_name='client_id') THEN
    ALTER TABLE public.hm_pages ADD COLUMN client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE;
    UPDATE public.hm_pages SET client_id = hm_id WHERE client_id IS NULL;
    ALTER TABLE public.hm_pages ALTER COLUMN client_id SET NOT NULL;
    -- slug-unikhet ska vara per klient, inte globalt
    BEGIN
      ALTER TABLE public.hm_pages DROP CONSTRAINT IF EXISTS hm_pages_slug_key;
    EXCEPTION WHEN undefined_object THEN NULL; END;
    CREATE UNIQUE INDEX IF NOT EXISTS hm_pages_client_slug_uidx ON public.hm_pages(client_id, slug);
    CREATE INDEX IF NOT EXISTS hm_pages_client_idx ON public.hm_pages(client_id);
  END IF;

  -- hm_vehicles
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hm_vehicles' AND column_name='client_id') THEN
    ALTER TABLE public.hm_vehicles ADD COLUMN client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE;
    UPDATE public.hm_vehicles SET client_id = hm_id WHERE client_id IS NULL;
    ALTER TABLE public.hm_vehicles ALTER COLUMN client_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS hm_vehicles_client_idx ON public.hm_vehicles(client_id);
  END IF;
END $$;
