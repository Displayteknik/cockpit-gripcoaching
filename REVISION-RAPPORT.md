# REVISION-RAPPORT — REV-0 (Cockpit kvalitetsrevision)

**Datum:** 2026-07-30
**Omfattning:** Hela `hmmotor-next` — 49 owner-sidor (`app/dashboard`), 17 kundportalsidor (`app/k`), 17 övriga sidor, 227 API-routes, delade komponenter.
**Metod:** Sju parallella read-only-genomgångar (en per sektion 0.1–0.7). Ingen kod har ändrats.
**Allvarsgrader:** KRITISK (bryter användarresa eller exponerar rå teknik för användaren) · STÖRANDE (fungerar men skaver) · KOSMETISK.

## Totalbild i siffror

| Mått | Värde |
|---|---|
| Felytor där fel kan nå användaren | 264 — varav **~193 kategori (c)** (rå API-text) = KRITISK |
| `alert()` i UI | **112** (99 fel, 13 lyckat) · `confirm()`: 30 |
| API-routes som returnerar rått `(e as Error).message` | **132 av 227** |
| Flöden med konsekvens (publicera/skicka/spara/ta bort/synka) | 132 — **59 % saknar kvitto**, bara 5 ger länk till resultatet |
| Destruktiva handlingar UTAN bekräftelsesteg | **13** (KRITISK) |
| `loading.tsx` i hela app-trädet | **0** |
| Vyer utan designat tomt läge | 8 helt tomma + ~24 minimala (en rad grå text) |
| Sidor utan FunctionGuide (där den vore rimlig) | 44 av 67 (6 delade komponenter täcker 12 routes) |
| Terminologi-par som krockar | 17 · Engelska ord i UI: 61 platser · Utvecklarjargong: 57 platser |
| Trasiga å/ä/ö i användarsynlig text | **0** ✅ |
| `error.tsx` / `global-error.tsx` | Finns inte — oväntade renderfel ger Next.js engelska standardskärm |

**Strukturell nyckel till många KRITISK-fynd:** flera `/k`-rutter renderar owner-komponenter rakt av, och `customerMode` är en attrapp i två av dem (`components/LinkedinMaker.tsx:71` och `components/IkigaiMaker.tsx:25` gör `void customerMode`). Det gör att owner-jargong, Cockpit-hero och råa fel ärvs rakt in i kundens portal.

---

# 0.1 Felmeddelande-inventering

## Totalsiffror per kategori

| Kategori | Antal |
|---|---|
| (a) mänskligt språk med nästa steg | ~36 |
| (b) tekniskt men begripligt (svensk generisk text) | ~35 |
| (c) rå API-text/stacktrace/engelska → **KRITISK** | **~193** |
| — varav hård (c): rå `Error.message`, `r.text()`, `r.status`, `JSON.stringify` | 102 |
| — varav villkorlig (c): `d.error`-passthrough med svensk fallback | 91 |

**Grundorsaken i en mening:** 132 API-routes svarar `{ error: (e as Error).message }` (rått Supabase/Gemini/Meta-undantag på engelska) och klienten renderar värdet oöversatt via `alert("Fel: " + d.error)` eller `setError(d.error)`.

## Befintlig felöversättare (BILD-3) — bygg vidare på denna, gör inte om

- `lib/studio/graph-fel.ts` — `oversattGraphFel()` + `valideraIgId/PageId/MetaToken`. 16 handskrivna klartextmeddelanden med åtgärd. Rå JSON når aldrig ut.
- Används av: `lib/instagram.ts:55` (täcker ALL IG-trafik: publicering, karusell, reels, insights, hälsovakt), `components/InstagramConnect.tsx`, `components/TenantIgConnect.tsx`. **Ingen annanstans.**
- `lib/safe-fetch.ts` (`fetchJson`) har 3 bra svenska texter men **prioriterar API:ts råa `error`-sträng före dem** (rad 26–27) och används bara på 3 ställen.
- `valideraPageId` är exporterad men anropas aldrig (död export).
- **Saknas:** generell `felklartext()`, serverregel mot `error: (e as Error).message`, delad toast-komponent (idag 2 ad hoc: `LeadsClient.tsx:556`, `sms-paminnelse:528`), `app/error.tsx`/`global-error.tsx`.

## Kategori (c) — hårda fynd (rå exception direkt till användaren)

**Studio (~60 fynd, värst i absoluta tal):**
- `components/StudioMaker.tsx` — 22 st `setError((e as Error).message)`: rad 374, 415, 438, 483, 504, 560, 577, 592, 615, 678, 714, 748, 836, 915, 937, 953, 966, 981, 1043, 1126, 1184, 1232 → renderas i röd ruta rad 1277.
- `components/studio/ReelSceneMedia.tsx:74, 97, 137, 161` · `app/dashboard/studio/reels/page.tsx:133, 155, 201` · `app/studio/reel-render/page.tsx:53-56` (visar `String(e)`) · `app/dashboard/studio/blogg/page.tsx:141, 203, 220`.
- `components/ImageStudio.tsx` — 8 alerts som prefixar med engelskt motornamn: "Nano Banana:", "Imagen:", "Pexels:", "Upload:", "Carousel:" + rå `d.error` (rad 147, 167, 183, 204, 218, 242, 256).
- Undantag åt rätt håll: publiceringsvägen via `lib/instagram.ts` → `graph-fel.ts` = enda korrekt lösta flödet.

**Kundportalen /k (högst affärsrisk):**
- `app/k/seo/SeoClient.tsx:232` — `alert((e as Error).message)` helt naket. Även `:192`, `:735`.
- `components/CustomerAnalytics.tsx:74` → röd ruta `:86` (rå message, `/k/besokare`).
- Alla övriga /k-sidor ärver felen från delade komponenter: `/k/studio` → StudioMaker (22 råa), `/k/fokus` → FokusClient (6 native alerts), `/k/linkedin` → LinkedinMaker (6 råa + 6 passthrough), `/k/nyhetsbrev` → NewsletterMaker, `/k/ikigai` → IkigaiMaker:66.
- `app/api/customer/ideas/route.ts:11, 29` — engelska `"unauthorized"`/`"not found"` på kundens dataväg.
- `app/k/page.tsx:99` — `catch {}` tyst svälj.

