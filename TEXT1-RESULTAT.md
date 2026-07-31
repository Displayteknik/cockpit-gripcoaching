# TEXT1-RESULTAT — före/efter promptmigreringen (T-4)

Genererad 2026-07-31 15:16. Samma 5 låsta ämnen (docs/text1/amnen.json), samma 4 klientprofiler, samma mätsticka (autochecks) på båda sidor. FÖRE = koden före TEXT-1 (studio-text fångad från worktree på T-2-commit — vägen orörd t.o.m. dess). EFTER = prompt-core-vägen.

Läsanvisning: CTA-ord räknas med grov heuristik (`raknaCta`) — riktningen är det viktiga, inte absolutvärdet. "Röst-träff" = andel av klientens signaturfraser/smärtord/glädjeord som förekommer. Floskler = plattformens förbjudna AI-ord. Tankstreck = som skiljetecken i löptext.

## Autochecks per flöde — alla profiler ihop

| Flöde | Texter (före→efter) | CTA-snitt | Svag hook | Förbjudna ord/text | Floskler/text | Tankstreck | Hashtags-snitt | Röst-träff |
|---|---|---|---|---|---|---|---|---|
| studio-text | 20 → 20 | 0,0 → **0,0** | 0 % → **0 %** | 0,1 → **0,1** | 0,0 → **0,0** | 20 % → **50 %** | 0,0 → **0,0** | 4 % → **3 %** |
| caption | 20 → 20 | 0,5 → **0,1** | 5 % → **10 %** | 0,1 → **0,2** | 0,0 → **0,0** | 0 % → **0 %** | 4,3 → **4,6** | 25 % → **22 %** |
| karusell | 20 → 20 | 0,7 → **0,5** | 0 % → **0 %** | 0,1 → **0,1** | 0,0 → **0,0** | 25 % → **0 %** | 0,0 → **0,0** | 21 % → **22 %** |
| linkedin | 20 → 20 | 0,3 → **0,4** | 5 % → **15 %** | 0,1 → **0,6** | 0,1 → **0,0** | 40 % → **0 %** | 3,5 → **3,1** | 34 % → **12 %** |
| social | 20 → 20 | 0,6 → **0,5** | 5 % → **0 %** | 0,1 → **0,3** | 0,0 → **0,0** | 50 % → **0 %** | 10,0 → **6,0** | 30 % → **17 %** |
| nyhetsbrev | 20 → 20 | 0,1 → **0,3** | 0 % → **0 %** | 0,5 → **0,7** | 0,1 → **0,2** | 40 % → **10 %** | 0,0 → **0,0** | 18 % → **16 %** |
| blogg | 20 → 20 | 1,7 → **1,2** | 0 % → **0 %** | 1,4 → **1,1** | 0,7 → **0,3** | 60 % → **95 %** | 0,1 → **0,0** | 43 % → **27 %** |
| veckoplan | 20 → 20 | 3,6 → **4,1** | 0 % → **0 %** | 0,5 → **0,7** | 0,0 → **0,0** | 0 % → **0 %** | 24,9 → **25,0** | 40 % → **29 %** |
| enskilt | 20 → 20 | 0,6 → **0,3** | 0 % → **0 %** | 0,1 → **0,1** | 0,0 → **0,0** | 0 % → **0 %** | 5,0 → **4,8** | 25 % → **17 %** |

## Exakt en CTA (skrivregel 4) — andel texter

| Flöde | Före | Efter |
|---|---|---|
| studio-text | 0 % | **0 %** |
| caption | 40 % | **10 %** |
| karusell | 40 % | **20 %** |
| linkedin | 15 % | **0 %** |
| social | 15 % | **35 %** |
| nyhetsbrev | 10 % | **20 %** |
| blogg | 30 % | **35 %** |
| veckoplan | 5 % | **15 %** |
| enskilt | 30 % | **35 %** |

## Sida vid sida — första ämnet ("misstag") per flöde, Displayteknik

### studio-text

**Före:**
```
{"hookType":"fråga","headline1":"Vem sköter skärmen när den strular?","headline2":"Det vanligaste misstaget: köpa billigt utan support","body":"Skärmen monteras, men ingen tar ansvar för drift. Du får en kontakt för allt hos oss."}
```
**Efter:**
```
{"hookType":"fråga","headline1":"Behöver vi verkligen en så ljusstark skärm?","headline2":"Den frågan får vi varje vecka","body":"Sedan ser kunden skärmen i skyltfönstret mitt på dagen. Då förstår de varför 2500 nits gör skillnad."}
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
Är din digitala skyltning trött, eller syns den inte i solljuset? Många företag har redan investerat i snygg branding, men glömmer att den också måste synas där kunderna faktiskt är. Det vanligaste misstaget vi ser är att man väljer en skärm som ser bra ut på pappret, men inte klarar av nordiskt klimat eller ljusförhållanden.

Hos oss får du en kontakt för allt, från första idé till driftsatt lösning som fungerar år efter år. Vi hjälper dig att välja rätt skärm för butiken, bilhallen, restaurangen eller fastigheten, så att den syns, säljer och  …
```

