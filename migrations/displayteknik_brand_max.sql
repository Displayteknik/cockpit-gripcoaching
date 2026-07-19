-- Displayteknik: maxad brand-profil — fyller ALLA fält i hm_brand_profile.
-- Ersätter/utökar displayteknik_brand_init.sql (2026-05-09).
-- Källor: displayteknik.se (2026-07-19), tidigare init-migration, marknadsanalys.
-- Körs i Supabase SQL Editor. Idempotent (upsert på client_id).

DO $$
DECLARE
  v_client_id uuid := 'a6a33547-5ca7-475f-9a62-43ff2c74d000';

  v_company text := 'Displayteknik i Sverige AB';
  v_tagline text := 'Fånga fler kunder med digitala skärmar och LED-skärmar';
  v_loc text := 'Flygstaden Byggnad 116, 826 70 Söderhamn — levererar i hela Sverige, samt Norge, Danmark, Finland och Åland via partner';
  v_founder_name text := 'Håkan';
  v_phone text := '+46 72 541 01 02';
  v_email text := 'support@displayteknik.se';
  v_booking text := 'https://displayteknik.se';

  v_story text := E'Displayteknik i Sverige AB utgår från Flygstaden i Söderhamn och hjälper företag i hela Sverige att installera, styra och använda professionella digitala skärmar.\n\nVi har levererat och installerat skärmar i bilhallar åt Toyota Sweden runt om i landet, realtidsskärmar åt X-Trafik som fungerat år efter år i tuff drift, och reklamskärmar åt Media 2011. Det är den sortens leveranser vi bygger på: skärmar som gör jobbet — länge.\n\nVi är inte en webbshop som skickar en kartong. Vi tar ansvar för hela kedjan: rätt skärm för miljön, montering, publiceringssystem och support när skärmen väl snurrar. Nordiskt klimat ställer särskilda krav — kyla, kondens, snö och lågt vintersolljus rakt in i skyltfönstret. Därför rekommenderar vi bara hårdvara vi vet klarar drift dygnet runt, år efter år.\n\nEn kontakt. Ett ansvar. Från första idé till driftsatt lösning.';

  v_usp text := E'En kontakt för allt: val av skärm, installation, innehållsstyrning och löpande support. Helhetsansvar från första idé till driftsatt skärm — och vidare genom hela driftstiden. Skicka en bild på platsen och få prisförslag inom 24 timmar.';

  v_diff text := E'Helhetsansvar i stället för kartongleverans — vi projekterar, monterar, driftsätter och supportar. Inte bara säljer.\nBeprövat i nordiskt klimat: utomhus- och skyltfönsterskärmar valda för kyla, kondens och starkt motljus.\nReferenser i drift år efter år (Toyota Sweden, X-Trafik) — inte bara säljcase.\nRikstäckande leverans med småföretagets tillgänglighet: du pratar med samma person hela vägen, inte ett ärendenummer.\nOberoende av enskild tillverkare — vi väljer skärm efter kundens miljö och budget, inte efter eget lager.\nSnabbhet i första steget: bild in, prisförslag ut inom 24 timmar.';

  v_tone text := E'Professionell men tillgänglig. Praktisk och problemlösande. Talar direkt till mottagarens behov och miljö.\nKorta, konkreta meningar. Vardagliga ord (skärm, montering, drift) i stället för teknisk jargong — och när fackord behövs (nits, pixel pitch) översätts de direkt: "4 000 nits — syns även i direkt solljus".\nSiffror och exempel före adjektiv. Trygg och erfaren, aldrig skrytig.\nFokus på helhet och servicekvalitet: det vi lovar är att det fungerar, år efter år.';

  v_icp1 text := E'Beslutsfattare (ägare, butikschef, marknadsansvarig, fastighetschef) hos butiker, bilhallar, kedjor, restauranger, hotell, gym, köpcentrum och fastighetsägare i Sverige som vill synas bättre och sälja mer på plats. Typisk affär: 1–10 skärmar, en skyltfönsterlösning eller en LED-vägg.';

  v_icp2 text := E'Offentlig verksamhet och trafikhuvudmän (resecentrum, kommuner, arenor, skidanläggningar) med krav på driftsäker realtidsinformation.\nKedjor och koncerner som vill styra innehåll centralt över många orter.\nBilanläggningar som behöver digital verkstadstavla (DaiSy Service).\nAV-, bygg- och mässprojekt där LED-vägg ingår i entreprenaden.';

  v_pains text := E'"Vi vet inte vilken skärm som passar — utbudet är en djungel och fel val blir dyrt."\n"Skärmen i skyltfönstret syns inte i solljus." (fel ljusstyrka för miljön)\n"Utomhusskärmen dog efter en vinter." (hårdvara som inte tål nordiskt klimat)\n"Ingen hinner uppdatera innehållet — skärmen visar en gammal kampanj."\n"Vem monterar, drar el och tar ansvar när något krånglar? Vi orkar inte jaga tre leverantörer."\n"Tryckt skyltmaterial är dyrt, långsamt och alltid inaktuellt."';

  v_quotes text := E'Media 2011: "Vi är tacksamma för all hjälp med digitala skärmar för reklam"\nToyota Sweden: "Displayteknik har jobbat i nära samarbete med Toyota Sweden i flera år med leverans och installation av digitala skärmar i bilhallar runt om i landet"\nX-Trafik: "Digitala realtidsskärmar som har fungerat år efter år med vår trafikinformation"';

  v_competitors text := E'Rikstäckande signage-bolag (ZetaDisplay, Visual Art, Vertiseit/Dise, Smartsign): starka på stora kedjeavtal men opersonliga och ofta dyra för små och medelstora köpare.\nLokala AV-installatörer och elfirmor: kan montera, men saknar helheten med publiceringssystem, innehåll och support.\nNäthandel/direktimport: billigast på papper — men kunden står själv för val, montering, innehåll och allt som krånglar.\nDisplaytekniks position: helhetsansvar + nordisk klimaterfarenhet + en personlig kontakt. Vi konkurrerar med totalkostnad över skärmens livstid, inte lägsta kartongpris.';

  v_journey text := E'1) Kunden ser problemet: dålig synlighet, tryckt material som aldrig är aktuellt, eller en flytt/ombyggnad — googlar eller får rekommendation.\n2) Skickar en bild på platsen → prisförslag inom 24 timmar.\n3) Genomgång: miljö, ljusförhållanden, mått och budget → rätt skärmtyp (inomhus, skyltfönster high-bright, utomhus eller LED-vägg).\n4) Offert och beslut — en kontakt, inga mellanhänder.\n5) Leverans, montering och igångkörning av oss.\n6) Utbildning i publiceringssystemet — kunden styr innehållet själv med schemaläggning, eller låter oss sköta det.\n7) Löpande drift med serviceavtal och support.\n8) Utökning: fler skärmar, fler orter, uppgradering till LED-vägg, innehållshjälp.';

  v_services text := 'Inomhusskärmar (butik, restaurang, gym, hotell, kontor, vårdmiljö) | Skyltfönsterskärmar high-bright — syns även i solljus | Utomhusskärmar byggda för nordiskt klimat | LED-skärmar och LED-väggar (fasad, arena, mässa, skyltfönster) | Innehållsstyrning/CMS — webbaserad med planering och schemaläggning | Installation, montage och igångkörning | Service- och supportavtal | DaiSy Service — digital verkstadstavla för bilanläggningar';

  v_pricing text := E'Enklare digital butiksskylt: från några tiotusentals kronor komplett.\nSkyltfönster- (high-bright) och utomhusskärmar: högre, styrs av ljusstyrka och väderskydd.\nLED-väggar: projektpris — yta, pixeltäthet och montering avgör.\nServiceavtal tillkommer för trygg drift.\nPrisförslag inom 24 timmar när kunden skickar en bild på platsen.\nPositionering: inte billigast per kartong — bäst totalkostnad över skärmens livstid (rätt val + installation + support = inga dyra felköp).';

  v_dos text := E'Var konkret om vad kunden får i sin leverans.\nLyft fram att en kontakt gäller hela kedjan: val, installation, innehåll, support.\nNämn kundsegment direkt: butiker, bilhallar, restauranger, hotell, gym, fastighetsägare.\nAnvänd siffror när de finns: storlek, ljusstyrka, år i drift, prisförslag inom 24h.\nReferera till bevis: Toyota Sweden, X-Trafik, Media 2011.\nSkriv för nordiska förhållanden: vinter, kyla, motljus i skyltfönstret.\nAvsluta med en enkel handling: "Skicka en bild på platsen — få prisförslag inom 24 timmar."';

  v_donts text := E'Teknisk jargong utan översättning.\nGenerella påståenden utan exempel.\n"kraftfull lösning", "banbrytande teknik", "holistisk", "skalbar", "nästa nivå", "handlar om".\nLånga inledningar före kärnan.\nVagheter typ "vara framtidsorienterat" eller "ekosystem".\nLova aldrig priser, garantitider eller leveranstider som inte är bekräftade.\nPrata aldrig ned konkurrenter vid namn i publikt innehåll.';

  v_hashtags text := '#digitalskyltning #digitalsignage #ledskärm #ledvägg #digitalaskyltar #skyltfönster #butikskommunikation #retail #bilhall #söderhamn';
