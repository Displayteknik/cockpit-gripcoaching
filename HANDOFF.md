# HANDOFF — Cockpit, läget 2026-08-01

En fil att klistra in eller ladda upp när arbetet ska delas med en fristående session. Uppdateras vid varje avslutad etapp. Repot är privat (`Displayteknik/cockpit-gripcoaching`), så mottagaren kan inte läsa filerna själv — det som står här ska räcka.

**Projekt:** Cockpit / MySales Pro — `C:\Users\hakan\OneDrive\Dokument\Antigravity\hmmotor-next`, Next.js 16 + Supabase + Gemini (text/bild) + Anthropic (iterationsloopen). Multi-tenant: byråvy `/dashboard`, kundportal `/k`. Live: cockpit.gripcoaching.se (Vercel, deploy sker vid `git push` till master).

**Senaste commit:** `f9d2f23` (2026-08-09). Allt nedan är pushat och i produktion om inget annat sägs. 708 enhetstester gröna, `tsc --noEmit` och `next build` rena. ⚠ Avsnitt 1 och framåt beskriver 2026-08-01 — läs avsnitt 0 för aktuellt läge.

---

## 0. NÄSTA SESSION BÖRJAR HÄR — läget 2026-08-09

**Senaste commit: `88e306e`, pushad till master.** 715 tester gröna, `tsc` rent, `next build`
kompilerat. Läs `docs/STATUS.md` först — den är totalinventeringen och uppdateras varje
session. En beställning utan rad där existerar inte.

### ⚠ ÖPPEN FRÅGA FRÅN 9/8 — börja här

Håkan såg **`Unexpected token 'A', "An error o"... is not valid JSON`** i Studio på live
(Displayteknik, karusell med 5 slides laddad) strax efter deployen av `f9d2f23`.

Det är `JSON.parse` som fått Vercels textfelsida — ett anrop timeoutade eller kraschade.
**Vilket anrop är inte fastställt.** Orsaken gick inte att spåra i efterhand eftersom
mönstret `await r.json()` fanns på 27 ställen i StudioMaker utan kontroll av svaret.

`88e306e` gör felet självidentifierande (`lib/las-json.ts`): timeout, för stort innehåll,
utloggad och serverfel får var sin klartext med statuskod. **Nästa steg: be Håkan göra om
samma sak och läsa den nya raden.** Statuskoden avgör om det är en regression från 9/8.

Obelagd misstanke: `logo-hint` gör nu upp till tio `sharp`-mätningar i ett anrop
(`maxDuration = 30`). Men den effekten fångar sina egna fel och borde inte kunna nå
felrutan — så antingen är misstanken fel, eller finns en väg som inte kartlagts.
**Gissa inte, mät med den nya texten.**

### Beslutad ordning (Håkans, tvingande)

AKUT-KARUSELL → AKUT-DM → **G-1** → G-2 → FIX-1-REST (B2+C) → G-3 → G-4 → G-5 → G-6 → G-7
→ G-8 → G-9. Hårt stopp per etapp.
★ **Kundleverans går alltid före granskningsarbete** — det inträffade två gånger 9/8.

### Klart och bevisat

| Etapp | Bevis |
|---|---|
| **G-0** read-only-rapport | `docs/gransk/G0-RAPPORT.md` — flödeskarta (21 anropsställen i 19 filer genom prompt-core, fyra flöden utanför), formatinventering, anatomi-gap, generationslogg, mätbarhet |
| **AKUT-KARUSELL** | N slides → N bilder i export, bibliotek, publicering och kö. `publishCarousel` + `slideUrls` fanns redan färdiga — bara anroparen saknades. Migration `studio_scheduled.slide_urls` körd. Gamla vägen 410. **15 tester** |
| **AKUT-DM** | `suggest-reply` genom prompt-core, syfte `dm-svar`, fullt skydd utan CTA-tvingning. **12 tester** |
| **Språkregler lager 8** | Regel 5 skenfrågor (+ deterministisk grind i captionvägen), regel 6 hooken måste infrias. **13 tester** |
| **Text utanför grafikytan** | Mätt: 34-teckens ord gick 454 px utanför en 1080-kanvas → nu 124 px innanför. `overflowWrap` på alla tio grafikrötter + källtest |
| **Djupgranskningsrapporterna** | Dolda i kundvyn server-sidan före DB-läsningen, behållna internt |
| **AKUT-PROV (snapshot)** | Rotorsak bevisad i körningsloggen. GHL:s API kan **inte** applicera snapshot på befintligt konto (probat). Spärr byggd; custom values gatas inte längre på byråtoken |
| **Madeleine/Makzy** | Konto mot mallens facit, kundnyckel sparad, steg 4 grönt, logotyp verifierad i renderingen |