**Supabase `error.message` rakt i alert (engelska Postgres/Storage-fel):**
`app/admin/[[...path]]/page.tsx:92, 105` · `components/LifeIBalansPuckEditor.tsx:55, 63` · `components/DarekSectionEditor.tsx:342, 375` (naket) · `components/dashboard/RichEditor.tsx:58` · `components/puck/fields/ImageField.tsx:48` · `components/profile/KnowledgeBank.tsx:373` · `app/dashboard/blogg/page.tsx:68, 162, 165` · `verk/page.tsx:91, 142, 145` · `utstallningar/page.tsx:68, 90, 93` · `fordon/page.tsx:159, 238, 241` · `sidor/page.tsx:66`.

**Rå HTTP-body/statuskod i UI:**
`components/ClientPicker.tsx:57, 75` · `components/GoogleConnect.tsx:50, 67` · `components/DarekSectionEditor.tsx:161` · `components/DarekPuckEditor.tsx:36, 41, 51` · `app/dashboard/(inlagg)/social/page.tsx:170, 215, 227` · `scheduler/page.tsx:53` · server-sidan: `app/api/google/ga4/properties/route.ts:12` skickar Googles råa felkropp vidare.

**Rå JSON i UI:** `components/DarekSectionEditor.tsx:330` · `app/dashboard/godkannande/page.tsx:101` (`<pre>{JSON.stringify(...)}</pre>`).

**Övriga engelska/råa koder:** `components/LeadsClient.tsx:387` (rå SpeechRecognition-kod) · `components/GoogleConnect.tsx:37` · `sms-paminnelse:52, 182` (rå 46elks-text) · `social/page.tsx:189` ("Direct publish"), `:198` (rå IG-media-id i lyckat-alert) · `app/dashboard/setup/page.tsx:92` (fallback "Okant fel" — utan å) · `app/dashboard/mejl/page.tsx:74` (100 % rå, ingen fallback) · `specialister/page.tsx:51`, `[id]/page.tsx:177, 207` · `granska/[token]/page.tsx:64, 89` (publik kundlänk) · `analysator/page.tsx:40` · `agents:43` · `brand-kit:68, 80, 103` · `fordon-inlagg:73, 106` · `veckoplan:160` · `IkigaiMaker:66` · `IkigaiPublic:36` · `IntakeAgent:280` · `LinkedinMaker:110, 138, 152, 407, 417, 528` · `NewsletterMaker:92` · `SkapaInlaggMaker:177` · `SmartTextarea:106` · `FokusClient:1079` · `WeekGenerator:71` · `ContentToolbox:45` · `AnalyticsDashboard:107, 362, 381` · `lib/markdown-pdf.ts:196`.

**Villkorlig (c) — `d.error`-passthrough med svensk fallback (91 st):** fullständiga fil:rad-listor finns i granskningsunderlaget; koncentrationer i `ImageStudio` (7), `SkapaInlaggMaker` (10), `FokusClient` (5), `LinkedinMaker` (6), `SeoClient` (6), `profil` (4), `seo/page` (5), `ImagePicker` (4), `IntakeAgent` (4), Offert-familjen (7 — dock enda modulen med 100 % svenska fallbacks, **mönstermodul**), m.fl. Blir KRITISK varje gång servern 500:ar eftersom de 132 routarna lägger råtexten i `error`-fältet.

## alert()-förekomster (112 st, 36 filer) — REV-1 ska nolla dessa

Owner: `social` (9) · `blogg` (8) · `seo` (7) · `profil` (5) · `rapport` (4) · `verk`/`utstallningar`/`fordon`/`blogg-maskin` (3 var) · `analytics`/`konkurrenter` (2 var) · `scheduler`/`dm`/`sidor`/`installningar`/`godkannande`/`analysator` (1 var).
Kundportal: `k/seo/SeoClient` (3). Publika: `admin` (3), `granska/[token]` (2).
Komponenter: `ImageStudio` (8) · `SkapaInlaggMaker` (7) · `FokusClient` (6) · `KnowledgeBank` (5) · `GoogleConnect` (4) · `DarekSectionEditor`/`LifeIBalansPuckEditor` (3 var) · `SeoReport`/`PipelineStegRad`/`InstagramConnect`/`ClientPicker` (2 var) · `AnalyticsDashboard`/`RichEditor`/`ImageField`/`CustomerCalendar` (1 var) · `lib/markdown-pdf.ts` (1).
Varav 13 lyckat-alerts (ska bli toast/kvitto, inte modal).

## confirm()-förekomster (30 st, 24 filer)

26 av 30 saknar konsekvensförklaring (bara "Ta bort X?"). Bara 3 säger vad som händer: `kund-access:74`, `sidor:77`, `CustomerCalendar:206`. Två läcker engelska: `IntakeAgent:320` ("committa"), `MetaOwnerConnect:42` ("tenants"). Fullständig lista i sektion 0.4:s tabell 4b.

---

# 0.2 UI-konsekvens

## Grundorsak

Designsystemet `components/ui/dash.tsx` (117 rader) har bara `DashHero`, `LivePill`, `HeroChip`, `StatTile`, `TONES`, `useCountUp`. **Ingen `Button`, `Card`, `Input`, `Badge`, `PageHeader`, `Section`.** Allt annat återuppfinns per sida — därav ~90 % av avvikelserna. 23 av 51 owner-sidor importerar `ui/dash`; **0 av 20 /k-sidor** gör det direkt. `components/ui/Select.tsx` används på exakt 1 ställe.

## KRITISK

