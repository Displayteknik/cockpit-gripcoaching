-- ============================================================================
-- DM PIPELINE — ACO Kanban (Acknowledge / Connect / Offer)
-- + DM Automation Rules (nyckelord → auto-svar)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.dm_pipeline_contacts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,

  ig_username  text NOT NULL,
  ig_user_id   text,                       -- valfritt — Instagram-user-ID om känt
  display_name text,
  source       text,                        -- 'kommentar' | 'dm' | 'manuell' | 'import'
  source_post  text,                        -- länk till inlägg som triggade

  stage        text NOT NULL DEFAULT 'new'
                CHECK (stage IN ('new','acknowledge','connect','offer','won','lost')),

  notes        text,
  next_action  text,                        -- vad du planerar nästa
  next_action_at timestamptz,

  -- GHL-synk
  ghl_contact_id text,                      -- om kontakten finns i GoHighLevel
  synced_to_ghl  boolean DEFAULT false,
  ghl_synced_at  timestamptz,

  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dm_pipeline_client_idx ON public.dm_pipeline_contacts(client_id);
CREATE INDEX IF NOT EXISTS dm_pipeline_stage_idx ON public.dm_pipeline_contacts(client_id, stage);

ALTER TABLE public.dm_pipeline_contacts ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS dm_pipeline_set_updated_at ON public.dm_pipeline_contacts;
CREATE TRIGGER dm_pipeline_set_updated_at
  BEFORE UPDATE ON public.dm_pipeline_contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================

CREATE TABLE IF NOT EXISTS public.dm_automation_rules (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,

  keyword      text NOT NULL,              -- nyckelord eller fras
  match_mode   text NOT NULL DEFAULT 'contains'
                CHECK (match_mode IN ('contains','exact','starts_with')),
  response     text NOT NULL,
  active       boolean NOT NULL DEFAULT true,
  triggered_count integer NOT NULL DEFAULT 0,
  last_triggered timestamptz,

  -- Kanal
  channel      text NOT NULL DEFAULT 'dm'
                CHECK (channel IN ('dm','comment','both')),

  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dm_rules_client_idx ON public.dm_automation_rules(client_id);
CREATE INDEX IF NOT EXISTS dm_rules_active_idx ON public.dm_automation_rules(client_id, active);

ALTER TABLE public.dm_automation_rules ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS dm_rules_set_updated_at ON public.dm_automation_rules;
CREATE TRIGGER dm_rules_set_updated_at
  BEFORE UPDATE ON public.dm_automation_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- Lägg till ghl_webhook_url på clients för pipeline-synk
-- ============================================================================
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS ghl_webhook_url text,
  ADD COLUMN IF NOT EXISTS ghl_api_key     text;
