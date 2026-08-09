# STATUS — totalinventering av alla spår

> **LEVANDE REGEL:** Denna fil uppdateras i slutet av VARJE session som en del av handoff.
> En beställning utan rad här existerar inte. Statusnivån KLART OCH VERIFIERAT får bara
> sättas med bevis.

**Körd:** 2026-08-09 (STATUS-1). **Metod:** HANDOFF.md, docs/ (inkl. G0-RAPPORT och
lessons), git-loggen (40 commits), grep efter TODO/FIXME, projektminnet, och koden som
facit. Statusnivåer: `KLART OCH VERIFIERAT` · `KLART, EJ VERIFIERAT` · `PÅBÖRJAT` ·
`BESTÄLLT, EJ PÅBÖRJAT` · `PARKERAT`.

---

## SAMMANFATTNING

| Nivå | Antal |
|---|---|
| KLART OCH VERIFIERAT | 34 |
| KLART, EJ VERIFIERAT | 12 |
| PÅBÖRJAT | 6 |
| BESTÄLLT, EJ PÅBÖRJAT | 26 |
| PARKERAT | 8 |
| **Totalt** | **86** |

*Uppdaterad 9/8 efter Håkans STATUS-1-beslut: rapporterna dolda, två felmarkerade rader rättade.*

### Topp 5 kundsynliga brister, efter risk

> ~~1. Sju djupgranskningsrapporter synliga för kund~~ — **ÅTGÄRDAD 9/8.** Dolda i kundvyn
> server-sidan, behållna internt. Var listans etta; strykningen är hela poängen med filen.

1. **HM Motors varumärkesprofil i databasen är fel innehåll** (coaching, inte bilhandel).
   Koden är lagad, datat inte. Varje text som genereras för tenanten bygger på fel profil.
2. **Provisioneringen tappar kundens logotyp.** `f.logotyp` hittas i analysen men skrivs
   ingenstans. Drabbar varje ny kund vid första intrycket. *Beslut 9/8: akutfix före G-1.*
3. **Gitte saknar logotyp** — noll rader i `studio_brand_kits`. Logga-reglaget gör
   ingenting för henne, all grafik ritar företagsnamnet som vit text. Väntar på filen.
4. **SEO-verktyget rapporterade nollor som mätvärden** och gick ut till kund. S-1+S-2 är
   lagade; S-3..S-5 återstår, och rapporterna som redan gått ut är inte återkallade.
> ~~5. Profilmätaren ber om kundberättelser utan att erbjuda en yta att skriva dem på~~ —
> **ÅTGÄRDAD 9/8 (PROFIL-2).** Ytan finns, och mätaren räknar manuellt material (den
> gjorde inte det heller — den läste bara intake-flödet).

### Topp 3 KLART, EJ VERIFIERAT — billigast att verifiera

1. ~~**Karusellexporten**~~ — **KÖRD 9/8 lokalt, grön.** `node scripts/karusell-dod.mjs`
   bygger 7 slides, exporterar och räknar filerna automatiskt (21 kontroller). Kvar: en
   körning mot live, som kräver produktionens `ADMIN_SESSION_SECRET`:
   `ADMIN_SESSION_SECRET=<prod> node scripts/karusell-dod.mjs`
2. **FIX-1 grupp A + B1** (~20 min): tre promptfel som ingen mätt efter fixen. Kör två
   genereringar per tenant på ämnen som lockar fram kundberättelser och läs efter minnen
   som inte finns i profilen.
3. **BILD-1..3 i skarp tenant** (~15 min): står som obekräftade i STEG 7 sedan 2/8.
   Bildredigering, kvitto och länk i en riktig klient.

### Äldsta ouppfyllda löftet

**Blindbedömningen — beställd 31/7, 9 dagar.** 10 texter per profil, nivå 1–3, ribba 7/10.
Den avgör den enda öppna frågan ur TEXT-1-mätningen (röstträffen för LinkedIn föll
34 → 11 % och orsaken är inte fastställd). Utan den är röstkvaliteten obevisad på alla flöden.

---

## TEXT / prompt-core-serien

| Post | Status | Bevis / vad som återstår | Kundsynligt | UI-löfte utan täckning |
|---|---|---|---|---|
| T-1 kärna: `byggTextPrompt`, nio lager | KLART OCH VERIFIERAT | `lib/prompt-core.ts:353`, `tests/prompt-core.test.ts` | Nej | Nej |
| T-2 13 Gemini-flöden migrerade | KLART OCH VERIFIERAT | 21 anropsställen i 19 filer (G0 0.1) | Nej | Nej |
| T-3 Anthropic-vägen + paritetstester | KLART OCH VERIFIERAT | `tests/compass-vecka-paritet.test.ts`, `reels-prompt-paritet.test.ts` | Nej | Nej |
| T-4/T-5 mätning + fixar | KLART OCH VERIFIERAT | `TEXT1-RESULTAT.md`, 180+180 texter | Nej | Nej |
| T-6a CTA-golv med imperativ | KLART OCH VERIFIERAT | `prompt-core.ts:141`, `tests/cta-golv.test.ts` | Nej | Nej |
| T-6b sanningskrav + A2-skärpning | KLART OCH VERIFIERAT | `prompt-core.ts:165`, `tests/perspektivregel.test.ts` | Nej | Nej |
| T-6c variantregel + rotation | KLART, EJ VERIFIERAT | `nyligen` skickas från **2 av 21** anropsställen. Bevis: 10 genereringar per flöde, mät upprepade ingångar | Ja (upprepade inlägg) | Nej |
| Röstträffen sjönk för LinkedIn (34→11 %) | PARKERAT | Håkans beslut 1/8: inget byggs före blindbedömningen | Ja | Nej |
| Blindbedömningen | BESTÄLLT, EJ PÅBÖRJAT | Beställd 31/7. Håkans egen körning | Ja | Nej |
| `raknaCta`-ordlistan | KLART OCH VERIFIERAT | `62621a4`, `tests/cta-golv.test.ts` | Nej | Nej |
| Frågeform + hooklöfte (regel 5, 6) | KLART OCH VERIFIERAT | `writing-rules.ts`, `tests/sprakregler-frageform.test.ts` (13 tester) | Ja | Nej |
| Skenfrågegrinden utanför captionvägen | KLART OCH VERIFIERAT | **G-2, 9/8.** `rattaSkenfragor` körs i `saneraText` — alltså i ALLA flöden. Deterministisk och minimal: frågetecknet blir punkt, orden rörs inte. Äkta frågor rörs aldrig (4 tester). Captionvägen kommer hit efter sin egen omgenerering, så detta är sista nätet | Ja | Nej |
| Hashtags-flödet utanför prompt-core | KLART OCH VERIFIERAT | **G-2, 9/8.** Flödet hämtade profilen själv och byggde egen prompt → röstprofil, förbjudna ord och sanningskrav nådde aldrig hashtaggarna. Nu genom kärnan, och loggat med promptversion (bevisat i DoD:n) | Ja | Nej |
| Automatisk omgenerering vid förbjudet klientord | PARKERAT | Idag detektering + logg (`saneraText`). Håkan 1/8 | Nej | Nej |