1. **Dubbla h1 på alla `(inlagg)`-sidor** — `components/dashboard/PostsTabs.tsx:32` renderar h1 "Inlägg", och varje sida (dm:87, veckoplan:198, analytics:82, scheduler:72, fordon-inlagg:124) renderar sin egen h1 i samma stil. Ser ut som renderingsbugg.
2. **`/dashboard/social` saknar h1 helt och har ingen aktiv flik** — `(inlagg)/social/page.tsx` börjar på h2 (rad 253), saknas i `PostsTabs.tsx:8-15` TABS-lista, men länkas från översikten (`dashboard/page.tsx:96`).
3. **5 /k-rutter visar byråns mörka Cockpit-hero i kundens branded portal** — `/k/profil`, `/k/blogg`, `/k/linkedin`, `/k/ikigai`, `/k/kalender` (via DashHero i delade komponenter). Kunden möter fyra olika sidhuvudsidentiteter i sin "egen" portal. Undergräver white label-premissen.
4. **`hq` och `webbdata-demo` är egna mörka appar** i en ljus produkt, nådda via ordinarie meny (hq bryter ut med negativa marginaler, webbdata-demo har eget aurora-tema + inline-`<style>` och återimplementerar `LivePill` inline).

## STÖRANDE (urval med störst genomslag)

- **Fem konkurrerande primärknapp-konventioner** (brand-blue-token / hårdkodad Tailwind-färg / gray-900 / gradient / klientfärg via style). Sju sidor har **två primärfärger i samma vy**: `seo` (3 färger!), `blogg`, `kund-access`, `paket`, `specialister/[id]`, `setup/onboard`, `studio/reels`. Full fil:rad-tabell i granskningsunderlaget.
- **Destruktiv-knappen har 4 olika utseenden** — solid röd (verk/fordon/blogg/utstallningar), rose-ikonknapp, röd-ikonknapp, röd textlänk.
- **31 formulärfält helt utan focus-stil** (verk 12, utstallningar 9, seo 4, konkurrenter 4, scheduler 2) + **elva olika focus-färger** över produkten.
- **Tre kortkonventioner** (gray-100/rounded-2xl vs gray-200/rounded-xl vs gray-200/rounded-lg) som växlar mellan grannsidor i menyn; 6 nästan identiska lokala `inputCls`/`card`-konstanter copy-pastade (StudioMaker har två olika i samma fil: rad 1193 och 2690).
- **Innehållsbredden hoppar** mellan `max-w-2xl` och `max-w-7xl` och mellan vänsterställd/centrerad per sida; `brand-kit` och `studio/blogg` bygger egen page-shell inuti layouten (dubbel padding + dubbel bakgrund).
- **Chrome-färgen spretar:** sidomeny indigo/violett (`layout.tsx:157, 202`), flikar brand-blue (`PostsTabs.tsx:41`), DashHero-default indigo — tre "produktfärger" i samma chrome.
- **h2 i fyra storlekar + två typsnitt** (7 st i `font-semibold` utan `font-display`: agents, mejl, hq, onboard, studio/reels).
- Färg-token-kapning i `(inlagg)/dm/page.tsx:79-82` och `profil/page.tsx:64` (skriver över Tailwinds purple-variabler inline) — fungerar men är osynlig teknisk skuld.
- Hårdkodade färger i /k-delade komponenter: `LinkedinMaker` bg-blue-600 ×9 (kundens färg ignoreras), `SkapaInlaggMaker` 10 olika färger i en fil, `IkigaiMaker` emerald, `CustomerAnalytics` gray-900/indigo/violet.

## KOSMETISK

Motstridiga färgklasser i samma h3 (`brand-kit:414` — `text-gray-900` OCH `text-gray-500`), gradient-infokort utan system, 4 fältstorlekar, spretig h3-stil, radiefördelning 421×lg/175×xl/75×2xl, rotavstånd space-y-6/8 blandat.

## Ej migrerade sidor (sorterat efter hur illa)

KRITISK: `hq` (530 rader eget mörkt tema) · `webbdata-demo` (756 rader) · `(inlagg)/social`.
STÖRANDE: `(inlagg)/dm` · `verk` · `utstallningar` · `blogg` · `haydays` · `setup/onboard` · `(inlagg)/analytics` · `installningar` · `blogg-maskin` · `specialister/[id]` (listsida har DashHero, detaljsida naken — brott mitt i flöde) · `(inlagg)/veckoplan` · delvis migrerade: seo, paket, kund-access, studio/reels, agents, mejl, brand-kit, studio/blogg, profil, analysator, sms-paminnelse.
KOSMETISK: setup, scheduler, fordon-inlagg, handbok, nyhetsbrev + tunna wrappers.
Positivt föredöme: `CustomerChrome`/`CustomerNav` är genomgående korrekt tokeniserade.

---

# 0.3 Tomma lägen och laddningstillstånd

## Systemfynd

- **0 st `loading.tsx` i hela `app/`** → varje serverrenderad route (särskilt hela /k-trädet med `requireCustomerFeature()` + Supabase-anrop i page-funktionen) blockerar navigeringen utan feedback. `/k`-startsidan gör 6 DB-queries + `buildDashboardData()` innan något syns. **KRITISK.**
- Endast 3 `Suspense`-fallbacks totalt (seo:67, onboard:377, specialister/[id]:83 — alla "Laddar...").
- Ingen skeleton/`animate-pulse` som laddningsmönster någonstans; mönstret är `Loader2`-spinner eller text.

## KRITISK

1. **`/k/kalender` (och `/dashboard/studio/kalender`)** — standardvyn är kalendern och `components/content-compass/ContentCalendar.tsx` saknar tom-läge-gren helt: tom kund ser ett blankt 42-cellsrutnät utan ett enda ord. Ser trasigt ut, på en av kundens mest använda sidor.
2. **Avsaknad av `loading.tsx` för /k-trädet** (ovan).

## STÖRANDE

