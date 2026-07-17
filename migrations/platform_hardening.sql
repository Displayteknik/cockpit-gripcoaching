-- ============================================================================
-- SÄKERHETSHÄRDNING — stäng anon-exponerade tabeller (Fas 1, §3.6)
-- ============================================================================
-- Ripple-kontrollerat 2026-07-17: tre av fyra tabeller har LIVE-konsumenter på
-- anon-nyckeln (supabaseServer). Att bara droppa deras "open dev"-policy skulle
-- braka crons OCH kundens statistik-vy. Därför härdas bara det som är bevisat
-- säkert NU; resten stagas bakom en route-migrering (supabaseServer→supabaseService).
-- ============================================================================

-- ── SÄKERT NU: ikigai_sessions ──────────────────────────────────────────────
-- Alla 3 routes (public, generate, sessions) använder redan service-role.
-- Idag: RLS AV → anon-nyckeln kan läsa person_email (lead-PII). Slå på RLS →
-- endast service-role (bypass). Ingen policy = anon nekas allt.
ALTER TABLE public.ikigai_sessions ENABLE ROW LEVEL SECURITY;


-- ── STAGAT: kräver route-migrering FÖRE policy-drop (kör EJ ännu) ────────────
-- Dessa tabeller har konsumenter på anon-nyckeln. Migrera först varje route
-- från supabaseServer() → supabaseService(), verifiera, SEN avkommentera drop.
--
-- ideas_bank  → migrera: app/api/agents/ideas, app/api/agents/night-iterate,
--                        app/api/reports/weekly-cron
--   -- DROP POLICY IF EXISTS "open dev" ON public.ideas_bank;
--
-- gsc_queries_daily → migrera: app/api/google/gsc/cron, app/api/reports/weekly-cron,
--                              lib/dashboard-data.ts (OBS: matar /k besökar-vyn)
--   -- DROP POLICY IF EXISTS "open dev" ON public.gsc_queries_daily;
--
-- agent_experiments → migrera: app/api/agents/score-trend
--   -- DROP POLICY IF EXISTS "open dev" ON public.agent_experiments;
--
-- (art_works / art_exhibitions har medveten anon-LÄS för publika konst-sajter —
--  lämnas orörda; ingen känslig data, publikt utpris.)

NOTIFY pgrst, 'reload schema';
