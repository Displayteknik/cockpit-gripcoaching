import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/api-auth";

export const runtime = "nodejs";

// ENGÅNGS-SEED: maxad brand-profil + strategi för Displayteknik.
// Samma innehåll som migrations/displayteknik_brand_max.sql, men körbar från
// webbläsaren av inloggad admin (GET) — ingen SQL-editor behövs. Idempotent.

const CLIENT_ID = "a6a33547-5ca7-475f-9a62-43ff2c74d000";

const PROFILE = {
  company_name: "Displayteknik i Sverige AB",
  tagline: "Fånga fler kunder med digitala skärmar och LED-skärmar",
  location: "Flygstaden Byggnad 116, 826 70 Söderhamn — levererar i hela Sverige, samt Norge, Danmark, Finland och Åland via partner",
  founder_name: "Håkan",
  founder_phone: "+46 72 541 01 02",
  founder_email: "support@displayteknik.se",
  booking_url: "https://displayteknik.se",
  brand_story:
    "Displayteknik i Sverige AB utgår från Flygstaden i Söderhamn och hjälper företag i hela Sverige att installera, styra och använda professionella digitala skärmar.\n\nVi har levererat och installerat skärmar i bilhallar åt Toyota Sweden runt om i landet, realtidsskärmar åt X-Trafik som fungerat år efter år i tuff drift, och reklamskärmar åt Media 2011. Det är den sortens leveranser vi bygger på: skärmar som gör jobbet — länge.\n\nVi är inte en webbshop som skickar en kartong. Vi tar ansvar för hela kedjan: rätt skärm för miljön, montering, publiceringssystem och support när skärmen väl snurrar. Nordiskt klimat ställer särskilda krav — kyla, kondens, snö och lågt vintersolljus rakt in i skyltfönstret. Därför rekommenderar vi bara hårdvara vi vet klarar drift dygnet runt, år efter år.\n\nArketype: den trygga tekniska experten + den praktiska problemlösaren. Displayteknik kommunicerar som en erfaren rådgivare som sett hundratals miljöer — inte som en återförsäljare som vill bli av med lager. Kunden ska känna: \"De vet vad som funkar. De tar ansvar. Jag behöver bara ringa ett nummer.\"\n\nEn kontakt. Ett ansvar. Från första idé till driftsatt lösning.",
  usp:
    "Primärt löfte: Du får en skärm som syns, säljer och fungerar — år efter år.\nSekundärt löfte: Du slipper bli din egen AV-tekniker. Vi tar ansvar för val, montering, innehåll och support — en kontakt för allt.\n\nKommersiell vinkel: Företag förlorar kunder de aldrig ser. Skärmen säljer på plats när ingen annan gör det — och vi gör den delen enkel, trygg och driftsäker. Skicka en bild på platsen och få prisförslag inom 24 timmar.",
  differentiators:
    "Det Displayteknik äger:\n- Helhetsansvar i stället för kartongleverans — vi projekterar, monterar, driftsätter och supportar. Inte bara säljer.\n- Beprövat i nordiskt klimat: utomhus- och skyltfönsterskärmar valda för kyla, kondens och starkt motljus.\n- Referenser i DRIFT år efter år (Toyota Sweden, X-Trafik) — inte bara säljcase.\n- Rikstäckande leverans med småföretagets tillgänglighet: du pratar med samma person hela vägen, inte ett ärendenummer.\n- Oberoende av enskild tillverkare — vi väljer skärm efter kundens miljö och budget, inte efter eget lager.\n- Snabbhet i första steget: bild in, prisförslag ut inom 24 timmar.\n\nDet Displayteknik INTE tävlar om: lägsta kartongpris, konsument-TV-apparater, \"störst i Norden\"-fasad.\n\nEnkel konkurrensfördel: Många kan sälja en skärm. Färre kan få den att synas i solljus, överleva en norrländsk vinter och visa rätt innehåll — år efter år.",
  tone_rules:
    "Professionell men tillgänglig. Praktisk och problemlösande. Talar direkt till mottagarens miljö och behov.\n\nTonen ska VARA: trygg, erfaren, konkret, rådgivande, jordnära, lösningsfokuserad.\nTonen ska INTE vara: teknisk jargong utan översättning, säljig, skrytig, reklambyråpolerad, abstrakt.\n\nKorta, konkreta meningar. Vardagliga ord (skärm, montering, drift) i stället för fackspråk — och när fackord behövs (nits, pixel pitch, IP-klass) översätts de direkt: \"4 000 nits — syns även i direkt solljus\".\nSiffror och exempel före adjektiv. Bevis före påståenden.\n\nNyckelord att återkomma till (variera): syns, säljer, drift, år efter år, en kontakt, helhet, montering, innehåll, support, nordiskt klimat, skyltfönster, prisförslag inom 24 timmar.\n\nAnvänd kundens egna formuleringar: \"vår skyltning ser trött ut\", \"syns inte i solljuset\", \"vem hjälper oss när den strular?\", \"vi hinner inte uppdatera\", \"vad kostar det egentligen?\".",
  icp_primary:
    "Beslutsfattare (ägare, butikschef, marknadsansvarig, fastighetschef) hos butiker, bilhallar, kedjor, restauranger, hotell, gym, köpcentrum och fastighetsägare i Sverige som vill synas bättre och sälja mer på plats. Typisk affär: 1–10 skärmar, en skyltfönsterlösning eller en LED-vägg.\n\nPsykologiskt läge före köp: vet att skyltningen ser trött ut, har sett konkurrenter med skärmar, oroar sig för pris, teknikstrul och att ingen hinner sköta innehållet. Köper: uppmärksamhet på plats, proffsigt intryck, trygghet i drift — inte pixlar och paneler.",
  icp_secondary:
    "Offentlig verksamhet och trafikhuvudmän (resecentrum, kommuner, arenor, skidanläggningar) med krav på driftsäker realtidsinformation — referens: X-Trafik.\nKedjor och koncerner som vill styra innehåll centralt över många orter.\nBilanläggningar som behöver digital verkstadstavla (DaiSy Service) — referens: Toyota Sweden.\nAV-, bygg- och mässprojekt där LED-vägg ingår i entreprenaden.",
  pain_points:
    "\"Vår skyltning ser trött ut — grannbutiken har redan skärm.\"\n\"Vi vet inte vilken skärm som passar — utbudet är en djungel och fel val blir dyrt.\"\n\"Skärmen i skyltfönstret syns inte i solljus.\" (fel ljusstyrka för miljön)\n\"Utomhusskärmen dog efter en vinter.\" (hårdvara som inte tål nordiskt klimat)\n\"Ingen hinner uppdatera innehållet — skärmen visar en gammal kampanj.\"\n\"Vem monterar, drar el och tar ansvar när något krånglar? Vi orkar inte jaga tre leverantörer.\"\n\"Tryckt skyltmaterial är dyrt, långsamt och alltid inaktuellt.\"",
  customer_quotes:
    "Media 2011: \"Vi är tacksamma för all hjälp med digitala skärmar för reklam\"\nToyota Sweden: \"Displayteknik har jobbat i nära samarbete med Toyota Sweden i flera år med leverans och installation av digitala skärmar i bilhallar runt om i landet\"\nX-Trafik: \"Digitala realtidsskärmar som har fungerat år efter år med vår trafikinformation\"",
  competitors:
    "Rikstäckande signage-bolag (ZetaDisplay, Visual Art, Vertiseit/Dise, Smartsign): starka på stora kedjeavtal men opersonliga och ofta dyra för små och medelstora köpare. Vi vinner på tillgänglighet och helhet i mindre/medelstora affärer.\nLokala AV-installatörer och elfirmor: kan montera, men saknar helheten med publiceringssystem, innehåll och support. Vi vinner på \"en kontakt för allt\".\nNäthandel/direktimport och konsument-TV: billigast på papper — men kunden står själv för val, montering, innehåll och allt som krånglar, och hårdvaran är inte byggd för 24/7-drift eller solljus. Vi vinner på totalkostnad över livstiden.\n\nDisplaytekniks position: helhetsansvar + nordisk klimaterfarenhet + en personlig kontakt. Vi konkurrerar med totalkostnad över skärmens livstid, inte lägsta kartongpris. Prata aldrig ned konkurrenter vid namn i publikt innehåll.",
  customer_journey:
    "1) Omedveten: skyltningen har sett likadan ut i åratal — kunden ser den inte längre själv. Innehåll: igenkänning, \"syns din butik?\", vad rörligt innehåll gör med uppmärksamhet.\n2) Problemmedveten: \"vår skyltning ser trött ut\", konkurrenten har skärm. Innehåll: före/efter, vad en skärm gör för intrycket.\n3) Lösningsmedveten: förstår att digital skylt är svaret men inte vilken. Innehåll: rätt skärm för rätt miljö (skyltfönster/utomhus/LED), utan jargong.\n4) Leverantörsval: jämför pris, trygghet och ansvar. Innehåll: referenser i drift (Toyota, X-Trafik), en kontakt för allt, serviceavtal.\n5) Kontakt — låg tröskel: \"Skicka en bild på platsen → prisförslag inom 24 timmar.\"\n6) Leverans: val, montering, igångkörning av oss. Utbildning i publiceringssystemet.\n7) Drift: serviceavtal, support, innehållshjälp.\n8) Utökning: fler skärmar, fler orter, uppgradering till LED-vägg — merförsäljning via bevisad nytta.",
  services:
    "Inomhusskärmar (butik, restaurang, gym, hotell, kontor, vårdmiljö) | Skyltfönsterskärmar high-bright — syns även i solljus | Utomhusskärmar byggda för nordiskt klimat | LED-skärmar och LED-väggar (fasad, arena, mässa, skyltfönster) | Innehållsstyrning/CMS — webbaserad med planering och schemaläggning | Installation, montage och igångkörning | Service- och supportavtal | DaiSy Service — digital verkstadstavla för bilanläggningar",
  pricing_notes:
    "Enklare digital butiksskylt: från några tiotusentals kronor komplett.\nSkyltfönster- (high-bright) och utomhusskärmar: högre, styrs av ljusstyrka och väderskydd.\nLED-väggar: projektpris — yta, pixeltäthet och montering avgör.\nServiceavtal tillkommer för trygg drift.\nPrisförslag inom 24 timmar när kunden skickar en bild på platsen.\n\nPositionering: inte billigast per kartong — bäst totalkostnad över skärmens livstid (rätt val + installation + support = inga dyra felköp).\n\nVanliga invändningar att möta:\n1. \"Det är för dyrt\" → jämför med tryckkostnader över tid + vad EN extra kund i veckan är värd; börja med en skärm; bild in → pris inom 24h\n2. \"En TV från nätet är billigare\" → konsument-TV är inte byggd för 24/7 eller solljus; dyrast är skärmen som dör efter ett år utan garanti, montering eller support\n3. \"Vi hinner inte uppdatera innehållet\" → schemalägg i förväg i publiceringssystemet, eller låt oss sköta det\n4. \"Funkar det verkligen utomhus här?\" → X-Trafiks realtidsskärmar har rullat år efter år i nordiskt klimat; vi väljer hårdvara därefter\n5. \"Vi vet inte vad vi ska visa\" → vi hjälper till med innehåll och mallar — skärmen ska aldrig stå tom",
  dos:
    "Var konkret om vad kunden får i sin leverans.\nLyft fram att en kontakt gäller hela kedjan: val, installation, innehåll, support.\nNämn kundsegment direkt: butiker, bilhallar, restauranger, hotell, gym, fastighetsägare.\nAnvänd siffror när de finns: storlek, ljusstyrka, år i drift, prisförslag inom 24h.\nReferera till bevis: Toyota Sweden, X-Trafik, Media 2011.\nSkriv för nordiska förhållanden: vinter, kyla, motljus i skyltfönstret.\nVisa affärsnyttan (fler kunder in, mer sålt per besök) före tekniken.\nAvsluta med en enkel handling: \"Skicka en bild på platsen — få prisförslag inom 24 timmar.\"",
  donts:
    "Teknisk jargong utan översättning.\nGenerella påståenden utan exempel.\n\"kraftfull lösning\", \"banbrytande teknik\", \"holistisk\", \"skalbar\", \"nästa nivå\", \"handlar om\", \"game-changer\".\nLånga inledningar före kärnan.\nVagheter typ \"vara framtidsorienterat\" eller \"ekosystem\".\nLova aldrig priser, garantitider eller leveranstider som inte är bekräftade.\nPrata aldrig ned konkurrenter vid namn i publikt innehåll.\nSälj aldrig tekniken före nyttan — kunden köper fler kunder, inte paneler.",
  hashtags_base:
    "#digitalskyltning #digitalsignage #ledskärm #ledvägg #digitalaskyltar #skyltfönster #butikskommunikation #retail #bilhall #söderhamn",
};