- `(inlagg)/scheduler` — tomt konto = fyra nollställda stat-kort och sedan ingenting (alla sektioner `length > 0 &&`-dolda, rad 105).
- `studio/reels:515` och `NewsletterMaker:266` — sektionerna "Sparade reels"/"Sparade utkast" är villkorsdolda; användaren får aldrig veta att funktionen finns. Samma i `mejl/page.tsx:153`.
- `profil` (delas till `/k/profil`) — 736-raders formulär fylls från `/api/profile` utan indikator; risk att användaren skriver i fält som skrivs över när fetchen landar.
- `/k/seo` och `studio/kalender` — `reload()` utan loading-flagga → tomma läget **blinkar förbi** ("du har ingenting") innan data kommer. Samma mönster i `konkurrenter`.
- `LeadsClient` `TomRuta` (rad 576) har rubrik+text men ingen CTA-knapp. `/k/fokus` kopplad-men-tom = nästan blank sida (allt villkorsdolt utom en grå rad, 340–342).
- `dashboard/hq` sökning utan träff → tom yta (rad 319).

## KOSMETISK

~24 MINIMALA tomma lägen (en rad grå text utan ikon/rubrik/nästa steg): seo:737, godkannande:74, rapport:144, sidor:252, innehall:122, blogg:464, social:400, analytics:244, agents:100/140, m.fl. Full per-sida-tabell i granskningsunderlaget.

## Förebilder att kopiera

`components/CustomerAnalytics.tsx:138-172` (två distinkta tomma lägen) · `(inlagg)/dm/page.tsx:195-205` (ikon+rubrik+förklaring+pekare) · `app/k/ej-i-paket/page.tsx` (ikon, rubrik, förklaring, två CTA) · `LeadsClient TomRuta` (återanvändbar, behöver CTA-prop).

---

# 0.4 Kvitton och bekräftelser

## Totalbild (132 kartlagda flöden)

| Kvitto | Antal | Andel |
|---|---|---|
| JA (tydligt, kvarstående) | 24 | 18 % |
| DELVIS (transient knapptext ≤3 s eller "listan uppdaterades") | 30 | 23 % |
| **NEJ** | **78** | **59 %** |

Länk/referens till resultatet: **5 av 132** (Studio-IG permalink, Veckoplan→kalendern, Leads-synk→MySales, Dela för granskning, Godkännande kopiera länk).
Allvar: **17 KRITISK**, 47 STÖRANDE, 68 OK/OK-svag.

## Referensmönster i kodbasen (följ dessa, bygg inte nytt)

1. **Studio-IG-kvittot (BILD-3)** — `StudioMaker.tsx:1130→1176-1180`, render `:2427-2445`: grön panel, "Publicerat på Instagram", tid·klient·format, "Öppna inlägget"-länk (permalink via `app/api/studio/publish/route.ts:53-66`), ligger kvar tills användaren stänger. **Enda flödet med länk till publicerat resultat.**
2. **SMS-utskicket** — `sms-paminnelse:501-524` (egen bekräftelsemodal med antal/kostnad/DRYRUN) + resultattabell per mottagare `:465-500`. Referens för SKICKA.
3. **Bytbil-synken** — `fordon/page.tsx:83-124`: dry-run → informerad confirm med exakta siffror → kvitto "Klart — X nya, Y uppdaterade…". Referens för SYNKA.
4. **Veckoplan Spara alla 7** — `veckoplan:314-327`: panel med antal, datumintervall, delvis-fel-text, länk "Öppna kalendern". Referens för batch-SPARA.
5. **Leads inline-radera** — `LeadsClient.tsx:939-948`: två-stegs inline-bekräftelse (inte native confirm) + rollback vid fel. Referens för TA BORT.

## De 17 KRITISKA

**Publicering utan kvitto (4):**
1. `components/SkapaInlaggMaker.tsx:1310` — IG-publicering, kvitto = knapptext som försvinner efter 3 s.
2. `app/dashboard/blogg/page.tsx:161/164` — bloggpublicering, inget kvitto alls.
3. `app/dashboard/blogg/page.tsx:179` — av-/publicera-toggle (publik konsekvens), ingen bekräftelse före, inget kvitto efter.
4. `app/dashboard/sidor/page.tsx:82` — av-/publicera sida, dito.

**Destruktivt utan bekräftelsesteg (13):**
5. `StudioMaker.tsx:456` — radera bild ur mediabibliotek (fel sväljs dessutom med `catch {}`).
6. `StudioMaker.tsx:869` — radera sparat Studio-inlägg (fel sväljs).
7. `StudioMaker.tsx:921` — koppla från GHL (raderar klientens PIT-token; IG/Meta/Google har confirm, GHL har inte).
8. `components/studio/ScheduleQueue.tsx:51` — avboka schemalagt inlägg (fel sväljs).
9. `(inlagg)/dm/page.tsx:150` — radera DM-kontakt, optimistiskt UTAN rollback och utan felhantering.
10. `(inlagg)/dm/page.tsx:597` — radera auto-svarsregel.
11. `NewsletterMaker.tsx:119` — radera nyhetsbrevsutkast (fel sväljs).
12. `paket/page.tsx:242` — rotera kundens inloggningstoken (kundens länk dör direkt; `kund-access:74` HAR confirm för exakt samma handling).
13. `paket/page.tsx:155` — dra tillbaka modul från kund (kundens portal ändras direkt).
(+ nr 3 och 4 räknas även här.)

## STÖRANDE (47 st — mönster)

