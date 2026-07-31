# TEXT1-RESULTAT — före/efter promptmigreringen (T-4)

Genererad 2026-07-31 17:32. Samma 5 låsta ämnen (docs/text1/amnen.json), samma 4 klientprofiler, samma mätsticka (autochecks) på båda sidor. FÖRE = koden före TEXT-1 (studio-text fångad från worktree på T-2-commit — vägen orörd t.o.m. dess). EFTER = prompt-core-vägen **efter justeringsrundan T-5** (tabellerna nedan visar alltså före → efter-T5; v1-mellanmätningen finns i sektionen här under).

## Justeringsrundan (T-5) — utfall

Hela efter-batchen omkörd 2026-07-31 kväll mot T-5-koden (180/180 lyckade; en post, engens-trad/studio-text/bakom-kulisserna, föll 3 ggr i kvalitetsfiltren i batchen och omkördes separat med samma kod + autochecks; batchens DB-städning verifierad i loggen: linkedin_posts 20/0 kvar, hm_social_posts 20/0, agent_experiments 26+1/0, client_activity 40/0, voice_profile återställd).

**Åtgärder i rundan:** (v2) sanering av studio-textens poster-fält efter score · HTML-säker tankstrecks-sanering för blogg-brödtext (`taBortTankstreckHtml`) · röstviktad profilklippning (tak 6000→9000, Customer Voice klipps efter Sekundär ICP) — (T-5) CTA-golv som hård regel i alla full-anatomier · `saneraText` på ALLA textbärande fält (nyhetsbrev, social-slides/hashtags, blogg-FAQ/alt, compass-veckans payload) · förbjudna klientord som eget hårt block sist + röst-exempel med förbjudna ord filtreras ur prompten · metaTitle/metaDescription klipps på ordgräns · profilKlippt loggas.

### Tankstreck i löptext (mål: 0 %) — före → efter-v1 → efter-T5

| Flöde | Före | Efter v1 | Efter T-5 |
|---|---|---|---|
| studio-text | 20 % | 50 % | **0 %** |
| caption | 0 % | 0 % | **0 %** |
| karusell | 25 % | 0 % | **0 %** |
| linkedin | 40 % | 0 % | **0 %** |
| social | 50 % | 0 % | **0 %** |
| nyhetsbrev | 40 % | 10 % | **0 %** |
| blogg | 60 % | 95 % | **0 %** |
| veckoplan | 0 % | 0 % | **0 %** |
| enskilt | 0 % | 0 % | **0 %** |

Målet nått: 0 % i samtliga nio flöden. v1-regressionerna (studio-text 50 %, blogg 95 %) berodde på osanerade fält respektive osanerad HTML-kropp — båda vägarna är nu täckta i koden, inte bara i prompten.

### Exakt en CTA (andel texter) — före → efter-v1 → efter-T5

| Flöde | Före | Efter v1 | Efter T-5 |
|---|---|---|---|
| studio-text | 0 % | 0 % | **0 %** (avsiktligt: pa-bild-texter ska INTE ha CTA) |
| caption | 40 % | 10 % | **20 %** |
| karusell | 40 % | 20 % | **30 %** |
| linkedin | 15 % | 0 % | **0 %** |
| social | 15 % | 35 % | **20 %** |
| nyhetsbrev | 10 % | 20 % | **20 %** |
| blogg | 30 % | 35 % | **60 %** |
| veckoplan | 5 % | 15 % | **0 %** |
| enskilt | 30 % | 35 % | **35 %** |

Läsvarning: `raknaCta` är en ordlista-heuristik (svara/boka/klicka/…). LinkedIn-flödet styrs mot mjuka CTA:er ("vad tror du?") som inte innehåller något av listorden — CTA-snittet 0,0 betyder "inga hårda CTA-ord", inte "ingen uppmaning". Blogg (mest hård-CTA-drivet flöde) gick 35 → 60 % efter CTA-golvet.

### Röst-träff — före → efter-v1 → efter-T5

| Flöde | Före | Efter v1 | Efter T-5 |
|---|---|---|---|
| linkedin | 34 % | 12 % | **11 %** |
| veckoplan | 40 % | 29 % | **38 %** |
| blogg | 43 % | 27 % | **26 %** |
| social | 30 % | 17 % | **11 %** |

