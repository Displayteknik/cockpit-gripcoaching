import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/api-auth";

export const runtime = "nodejs";

// ENGÅNGS-SEED: maxad brand-profil + strategi för Displayteknik.
// Samma innehåll som migrations/displayteknik_brand_max.sql, men körbar från
// webbläsaren av inloggad admin (GET) — ingen SQL-editor behövs. Idempotent.
// Innehållet bygger på Håkans brandingdata (2026-07-19) + displayteknik.se.

const CLIENT_ID = "a6a33547-5ca7-475f-9a62-43ff2c74d000";

const PROFILE = {
  company_name: "Displayteknik i Sverige AB",
  tagline: "Fånga fler kunder med digitala skärmar och LED-skärmar",
  location: "Flygstaden Byggnad 116, 826 70 Söderhamn — leverans i hela Sverige och Åland, återkommande även Norge och Danmark",
  founder_name: "Håkan",
  founder_phone: "+46 72 541 01 02",
  founder_email: "support@displayteknik.se",
  booking_url: "https://displayteknik.se",
  brand_story:
    "Displayteknik i Sverige AB hjälper svenska företag att göra sitt varumärke synligt fysiskt — med LED-skärmar och digital skyltning, från idé till installation.\n\nKunderna har ofta redan en stark grafisk profil och kanske en byrå. Det som saknas är tekniken som får allt att leva i verkligheten: i skyltfönstret, i butiken, på fasaden, på mässan, i showroomet, i receptionen. Där är Displayteknik partnern i det digitalt fysiska.\n\nHåkan är uppvuxen med skärmar och teknik — en fascination som blev yrke, hantverk och passion. Det märks i tonen: entreprenör som pratar med entreprenör, inte en säljorganisation. Kunden pratar direkt med Håkan.\n\nLeveranserna talar för sig själva: digitala skärmar i Toyota Sveriges bilhallar runt om i landet, realtidsskärmar åt X-Trafik som rullat år efter år, Konserthuset i Stockholm, Ålands regering och Media 2011. Rätt hårdvara för nordiskt klimat — kyla, kondens, snö och lågt vintersolljus rakt in i skyltfönstret.\n\nEn kontakt. Ett ansvar. Från första idé till driftsatt lösning.\n\nOne-liner: Digital skyltning & LED-lösningar för butik, fastighet och event — från idé till installation.",
  usp:
    "Primärt löfte: Du får en skärm som syns, säljer och fungerar — år efter år.\nSekundärt löfte: Du slipper bli din egen AV-tekniker. Vi tar ansvar för val, installation, innehåll och support — en kontakt för allt.\n\nKommersiell vinkel: Företag förlorar kunder de aldrig ser. Skärmen säljer på plats när ingen annan gör det — och vi gör den delen enkel, trygg och driftsäker.\n\nTvå låga trösklar in:\n1. Digital fika — 30 minuter, ingen säljpitch.\n2. Skicka en bild på platsen — offert inom 24 timmar.",
  differentiators:
    "Det Displayteknik äger:\n- Personlig och lokal approach — kunden pratar direkt med Håkan, inte en säljorganisation. \"Digital fika, ingen säljpitch.\"\n- Helhetslösning från idé till installation — behovsanalys, offert, montering, innehåll, support. Inte bara hårdvara.\n- Snabb offertprocess — offert inom 24 timmar baserat på kundens egna bilder av lokalen.\n- Transparent prissättning med publika priser — ovanligt i branschen och bygger förtroende direkt.\n- Egen mjukvara: DT Player (innehållsstyrning/CMS med egen manual) och kommande plattformen DT Vivid.\n- Beprövat i nordiskt klimat: high-bright skyltfönsterskärmar (2 500–3 500 nits) och utomhusskärmar valda för kyla, kondens och motljus.\n- Nationell täckning från Söderhamn — hela Sverige och Åland, återkommande Norge och Danmark.\n- Bevisade referenser i drift: Toyota Sverige, X-Trafik, Konserthuset i Stockholm, Media 2011, Ålands regering.\n\nDet Displayteknik INTE tävlar om: lägsta kartongpris, konsument-TV, \"störst i Norden\"-fasad.\n\nEnkel konkurrensfördel: Många kan sälja en skärm. Färre kan få den att synas i solljus, överleva en norrländsk vinter och visa rätt innehåll — år efter år.",
  tone_rules:
    "Autentisk, personlig svensk ton — entreprenör som pratar med entreprenör. Aldrig en säljorganisations röst.\n\nTonen ska VARA: trygg, erfaren, konkret, rådgivande, jordnära, personlig, lösningsfokuserad.\nTonen ska INTE vara: teknisk jargong utan översättning, säljig, skrytig, reklambyråpolerad, abstrakt.\n\nNytta före teknik: \"Fånga fler kunder\" — inte specifikationer först. Korta, konkreta meningar. När fackord behövs (nits, pixel pitch, IP-klass) översätts de direkt: \"3 000 nits — syns även i direkt solljus\".\nKonkret och faktabaserat: verifierade siffror (nits, drifttimmar, priser, ROI) — aldrig floskler.\nPersonlig berättelse får ta plats: uppvuxen med skärmar och teknik — fascination som blev yrke, hantverk och passion.\nLåg tröskel i CTA: \"digital fika 30 min, ingen säljpitch\" eller \"skicka en bild — offert inom 24h\".\n\nNyckelord att återkomma till (variera): syns, säljer, drift, år efter år, en kontakt, helhet, installation, innehåll, support, nordiskt klimat, skyltfönster, digital fika, offert inom 24 timmar.\n\nAnvänd kundens egna formuleringar: \"vår skyltning ser trött ut\", \"syns inte i solljuset\", \"vem hjälper oss när den strular?\", \"vi hinner inte uppdatera\", \"vad kostar det egentligen?\".",
  icp_primary:
    "Varumärkesmedvetna B2B-företag som investerat i branding men vill synas bättre i fysiska miljöer. Beslutsfattare: ägare, marknadsansvarig, fastighetschef.\n\n1. Butiker och butikskedjor — skyltfönster och butiksmiljö (high-bright skärmar som syns i dagsljus)\n2. Fastighetsägare och fastighetsutvecklare — fasadskärmar, entréer, receptioner\n3. Event- och mässföretag — hyrskärmar och LED-väggar för monter och scen\n4. Bilhandlare — showroom och skyltexponering (referens: Toyota Sverige)\n5. Restauranger — digitala menyskärmar (växande vertikal, ~2 500 sökningar/mån)\n\nTypisk affär: 1–10 skärmar, en skyltfönsterlösning, en LED-vägg eller hyrlösning för event.\nPsykologiskt läge före köp: vet att skyltningen ser trött ut, har sett konkurrenter med skärmar, oroar sig för pris, teknikstrul och att ingen hinner sköta innehållet. Köper: uppmärksamhet på plats, proffsigt intryck, trygghet i drift — inte pixlar och paneler.",
  icp_secondary:
    "Offentlig verksamhet och trafikhuvudmän (resecentrum, kommuner, arenor, kulturhus) med krav på driftsäker information — referenser: X-Trafik, Konserthuset i Stockholm, Ålands regering.\nKedjor och koncerner som vill styra innehåll centralt över många orter via DT Player.\nBilanläggningar som behöver digital verkstadstavla (DaiSy Service).\nAV-, bygg- och mässprojekt där LED-vägg ingår i entreprenaden.",
  pain_points:
    "\"Vår skyltning ser trött ut — grannbutiken har redan skärm.\"\n\"Byrån har tagit fram en snygg profil — men i butiken och skyltfönstret syns den inte.\"\n\"Vi vet inte vilken skärm som passar — utbudet är en djungel och fel val blir dyrt.\"\n\"Skärmen i skyltfönstret syns inte i solljus.\" (fel ljusstyrka för miljön)\n\"Utomhusskärmen dog efter en vinter.\" (hårdvara som inte tål nordiskt klimat)\n\"Ingen hinner uppdatera innehållet — skärmen visar en gammal kampanj.\"\n\"Vem monterar, drar el och tar ansvar när något krånglar? Vi orkar inte jaga tre leverantörer.\"\n\"Tryckt skyltmaterial är dyrt, långsamt och alltid inaktuellt.\"",
  customer_quotes:
    "Media 2011: \"Vi är tacksamma för all hjälp med digitala skärmar för reklam\"\nToyota Sverige: \"Displayteknik har jobbat i nära samarbete med Toyota Sweden i flera år med leverans och installation av digitala skärmar i bilhallar runt om i landet\"\nX-Trafik: \"Digitala realtidsskärmar som har fungerat år efter år med vår trafikinformation\"\n\nÖvriga referenser (utan citat): Konserthuset i Stockholm, Ålands regering.",
  competitors:
    "LedKings — LED-skärmar, prispressare. Vi vinner på helhet, kvalitet för miljön och support i stället för lägsta kartongpris.\nMedialed — LED-lösningar nationellt. Vi vinner på personlig kontakt och snabbhet.\nSWEDX — skärmar och displayer. Vi vinner på helhetsleverans: installation, innehåll, support.\nSamsung — hårdvara/professionella displayer. Inte en direkt konkurrent i leveransen — kunden behöver fortfarande val, installation och drift; det är vårt jobb.\nVisual Art, Adtrade, Clear Channel — större digital signage-/mediaaktörer, starka på stora kedjeavtal men opersonliga och dyra för små och medelstora köpare. Vi vinner på tillgänglighet och pris.\nLokala AV-installatörer/elfirmor: kan montera men saknar helheten med CMS, innehåll och support.\nNäthandel/konsument-TV: billigast på papper — men inte byggd för 24/7-drift eller solljus, och kunden står ensam när det strular.\n\nDisplaytekniks position: personlig partner i det digitalt fysiska — helhetsansvar + nordisk klimaterfarenhet + transparenta priser + en kontakt (Håkan). Vi konkurrerar med totalkostnad över skärmens livstid, inte lägsta kartongpris. Prata aldrig ned konkurrenter vid namn i publikt innehåll.",
  customer_journey:
    "1) Omedveten: skyltningen har sett likadan ut i åratal — kunden ser den inte längre själv. Innehåll: igenkänning, \"syns din butik?\", vad rörligt innehåll gör med uppmärksamhet.\n2) Problemmedveten: \"vår skyltning ser trött ut\", konkurrenten har skärm. Innehåll: före/efter, vad en skärm gör för intrycket.\n3) Lösningsmedveten: förstår att digital skylt är svaret men inte vilken. Innehåll: rätt skärm för rätt miljö (skyltfönster/utomhus/LED/meny), utan jargong. Transparenta priser sänker tröskeln.\n4) Leverantörsval: jämför pris, trygghet och ansvar. Innehåll: referenser i drift (Toyota Sverige, X-Trafik, Konserthuset), en kontakt för allt, serviceavtal, publika priser.\n5) Kontakt — två låga trösklar: \"Digital fika 30 min — ingen säljpitch\" eller \"Skicka en bild på platsen → offert inom 24 timmar\".\n6) Leverans: val, installation, igångkörning av oss. Utbildning i DT Player.\n7) Drift: serviceavtal, support, innehållshjälp.\n8) Utökning: fler skärmar, fler orter, LED-vägg, hyrskärm till mässan — merförsäljning via bevisad nytta.",
  services:
    "LED-skärmar utomhus — fasad- och skyltexponering, byggda för nordiskt klimat | LED-skärmar inomhus — butik, kontor, lobby, showroom | High-brightness skyltfönsterskärmar (2 500–3 500 nits) — syns i dagsljus | LED-väggar — modulbaserade för fasad, arena, mässa | Hyrskärmar för event och mässa — korttidsuthyrning med leverans och installation | Digitala menyskärmar för restauranger | DT Player — innehållsstyrning/CMS med egen manual | DT Vivid — kommande signage-plattform (Studio/Player/Pulse) | Helhetsleverans: behovsanalys, offert inom 24h med bilduppladdning, installation, support | DaiSy Service — digital verkstadstavla för bilanläggningar",
  pricing_notes:
    "Publika riktpriser (transparens är en differentierare — använd dem):\n- High-brightness skyltfönsterskärm 43\": 21 000 kr\n- High-brightness skyltfönsterskärm 55\": 27 500 kr\n- High-brightness skyltfönsterskärm 65\": 36 900 kr\n- LED-väggar: från 20 000 kr/m²\n- Hyrskärmar för event/mässa: offert per uppdrag\n- Serviceavtal tillkommer för trygg drift\n\nOffert inom 24 timmar när kunden skickar bilder på platsen (bilduppladdning på sajten).\n\nPositionering: inte billigast per kartong — bäst totalkostnad över skärmens livstid (rätt val + installation + support = inga dyra felköp).\n\nVanliga invändningar att möta:\n1. \"Det är för dyrt\" → riktig siffra direkt (43\" från 21 000 kr komplett), jämför med tryckkostnader över tid + vad EN extra kund i veckan är värd\n2. \"En TV från nätet är billigare\" → konsument-TV är inte byggd för 24/7 eller solljus; dyrast är skärmen som dör efter ett år utan garanti, installation eller support\n3. \"Vi hinner inte uppdatera innehållet\" → schemalägg i förväg i DT Player, eller låt oss sköta det\n4. \"Funkar det verkligen utomhus här?\" → X-Trafiks realtidsskärmar har rullat år efter år i nordiskt klimat; vi väljer hårdvara därefter\n5. \"Vi vet inte vad vi ska visa\" → vi hjälper till med innehåll och mallar — skärmen ska aldrig stå tom",
  dos:
    "Var konkret om vad kunden får i sin leverans.\nLyft fram att en kontakt gäller hela kedjan: val, installation, innehåll, support.\nNämn kundsegment direkt: butiker, fastighetsägare, event/mässa, bilhandlare, restauranger.\nAnvänd riktiga siffror: priser (43\" från 21 000 kr), ljusstyrka (2 500–3 500 nits), år i drift, offert inom 24h. Transparens bygger förtroende.\nReferera till bevis: Toyota Sverige, X-Trafik, Konserthuset i Stockholm, Ålands regering, Media 2011.\nSkriv för nordiska förhållanden: vinter, kyla, motljus i skyltfönstret.\nVisa affärsnyttan (fler kunder in, mer sålt per besök) före tekniken.\nErbjud alltid en låg tröskel: \"Digital fika 30 min — ingen säljpitch\" eller \"Skicka en bild — offert inom 24 timmar.\"",
  donts:
    "Teknisk jargong utan översättning.\nGenerella påståenden utan exempel.\n\"kraftfull lösning\", \"banbrytande teknik\", \"holistisk\", \"skalbar\", \"nästa nivå\", \"handlar om\", \"game-changer\".\nLånga inledningar före kärnan.\nVagheter typ \"vara framtidsorienterat\" eller \"ekosystem\".\nLova aldrig priser, garantitider eller leveranstider utöver de publika riktpriserna.\nPrata aldrig ned konkurrenter vid namn i publikt innehåll.\nSälj aldrig tekniken före nyttan — kunden köper fler kunder, inte paneler.\nLåt aldrig tonen bli en säljorganisations — det är Håkan som pratar.",
  hashtags_base:
    "#digitalskyltning #digitalsignage #ledskärm #ledvägg #digitalaskyltar #skyltfönster #butikskommunikation #menyskärm #mässa #retail #söderhamn",
};