const STRATEGY_DOC = {
  title: "Strategidokument — positionering, marknad och innehållsstrategi",
  body: `# Displayteknik — Strategidokument (master)

## Kärnslutsats
Displayteknik positioneras som den trygga helhetspartnern för digitala skärmar i nordiskt klimat: en kontakt, ett ansvar, skärmar i drift år efter år. Starkaste kommersiella vinkeln: "Företag förlorar kunder de aldrig ser. Skärmen säljer på plats när ingen annan gör det — och Displayteknik gör den delen enkel, trygg och driftsäker."

## Varumärkespersona
- Arketype: trygg teknisk expert + praktisk problemlösare
- Blandning av: den erfarna rådgivaren, den metodiska installatören, den pålitliga leverantören som svarar när det strular
- Roll i kundens huvud: "De vet vad som funkar i vår miljö. De tar ansvar. Jag behöver bara ringa ett nummer."
- Primärt löfte: Du får en skärm som syns, säljer och fungerar — år efter år
- Sekundärt löfte: Du slipper bli din egen AV-tekniker

## Positionering (4 varianter)
- Huvudpositionering: Displayteknik är helhetspartnern för digitala skärmar och LED-skärmar i Sverige — från val och montering till innehåll och support, byggt för nordiskt klimat.
- Kort: Skärmar som syns, säljer och fungerar. År efter år.
- Personlig: Vi hjälper butiker, bilhallar och fastighetsägare att fånga fler kunder med digitala skärmar — och tar ansvar för att de fungerar.
- Säljande: Ser din skyltning trött ut? Skicka en bild på platsen — du får ett prisförslag inom 24 timmar och en partner som tar hand om resten.

## Vad marknaden faktiskt köper
Uppmärksamhet på plats · fler kunder in genom dörren · mer sålt per besök · ett proffsigt intryck · att slippa teknikstrul · en investering som inte dör efter en vinter · någon att ringa när det krånglar · att slippa jaga tre leverantörer. Kommunikationen ska fokusera på affärsnytta och trygghet — inte paneler, tum och pixlar.

## Primär målgrupp
Beslutsfattare hos butiker, bilhallar, kedjor, restauranger, hotell, gym, köpcentrum och fastighetsägare i Sverige. Typisk affär: 1–10 skärmar, en skyltfönsterlösning eller en LED-vägg.

### Typiska situationer
- Skyltningen har sett likadan ut i åratal — ingen ser den längre
- Konkurrenten/grannbutiken har satt upp en skärm
- Nyöppning, flytt eller ombyggnad
- Tryckkostnaderna rullar men materialet är alltid inaktuellt
- Skyltfönstret syns inte i solljus
- En billig skärm har redan dött och bränt förtroendet

### Psykologiskt tillstånd före köp
- "Vår skyltning ser trött ut."
- "Vad kostar det egentligen?"
- "Vem hjälper oss när den strular?"
- "Vi hinner inte uppdatera innehåll."
- "Jag vill inte köpa fel."

### Vad kunden behöver höra
- Du behöver inte kunna tekniken — det är vårt jobb.
- Skicka en bild på platsen, du får prisförslag inom 24 timmar.
- Vi väljer skärm efter din miljö: solljus, kyla, drifttid.
- En kontakt för allt: val, montering, innehåll, support.
- Referenserna rullar år efter år: Toyota Sweden, X-Trafik.

## Sekundära målgrupper
- Offentlig verksamhet/trafik (resecentrum, kommuner, arenor, skidanläggningar): driftsäkerhet, realtidsdata, dokumenterad leverans. Ton: saklig, riskreducerande. Bevis: X-Trafik.
- Kedjor/koncerner: central innehållsstyrning över många orter, en leverantör i stället för tio. Bevis: Toyota Sweden.
- Bilanläggningar: DaiSy Service — digital verkstadstavla.
- AV-/bygg-/mässprojekt: LED-vägg som del i entreprenad, projektpris.

## Rösten
Rak. Trygg. Konkret. Rådgivande. Aldrig säljig.

Exempel:
- "En skärm i skyltfönstret ska tåla två saker: vintern och solen. Annars är den snart bara en svart ruta."
- "Konsument-TV:n är billigare i kartongen. Sen ska den stå på 12 timmar om dagen i ett skyltfönster — det är där skillnaden märks."
- "X-Trafiks skärmar har rullat år efter år. Det är så vi vill att alla våra leveranser ska åldras."

## 5 innehållspelare
1. **Synlighet & försäljning på plats** (TOFU): varför rörligt innehåll fångar blicken, vad skyltningen gör med intrycket, "syns din butik?"
2. **Före/efter & installationer** (TOFU/MOFU): riktiga jobb, miljöbilder, LED-väggar — visuell bekräftelse
3. **Displayteknik förklarar** (MOFU): rätt skärm för rätt miljö — ljusstyrka, väder, skyltfönster, CMS — utan jargong, alltid översatt
4. **Bevis & drift** (MOFU): Toyota, X-Trafik, "år efter år"-berättelser, serviceavtal, en kontakt
5. **Praktiska beslut** (BOFU): pris, process, "skicka en bild — prisförslag inom 24h"

## Funnel: 60–65% TOFU / 25–30% MOFU / 10% BOFU
4 av 5 inlägg ska inte kännas som säljinlägg. Det femte gör jobbet med tydlig CTA.

## Veckomix
- Mån: Analytical / C / TOFU — utbildande: så väljer du skärm, vanliga misstag
- Tis: Analytical / D / MOFU — så går en leverans till, från bild till driftsatt
- Ons: Aspirational / I / TOFU — före/efter, wow-installation, LED-vägg
- Tor: Aspirational / S / MOFU — trygghet: referens i drift, kundcase, supporten
- Fre: Actionable / D / BOFU — skicka en bild, pris inom 24h, boka
- Lör: Actionable / C / TOFU — checklista: 5 tecken på att skyltningen kostar dig kunder
- Sön: Authentic / S/I / TOFU — bakom kulisserna: montering, mätning på plats, Söderhamn

## 5 återkommande serier
1. **Veckans miljö** — en bransch per avsnitt (bilhall, gym, restaurang, hotell, butik): miljöns problem → rätt skärmtyp → vad det ger. Positionerar bredden utan att skryta.
2. **Före/efter** — entré, skyltfönster eller fasad före och efter installation. Låt bilden göra jobbet.
3. **Frågor vi ofta får** — pris, ljusstyrka, "funkar det på vintern?", "vem uppdaterar innehållet?", el och montering. En fråga per inlägg, rakt svar.
4. **Skärmen som jobbar** — driftberättelser: X-Trafik år efter år, Toyotas bilhallar, DaiSy i verkstan. Bevis > löften.
5. **Vad ska du visa?** — innehållstips för skärmen: kampanj, priser, öppettider, socialt bevis. Ger värde + positionerar CMS och innehållshjälp.

## 5 vanliga invändningar + svar
1. "Det är för dyrt." → "En enklare butiksskylt börjar på några tiotusentals kronor komplett. Jämför med vad tryckt material kostar över tre år — och vad EN extra kund i veckan är värd. Skicka en bild så får du en riktig siffra inom 24 timmar."
2. "En TV från nätet är billigare." → "I kartongen, ja. Men en konsument-TV är inte byggd för 12–24 timmars drift eller solljus i skyltfönstret. Den dyraste skärmen är den som dör efter ett år — utan garanti, montering eller någon att ringa."
3. "Vi hinner inte uppdatera innehållet." → "Det är det vanligaste hindret — och det enklaste att lösa. Du schemalägger innehåll i förväg i publiceringssystemet, eller låter oss sköta det. Skärmen ska aldrig stå tom."
4. "Funkar det verkligen utomhus här?" → "Det är vår hemmaplan. X-Trafiks realtidsskärmar har rullat år efter år i nordiskt klimat. Vi väljer hårdvara efter kyla, kondens och motljus — inte efter datablad."
5. "Vi vet inte vad vi ska visa." → "Det löser vi tillsammans. Kampanjer, priser, öppettider, kundomdömen — vi hjälper till med innehåll och mallar så skärmen säljer från dag ett."

## DISC-strategi
- D (Driver): resultat och fart — "bild in, pris inom 24h, monterat och klart". Format: före/efter, problem→lösning, tydlig CTA.
- I (Influence): syns och imponerar — LED-väggar, wow-installationer, "titta vad det blev". Format: video, bildserier, bakom kulisserna.
- S (Steadiness): trygghet — en kontakt, serviceavtal, referenser i drift år efter år, "vi tar hand om det". Format: process, kundcase, support-berättelser.
- C (Compliance): fakta — ljusstyrka i nits (översatt), IP-klass, drifttid, totalkostnadskalkyl, checklistor. Format: utbildande inlägg, jämförelser, FAQ.

## Bild- och videostrategi
Prioritera: riktiga installationer i miljö med människor · före/efter · skärm i solljus/snö (nordisk kontext) · montering som pågår · LED-vägg i drift · skyltfönster kväll vs dag · lokala miljöer.
Undvik: generiska stockbilder på "digital signage" · renderade konceptbilder utan sammanhang · skärmar med lorem ipsum-innehåll · teknik-närbilder utan kundnytta.
Videoformat: (1) hook på skärmtext "Den här butiken syntes inte från gatan" → (2) problemet → (3) montering/lösning → (4) resultatet → (5) "Skicka en bild på din plats — prisförslag inom 24 timmar."

## Profiltexter
- LinkedIn/Facebook-bio: "Displayteknik i Sverige AB hjälper företag att installera, styra och använda professionella digitala skärmar. En kontakt för allt: val, montering, innehåll och support. Referenser i drift år efter år — Toyota Sweden, X-Trafik. Skicka en bild på din plats, få prisförslag inom 24 timmar."
- Kort tagline: "Skärmar som syns, säljer och fungerar."
- Lokal tagline: "Digitala skärmar för hela Sverige — från Söderhamn."

## Strategisk kärna (alltid)
Mer affärsnytta, mindre teknik. Mer bevis i drift, mindre löften. Mer före/efter. Mer "en kontakt, ett ansvar". Mer nordiskt klimat som hemmaplan. Mindre generell företagstext.

Kunden ska känna: "De vet vad som funkar i vår miljö." · "De tar ansvar för helheten." · "Det här är tryggt." · "Jag behöver inte kunna tekniken själv." · "Det kommer att fungera — länge."`,
  ai_summary:
    "Master-strategidokument för Displayteknik. Innehåller arketype, primärt+sekundärt kundlöfte, 4 positioneringsvarianter, målgruppspsykologi per segment, 5 innehållspelare, funnel-mix, veckomix, 5 återkommande serier, 5 invändningar+svar, DISC-strategi, bild/video-strategi, profiltexter och kundresa.",
};