### Klart men OBEVISAT — verifiera först

1. **Karusellexportens DoD** — 7 slides ska ge 7 filer. Publiceringskedjan är testad, men
   **ingen har kört nedladdningen**. Detta är nästa sak att göra, på live.
2. **Förhandsvisningens klippning** — orsaken borttagen, aldrig sedd i inloggad Studio.
3. **GHL med flera bilder** — `media[]` skickas, ej provat mot skarpt konto.
4. **FIX-1 grupp A + B1** — inget test, ingen ommätning sedan fixen.

### Återstår

- **G-1 … G-9** — inget påbörjat. G-1 (generationsloggen) är nästa etapp.
- **FIX-1-REST** (B2 Vilande, grupp C) — mellan G-2 och G-3.
- **BILD-9-spec** — beställd med hårt stopp, ingen spec finns i repot.
- **PROFIL-2** — uppflyttad till direkt efter FIX-1-REST (UI-löfte utan täckning).
- **Skenfrågegrinden utanför captionvägen** — hör till G-2.
- **Makzy: varumärkesfärg + tonregler** — Håkans val, inte gissningsbart.
- **`GHL_BYRA_TOKEN` + `GHL_COMPANY_ID` i Vercel** — annars kan Cockpit inte skapa nya konton på live.

### Stående regler

Allt textflöde genom `lib/prompt-core`, allt betalt genom `lib/ai-usage`, inga fabricerade
siffror, generalitet mot två tenants (Displayteknik + For Balance), hårt stopp per etapp,
`docs/STATUS.md` uppdateras varje session, och **mät själv — be aldrig Håkan verifiera åt dig**
(render-ytan `/studio/render/<id>?p=<base64>` är oinloggad och går att mäta i DOM:en).

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
| ~~Siffergrinden når inte veckoplanen~~ | 2/8 | **LEVERERAD** `ea53435`+`74658b5` | Grinden finns i BÅDA veckovägarna: `generate/week/route.ts:208` (veckoplan) och `:322` (compass-vecka), och grindar hook + brödtext, inte bara CTA:n. Raden stod kvar som "Ej gjort" fram till G-0 (9/8) — verifierad med kodläsning då |
| ~~BESLUT: grindens pris vs BILD-7a~~ | 2/8 | **LEVERERAD** `c7e4209` | Håkans svar: sista utvägen ber om ett TEXTLÖST MOTIV (ingen textbärande yta i bild), aldrig en tom skylt. Samma commit bär B3-rekommendationen i UI och bakgrundsfiltret. Beslut: `docs/studio/DECISIONS.md` D-010 |
| ~~BILD-8b når inte reels~~ | 2/8 | **LEVERERAD** `e18362c` | `PERSON_ATTENTION_EN` vävs in i reels-vägens båda bildprompter, död `stavningsgrind`-import borta |
| ~~Säsongsmarkör på bakgrundsskyltar~~ | 2/8 | **LEVERERAD** `81cc8a0` | `KRÄFTSKIVA 8 AUGUSTI` på griffeltavlan i bakgrunden. Negativ instruktion i `DEPICTED_MESSAGE_EN/SV`: skyltning som inte är inläggets ämne får inte annonsera högtid eller datum |
| ~~**STEG 2 · KOSTNAD-1 (K1–K5)**~~ | 2/8 | **LEVERERAD** | Se avsnitt 6 nedan: `lib/ai-usage.ts` är enda vägen, migrations körda, `/dashboard/kostnader` byggd, budgetgrind på plats. DoD 12/12 gröna |
| **STEG 3 · ETAPP K2 Cockpit Credits** | 2/8 | **Ej startad** | Bygger ovanpå KOSTNAD-1:s ledger. K2-1 … K2-4, hårt stopp efter varje |
| ~~**STEG 3a · LIKVID-1** (betalstatus + likviditetsprognos i HQ)~~ | 2/8 | **LEVERERAD** | Se avsnitt 12. Betalstatusen ligger i `hq_deal_finance`, inte i GHL:s anpassade fält. Tre pipelinekort, 12-veckorsprognos per bolag, trafikljus, larm i morgonlistan. 36 DoD-kontroller gröna |
| ~~**STEG 3b · K3-INKÖP** (providersaldon, prognos, marginal)~~ | 2/8 | **LEVERERAD** | Se avsnitt 13. Fal.ai och 46elks läser saldot själva, Google Cloud är efterskott. Larmet går till BÅDA vyerna ur samma `lib/inkop`. 52 DoD-kontroller gröna |
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

## 11. HQ-1 — Founder HQ, ägarens kommandobrygga (levererad 2026-08-02)