Profilklippningen (9000 + röstviktad ordning) räckte alltså INTE för att återhämta linkedin-röst-träffen. Trolig kvarvarande orsak: v1-tappet kom inte främst från klippet — bara Displayteknik (9396 tecken) klipptes över huvud taget, och nu klipps enbart Kundresa. Två kandidater för nästa runda: (a) röst-fingerprintblocket ligger tidigare i den längre T-5-prompten och drunknar (signaturfraser kan behöva upprepas nära slutet), (b) T-5-filtret som tar bort röst-exempel innehållande klientens förbjudna ord minskar exempelunderlaget för vissa klienter. Veckoplan (som gick via samma profil men annan prompt) gick upp 29 → 38 %.

### Profilklippt-utfall (maxProfilTecken 9000, röstviktad KLIPPORDNING)

| Profil | Profilstorlek | Klipps nu | Klipps med gamla 6000-taket |
|---|---|---|---|
| Displayteknik | 9 396 tecken | Kundresa | Kundresa, Konkurrenter, Sekundär ICP, Voice of Customer, Hashtag-bas, Brand story |
| Engens Träd & Trädgård | 3 578 | inget | inget |
| HM Motor Krokom | 1 464 | inget | inget |
| Annas Blommor | 1 061 | inget | inget |

Story-bank och Customer Voice överlever för ALLA fyra profiler (Håkans intention). Klipputfall loggas nu av prompt-core (`[prompt-core] profil klippt …`) i både batch och produktion.

### Beslut punkt 3 — förbjudna klientord (Håkan 2026-07-31)

INGEN mekanisk ersättning av godtyckliga klientord i efterhand — grammatikrisken accepteras inte. Huvudspärren är prompten: förbuden ligger som eget HÅRT block sist bland innehållsreglerna (flyttat ur röstblocket) och röst-exempel som innehåller förbjudna ord filtreras ur urvalet. Skyddsnätet är detektering + logg i `saneraText` (`[saneraText] klientens förbjudna ord kvar …`) — verifierat i skarp drift under batchen (fångade bl.a. "billigaste" för Engens). Plattformens fasta floskellista (kraftfull/banbrytande/…) ersätts fortsatt mekaniskt som förut — den har kurerade ersättningar.

Läsanvisning: CTA-ord räknas med grov heuristik (`raknaCta`) — riktningen är det viktiga, inte absolutvärdet. "Röst-träff" = andel av klientens signaturfraser/smärtord/glädjeord som förekommer. Floskler = plattformens förbjudna AI-ord. Tankstreck = som skiljetecken i löptext.

## Autochecks per flöde — alla profiler ihop

| Flöde | Texter (före→efter) | CTA-snitt | Svag hook | Förbjudna ord/text | Floskler/text | Tankstreck | Hashtags-snitt | Röst-träff |
|---|---|---|---|---|---|---|---|---|
| studio-text | 20 → 20 | 0,0 → **0,0** | 0 % → **5 %** | 0,1 → **0,0** | 0,0 → **0,0** | 20 % → **0 %** | 0,0 → **0,0** | 4 % → **2 %** |
| caption | 20 → 20 | 0,5 → **0,2** | 5 % → **20 %** | 0,1 → **0,3** | 0,0 → **0,0** | 0 % → **0 %** | 4,3 → **4,7** | 25 % → **21 %** |
| karusell | 20 → 20 | 0,7 → **0,3** | 0 % → **0 %** | 0,1 → **0,1** | 0,0 → **0,0** | 25 % → **0 %** | 0,0 → **0,0** | 21 % → **15 %** |
| linkedin | 20 → 20 | 0,3 → **0,0** | 5 % → **0 %** | 0,1 → **0,3** | 0,1 → **0,0** | 40 % → **0 %** | 3,5 → **3,0** | 34 % → **11 %** |
| social | 20 → 20 | 0,6 → **0,7** | 5 % → **0 %** | 0,1 → **0,3** | 0,0 → **0,0** | 50 % → **0 %** | 10,0 → **5,0** | 30 % → **11 %** |
| nyhetsbrev | 20 → 20 | 0,1 → **0,2** | 0 % → **0 %** | 0,5 → **0,4** | 0,1 → **0,0** | 40 % → **0 %** | 0,0 → **0,0** | 18 % → **14 %** |
| blogg | 20 → 20 | 1,7 → **1,1** | 0 % → **0 %** | 1,4 → **1,1** | 0,7 → **0,6** | 60 % → **0 %** | 0,1 → **0,0** | 43 % → **26 %** |
| veckoplan | 20 → 20 | 3,6 → **3,5** | 0 % → **0 %** | 0,5 → **0,8** | 0,0 → **0,0** | 0 % → **0 %** | 24,9 → **24,1** | 40 % → **38 %** |
| enskilt | 20 → 20 | 0,6 → **0,3** | 0 % → **0 %** | 0,1 → **0,2** | 0,0 → **0,0** | 0 % → **0 %** | 5,0 → **5,0** | 25 % → **14 %** |

