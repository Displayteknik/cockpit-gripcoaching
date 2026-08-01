# HANDOFF — Cockpit, läget 2026-08-01

En fil att klistra in eller ladda upp när arbetet ska delas med en fristående session. Uppdateras vid varje avslutad etapp. Repot är privat (`Displayteknik/cockpit-gripcoaching`), så mottagaren kan inte läsa filerna själv — det som står här ska räcka.

**Projekt:** Cockpit / MySales Pro — `C:\Users\hakan\OneDrive\Dokument\Antigravity\hmmotor-next`, Next.js 16 + Supabase + Gemini (text/bild) + Anthropic (iterationsloopen). Multi-tenant: byråvy `/dashboard`, kundportal `/k`. Live: cockpit.gripcoaching.se (Vercel, deploy sker vid `git push` till master).

**Senaste commit:** `d1abe8d`. Allt nedan är pushat och i produktion om inget annat sägs. 137 enhetstester gröna, `tsc --noEmit` och `next build` rena.

---

## 1. Vad som byggdes i dag

### TEXT-1 — en enda promptbyggare (klar t.o.m. T-6)

**Problemet:** textkvaliteten berodde på vilket flöde texten råkade skapas i. LinkedIn saknade röstprofil, specialisterna saknade varumärkesprofil, anatomilagret (hook/story/nytta/en CTA) försvann så fort Content Compass-parametrar saknades, och `generateJSON()` stängde av skrivreglerna helt.

**Lösningen:** `lib/prompt-core.ts` — `byggTextPrompt(params)` är nu enda stället där textprompter sätts ihop. Nio lager i fast ordning (senare = tyngre, formatkrav sist):

1. Uppdrag (flödets rollrad + hårda regler) · 2. Statisk kunskap (`knowledge/*.md`) · 3. Brand-profil · 4. Röst-fingerprint · 5. Vinnande exempel (+ ev. bildkontext) · 6. Anatomi + Compass · 7. Grafisk kontext (kit-donts, bildnära syften) · 8. Globala skrivregler · 8b. Klientens förbjudna ord · 9. JSON-formatkrav.

Nyckelbeslut:
- **Anatomin frikopplad från Compass.** Två varianter: `full` och `pa-bild` (studio-text får ingen CTA — captionen bär den, annars två uppmaningar i samma inlägg).
- **Compass-default = endast funnel per syfte** (linkedin/nyhetsbrev/blogg = mofu, socialfamiljen = tofu, **aldrig bofu**). 4A/DISC lämnas osatta, annars likriktas alla texter.
- **`generateJSON` slutade defaulta `skrivregler: false`.** 13 rena klassnings-/analysanrop stämplades explicit `false` i stället.
- **Dubblettstädning:** `getProfileAsMarkdown(id, {medVoice:false})` — prompt-core äger röst- och winning-lagren. Tidigare låg rösten upp till tre gånger i samma prompt på Anthropic-vägen.
- **`iterateGenerate({prebuilt})`** — Anthropic-vägen hämtar inget själv när prompten är byggd.
- **`writing_rules_enabled`** styr numera både prompt och sanering. Floskelgolvet (förbjudna AI-ord) körs alltid, oavsett flagga.

Etapper: T-1 kärna (`c24ee54`) → T-2 13 Gemini-flöden (`186c12b`) → T-3 Anthropic-vägen + facit-flödena med paritetstester (`a8d6874`) → T-4 mätning (`6c7a284`) → T-5 fixar + ommätning (`6e51d9d`) → T-6 tre plattformsregler (`5f1caa9`) → A2-skärpning (`fe357cb`).

### T-6: tre plattformsregler efter skarptest

- **CTA-golv med imperativ.** Exakt en CTA, formulerad som uppmaning med väg (verb + hur/var). Funnel styr tonen, aldrig existensen. Profilens färdiga CTA-formuleringar föredras. Exempel ur mätningen: *"Skicka en bild på platsen du vill skylta, få en offert inom 24 timmar."*
- **Sanningskrav.** Jag-berättelser, kundcase, citat och sifferpåståenden får bara bygga på verkligt profilmaterial (story-bank, kundröster). Saknas material skrivs det som generell observation. Skärpningen efteråt: **ämnesformuleringen är inget mandat att fabricera** — ett ämne som "En kund tvekade länge" får inte framkalla ett påhittat minne.
- **Variation i två nivåer.** Varianter i samma anrop ska ha olika retorisk ingång (mytkrossning, kundscenario, siffra, målgruppsvinkel, hantverksstolthet, före/efter) — aldrig delad tankefigur eller öppningsfras. Rotationsregeln sprider texterna över olika delar av profilen, och de fem senaste hookarna skickas med som "nyligen använt" där historik finns.

