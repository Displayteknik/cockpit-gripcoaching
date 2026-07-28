-- Etapp L1 — leadavisering per tenant.
-- Default PÅ, samma mönster som writing_rules_enabled (lib/content/writing-rules.ts:125):
-- en klient som inte sagt något ska få aviseringen, och ett DB-fel får aldrig tysta den.
--
-- Kolumnen är server-only. Den grantas medvetet INTE till anon: report_recipients är
-- exkluderad som PII i migrations/fas1b_columnlock_clients.sql och aviseringen läser den.

alter table public.clients
  add column if not exists lead_notify_enabled boolean not null default true;

comment on column public.clients.lead_notify_enabled is
  'Mejla report_recipients vid nytt lead i Nya leads. Default true.';

notify pgrst, 'reload schema';