BEGIN
  IF EXISTS (SELECT 1 FROM hm_brand_profile WHERE client_id = v_client_id) THEN
    UPDATE hm_brand_profile SET
      company_name = v_company,
      tagline = v_tagline,
      location = v_loc,
      founder_name = v_founder_name,
      founder_phone = v_phone,
      founder_email = v_email,
      brand_story = v_story,
      usp = v_usp,
      differentiators = v_diff,
      tone_rules = v_tone,
      icp_primary = v_icp1,
      icp_secondary = v_icp2,
      pain_points = v_pains,
      customer_quotes = v_quotes,
      competitors = v_competitors,
      customer_journey = v_journey,
      services = v_services,
      pricing_notes = v_pricing,
      booking_url = v_booking,
      dos = v_dos,
      donts = v_donts,
      hashtags_base = v_hashtags,
      updated_at = now()
    WHERE client_id = v_client_id;
  ELSE
    INSERT INTO hm_brand_profile (
      id, client_id, company_name, tagline, location, founder_name, founder_phone, founder_email,
      brand_story, usp, differentiators, tone_rules, icp_primary, icp_secondary, pain_points,
      customer_quotes, competitors, customer_journey, services, pricing_notes, booking_url,
      dos, donts, hashtags_base, updated_at
    ) VALUES (
      (SELECT COALESCE(MAX(id), 0) + 1 FROM hm_brand_profile), v_client_id, v_company, v_tagline,
      v_loc, v_founder_name, v_phone, v_email, v_story, v_usp, v_diff, v_tone, v_icp1, v_icp2,
      v_pains, v_quotes, v_competitors, v_journey, v_services, v_pricing, v_booking,
      v_dos, v_donts, v_hashtags, now()
    );
  END IF;
END $$;