## Exakt en CTA (skrivregel 4) — andel texter

| Flöde | Före | Efter |
|---|---|---|
| studio-text | 0 % | **0 %** |
| caption | 40 % | **20 %** |
| karusell | 40 % | **30 %** |
| linkedin | 15 % | **0 %** |
| social | 15 % | **20 %** |
| nyhetsbrev | 10 % | **20 %** |
| blogg | 30 % | **60 %** |
| veckoplan | 5 % | **0 %** |
| enskilt | 30 % | **35 %** |

## Sida vid sida — första ämnet ("misstag") per flöde, Displayteknik

### studio-text

**Före:**
```
{"hookType":"fråga","headline1":"Vem sköter skärmen när den strular?","headline2":"Det vanligaste misstaget: köpa billigt utan support","body":"Skärmen monteras, men ingen tar ansvar för drift. Du får en kontakt för allt hos oss."}
```
**Efter:**
```
{"hookType":"fråga","headline1":"Skyltfönstret","headline2":"Funderar du på en skärm som syns i solljus?","body":"Det vanligaste misstaget är att köpa fel ljusstyrka. En vanlig inomhusskärm går inte att läsa i skyltfönster, du behöver 2 500 nits eller mer."}
```

### caption

**Före:**
```
Många tror att starkt solljus betyder att skylten inte syns.

Ett vanligt misstag är att man väljer en skärm med för låg ljusstyrka, eller att man ger upp tanken helt för att det *är* så soligt. Med rätt nits (ljusstyrka) får du en skärm som syns även i direkt solljus, år efter år. Det är en investering som betalar sig när budskapet går fram oavsett väder.

Har du en plats som är svår att exponera? Skicka en bild så får du en offert inom 24 timmar.

#LEDskärm #DigitalSkyltning #Skyltfönster #Displayteknik
```
**Efter:**
```
Många företag vill satsa på digital skyltning, men väljer fel skärm. Kanske köper man en billig TV från hemelektronikaffären som inte är gjord för 24/7-drift, eller för att synas i direkt solljus. Resultatet blir ofta en skärm som ser trött ut, eller till och med går sönder efter kort tid.

Du får en skärm som syns och fungerar år efter år. Vi ser till att du får rätt skärm för din miljö, oavsett om det är en ljusstark skyltfönsterskärm eller en vädertålig utomhusskärm. Vi tar ansvar för val, installation, innehåll och support.

Skicka en bild  …
```

### karusell

**Före:**
```
[{"kind":"hook","headline":"Syns din skylt inte i solljuset?","body":"Många företag har skärmar som ingen ser. Du är inte ensam.","imageUrl":""},{"kind":"point","headline":"Fel skärm för rätt plats","body":"Det vanligaste misstaget är att välja en standard-TV istället för en skärm byggd för utomhusbruk eller skyltfönster. De klarar inte ljus, kyla eller kondens.","imageUrl":""},{"kind":"point","headline":"Glömmer nordiskt klimat","body":"En skärm måste tåla våra väderförhållanden. En vanlig inomhusskärm blir snabbt trött och går sönder när den  …
```
**Efter:**
```
[{"kind":"hook","headline":"Vanliga misstag med digital skärm","body":"Många företag väljer fel skärm för skyltfönstret. Så undviker du det misstaget.","imageUrl":""},{"kind":"point","headline":"Fel skärm för solljus","body":"En vanlig TV syns inte i dagsljus eller direkt solljus. En professionell skyltfönsterskärm behöver minst 2 500 nits för att budskapet ska synas tydligt.","imageUrl":""},{"kind":"point","headline":"Inte byggd för att hålla","body":"Konsumentskärmar är inte gjorda för 24/7-drift i nordiskt klimat. De tål varken kyla, kondens …
```

