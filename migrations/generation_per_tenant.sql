-- G-9 tillägg — per tenant, inte bara per promptversion.
--
-- Håkan bad om "vilken tenant skapar vad och hur mycket" på Kvalitet-sidan.
-- `generation_log.tenant_id` fanns redan (G-1, för ägarflöden är den null) men
-- ingen vy grupperade på den — bara på prompt_version. Samma räkneprincip som
-- `generation_per_promptversion` i migrations/generationslogg.sql: bara det som
-- är MÄTT, ingen fabricerad kvalitetssiffra, ingen nolla som ser ut som en mätning.

create or replace view public.generation_per_tenant as
select
  tenant_id,
  syfte,
  min(created_at)                                    as forsta,
  max(created_at)                                     as senaste,
  count(*)                                             as antal,
  count(*) filter (where status = 'kasserad')          as kasserade,
  count(*) filter (where anvand_i_id is not null)      as publicerade,
  count(*) filter (where ai_usage_event_id is null)    as utan_kostnadskoppling
from public.generation_log
group by tenant_id, syfte;

revoke all on public.generation_per_tenant from anon, authenticated;

notify pgrst, 'reload schema';
