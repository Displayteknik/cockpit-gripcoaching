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
| ~~UTKAST-1 (autospar 5 ytor)~~ | 31/7 | **LEVERERAD** `6be991c` | BILD-2:s autospar skrev men läste aldrig tillbaka; nyckeln byggdes på tom slug → tenants delade hink. Ny hook `lib/studio/useUtkast.ts` |
| ~~IDÉ-1 rester: 3-av-3, interpunktion, sanning i pitch~~ | 31/7 | **LEVERERAD** `8014b29`+`4bc0bd4` | Interpunktionens rotorsak var UI-rendering `{headline2}: {body}` — prompten var oskyldig. 3-av-3 med omgenerering; ordform-löften ("betalar sig på tre månader") grindade fail-closed |
| ~~Idé som underlag, aldrig publik text~~ | 1/8 | **LEVERERAD** `7f5c515` | Rotorsak: VECKOPLANEN skrev captionens hook/body till payload.headline1/body (text för ett format återbrukad i ett annat). Studios idéflöde var oskyldigt |
| ~~Perspektivregel (talar som tenanten)~~ | 1/8 | **LEVERERAD** `74a5a3c` | Kontrollfråga i regeln: byt varje "vi" mot klientens namn — blir meningen sann? |
| ~~Prisregel (inga egna priser i genererad text)~~ | 1/8 | **LEVERERAD** `bc8ad9b` | "Att känna till priset och att skriva ut priset är två olika saker." Undantag öppnas bara av användaren eller ett flöde som kräver pris — aldrig av profilens egna priser. BILD-7:s skyltbudskap orört |
| ~~Loggval: render-bevis + manuell override~~ | 1/8 | **LEVERERAD** `b392cd4` | ⚠ Fynd: render-routen är INTE publiceringsvägen (Playwright 501 i molnet → html-to-image ur live-editorn). Ny `/api/studio/logo-hint` ger klienten samma beslut. Manuellt val Auto/Ljus/Mörk/Platta i `overrides.logoVariant` |
| ~~Småfixar: raknaCta-ordlista, "hög ljusstyrka"~~ | 1/8 | **LEVERERAD** `62621a4` | CTA-golvets egen exempelmening räknades förut som noll CTA:er |
| ~~"Prata in" läcker systeminstruktionen~~ | 1/8 | **LEVERERAD** `b6e2ed9` | Rotorsak: Gemini ekar sin egen instruktion vid för kort ljud (HTTP 200, finishReason STOP). Grind mot promptekon på server + klient, tre routes drabbade (transcribe, assets/transcribe, intake/upload) |
| ~~CTA-golvet i captions är intermittent~~ | 1/8 | **LEVERERAD** `ea53435` | Alla captionvägar går via prompt-core + deterministisk efterhandskontroll (en omgenerering, fail-open). Håkans skärpningar: CTA är sista MENINGEN; siffergrinden gäller varje tal, även om omvärlden. DoD 10/10 captions + 7/7 veckoplansdagar |
| ~~DM: lead via bild stannar på mållinjen~~ | 1/8 | **LEVERERAD** `bb06b33`+`d1c46cd`+`63a43bc`+`34199ae` | Rotorsak: den fria AI-sammanfattningen fick avgöra vem som sagt vad. Nu bestämmer bubblans placering (`lib/dm/skarmdump.ts`), och fas/datum/påminnelse räknas ut i kod. Messenger-skärmdumpen ger namn, kanal, fas BOKAD, måndag 3 augusti 10:00 och påminnelse — utan en enda manuell inmatning. Kontakten syns i Fokus idag. Även "Bild"-knappen går nu till den strukturerade avläsningen (`0495ef5`, `onBild`-prop i SmartTextarea) |
| ~~BILD-8 DoD-genereringar~~ | 31/7 | **LEVERERAD** `545d5ae` | Del A 9/10, Del B 9/10. Bevisningen avslöjade tre fel i grinden (närmiss fällde rättstavat, teckenvis `\|` misstolkat, vision autokorrigerar) — alla fixade. ⚠ SLUTSATS: stavning går INTE att garantera, varken via prompt eller vision-grind (2/20 tog sig igenom) |
| Siffergrinden når inte veckoplanen | 2/8 | **Ej gjort** | Skärpningen 2/8 gav deterministisk siffergrind i captionvägen (`sakerstallCaption`). Veckoplanens brödtext har bara promptregeln — DoD-omkörningen gav fortfarande "en standardskärm har cirka 400 nits" (obackat) i måndagens text. Kräver omgenerering av dagens body, inte bara CTA:n |
| ~~BESLUT: grindens pris vs BILD-7a~~ | 2/8 | **LEVERERAD** `c7e4209` | Håkans svar: sista utvägen ber om ett TEXTLÖST MOTIV (ingen textbärande yta i bild), aldrig en tom skylt. Samma commit bär B3-rekommendationen i UI och bakgrundsfiltret. Beslut: `docs/studio/DECISIONS.md` D-010 |
| ~~BILD-8b når inte reels~~ | 2/8 | **LEVERERAD** `e18362c` | `PERSON_ATTENTION_EN` vävs in i reels-vägens båda bildprompter, död `stavningsgrind`-import borta |
| ~~Säsongsmarkör på bakgrundsskyltar~~ | 2/8 | **LEVERERAD** `81cc8a0` | `KRÄFTSKIVA 8 AUGUSTI` på griffeltavlan i bakgrunden. Negativ instruktion i `DEPICTED_MESSAGE_EN/SV`: skyltning som inte är inläggets ämne får inte annonsera högtid eller datum |
| ~~**STEG 2 · KOSTNAD-1 (K1–K5)**~~ | 2/8 | **LEVERERAD** | Se avsnitt 6 nedan: `lib/ai-usage.ts` är enda vägen, migrations körda, `/dashboard/kostnader` byggd, budgetgrind på plats. DoD 12/12 gröna |
| **STEG 3 · ETAPP K2 Cockpit Credits** | 2/8 | **Ej startad** | Bygger ovanpå KOSTNAD-1:s ledger. K2-1 … K2-4, hårt stopp efter varje |
| **STEG 4 · HANDBOK-1 (H-0, H-1)** | 2/8 | **Ej startad** | H-0 = plan med hårt stopp innan bygge |
| **STEG 5 · ICP-motorn (ICP-0..7)** | 2/8 | **Ej startad** | ICP-0 = spec + datamodell + säkerhetsgenomgång, godkännande före kod |
| **STEG 6a · REVISION-1: REV-1 → REV-4** | 30/7 | **Ej startad** | Rapport godkänd, tre frågor besvarade (`284f4c6`) |
| **STEG 6b · PROFIL-2: yta för berättelser/kundord** | 1/8 | **Ej startad** | Mätaren uppmanar till material som inte går att fylla i |
| **STEG 7 · Städning och inventering** | 2/8 | **Ej startad** | SMS-fullversion (status, bygg inget), `docs/plattform/ONBOARDA-NY-KUND-INSTAGRAM.md` ospårad, verifiera BILD-1..3 + ANSLUT-1..4 i skarp tenant |
| Blindbedömningen (Håkan) | 31/7 | **Ej gjord** | Avgör röstträff-frågan för LinkedIn |
| HM Motors profilinnehåll rättas i DB | 1/8 | **Ej gjort** | Koden hindrar nästa olycka, städar inte den gamla |

