-- AKUT-KARUSELL — schemalagd karusell behåller alla sina slides.
--
-- Bakgrund (G-0, 2026-08-09): Studio kunde bygga en karusell på upp till tio slides, men
-- exporten och publiceringen fångade bara den slide användaren råkade titta på. Ett av
-- leden var kön: `studio_scheduled` har en enda `media_url`, så ett schemalagt
-- karusellinlägg hade publicerat omslaget och tappat resten — tyst.
--
-- Additivt: en nullbar kolumn. Befintliga jobb (media_url ensam) fungerar oförändrat,
-- och ett jobb utan slide_urls publiceras precis som förut.

ALTER TABLE public.studio_scheduled ADD COLUMN IF NOT EXISTS slide_urls text[];

COMMENT ON COLUMN public.studio_scheduled.slide_urls IS
  'Karusellens bilder i ordning (2-10). Null/tom = enkelt inlagg, media_url galler.';

NOTIFY pgrst, 'reload schema';