### karusell

**Före:**
```
[{"kind":"hook","headline":"Syns din skylt inte i solljuset?","body":"Många företag har skärmar som ingen ser. Du är inte ensam.","imageUrl":""},{"kind":"point","headline":"Fel skärm för rätt plats","body":"Det vanligaste misstaget är att välja en standard-TV istället för en skärm byggd för utomhusbruk eller skyltfönster. De klarar inte ljus, kyla eller kondens.","imageUrl":""},{"kind":"point","headline":"Glömmer nordiskt klimat","body":"En skärm måste tåla våra väderförhållanden. En vanlig inomhusskärm blir snabbt trött och går sönder när den  …
```
**Efter:**
```
[{"kind":"hook","headline":"Vanligaste misstaget med skärmar?","body":"Många väljer fel skärm. Det blir dyrt och syns inte i längden.","imageUrl":""},{"kind":"point","headline":"Fel ljusstyrka för miljön","body":"En vanlig skärm syns inte i solljus. En utomhusskärm behöver hög ljusstyrka, till exempel 3 000 nits, för att synas tydligt.","imageUrl":""},{"kind":"point","headline":"Inte anpassad för väder","body":"En inomhusskärm dör snabbt utomhus. Våra vädertåliga skärmar klarar nordiskt klimat år efter år, från kyla till fukt.","imageUrl":""},{ …
```

### linkedin

**Före:**
```
{"hook":"Den där 65-tummaren från hemelektronik-kedjan? Den kommer kosta dig mer än du tror.","body":"Den där 65-tummaren från hemelektronik-kedjan?\n\nDen kommer kosta dig mer än du tror.\n\nDet vanligaste misstaget jag ser är när företag köper en vanlig konsument-TV för ett skyltfönster eller en butik. Man vill komma igång snabbt, få upp något som rör sig. Priset ser ju bra ut på kvittot.\n\nMan tänker: ”En skärm är en skärm”.\n\nMen den tanken blir dyr. För en vanlig TV är byggd för ett vardagsrum, inte en kommersiell miljö.\n\nResultatet är …
```
**Efter:**
```
{"hook":"Det vanligaste misstaget när man köper skärm? Man fokuserar på fel sak.","body":"Det vanligaste misstaget när man köper skärm? Man fokuserar på fel sak.\n\nFöretag lägger veckor på att jämföra skärmstorlek och upplösning.\n\nMen den tekniska detaljen som faktiskt avgör om investeringen lönar sig hamnar nästan alltid i skymundan.\n\nLjussyrkan, mätt i nits.\n\nEn skärm i ett skyltfönster som inte syns i solljus säljer ingenting. Den blir bara en svart, dyr rektangel. En utomhusskylt som inte är byggd för nordiskt klimat blir snabbt en k …
```

### social

**Före:**
```
{"hook":"Det vanligaste misstaget när man köper digital skärm? Att köpa en TV.","caption":"En vanlig TV i skyltfönstret ser bra ut på pappret. Men i verkligheten syns den inte i solljus och är inte byggd för att vara igång hela dagarna.\n\nResultatet blir en svart ruta som kostar mer än den smakar – i förlorade kunder och intryck.\n\nRätt skärm för rätt plats är skillnaden mellan en investering som säljer och en kostnad som inte gör det. Vi hjälper dig välja en skärm som fungerar för butik, fastighet och event – år efter år.\n\nDu får en kontak …
```
**Efter:**
```
{"hook":"Det vanligaste misstaget kostar tusenlappar och syns inte ens.","caption":"Det vanligaste misstaget kostar tusenlappar och syns inte ens.\n\nFöretag köper en skärm. Ofta en vanlig TV. Den monteras i ett ljust rum eller i ett skyltfönster.\n\nResultatet blir en mörk ruta som reflekterar allt. Budskapet försvinner i solljuset. Skärmen är inte byggd för att vara igång hela dagarna, och garantin gäller sällan för företag.\n\nAtt välja rätt skärm för rätt miljö är avgörande. En skärm för ett skyltfönster behöver en helt annan ljusstyrka än  …
```

### nyhetsbrev

