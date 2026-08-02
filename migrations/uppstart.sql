-- START-1 — uppstartsmodulen i Founder HQ (/dashboard/hq/uppstart).
--
-- EN plats där allt som måste göras för att systemet ska rulla ligger samlat, i rätt
-- ordning, med skälet skrivet bredvid. Modulen MÄTER och VÄGLEDER, den agerar aldrig:
-- inga skrivningar mot MySales eller andra system härifrån.
--
-- Server-only: RLS på, ingen policy, all åtkomst via service-role bakom ägargrinden.

create table if not exists public.hq_uppstart_steg (
  id                 text primary key,
  titel              text not null,
  varfor             text not null,          -- vad som slutar fungera utan detta
  hur                text,                   -- steg för steg, markdown
  kategori           text not null check (kategori in ('mysales','ekonomi','drift','cockpit','kalender')),
  blockerar          text[] not null default '{}',
  uppskattad_tid_min int not null default 10,
  sortering          int not null default 100,
  status             text not null default 'att_gora' check (status in ('att_gora','pagar','klar','skjutet')),
  klar_datum         timestamptz,
  anteckning         text,
  egen               boolean not null default false,   -- tillagt av ägaren, inte seedat
  uppdaterad         timestamptz not null default now()
);
create index if not exists hq_uppstart_ordning_idx on public.hq_uppstart_steg (sortering, id);
alter table public.hq_uppstart_steg enable row level security;

-- Kontrollerna mäter verkligheten. Ett steg med kontroll kan inte bockas av på känsla.
create table if not exists public.hq_uppstart_kontroll (
  id            uuid primary key default gen_random_uuid(),
  steg_id       text not null references public.hq_uppstart_steg(id) on delete cascade,
  kontrolltyp   text not null check (kontrolltyp in (
                  'pipeline_uppfoljningsdatum','pipeline_vunnet_steg','kunder_pipeline_finns',
                  'kostnad_belopp_saknas','abonnemangspris_saknas','banksaldo_saknas')),
  senast_kord   timestamptz,
  resultat_text text,
  uppfyllt      boolean not null default false,
  unique (steg_id, kontrolltyp)
);
alter table public.hq_uppstart_kontroll enable row level security;

