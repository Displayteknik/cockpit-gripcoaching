-- FAS 1B (2026-07-20) — KOLUMNLÅS clients: hemligheter bort från anon, säkra kolumner kvar.
-- Browsern behöver clients för id/namn/slug/färg/public_url — ALDRIG för hemligheterna.
-- Alla server-läsare av hemlighetskolumner är nu service-role (deploy före denna migration).
--
-- Exkluderade från anon (credentials + PII): ig_access_token, ghl_webhook_url, ghl_api_key,
-- customer_token, customer_pin, ghl_pit, report_recipients.
-- Beviskälla för att inga anon-läsare bryts: alla kvarvarande anon-routes selectar bara
-- {id,name,industry,public_url,primary_color,slug} (verifierat 2026-07-20).

-- 1. Bort med anon SKRIV (browsern skriver aldrig clients).
REVOKE INSERT, UPDATE, DELETE ON public.clients FROM anon;

-- 2. Kolumnlås läsning: dra table-wide SELECT, granta bara ofarliga kolumner.
REVOKE SELECT ON public.clients FROM anon;
GRANT SELECT (
  id, slug, name, industry, public_url, primary_color, resource_module,
  archived, created_at, updated_at, ig_handle, ig_account_id, fb_page_id,
  ghl_location_id, customer_access_enabled, customer_features, plan
) ON public.clients TO anon;

-- 3. RLS: ersätt "anon all clients" (cmd ALL) med SELECT-only så inga anon-writes på row-nivå.
DROP POLICY IF EXISTS "anon all clients" ON public.clients;
CREATE POLICY clients_anon_read ON public.clients FOR SELECT TO anon USING (true);

NOTIFY pgrst, 'reload schema';