### BILD-5 till BILD-7

- **BILD-5a — loggans synlighet** (`1786363`): minsta storlek per format (kvadrat 64 px, stående 72, story 88), automatiskt val av ljus/mörk loggvariant efter bakgrundens ljushet, platta eller skugga när kontrasten ändå är låg.
- **BILD-5b — datum och säsong** (`ad620ff`): `lib/content/sasong.ts` ger datum, årstid och svenska säsongsmarkörer (rörliga helger beräknas) till både text- och bildprompter. Regel: aldrig fel säsong om användaren inte ber om det. Säsongskonsistensen gäller hela scenen — kläder, ljus, växtlighet, väder — och bildredigeringen kräver att alla säsongssignaler uppdateras när instruktionen nämner en årstid.
- **BILD-6a** (`700c351`): tankstreck förbjudet även i **avbildad** text (skärmar, skyltar, affischer, förpackningar).
- **BILD-6b** (`08852a8`): loggvalet mäter nu spann (p05/p95), inte bara medelvärde. Blandad bakgrund (mörkt träd + ljus fasad) väljer alltid mörk logga i stället för tunn vit. Plattbeslutet prövas mot det värsta partiet.
- **BILD-7** (`97947a0`): avbildat exempelinnehåll ska ha **både** relevant motiv **och** ett kort trovärdigt budskap (erbjudande, pris, event, tid) — "DAGENS LUNCH 129 KR", inte en tom etikett. Säsongsmotiven varierar (kräftmotiv i 3 av 5 bilder före, 0 efter). Grafiska profilens färgton bär igenom i bildprompten.

### BILD-8 (`77b8564`) — stavningsgrind och blickriktning

- **Stavningsgrind för avbildad text.** Modellen transkriberar tecken för tecken med ordgränser, sedan döms stavningen **programmatiskt** mot svensk skyltordlista med böjningsstrippning och sammansättningsuppdelning. Skälet: vision-modellen autokorrigerar och "läser" NYHETER där bilden säger NYHIETES — dess egen bedömning kan aldrig frikänna ett ord ordlistan redan fällt. Max 2 omtag, sista utvägen ber om tom skylt. Fail-open i varje led.
- **Blickriktning.** Person som syns tillsammans med produkt, skärm eller skylt ska vara vänd mot och engagerad i den — aldrig bortvänd från det inlägget handlar om.
- ⚠ **DoD-genereringarna kördes aldrig** (en parallell session byggde samma sak i samma arbetsträd, arbetet stoppades för att undvika kollision). Koden är verifierad grön men bilderna som skulle bevisa grinden skarpt återstår.

### PROFIL-0 och PROFIL-1 (`8086102` … `d1abe8d`) — brand-ID som kvalitetsgrund

Granskningen (`PROFIL-RAPPORT.md`) hittade tre fel som var större än det som beställdes:

1. **Fyra profilfält nådde aldrig en prompt** — `differentiators`, `services`, `pricing_notes`, `booking_url` fanns i formuläret och räknades i procenttalet men saknades i profiltexten. Displaytekniks 1 262 tecken riktiga priser med 17 verifierade siffror hade ingen text sett, samtidigt som sanningskravet förbjuder påhittade siffror.
2. **Vinnande exempel var avstängt i praktiken** — hämtningen filtrerade på en kolumn som var tom på samtliga 15 rader i hela plattformen.
3. **Procenttalet mätte bara teckenlängd** — 593 tecken tomfraser gav 100 % och "Klar att producera", medan Displaytekniks riktiga profil gav 89 %.

**HM Motor-rotorsaken:** en Ikigai-körning committades mot standardtenanten. `intake/commit` skrev över USP, ICP och tjänster utan kontroll, och bilhandlaren blev coach. `customer_voice`-raderna bär fortfarande Ikigai-kvadranten som kontext.

PROFIL-1 byggde, i ordning: fälten inkopplade i profillagret (klipptaket höjt 9000 → 11000 så priserna ryms utan att kundorden klipps), winning examples via fallback i kod (ingen DB-skrivning), onboard-status mot faktiska kolumner, **diff-bekräftelse innan identitetsfält skrivs över** (rotorsaken stängd), och en kvalitetsviktad mätare (`lib/profil/kvalitet.ts`, deterministisk, ingen AI) där **nivån ersätter procenten**. Utfall: DT nivå 4 "Egen röst", Engens 3 "Grund", Annas Blommor 2 "Skiss", HM Motor 1 "Tom" med förankringsflagga. Skräpsimuleringen faller från 100 % till nivå 1. Detaljer i `PROFIL-RESULTAT.md`.

