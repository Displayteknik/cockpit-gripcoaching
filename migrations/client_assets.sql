-- ============================================================================
-- CLIENT_ASSETS: kunskapsbank per klient (egna inlägg, foton, ljud, video, citat)
-- ============================================================================
-- Strikt RLS från start: anon nekas allt. Server-API i Cockpit/MySales Pro
-- ska anropa via service-role-nyckeln efter att den verifierat client_id-cookie
-- (Cockpit) eller JWT (MySales Pro, framtida).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.client_assets (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,

  -- typer: 'post' (eget inlägg/text), 'photo', 'audio', 'video',
  --        'testimonial' (kundvittnesmål), 'link' (extern URL), 'document'
  asset_type   text NOT NULL CHECK (asset_type IN
                ('post','photo','audio','video','testimonial','link','document')),

  -- för foton: 'person' | 'venue' | 'process' | 'customer' | 'product' | 'other'
  -- för posts: 'caption' | 'reel_script' | 'story_script' | 'long_form'
  -- (fritextsfält så vi kan utöka utan migration)
  category     text,

  title        text,
  body         text,                       -- text för posts/citat, transkription för audio/video
  source_url   text,                       -- ursprung (om import från IG/Facebook)

  -- storage references (privat bucket: 'client-assets')
  storage_path text,                       -- t.ex. <client_id>/photo/abc.jpg
  mime_type    text,
  file_bytes   bigint,
  duration_s   integer,                    -- för audio/video

  -- vittnesmål-specifika fält
  person_name  text,
  person_label text,                       -- t.ex. "kund Krokom" eller "ålder 45"

  -- AI-extraherade metadata
  tags         text[] DEFAULT '{}',
  ai_summary   text,
  voice_score  numeric(3,2),               -- 0-1: hur typiskt klientens röst (för posts)

  -- workflow
  status       text NOT NULL DEFAULT 'active'
                CHECK (status IN ('active','archived','processing','failed')),
  notes        text,

  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS client_assets_client_idx ON public.client_assets(client_id);
CREATE INDEX IF NOT EXISTS client_assets_type_idx ON public.client_assets(client_id, asset_type);
CREATE INDEX IF NOT EXISTS client_assets_status_idx ON public.client_assets(client_id, status);
CREATE INDEX IF NOT EXISTS client_assets_tags_gin ON public.client_assets USING GIN (tags);

-- Strikt RLS — endast service-role får skriva/läsa
ALTER TABLE public.client_assets ENABLE ROW LEVEL SECURITY;

-- Inga anon-policies → anon nekas allt automatiskt
-- service_role har full access genom Supabase default (bypassar RLS)

-- Trigger för updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS client_assets_set_updated_at ON public.client_assets;
CREATE TRIGGER client_assets_set_updated_at
  BEFORE UPDATE ON public.client_assets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- BRAND_PROFILE — nya fält: differentiators, booking_url, voice_audio_count
-- ============================================================================

ALTER TABLE public.hm_brand_profile
  ADD COLUMN IF NOT EXISTS differentiators text,
  ADD COLUMN IF NOT EXISTS booking_url     text,
  ADD COLUMN IF NOT EXISTS services        text,
  ADD COLUMN IF NOT EXISTS pricing_notes   text;

-- ============================================================================
-- STORAGE — privat bucket "client-assets"
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('client-assets', 'client-assets', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: endast service-role har access (default när inga policies finns)
-- (storage.objects har RLS på by default; vi lägger inga anon-policies)

-- ============================================================================
-- VOICE_PROFILE: aggregerade voice-fingerprint per klient (cache)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.client_voice_profile (
  client_id        uuid PRIMARY KEY REFERENCES public.clients(id) ON DELETE CASCADE,

  -- AI-extraherade mönster från client_assets-poster av typ 'post'/'audio'/'video'
  signature_phrases text[] DEFAULT '{}',
  forbidden_words   text[] DEFAULT '{}',
  tone_summary      text,
  rhythm_notes      text,            -- meningslängd, frågefrekvens, talspråk
  pain_words        text[] DEFAULT '{}',
  joy_words         text[] DEFAULT '{}',

  source_asset_count integer DEFAULT 0,
  last_built_at     timestamptz,

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_voice_profile ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS client_voice_profile_set_updated_at ON public.client_voice_profile;
CREATE TRIGGER client_voice_profile_set_updated_at
  BEFORE UPDATE ON public.client_voice_profile
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