## 3. Öppet just nu

**Pågår:** inget bygge. STEG 1 i masterkön (2026-08-02) är stängt: KVALITET-3 p11 levererades `ea53435`, BILD-8 DoD `545d5ae`, och BILD-8c `c7e4209` + `e18362c` + `81cc8a0`. Nästa etapp är STEG 2 (KOSTNAD-1), som inte startar utan Håkans klartecken.

**BILD-8 slutläge:** grinden minskar felen men garanterar dem inte bort (2 av 20 tog sig igenom DoD-körningen). Enda garantin är fältet "Text i bilden" (B3), och det står nu i klartext i Bildhjälpen. Sista utvägen ber om ett textlöst motiv i stället för en tom skylt, och bakgrundstext som läsriktningarna är oense om lämnas odömd. Kvar medvetet: ingen efterkontroll som mäter blickriktning (motsvarande `motivPassar`).

**Väntar på Håkan:**
- **Blindbedömningen** (bilaga B): 10 texter per profil, nivå 1 publicerar direkt / nivå 2 en minuts puts / nivå 3 omskrivning. Ribba 7/10 på nivå 1–2. Under ribban justeras profilens material, inte arkitekturen.
- **REVISION-1** (REV-0-rapporten godkänd, etapperna ej startade): REV-1 felhantering → REV-2 kvitton → REV-3 tomma lägen och UI → REV-4 FunctionGuide och språk. **De tre frågorna är besvarade:** kunden ser ordet "rådgivare"; `hq` och `webbdata-demo` flyttas ut ur menyn bakom admin-flagga; `SkapaInlaggMaker.tsx` tas bort efter grep-kontroll av dynamiska importer.
- **Klartecken för STEG 2 (KOSTNAD-1).** Specen finns, kön är stoppad tills du säger kör.
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

