-- FAS 1B (2026-07-20) — kolumnlås hm_leads + hm_brand_profile (browser-lästa, PII/intern).
-- Server-läsarna är nu service-role (deployad). Browsern behöver bara:
--   hm_leads: id (count på owner-dashboard) — ALDRIG namn/telefon/mejl.
--   hm_brand_profile: publika kontakt/varumärkesfält på publika sidor — ALDRIG pricing_notes/strategi.
-- /k läser strategi via service-role → behöver ingen anon-grant.

-- ── hm_leads: bara id till anon (PII blockeras) ──
REVOKE INSERT, UPDATE, DELETE ON public.hm_leads FROM anon;
REVOKE SELECT ON public.hm_leads FROM anon;
GRANT SELECT (id) ON public.hm_leads TO anon;
DROP POLICY IF EXISTS "anon all leads" ON public.hm_leads;
CREATE POLICY hm_leads_anon_count ON public.hm_leads FOR SELECT TO anon USING (true);

-- ── hm_brand_profile: bara publika kontakt-/varumärkesfält till anon ──
-- Exkluderat (intern strategi + pricing): pricing_notes, brand_story, usp, icp_primary,
-- icp_secondary, tone_rules, dos, donts, pain_points, competitors, customer_journey,
-- differentiators, services, customer_quotes, hashtags_base, founder_name.
REVOKE INSERT, UPDATE, DELETE ON public.hm_brand_profile FROM anon;
REVOKE SELECT ON public.hm_brand_profile FROM anon;
GRANT SELECT (id, client_id, company_name, tagline, location, founder_phone, founder_email, booking_url)
  ON public.hm_brand_profile TO anon;
DROP POLICY IF EXISTS "anon all profile" ON public.hm_brand_profile;
CREATE POLICY hm_brand_profile_anon_read ON public.hm_brand_profile FOR SELECT TO anon USING (true);

NOTIFY pgrst, 'reload schema';
