-- FAS 1B BATCH 2 (2026-07-20) — lås server-only-tabeller till service-role.
-- browser=0 för alla dessa (verifierat); routerna som rör dem är nu supabaseService (deployad).
-- RLS är redan PÅ. Vi drar ALLA anon/public-policies → anon nekas helt, service-role bypassar.
-- Robust drop via DO-block (matchar policynamn dynamiskt).

DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'gsc_queries','linkedin_posts','linkedin_pillars','linkedin_history',
        'intake_sessions','intake_proposals','intake_clarifications',
        'competitors','weekly_reports','customer_voice'
      )
      AND (roles @> array['anon']::name[] OR roles @> array['public']::name[])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