---

## 6. KOSTNAD-1 — central AI-kostnadsmätning (STEG 2, levererad 2026-08-02)

**Varför:** AI-anrop loggades inte centralt. Betalningsspärren på Google Cloud 1/8 syntes bara som en statuskod utan svarskropp och kostade en timmes felsökning på en påhittad bugg.

### K1 · `lib/ai-usage.ts` är enda vägen

Två ingångar, samma logg, samma felklassning, samma budgetgrind:

- `anropaProvider()` — rå HTTP mot ett provider-API (Gemini, fal.ai, Pexels, Anthropics batch-API). Läser **alltid** svarskroppen, även vid fel.
- `loggaAnrop()` — SDK-anrop där vi inte äger fetchen (Anthropic-SDK i `iterate`, specialister, setup-agenten).
- `loggaHandelse()` — direktskrivning för kostnader som bokförs i efterhand (Anthropics batch-resultat).

**Flöde och tenant fylls i automatiskt.** `flow` härleds ur `x-pathname` (som middleware redan sätter på varje request), `tenant_id` ur `getActiveClientId()` — samma källa som resten av appen. Ett bibliotek djupt ner i kedjan behöver alltså inte veta vilken knapp som tryckts, och ett nytt flöde kan aldrig glömmas bort och landa omätt. Anroparen kan alltid åsidosätta båda.

### Tabeller (migration `migrations/ai_usage.sql`, körd via Management API)

| Tabell | Roll |
|---|---|
| `ai_usage_events` | En rad per anrop: tenant, provider, modell, flöde, tokens in/ut, media, kostnad i kronor, status, felklass, http-status, **hela svarskroppen**, svarstid |
| `ai_pricing` | Prislista per provider och modell (per 1M tokens eller per bild/sekund) med valuta och växelkurs. Ägarstyrd i DB, ingen deploy behövs |
| `ai_tenant_budget` | Tak per tenant. Saknas raden gäller kodens 200 kr |
| `ai_platform_budget` | Globalt månadstak plus varningsprocent (default 90) |
| `ai_provider_health` (vy) | Senaste lyckade anrop, senaste fel, felklass och svarskropp per provider |

### K2 · Felklassning

`billing` · `quota` · `auth` · `model` · `other`. **Statuskoden ensam räcker inte:** 403 är både "fel nyckel" och "obetald faktura", och 400 är både "trasig prompt" och Anthropics tomma plånbok. Därför läses kroppen, och betalning prövas först. RÖD status ges bara vid `billing` och `auth`, och bara när felet är nyare än senaste lyckade anrop — kvot löser sig själv, ett gammalt betalningsfel som följts av lyckade anrop är åtgärdat.

### K3 · `/dashboard/kostnader` (endast huvudadmin)

Larmbanner i klarspråk med länk till providerns fakturasida · kort för idag, sju dagar, månad och prognos · plattformens tak med varningsfärg · tjänsternas läge · per klient mot taket (gul vid 75 procent, röd vid 100, taket ändras direkt i vyn) · per tjänst och per flöde som tabell med stapel · de 50 senaste felen med expanderbar svarskropp.