`/dashboard/hq` är byggd på nytt. Den gamla länklistan (530 rader eget mörkt tema) flyttades till `/dashboard/genvagar` och ligger med flit **utanför menyn**, enligt REV-0. Nya HQ följer designsystemet (`components/ui/dash.tsx`). Inga AI-anrop i modulen.

**Principen:** affärspipelinen ägs av MySales. HQ läser den, skriver aldrig tillbaka. Ingen egen offerttabell finns, så dubbelinmatning kan aldrig uppstå.

### Tabeller (`migrations/hq.sql`, körd via Management API)
`hq_mrr_entries` · `hq_fasta_kostnader` · `hq_tasks` · `hq_pipeline_cache`. Alla har RLS på och **noll policies** — anon-nyckeln ser noll rader och får 401 på skrivning (verifierat live). All åtkomst går via service-role i `/api/hq`, som grindas på huvudadmin: klient-scopad session får 403 på GET, POST och DELETE, och proxy:n skickar den till `/dashboard/fordon` innan sidan ens laddas.

### MySales-läsningen (`lib/hq/pipeline.ts`)
GET `/opportunities/pipelines` + GET `/opportunities/search` (snake_case query, POST-body ger 422) + GET `/contacts/<id>/tasks`. Nyckeln läses ur `HQ_GHL_PIT` + `HQ_GHL_LOCATION_ID` och faller tillbaka på Displayteknik-klientens redan sparade koppling, så modulen fungerar utan ny konfiguration. Nyckeln lämnar aldrig servern. Synk vid sidladdning, högst var tionde minut, plus knappen "Uppdatera nu". Sidbrytning hanteras, annars tappas allt över 100 affärer tyst.

⚠ **GHL:s status-fält är inte sanningen om vunnet.** Alla 51 DT-affärer svarar `status: "open"`, varav 11 står i steget "Vunnen (order)" och 11 i "Förlorad / Paus". Vunnet och förlorat härleds därför ur **steget**: Håkans egna inställda steg-id:n i `coach_users.personal_os` är facit, stegnamnet är reserv. Räknar man på status blir "vunnet denna månad" alltid noll och pipelinesumman räknar in både vunnet och förlorat.

⚠ **Uppgiften sitter på kontakten, inte på affären.** Samma kontakt kan bära flera affärer, så en vunnen affär ärvde kontaktens uppföljning och dök upp i morgonlistan. Uppföljning fästs nu bara på affärer som är i spel. Fyndet kom ur DoD-körningen, inte ur enhetstesterna.

**Faller GHL:** spegeln lämnas orörd och vyn visar sparad data med tidsstämpel plus en gul banner med orsaken. Verifierat med trasig nyckel: `{ok:false, fel:"Pipelinerna svarade 401"}`, 51 rader kvar, samma tidsstämpel, ingen krasch.

### Vyerna
Morgonlistan (affärer vars uppföljning förfaller idag eller är passerad + öppna `hq_tasks` med samma regel, med avbockning) · GripCoaching (fyra kort: aktiv MRR, pionjärer av 15, GDÅM av 2, andel av 50 000 kr, plus tabell med CRUD) · Displayteknik (pipelinesumma i spel, affärer i spel, vunnet denna månad, uppföljningar denna vecka, tabell sorterad på uppföljningsdatum med länk till MySales) · Fasta kostnader (summa per bolag och valuta, CRUD) samt intäkt mot AI-kostnad för de kunder vars namn matchar en klient i plattformen.

Tid räknas alltid i svensk tidszon. Valutor summeras **per valuta** och räknas aldrig om åt varandra — en påhittad växelkurs gör totalen osann.

**Bevis:** 8 enhetstester (`tests/hq1-aggregering.test.ts`), 412 totalt, tsc och next build rena, plus 20 kontroller mot riktig databas och riktigt MySales-API (`scripts/hq1-dod.mts`), alla gröna. CRUD körd skarpt i webbläsaren och återställd: MRR 15 460 kr → paus → 13 470 kr och 3 pionjärer → återställd till 15 460 kr och 4 pionjärer. Mobilt 375 px: sidan scrollar inte i sidled, båda tabellerna scrollar i egna behållare.

### Håkans två beslut 2026-08-02
1. **Bara den pipeline han jobbar i räknas.** Urvalet styrs av `coach_users.personal_os.__ghl_pipeline_id` (DT: `2UpfDncGleH6fe9cLSpq`, "Kund pipeline DT"), inte av en hårdkodad lista. Spegeln lagrar fortfarande **allt**, filtret sitter i `/api/hq`, och antalet bortsorterade kort skrivs ut i vyn så inget döljs tyst. Effekt: 21 affärer i spel i stället för 29, summan oförändrad 799 000 kr (de åtta gamla korten i GHL:s "Sales Pipeline" stod på 0 kr). ⚠ Saknas inställningen visas allt, hellre för mycket än en tyst tom vy.
2. **Länken går till kontakten i MySales**, inte till affärskortet. En deep link rakt till affären gick inte att verifiera och gissades därför inte.

