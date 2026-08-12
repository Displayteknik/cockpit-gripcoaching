-- DM-4: DM-pipelinen speglar grundplanens sju steg.
--
-- Håkans fynd 2026-08-11: "DM pipeline sitter inte ihop på samma sätt som pipeline i
-- grundplanen, det fattas 2 steg". Skärmbilden från MySales (AluCon, Kund pipeline) visar
-- sju fack i den här ordningen:
--
--   Ny · Bekräftad · Dialog · Erbjudande · Bokad · Vilande · Förlorad
--
-- DM-tavlan hade fyra kolumner (Ny, Bekräftad, Dialog, Erbjudande) och visade Bokad och
-- Förlorad i en lista under tavlan. VILANDE fanns inte alls — varken som kolumn eller som
-- tillåtet värde i databasen.
--
-- ⚠ Det här är dessutom nyheten som FIX-1 B2 väntat på sedan 9/8: facket
-- "Förlorad / Paus (nurture)" hade förlorad och pausad i SAMMA fack, vilket fick varje
-- parkerad kund att räknas som en förlorad affär. Skärmbilden visar att facket nu ÄR delat
-- i MySales. Koden i lib/hq/pipeline.ts (arVilande, harledSteglage) är byggd och medvetet
-- tyst tills steg-id:t pekas ut — den delen ligger kvar hos Håkan.
--
-- Constrainten släpps via katalogen i stället för med namn: tabellen skapades utanför det
-- här repot, så vi kan inte veta vad villkoret heter. Att gissa namnet och missa hade
-- lämnat den gamla listan kvar, och första kontakten som sätts till "vilande" hade fallit
-- på ett fel ingen letat efter.

do $$
declare c record;
begin
  for c in
    select conname
      from pg_constraint
     where conrelid = 'public.cockpit_dm_contacts'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%stage%'
  loop
    execute format('alter table public.cockpit_dm_contacts drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.cockpit_dm_contacts
  add constraint cockpit_dm_contacts_stage_check
  check (stage in ('new', 'acknowledge', 'connect', 'offer', 'won', 'vilande', 'lost'));

comment on column public.cockpit_dm_contacts.stage is
  'Läget i DM-pipelinen. Speglar grundplanens sju steg i MySales: new=Ny, acknowledge=Bekräftad, connect=Dialog, offer=Erbjudande, won=Bokad, vilande=Vilande, lost=Förlorad.';