- **`setTimeout(1500–3000)` som kvitto är utbrett:** brand-kit:67, StudioMaker:849, SkapaInlagg:737, veckoplan:395, kund-access:56 — tittar man bort missar man kvittot.
- **Publicering till GHL/FB/LI får aldrig länk** — `publishTo` sätter kvitto endast för `k === "ig" && status === "published"` (`StudioMaker.tsx:1178`); GHL-svarets post-id visas aldrig. Schemaläggning ger bara knapptext.
- Tysta spara-flöden (fält töms/modal stängs, ingen text): KnowledgeBank (3 flöden), OffertSkapa/Katalog, SEO lägg-till-sökord (owner+kund), konkurrenter, LinkedinMaker (pelare/uppdatera), DM (anteckning/kontakt), fordon/verk/utstallningar, WeekGenerator auto-spar, Fokus (planera/klar/värde), PipelineStegRad (flyttar affär i GHL!), scheduler, blogg-maskin, agents/ideer godkänn, paket ge modul, IG/GHL/Google-anslutningar utan kvitto vid lyckat, DM→GHL-synk, AnalyticsDashboard GSC-synk, `paket:229` bjud in användare (länken visas inte).
- Native `confirm()` i 22 flöden vs inline i 2 vs modal i 1 — inkonsekvent, och 26/30 confirm-texter saknar konsekvensbeskrivning.

Fullständig flödestabell (132 rader med fil:rad, kvitto ja/nej/delvis, länk, allvar) finns i granskningsunderlaget; alla KRITISK är listade ovan.

---

# 0.5 FunctionGuide-täckning

## Läget

`components/FunctionGuide.tsx` — client-komponent, props `{title, what, how, tips?, primaryColor?}`, bok-ikon → modal med "Vad det gör / Så funkar det / Tips". Två placeringsmönster: inline bredvid h1 (vanligast) eller via `DashHero right=`.

**Har guide (11 routes, 8 källfiler):** /dashboard/studio + /k/studio (StudioMaker:1252), /dashboard/leads (LeadsClient:444), /dashboard/fokus + /k/fokus (FokusClient:171), /dashboard/linkedin + /k/linkedin (LinkedinMaker:195), /dashboard/innehall (:106), /dashboard/mejl (:85), /k (start, :170), /k/seo (SeoClient — 5 guider per delfunktion, bäst i produkten).

**Avvikelser:** `/dashboard/seo` saknar guide trots att kundvyn `/k/seo` har fem. `/dashboard/dm` får ingen guide (den sitter i FokusClients default-export, inte i CoachPanel). `docs/FABLE5-HANDOFF.md:15` påstår att "Kalender" fick guide — den sitter på `/dashboard/innehall`, inte på `/dashboard/studio/kalender`.

## Saknas — prioritetsordning (44 sidor)

**Prio 1 (dagligt/veckovis):** /dashboard (översikt) · studio/kalender + /k/kalender · veckoplan (+/k) · studio/blogg (+/k/blogg) · nyhetsbrev (+/k, via NewsletterMaker) · /dashboard/seo · profil (+/k) · social · scheduler.
**Prio 2:** agents/Idé-bank · /k/ideer · godkannande · rapport · dm (+/k) · analytics · /k/besokare · /k/offert · brand-kit · konkurrenter · analysator · blogg-arkiv · content-compass · ikigai (+/k) · blogg-maskin · sidor · specialister.
**Prio 3:** specialister/[id] · sms-paminnelse · studio/reels · fordon · fordon-inlagg · verk · utstallningar · haydays · mysales-kunder · webbdata-demo · hq.

**Störst utväxling:** sex edits i delade komponenter (veckoplan, studio/blogg, profil, NewsletterMaker, IkigaiMaker, dm) täcker **tolv routes**.

**Behövs ej (11):** 3 redirects (skapa, seo-aeo, /k/skapa), 6 admin-verktyg (installningar, installningar/meta, setup, setup/onboard, kund-access, paket), 2 självförklarande (handbok, /k/ej-i-paket).

---

# 0.6 Namngivning och språk i UI

**Totalsiffror:** 17 terminologi-par (8 KRITISK) · 61 engelska ord-platser (31 KRITISK) · 57 jargong-platser (24 KRITISK) · **0 trasiga å/ä/ö** ✅ (fullt kontrollerat: mojibake + 70 ASCII-mönster, allt rent; ASCII endast i route-slugs som aldrig syns).

## KRITISK (kundsynligt)

**Terminologi:**
- Rådgivare/konsult/byrå — tre ord för samma person: `k/ej-i-paket:38,46` vs `k-utloggad:16` vs `StudioMaker:2490`.
- Postat vs Publicerat: `LinkedinMaker:47,617` vs `CustomerCalendar:16`, `ScheduleQueue:25`, `k/page:343`.
- Idé/Utkast/Förslag — tre ord för samma sak, delvis i samma komponent: `k/ideer/IdeasList.tsx:70` ("förslag"+"idéer"), `:74` ("utkast"), `lib/customer-features.ts:88`.
- "Klienten" i kundens egen portal (kunden läser om sig själv i tredje person): `LinkedinMaker:254, 535` · `IkigaiMaker:123` · `StudioMaker:2433` (publiceringskvittot!).
- Menyetikett ≠ sidrubrik: "Sök-synlighet" vs "Din SEO & AEO" vs "Sid-analys" · "Statistik" vs "Din trafik" · menyn "Skapa inlägg" men UI säger "Öppna i Studio".
- Fem namn för planering: Kalender/Veckoplan/Content Compass/Innehållskalender/Navet (`customer-features.ts:92,99,102`, `layout.tsx:52,55`).
- Funnel-etiketter krockar PÅ SAMMA SIDA `/k/kalender`: `labels.ts` ("Väck intresse/Bygg förtroende/Dags att sälja") vs `BalanceMeter.tsx:13` ("TOFU (toppen)/MOFU/BOFU") — båda renderas via CustomerCalendar.