## KVALITET-serien

| Post | Status | Bevis / återstår | Kundsynligt | UI-löfte |
|---|---|---|---|---|
| KVALITET-3 p1–p11 | KLART OCH VERIFIERAT | `ea53435` m.fl., DoD 10/10 captions + 7/7 veckodagar | Nej | Nej |
| Håkans skärpningar 2/8 (CTA = sista MENINGEN, siffergrind varje tal) | KLART OCH VERIFIERAT | `sakerstallCaption`, `tests/writing-rules.test.ts` | Nej | Nej |
| Siffergrinden i veckoplanen | KLART OCH VERIFIERAT | `generate/week/route.ts:208` + `:322`, commits `ea53435`+`74658b5` | Nej | Nej |
| Perspektivregel | KLART OCH VERIFIERAT | `tests/perspektivregel.test.ts` | Nej | Nej |
| Prisregel | KLART OCH VERIFIERAT | `tests/prisregel.test.ts` | Ja | Nej |
| Autospar 5 ytor (UTKAST-1) | KLART OCH VERIFIERAT | `tests/utkast.test.ts`, `utkast-livscykel.test.ts` | Ja | Nej |

## FIX-1

| Post | Status | Bevis / återstår | Kundsynligt | UI-löfte |
|---|---|---|---|---|
| Grupp A — självmotsägande instruktioner, HOOK_FORMATS | KLART, EJ VERIFIERAT | `d8bae1c`. Inget test, ingen ommätning. Bevis: genereringar per tenant på kundcase-ämnen | Ja | Nej |
| Grupp B1 | KLART, EJ VERIFIERAT | `d8bae1c`, samma lucka | Ja | Nej |
| Grupp B2 — Vilande som eget läge | PÅBÖRJAT (grunden klar, väntar på Håkan i MySales) | **Fynd 9/8, mätt mot skarp data:** Displaytekniks pipeline har ETT steg, `"Förlorad / Paus (nurture)"`, med **12 affärer** (24 rader i spegeln — den dubblerar över DT:s två coach-users, känt sedan tidigare). Förlorad och pausad ligger i samma fack och `harledStatus` läser "paus" som förlorad → **varje parkerad kund räknas idag som en förlorad affär.** Håkans beslut: facket delas i två i MySales (manuellt — pipelinesteg går inte att skapa via API:t). **Byggt:** `arVilande` + `harledSteglage` + `__ghl_vilande_stage_id` i stegfacit, `tests/fix1-b2-vilande.test.ts` (8 tester). ⚠ **Medvetet tyst tills steget finns:** ordet "paus" räknas ALDRIG som vilande och ett fack som säger både vilande och förlorad är förlorat — ingen av de 12 affärerna flyttar sig i förväg. **Kvar hos Håkan:** dela facket i MySales, sortera de 12 affärerna (listade i handoffen), peka ut steg-id:t. **Kvar att bygga:** VILOZON i UI:t, kravet på återkontaktsdatum, uppgiften i Fokus idag när datumet infaller, femfas-mappningen FRAMTID/SLÄPPT | **Ja** | Nej |
| Grupp C1 — LOGGA-1: logotyp-overriden syns inte | PÅBÖRJAT | Spec given 9/8. Krav: fyra synligt olika resultat på samma bild, i två tenants. **Delfynd 9/8 (verifierat i DB):** Makzy och Scandinavian Haydays har **samma fil** i både `primaryUrl` och `onDarkUrl` (`logo-light.png` i båda), Opticur saknar mörk variant helt → för dem ger Ljus och Mörk identisk bild oavsett kod. Det förklarar INTE Håkans egen körning (Displayteknik har två skilda filer) — rotorsaken där är inte fastställd | **Ja** | **Ja** — reglaget lovar fyra val som datan för tre tenants bara kan ge två |
| Grupp C2 — språkgenomgång av kundvyn | KLART OCH VERIFIERAT | **9/8, `tests/fix1-c2-kundsprak.test.ts` (6 tester som är en GRIND, inte en åsikt — fackorden kan inte smyga tillbaka).** Fyndet: förklaringstexterna var redan bra klarspråk medan namnen bredvid dem talade fackspråk. Nivåer: "Belagd" → **Med bevis**, "Grund" → **Som branschen** (var tvetydigt: grundsten eller grunt vatten?). Etiketter: "Kundens röst" → **Kundernas egna ord**, "GÖR INTE" → **Ord du undviker**, "Verifierade siffror" → **Siffror vi får använda**, "Vinnande exempel" → **Texter du är nöjd med**, "Egen röst" → **Dina egna texter**, "Grundfakta" → **Kontaktuppgifter och fakta**, "Berättelser" → **Kundberättelser**. Åtgärdstexterna följer etiketterna. Kunskapsbankens egna texter granskade — de var redan klarspråk | **Ja** | Nej |
| Grupp C3 — tre småfel | KLART OCH VERIFIERAT | **9/8, `tests/fix1-c3-smafel.test.ts` (9 tester), `next build` ren.** (a) Rubriken räknar nu `report.atgarder.length` i stället för att hårdkoda tre, med egen formulering vid exakt en åtgärd. (b) Veckoplanens platshållare var skriven för en enda kund ("Vintersäsongen, säkerhet … kallt väder") och läste som en instruktion för alla andra — nu neutral och lär ut formatet. (c) `KANALER` → `KANALER_DEFAULT` + ny tabell `fokus_kanalmal` (migration körd): tenantens egna rader ERSÄTTER standarden, fail-open till default om läsningen strular. LinkedIn 20/v gäller alltså inte längre en terapeut | **Ja** | Nej — alla tre var UI-löften utan täckning, nu stängda |

