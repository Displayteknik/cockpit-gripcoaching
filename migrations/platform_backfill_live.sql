-- ============================================================================
-- BACKFILL — bevara live-klienternas NUVARANDE modulset (Fas 2)
-- ============================================================================
-- Innan koden byter från customer_features → effektiv behörighet: skriv varje
-- live-klients nuvarande set som explicita tenant_modules-overrides, så att
-- effektiv behörighet == exakt det klienten ser IDAG. Ingen live-klient (t.ex.
-- Carl-Fredrik: seo/besokare/profil) får se en enda modul mer eller mindre.
--
-- Klienter med customer_features = NULL hoppas över: NULL = alla moduler idag,
-- och effektiv = de 7 Pro-standard = samma set → ingen ändring, ingen backfill.
-- Idempotent (ON CONFLICT DO NOTHING) — kan köras om.
-- ============================================================================

-- 1. Manuella AVDRAG: en Pro-standard-modul som klienten INTE har idag.
INSERT INTO public.tenant_modules (client_id, module_id, enabled, source)
SELECT c.id, m.id, false, 'manuell'
FROM public.clients c
CROSS JOIN public.platform_modules m
WHERE c.customer_access_enabled
  AND c.customer_features IS NOT NULL
  AND c.plan = 'pro'
  AND m.in_pro_default
  AND NOT (m.id = ANY(c.customer_features))
ON CONFLICT (client_id, module_id) DO NOTHING;

-- 2. Manuella TILLÄGG: en modul klienten HAR idag men som inte är Pro-standard.
INSERT INTO public.tenant_modules (client_id, module_id, enabled, source)
SELECT c.id, m.id, true, 'manuell'
FROM public.clients c
CROSS JOIN public.platform_modules m
WHERE c.customer_access_enabled
  AND c.customer_features IS NOT NULL
  AND m.id = ANY(c.customer_features)
  AND NOT m.in_pro_default
ON CONFLICT (client_id, module_id) DO NOTHING;

NOTIFY pgrst, 'reload schema';
