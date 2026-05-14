-- Engens Träd & Trädgård — onboarding migration
-- Skapar: clients-rad + brand-profil + 10 winning examples
-- Client-ID är fast så vi kan referera till det i memory

DO $$
DECLARE
  v_client_id uuid := 'e9e9e9e9-7e2d-4a2b-9c1f-e1ce115da001'::uuid;
BEGIN
  -- 1. CLIENT
  INSERT INTO clients (
    id, slug, name, industry, public_url, primary_color, resource_module,
    archived, customer_access_enabled, report_recipients, created_at, updated_at
  ) VALUES (
    v_client_id,
    'engens-trad',
    'Engens Träd & Trädgård',
    'Trädfällning & trädgårdstjänster',
    'https://engenstrad.se',
    '#2D5016',
    'general',
    false,
    true,
    'info@engenstrad.se',
    now(), now()
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    public_url = EXCLUDED.public_url,
    primary_color = EXCLUDED.primary_color,
    updated_at = now();

  -- 2. BRAND-PROFIL (delete-then-insert eftersom client_id ej har unique-constraint)
  DELETE FROM hm_brand_profile WHERE client_id = v_client_id;
  INSERT INTO hm_brand_profile (
    id, client_id, company_name, tagline, location,
    founder_name, founder_phone, founder_email,
    brand_story, usp, tone_rules,
    icp_primary, icp_secondary, pain_points,
    dos, donts, hashtags_base,
    differentiators, services, pricing_notes,
    updated_at
  ) VALUES (
    103,
    v_client_id,
    'Engens Träd & Trädgård',
    'Den trygga, lokala trädexperten för Roslagen och norra Stockholm',
    'Åkersberga (Roslagen)',
    'Rickard Engström',
    '08-19 91 45',
    'info@engenstrad.se',
    'Engens Träd är Rickards företag. Han kommer ut, tittar på trädet, säger vad som är rimligt och löser jobbet säkert. Inte ett vanligt trädfällningsbolag — en lokal expert som tar ansvar för riskträd nära hus, gör sektionsfällning på trånga ytor och lämnar tomten snygg efteråt. Medlem i Svenska Trädföreningen. RUT-avdrag gäller.',
    'Lokal trygghet och personligt förtroende. Vi tar de träd ingen annan vågar — nära hus, el, väg och lekytor. Sektionsfällning bit för bit, rent efteråt, kunden tillbaka i sitt vanliga liv samma dag.',
    E'Tonen ska VARA: trygg, mänsklig, lokal, konkret, lugn, erfaren, lite personlig, problemlösande.\nTonen ska INTE vara: branschjargong, "vi är bäst", aggressiv säljton, polerad reklambyråkänsla, långa tekniska förklaringar, humor i riskinlägg.\nKommunicera som Rickard — inte som ett företag.\nNyckelord (variera): säkert, lugnt, kontrollerat, nära hus, riskträd, tomt, trygghet, bedömning, Roslagen, Åkersberga, utan drama, rent efteråt, bit för bit, rätt metod, innan det blir akut.',
    'Villaägare 35–70 år i Roslagen och norra Stockholm (Åkersberga, Vallentuna, Täby, Danderyd, Upplands Väsby, Vaxholm, Norrtälje). Har ett trädproblem de inte vill, kan eller vågar hantera själva. Köper lugn, säkerhet, kontroll, en plan — inte motorsåg eller teknik.',
    'BRF:er, fastighetsägare, sommarhusägare (särskilt Ljusterö och skärgården).',
    E'"Jag borde ta tag i det där."\n"Det kanske klarar sig ett år till."\n"Tänk om det faller fel."\n"Jag vet inte vem jag ska ringa."\n"Det skymmer solen."\n"Vi har pratat om det i flera år."\n"Vi vill bara få det gjort."\n"Vi vill kunna använda gräsmattan."',
    E'Skriv som Rickard, inte som ett företag.\nKonkret, lokalt, lugnt.\nVisa risken utan att skrämma.\nMjuka CTA i TOFU: "Skicka en bild så tittar vi."\nTydliga CTA i BOFU: telefon + RUT.\nAlltid Roslagen/orterna i botten.',
    E'Inga AI-ord: "kraftfull", "banbrytande", "game-changer", "handlar om", "nästa nivå", "holistisk", "skalbar".\nIngen branschjargong, ingen "vi är bäst", ingen aggressiv säljton.\nIngen humor i riskinlägg.\nInga långa tekniska förklaringar.\nAldrig billigast-pris-argument.',
    ARRAY['#trädfällning','#riskträd','#sektionsfällning','#roslagen','#åkersberga','#vallentuna','#täby','#trädgård','#rut','#trädvård'],
    E'Lokal trygghet och personligt förtroende.\nRiskträd nära hus, el, väg, lekytor.\nSektionsfällning på trånga ytor.\nRent och snyggt efteråt.\nKundens lugn — inte motorsågen.\nRickard kommer ut själv och bedömer.\nMedlem i Svenska Trädföreningen.',
    E'Trädfällning (även riskträd nära hus).\nSektionsfällning bit för bit.\nBeskärning och kronvård.\nStubbfräsning.\nHäckklippning.\nBortforsling.\nBedömning på plats (kostnadsfritt).\nRUT gäller på allt arbete (upp till takbeloppet).',
    'RUT-avdrag halverar arbetskostnaden direkt på fakturan upp till takbeloppet. Pris-intervall ej satt — Rickard ger offert efter platsbesök.',
    now()
  );

  -- 3. WINNING EXAMPLES (10 utkast som mall för voice-fingerprint)
  DELETE FROM client_assets WHERE client_id = v_client_id AND category = 'winning_example' AND person_label = 'engens_seed';

  INSERT INTO client_assets (client_id, asset_type, category, title, body, person_name, person_label, tags, voice_score, status) VALUES
  (v_client_id, 'post', 'winning_example', 'Post 1 — Lutande träd (TOFU)',
   E'Trädet som lutar lite mer i år än förra året är värt att titta på innan blåsten gör det.\n\nPå öppna ytor kanske det inte spelar någon roll. Men nära hus, bil eller lekplats blir varje grad lutning en risk man inte vill testa.\n\nOm du undrar om ditt träd är okej – skicka en bild på det och var det står. Vi säger om det är värt att kolla på plats.\n\n– Rickard, Engens Träd',
   'Rickard Engström','engens_seed',ARRAY['tofu','riskträd','hook'],9.5,'active'),

  (v_client_id, 'post', 'winning_example', 'Post 2 — Träd nära huset (TOFU)',
   E'"Vi har pratat om det trädet i flera år."\n\nDet är den vanligaste meningen jag hör när jag kommer ut till en villa i Roslagen.\n\nTrädet står lite för nära huset. Det skymmer eftermiddagssolen. Grenarna ligger mot fasaden. Och så blir det aldrig av.\n\nDå är min uppgift enkel: komma ut, titta, säga vad som är rimligt – och göra jobbet om ni vill det.',
   'Rickard Engström','engens_seed',ARRAY['tofu','personligt','igenkänning'],9.5,'active'),

  (v_client_id, 'post', 'winning_example', 'Post 3 — Stormrisk (TOFU)',
   E'Det farligaste trädet på tomten ser sällan farligt ut från början.\n\nDet är ofta det där du går förbi varje dag utan att tänka på. Tills den första riktiga höststormen.\n\nTre saker jag alltid kollar:\n1. Lutar stammen?\n2. Är marken upphöjd på en sida?\n3. Finns det döda grenar högt upp?\n\nHittar du två av tre – be någon kika.',
   'Rickard Engström','engens_seed',ARRAY['tofu','checklista','säsong'],9.5,'active'),

  (v_client_id, 'post', 'winning_example', 'Post 4 — Sektionsfällning (MOFU)',
   E'När ett träd står nära huset börjar jobbet långt innan första snittet.\n\nSektionsfällning betyder att vi tar ner trädet bit för bit, ofta uppifrån. Varje del firas eller fälls kontrollerat så vi vet exakt var den landar.\n\nDet tar längre tid än vanlig fällning. Och det är därför du anlitar någon som gjort det förut.\n\nResultat: trädet borta, tomten hel, alla glada.',
   'Rickard Engström','engens_seed',ARRAY['mofu','metod','expertis'],9.5,'active'),

  (v_client_id, 'post', 'winning_example', 'Post 5 — Hembesök (MOFU)',
   E'Vad händer egentligen när jag kommer ut på en första bedömning?\n\nCirka 30 minuter på plats:\n1. Vi går runt trädet.\n2. Jag kollar stam, krona, lutning, rötter, mark.\n3. Vi pratar om vad du vill ha gjort.\n4. Jag säger om fällning, beskärning eller ingenting är rimligt.\n5. Du får offert oftast samma dag eller dagen efter.\n\nKostar inget. Inga förpliktelser. Och du får ett rakt svar.',
   'Rickard Engström','engens_seed',ARRAY['mofu','process','trygghet'],9.5,'active'),

  (v_client_id, 'post', 'winning_example', 'Post 6 — RUT (BOFU/utbildning)',
   E'Trädfällning, beskärning, häckklippning, stubbfräsning och bortforsling – allt det här går på RUT.\n\nDet betyder att arbetskostnaden halveras direkt på fakturan (upp till takbeloppet). Du gör ingenting själv – vi drar av det innan vi skickar offerten.\n\nFrågor om vad som ingår? Skriv en kommentar eller skicka DM.',
   'Rickard Engström','engens_seed',ARRAY['bofu','rut','utbildning'],9.5,'active'),

  (v_client_id, 'post', 'winning_example', 'Post 7 — Checklista lördag (TOFU)',
   E'Helgens hemmaprojekt: ta tio minuter och kolla det här på dina träd.\n\n1. Står något träd så att det skulle nå huset om det föll fel håll?\n2. Lutar något träd mer än förra året?\n3. Finns det döda grenar högre upp än taket?\n4. Lyfter marken på en sida av stammen?\n\nHittar du något – ta en bild från olika håll. Det räcker som underlag för en första bedömning.',
   'Rickard Engström','engens_seed',ARRAY['tofu','checklista','lördag'],9.5,'active'),

  (v_client_id, 'post', 'winning_example', 'Post 8 — Case Vallentuna (MOFU)',
   E'Kunden i Vallentuna hade en gran som stod 3 meter från huset och 1,5 meter från carporten.\n\nVanlig fällning gick inte. Trädet hade en svag rot åt fel håll.\n\nLösning: sektionsfällning från topp till bas. Två man, en halv dag. Trädet nere, ingenting på huset, kunden tillbaka i sitt vanliga liv samma kväll.',
   'Rickard Engström','engens_seed',ARRAY['mofu','case','vallentuna'],9.5,'active'),

  (v_client_id, 'post', 'winning_example', 'Post 9 — Sommarhus Ljusterö (TOFU)',
   E'På Ljusterö och i skärgården är problemet ofta att man bara är på plats några veckor om året.\n\nNär man väl är där vill man få jobbet gjort – inte vänta tre veckor på offert.\n\nSkicka en bild redan nu, så har vi en plan klar när du är på plats.',
   'Rickard Engström','engens_seed',ARRAY['tofu','ljusterö','sommarhus'],9.5,'active'),

  (v_client_id, 'post', 'winning_example', 'Post 10 — Säsongs-CTA (BOFU)',
   E'Har du ett träd du vill få bedömt innan sommaren?\n\nSkicka en bild på trädet och var det står (gärna från två håll). Då hör vi av oss inom 24 timmar med en första bedömning och en grov prisuppskattning.\n\nRing 08-19 91 45 eller skicka via DM här.\n\nRoslagen + norra Stockholm.',
   'Rickard Engström','engens_seed',ARRAY['bofu','cta','säsong'],9.5,'active');

END $$;

SELECT
  (SELECT count(*) FROM clients WHERE slug='engens-trad') as client_rows,
  (SELECT count(*) FROM hm_brand_profile WHERE client_id='e9e9e9e9-7e2d-4a2b-9c1f-e1ce115da001'::uuid) as brand_rows,
  (SELECT count(*) FROM client_assets WHERE client_id='e9e9e9e9-7e2d-4a2b-9c1f-e1ce115da001'::uuid AND category='winning_example') as winning_examples;