## BILD-serien

| Post | Status | Bevis / återstår | Kundsynligt | UI-löfte |
|---|---|---|---|---|
| BILD-1..3 (bildredigering, kvitto, länk) | KLART, EJ VERIFIERAT | STEG 7 kräver verifiering i skarp tenant sedan 2/8 | Ja | Nej |
| BILD-5a loggans synlighet | KLART OCH VERIFIERAT | `tests/logo-contrast.test.ts` | Nej | Nej |
| BILD-5b säsong | KLART OCH VERIFIERAT | `tests/sasong.test.ts` | Ja | Nej |
| BILD-6a/6b tankstreck + loggval på spann | KLART OCH VERIFIERAT | `tests/logo-contrast.test.ts`, `logo-manuellt-val.test.ts` | Nej | Nej |
| BILD-7/7a/7b avbildat budskap + motivvariation | KLART OCH VERIFIERAT | `tests/bild7-bildprompt.test.ts` | Nej | Nej |
| BILD-8 stavningsgrind | KLART OCH VERIFIERAT (med ärlig kvarleva) | `tests/bild8-stavningsgrind.test.ts`, DoD `545d5ae` 9/10+9/10. **Garanterar inte stavning — 2 av 20 tog sig igenom** | Ja | Nej |
| BILD-8b reels | KLART OCH VERIFIERAT | `e18362c` | Nej | Nej |
| BILD-8c textlöst motiv + bakgrundsfilter | KLART OCH VERIFIERAT | `c7e4209`, `docs/studio/DECISIONS.md` D-010 | Nej | Nej |
| Efterkontroll av blickriktning (`motivPassar`-motsvarighet) | PARKERAT | Medvetet utelämnad, HANDOFF §3 | Nej | Nej |
| **BILD-9 visuell profil** (stämning/kroppsspråk, färg/ljus, förbjudet i bild) | BESTÄLLT, EJ PÅBÖRJAT | Ingen spec i repot. **Beslut 9/8: skriv specen med hårt stopp (G-0-mönstret), efter logotypfixen och före G-1.** G-6 behåller motivkategorin. Specen ska väga in bildval per slide (byggt 9/8) | Ja | Nej |
| Text kunde skrivas utanför grafikytan | KLART OCH VERIFIERAT | Mätt: 34-teckens ord gick 454 px utanför 1080-kanvas → nu 124 px innanför. `overflowWrap` på alla 10 rötter + källtest | Ja | Nej |
| Förhandsvisningen kapade karusellens högerkant | KLART, EJ VERIFIERAT | Orsaken (`px-11` + hårdkodad skala) borttagen, mätning mount-säker. **Ingen har sett resultatet i inloggad Studio** | Nej (kosmetiskt) | Nej |

## SEO-spåret

| Post | Status | Bevis / återstår | Kundsynligt | UI-löfte |
|---|---|---|---|---|
| S-0 read-only kartläggning | KLART OCH VERIFIERAT | `8b1d3d5` | Nej | Nej |
| S-1+S-2 ärlig hämtning, null skilt från noll | KLART OCH VERIFIERAT | `bb949b4`, `tests/seo1-hamtning.test.ts`, `seo2-omatt.test.ts` | Ja | Nej |
| S-3..S-5 | BESTÄLLT, EJ PÅBÖRJAT | — | Ja | Nej |
| Djupgranskningen avstängd (kill switch) | KLART OCH VERIFIERAT | `DJUPGRANSKNING_AVSTANGD` server-sidan, `deep-audit/route.ts` | Ja | Nej |
| De sju rapporterna dolda i kundvyn | KLART OCH VERIFIERAT | Håkans beslut 9/8. `DOLJ_RAPPORTER_I_KUNDVYN` returnerar före DB-läsningen; `/k/seo` visar ärligt besked; intern vy `/api/analytics/deep-audit` orörd och ej kundnåbar (ej i `isCustomerServedApi`). Båda vägarna svarar 401 utan session | **Var ja — nu nej** | **Var ja — nu nej** |
| "Norrköping" i Gittes rapport gick ej att spåra | PÅBÖRJAT | Noll träffar i tio sparade rapporter. Fabriceringen skedde i en live-genererad vy som aldrig sparades — finns bara i genereringskoden | Ja | Nej |

## REV-serien (REVISION-1)

| Post | Status | Bevis / återstår | Kundsynligt | UI-löfte |
|---|---|---|---|---|
| REV-0 rapport + tre frågor besvarade | KLART OCH VERIFIERAT | `284f4c6`, `REVISION-RAPPORT.md` | Nej | Nej |
| REV-1 felhantering | BESTÄLLT, EJ PÅBÖRJAT | Beställd 30/7 | Ja | Nej |
| REV-2 kvitton | BESTÄLLT, EJ PÅBÖRJAT | — | Ja | Nej |
| REV-3 tomma lägen och UI | BESTÄLLT, EJ PÅBÖRJAT | — | Ja | Nej |
| REV-4 FunctionGuide och språk | BESTÄLLT, EJ PÅBÖRJAT | Beslut taget: kunden ser ordet "rådgivare"; `hq`/`webbdata-demo` bakom adminflagga; `SkapaInlaggMaker.tsx` tas bort efter grep | Ja | Nej |

