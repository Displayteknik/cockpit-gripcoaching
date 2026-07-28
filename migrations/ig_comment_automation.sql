-- Etapp L2a/L2b — kommentarsautomation för Instagram.
-- Spec: docs/plattform/LEAD-AUTOMATION.md
--
-- ig_events är IDEMPOTENSNYCKELN. Meta levererar samma händelse mer än en gång, det är
-- normalt beteende och inte ett fel. Utan unikt index blir varje omleverans ett nytt
-- svar och ett nytt lead. Tabellen är också vår logg: allt som kommer in registreras,
-- även det vi väljer att inte agera på, så det går att felsöka i efterhand.

create table if not exists public.ig_events (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid references public.clients(id) on delete cascade,
  -- Metas egen id för objektet händelsen gäller (kommentar-id). Unikt = dubbletter tystnar.
  external_id   text not null,
  typ           text not null check (typ in ('comment', 'message', 'okand')),
  ig_username   text,
  text_innehall text,
  media_id      text,
  -- Vad vi gjorde: ignorerad (inget nyckelord), dryrun (skulle svarat), svarat, fel.
  atgard        text not null default 'ignorerad' check (atgard in ('ignorerad', 'dryrun', 'svarat', 'fel', 'egen')),
  svar_text     text,
  svar_id       text,
  fel           text,
  payload       jsonb,
  created_at    timestamptz not null default now()
);

create unique index if not exists ig_events_external_idx on public.ig_events (external_id);
create index if not exists ig_events_client_idx on public.ig_events (client_id, created_at desc);

alter table public.ig_events enable row level security;

notify pgrst, 'reload schema';