### linkedin

**Före:**
```
{"hook":"Den där 65-tummaren från hemelektronik-kedjan? Den kommer kosta dig mer än du tror.","body":"Den där 65-tummaren från hemelektronik-kedjan?\n\nDen kommer kosta dig mer än du tror.\n\nDet vanligaste misstaget jag ser är när företag köper en vanlig konsument-TV för ett skyltfönster eller en butik. Man vill komma igång snabbt, få upp något som rör sig. Priset ser ju bra ut på kvittot.\n\nMan tänker: ”En skärm är en skärm”.\n\nMen den tanken blir dyr. För en vanlig TV är byggd för ett vardagsrum, inte en kommersiell miljö.\n\nResultatet är …
```
**Efter:**
```
{"hook":"Det vanligaste misstaget när man köper skärm till skyltfönstret? Att köpa en TV.","body":"Det vanligaste misstaget när man köper skärm till skyltfönstret? Att köpa en TV.\n\nDu har sett det. En svart rektangel i grannbutikens fönster. Den skulle visa en snygg kampanj, men solen ligger på och allt som syns är en spegelbild.\n\nPå pappret såg det smart ut. En vanlig TV från hemelektronikkedjan var ju mycket billigare. Men efter några veckor inser man att den inte är byggd för jobbet.\n\nInsikten är att en skärm för ett skyltfönster inte  …
```

### social

**Före:**
```
{"hook":"Det vanligaste misstaget när man köper digital skärm? Att köpa en TV.","caption":"En vanlig TV i skyltfönstret ser bra ut på pappret. Men i verkligheten syns den inte i solljus och är inte byggd för att vara igång hela dagarna.\n\nResultatet blir en svart ruta som kostar mer än den smakar – i förlorade kunder och intryck.\n\nRätt skärm för rätt plats är skillnaden mellan en investering som säljer och en kostnad som inte gör det. Vi hjälper dig välja en skärm som fungerar för butik, fastighet och event – år efter år.\n\nDu får en kontak …
```
**Efter:**
```
{"hook":"Det vanligaste (och dyraste) misstaget? Att köpa en vanlig TV till skyltfönstret.","caption":"Det vanligaste (och dyraste) misstaget? Att köpa en vanlig TV till skyltfönstret.\n\nDen ser bra ut på papperet. Priset är lågt. Men efter några månader i ett ljust fönster är bilden urblekt. Och efter ett år är skärmen ofta helt svart. Garantin? Gäller sällan för drift dygnet runt.\n\nEn professionell skärm för ett skyltfönster är byggd för två saker en vanlig TV saknar:\n\n1. Ljusstyrka som syns, även i direkt solljus.\n2. Drift dygnet runt, …
```

### nyhetsbrev

**Före:**
```
{"subjects":["Det vanligaste (och dyraste) misstaget","Känner du igen dig i det här?","Vänta inte tills skärmen är ett problem","En fråga som kan spara dig tusenlappar"],"preheader":"Många av våra kunder berättar samma sak. Ett tidigt samtal hade sparat både tid och pengar.","greeting":"Hej,","intro":"Jag hör samma berättelse ganska ofta. En kund ringer och har redan försökt lösa sin digitala skyltning själva – googlat, köpt en skärm på nätet, frågat en bekant. När vi väl pratas vid har det ofta kostat mer än det smakat, både i tid och pengar." …
```
**Efter:**
```
{"subjects":["Ett vanligt misstag med digitala skärmar","Hur du sparar tid på din nästa skärm","Innan du köper en ny skärm till butiken","En reflektion om att göra rätt från början"],"preheader":"Att försöka lösa allt själv kostar ofta mer än att fråga. Få ett ärligt råd från start.","greeting":"Hej!","intro":"Jag pratar med många företagare som funderar på digital skyltning. Nästan alla berättar samma sak: de väntade för länge med att ställa den första frågan, och försökte lösa allt själva innan de hörde av sig.","sections":[{"heading":"Risken …
```

### blogg