## ONBOARD / onboardingmotorn

| Post | Status | Bevis / återstår | Kundsynligt | UI-löfte |
|---|---|---|---|---|
| ONBOARD-1 provisionering (URL in → förslag med källa per fält) | KLART OCH VERIFIERAT | Gitte live i GHL + Cockpit, Fokus-synk bevisad med riktigt kort | Ja | Nej |
| ONBOARD-3 källorna (Bokadirekt) | PÅBÖRJAT | Byggd men **inte inkopplad**. Hämtvägen tappar externa länkar (curl ser dem, motorn inte). Postnummer-bugg: salongs-id `20545` lästes som postnummer | Ja | Nej |
| ONBOARD-4+5 transkript + sammanvägning | BESTÄLLT, EJ PÅBÖRJAT | Etapp 3 i Håkans ordning | Nej | Nej |
| ONBOARD-7 stegverktyg (11 steg) | KLART OCH VERIFIERAT | `d8bae1c`, `lib/onboard/steg.ts`, status härledd ur verkligheten | Nej | Nej |
| ONBOARD-7 frågelistan i steg 8 | BESTÄLLT, EJ PÅBÖRJAT | Etapp 4 | Nej | Nej |
| Etapp 1 kund 1: Carina / AluCon | KLART OCH VERIFIERAT | 13 custom values, pipeline 7 steg | Ja | Nej |
| Etapp 1 kund 2: Madeleine / Makzy | PÅBÖRJAT | Konto skapat på befintligt GHL-konto. **Väntar på kundnyckeln i steg 4** — Håkans sida, 9/8 | Ja | Nej |
| Etapp 5 sluttest | BESTÄLLT, EJ PÅBÖRJAT | — | Ja | Nej |
| Välkomstmejlet | PARKERAT | Håkans beslut: avstängt med flit (`ONBOARDING_SKICKA_VALKOMSTMEJL`), han lämnar länken vid möte | Ja | Nej |
| Gitte saknar logotyp | PÅBÖRJAT | Noll rader i `studio_brand_kits`. Håkan skulle skicka filen | **Ja** | Nej |
| Två konflikter mot Håkans manuella profil (pris 6 100 vs 6 900, deltagartak 8 vs 9) | BESTÄLLT, EJ PÅBÖRJAT | Obesvarat sedan 7/8 | Ja | Nej |

## AKUT-PROV — snapshotet laddades aldrig (2026-08-09)

| Post | Status | Bevis / återstår | Kundsynligt | UI-löfte |
|---|---|---|---|---|
| Rotorsak: återanvänt konto får aldrig snapshot | KLART OCH VERIFIERAT | Körningsloggen 7/8: steg 2 `hoppade` ("Det finns redan ett konto … återanvänds"), och `snapshotId` skickas bara i `POST /locations/`. Kontot fanns i GHL innan verktyget kördes | Ja | **Var ja** — steget skrev "Kontot är skapat med snapshotet angivet" om ett konto vi aldrig skapade |
| Spärr: hårt fel direkt vid återanvänt konto | KLART OCH VERIFIERAT | `snapshotStegAterAnvant()` i `provisionera.ts` — egen funktion för att gå att testa. Steg 2 sätter `aterAnvantKonto` | Ja | Nej |
| Custom values gatades på byråtoken | KLART OCH VERIFIERAT | Skrivningen görs med KUNDNYCKELN; byråtokens egen väg är dokumenterat stängd (401 på underkontots custom values). Villkoret krävde alltså något som ändå aldrig fungerar och stoppade en betalande kund. Nu räcker `locationId` | Ja | Nej |
| GHL kan INTE applicera snapshot på befintligt konto | KLART OCH VERIFIERAT | Probat 9/8: `snapshots/push`, `snapshots/{id}/push`, `snapshots/load`, `locations/{id}/snapshot` → 404/401. `snapshotId` accepteras bara av `POST /locations/`. `GET /snapshots/` och snapshot-status → 401. **Laddningen måste ske i GHL:s gränssnitt** | Ja | Nej |
| Pipelines går varken att skapa eller radera via API | KLART OCH VERIFIERAT | `DELETE /opportunities/pipelines/{id}` → 401 med de nio kundscopen. Samma tak som blockerar skapande | Nej | Nej |
| Madeleine/Makzy mot mallens facit | KLART OCH VERIFIERAT | Mätt med hennes egen nyckel: Kund pipeline **7 steg**, **13 custom values-nycklar** (8 ifyllda, 5 tomma för att hon saknar dem), workflow "Uppföljning fas 1" **published**. Nyckeln sparad i `coach_users`, kvitto för steg 5 skrivet | Ja | Nej |
| Makzy: GHL-standardskräp kvar | BESTÄLLT, EJ PÅBÖRJAT | Marketing Pipeline (11 steg, **0 affärer** — kontrollerat), 6 draft-workflows, ~3 extra taggar, 4 GHL-standardvärden. Kräver handpåläggning i GHL — API:t nekar | Nej | Nej |
| Snippets kan inte verifieras via API | PARKERAT | Scopet finns inte bland de nio. Verifieringen säger det rakt ut i stället för att låtsas att allt är kollat | Nej | Nej |
| `GHL_BYRA_TOKEN` + `GHL_COMPANY_ID` saknas i produktionsmiljön | BESTÄLLT, EJ PÅBÖRJAT | Cockpit kan därför inte SKAPA nya sub-accounts på live. Blockerade inte Makzy efter fixen. Håkans sida (Vercel env) | Ja (nästa kund) | Nej |
| Steg 2-texten antog att kunden har en bokningsplattform | KLART OCH VERIFIERAT | Texten var skriven runt Gitte/Bokadirekt och läste som en instruktion att leta efter en bokningssida. Makzy har ingen. Nu villkorad: "har kunden ingen bokningssida är det inget fel" | Ja | Nej |
| Makzy: `tone_rules` tomt | BESTÄLLT, EJ PÅBÖRJAT | 0 tecken i `hm_brand_profile.tone_rules` → hennes texter får ingen tonstyrning från profilen | Ja | Nej |
| Ingen djuplänk till en enskild kunds stegvy | BESTÄLLT, EJ PÅBÖRJAT | Valet hålls i komponentens state, inte i URL:en. `?id=` öppnar granskningsvyn i stället | Nej | Nej |