### K4 · Budgetgrindar

Kontrollen ligger i wrappern, alltså på den obligatoriska vägen. Vid 100 procent av tenantens tak görs **inget anrop alls** och användaren får ett vänligt svenskt besked. Budgetstopp loggas medvetet **inte** som providerfel: ingen provider kontaktades, och en spärrad tenant får inte färga hälsan röd för alla andra. Läget cachas 60 sekunder och töms när taket ändras i adminvyn.

### K5 · Migrering — grep-bevis

Alla filer som når en provider går genom wrappern:

```
app/api/ai/transcribe/route.ts      app/api/offert/blueprint/route.ts
app/api/ai/vision/route.ts          app/api/offert/products/extract/route.ts
app/api/assets/transcribe/route.ts  app/api/posts/[id]/nano-banana/route.ts
app/api/dm/extract-lead/route.ts    app/api/review/post/route.ts
app/api/intake/upload/route.ts      app/api/setup/chat/route.ts
app/api/lobby/extract/route.ts      app/api/specialist/[id]/run/route.ts
lib/gemini.ts   lib/images.ts   lib/bildtext.ts   lib/iterate.ts
lib/deep-audit-generate.ts   lib/deep-audit-finalize.ts
```

Kontroll: `grep -rn "generativelanguage\|api.anthropic.com\|fal.run\|api.pexels.com" app/ lib/` ger bara URL-strängar som skickas **in i** wrappern.

**Två medvetna undantag, båda dokumenterade i koden:** Gemini Files API (ren filöverföring vid stora intake-uppladdningar) och Anthropics statuspoll för batchar. Ingen av dem är ett betalt generativt anrop, och statuspollen körs av cron var femte minut — den hade fyllt ledgern med brus utan att mäta en krona.

### DoD — kört skarpt (`scripts/kostnad1-dod.mts`), 12 av 12 gröna

Del 1 mot en lokal server som svarar 402 med betalningskropp (inget riktigt konto spärras): felklass `billing`, klartext till anroparen, raden i ledgern, **hela svarskroppen sparad** (133 tecken, ordagrant), http-status 402, provider-hälsan visar felet som senaste med rätt felklass, larmet på plats efter 1,1 sekunder. Del 2 med ett riktigt Gemini-anrop: 12 tokens in, 3 ut, 0,00011655 kr, svarstid mätt. Båda DoD-raderna raderades efteråt.

**Ärlig kvarleva:** prislistan är riktvärden från augusti 2026, inte fakturerade priser. Siffran i vyn är en *uppskattning* tills priserna stäms av mot en verklig faktura. Det är precis vad `ai_pricing` finns för — raderna ändras i databasen utan deploy.

---

## 7. KOSTNAD-1b — ALLA betalda tjänster i samma vy (Håkans krav 2026-08-02)

Kravet: *"jag vill se ALLA apier jag har kostnader för med på ett överblickbart sätt."*

Kostnader finns i två former, och en vy som bara visar den ena ljuger om totalen:

**Mäts per anrop** (går genom `lib/ai-usage`, syns per tjänst, flöde och klient):
Gemini · Anthropic · fal.ai · Pexels · Pixabay · **Resend** (mejl) · **46elks** (SMS) · **Google PageSpeed**.

46elks svarar med det **verkliga** priset per SMS. Wrappern tar därför emot en rapporterad kostnad (`kostnadSek`) som går före prislistan: ett fakturerat pris slår alltid en uppskattning. Ett testutskick (dryrun) kostar inget och loggas som noll. Gratistjänster med kvot (Pexels, Pixabay, PageSpeed) loggas också — en gratis tjänst med kvot är en kostnad som väntar på att bli en, och en kvotsmäll ska synas i samma vy som allt annat.