⚠ **Följd av beslut 1:** morgonlistans pipelinehalva är just nu **tom**. Båda uppgifterna med förfallodatum satt på kort i "Sales Pipeline". Ingen affär i Kund pipeline DT har någon uppgift i MySales än, så listan fylls först när uppgifter läggs på de korten.

*(De två raderna om LIKVID-1 och K3-INKÖP låg tidigare hopklistrade här i stället för i tabellen i avsnitt 2b. De är flyttade dit, innehållet är oförändrat.)*

---

## 12. LIKVID-1 — betalstatus och likviditetsprognos (STEG 3a, levererad 2026-08-02)

**Varför:** pipelinesumman blandade in delbetalda affärer, och det fanns ingen vy som svarade på frågan "räcker pengarna". En affär på 800 000 kr där 600 000 redan fakturerats och 400 000 betalats stod kvar med hela beloppet i "i spel".

### Spårvalet: `hq_deal_finance`, inte GHL:s anpassade fält

Behörigheten fanns. PIT:en skapade fält på opportunity-modellen (**201**) och skrev värden på en riktig affär (**200**). Fältet syntes i `GET /locations/<loc>/customFields?model=opportunity`. Ändå valdes den vägen bort, av tre skäl som mättes live 2/8:

1. **Ett skrivet värde går inte att radera.** `customFields: []`, `field_value: null`, tom sträng och `0` svarar alla 200 och lämnar värdet orört. Ett felskrivet fakturabelopp hade bara gått att skriva över, aldrig ta bort.
2. **Värdet överlever att fältet raderas.** Fältdefinitionen togs bort (200), men värdet ligger kvar som föräldralöst i API-svaret och pekar på ett fält som inte finns.
3. **Bulkläsningen släpar.** `/opportunities/search` svarade `customFields: []` direkt efter skrivningen och bar värdet först senare, dessutom i ett annat format (`fieldValueNumber` + `type`) än `GET /opportunities/<id>` (`fieldValue`).

Till det kommer HQ:s grundregel: **modulen skriver aldrig till MySales.** Med fälten i GHL hade betalstatusen behövt underhållas i GHL:s eget gränssnitt, och redigering direkt i HQ:s DT-tabell hade krävt just de skrivningar som är uteslutna. Valet är reversibelt: vill du ändå ha fälten i MySales kan `hq_deal_finance` fyllas ur dem utan att prognosen ändras.

⚠ **Kvarleva från provkörningen:** affären "Louise Ribbing" i MySales bär värdet `4242` mot fält-id `0VjWKVgG2XXBZLyM8icy`, som inte längre finns. Det syns inte i GHL:s gränssnitt (ingen fältdefinition att rendera det med), påverkar ingen automation och läses inte av Cockpit. Affärens namn, belopp (57 000 kr), steg och status är oförändrade. Det gick inte att radera, se punkt 1 ovan.

### Tabeller (`migrations/likvid.sql`, körd via Management API)

| Tabell | Roll |
|---|---|
| `hq_deal_finance` | Fakturerat, betalt, förväntat betaldatum och förfallodatum per affär. Nyckeln är GHL:s opportunity-id. **"Kvar att fakturera" lagras aldrig**, den räknas som affärens belopp minus fakturerat |
| `hq_bank_saldo` | Manuell avläsning per bolag. Senaste raden gäller, historiken sparas |
| `hq_cash_items` | Kända in- och utbetalningar. Positivt = in, negativt = ut. Moms och skatt läggs in här |
| `hq_likvid_konfig` | Buffertmål, larmgräns i veckor (default 4) och **USD-kursen** (default 11,0) per bolag |
| `hq_steg_sannolikhet` | Sannolikhet per steg. **En tabell utöver de tre beställda**, se motivet nedan |

Alla fem: RLS på, **noll policies**, åtkomst bara via service-role i `/api/hq` bakom huvudadmin. Verifierat med anon-nyckeln.

**Varför en femte tabell:** viktningen "på sannolikhet per steg" måste bygga på en siffra, och den siffran fick inte vara påhittad i en formel ingen ser. Raderna seedas vid synk ur stegets plats bland stegen i spel (`(plats + 1) / (antal + 1)`, alltså 13, 25, 38, 50, 63, 75 och 88 procent för Kund pipeline DT:s sju steg), vinststeget 100 och förluststeget 0. Ägaren ändrar siffran direkt i "Så ligger affärerna", och en rad han rört skrivs **aldrig** över av synken.