**Före:**
```
{"title":"Det vanligaste misstaget med digital skyltning (och hur du undviker det)","metaTitle":"Vanligaste misstaget med digital skyltning | Displayteknik","metaDescription":"Funderar du på en skärm till butiken? Undvik det dyraste misstaget: att köpa en vanlig TV. Vi förklarar varför en proffsskärm är den enda lösningen som fungerar","urlSlug":"vanligaste-misstaget-digital-skyltning","html":"<p class=\"lead\">Funderar du på att köpa en vanlig TV till skyltfönstret för att spara pengar? Det är en förståelig tanke, men också det absolut vanliga …
```
**Efter:**
```
{"title":"Det vanligaste misstaget med digitala skärmar (och hur du undviker det)","metaTitle":"Vanligaste misstaget med digitala skärmar | Displayteknik","metaDescription":"Innan du köper en digital skärm för ditt företag, undvik detta kostsamma misstag. Vi förklarar varför en vanlig TV inte fungerar i ett skyltfönster.","urlSlug":"vanligaste-misstaget-med-digitala-skarmar","html":"<p class=\"lead\">Många tror att en vanlig TV från en elektronikjätte är ett smart sätt att spara pengar på digital skyltning. Det är det absolut vanligaste och mes …
```

### veckoplan

**Före:**
```
{"theme":"Det vanligaste misstaget nya kunder gör innan de hör av sig till oss","voice_source_count":3,"days":[{"day":"Måndag","fourA":"analytical","disc":"C","funnel":"TOFU","format":"big_stat","hook":"85 % av alla skärmar i skyltfönster är för svaga.","body":"Statistiken är tydlig. De flesta köper en skärm baserat på pris eller storlek, inte ljusstyrka anpassad för miljön.\n\nResultatet blir en svart spegel i solljus. En investering som inte syns, och därmed inte säljer.\n\nEn standardskärm har cirka 300-500 nits ljusstyrka. En skärm för ett  …
```
**Efter:**
```
{"theme":"Det vanligaste misstaget nya kunder gör innan de hör av sig till oss","voice_source_count":3,"days":[{"day":"Måndag","fourA":"analytical","disc":"C","funnel":"TOFU","format":"big_stat","hook":"8 av 10 skyltfönster gör samma misstag.","body":"De köper en vanlig TV. Den är byggd för ett mörkt vardagsrum, inte för att synas i fullt dagsljus.\n\nResultatet: skärmen är för mörk för att fånga kunder och går sönder i förtid. Den är inte gjord för att vara på hela dagarna.\n\nEn professionell skärm för ett skyltfönster har 4-5 gånger högre lj …
```

### enskilt

**Före:**
```
{"variants":[{"tier":"gold","hook":"Misstaget som gör din skärm osynlig i dagsljus.","body":"Du köper en vanlig TV till skyltfönstret. Inomhus ser den bra ut. Men när solen ligger på försvinner ditt budskap helt.\n\nEn vanlig TV har en ljusstyrka på 300-500 nits. En professionell skyltfönsterskärm ligger på 2 500–3 500 nits. Det är den tekniska skillnaden mellan att synas och att inte synas.\n\nVi väljer rätt skärm för din miljö. En skärm byggd för att sälja i alla ljusförhållanden, från lågt vintersolljus till klar sommardag. Du får en lösning …
```
**Efter:**
```
{"variants":[{"tier":"gold","hook":"Misstaget som kostar butiksägare tusenlappar i onödan.","body":"Du behöver en skärm till skyltfönstret. Du åker till närmaste elektronikvaruhus och köper en vanlig TV. Problemet löst, eller?\n\nNej. Det här är det vanligaste och dyraste misstaget vi ser.\n\nEn vanlig TV är byggd för ett vardagsrum. Inte för ett skyltfönster med direkt solljus, dygnet-runt-drift och kalla nordiska vintrar. Den kommer se mörk ut, överhettas och gå sönder i förtid.\n\nResultatet? Du får köpa en ny skärm igen. Och igen.\n\nEn rik …
```

## Blindbedömning (Håkan — bilaga B i REVISION-protokollet)

Per profil, 10 slumpade EFTER-texter: Nivå 1 publicerar direkt / Nivå 2 en minuts puts / Nivå 3 omskrivning. Ribba: minst 7/10 på nivå 1–2.

| Profil | N1 | N2 | N3 | Godkänd? | Kommentar |
|---|---|---|---|---|---|
| Displayteknik | | | | | |
| Engens Träd & Trädgård | | | | | |
| HM Motor Krokom | | | | | |
| Annas Blommor | | | | | |

Under ribban → justera PROFILLAGRET (brand-profil/fingerprint/winning examples för den klienten), inte arkitekturen.