⚠ **Fälla:** förankringsflaggan måste jämföra mot fält som intake aldrig skriver (bransch, namn, plats, GÖR/GÖR INTE) — annars flaggas legitima klienter, som när Displayteknik säger "skyltfönsterskärmar" och etiketten säger "Digital signage".

**Största kvarvarande lucka:** kunden ser nu åtgärden "Lägg till 3 kundberättelser" men har ingen yta att skriva in dem på — story-bank och Customer Voice kan bara fyllas via intake-flödet.

### AKUT-fix: profilsidan sparade inte (`a4a8fa8`)

Grundorsak: sektionsknappen skickade klick-eventet som payload (`onClick={handler}` i stället för `onClick={() => handler()}`). `JSON.stringify` kastade på React-fiberns cirkulära referens → evig "Sparar...", inget sparat, inget fel visat. Fix: rätt anrop, 20 s timeout, try/catch/finally, svenskt felmeddelande inline och persistent "Sparat"-kvitto. Routen loggar och returnerar begripligt fel.

---

## 2. Mätningen (TEXT1-RESULTAT.md)

Metod: 4 klientprofiler (Displayteknik, Engens Träd, HM Motor, Annas Blommor) × 9 flöden × 5 låsta ämnen = 180 texter före och 180 efter, samma ämnen och samma mätsticka. Före-batchen kördes mot koden före migreringen (studio-text från en git-worktree pinnad på T-2).

**Vann:**
- Tankstreck som skiljetecken i löptext: **0 % i samtliga nio flöden** (före: linkedin 40 %, social 50 %, blogg 60 %, nyhetsbrev 40 %).
- Social-hashtags 10 → 6 i snitt (taket är 5, före var det dubbla).
- Floskler ned i alla flöden, blogg 0,7 → 0,3 per text. Blogg-CTA 1,7 → 1,2 och exakt-en-CTA 35 → 60 %.
- LinkedIn har numera röstprofil, anatomi och skrivregler (hade inget av det).

**Kvar att förklara:**
- **Röstträffen sjönk för linkedin** (34 → 12 → 11 %) trots höjt profiltak. Klipphypotesen var alltså inte huvudorsaken. Två kandidater kvarstår: röstblockets position i den längre prompten, och exempel-filtreringen. Väntar på blindbedömningen innan mer skruvas.
- **CTA-heuristiken underskattar.** `raknaCta` saknar bland annat verbet "skicka", så korrekta imperativ-CTA:er räknas inte. Manuell läsning är facit; siffran ensam är missvisande.

---

## 2b. Beställt men ej levererat (STÅENDE SEKTION — töms aldrig, uppdateras)

Processregel efter 1/8: IDÉ-1 och UTKAST-1 beställdes 31/7 och försvann tyst — varken levererade eller listade som pågående. Varje beställning som inte är klar ska stå här tills den är det. En rad som försvinner utan att vara levererad är ett fel i sig.

| Beställning | Beställd | Status | Not |
|---|---|---|---|
| UTKAST-1 (autospar Studio + blogg/nyhetsbrev/veckoplan/reels) | 31/7 | **Pågår** (KVALITET-3 p1) | Byggdes aldrig; verifierat 1/8 att refresh nollar allt |
| IDÉ-1 rester: 3-av-3, interpunktion, sanningskrav i pitch | 31/7 | **Pågår** (KVALITET-3 p2) | Variantvariationen levererades via T-6c; resten saknades |
| Idé som underlag, aldrig publik text | 1/8 | **Pågår** (KVALITET-3 p3) | Idé-beskrivning kopierades ordagrant till bildtext |
| Perspektivregel (talar som tenanten) | 1/8 | **Pågår** (KVALITET-3 p4) | |
| Prisregel (inga egna priser i genererad text) | 1/8 | **Pågår** (KVALITET-3 p5) | Skärpt av att F1 nu ger modellen riktiga priser |
| Loggval: render-bevis + manuell override | 1/8 | **Pågår** (KVALITET-3 p6) | |
| Småfixar: raknaCta-ordlista, "hög ljusstyrka" | 1/8 | **Pågår** (KVALITET-3 p7) | |
| BILD-8 DoD-genereringar | 31/7 | **Ej gjort** | Koden grön, men bilderna som bevisar stavningsgrinden skarpt saknas |
| REVISION-1: REV-1 → REV-4 | 30/7 | **Ej startad** | Rapport godkänd, tre frågor besvarade |
| PROFIL-2: yta för berättelser/kundord | 1/8 | **Ej startad** | Mätaren uppmanar till material som inte går att fylla i |
| Blindbedömningen (Håkan) | 31/7 | **Ej gjord** | Avgör röstträff-frågan för LinkedIn |
| HM Motors profilinnehåll rättas i DB | 1/8 | **Ej gjort** | Koden hindrar nästa olycka, städar inte den gamla |