-- ── Stegen ────────────────────────────────────────────────────────────────
-- Id:n är stabila strängar så framtida etapper kan seeda in nya steg utan att röra
-- befintliga, och så en ägares status aldrig går förlorad vid en ny körning.
insert into public.hq_uppstart_steg (id, titel, varfor, hur, kategori, blockerar, uppskattad_tid_min, sortering) values
 ('ms-uppfoljning',
  'Sätt uppföljningsdatum på alla affärer i Kund pipeline DT',
  'Morgonlistan och likviditetsprognosen är blinda utan datum. En affär utan uppföljning dyker aldrig upp när den borde.',
  E'1. Öppna [Kund pipeline DT i MySales](https://app.mysales.se)\n2. Gå igenom korten ett i taget\n3. Lägg en uppgift på kontakten med ett förfallodatum\n4. Kom tillbaka hit och tryck Uppdatera, siffran nedan ska gå mot noll',
  'mysales', array['morgonlistan','LIKVID-1'], 20, 10),

 ('ms-vunnet',
  'Flytta vunna affärer till vinststeget',
  'Vunnet härleds ur steget, eftersom MySales svarar att alla affärer är öppna. Pengar du redan tjänat syns annars inte.',
  E'1. Öppna Kund pipeline DT\n2. Dra varje avslutad affär till steget Vunnen (order)\n3. Förlorade affärer till Förlorad / Paus',
  'mysales', '{}', 10, 20),

 ('ms-kunder-pipeline',
  'Skapa pipelinen Kunder i Grip-locationen',
  'Gör MRR-siffran självuppdaterande i stället för handmatad. Idag skrivs varje kund in för hand i HQ.',
  E'1. Skapa pipelinen **Kunder** i Grip-locationen\n2. Lägg stegen Grund, Pro, GDÅM, Bollplanket, Konsult\n3. Ett kort per betalande kund, med månadsbeloppet exklusive moms som värde',
  'mysales', array['HQ-1.1'], 30, 30),

 ('ms-namn',
  'Namnge korten som tenanterna heter i plattformen',
  'Marginal per kund bygger på att namnet matchar. Står det Gitte på ett ställe och For Balance på ett annat hittar systemet ingen koppling.',
  E'Jämför kundnamnen i MySales med klientlistan i Cockpit och gör dem lika.',
  'mysales', '{}', 10, 40),

 ('ms-pit',
  'Skapa Private Integration Token per location',
  'HQ läser pipelinerna med den. Utan token står både pipelinen och prognosen tom.',
  E'1. I MySales: Settings, Private Integrations, Create\n2. Ge den läsrättigheter för Opportunities och Contacts\n3. Lämna värdet till utvecklingsmiljön som servervariabel, aldrig i en chatt',
  'mysales', '{}', 10, 50),

 ('ms-betalstatus',
  'Fyll i fakturerat, betalt och förväntat betaldatum per affär',
  'Annars blandas affärer du redan fått betalt för in i summan som fortfarande är i spel.',
  E'Gör det i Founder HQ under Displayteknik, direkt på raden. Ingen dubbelinmatning i MySales.',
  'mysales', '{}', 30, 60),

 ('ek-collector',
  'Hantera Collector-ärendet i Kivra',
  'Inkassoavgifterna växer varje vecka ärendet ligger.',
  E'Öppna [Kivra](https://kivra.se), läs ärendet och betala eller bestrid det.',
  'ekonomi', '{}', 15, 70),

 ('ek-visma',
  'Kontrollera Visma-fakturan i Kivra',
  'Så att den inte är en dubblett eller en tjänst som redan sagts upp.',
  E'Öppna [Kivra](https://kivra.se) och stäm av fakturan mot vad du faktiskt använder.',
  'ekonomi', '{}', 10, 80),

 ('ek-kostnader',
  'Fyll i saknade belopp på fasta kostnader',
  'Totalen i kostnadsvyn är för låg så länge poster står på noll. Du fattar beslut på en siffra som inte är hela sanningen.',
  E'Öppna [Founder HQ](/dashboard/hq) och fyll i beloppet på varje post som saknar det. Siffran nedan visar hur många som är kvar.',
  'ekonomi', '{}', 15, 90),

 ('ek-banksaldo',
  'Lägg in banksaldo per bolag',
  'Startpunkten för likviditetsprognosen. Utan saldo räknas ingen prognos och inget larm går.',
  E'Öppna [Founder HQ](/dashboard/hq), gå till likviditetsvyn och lägg in saldot med dagens datum för varje bolag.',
  'ekonomi', '{}', 5, 100),

 ('ek-abonnemang',
  'Fyll i abonnemangspriser per tenant',
  'Utan pris går det inte att se vad en kund ger netto efter vad hon kostar i AI.',
  E'Öppna [kostnadsmodulen](/dashboard/kostnader) och sätt månadspriset per klient.',
  'ekonomi', '{}', 10, 110),

 ('dr-replit',
  'Säg upp Replit',
  'Används inte, och betalningen nekas återkommande vilket ger onödiga påminnelser.',
  E'Logga in på [Replit](https://replit.com), gå till Account, Billing och avsluta abonnemanget.',
  'drift', '{}', 5, 120),

 ('dr-ghl2',
  'Kontrollera det andra GoHighLevel-kontot',
  'Risk för att du betalar två gånger för samma plattform.',
  E'Logga in på båda kontona, se vilket som faktiskt används och avsluta det andra.',
  'drift', '{}', 10, 130),

 ('dr-google',
  'Verifiera att Google Cloud-kontot är helt öppet efter kortbytet',
  'En betalningsspärr slår ut allt som drivs av Gemini samtidigt, och felet visar sig som något helt annat.',
  E'Öppna [Google Cloud Billing](https://console.cloud.google.com/billing) och kontrollera att kontot är aktivt utan varningar.',
  'drift', '{}', 5, 140),

 ('ck-credits',
  'Granska kundvyn för credits med kundens ögon',
  'Vyn har aldrig setts av en riktig inloggad kund. Det som är självklart för dig kan vara obegripligt för henne.',
  E'Logga in som Displayteknik och öppna Bilder och video. Läs varje mening som om du aldrig sett systemet.',
  'cockpit', '{}', 15, 150),

 ('ck-hmmotor',
  'Lägg in HM Motors bilhandelsprofil',
  'Tenanten bär idag en coachprofil, så texter åt bilhandlaren blir fel i grunden.',
  E'Öppna Brand-profil med HM Motor vald och skriv om profilen till bilhandel.',
  'cockpit', '{}', 20, 160),

 ('ck-blindtest',
  'Blindbedöm textbatchen',
  'Utan blindbedömning vet du inte om kvaliteten faktiskt steg eller bara kändes bättre.',
  E'Läs texterna utan att veta vilken version som är vilken och sätt betyg innan du tittar.',
  'cockpit', '{}', 30, 170),

 ('ka-bokning',
  'Styr bokningslänkarna mot tisdagar',
  'Nya möten hamnar annars på dina white space-dagar, och modellen bryts av sig själv.',
  E'1. Öppna kalenderinställningarna i MySales\n2. Begränsa tillgänglig tid till tisdag\n3. Spara och testa länken själv',
  'kalender', '{}', 10, 180),

 ('ka-moteslank',
  'Lägg in standardmöteslänken för videomöten',
  'Så att varje bokning får en länk utan att du lägger till den för hand.',
  E'Sätt din fasta Zoom-länk som standard i kalenderns mötesinställningar.',
  'kalender', '{}', 5, 190)
on conflict (id) do nothing;

-- Kontrollerna kopplas till sina steg.
insert into public.hq_uppstart_kontroll (steg_id, kontrolltyp) values
  ('ms-uppfoljning',    'pipeline_uppfoljningsdatum'),
  ('ms-vunnet',         'pipeline_vunnet_steg'),
  ('ms-kunder-pipeline','kunder_pipeline_finns'),
  ('ek-kostnader',      'kostnad_belopp_saknas'),
  ('ek-banksaldo',      'banksaldo_saknas'),
  ('ek-abonnemang',     'abonnemangspris_saknas')
on conflict (steg_id, kontrolltyp) do nothing;

notify pgrst, 'reload schema';
