-- KVALITET-3 punkt 10 — DM-lead ur skärmdump.
-- 1) Kanal på kontakten: fältet krävde Instagram-användarnamn, vilket blockerade
--    Messenger-/Facebook- och LinkedIn-kontakter helt.
-- 2) ig_username blir valfritt: kanaler utan handle ska aldrig hindra ett lead.
--    Namnet (display_name) räcker — API:t kräver att minst ett av dem finns.
-- 3) reminder_at: påminnelsen inför ett bokat möte (next_action_at = själva mötet).
-- Idempotent. Ingen backfill av channel: befintliga rader har okänd kanal och
-- ska inte påstås vara Instagram (UI:t faller tillbaka på handle när channel är null).

alter table public.cockpit_dm_contacts add column if not exists channel text;
alter table public.cockpit_dm_contacts add column if not exists reminder_at timestamptz;
alter table public.cockpit_dm_contacts alter column ig_username drop not null;

comment on column public.cockpit_dm_contacts.channel is 'instagram | messenger | linkedin | annat — kanalen kontakten kom via';
comment on column public.cockpit_dm_contacts.reminder_at is 'Påminnelse inför bokat möte (next_action_at = mötestiden)';

notify pgrst, 'reload schema';