### De tre korten

- **I spel, ofakturerat** — bara affärer i spel, beloppet minus fakturerat, viktat på steget.
- **Fakturerat, obetalt** — fakturerat minus betalt för **alla** affärer, **oviktat**, med äldsta förfallodatum och antal passerade. En skickad faktura är inte en sannolikhet, den är en fordran.
- **Betalt i år** — allt som markerats som betalt.

DT-tabellen har fått Fakturerat, Betalt och Kvar som redigerbara kolumner plus båda datumen, och raden färgas när förfallodatumet passerats.

### Prognosen

Tolv veckor per bolag, med start i senaste banksaldot. **Utan banksaldo räknas ingen prognos alls** och inget larm går, i stället står det varför. In: kundinbetalningar på förväntat betaldatum (viktade i spel, 100 procent i vinststeget, förlorat räknas inte), månadsintäkt och positiva poster. Ut: fasta kostnader omräknade till kronor och negativa poster. **Ingen automatisk moms eller skatt.** USD räknas om med kursen ur konfigen och **kursen står i vyn**.

**Regeln mot dubbelräkning:** ett datum före fönstret räknas ändå med i första veckan om det ligger **efter** banksaldots datum. Pengarna rörde sig efter avläsningen. Ligger det före är beloppet redan i saldot.

**Trafikljus:** rött om saldot går under noll någon vecka, gult om det går under buffertmålet inom larmgränsen, annars grönt. Ett buffertbrott senare än larmgränsen visas som notering, inte som gult. Larmet läggs **överst i morgonlistan**, i samma lista och samma rendering som affärerna och uppgifterna.

**Affärer utan förväntat betaldatum** står separat som "Ej daterade", oviktat, och räknas aldrig in.

### Bevis

26 enhetstester (`tests/likvid1-prognos.test.ts`), **438 totalt**, `tsc` och `next build` rena. Plus 36 kontroller mot riktig databas, riktig route och riktigt MySales (`scripts/likvid1-dod.mts`), alla gröna.

**Handräknat fyraveckorsexempel** (finns som test): start 100 000 kr avläst 31 juli, idag 5 augusti. v32 månadsintäkt 20 000 in och fasta 30 000 ut ger 90 000. v33 affär på 100 000 kr i spel med 50 procent ger 140 000. v34 vunnen affär med 150 000 kvar ger 290 000. v35 moms 120 000 ut ger 170 000. Lägsta 90 000 kr vecka 32, buffertmål 100 000 alltså gult läge. En affär på 80 000 utan datum står som ej daterad, en förlorad på 60 000 räknas inte alls.

**Skarpt mot riktig data:** en riktig DT-affär gjordes delbetald (60 000 fakturerat varav 25 000 betalt, i ett steg med 63 procent). I spel sjönk från 547 770 till 509 970, alltså exakt 60 000 × 0,63. Fakturerat obetalt steg med 35 000, betalt med 25 000. Buffertmålet höjdes över lägsta punkten och larmraden dök upp i morgonlistan; en utbetalning på 900 000 tog saldot till minus och gav rött. All testdata raderad och frånvaron verifierad.

⚠ **Ärligt kvar:** ingen har ännu lagt in ett riktigt banksaldo, så prognosen står tom i produktion tills det görs. Det är avsiktligt, ingen siffra gissas fram.

---

## 13. K3-INKÖP — leverantörssaldon, prognos, larm och marginal (STEG 3b, levererad 2026-08-02)

**Varför:** betalningsspärren på Google Cloud 1 augusti syntes bara som en statuskod och stoppade allt som gick genom Gemini. Ingen visste att den var på väg. Modulen svarar på frågan i förväg: hur mycket finns kvar hos varje leverantör, hur fort går det åt, och när tar det slut.

### Saldona: två läses automatiskt, tre skrivs in

| Konto | Typ | Saldo | Verifierat |
|---|---|---|---|
| Fal.ai | Förbetalt | `GET https://rest.fal.ai/billing/user_balance` med befintlig `FAL_KEY`, svarar ett rått tal i USD | 9,568 USD live |
| 46elks | Förbetalt | `GET https://api.46elks.com/a1/me` med befintliga nycklar, `balance` i **tiotusendelar** av valutan (samma enhet som priset per SMS i `lib/sms/elks`) | 48,68 SEK live |
| Google Cloud | Efterskott | Inget saldo att läsa. Billing-API:t kräver OAuth eller tjänstekonto, inte en API-nyckel | manuellt |
| Anthropic | Förbetalt | Saldot exponeras inte för en vanlig API-nyckel (Admin-API kräver en `sk-ant-admin`-nyckel som inte finns) | manuellt |
| Resend | Efterskott | Inget saldo-API | manuellt |

