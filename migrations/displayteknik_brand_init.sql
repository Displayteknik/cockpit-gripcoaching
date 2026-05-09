-- Initial brand-profil + voice-assets for Displayteknik
-- Skapad fran scrape av displayteknik.se 2026-05-09

-- Upsert via DO-block (ingen unique constraint pa client_id)
DO $$
DECLARE
  v_client_id uuid := 'a6a33547-5ca7-475f-9a62-43ff2c74d000';
  v_tone text := E'Professionell men tillganglig. Praktisk och problemlosande. Talar direkt till mottagarens behov. Korta, konkreta meningar. Anvander vardagliga ord (skarm, monter, drift) hellre an tekniskt jargong. Fokus pa helhet och servicekvalitet.';
  v_dos text := E'Var konkret om vad kunden far i sin leverans.\nLyft fram att en kontakt galler hela kedjan (val, installation, support, innehall).\nNamn-droppa kundsegment direkt: butiker, bilhallar, restauranger, hotell, gym, fastighetsagare.\nAnvand siffror nar de finns (storlek, ljusstyrka, ar i drift).\nReferera till bevis: Toyota Sweden, X-Trafik, Media 2011.';
  v_donts text := E'Tekniskt jargong utan oversattning.\nGenerella pastaenden utan exempel.\n"kraftfull losning", "banbrytande teknik", "holistisk", "skalbar", "nasta niva", "handlar om".\nLanga inledningar fore karnan.\nVagheter typ "vara framtidsorienterat" eller "ekosystem".';
  v_quotes text := E'Media 2011: "Vi ar tacksamma for all hjalp med digitala skarmar for reklam"\nToyota Sweden: "Displayteknik har jobbat i nara samarbete med Toyota Sweden"\nX-Trafik: "Digitala realtidsskarmar som har fungerat ar efter ar"';
  v_company text := 'Displayteknik i Sverige AB';
  v_tagline text := 'Fanga fler kunder med digitala skarmar och LED-skarmar';
  v_loc text := 'Flygstaden Byggnad 116, 826 70 Soderhamn';
  v_phone text := '+46 72 541 01 02';
  v_email text := 'support@displayteknik.se';
  v_icp text := 'Butiker, bilhallar, kedjor, fastighetsagare, restauranger, hotell, gym, kopcentrum, arenor, offentlig verksamhet i Sverige';
  v_usp text := 'En kontakt for allt — val, installation, innehallstyrning och lopande support. Helhetslosning fran forsta ide till driftsatt skarm.';
  v_services text := 'Inomhusskarmar | Skyltfonsterskarmar (high-bright) | Utomhusskarmar (vadertaliga) | LED-skarmar och LED-vaggar | Innehallstyrning (CMS) | Installation och support';
BEGIN
  IF EXISTS (SELECT 1 FROM hm_brand_profile WHERE client_id = v_client_id) THEN
    UPDATE hm_brand_profile SET
      company_name = v_company,
      tagline = v_tagline,
      location = v_loc,
      founder_phone = v_phone,
      founder_email = v_email,
      tone_rules = v_tone,
      dos = v_dos,
      donts = v_donts,
      customer_quotes = v_quotes,
      icp_primary = v_icp,
      usp = v_usp,
      services = v_services,
      updated_at = now()
    WHERE client_id = v_client_id;
  ELSE
    INSERT INTO hm_brand_profile (id, client_id, company_name, tagline, location, founder_phone, founder_email, tone_rules, dos, donts, customer_quotes, icp_primary, usp, services, updated_at)
    VALUES ((SELECT COALESCE(MAX(id), 0) + 1 FROM hm_brand_profile), v_client_id, v_company, v_tagline, v_loc, v_phone, v_email, v_tone, v_dos, v_donts, v_quotes, v_icp, v_usp, v_services, now());
  END IF;
END $$;

-- Voice-assets: testimonials + key beskrivningar
INSERT INTO client_assets (client_id, asset_type, body, status, created_at) VALUES
  ('a6a33547-5ca7-475f-9a62-43ff2c74d000', 'testimonial', E'Vi ar tacksamma for all hjalp med digitala skarmar for reklam i lokalpressen och samarbetet med Displayteknik. — Media 2011', 'active', now()),
  ('a6a33547-5ca7-475f-9a62-43ff2c74d000', 'testimonial', E'Displayteknik har jobbat i nara samarbete med Toyota Sweden i flera ar med leverans och installation av digitala skarmar i bilhallar runt om i landet. — Toyota Sweden', 'active', now()),
  ('a6a33547-5ca7-475f-9a62-43ff2c74d000', 'testimonial', E'Digitala realtidsskarmar som har fungerat ar efter ar med var trafikinformation. — X-Trafik', 'active', now()),
  ('a6a33547-5ca7-475f-9a62-43ff2c74d000', 'post', E'Fanga fler kunder med digitala skarmar och LED-skarmar. Vi hjalper butiker, bilhallar, kedjor och fastighetsagare att valja ratt skarm. Du far en kontakt for allt — fran forsta ide till driftsatt losning. Vi tar hand om val, installation, innehall och lopande support.', 'active', now()),
  ('a6a33547-5ca7-475f-9a62-43ff2c74d000', 'post', E'En partner for inomhusskarmar i butiker, restauranger och hotell.\nEn partner for skyltfonsterskarmar med hogt ljus som syns aven i solljus.\nEn partner for vadertaliga utomhusskarmar.\nEn partner for modulbaserade LED-skarmar och LED-vaggar.\nVi levererar i hela Sverige samt Norge, Danmark, Finland och Aland via partner.', 'active', now()),
  ('a6a33547-5ca7-475f-9a62-43ff2c74d000', 'post', E'Allt fran forsta ide till driftsatt losning. Skarmar for alla tankbara behov — butik, bilhall, trafik, hotell, verkstad och offentlig miljo. Du far en kontakt for allt: val, installation, montering, innehallstyrning och support. Skarmar for inomhus, skyltfonster, utomhus och LED-vaggar.', 'active', now());