**Fasta abonnemang** (`fasta_kostnader`, ägarstyrd tabell): Vercel, Supabase, GoHighLevel, domäner. De går inte att mäta per anrop men är verkliga pengar varje månad. Beloppen redigeras direkt i vyn. **Startvärdena är 0 kr med flit** — en påhittad månadskostnad är värre än en tom, och raden visar "belopp saknas, totalen är för låg tills du fyllt i det" tills den fylls i.

Vyn heter nu **Vad tjänsterna kostar** och toppen visar: förbrukning idag · förbrukning denna månad · fasta abonnemang · **totalt vid månadsslut** (förbrukning plus abonnemang).

---

## 8. ETAPP K2-1 — creditledger och spärr (STEG 3, fas 1 av 4)

**Grundregeln:** credits är en vy ovanpå KOSTNAD-1:s ledger, aldrig en egen mätning. Varje `usage`-transaktion pekar på raden i `ai_usage_events` som orsakade den. Vid konflikt är ledgern sanningen.

**Tabeller** (`migrations/credits.sql`, körd): `credit_accounts` · `credit_transactions` (med främmande nyckel till `ai_usage_events`) · `credit_pricing` (social bild 3, herobild 8, video 15 per påbörjat femsekundersklipp) · `topup_orders`. Modulen `credits` är inlagd i registret med **default AV** (K2-4).

**Spärren ligger i `anropaProvider`** — samma obligatoriska väg som kostnadsloggen. `lib/ai-media` fanns inte i repot; den vägen är i praktiken wrappern, och en väg förbi den är en väg förbi hela systemet. Ordningen: kronorsgränsen först (gäller alltid), sedan credits (bara för tenants som har modulen på). Räcker inte saldot görs **inget anrop alls** och kunden får ett vänligt svenskt besked **utan kronor**. Credits dras först efter ett lyckat anrop — ett misslyckat anrop kostar kunden ingenting.

**Månadsreset** körs på två vägar: cronen (`/api/scheduler/cron`, idempotent, returnerar `creditsReset`) och lat vid läsning. En missad cron kan därför aldrig ge en kund fel saldo. Resetten är race-säker: uppdateringen villkoras på den gamla perioden, så bara en anropare vinner och skriver `monthly_reset`-raden.

⚠ **Perioden räknas i svensk tid.** Servern kör UTC, och 31 juli 23:30 UTC är redan 1 augusti i Sverige. Utan tidszonen hade den genereringen räknats mot fel månad.

**Bevis:** 22 enhetstester (`tests/k2-credits.test.ts`, reset, saldo, dragning, spärr, påfyllning, videoklipp) plus 15 kontroller mot den **riktiga** databasen (`scripts/k2-1-dod.mts`): exakt en ledgerrad ger exakt en usage-transaktion som pekar på den, främmande nyckeln avvisar ett okänt händelse-id, statuschecken avvisar en okänd transaktionstyp, resetten nollställer och loggar, påfyllningsflödet är spårbart hela vägen till insatt saldo. Kast-tenanten städades bort.

**Kvar i etappen:** K2-2 kundvyn i `/k` · K2-3 owner-admin (credits och kronor sida vid sida, godkänna påfyllningar) · K2-4 utrullning med Displayteknik som pilot. Inget av det är byggt — hårt stopp efter K2-1 enligt kön.

---

## 9. ETAPP K2-2 — kundvyn (STEG 3, fas 2 av 4)

**Sidan `/k/credits`** ("Bilder och video" i menyn, entitlement-styrd via samma modul-id `credits`, default av):
saldo stort och först · förbrukningen i klartext ("14 bilder, 1 video") · vad varje sak kostar i credits · påfyllnadsknapp · historik för månaden.

**Saldot syns också där bilden faktiskt skapas** — en liten rad i Bildhjälpen inne i Skapa inlägg, med länk till sidan. Den hämtas bara i kundvyn, och en kund utan modulen ser varken siffra eller felmeddelande. Efter varje bildgenerering läses saldot om, så siffran är sann direkt.

**Förvarning under 15 procent** ("Det börjar ta slut: 42 credits kvar, det räcker till ungefär 14 bilder till") och **tydligt besked vid noll**, som säger vad som fortfarande går att göra (texter är fria), när kvoten förnyas och hur man fyller på.