Hämtning sker vid sidladdning, **högst en gång i timmen** (cachen är radens egen tidsstämpel). Går den fel skrivs **orsaken** i `saldo_fel` och det gamla saldot lämnas orört, så vyn kan säga "manuellt, 3 dagar gammalt" i stället för att visa en siffra som ser färsk ut. **Saldot gissas aldrig.**

⚠ Saldoläsningen ligger **utanför** `lib/ai-usage`-wrappern, som ett tredje dokumenterat undantag vid sidan av Gemini Files API och Anthropics statuspoll: en gratis läsning av vårt eget konto en gång i timmen hade fyllt ledgern med rader som aldrig kostat en krona och fått provider-hälsan att blinka på något som inte är ett produktionsfel.

### Takt och prognos ur ai_usage_events

`lib/inkop/berakning.ts` är rena funktioner med injicerat datum. Snittkostnad per dag över 7 respektive 30 dagar. **Nämnaren kortas till den faktiska mätperioden:** har mätningen bara pågått i två dagar delas summan på två, inte på trettio. Annars hade takten sett fyra gånger för låg ut och prognosen blivit farligt optimistisk. Perioder under tre dagar flaggas som tunt underlag i vyn.

- Förbetalt: dagar kvar = saldot delat på sjudagarssnittet. Utan uppmätt förbrukning svaras **null**, inte en lugn siffra.
- Efterskott: prognostiserad månadskostnad = trettiodagarssnittet gånger 30, jämförd mot fältet för förra fakturan.

### Larmen, en enda källa

`lib/inkop.byggInkop()` anropas av **både** `/api/kostnader` (banner) och `/api/hq` (raden överst i morgonlistan). Ingen av dem har egen tröskellogik. Gult under 14 dagar kvar eller prognos över 150 procent av förra fakturan, rött under 5 dagar **eller** när provider-hälsan flaggat `billing`-fel det senaste dygnet. Det sista larmet är det enda som inte kräver att någon hunnit fylla i en siffra, och det är precis fallet från 1 augusti.

Trösklarna ligger i tabellen `inkop_konfig` och ändras i vyn utan deploy. Det gör också att larmkedjan går att prova skarpt.

### Köprekommendation

45 dagars förbrukning enligt trettiodagarssnittet, omräknat till kontots valuta med **prislistans egen kurs** (att hitta på en kurs här hade mätt saldo och kostnad med olika måttstock), avrundat uppåt till providerns påfyllningssteg om det är känt, annars till ett jämnt belopp. Datumet är den dag saldot är nere på rödgränsen, inte den dag det är slut, så det finns marginal kvar. **Inga automatiska köp, aldrig.**

### Marginal per kund: valet blev kostnadsmodulen

Tabellen ligger i `/dashboard/kostnader`, inte i HQ. Skälet: den står direkt intill "Per klient", som redan visar AI-kostnad och credits per tenant, och marginalen är den tredje kolumnen i samma bild. HQ är larmytan, inte analysytan. Ingenting i HQ-1 eller LIKVID-1 byggdes om.

Intäkten kommer ur `hq_mrr_entries` (HQ:s egna intäktsrader) plus godkända påfyllningar innevarande månad ur `topup_orders`. Kopplingen till tenanten görs med den nya nullbara kolumnen `hq_mrr_entries.client_id`, som sätts i vyn; saknas den faller uträkningen tillbaka på exakt namnmatchning. **En kund utan ifyllt pris får aldrig marginalen noll** utan flaggas "pris saknas", och räknas inte in i totalen.

### Tabeller (`migrations/inkop.sql`, körd via Management API)

`provider_accounts` · `inkop_konfig` · kolumnen `hq_mrr_entries.client_id` · kolumnen `credit_pricing.note`. Båda tabellerna har RLS på och **noll policies**: anon ser noll rader, en insert svarar 401, och en update lämnar värdet orört (⚠ statuskoden 204 duger inte som bevis där, värdet måste läsas tillbaka).

### Lead-credits förberedda, inte prissatta

`lead_niva_a` och `lead_niva_b` ligger i `credit_pricing` med **0 credits och `active = false`**, med noteringen att priset sätts när ICP-motorns kostnadskarta finns ur verklig drift. Etiketterna lades in i `lib/credits` **samtidigt**: utan dem hade kunden fått läsa "3 lead_niva_a" den dag de slås på. Nu blir det "3 leads nivå A, 1 lead nivå B".

### Bevis