## Provisionering / snapshot-spåret

| Post | Status | Bevis / återstår | Kundsynligt | UI-löfte |
|---|---|---|---|---|
| MALL MySales Pro (`C7hspI68eIy5elGHfFVj`) | KLART OCH VERIFIERAT | 7 steg, 8 taggar, 13 custom values, ASCII-nycklar | Nej | Nej |
| ASCII-nycklar i `byggCustomValues` | KLART OCH VERIFIERAT | `lib/onboard/provisionera.ts:113`, `tests/onboard.test.ts` (rättad 9/8) | Ja | Nej |
| Pipeline går ej att skapa via API | PARKERAT | GHL:s scope-tak. Håkan bygger för hand. `oauth.write` finns inte | Nej | Nej |
| `GHL_SNAPSHOT_ID` saknas i env | PÅBÖRJAT | Koden faller tillbaka på dokumenterat id — fungerar, men odokumenterat beroende | Nej | Nej |
| **Logotypen skrivs men LÄSES ALDRIG (AKUT-LOGOTYP)** | BESTÄLLT, EJ PÅBÖRJAT | RÄTTAD BESKRIVNING 9/8: `logo_url` SKRIVS av `provisionera.ts:739` (Makzy har 70 tecken i fältet). Felet är att ingen läser det — grep i lib/ och app/ ger noll läsare. Studios grafik hämtar loggan ur `studio_brand_kits`, som har 0 rader för både Makzy och For Balance. Nettoeffekten är den Håkan såg hos Gitte: allt ritar företagsnamnet som text. Beslut 9/8: akutfix före G-1 | **Ja** | Nej |
| Steg 4 kundnyckel = manuell | PARKERAT | GHL:s plattformstak (24 scopes, inget `oauth.write`). Väg bort: privat Marketplace-app | Nej | Nej |

## AKUT-KARUSELL

| Post | Status | Bevis / återstår | Kundsynligt | UI-löfte |
|---|---|---|---|---|
| Publiceringskedjan N slides → N bilder | KLART OCH VERIFIERAT | `tests/akut-karusell.test.ts` 15 tester: karusell-children, ordning, JPEG-säkring, GHL media-array | Ja | **Var ja — nu nej** |
| Exporten (nedladdning av N filer) | KLART OCH VERIFIERAT (lokalt) | **Körd 9/8 med `scripts/karusell-dod.mjs`** mot `localhost:3480` på commit `b8f1e18`: 7 slides → 7 startade nedladdningar → **7 PNG-filer på disk**, `hmmotor-ark-karusell-1080x1350-1av7.png` … `-7av7.png`, alla giltiga PNG (51–70 kB) och alla sju **olika** (unika sha256). Slide 1 bär rubriken "DOD SLIDE 1 AV 7" och 7-stegs-indikatorn står på position 1; slide 7 står på position 7 — ordningen stämmer. 21 kontroller gröna. **Kvar: samma körning mot live.** Exportkedjan är ren klient-render (html-to-image + blob-nedladdning, ingen server), så localhost kör identisk kod — men två saker är oprövade på live: (1) Chromes fråga "Tillåt flera nedladdningar?" i en vanlig webbläsarprofil, som headless kringgår, (2) att Vercel-bundlen är den kod som mättes | Ja | Nej |
| GHL med flera bilder | KLART, EJ VERIFIERAT | `media[]` skickas. **Ej provat mot skarpt GHL-konto.** UI:t säger det rakt ut och ber om kontroll | Ja | Nej |
| Schemalagd karusell | KLART, EJ VERIFIERAT | Kolumnen `studio_scheduled.slide_urls` körd och verifierad (ARRAY). Kedjan cron→publish ej körd skarpt | Ja | Nej |
| Gamla karusellvägen pensionerad | KLART OCH VERIFIERAT | `render-carousel/route.ts` svarar 410, UI pekar till Studio | Nej | Nej |
| Bildval per slide + ta bort foto | KLART, EJ VERIFIERAT | Byggt 9/8 efter Håkans fynd. Bevis: lägg till slide, kontrollera att befintliga foton är orörda | Ja | Nej |
| Punktnumret (01, 02) synligt i editorn | KLART OCH VERIFIERAT | `punktNummer` i `lib/studio/payload.ts`, 3 tester, mallen läser samma funktion | Nej | Nej |

## AKUT-DM

| Post | Status | Bevis / återstår | Kundsynligt | UI-löfte |
|---|---|---|---|---|
| `suggest-reply` genom prompt-core, syfte `dm-svar` | KLART OCH VERIFIERAT | `tests/akut-dm.test.ts` 12 tester: sanningskrav, prisregel, perspektiv, röst, förbjudna ord | **Ja** | Nej |
| Dialoganatomi utan CTA-golv | KLART OCH VERIFIERAT | `prompt-core.ts` `DIALOG_ANATOMI` + `WRITING_RULES_DIALOG` | Ja | Nej |
| Skarp körning mot ett riktigt lead | KLART, EJ VERIFIERAT | Bevis: generera svar på ett riktigt lobbykort och läs efter påhitt/pris/uppmaning | Ja | Nej |

## GRANSK G-0..G-9