**Engelska/jargong hos kund (urval av 55):**
- **Värst:** `k/seo/SeoClient.tsx:455` renderar råa fältnamn från `lib/seo-audit.ts` — kunden ser **"fetch: HTTP 500"**, **"meta_description: Saknar meta description"**, "og", "content_depth", "internal_links".
- `LinkedinMaker` (inget döljs för kund): `<option>Poll</option>` (:559), råa badge-värden `{post.format}`/`{post.length}`/`{post.trust_gate}` → "carousel", "short", "KNOW/LIKE/TRUST" (:589-591, 306-307), "Post-bank", "hooks", "Hashtags", **stavfelet "bankenban"** (:298).
- `veckoplan` (via /k): rubrikerna **Hook/Body/CTA/Hashtags** rakt av (:471, 483, 494, 505). Samma i publika granskningslänken `granska/[token]:149-200` (Hook (3 sek)/Slides/Hashtags/CTA).
- `profil` (via /k): "Tagline", "Brand story", "Ton-wizard", "Hashtag-bas".
- `StudioMaker`: "on-brand", "slide", "cover", "story" (:1847-1893) · `SeoClient`: "Title/Meta-desc/Schema/OG-taggar", "trackern" (5 ställen) · `CustomerAnalytics`: "CTR", "pixeln" (3 ställen) · `k/page:344`: "Kunder i pipeline", "DM-pipeline" · `FokusClient:475`: "morgondagens pipeline" · DISC-tooltips på engelska ("Influence — social proof") via `content-framework.ts:99-104` → `badges.tsx` · `customer-features.ts`: "DM & Pipeline", "Brand-profil", "Lead-magnet", "on-brand" · `NewsletterMaker:198`: "(preheader)" · `IkigaiMaker:123`: "MVP-erbjudande" · `WeekGenerator:136`: "CRM" · `StudioMaker:2098-2103`: "funnel, 4A och DISC", "Auto-klassa", "färsk render" · `StudioMaker:2490`: "be din byrå koppla den".

## STÖRANDE (owner-UI, urval av 63)

GHL-jargong i Studio-anslutningen ("Private Integration-token", "Location-id", "scope") · handbok/installningar exponerar "Cron", "env-vars", "Supabase anon-key", "deploy" · `mejl:133`: "winning examples … i client_assets med category=\"winning_example\"" · `mysales-kunder:192`: råa tabellnamn i UI · `agents:100`: "`iterate: true`" · hq: "Deploy", "Embed", "White-label GHL" · "tenant" i `paket:251` · Ideal Customer Profile, snitt-score, Manuell trigger, `<th>Status</th>` ×6, "Search Console → Performance → Export" m.fl.

**Mindre:** Ta bort/Radera/Skippa/Avvisa/Dra bort (5 varianter) · "Ny lead" vs "Nytt lead" i samma fil (`LeadsClient:53` vs `:469`) · Bildtext vs Caption · Kanal vs Plattform i samma sektion (`StudioMaker:2266` vs `:2270`) · "Publicerad" vs "Publicerat" i samma fil (`innehall:17,24`) · `Laddar...` vs `Laddar…` (10 vs 7 filer).

**Föredöme:** `lib/content-compass/labels.ts` gör exakt rätt (klarspråk i UI, fackterm i tooltip) — men `BalanceMeter` och `content-framework.ts` kringgår den.

**Bifynd:** `components/SkapaInlaggMaker.tsx` (1300+ rader) har **noll importörer** — båda skapa-sidorna är redirects. Död kod som ändå dyker upp i 0.1/0.4-fynden; fälla vid framtida återanvändning.

---

# 0.7 Prompt-arkitekturen (kartläggning — underlag för blindtest, inget ändrat)

## Två parallella AI-stackar som inte delar promptbygge

| Stack | Motor | Central funktion | Röstkälla |
|---|---|---|---|
| A — Gemini | `lib/gemini.ts` | `generate()`/`generateJSON()` | brand-profil (`getProfileAsMarkdown`); fingerprint bara i vissa routes |
| B — Anthropic | `lib/iterate.ts` | `iterateGenerate()` | `getVoiceFingerprint()` + winning examples |

## Röstprofilens källor (fyra separata)

`client_voice_profile` (fingerprint-cache, 24 h, `lib/voice-fingerprint.ts:29-51`) · `client_assets` (råmaterial + winning examples via `lib/voice-score.ts:157-171`) · `hm_brand_profile` + `customer_voice` (`lib/knowledge.ts:43+` — prependas automatiskt i `getKnowledge()`) · `studio_brand_kits.kit` (grafisk profil/donts, `lib/studio/kit.ts:29-59`). Per-tenant-flaggan `clients.writing_rules_enabled` styr **bara saneringen**, inte prompt-invävningen (`writing-rules.ts:125-138` vs `gemini.ts:38-43`).

## Tre strukturella hål (förklarar troligen generisk output i blindtestet)

1. **Anatomilagret försvinner utan Compass.** `POST_ANATOMY` (hook/story/nytta/exakt en CTA, `lib/content-compass/prompt.ts:15-20`) sätts bara ihop i `contentCompassBlock()`, som **returnerar tom sträng** (rad 64) om varken funnel, 4A eller DISC är satt. Utan Compass-parametrar finns inget anatomilager alls — enda CTA-regeln som återstår är skrivreglernas punkt 4.
2. **Stack B kör alltid utan lager 2–5.** `lib/iterate.ts:22` deklarerar `contentCompass?` och rad 76 väver in det — men **ingen av de tre anroparna sätter det någonsin** (`lib/studio/copy.ts:135`, `specialist/[id]/run:63`, `agents/night-iterate:92`). Studio-textförslag + alla specialister saknar anatomi/funnel/4A/DISC.
3. **`generateJSON()` stänger av skrivreglerna** (`lib/gemini.ts:174` sätter `skrivregler: false`). LinkedIn draft/ideas, social/generate, nyhetsbrev-utan-compass och build-image-prompt får aldrig `WRITING_RULES_BLOCK` — inklusive "exakt EN uppmaning".

## Flöde × lager (sammandrag; full tabell med fil:rad i granskningsunderlaget)

