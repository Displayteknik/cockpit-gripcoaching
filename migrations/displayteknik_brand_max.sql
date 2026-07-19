-- Displayteknik: maxad brand-profil + STRATEGI — samma nivå som engens_trad_strategidoc.sql.
-- Fyller ALLA fält i hm_brand_profile, lägger master-strategidokument (client_assets,
-- category strategy_doc) och vinnande exempel i Displaytekniks röst (flödar till all AI
-- via getProfileAsMarkdown, topp-3 på voice_score).
-- Källor: displayteknik.se (2026-07-19), displayteknik_brand_init.sql, marknadsanalys.
-- Körs i Supabase SQL Editor. Idempotent.

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

  v_story text := E'Displayteknik i Sverige AB utgår från Flygstaden i Söderhamn och hjälper företag i hela Sverige att installera, styra och använda professionella digitala skärmar.\n\nVi har levererat och installerat skärmar i bilhallar åt Toyota Sweden runt om i landet, realtidsskärmar åt X-Trafik som fungerat år efter år i tuff drift, och reklamskärmar åt Media 2011. Det är den sortens leveranser vi bygger på: skärmar som gör jobbet — länge.\n\nVi är inte en webbshop som skickar en kartong. Vi tar ansvar för hela kedjan: rätt skärm för miljön, montering, publiceringssystem och support när skärmen väl snurrar. Nordiskt klimat ställer särskilda krav — kyla, kondens, snö och lågt vintersolljus rakt in i skyltfönstret. Därför rekommenderar vi bara hårdvara vi vet klarar drift dygnet runt, år efter år.\n\nArketype: den trygga tekniska experten + den praktiska problemlösaren. Displayteknik kommunicerar som en erfaren rådgivare som sett hundratals miljöer — inte som en återförsäljare som vill bli av med lager. Kunden ska känna: "De vet vad som funkar. De tar ansvar. Jag behöver bara ringa ett nummer."\n\nEn kontakt. Ett ansvar. Från första idé till driftsatt lösning.';

  v_usp text := E'Primärt löfte: Du får en skärm som syns, säljer och fungerar — år efter år.\nSekundärt löfte: Du slipper bli din egen AV-tekniker. Vi tar ansvar för val, montering, innehåll och support — en kontakt för allt.\n\nKommersiell vinkel: Företag förlorar kunder de aldrig ser. Skärmen säljer på plats när ingen annan gör det — och vi gör den delen enkel, trygg och driftsäker. Skicka en bild på platsen och få prisförslag inom 24 timmar.';

  v_diff text := E'Det Displayteknik äger:\n- Helhetsansvar i stället för kartongleverans — vi projekterar, monterar, driftsätter och supportar. Inte bara säljer.\n- Beprövat i nordiskt klimat: utomhus- och skyltfönsterskärmar valda för kyla, kondens och starkt motljus.\n- Referenser i DRIFT år efter år (Toyota Sweden, X-Trafik) — inte bara säljcase.\n- Rikstäckande leverans med småföretagets tillgänglighet: du pratar med samma person hela vägen, inte ett ärendenummer.\n- Oberoende av enskild tillverkare — vi väljer skärm efter kundens miljö och budget, inte efter eget lager.\n- Snabbhet i första steget: bild in, prisförslag ut inom 24 timmar.\n\nDet Displayteknik INTE tävlar om: lägsta kartongpris, konsument-TV-apparater, "störst i Norden"-fasad.\n\nEnkel konkurrensfördel: Många kan sälja en skärm. Färre kan få den att synas i solljus, överleva en norrländsk vinter och visa rätt innehåll — år efter år.';

  v_tone text := E'Professionell men tillgänglig. Praktisk och problemlösande. Talar direkt till mottagarens miljö och behov.\n\nTonen ska VARA: trygg, erfaren, konkret, rådgivande, jordnära, lösningsfokuserad.\nTonen ska INTE vara: teknisk jargong utan översättning, säljig, skrytig, reklambyråpolerad, abstrakt.\n\nKorta, konkreta meningar. Vardagliga ord (skärm, montering, drift) i stället för fackspråk — och när fackord behövs (nits, pixel pitch, IP-klass) översätts de direkt: "4 000 nits — syns även i direkt solljus".\nSiffror och exempel före adjektiv. Bevis före påståenden.\n\nNyckelord att återkomma till (variera): syns, säljer, drift, år efter år, en kontakt, helhet, montering, innehåll, support, nordiskt klimat, skyltfönster, prisförslag inom 24 timmar.\n\nAnvänd kundens egna formuleringar: "vår skyltning ser trött ut", "syns inte i solljuset", "vem hjälper oss när den strular?", "vi hinner inte uppdatera", "vad kostar det egentligen?".';

  v_icp1 text := E'Beslutsfattare (ägare, butikschef, marknadsansvarig, fastighetschef) hos butiker, bilhallar, kedjor, restauranger, hotell, gym, köpcentrum och fastighetsägare i Sverige som vill synas bättre och sälja mer på plats. Typisk affär: 1–10 skärmar, en skyltfönsterlösning eller en LED-vägg.\n\nPsykologiskt läge före köp: vet att skyltningen ser trött ut, har sett konkurrenter med skärmar, oroar sig för pris, teknikstrul och att ingen hinner sköta innehållet. Köper: uppmärksamhet på plats, proffsigt intryck, trygghet i drift — inte pixlar och paneler.';

  v_icp2 text := E'Offentlig verksamhet och trafikhuvudmän (resecentrum, kommuner, arenor, skidanläggningar) med krav på driftsäker realtidsinformation — referens: X-Trafik.\nKedjor och koncerner som vill styra innehåll centralt över många orter.\nBilanläggningar som behöver digital verkstadstavla (DaiSy Service) — referens: Toyota Sweden.\nAV-, bygg- och mässprojekt där LED-vägg ingår i entreprenaden.';

  v_pains text := E'"Vår skyltning ser trött ut — grannbutiken har redan skärm."\n"Vi vet inte vilken skärm som passar — utbudet är en djungel och fel val blir dyrt."\n"Skärmen i skyltfönstret syns inte i solljus." (fel ljusstyrka för miljön)\n"Utomhusskärmen dog efter en vinter." (hårdvara som inte tål nordiskt klimat)\n"Ingen hinner uppdatera innehållet — skärmen visar en gammal kampanj."\n"Vem monterar, drar el och tar ansvar när något krånglar? Vi orkar inte jaga tre leverantörer."\n"Tryckt skyltmaterial är dyrt, långsamt och alltid inaktuellt."';

  v_quotes text := E'Media 2011: "Vi är tacksamma för all hjälp med digitala skärmar för reklam"\nToyota Sweden: "Displayteknik har jobbat i nära samarbete med Toyota Sweden i flera år med leverans och installation av digitala skärmar i bilhallar runt om i landet"\nX-Trafik: "Digitala realtidsskärmar som har fungerat år efter år med vår trafikinformation"';

  v_competitors text := E'Rikstäckande signage-bolag (ZetaDisplay, Visual Art, Vertiseit/Dise, Smartsign): starka på stora kedjeavtal men opersonliga och ofta dyra för små och medelstora köpare. Vi vinner på tillgänglighet och helhet i mindre/medelstora affärer.\nLokala AV-installatörer och elfirmor: kan montera, men saknar helheten med publiceringssystem, innehåll och support. Vi vinner på "en kontakt för allt".\nNäthandel/direktimport och konsument-TV: billigast på papper — men kunden står själv för val, montering, innehåll och allt som krånglar, och hårdvaran är inte byggd för 24/7-drift eller solljus. Vi vinner på totalkostnad över livstiden.\n\nDisplaytekniks position: helhetsansvar + nordisk klimaterfarenhet + en personlig kontakt. Vi konkurrerar med totalkostnad över skärmens livstid, inte lägsta kartongpris. Prata aldrig ned konkurrenter vid namn i publikt innehåll.';

  v_journey text := E'1) Omedveten: skyltningen har sett likadan ut i åratal — kunden ser den inte längre själv. Innehåll: igenkänning, "syns din butik?", vad rörligt innehåll gör med uppmärksamhet.\n2) Problemmedveten: "vår skyltning ser trött ut", konkurrenten har skärm. Innehåll: före/efter, vad en skärm gör för intrycket.\n3) Lösningsmedveten: förstår att digital skylt är svaret men inte vilken. Innehåll: rätt skärm för rätt miljö (skyltfönster/utomhus/LED), utan jargong.\n4) Leverantörsval: jämför pris, trygghet och ansvar. Innehåll: referenser i drift (Toyota, X-Trafik), en kontakt för allt, serviceavtal.\n5) Kontakt — låg tröskel: "Skicka en bild på platsen → prisförslag inom 24 timmar."\n6) Leverans: val, montering, igångkörning av oss. Utbildning i publiceringssystemet.\n7) Drift: serviceavtal, support, innehållshjälp.\n8) Utökning: fler skärmar, fler orter, uppgradering till LED-vägg — merförsäljning via bevisad nytta.';

  v_services text := 'Inomhusskärmar (butik, restaurang, gym, hotell, kontor, vårdmiljö) | Skyltfönsterskärmar high-bright — syns även i solljus | Utomhusskärmar byggda för nordiskt klimat | LED-skärmar och LED-väggar (fasad, arena, mässa, skyltfönster) | Innehållsstyrning/CMS — webbaserad med planering och schemaläggning | Installation, montage och igångkörning | Service- och supportavtal | DaiSy Service — digital verkstadstavla för bilanläggningar';

  v_pricing text := E'Enklare digital butiksskylt: från några tiotusentals kronor komplett.\nSkyltfönster- (high-bright) och utomhusskärmar: högre, styrs av ljusstyrka och väderskydd.\nLED-väggar: projektpris — yta, pixeltäthet och montering avgör.\nServiceavtal tillkommer för trygg drift.\nPrisförslag inom 24 timmar när kunden skickar en bild på platsen.\n\nPositionering: inte billigast per kartong — bäst totalkostnad över skärmens livstid (rätt val + installation + support = inga dyra felköp).\n\nVanliga invändningar att möta:\n1. "Det är för dyrt" → jämför med tryckkostnader över tid + vad EN extra kund i veckan är värd; börja med en skärm; bild in → pris inom 24h\n2. "En TV från nätet är billigare" → konsument-TV är inte byggd för 24/7 eller solljus; dyrast är skärmen som dör efter ett år utan garanti, montering eller support\n3. "Vi hinner inte uppdatera innehållet" → schemalägg i förväg i publiceringssystemet, eller låt oss sköta det\n4. "Funkar det verkligen utomhus här?" → X-Trafiks realtidsskärmar har rullat år efter år i nordiskt klimat; vi väljer hårdvara därefter\n5. "Vi vet inte vad vi ska visa" → vi hjälper till med innehåll och mallar — skärmen ska aldrig stå tom';

  v_dos text := E'Var konkret om vad kunden får i sin leverans.\nLyft fram att en kontakt gäller hela kedjan: val, installation, innehåll, support.\nNämn kundsegment direkt: butiker, bilhallar, restauranger, hotell, gym, fastighetsägare.\nAnvänd siffror när de finns: storlek, ljusstyrka, år i drift, prisförslag inom 24h.\nReferera till bevis: Toyota Sweden, X-Trafik, Media 2011.\nSkriv för nordiska förhållanden: vinter, kyla, motljus i skyltfönstret.\nVisa affärsnyttan (fler kunder in, mer sålt per besök) före tekniken.\nAvsluta med en enkel handling: "Skicka en bild på platsen — få prisförslag inom 24 timmar."';

  v_donts text := E'Teknisk jargong utan översättning.\nGenerella påståenden utan exempel.\n"kraftfull lösning", "banbrytande teknik", "holistisk", "skalbar", "nästa nivå", "handlar om", "game-changer".\nLånga inledningar före kärnan.\nVagheter typ "vara framtidsorienterat" eller "ekosystem".\nLova aldrig priser, garantitider eller leveranstider som inte är bekräftade.\nPrata aldrig ned konkurrenter vid namn i publikt innehåll.\nSälj aldrig tekniken före nyttan — kunden köper fler kunder, inte paneler.';

  v_hashtags text := '#digitalskyltning #digitalsignage #ledskärm #ledvägg #digitalaskyltar #skyltfönster #butikskommunikation #retail #bilhall #söderhamn';