const WINNING_EXAMPLES = [
  {
    title: "Invändning — \"En TV från nätet är billigare\"",
    body: "\"En TV från nätet är ju billigare.\"\n\nI kartongen, ja.\n\nMen en konsument-TV är byggd för en soffa och några timmars kvällstittande. I ett skyltfönster ska skärmen stå på 12 timmar om dagen, med solen rakt i panelen halva året.\n\nDen dyraste skärmen är den som dör efter ett år — utan garanti som gäller, utan montering, utan någon att ringa.\n\nOsäker på vad rätt skärm kostar för just din plats? Skicka en bild — du får ett prisförslag inom 24 timmar.",
    tags: ["objection", "pris", "skyltfönster", "bofu"],
    voice_score: 9.5,
  },
  {
    title: "Invändning — \"Vi hinner inte uppdatera innehållet\"",
    body: "\"Vi hinner inte uppdatera innehållet på en skärm.\"\n\nDet är det vanligaste hindret — och det enklaste att lösa.\n\nI publiceringssystemet schemalägger du innehåll i förväg: veckans kampanj, öppettider, priser. Lägg upp en månad på en gång, så rullar det själv.\n\nOch vill du inte röra det alls? Då sköter vi det.\n\nEn skärm ska aldrig stå tom. Det är vårt jobb att se till att den inte gör det.",
    tags: ["objection", "innehåll", "cms", "mofu"],
    voice_score: 9.4,
  },
  {
    title: "Bevis — Skärmen som jobbat år efter år",
    body: "Vissa leveranser är vi extra stolta över.\n\nX-Trafiks realtidsskärmar visar trafikinformation för resenärer — varje dag, året runt, i nordiskt klimat. De har rullat år efter år.\n\nIngen skärm hamnar där av en slump. Det är rätt hårdvara för miljön, rätt montering och support när det behövs.\n\nDet är så vi vill att alla våra leveranser ska åldras: i drift, inte i förrådet.\n\nEn kontakt för allt — val, montering, innehåll och support.",
    tags: ["bevis", "xtrafik", "drift", "mofu"],
    voice_score: 9.3,
  },
  {
    title: "TOFU — Syns din butik från gatan?",
    body: "Gå ut på gatan och titta på din egen butik.\n\nSer du erbjudandet i fönstret? Eller ser du en affisch som suttit där sedan i våras — och som solen ändå bleker bort?\n\nRörligt innehåll fångar blicken. En skärm i skyltfönstret visar veckans kampanj på morgonen och kvällens erbjudande efter lunch. Alltid aktuellt, aldrig blekt.\n\nButiker, bilhallar, restauranger, gym — samma sak överallt: det som syns säljer.\n\nNyfiken på vad det kostar? Skicka en bild på ditt skyltfönster — prisförslag inom 24 timmar.",
    tags: ["tofu", "skyltfönster", "synlighet", "hook"],
    voice_score: 9.2,
  },
  {
    title: "BOFU — Så enkelt kommer du igång",
    body: "Så här enkelt är det att komma igång med en digital skylt:\n\n1. Ta en bild på platsen — skyltfönstret, väggen, fasaden.\n2. Skicka den till oss. Inom 24 timmar har du ett prisförslag.\n3. Vi väljer rätt skärm för miljön: ljus, mått, väder.\n4. Vi levererar, monterar och kör igång.\n5. Du styr innehållet själv i publiceringssystemet — eller låter oss göra det.\n\nEn kontakt för hela kedjan. Support när du behöver den.\n\nBild in — pris ut. Enklare blir det inte.",
    tags: ["bofu", "process", "cta", "24h"],
    voice_score: 9.1,
  },
];

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const sb = supabaseServer();

  // 1. Brand-profil — upsert alla fält
  const existing = await sb.from("hm_brand_profile").select("id").eq("client_id", CLIENT_ID).maybeSingle();
  if (existing.error) return NextResponse.json({ error: existing.error.message }, { status: 500 });
  let profileAction: string;
  if (existing.data) {
    const { error } = await sb.from("hm_brand_profile").update({ ...PROFILE, updated_at: new Date().toISOString() }).eq("client_id", CLIENT_ID);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    profileAction = "uppdaterad";
  } else {
    const { data: maxRow } = await sb.from("hm_brand_profile").select("id").order("id", { ascending: false }).limit(1).maybeSingle();
    const { error } = await sb.from("hm_brand_profile").insert({ id: (maxRow?.id ?? 0) + 1, client_id: CLIENT_ID, ...PROFILE, updated_at: new Date().toISOString() });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    profileAction = "skapad";
  }

  // 2. Strategidokument (ersätt ev. tidigare)
  await sb.from("client_assets").delete().eq("client_id", CLIENT_ID).eq("category", "strategy_doc");
  const stratIns = await sb.from("client_assets").insert({
    client_id: CLIENT_ID,
    asset_type: "document",
    category: "strategy_doc",
    title: STRATEGY_DOC.title,
    body: STRATEGY_DOC.body,
    person_name: "Håkan",
    person_label: "strategy_master",
    tags: ["strategy", "persona", "positionering", "disc", "funnel", "master_doc"],
    voice_score: 9.5,
    status: "active",
    ai_summary: STRATEGY_DOC.ai_summary,
  });
  if (stratIns.error) return NextResponse.json({ error: "strategy_doc: " + stratIns.error.message }, { status: 500 });

  // 3. Vinnande exempel (ersätt tidigare seed)
  await sb.from("client_assets").delete().eq("client_id", CLIENT_ID).eq("category", "winning_example").eq("person_label", "displayteknik_seed");
  const winIns = await sb.from("client_assets").insert(
    WINNING_EXAMPLES.map((w) => ({
      client_id: CLIENT_ID,
      asset_type: "post",
      category: "winning_example",
      title: w.title,
      body: w.body,
      person_name: "Håkan",
      person_label: "displayteknik_seed",
      tags: w.tags,
      voice_score: w.voice_score,
      status: "active",
    })),
  );
  if (winIns.error) return NextResponse.json({ error: "winning_examples: " + winIns.error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    brand_profil: profileAction,
    strategidokument: 1,
    vinnande_exempel: WINNING_EXAMPLES.length,
    meddelande: "Displaytekniks brand-profil + strategi är inlagd. Kolla /dashboard/profil — och all AI-generering använder nu strategin.",
  });
}