## 3. Öppet just nu

**Pågår:** BILD-8 — (a) vision-baserad stavningsgrind för avbildad text: transkribera bokstav för bokstav och jämför programmatiskt, eftersom vision-modellen autokorrigerar och "läser" NYHETER där bilden säger NYHIETES; vid fel omgenerering, annars hellre blank skylt än felstavad. (b) blickriktningsregel: person i bild ska vara vänd mot och engagerad i produkten/skärmen/skylten.

**Väntar på Håkan:**
- **Blindbedömningen** (bilaga B): 10 texter per profil, nivå 1 publicerar direkt / nivå 2 en minuts puts / nivå 3 omskrivning. Ribba 7/10 på nivå 1–2. Under ribban justeras profilens material, inte arkitekturen.
- **REVISION-1** (REV-0-rapporten godkänd, etapperna ej startade): REV-1 felhantering → REV-2 kvitton → REV-3 tomma lägen och UI → REV-4 FunctionGuide och språk. **De tre frågorna är besvarade:** kunden ser ordet "rådgivare"; `hq` och `webbdata-demo` flyttas ut ur menyn bakom admin-flagga; `SkapaInlaggMaker.tsx` tas bort efter grep-kontroll av dynamiska importer.
- **BILD-8:s DoD-genereringar** (se ovan).
- **Parkerat, inget byggs:** automatisk omgenerering vid detekterat förbjudet klientord (i dag detektering + logg), röstträff-åtgärderna för linkedin, WIZARD-1/2/3, samt en UI-yta för story-bank och Customer Voice.

**Dataproblem, inte kodproblem:** HM Motor-tenanten `00000000-…001` har en coaching-/kundflödesprofil i databasen, inte bilhandel. Rotorsaken är stängd i koden (diff-bekräftelse), men **profilens innehåll behöver fortfarande rättas manuellt**.

**Två beställningar utan spår i repot:** IDÉ-1 (tre distinkta vinklar, fullständiga meningar, 3-av-3-löftet) och UTKAST-1 (autospar vid refresh) har inga egna commits. Funktionaliteten verkar delvis levererad under andra namn: autosparet byggdes i BILD-2 (`eab1f73`, debounce till localStorage + "Fortsätt där du slutade"), och variantregeln från T-6c är inkopplad i idé-flödet. "Fullständiga meningar" och 3-av-3-löftet är inte verifierade.

---

## 4. Fällor värda att veta (dyrköpta i dag)

1. **Migrerade flöden måste sätta `skrivregler: false`** mot `generate`/`generateJSON` — prompt-core äger flaggbeslutet (lager 8). Annars kör `medSkrivregler` över en tenant som stängt av reglerna.
2. **Vision autokorrigerar.** Fråga aldrig modellen "är detta rättstavat?" — be om exakt transkription och jämför i kod.
3. **Env-filer med CRLF:** `split('\n')` lämnar `\r` i värdet → API svarar 401 "invalid x-api-key" trots giltig nyckel. Splitta på `/\r?\n/`. Diagnos: 401 = fel nyckel, 400 "credit balance" = rätt nyckel men tom plånbok.
4. **Junction + `rm -rf` är farligt på Windows.** En temporär git-worktree med `node_modules` länkad via junction: raderingen följde länken och tömde projektets `.bin`, vilket fick två mätbatchar att dö tyst. `npm install` återställde. Ta bort junctionen först nästa gång.
5. **Batch-metoden** (`scripts/text1-batch.mts`) shimmar `next/headers` i sin egen tsconfig och använder en riktig HMAC-signerad admin-session — produktionskoden är orörd. Bieffekter (`linkedin_posts`, `hm_social_posts`, `agent_experiments`) loggas, raderas och verifieras efter varje körning. `TEXT1_UT` styr utkatalog, `TEXT1_SKIP` hoppar flöden.

---

## 5. Filer att peka på

| Fil | Innehåll |
|---|---|
| `TEXT1-RESULTAT.md` | Före/efter-mätningen, tabeller per flöde, sida-vid-sida-exempel, blindbedömningsmall |
| `TEXT1-PLAN.md` | Arkitekturbeslutet bakom promptpipelinen (godkänd plan) |
| `REVISION-RAPPORT.md` | Hela kvalitetsinventeringen: felmeddelanden, kvitton, tomma lägen, UI, språk, topp 10, REV-1–4 |
| `docs/text1/fore/SAMMANFATTNING.md` | Mätmetod och baslinje |
| `docs/studio/bild5-exempel/`, `bild7-exempel/` | Före/efter-bilder med README |
| `lib/prompt-core.ts` | Kärnan — läs den först vid allt promptarbete |
