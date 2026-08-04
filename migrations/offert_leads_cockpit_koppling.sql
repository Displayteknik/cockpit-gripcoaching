-- Offertförfrågningar från kundens webbformulär (tabellen offert_leads skrivs av
-- displayteknik-offert/netlify/functions/submit.mjs) ska gå att öppna direkt i Cockpit
-- från aviseringsmejlet. Två kopplingar saknades:
--
--   client_id        Vilken Cockpit-klient leadet tillhör. Utan den vet djuplänken inte
--                    vilken tenant som ska aktiveras, och admin (vars aktiva klient
--                    default är HM Motor) hade fått fel kunds offertmotor.
--   lobby_contact_id Kortet i "Nya leads" (lobby_contacts) som samma inskick skapade.
--                    Utan den går det inte att länka till RÄTT kort, bara till listan.
--
-- Båda är nullable: leadet är primärleveransen och får aldrig falla på en saknad koppling
-- (samma princip som best-effort-stegen i submit.mjs). En rad utan client_id behandlas som
-- "okänd tenant" i app-lagret och öppnas aldrig i fel kunds vy.

alter table offert_leads add column if not exists client_id uuid;
alter table offert_leads add column if not exists lobby_contact_id uuid;

create index if not exists offert_leads_client_id_idx on offert_leads (client_id);

-- Backfill: formuläret på displayteknik.se är tabellens enda skrivare hittills, så alla
-- befintliga rader tillhör Displayteknik. Villkoret client_id is null gör körningen
-- idempotent och rör aldrig rader som redan fått en tenant.
update offert_leads
   set client_id = 'a6a33547-5ca7-475f-9a62-43ff2c74d000'
 where client_id is null;

-- RLS är fortsatt PÅ utan öppen policy: bara service_role läser/skriver. Cockpit går via
-- supabaseService() bakom admin-grinden, så ingen policy behöver öppnas.

notify pgrst, 'reload schema';