| Post | Status | Bevis / återstår | Kundsynligt | UI-löfte |
|---|---|---|---|---|
| G-0 read-only-rapport | KLART OCH VERIFIERAT | `docs/gransk/G0-RAPPORT.md` | Nej | Nej |
| G-1 generationsloggen | KLART OCH VERIFIERAT (G-1a+b) | **Kört skarpt 9/8, `scripts/g1-dod.mjs`:** ett riktigt karusellanrop gav rad `71c8ea14` i `generation_log` med `syfte=karusell`, **`format=karusell`** (G0 0.4 punkt 2 stängd — karusell är inte längre samma rad som en statisk bild), `prompt_version=v1-712d3248`, `funnel=tofu` (syftets mjuka default, inte null), `varianter=5`, promptlagren, och **`ai_usage_event_id` kopplat till gemini/gemini-2.5-flash**. 12 kontroller gröna. Migration körd via Management API (15 kolumner, 7 index, RLS på, vy skapad). Promptversionen räknas ur regeltexten, inte ur ett handhållet nummer, och är låst i test. Inkopplad på **den obligatoriska vägen** (`lib/ai-usage`) i stället för på 21 ställen: båda ingångarna (`anropaProvider` + `loggaAnrop`) loggar, och sex kundtextflöden skickar sin metadata — karusell, studio-text, caption, LinkedIn, nyhetsbrev, reels, DM-svar. **G-1c klar samma dag:** genererings-id:t reser hela vägen — `generateCarousel` → routen → StudioMakers state → sparningen → `kopplaTillInlagg`. Bevisat i samma DoD: raden `8f88e0b1` fick `anvand_i_tabell=studio_posts` och `anvand_i_id=acf330a8`, och vyn räknar `publicerade: 1`. Id:t nollas efter kopplingen så samma generering inte kan bindas till två inlägg. **Alla flöden inkopplade och körda skarpt** (`scripts/g1c-flodena-dod.mjs`): LinkedIn → `linkedin_posts`, caption → `studio_posts`, reels → `studio_reels`, karusell → `studio_posts`. Klienten håller en LISTA av id:n, inte ett — ett karusellinlägg kommer ur både karusell- och captiongenereringen. **19 enhetstester + 16 + 14 DoD-kontroller.** ⚠ **Nyhetsbrevet är OBEVISAT och ligger kvar så** (Håkans beslut 9/8): kopplingen är kodmässigt identisk med reels, men modulen är av för **samtliga** klienter (kontrollerat i DB). Ingen åtgärd nu — bevisas när första kunden får modulen påslagen | Nej | Nej |
| G-2 formatanatomier som data | KLART OCH VERIFIERAT | **Kört skarpt 9/8, `scripts/g2-dod.mjs` (11 kontroller).** `lib/format-anatomi.ts` = anatomierna som data. **Story finns nu som syfte** (`TextSyfte`, egen anatomi, kopplad i `lib/studio/copy.ts` på 9:16 utan video) — bevisat: en story gav "Öppet till 18 idag", 4 ord, och raden i loggen bär `syfte=story`. **Karusellanatomin ur data** — rollista, anatomitext, JSON-schema och slide-räkning kommer nu ur SAMMA källa (förut tre uttryck på tre ställen); 4 punkter gav exakt 6 slides. Insats- och bevis-roller finns som valbara, av som standard. **Alla fyra reelmallar börjar med krok** — "Före och efter" saknade den helt och började med 3 s problem. **Säkerhetszon för statiska format** (`SAKER_ZON` + bildrad). **Skenfrågegrinden når alla flöden** via `rattaSkenfragor` i `saneraText`, deterministiskt. **Hashtags går genom prompt-core** — loggas nu med promptversion. **20 enhetstester.** ⚠ Insats/bevis styr dramaturgin i prompten men landar som `point` i payloaden: mallarna ritar tre roller | Ja | Nej |
| G-3 hook-lagret | PÅBÖRJAT (G-3a klar) | **9/8:** `lib/hook-typer.ts` — EN lista i stället för tre. G-0 hittade tre osammanhängande: playbookens fem typer, VARIANTREGELNS åtta ingångar och DISC:ens fyra tonlägen. De var tre olika INDELNINGAR av samma sak, delvis motstridiga. Playbookens fem är nu stommen (flödena namnger dem redan i sin JSON), VARIANTREGELNS extra ingångar blev VINKLAR inom en typ. `kraver`-fältet bär materialkravet hos typen själv, så varje flöde kan ställa samma fråga — förut låg den kunskapen bara i `lib/studio/copy.ts`. `VARIANTREGEL` byggs ur listan. ⚠ **Fångat av test:** den genererade texten tappade först förbehållet "endast verifierad ur profilen" — utan det blir regeln en uppmaning att hitta på ett tal. Förbehållet följer nu med typen. Promptversion `v1-5082a4b7` → `v1-32a4ec3d`, låset fällde ändringen. **G-3b, `hook_typ` skrivs nu:** kolumnen har funnits sedan G-1 utan att någon skrev den — en kolumn som alltid är tom är samma tysta lösa löfte som resten av dagen handlat om. `iterateGenerate` tar `hookTyper[]` i samma ordning som `variantSuffixes`, och eftersom **varje variant är ett eget betalt anrop** får varje variant sin EGEN rad med rätt hooktyp. En sammanslagen rad hade dolt spridningen, som är hela poängen med iterationsloopen. **G-3c klar:** `copy.ts` ställer nu materialfrågan till `lib/hook-typer` i stället för att ha egen kod — bildrollen ägs kvar där (bara det flödet vet något om den). `tests/g3-hooktyper.test.ts` (11 tester) innehåller ett **ekvivalenstest** som kör gammal och ny regel mot alla bildroller × all täckning: uppstädningen fick inte vara en tyst regeländring. **Kvar (G-3d):** `nyligen` når 2 av 21 anropsställen — rotationen över tid är därmed nästan overksam | Ja | Nej |
| G-4 bevis-motorn | BESTÄLLT, EJ PÅBÖRJAT | Beslut taget: `pricing_notes` förblir spärrad; bevis = verifierade siffror, story-bank-citat, vinnande exempel | Ja | Nej |
| G-5 CTA-motorn | BESTÄLLT, EJ PÅBÖRJAT | BOFU aldrig default (31/7 står fast). Mottagarsidan för nyckelords-CTA saknas i `/api/lobby/*` | Ja | Nej |
| G-6 bildfeedback | BESTÄLLT, EJ PÅBÖRJAT | Delvis förarbete finns: `image_feedback` + `ImagePicker` tumme, men bara i LEGACY-vägen (`/api/social/generate-image`). Studios Bildhjälpen läser den inte. Ingen kommentar, inget generations-id | Ja | Nej |
| G-7 blindtest mot ribba | BESTÄLLT, EJ PÅBÖRJAT | — | Ja | Nej |
| G-8 mätloopen | BESTÄLLT, EJ PÅBÖRJAT | Kräver Meta-omkoppling per tenant | Ja | Nej |
| G-9 kvalitetssidan | BESTÄLLT, EJ PÅBÖRJAT | `/dashboard/kvalitet` finns inte | Nej | Nej |

