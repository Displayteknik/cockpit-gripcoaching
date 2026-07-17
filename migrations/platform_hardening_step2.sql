-- ============================================================================
-- SÄKERHETSHÄRDNING STEG 2 — stäng de tre anon-öppna tabellerna
-- ============================================================================
-- FÖRUTSÄTTNING: koden som läser dessa tabeller är migrerad supabaseServer→
-- supabaseService OCH DEPLOYAD. Kör denna migration FÖRST EFTER att den koden
-- är live (annars träffar live anon-kod en låst tabell). Migrerade routes:
--   ideas_bank        → agents/ideas, agents/night-iterate, reports/weekly-cron
--   gsc_queries_daily → google/gsc/cron, reports/weekly-cron, lib/dashboard-data
--   agent_experiments → agents/score-trend
-- RLS är redan på dessa tabeller; att droppa enda policyn ("open dev") → anon
-- nekas allt, endast service-role (bypass). [[PL-001]]
-- ============================================================================

DROP POLICY IF EXISTS "open dev" ON public.ideas_bank;
DROP POLICY IF EXISTS "open dev" ON public.gsc_queries_daily;
DROP POLICY IF EXISTS "open dev" ON public.agent_experiments;

NOTIFY pgrst, 'reload schema';