40 enhetstester (`tests/k3-inkop.test.ts`), **478 totalt**, `tsc` och `next build` rena. Plus **52 kontroller** mot riktig databas, riktiga routes och leverantörernas riktiga saldo-API:er (`scripts/k3-inkop-dod.mts`), alla gröna.

Larmkedjan bevisad skarpt i båda riktningarna: förra fakturan sänktes tillfälligt så Google Cloud gick gult, och gulgränsen höjdes tillfälligt så Fal.ai gick gult mot en riktig uppmätt förbrukning. **Larmtexten var ordagrant identisk i kostnadsmodulens banner och i HQ:s morgonlista**, vilket är hela poängen med en källa. Ett inlagt `billing`-fel gav rött oavsett saldo. Marginalen handräknades mot Displayteknik: 2 000 kr abonnemang minus 20,9258 kr AI-kostnad blev 1 979,0742 kr och 98,95 procent, på öret.

Mobilt 375 px: sidan scrollar inte i sidled, båda de nya sektionerna håller sig innanför, och marginaltabellen scrollar i sin egen behållare (678 px innehåll i 341 px behållare).

All testdata raderad och frånvaron verifierad: noll testhändelser, noll test-intäktsrader, trösklarna tillbaka på 14, 5 och 150, Google Clouds fakturafält tomt igen.

⚠ **Ärligt kvar:** ingen av de manuella siffrorna är ifylld i produktion. Google Cloud, Anthropic och Resend står utan saldo och utan förra fakturans belopp, och **inget efterskottskonto kan larma förrän fakturabeloppet är ifyllt**. Samma sak med marginalen: ingen tenant har ett abonnemangspris kopplat, så hela tabellen står som "pris saknas". Det är avsiktligt, ingen siffra gissas fram, men det betyder att modulen ger halva sitt värde tills Håkan fyllt i dem. Påfyllningsstegen är också tomma överallt eftersom de inte gått att verifiera.
| PLAN-1 (planeringsmodul, Google Kalender) | 2/8 | **Pågår i PARALLELL SESSION** | `lib/hq/kalender.ts`, `migrations/planering.sql`, `app/api/google/callback` låg ocommitterade 2/8 kväll. Rör dem inte utan att kolla med den sessionen |
| Fyll i K3:s manuella siffror (Håkan) | 2/8 | **Ej gjort** | Google Cloud/Anthropic/Resend: saldo + förra fakturan. Utan fakturabelopp kan efterskottskonton inte larma. Abonnemangspris per tenant saknas → hela marginaltabellen står "pris saknas" |
| Fyll i banksaldo + buffertmål (Håkan) | 2/8 | **Ej gjort** | LIKVID-1:s prognos står tom tills banksaldot finns. Buffertmål 0 → bara rött läge larmar |
| GHL: föräldralöst värde 4242 på affären "Louise Ribbing" | 2/8 | **Kan ej åtgärdas** | GHL raderar aldrig ett skrivet fältvärde. Osynligt i gränssnittet, läses av ingenting |
| SEO-1 (S-0..S-5): SEO-verktyget rapporterar nollor som mätvärden | 2/8 | **S-0 pågår** | KUNDVÄNT FEL SOM REDAN GÅTT UT. forbalance.se svarar 403 på bot-UA (46 blockerade tokens, bl.a. ordet "Spider"); verktyget läste tomt dokument, tolkade nollor som mätvärden och genererade en självsäker rapport: "0 ord, 2 sidor" mot verkliga 678 ord och 13 sidor. Placerad före HANDBOK-1. S-0 = read-only kartläggning med hårt stopp |