## Mätbarhet / engagemang

| Post | Status | Bevis / återstår | Kundsynligt | UI-löfte |
|---|---|---|---|---|
| `META_SCOPES` saknar `instagram_manage_insights` | BESTÄLLT, EJ PÅBÖRJAT | `lib/meta-oauth.ts:15`. `getMediaInsights` sväljer felet → tyst noll. G-8 | Ja (nollor som ser ut som mätvärden) | Nej |
| `post_metrics.post_id` skrivs aldrig | BESTÄLLT, EJ PÅBÖRJAT | `instagram/sync/route.ts:33-43` sätter bara `ig_media_id`; `insights.ts:43` joinar på `post_id` → `getWinningPatterns` har aldrig gett data | Ja | Nej |
| `insights.ts` läser fel tabell | BESTÄLLT, EJ PÅBÖRJAT | Läser `hm_social_posts`, Studio sparar i `studio_posts` | Ja | Nej |
| `studio_posts.ghl_post_id` bär två ID-rymder | BESTÄLLT, EJ PÅBÖRJAT | GHL-post-id och IG-media-id i samma kolumn, ingen kolumn säger vilken | Nej | Nej |
| Engagemang-sync (likes/räckvidd per inlägg) | PARKERAT | Håkans beslut 2026-07-21: "lägger engagemang på framtiden". IG=grönt, FB=gult, LI=rött | Ja | Nej |

## Handbok / FunctionGuide / ICP

| Post | Status | Bevis / återstår | Kundsynligt | UI-löfte |
|---|---|---|---|---|
| HANDBOK-1 (H-0 plan, H-1 bygge) | PÅBÖRJAT | `/dashboard/handbok` finns och `content/handbok/credits.md` ligger på mallens form, men **H-0-planen är inte gjord** och strukturen inte beslutad | Ja | Nej |
| FunctionGuide (REV-4) | BESTÄLLT, EJ PÅBÖRJAT | — | Ja | Nej |
| ICP-motorn ICP-0..7 | BESTÄLLT, EJ PÅBÖRJAT | ICP-0 = spec + datamodell + säkerhetsgenomgång före kod. `lead_niva_a`/`lead_niva_b` ligger i `credit_pricing` med 0 credits och `active=false` | Nej | Nej |

## Listmodulen

| Post | Status | Bevis / återstår | Kundsynligt | UI-löfte |
|---|---|---|---|---|
| Listmodulen | — | **ANNAT PROJEKT, UTGÅR UR DETTA REPOS STATUS.md.** Håkans besked 9/8: hör till Säljmaskinen (`project_saljmaskinen_listor`). Raden står kvar enbart för att den inte ska spöka i framtida inventeringar | — | — |

## Kredit-, kostnads- och HQ-spåren

| Post | Status | Bevis / återstår | Kundsynligt | UI-löfte |
|---|---|---|---|---|
| KOSTNAD-1 K1–K5 | KLART OCH VERIFIERAT | DoD 12/12, `scripts/kostnad1-dod.mts` | Nej | Nej |
| KOSTNAD-1b alla betalda API:er | KLART OCH VERIFIERAT | 8 tjänster genom `anropaProvider` | Nej | Nej |
| K2-1..K2-4 credits | KLART OCH VERIFIERAT | 31 tester + `scripts/k2-*-dod.mts` | Ja | Nej |
| `/k/credits` sedd med riktig inloggad kund | KLART, EJ VERIFIERAT | Modulen är av för alla; skulle granskas när DT-piloten slås på | Ja | Nej |
| HQ-1 Founder HQ | KLART OCH VERIFIERAT | 20 kontroller, `scripts/hq1-dod.mts` | Nej | Nej |
| LIKVID-1 | KLART OCH VERIFIERAT | 36 kontroller, `scripts/likvid1-dod.mts` | Nej | Nej |
| K3-INKÖP | KLART OCH VERIFIERAT | 52 kontroller, `scripts/k3-inkop-dod.mts` | Nej | Nej |
| K3:s manuella siffror ifyllda | BESTÄLLT, EJ PÅBÖRJAT | Håkans sida. Utan fakturabelopp kan efterskottskonton inte larma; utan abonnemangspris står hela marginaltabellen "pris saknas" | Nej | Nej |
| Banksaldo + buffertmål ifyllt | BESTÄLLT, EJ PÅBÖRJAT | Håkans sida. LIKVID-1:s prognos står tom tills dess | Nej | Nej |
| PLAN-1 + START-1 | KLART, EJ VERIFIERAT | `9960624`, `08e445c`, `tests/plan1-planering.test.ts`. Byggdes i parallell session | Nej | Nej |
| KONTAKT-1 tystnadsmätare | KLART, EJ VERIFIERAT | `bbf1e18`, `tests/kontakt1-tystnad.test.ts` | Nej | Nej |
| OFFERT-2 O-1 produktdatabasen | KLART, EJ VERIFIERAT | `b8ae213`, `tests/offert2-inkopsdata.test.ts` (22 tester). Resten av OFFERT-2 ej startad | Nej | Nej |

## Säkerhet (ur rot-`STATUS.md`, 2026-07-19/20)