const STRATEGY_DOC = {
  title: "Strategidokument — positionering, marknad och innehållsstrategi",
  body: `# Displayteknik — Strategidokument (master)

## Kärnslutsats
Displayteknik positioneras som partnern i det digitalt fysiska: företag har ofta redan en stark grafisk profil (och kanske en byrå) — Displayteknik levererar tekniken som får varumärket att leva i verkligheten: i skyltfönstret, i butiken, på fasaden, på mässan, i showroomet, i receptionen. Starkaste kommersiella vinkeln: "Företag förlorar kunder de aldrig ser. Skärmen säljer på plats när ingen annan gör det — och Displayteknik gör den delen enkel, trygg och driftsäker."

One-liner: Digital skyltning & LED-lösningar för butik, fastighet och event — från idé till installation.

## Varumärkespersona
- Arketype: trygg teknisk expert + personlig entreprenör
- Håkan är central och ska inte döljas bakom företagsnamnet: uppvuxen med skärmar och teknik — fascination som blev yrke, hantverk och passion. Entreprenör som pratar med entreprenör.
- Roll i kundens huvud: "Han vet vad som funkar i vår miljö. Han tar ansvar. Jag pratar med en människa, inte en säljorganisation."
- Primärt löfte: Du får en skärm som syns, säljer och fungerar — år efter år
- Sekundärt löfte: Du slipper bli din egen AV-tekniker

## Positionering (4 varianter)
- Huvudpositionering: Displayteknik är helhetspartnern för digital skyltning och LED i Sverige — från idé till installation, byggt för nordiskt klimat, med personlig kontakt och transparenta priser.
- Kort: Digital skyltning & LED-lösningar för butik, fastighet och event — från idé till installation.
- Personlig: Håkan på Displayteknik hjälper företag att göra varumärket synligt fysiskt — och tar ansvar för att det fungerar, år efter år.
- Säljande: Ser din skyltning trött ut? Ta en digital fika (30 min, ingen säljpitch) eller skicka en bild på platsen — offert inom 24 timmar.

## Vad marknaden faktiskt köper
Uppmärksamhet på plats · fler kunder in genom dörren · mer sålt per besök · ett proffsigt intryck som matchar den grafiska profilen · att slippa teknikstrul · en investering som inte dör efter en vinter · någon att ringa när det krånglar · att slippa jaga tre leverantörer. Kommunikationen ska fokusera på affärsnytta och trygghet — inte paneler, tum och pixlar.

## Primära målgrupper (B2B)
Varumärkesmedvetna företag som investerat i branding men vill synas bättre i fysiska miljöer. Beslutsfattare: ägare, marknadsansvarig, fastighetschef.

1. **Butiker och butikskedjor** — skyltfönster och butiksmiljö (high-bright 2 500–3 500 nits som syns i dagsljus)
2. **Fastighetsägare och fastighetsutvecklare** — fasadskärmar, entréer, receptioner
3. **Event- och mässföretag** — hyrskärmar och LED-väggar för monter och scen
4. **Bilhandlare** — showroom och skyltexponering (referens: Toyota Sverige)
5. **Restauranger** — digitala menyskärmar (växande vertikal, ~2 500 sökningar/mån — egen innehållsserie motiverad)

### Typiska situationer
- Skyltningen har sett likadan ut i åratal — ingen ser den längre
- Konkurrenten/grannbutiken har satt upp en skärm
- Byrån har tagit fram profilen — men den syns inte i den fysiska miljön
- Nyöppning, flytt, ombyggnad eller mässa
- Tryckkostnaderna rullar men materialet är alltid inaktuellt
- En billig skärm har redan dött och bränt förtroendet

### Psykologiskt tillstånd före köp
- "Vår skyltning ser trött ut."
- "Vad kostar det egentligen?"
- "Vem hjälper oss när den strular?"
- "Vi hinner inte uppdatera innehåll."
- "Jag vill inte köpa fel."

### Vad kunden behöver höra
- Du behöver inte kunna tekniken — det är vårt jobb.
- Priserna är publika: skyltfönsterskärm 43" från 21 000 kr, LED-vägg från 20 000 kr/m².
- Ta en digital fika — 30 minuter, ingen säljpitch. Eller skicka en bild: offert inom 24 timmar.
- Vi väljer skärm efter din miljö: solljus, kyla, drifttid.
- Referenserna rullar år efter år: Toyota Sverige, X-Trafik, Konserthuset i Stockholm, Ålands regering.

## Sekundära målgrupper
- Offentlig verksamhet/trafik/kultur (resecentrum, kommuner, arenor, kulturhus): driftsäkerhet, realtidsdata. Bevis: X-Trafik, Konserthuset, Ålands regering. Ton: saklig, riskreducerande.
- Kedjor/koncerner: central innehållsstyrning över många orter via DT Player.
- Bilanläggningar: DaiSy Service — digital verkstadstavla.
- AV-/bygg-/mässprojekt: LED-vägg som del i entreprenad, projektpris.

## Konkurrenslandskap
- LedKings (prispressare), Medialed, SWEDX: hårdvarufokus — vi vinner på helhet, rätt val för miljön och support.
- Samsung m.fl. tillverkare: inte konkurrent i leveransen — kunden behöver fortfarande val, installation och drift.
- Visual Art, Adtrade, Clear Channel: stora aktörer för stora kedjeavtal — opersonliga och dyra för SME. Vi vinner på tillgänglighet, personlig kontakt och pris.
- Differentiering att alltid visa (aldrig genom att nämna konkurrenter): personlig kontakt (Håkan), helhet idé→installation, offert 24h på kundens bilder, transparenta publika priser, nordisk klimaterfarenhet, referenser i drift.

## Rösten
Autentisk, personlig, svensk. Entreprenör till entreprenör. Rak, trygg, konkret. Aldrig säljig, aldrig floskler — verifierade siffror (nits, drifttimmar, priser).

Exempel:
- "En skärm i skyltfönstret ska tåla två saker: vintern och solen. Annars är den snart bara en svart ruta."
- "Konsument-TV:n är billigare i kartongen. Sen ska den stå på 12 timmar om dagen i ett skyltfönster — det är där skillnaden märks."
- "X-Trafiks skärmar har rullat år efter år. Det är så vi vill att alla våra leveranser ska åldras."
- "Byrån har gjort jobbet — profilen är snygg. Vår uppgift är att den syns när kunden står utanför fönstret."

## 5 innehållspelare
1. **Synlighet & försäljning på plats** (TOFU): varför rörligt innehåll fångar blicken, "syns din butik?", varumärket i den fysiska miljön
2. **Före/efter & installationer** (TOFU/MOFU): riktiga jobb, miljöbilder, LED-väggar, mässmontrar — visuell bekräftelse
3. **Displayteknik förklarar** (MOFU): rätt skärm för rätt miljö — ljusstyrka, väder, skyltfönster, menyskärm, DT Player — utan jargong, alltid översatt
4. **Bevis & drift** (MOFU): Toyota Sverige, X-Trafik, Konserthuset, "år efter år"-berättelser, serviceavtal
5. **Praktiska beslut** (BOFU): publika priser, process, "digital fika 30 min" och "skicka en bild — offert inom 24h"

## Funnel: 60–65% TOFU / 25–30% MOFU / 10% BOFU
4 av 5 inlägg ska inte kännas som säljinlägg. Det femte gör jobbet med tydlig CTA (fika eller offert).

## Veckomix
- Mån: Analytical / C / TOFU — utbildande: så väljer du skärm, vanliga misstag
- Tis: Analytical / D / MOFU — så går en leverans till, från bild till driftsatt
- Ons: Aspirational / I / TOFU — före/efter, wow-installation, LED-vägg, mässa
- Tor: Aspirational / S / MOFU — trygghet: referens i drift, kundcase, supporten
- Fre: Actionable / D / BOFU — digital fika eller bild in → offert inom 24h
- Lör: Actionable / C / TOFU — checklista: 5 tecken på att skyltningen kostar dig kunder
- Sön: Authentic / S/I / TOFU — bakom kulisserna: installation, mätning på plats, Håkans berättelse, Söderhamn

## 6 återkommande serier
1. **Veckans miljö** — en vertikal per avsnitt (butik, fastighet, mässa, bilhall, restaurang): miljöns problem → rätt skärmtyp → vad det ger.
2. **Före/efter** — entré, skyltfönster, fasad eller monter före och efter installation. Låt bilden göra jobbet.
3. **Frågor vi ofta får** — pris (svara med riktiga siffror!), ljusstyrka, "funkar det på vintern?", "vem uppdaterar innehållet?", el och montering. En fråga per inlägg, rakt svar.
4. **Skärmen som jobbar** — driftberättelser: X-Trafik år efter år, Toyotas bilhallar, Konserthuset, DaiSy i verkstan. Bevis > löften.
5. **Vad ska du visa?** — innehållstips för skärmen: kampanj, priser, öppettider, socialt bevis. Ger värde + positionerar DT Player och innehållshjälp.
6. **Menyskärmen** — restaurangserien: lunchbyte på 2 minuter, kvällsmeny som byter själv, priser som alltid stämmer. Egen vertikal med egen sökvolym.

## 5 vanliga invändningar + svar
1. "Det är för dyrt." → "En skyltfönsterskärm på 43 tum kostar 21 000 kr komplett — priserna ligger öppet på sajten. Jämför med vad tryckt material kostar över tre år, och vad EN extra kund i veckan är värd. Skicka en bild så får du en exakt offert inom 24 timmar."
2. "En TV från nätet är billigare." → "I kartongen, ja. Men en konsument-TV är inte byggd för 12–24 timmars drift eller solljus i skyltfönstret. Den dyraste skärmen är den som dör efter ett år — utan garanti, installation eller någon att ringa."
3. "Vi hinner inte uppdatera innehållet." → "Det är det vanligaste hindret — och det enklaste att lösa. I DT Player schemalägger du innehåll i förväg, eller så sköter vi det. Skärmen ska aldrig stå tom."
4. "Funkar det verkligen utomhus här?" → "Det är vår hemmaplan. X-Trafiks realtidsskärmar har rullat år efter år i nordiskt klimat. Vi väljer hårdvara efter kyla, kondens och motljus — inte efter datablad."
5. "Vi vet inte vad vi ska visa." → "Det löser vi tillsammans. Kampanjer, priser, öppettider, kundomdömen — vi hjälper till med innehåll och mallar så skärmen säljer från dag ett."

## DISC-strategi
- D (Driver): resultat och fart — "bild in, offert inom 24h, monterat och klart". Format: före/efter, problem→lösning, tydlig CTA.
- I (Influence): syns och imponerar — LED-väggar, mässmontrar, wow-installationer. Format: video, bildserier, bakom kulisserna.
- S (Steadiness): trygghet — en kontakt (Håkan), serviceavtal, referenser i drift år efter år, "vi tar hand om det". Format: process, kundcase, digital fika.
- C (Compliance): fakta — publika priser, nits översatt, drifttid, totalkostnadskalkyl, checklistor. Format: utbildande inlägg, jämförelser, FAQ.

## Bild- och videostrategi
Prioritera: riktiga installationer i miljö med människor · före/efter · skärm i solljus/snö (nordisk kontext) · installation som pågår · LED-vägg och mässmonter i drift · skyltfönster kväll vs dag · menyskärm i restaurangmiljö · Håkan på plats hos kund · lokala miljöer.
Undvik: generiska stockbilder på "digital signage" · renderade konceptbilder utan sammanhang · skärmar med lorem ipsum-innehåll · teknik-närbilder utan kundnytta.
Videoformat: (1) hook på skärmtext "Den här butiken syntes inte från gatan" → (2) problemet → (3) installation/lösning → (4) resultatet → (5) "Digital fika 30 min — eller skicka en bild, offert inom 24 timmar."

## Profiltexter
- LinkedIn/Facebook-bio: "Displayteknik i Sverige AB — digital skyltning & LED-lösningar för butik, fastighet och event, från idé till installation. En kontakt för allt: val, installation, innehåll (DT Player) och support. Referenser i drift år efter år: Toyota Sverige, X-Trafik, Konserthuset i Stockholm. Digital fika 30 min — eller skicka en bild och få offert inom 24 timmar."
- Kort tagline: "Skärmar som syns, säljer och fungerar."
- Lokal tagline: "Digital skyltning för hela Sverige — från Söderhamn."

## Strategisk kärna (alltid)
Mer affärsnytta, mindre teknik. Mer bevis i drift, mindre löften. Mer före/efter. Mer Håkan och personlig kontakt. Mer transparenta priser. Mer "en kontakt, ett ansvar". Mer nordiskt klimat som hemmaplan. Mindre generell företagstext.

Kunden ska känna: "Han vet vad som funkar i vår miljö." · "De tar ansvar för helheten." · "Priserna ligger öppet — det här är tryggt." · "Jag behöver inte kunna tekniken själv." · "Det kommer att fungera — länge."`,
  ai_summary:
    "Master-strategidokument för Displayteknik. Positionering: partnern i det digitalt fysiska. Innehåller arketype (Håkan central), kundlöften, 4 positioneringsvarianter, 5 primära vertikaler (butik, fastighet, event/mässa, bilhandel, restaurang), konkurrenslandskap (LedKings, Medialed, SWEDX, Visual Art m.fl.), publika priser som differentierare, 5 innehållspelare, funnel-mix, veckomix, 6 serier, 5 invändningar+svar, DISC-strategi, bild/video-strategi, profiltexter och kundresa med dubbel CTA (digital fika / offert 24h).",
};

