-- FAS 1 CONTAINMENT (2026-07-19) — lås OAuth-tokens + DM-PII till service-role only.
-- Kontext: incident INCIDENT-2026-07-19.md. Routerna som rör google_connections använder
-- nu supabaseService (commit 7422e07, deployad); dm_pipeline_contacts använde redan service-role.
-- RLS är redan PÅ på båda. Vi drar de permissiva anon-policyerna → anon-rollen (publika nyckeln)
-- nekas helt; service-role bypassar RLS och appen fortsätter fungera.
--
-- KÖRS FÖRST EFTER att kod-deployen (7422e07) är Ready — annars bryts google-routerna i byggfönstret.

DROP POLICY IF EXISTS "anon all goog"      ON public.google_connections;
DROP POLICY IF EXISTS "anon_pipeline"      ON public.dm_pipeline_contacts;
DROP POLICY IF EXISTS "anon_dm_contacts"   ON public.dm_pipeline_contacts;

NOTIFY pgrst, 'reload schema';