| Post | Status | Bevis / återstår | Kundsynligt | UI-löfte |
|---|---|---|---|---|
| FAS 1 batch 1 + 2, kolumnlås `clients`, `hm_leads`, `hm_brand_profile` | KLART OCH VERIFIERAT | Anon-curl-bevis i rot-STATUS.md | Ja | Nej |
| Browser-SKRIV via anon (26 filer) | KLART, EJ VERIFIERAT | **Nu 3 filer, alla bara `storage.uploadToSignedUrl` — noll tabellåtkomst.** Bevis saknas för att anon-policies faktiskt är dragna live | Ja | Nej |
| Rotationer (FAS 2) | BESTÄLLT, EJ PÅBÖRJAT | Kräver att Håkan agerar i Google/Meta/GHL | Ja | Nej |
| Supabase Auth (väg B) | PARKERAT | Väg A godkänd, äkta JWT-RLS flaggad som v2 | Nej | Nej |
| `platform_users` magic-link | BESTÄLLT, EJ PÅBÖRJAT | Tabell finns, ingen UI. Delad klient-token är enda vägen | Ja | Nej |

## Övrigt / udda fynd

| Post | Status | Bevis / återstår | Kundsynligt | UI-löfte |
|---|---|---|---|---|
| HM Motors profilinnehåll i DB | BESTÄLLT, EJ PÅBÖRJAT | Koden hindrar nästa olycka (diff-bekräftelse), städar inte den gamla. Beställd 1/8 | **Ja** | Nej |
| PROFIL-2: yta för berättelser/kundord | KLART OCH VERIFIERAT | **9/8, `scripts/profil2-dod.mjs` (10 kontroller) + `tests/profil2-kundmaterial.test.ts` (10 tester), `next build` ren.** `/api/profile/material` + `components/profile/KundMaterial.tsx`, monterad FÖRE kunskapsbanken (det är dit åtgärderna pekar). **Rotorsaken var värre än ytan som saknades:** `lib/profil/las.ts` räknade bara berättelser med `source_module='intake'` — en kund hade kunnat skriva in tre berättelser för hand och sett mätaren stå stilla. Nu räknas `["intake","profil"]`, och ursprunget hålls ändå isär. **Bevis:** kriteriet Kundberättelser gick 0 → 3 av manuellt inskrivet material i skarp körning. Ingen parallell datamodell: samma tabeller och fält som intake/commit skriver. Kundord ARKIVERAS (kan vara källa till publicerad text), bara eget material går att radera | **Ja** | **Var ja — nu nej.** Mätaren bad om material som inte gick att fylla i; ytan finns nu |
| Mediabibliotek: kunskapsbankens filer i ImagePicker | PARKERAT | Håkans idé 2026-07-02, aldrig beställd skarpt | Ja | Nej |
| Stale kommentar `lib/publish/index.ts:9` | BESTÄLLT, EJ PÅBÖRJAT | Säger att ig-graph "migreras hit" — redan gjort. Vilseleder | Nej | Nej |
| GHL: föräldralöst värde `4242` på "Louise Ribbing" | PARKERAT | Kan ej åtgärdas — GHL raderar aldrig ett skrivet fältvärde | Nej | Nej |
| TODO/FIXME i koden | KLART OCH VERIFIERAT | Grep över `app/ lib/ components/`: **noll träffar** | Nej | Nej |
| STEG 7 städning + inventering | BESTÄLLT, EJ PÅBÖRJAT | SMS-fullversion (status), `ONBOARDA-NY-KUND-INSTAGRAM.md` ospårad, verifiera BILD-1..3 + ANSLUT-1..4 skarpt | Nej | Nej |

---

## MOTSTRIDIGHETER (löses inte här — listas)

1. ~~**"Nya leads döljer nedlagda affärer"**~~ **LÖST 9/8 — HANDOFF rättad till LEVERERAD.** står som *Ej gjort* i HANDOFF (3/8), men commit
   `ebf006c` heter "Nedlagda affarer slapper tillbaka leadet till Nya leads" och
   `tests/lobby-nedlagda.test.ts` finns. **Koden säger klart, handoffen säger inte gjort.**
2. ~~**"Färskhetsrad i offertens kundväljare"**~~ **LÖST 9/8 — HANDOFF rättad till LEVERERAD.** står som *Ej gjort* (3/8), men `5ce3f05`
   heter "Aldern pa MySales-datan syns i varje vy som visar den" och
   `tests/fokus-farskhet.test.ts` finns. Samma motstridighet.
3. **Rot-`STATUS.md` (2026-07-19) säger "26 klientfiler gör anon-anrop, läs OCH skriv".**
   Koden idag: 3 filer, alla enbart `storage.uploadToSignedUrl`. **Rot-STATUS är tre veckor
   gammal och överdriver dagens exponering** — men ingen har bevisat att anon-policyerna är
   dragna live, så påståendet kan inte heller avfärdas.
4. **HANDOFF §3 säger "Pågår: inget bygge"** samtidigt som tabellen i §2b listar pågående
   etapper. Sektionen är inte uppdaterad sedan 2/8.
5. **IDÉ-1 och UTKAST-1** står som levererade i tabellen, men HANDOFF §3 säger att de
   "har inga egna commits" och att "3-av-3-löftet inte är verifierat". Två nivåer i samma fil.

## INAKTUELLA HANDOFF-RADER (föreslås för strykning — stryks INTE nu)

- ~~"Nya leads döljer nedlagda affärer"~~ — **struken 9/8**, satt till LEVERERAD `ebf006c` med test som bevis
- ~~"Färskhetsrad i offertens kundväljare"~~ — **struken 9/8**, satt till LEVERERAD `5ce3f05` med test som bevis
- ~~G-0-rapportens rad om siffergrinden och veckoplanen~~ — **struken 9/8** (redan rättad i HANDOFF, `ea53435`+`74658b5`)
- HANDOFF §3 "Pågår: inget bygge" och "Väntar på Håkan: Klartecken för STEG 2 (KOSTNAD-1)"
  — KOSTNAD-1 är levererad sedan 2/8
- Rot-`STATUS.md` bör dateras om eller hänvisa hit, annars läses den som aktuell