const WINNING_EXAMPLES = [
  {
    title: "Invändning — \"En TV från nätet är billigare\"",
    body: "\"En TV från nätet är ju billigare.\"\n\nI kartongen, ja.\n\nMen en konsument-TV är byggd för en soffa och några timmars kvällstittande. I ett skyltfönster ska skärmen stå på 12 timmar om dagen, med solen rakt i panelen halva året.\n\nDen dyraste skärmen är den som dör efter ett år — utan garanti som gäller, utan installation, utan någon att ringa.\n\nVåra skyltfönsterskärmar ligger öppet prissatta: 43 tum kostar 21 000 kr komplett. Osäker på vad som passar din plats? Skicka en bild — offert inom 24 timmar.",
    tags: ["objection", "pris", "skyltfönster", "bofu"],
    voice_score: 9.5,
  },
  {
    title: "Invändning — \"Vi hinner inte uppdatera innehållet\"",
    body: "\"Vi hinner inte uppdatera innehållet på en skärm.\"\n\nDet är det vanligaste hindret — och det enklaste att lösa.\n\nI DT Player schemalägger du innehåll i förväg: veckans kampanj, öppettider, priser. Lägg upp en månad på en gång, så rullar det själv.\n\nOch vill du inte röra det alls? Då sköter vi det.\n\nEn skärm ska aldrig stå tom. Det är vårt jobb att se till att den inte gör det.",
    tags: ["objection", "innehåll", "dtplayer", "mofu"],
    voice_score: 9.4,
  },
  {
    title: "Bevis — Skärmen som jobbat år efter år",
    body: "Vissa leveranser är vi extra stolta över.\n\nX-Trafiks realtidsskärmar visar trafikinformation för resenärer — varje dag, året runt, i nordiskt klimat. De har rullat år efter år.\n\nIngen skärm hamnar där av en slump. Det är rätt hårdvara för miljön, rätt installation och support när det behövs.\n\nSamma tänk ligger bakom skärmarna i Toyota Sveriges bilhallar och på Konserthuset i Stockholm.\n\nDet är så vi vill att alla våra leveranser ska åldras: i drift, inte i förrådet.",
    tags: ["bevis", "xtrafik", "toyota", "drift", "mofu"],
    voice_score: 9.3,
  },
  {
    title: "TOFU — Syns din butik från gatan?",
    body: "Gå ut på gatan och titta på din egen butik.\n\nSer du erbjudandet i fönstret? Eller ser du en affisch som suttit där sedan i våras — och som solen ändå bleker bort?\n\nNi har kanske lagt både tid och pengar på en snygg grafisk profil. Men i skyltfönstret, där kunden faktiskt står, syns den inte.\n\nRörligt innehåll fångar blicken. En skärm i skyltfönstret visar veckans kampanj på morgonen och kvällens erbjudande efter lunch. Alltid aktuellt, aldrig blekt.\n\nNyfiken? Skicka en bild på ditt skyltfönster — offert inom 24 timmar.",
    tags: ["tofu", "skyltfönster", "synlighet", "hook"],
    voice_score: 9.2,
  },
  {
    title: "BOFU — Så enkelt kommer du igång",
    body: "Så här enkelt är det att komma igång med en digital skylt:\n\n1. Ta en bild på platsen — skyltfönstret, väggen, fasaden.\n2. Skicka den till oss. Inom 24 timmar har du en offert.\n3. Vi väljer rätt skärm för miljön: ljus, mått, väder.\n4. Vi levererar, installerar och kör igång.\n5. Du styr innehållet själv i DT Player — eller låter oss göra det.\n\nEn kontakt för hela kedjan. Support när du behöver den.\n\nBild in — offert ut. Enklare blir det inte.",
    tags: ["bofu", "process", "cta", "24h"],
    voice_score: 9.1,
  },
  {
    title: "BOFU — Digital fika, ingen säljpitch",
    body: "Funderar du på skärm men vill inte bli såld på något?\n\nTa en digital fika med mig i stället. 30 minuter över video.\n\nDu berättar om din lokal och vad du vill uppnå. Jag säger ärligt vad som skulle funka — och vad som inte behövs. Ibland är svaret en enda skärm i fönstret. Ibland är det \"vänta med det där\".\n\nIngen säljpitch. Inga slides. Bara ett samtal mellan två som driver företag.\n\nBoka en tid så ses vi över en kopp.\n\n/Håkan",
    tags: ["bofu", "digitalfika", "cta", "personlig"],
    voice_score: 9.0,
  },
];

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const sb = supabaseService();

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
    meddelande: "Displaytekniks brand-profil + strategi är inlagd (v2 med brandingdata: priser, konkurrenter, DT Player, digital fika). Kolla /dashboard/profil.",
  });
}