**Klarspråk, tre hårda regler i vyn:** inga kronor någonstans, inga interna ord, och "din rådgivare" i stället för byråns namn. Påfyllningsbeskedet är ordagrant det beställda: *"Din påfyllning är beställd och aktiveras inom kort, faktureras separat."*

### Ett hål som stängdes på vägen

Utan fix hade en spärrad kund fått **"Kunde inte skapa en bild för det här ämnet. Prova Sök foto"** i stället för creditbeskedet: routen ersatte grindens meddelande med sitt generiska. Nu bär `generateImagen`/`generateFlux` en `stopp`-flagga hela vägen upp, och routen svarar 429 med grindens egen text. En grind som inte förklarar sig är värre än ingen grind — kunden hade letat efter ett tekniskt fel som inte fanns.

### Handbokskapitel

`content/handbok/credits.md` följer kapitelmallen ur beställningen (Vad du får ut av det · Kom igång · Så gör Displayteknik · Vanliga frågor · Om något strular) med Displaytekniks menyskärmskampanj som scenario. ⚠ **HANDBOK-strukturen finns inte än** (STEG 4), så kapitlet ligger som fil och kopplas in när HANDBOK-1 byggs. Frontmatter bär `modul: credits` så entitlement-styrningen kan läsa den direkt.

**Bevis:** 26 enhetstester i `tests/k2-credits.test.ts` (fyra nya på klartexten), 399 totalt, `tsc` och build rena, båda nya routerna med i bygget.

⚠ **Ärlig kvarleva:** kundvyn är inte sedd med en riktig inloggad kund, för modulen är av för alla tenants. Det är avsiktligt — utrullningen är K2-4. När Displayteknik slås på som pilot ska vyn granskas med kundens egna ögon innan fler får den.

---

## 10. ETAPP K2-3 — owner-admin (STEG 3, fas 3 av 4)

Allt ligger i `/dashboard/kostnader`, så credits och kronor står i samma vy. Det är hela poängen: skiljer de sig åt är priserna fel, och det syns bara när man ser båda samtidigt.

**Per klient** står nu creditsaldot bredvid kronorna: hur många credits som är kvar av kvoten, hur många som är köpta, hur många som använts. Kvoten ändras direkt på raden.

**Larmet om felprissatta credits** (`arFelprissatt` i `lib/credits`): slår när kostnadstaket nås **medan credits finns kvar**. Då har kunden blivit lovad ett utrymme hon inte får använda, och felet sitter i prissättningen, inte i spärren. Omvänt är det helt normalt att creditsen tar slut medan kronorna räcker, och det larmar inte. Larmet visas både överst i vyn och på klientens egen rad.

**Påfyllningar** listas med kund, antal och belopp. Godkänn så sätts creditsen in och beställningen stämplas med tidpunkt och beslutsfattare. Avslag stämplas likadant. Antalet väntande syns överst så det inte behöver letas upp.

**Manuell insättning** per klient med **obligatorisk notering**. En insättning utan skäl går inte att förklara i efterhand, så tomt fält avvisas i både API och UI.

**Creditpriserna** redigeras i vyn och cachen töms vid sparning, så ett nytt pris gäller direkt i stället för att slå igenom när cachen råkar löpa ut fem minuter senare.

⚠ **Månadsskiftesdetalj:** ett konto vars period inte nollställts än (cron har inte hunnit) visas som 0 använda credits, inte förra månadens siffra. Annars hade adminvyn sett fel ut varje den 1:a.

**Bevis:** 31 enhetstester i credit-sviten (fem nya på larmregeln), 404 totalt, plus 10 kontroller mot den riktiga databasen (`scripts/k2-3-dod.mts`): kvoten ändras och slår igenom i saldot, insättning utan notering avvisas, insättning med notering är spårbar med skäl och avsändare, priset cachas och det nya priset gäller direkt efter tömning. Kast-tenanten städades och creditpriset återställdes.

**Kvar i etappen:** bara K2-4, utrullning bakom entitlement med Displayteknik som pilot. Modulen `credits` finns i registret med default av.