**Före:**
```
{"subjects":["Det vanligaste (och dyraste) misstaget","Känner du igen dig i det här?","Vänta inte tills skärmen är ett problem","En fråga som kan spara dig tusenlappar"],"preheader":"Många av våra kunder berättar samma sak. Ett tidigt samtal hade sparat både tid och pengar.","greeting":"Hej,","intro":"Jag hör samma berättelse ganska ofta. En kund ringer och har redan försökt lösa sin digitala skyltning själva – googlat, köpt en skärm på nätet, frågat en bekant. När vi väl pratas vid har det ofta kostat mer än det smakat, både i tid och pengar." …
```
**Efter:**
```
{"subjects":["Det vanligaste misstaget med digitala skärmar","Ett tidigt samtal kan spara dig tusenlappar","När är rätt läge att be om hjälp med skärmar?","En sak jag ser att många företag gör fel"],"preheader":"Att försöka lösa allt själv kan bli dyrare än du tror. Här är varför vi rekommenderar ett annat sätt.","greeting":"Hej!","intro":"Känner du igen dig i att googla fram en lösning, köpa något halvbra på nätet eller fråga en bekant? Det är en vanlig start när man inser att man behöver synas bättre. Men när det gäller digitala skärmar kan d …
```

### blogg

**Före:**
```
{"title":"Det vanligaste misstaget med digital skyltning (och hur du undviker det)","metaTitle":"Vanligaste misstaget med digital skyltning | Displayteknik","metaDescription":"Funderar du på en skärm till butiken? Undvik det dyraste misstaget: att köpa en vanlig TV. Vi förklarar varför en proffsskärm är den enda lösningen som fungerar","urlSlug":"vanligaste-misstaget-digital-skyltning","html":"<p class=\"lead\">Funderar du på att köpa en vanlig TV till skyltfönstret för att spara pengar? Det är en förståelig tanke, men också det absolut vanliga …
```
**Efter:**
```
{"title":"Det största misstaget när du köper digitala skärmar (och hur du undviker det)","metaTitle":"Misstaget som kostar mest vid köp av digitala skärmar | Disp","metaDescription":"Innan du väljer en digital skärm för din butik eller fasad, undvik detta vanliga och kostsamma misstag. Vi förklarar vad som verkligen räknas.","urlSlug":"vanligaste-misstaget-kopa-digitala-skarmar","html":"<p class=\"lead\">Många tror att den största risken med en ny digital skärm är att betala för mycket. Sanningen är att det dyraste misstaget är ett helt annat:  …
```

### veckoplan

**Före:**
```
{"theme":"Det vanligaste misstaget nya kunder gör innan de hör av sig till oss","voice_source_count":3,"days":[{"day":"Måndag","fourA":"analytical","disc":"C","funnel":"TOFU","format":"big_stat","hook":"85 % av alla skärmar i skyltfönster är för svaga.","body":"Statistiken är tydlig. De flesta köper en skärm baserat på pris eller storlek, inte ljusstyrka anpassad för miljön.\n\nResultatet blir en svart spegel i solljus. En investering som inte syns, och därmed inte säljer.\n\nEn standardskärm har cirka 300-500 nits ljusstyrka. En skärm för ett  …
```
**Efter:**
```
{"theme":"Det vanligaste misstaget nya kunder gör innan de hör av sig till oss","voice_source_count":3,"days":[{"day":"Måndag","fourA":"analytical","disc":"C","funnel":"TOFU","format":"big_stat","hook":"8 av 10 skärmar i skyltfönster är för mörka.","body":"Det vanligaste misstaget är att köpa en skärm som inte syns. En standardskärm har en ljusstyrka på cirka 350-500 nits. I ett skyltfönster med direkt solljus krävs minst 2 500 nits för att ditt budskap ska nå fram.\n\nEn för svag skärm blir en svart spegel, inte en säljyta. Resultatet blir en  …
```

### enskilt

**Före:**
```
{"variants":[{"tier":"gold","hook":"Misstaget som gör din skärm osynlig i dagsljus.","body":"Du köper en vanlig TV till skyltfönstret. Inomhus ser den bra ut. Men när solen ligger på försvinner ditt budskap helt.\n\nEn vanlig TV har en ljusstyrka på 300-500 nits. En professionell skyltfönsterskärm ligger på 2 500–3 500 nits. Det är den tekniska skillnaden mellan att synas och att inte synas.\n\nVi väljer rätt skärm för din miljö. En skärm byggd för att sälja i alla ljusförhållanden, från lågt vintersolljus till klar sommardag. Du får en lösning …
```
**Efter:**
```
{"variants":[{"tier":"silver","hook":"Din nya skärm är installerad. Vem ringer du om ett halvår?","body":"Många fokuserar bara på själva skärmen. De jämför priser, storlekar och upplösning.\n\nMen den verkliga utmaningen börjar efter installationen. Innehållet blir inaktuellt. En kabel glappar. Något behöver startas om. Plötsligt blir du din egen AV-tekniker.\n\nDet största misstaget är att se skärmen som en produkt, inte en helhet. En driftsäker lösning kräver mer än hårdvara.\n\nChecklista för en trygg investering:\n- Installation: Ingår prof …
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
