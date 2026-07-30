-- ANSLUTNINGSMOTORN (2026-07-30) — server-only-tabeller enligt FAS 1B-mönstret.
-- Tre tabeller: ägar-Meta-koppling, per-tenant IG-koppling, hälsokontroll-historik.
-- Tokens lagras KRYPTERADE (AES-256-GCM via lib/crypto/token-vault) i *_enc-kolumner.
-- Säkerhet: RLS PÅ + noll anon/public-policies + REVOKE anon/authenticated → bara
-- service_role når dem (bypassar RLS). Ingen browser-väg får läsa dessa rader.

-- 1. Ägarens Meta-koppling (0–1 rad). Long-lived USER-token som kan minta page-tokens.
CREATE TABLE IF NOT EXISTS public.meta_owner_connection (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fb_user_id        text,
  fb_user_name      text,
  user_token_enc    text NOT NULL,
  token_expires_at  timestamptz,
  scopes            text[],
  connected_by      text,
  status            text NOT NULL DEFAULT 'ok',
  last_checked_at   timestamptz,
  last_error        text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- 2. Per-tenant IG-koppling (primär källa; clients.ig_* är fallback för DT/HM).
CREATE TABLE IF NOT EXISTS public.tenant_ig_connections (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id               uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  fb_page_id              text,
  page_name               text,
  page_token_enc          text NOT NULL,
  ig_business_account_id  text,
  ig_username             text,
  followers_count         integer,
  source                  text NOT NULL DEFAULT 'oauth',
  status                  text NOT NULL DEFAULT 'ok',
  last_checked_at         timestamptz,
  last_error              text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_ig_connections_client_id_key UNIQUE (client_id)
);

-- 3. Hälsokontroll-historik (ANSLUT-3). client_id NULL = ägar-token.
CREATE TABLE IF NOT EXISTS public.token_health_checks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  scope       text NOT NULL,
  status      text NOT NULL,
  detail      text,
  checked_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS token_health_checks_client_time_idx
  ON public.token_health_checks (client_id, checked_at DESC);

-- FAS 1B-lås: RLS på, noll policies (skapas aldrig), och dra alla anon/authenticated-grants.
ALTER TABLE public.meta_owner_connection  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_ig_connections  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_health_checks    ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.meta_owner_connection  FROM anon, authenticated;
REVOKE ALL ON public.tenant_ig_connections  FROM anon, authenticated;
REVOKE ALL ON public.token_health_checks    FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';