| ~~**GRANSK G-0** — read-only-rapport om inläggsmotorn~~ | 9/8 | **LEVERERAD** | `docs/gransk/G0-RAPPORT.md`. Fem tunga fynd, Håkans beslut inskrivna i rapporten. FIX-1 grupp A har INGEN samlad rapport — leta inte igen, närmaste källa är minnesfilen `lesson_sjalvmotsagande_instruktion_ger_fabricering` |
| ~~**AKUT-KARUSELL** (a export/publicering, b pensionera gamla vägen)~~ | 9/8 | **LEVERERAD** | N slides → N bilder i export, bibliotek, publicering och schemaläggning. Ny kolumn `studio_scheduled.slide_urls` (migration körd, 201). Gamla `render-carousel` svarar 410 med pekare till Studio. 12 tester. ⚠ Två kvarlevor nedan |
| ~~**AKUT-DM** — suggest-reply genom prompt-core~~ | 9/8 | **LEVERERAD** | Nytt syfte `dm-svar` med dialoganatomi: fullt skydd (sanningskrav, prisregel, perspektiv, röst, förbjudna ord), INGET CTA-golv. 12 tester. ★ Testet avslöjade att skrivreglernas regel 4 motsade dialoganatomin → `WRITING_RULES_DIALOG` |
| ~~Förhandsvisningen kapade karusellens högerkant~~ | 9/8 | **LEVERERAD** | Orsak: pilarnas `px-11` krympte rutan under den hårdkodade `previewScale = 300/w`, `overflow-hidden` kapade mellanskillnaden. Pilarna är överlägg nu, skalan mäts med callback-ref. **Renderingen var hela tiden korrekt** — mätt: rubriken slutar 211 px innanför kanten |
| ~~Text kunde skrivas utanför grafikytan~~ | 9/8 | **LEVERERAD** | Mätt: ett 34-teckens sammansatt ord gick 454 px utanför en 1080-kanvas och klipptes tyst. `overflowWrap` på alla 10 grafikrötter + källtest som fäller en framtida mall som glömmer det |
| ~~Språkreglerna: skenfrågor + hooklöfte~~ | 9/8 | **LEVERERAD** | Håkans fynd i skarp text: "Sommaren dödar skärmar?" (påstående med frågetecken) och en hook vars löfte brödtexten inte infriade. Båda som regel 5 och 6 i lager 8 → **alla 19 prompt-core-flöden**. Skenfrågor har dessutom deterministisk grind (`skenfragor`) i captionvägen. 13 tester |
| Skenfrågegrinden når bara captionvägen | 9/8 | **Ej gjort** | `sakerstallCaption` har den. Veckoplan, karusell, reels, blogg, nyhetsbrev, LinkedIn har bara promptregeln. Full täckning hör till G-2 |
| Karusellexporten i webbläsaren är inte körd skarpt | 9/8 | **Ej gjort** | Publicerings- och fångstkedjan är bevisad med 12 tester, men själva nedladdningen av 7 PNG kräver inloggad Studio i en riktig webbläsare. Kör en 7-slides-karusell och räkna filerna |
| GHL:s media-array med flera bilder är overifierad | 9/8 | **Ej gjort** | `ghlCreateDraft` skickar alla slides som `media[]`. GHL:s Social Planner är INTE provad med fler än en bild. UI:t säger det rakt ut och ber om kontroll i GHL. Instagram direkt är den bevisade karusellvägen |
| **GRANSK G-1 … G-9 + FIX-1-REST (B2+C)** | 9/8 | **Ej startad** | Tvingande ordning: G-1 → G-2 → FIX-1-REST → G-3 → G-4 → G-5 → G-6 → G-7 → G-8 → G-9. Hårt stopp per etapp. Kundleverans går alltid före |
| Madeleines kundnyckel (provisioneringens steg 4) | 8/8 | **Ej gjort** | Går FÖRE allt granskningsarbete enligt Håkans beslut 9/8 |
| ~~Nya leads döljer nedlagda affärer~~ | 3/8 | **LEVERERAD** `ebf006c` | Bevis: commit "Nedlagda affarer slapper tillbaka leadet till Nya leads" + `tests/lobby-nedlagda.test.ts`. Raden stod kvar som "Ej gjort" till STATUS-1 (9/8) |
| ~~Färskhetsrad i offertens kundväljare~~ | 3/8 | **LEVERERAD** `5ce3f05` | Bevis: commit "Aldern pa MySales-datan syns i varje vy som visar den" + `tests/fokus-farskhet.test.ts`. Samma sak: raden var inaktuell |
| ~~Djupgranskningsrapporterna synliga för kund~~ | 7/8 | **LEVERERAD** 9/8 | Håkans beslut: dölj i kundvyn, behåll internt. Server-sidan i `/api/seo/deep-audit` GET (före DB-läsningen), ärligt besked i `/k/seo`. Intern vy `/dashboard/seo` orörd. **Öppnas igen först när hämtvägen är lagad OCH varje gammal rapport granskats en och en** |
| **AKUT-LOGOTYP** — `f.logotyp` når aldrig `hm_brand_profile.logo_url` | 9/8 | **Ej gjort** | Beslut 9/8: före G-1. Drabbar varje ny kund vid första intrycket. Gittes konto rättas retroaktivt |
| **BILD-9 spec** (H-0-mönstret: spec + hårt stopp) | 9/8 | **Ej gjort** | Beslut 9/8: skriv specen, hårt stopp. Ska väga in bildval per slide som byggdes 9/8 |
| PROFIL-2 flyttad upp i kön | 9/8 | **Ej gjort** | Beslut 9/8: direkt efter FIX-1-REST. UI-löfte utan täckning (mätaren ber om berättelser utan yta att skriva dem på) |