| Flöde | Röst-fingerprint | Brand-profil | Skrivregler | Anatomi | Funnel/4A/DISC | Grafisk profil |
|---|---|---|---|---|---|---|
| Studio: text på bild (`copy.ts`) | MED | MED | MED | **SAKNAS** | **SAKNAS** | endast donts |
| Studio: caption | **SAKNAS** | MED | MED | villkorat (Compass-modul) | villkorat | endast donts |
| Studio: karusell / adapt-channel | **SAKNAS** | MED | MED/villkorat | villkorat | villkorat | endast donts |
| Veckoplan klassisk | MED | MED | MED | **SAKNAS** | globala WEEK_ROLES | — |
| Kalender/Compass-vecka | MED | MED | MED | **MED** | tenantens schema | — |
| Enskilt inlägg (`generate/post`) | MED | MED | MED | SAKNAS (Kane-hooks) | MED | — |
| Social generate | MED | MED | **SAKNAS** | **SAKNAS** | **SAKNAS** | — |
| LinkedIn draft/ideas | **SAKNAS** | MED | **SAKNAS** | **SAKNAS** | **SAKNAS** | — |
| Blogg (Studio) | **SAKNAS** | MED | MED | SAKNAS | SAKNAS | endast donts |
| Nyhetsbrev | **SAKNAS** | MED | villkorat | villkorat | villkorat | endast donts |
| Reels-manus | SAKNAS | MED | MED | **MED** | **MED** | negative+donts |
| Specialister (Stack B) | MED | SAKNAS direkt | MED | SAKNAS | SAKNAS | — |

Reels-manus är flödet där flest lager är korrekt invävda; Compass-veckan är näst bäst. LinkedIn är svagast (varken fingerprint, skrivregler, anatomi eller sanering — voice-score räknas bara i efterhand).

## Bildgenerering — två stackar som inte känner till varandra

- **`lib/studio/kit.ts`** (`getKitDirectives` + `imageDirectiveSuffix`, signatur väger tyngst, stil avgränsad till färg/ljus): **MED** i Bildhjälpen AI-bild, text-i-bild, Reels-AI-bild, Studio-bloggomslag.
- **SAKNAS** grafisk profil i: Pexels-stock (båda vägarna), **bildredigering `edit-image`** (bara instruktion+basbild), social-bild (`lib/images.ts` — `brandContext` skickas inte ens), nano-banana (minimal egen kontext), build-image-prompt, äldre bloggomslag (har brandContext men inte kit).
- `lib/images.ts` (bransch-regler + feedback-loop) och `lib/studio/kit.ts` är två oberoende stackar; `clients/<slug>/brand.json` når ingen av dem (läses bara för rendering-tokens).

---

# TOPP 10 — mest kvalitetslyft per insats

1. **Central felöversättare + stopp för `error: (e as Error).message`** (REV-1). Generalisera BILD-3-mönstret (`graph-fel.ts`) till `felklartext()` för Supabase/Gemini/Google/46elks/GHL/nätverk, fixa `safe-fetch.ts` så svensk text vinner över rå API-sträng, + `app/error.tsx`/`global-error.tsx`. Dödar ~193 KRITISK-fynd i ett mönster.
2. **Delad toast/inline-felkomponent, noll `alert()`** (REV-1). LeadsClient-toasten finns redan som förlaga; 112 alerts ersätts.
3. **Dubbla h1 + `/dashboard/social`** (REV-3). En edit i `PostsTabs.tsx` fixar 5 sidor; social får h1 + flik. Billigaste KRITISK-fixen i rapporten.
4. **Kundportalens identitet** (REV-3). Gör `customerMode` verklig i LinkedinMaker/IkigaiMaker, ersätt Cockpit-hero med kundfärgad header på de 5 /k-rutterna. Räddar white label-premissen.
5. **`loading.tsx` för /k-trädet + tom-läge i kalendern** (REV-3). Två fynd som gör att kundens portal känns död/trasig idag.
6. **Kvitto-komponent enligt Studio-IG-mönstret** (REV-2) på de 4 publiceringarna utan kvitto + länk även för GHL/schemaläggning; **bekräftelsesteg på de 13 destruktiva** (Leads-inline-mönstret som standard) + sluta svälja fel med `catch {}`.
7. **Delad TomRuta med CTA-prop** (REV-3). Täcker 8 SAKNAS + lyfter 24 minimala tomma lägen med ett mönster.
8. **`SeoClient.tsx:455` fältnamns-rendering** (REV-4, kan tas i REV-1). Liten fix — kunden ser idag "fetch: HTTP 500" och "meta_description: …".
9. **FunctionGuide på 6 delade komponenter** (REV-4) → 12 routes täckta med sex edits; därefter prio 1-listan.
10. **Ordlista (`lib/terminologi`) + de 8 kritiska termparen** (REV-4): rådgivare-ordet, Postat→Publicerat, idé/utkast/förslag, "klienten"-texterna i /k, funnel-etiketterna på /k/kalender, Hook/Body/CTA→svenska rubriker, + stavfelet "bankenban".

---

# Förslag: fördelning över REV-1 till REV-4

## REV-1 — Felhantering till mänskligt språk (0.1)
- `lib/felklartext.ts` (generalisering av `graph-fel.ts`-mönstret): rubrik + vad hände + vad du kan göra; teknisk detalj till `console.error`/hopfällbar, aldrig i rutan.
- API-sidan: ersätt `error: (e as Error).message` i de 132 routarna med koder/klartext (serverloggen behåller råfelet). Fixa `ga4/properties:12` och `lobby/*` `String(e)`-läckor. `customer/ideas` engelska svar.
- Klient: delad toast + inline-felruta (utgå från LeadsClient), ersätt samtliga 99 fel-alerts och alla `setError(rå)`-ställen; 13 lyckat-alerts blir enkel toast (uppgraderas till kvitto i REV-2). Fixa `safe-fetch.ts`-prioriteringen och använd den brett.
- `app/error.tsx` + `global-error.tsx` på svenska. Ta även `SeoClient:455`-fältnamnen här (är ett felpresentationsfynd).
- DoD: noll `alert()`, noll rå API-text kan nå användaren.

