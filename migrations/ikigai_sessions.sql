-- Ikigai-motor: sparar varje genomförd Ikigai-session.
-- Coaching-leveransen (markdown) + råa inputs. Brand-förslag flödar separat
-- via intake_sessions/intake_proposals (source_type='ikigai') → befintlig commit.
create table if not exists public.ikigai_sessions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null,
  person_name text,
  person_email text,                       -- null för admin-körningar, ifylld för publik lead-magnet
  inputs jsonb not null default '{}'::jsonb, -- { love, skill, need, pay, background, goal, audience, time_per_week }
  result_markdown text,                     -- hela coaching-leveransen (visas + PDF)
  diagram jsonb,                            -- korta etiketter till Ikigai-Venn-diagrammet (9 fält)
  intake_session_id uuid,                   -- länk till brand-förslagen (om skapade)
  source text not null default 'admin',     -- 'admin' | 'public'
  status text not null default 'done',      -- 'done' | 'failed'
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists ikigai_sessions_client_idx on public.ikigai_sessions (client_id, created_at desc);

-- Gör 'ikigai' till en förstklassig intake-källa så brand-förslag från Ikigai-motorn
-- kan flöda genom befintlig intake-granskning/commit (annars bryter source_type-CHECK).
alter table public.intake_sessions drop constraint if exists intake_sessions_source_type_check;
alter table public.intake_sessions add constraint intake_sessions_source_type_check
  check (source_type = any (array['transcript','audio','video','manual','ikigai']));