BEGIN
  -- ── 1. BRAND-PROFIL — alla fält ──────────────────────────────────────────
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

  -- ── 2. STRATEGIDOKUMENT som master-asset (samma mönster som Engens Träd) ──
  DELETE FROM client_assets WHERE client_id = v_client_id AND category = 'strategy_doc';

  INSERT INTO client_assets (client_id, asset_type, category, title, body, person_name, person_label, tags, voice_score, status, ai_summary) VALUES
  (v_client_id, 'document', 'strategy_doc',
   'Strategidokument — positionering, marknad och innehållsstrategi',
   E'# Displayteknik — Strategidokument (master)\n\n## Kärnslutsats\nDisplayteknik positioneras som den trygga helhetspartnern för digitala skärmar i nordiskt klimat: en kontakt, ett ansvar, skärmar i drift år efter år. Starkaste kommersiella vinkeln: "Företag förlorar kunder de aldrig ser. Skärmen säljer på plats när ingen annan gör det — och Displayteknik gör den delen enkel, trygg och driftsäker."\n\n## Varumärkespersona\n- Arketype: trygg teknisk expert + praktisk problemlösare\n- Blandning av: den erfarna rådgivaren, den metodiska installatören, den pålitliga leverantören som svarar när det strular\n- Roll i kundens huvud: "De vet vad som funkar i vår miljö. De tar ansvar. Jag behöver bara ringa ett nummer."\n- Primärt löfte: Du får en skärm som syns, säljer och fungerar — år efter år\n- Sekundärt löfte: Du slipper bli din egen AV-tekniker\n\n## Positionering (4 varianter)\n- Huvudpositionering: Displayteknik är helhetspartnern för digitala skärmar och LED-skärmar i Sverige — från val och montering till innehåll och support, byggt för nordiskt klimat.\n- Kort: Skärmar som syns, säljer och fungerar. År efter år.\n- Personlig: Vi hjälper butiker, bilhallar och fastighetsägare att fånga fler kunder med digitala skärmar — och tar ansvar för att de fungerar.\n- Säljande: Ser din skyltning trött ut? Skicka en bild på platsen — du får ett prisförslag inom 24 timmar och en partner som tar hand om resten.\n\n## Vad marknaden faktiskt köper\nUppmärksamhet på plats · fler kunder in genom dörren · mer sålt per besök · ett proffsigt intryck · att slippa teknikstrul · en investering som inte dör efter en vinter · någon att ringa när det krånglar · att slippa jaga tre leverantörer. Kommunikationen ska fokusera på affärsnytta och trygghet — inte paneler, tum och pixlar.\n\n## Primär målgrupp\nBeslutsfattare hos butiker, bilhallar, kedjor, restauranger, hotell, gym, köpcentrum och fastighetsägare i Sverige. Typisk affär: 1–10 skärmar, en skyltfönsterlösning eller en LED-vägg.\n\n### Typiska situationer\n- Skyltningen har sett likadan ut i åratal — ingen ser den längre\n- Konkurrenten/grannbutiken har satt upp en skärm\n- Nyöppning, flytt eller ombyggnad\n- Tryckkostnaderna rullar men materialet är alltid inaktuellt\n- Skyltfönstret syns inte i solljus\n- En billig skärm har redan dött och bränt förtroendet\n\n### Psykologiskt tillstånd före köp\n- "Vår skyltning ser trött ut."\n- "Vad kostar det egentligen?"\n- "Vem hjälper oss när den strular?"\n- "Vi hinner inte uppdatera innehåll."\n- "Jag vill inte köpa fel."\n\n### Vad kunden behöver höra\n- Du behöver inte kunna tekniken — det är vårt jobb.\n- Skicka en bild på platsen, du får prisförslag inom 24 timmar.\n- Vi väljer skärm efter din miljö: solljus, kyla, drifttid.\n- En kontakt för allt: val, montering, innehåll, support.\n- Referenserna rullar år efter år: Toyota Sweden, X-Trafik.\n\n## Sekundära målgrupper\n- Offentlig verksamhet/trafik (resecentrum, kommuner, arenor, skidanläggningar): driftsäkerhet, realtidsdata, dokumenterad leverans. Ton: saklig, riskreducerande. Bevis: X-Trafik.\n- Kedjor/koncerner: central innehållsstyrning över många orter, en leverantör i stället för tio. Bevis: Toyota Sweden.\n- Bilanläggningar: DaiSy Service — digital verkstadstavla.\n- AV-/bygg-/mässprojekt: LED-vägg som del i entreprenad, projektpris.\n\n## Rösten\nRak. Trygg. Konkret. Rådgivande. Aldrig säljig.\n\nExempel:\n- "En skärm i skyltfönstret ska tåla två saker: vintern och solen. Annars är den snart bara en svart ruta."\n- "Konsument-TV:n är billigare i kartongen. Sen ska den stå på 12 timmar om dagen i ett skyltfönster — det är där skillnaden märks."\n- "X-Trafiks skärmar har rullat år efter år. Det är så vi vill att alla våra leveranser ska åldras."\n\n## 5 innehållspelare\n1. **Synlighet & försäljning på plats** (TOFU): varför rörligt innehåll fångar blicken, vad skyltningen gör med intrycket, "syns din butik?"\n2. **Före/efter & installationer** (TOFU/MOFU): riktiga jobb, miljöbilder, LED-väggar — visuell bekräftelse\n3. **Displayteknik förklarar** (MOFU): rätt skärm för rätt miljö — ljusstyrka, väder, skyltfönster, CMS — utan jargong, alltid översatt\n4. **Bevis & drift** (MOFU): Toyota, X-Trafik, "år efter år"-berättelser, serviceavtal, en kontakt\n5. **Praktiska beslut** (BOFU): pris, process, "skicka en bild — prisförslag inom 24h"\n\n## Funnel: 60–65% TOFU / 25–30% MOFU / 10% BOFU\n4 av 5 inlägg ska inte kännas som säljinlägg. Det femte gör jobbet med tydlig CTA.\n\n## Veckomix\n- Mån: Analytical / C / TOFU — utbildande: så väljer du skärm, vanliga misstag\n- Tis: Analytical / D / MOFU — så går en leverans till, från bild till driftsatt\n- Ons: Aspirational / I / TOFU — före/efter, wow-installation, LED-vägg\n- Tor: Aspirational / S / MOFU — trygghet: referens i drift, kundcase, supporten\n- Fre: Actionable / D / BOFU — skicka en bild, pris inom 24h, boka\n- Lör: Actionable / C / TOFU — checklista: 5 tecken på att skyltningen kostar dig kunder\n- Sön: Authentic / S/I / TOFU — bakom kulisserna: montering, mätning på plats, Söderhamn\n\n## 5 återkommande serier\n1. **Veckans miljö** — en bransch per avsnitt (bilhall, gym, restaurang, hotell, butik): miljöns problem → rätt skärmtyp → vad det ger. Positionerar bredden utan att skryta.\n2. **Före/efter** — entré, skyltfönster eller fasad före och efter installation. Låt bilden göra jobbet.\n3. **Frågor vi ofta får** — pris, ljusstyrka, "funkar det på vintern?", "vem uppdaterar innehållet?", el och montering. En fråga per inlägg, rakt svar.\n4. **Skärmen som jobbar** — driftberättelser: X-Trafik år efter år, Toyotas bilhallar, DaiSy i verkstan. Bevis > löften.\n5. **Vad ska du visa?** — innehållstips för skärmen: kampanj, priser, öppettider, socialt bevis. Ger värde + positionerar CMS och innehållshjälp.\n\n## 5 vanliga invändningar + svar\n1. "Det är för dyrt." → "En enklare butiksskylt börjar på några tiotusentals kronor komplett. Jämför med vad tryckt material kostar över tre år — och vad EN extra kund i veckan är värd. Skicka en bild så får du en riktig siffra inom 24 timmar."\n2. "En TV från nätet är billigare." → "I kartongen, ja. Men en konsument-TV är inte byggd för 12–24 timmars drift eller solljus i skyltfönstret. Den dyraste skärmen är den som dör efter ett år — utan garanti, montering eller någon att ringa."\n3. "Vi hinner inte uppdatera innehållet." → "Det är det vanligaste hindret — och det enklaste att lösa. Du schemalägger innehåll i förväg i publiceringssystemet, eller låter oss sköta det. Skärmen ska aldrig stå tom."\n4. "Funkar det verkligen utomhus här?" → "Det är vår hemmaplan. X-Trafiks realtidsskärmar har rullat år efter år i nordiskt klimat. Vi väljer hårdvara efter kyla, kondens och motljus — inte efter datablad."\n5. "Vi vet inte vad vi ska visa." → "Det löser vi tillsammans. Kampanjer, priser, öppettider, kundomdömen — vi hjälper till med innehåll och mallar så skärmen säljer från dag ett."\n\n## DISC-strategi\n- D (Driver): resultat och fart — "bild in, pris inom 24h, monterat och klart". Format: före/efter, problem→lösning, tydlig CTA.\n- I (Influence): syns och imponerar — LED-väggar, wow-installationer, "titta vad det blev". Format: video, bildserier, bakom kulisserna.\n- S (Steadiness): trygghet — en kontakt, serviceavtal, referenser i drift år efter år, "vi tar hand om det". Format: process, kundcase, support-berättelser.\n- C (Compliance): fakta — ljusstyrka i nits (översatt), IP-klass, drifttid, totalkostnadskalkyl, checklistor. Format: utbildande inlägg, jämförelser, FAQ.\n\n## Bild- och videostrategi\nPrioritera: riktiga installationer i miljö med människor · före/efter · skärm i solljus/snö (nordisk kontext) · montering som pågår · LED-vägg i drift · skyltfönster kväll vs dag · lokala miljöer.\nUndvik: generiska stockbilder på "digital signage" · renderade konceptbilder utan sammanhang · skärmar med lorem ipsum-innehåll · teknik-närbilder utan kundnytta.\nVideoformat: (1) hook på skärmtext "Den här butiken syntes inte från gatan" → (2) problemet → (3) montering/lösning → (4) resultatet → (5) "Skicka en bild på din plats — prisförslag inom 24 timmar."\n\n## Profiltexter\n- LinkedIn/Facebook-bio: "Displayteknik i Sverige AB hjälper företag att installera, styra och använda professionella digitala skärmar. En kontakt för allt: val, montering, innehåll och support. Referenser i drift år efter år — Toyota Sweden, X-Trafik. Skicka en bild på din plats, få prisförslag inom 24 timmar."\n- Kort tagline: "Skärmar som syns, säljer och fungerar."\n- Lokal tagline: "Digitala skärmar för hela Sverige — från Söderhamn."\n\n## Strategisk kärna (alltid)\nMer affärsnytta, mindre teknik. Mer bevis i drift, mindre löften. Mer före/efter. Mer "en kontakt, ett ansvar". Mer nordiskt klimat som hemmaplan. Mindre generell företagstext.\n\nKunden ska känna: "De vet vad som funkar i vår miljö." · "De tar ansvar för helheten." · "Det här är tryggt." · "Jag behöver inte kunna tekniken själv." · "Det kommer att fungera — länge."',
   'Håkan', 'strategy_master',
   ARRAY['strategy','persona','positionering','disc','funnel','master_doc'],
   9.5, 'active',
   'Master-strategidokument för Displayteknik. Innehåller arketype, primärt+sekundärt kundlöfte, 4 positioneringsvarianter, målgruppspsykologi per segment, 5 innehållspelare, funnel-mix, veckomix, 5 återkommande serier, 5 invändningar+svar, DISC-strategi, bild/video-strategi, profiltexter och kundresa.');

  -- ── 3. VINNANDE EXEMPEL i Displaytekniks röst (topp-3 på voice_score flödar
  --      in i ALL AI-generering via getProfileAsMarkdown) ────────────────────
  DELETE FROM client_assets WHERE client_id = v_client_id AND category = 'winning_example' AND person_label = 'displayteknik_seed';

  INSERT INTO client_assets (client_id, asset_type, category, title, body, person_name, person_label, tags, voice_score, status) VALUES
  (v_client_id, 'post', 'winning_example',
   'Invändning — "En TV från nätet är billigare"',
   E'"En TV från nätet är ju billigare."\n\nI kartongen, ja.\n\nMen en konsument-TV är byggd för en soffa och några timmars kvällstittande. I ett skyltfönster ska skärmen stå på 12 timmar om dagen, med solen rakt i panelen halva året.\n\nDen dyraste skärmen är den som dör efter ett år — utan garanti som gäller, utan montering, utan någon att ringa.\n\nOsäker på vad rätt skärm kostar för just din plats? Skicka en bild — du får ett prisförslag inom 24 timmar.',
   'Håkan', 'displayteknik_seed', ARRAY['objection','pris','skyltfönster','bofu'], 9.5, 'active'),

  (v_client_id, 'post', 'winning_example',
   'Invändning — "Vi hinner inte uppdatera innehållet"',
   E'"Vi hinner inte uppdatera innehållet på en skärm."\n\nDet är det vanligaste hindret — och det enklaste att lösa.\n\nI publiceringssystemet schemalägger du innehåll i förväg: veckans kampanj, öppettider, priser. Lägg upp en månad på en gång, så rullar det själv.\n\nOch vill du inte röra det alls? Då sköter vi det.\n\nEn skärm ska aldrig stå tom. Det är vårt jobb att se till att den inte gör det.',
   'Håkan', 'displayteknik_seed', ARRAY['objection','innehåll','cms','mofu'], 9.4, 'active'),

  (v_client_id, 'post', 'winning_example',
   'Bevis — Skärmen som jobbat år efter år',
   E'Vissa leveranser är vi extra stolta över.\n\nX-Trafiks realtidsskärmar visar trafikinformation för resenärer — varje dag, året runt, i nordiskt klimat. De har rullat år efter år.\n\nIngen skärm hamnar där av en slump. Det är rätt hårdvara för miljön, rätt montering och support när det behövs.\n\nDet är så vi vill att alla våra leveranser ska åldras: i drift, inte i förrådet.\n\nEn kontakt för allt — val, montering, innehåll och support.',
   'Håkan', 'displayteknik_seed', ARRAY['bevis','xtrafik','drift','mofu'], 9.3, 'active'),

  (v_client_id, 'post', 'winning_example',
   'TOFU — Syns din butik från gatan?',
   E'Gå ut på gatan och titta på din egen butik.\n\nSer du erbjudandet i fönstret? Eller ser du en affisch som suttit där sedan i våras — och som solen ändå bleker bort?\n\nRörligt innehåll fångar blicken. En skärm i skyltfönstret visar veckans kampanj på morgonen och kvällens erbjudande efter lunch. Alltid aktuellt, aldrig blekt.\n\nButiker, bilhallar, restauranger, gym — samma sak överallt: det som syns säljer.\n\nNyfiken på vad det kostar? Skicka en bild på ditt skyltfönster — prisförslag inom 24 timmar.',
   'Håkan', 'displayteknik_seed', ARRAY['tofu','skyltfönster','synlighet','hook'], 9.2, 'active'),

  (v_client_id, 'post', 'winning_example',
   'BOFU — Så enkelt kommer du igång',
   E'Så här enkelt är det att komma igång med en digital skylt:\n\n1. Ta en bild på platsen — skyltfönstret, väggen, fasaden.\n2. Skicka den till oss. Inom 24 timmar har du ett prisförslag.\n3. Vi väljer rätt skärm för miljön: ljus, mått, väder.\n4. Vi levererar, monterar och kör igång.\n5. Du styr innehållet själv i publiceringssystemet — eller låter oss göra det.\n\nEn kontakt för hela kedjan. Support när du behöver den.\n\nBild in — pris ut. Enklare blir det inte.',
   'Håkan', 'displayteknik_seed', ARRAY['bofu','process','cta','24h'], 9.1, 'active');
END $$;