## REV-2 — Kvitton och bekräftelser (0.4)
- Delad kvittokomponent enligt Studio-IG-mönstret (persistent panel, tid, vad, länk). Sätt in på: SkapaInlaggMaker-publicering, blogg-publicering/-toggle, sidor-toggle, GHL/FB/LI-publicering (visa post-id/planner-länk), schemaläggning, nyhetsbrev/rapport-utskick, anslutningar (IG/GHL/Google), synk-flöden, inbjudan (visa länken), tysta spara-flöden.
- Delad bekräftelsedialog (inline-mönstret från LeadsClient) på de 13 destruktiva utan skydd; ersätt native `confirm()` successivt och ge alla konsekvenstext. Ta bort `catch {}`-sväljningarna i radera-flöden, ge DM-radering rollback.
- Ersätt `setTimeout`-kvittona med persistenta.
- DoD: alla publiceringar ger kvitto; ingen destruktiv handling utan bekräftelsesteg.

## REV-3 — Tomma lägen, laddning och UI-konsekvens (0.2 + 0.3)
- Bygg ut designsystemet: `Button` (primär/sekundär/destruktiv), `Card`, `Input/Textarea/Label`, `Badge`, `PageHeader` (ljus), `EmptyState` (TomRuta + CTA), `Skeleton`. Detta är förutsättningen för resten.
- KRITISK först: PostsTabs-h1, social-sidan, /k-hero-identiteten (customerMode på riktigt), kalenderns tomma rutnät, `loading.tsx` för /k (+ dashboard-roten).
- Sedan enligt "ej migrerade"-listan: knappfärger→token, focus-stilar (31 fält), kortkonvention, bredd/centrering, chrome-färgen (indigo vs brand-blue — välj en).
- `hq`/`webbdata-demo`: beslut behövs (egna verktyg — flytta ut ur ordinarie meny eller migrera; se Öppna frågor).
- DoD: varje tomt läge svarar på vad/varför/vad gör jag härnäst.

## REV-4 — FunctionGuide och språkstädning (0.5 + 0.6)
- FunctionGuide: de 6 delade komponenterna först (12 routes), sedan prio 1-listan, sedan prio 2.
- `lib/terminologi.ts` — en källa för: Publicerat, Utkast, Idé, Ta bort, kund (aldrig "klient" i /k), rådgivare-ordet (Håkan väljer term), Kalender/Veckoplan-namnen, statusetiketter, "Laddar…". Utbred `labels.ts`-mönstret (klarspråk + fackterm i tooltip) till BalanceMeter, DISC-tooltips, LinkedIn-badges, Hook/Body/CTA-rubriker.
- Städa engelska/jargong enligt 0.6-listorna (kundsynligt först: SeoClient, LinkedinMaker, veckoplan, profil, granska-länken). Fixa "bankenban".
- Ta bort död kod `SkapaInlaggMaker.tsx`? → se Öppna frågor (den har KRITISK-fynd i 0.4 som annars måste fixas i död kod).

**0.7 ingår inte i någon REV-etapp** — den är underlag för Håkans blindtest (bilaga B/C). Beslut om promptlager-ändringar (koppla contentCompass i Stack B, skrivregler i generateJSON-flöden, grafisk profil i edit-image/social-bild) tas per profil EFTER blindtestet, som egen beställning.

---

# Parkerat (funktionsidéer — inget byggs i REVISION-1)

1. Koppla `contentCompass` i `lib/iterate.ts` så Stack B (Studio-text + specialister) får anatomi/funnel/4A/DISC — ändrar genereringsbeteende, vänta på blindtestresultat.
2. Skrivregler i `generateJSON`-flöden (LinkedIn, social, nyhetsbrev) — samma sak, blindtest först.
3. Grafisk profil i bildredigering (`edit-image`), social-bild och nano-banana; ena de två bildstackarna (`lib/images.ts` × `lib/studio/kit.ts`).
4. Voice-fingerprint i LinkedIn/blogg/nyhetsbrev (saknas idag helt).
5. Nyhetsbrev massutskick (redan känd v2).
6. Skeleton-laddning som generell standard (utöver REV-3:s loading.tsx).
7. FunctionGuide med "sett"-minne (visa pulse för nya användare tills öppnad).
8. `components/ui/Select` utrullning överallt (OS-pilen syns idag) — kosmetiskt, kan tas om REV-3 får tid.
9. Ta bort/arkivera `webbdata-demo` ur ordinarie meny (demo-/säljyta).
10. `valideraPageId` används aldrig — antingen koppla in eller ta bort (mikrostäd i REV-1).

# Öppna frågor till Håkan — BESVARADE 2026-07-31

**Håkans svar (gäller vid REV-1..4):**
1. **Kunden ska se ordet "rådgivare"** — genomgående, ersätt konsult/byrå i kundsynlig text (REV-4).
2. **`hq` och `webbdata-demo` flyttas ut ur ordinarie menyn**, bakom admin-flagga (REV-3).
3. **`SkapaInlaggMaker.tsx` tas bort** — verifiera FÖRST med grep att inget importerar den dynamiskt (`import(`, strängbaserade sökvägar), sedan radera. Dess KRITISK-fynd i 0.4 försvinner därmed (REV-1).

# Öppna frågor till Håkan (max 3)

1. **Rådgivare/konsult/byrå** — vilket ord ska kunden se? *(Om du inte vet: "din rådgivare" — mjukast och stämmer med coach-rollen.)*
2. **`hq` + `webbdata-demo`** — flytta ut ur ordinarie meny (bakom admin-flagga) eller full migrering till designsystemet i REV-3? *(Om du inte vet: flytta ut — billigare, de är dina egna verktyg.)*
3. **Död kod `SkapaInlaggMaker.tsx`** (1300 rader, noll importörer, flera KRITISK-fynd) — ta bort i REV-1 i stället för att laga? *(Om du inte vet: ta bort — fynden försvinner med filen; git har historiken.)*
