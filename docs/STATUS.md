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
| KLART OCH VERIFIERAT | 77 |
| KLART, EJ VERIFIERAT | 30 |
| PÅBÖRJAT | 8 |
| BESTÄLLT, EJ PÅBÖRJAT | 31 |
| PARKERAT | 11 |
| **Totalt** | **157** |

*Räknat 2026-08-11 (andra gången, efter eftermiddagens sju commits) genom att läsa nivåkolumnen i varje tabellrad i den här filen, inte ur minnet.
Siffran gick från 86 till 143 för att de gamla talen aldrig räknades om när rader lades till under
9–11 augusti — inte för att 57 nya beställningar tillkommit. Den som jämför datum mot datum ska veta
det.*

*Uppdaterad 9/8 efter Håkans STATUS-1-beslut: rapporterna dolda, två felmarkerade rader rättade.*
*Uppdaterad 2026-08-11 (STATUS-2, körd mot koden som facit): G-3 satt till KLART — raden stod som
PÅBÖRJAT medan dess egen bevistext beskriver a, b, c och d som klara och bevisade. Tillagt:
T-6b-grinden, VECKA-1, KALENDER-1, BETAL-1c (två commits), tokenkortet i kundvyn, och offertmotorn
som PÅBÖRJAT — den ligger OSTAGAD i arbetsträdet, alltså utanför git-historiken. Tre nya fynd
inlagda: sifferkontrollen räknar tal ur kundcitat som tillåtna, fyra inläggssidor saknas i menyn,
och dra-och-släpp är obeklickad. Arbetsträdet: 1094 tester gröna i 70 filer, tsc rent.*

*Uppdaterad 10/8: G-3d, G-4, G-5 och G-6 klara och bevisade. T-6c gick från KLART, EJ
VERIFIERAT till verifierad; G-4/G-5/G-6 från BESTÄLLT till verifierade. G-9 klar 10/8. Kvar i GRANSK-serien: G-7 (blindtestet — Håkans egen
bedömning) och G-8 (mätloopen — kräver Instagram-omkoppling per kund).*

### Topp 5 kundsynliga brister, efter risk

> ~~1. Sju djupgranskningsrapporter synliga för kund~~ — **ÅTGÄRDAD 9/8.** Dolda i kundvyn
> server-sidan, behållna internt. Var listans etta; strykningen är hela poängen med filen.

1. **Logotypen skrivs men läses aldrig.** `logo_url` fylls av provisioneringen (Makzy har 70 tecken
   i fältet) men grep i `lib/` och `app/` ger noll läsare, och `studio_brand_kits` har noll rader för
   Gitte och Makzy. Nettot: all grafik ritar företagsnamnet som text. Beslutad som akutfix 9/8,
   fortfarande inte gjord — och den drabbar varje ny kund vid första intrycket.
2. **HM Motors varumärkesprofil i databasen är fel innehåll** (coaching, inte bilhandel).
   Koden är lagad, datat inte. Varje text som genereras för tenanten bygger på fel profil.
3. **Logotyp-reglaget lovar fyra val som datan bara kan ge två** (LOGGA-1). Makzy och Scandinavian
   Haydays har samma fil i både ljus och mörk variant, Opticur saknar mörk helt. Rotorsaken hos
   Displayteknik, som HAR två skilda filer, är inte fastställd.
4. **SEO-verktyget rapporterade nollor som mätvärden** och gick ut till kund. S-1+S-2 är
   lagade; S-3..S-5 återstår, och rapporterna som redan gått ut är inte återkallade.
5. **Video saknar pris i `ai_pricing`.** En videogenerering loggas som 0 kr, kostnadstaket på 200 kr
   reagerar aldrig, och de 15 tokens per påbörjat femsekundersklipp vilar inte på någon mätning.
   Ingen video har körts, så ingenting läcker i dag — men priset måste sättas före första betalande
   kund.
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
| T-6c variantregel + rotation | KLART OCH VERIFIERAT | **G-3d, 9/8.** `nyligen` gick från 4 av 21 anropsställen (G-0 mätte 2; två till kopplades in däremellan) till **14 av 21**, och de 7 återstående är dokumenterade undantag i koden, inte luckor. `lib/rotation.ts` = EN källa per flöde, varje flöde läser sin egen tabell. Bevis: `scripts/g3d-dod.mjs`, 18 kontroller. **Före/efter på skarp tenant:** AluCon (0 rader historik) gav `lager.nyligen = saknas`, ett sparat inlägg senare gav `lager.nyligen = true` — samma kod, samma tenant, enda skillnaden är historikraden. Andra tenant (Annas Blommor, 25 rader) fick lagret utan att något såddes. **15 enhetstester** | Ja (upprepade inlägg) | Nej |
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
| **UTKAST-2 klientbytet tömmer alla fem ytorna** | KLART, EJ VERIFIERAT I SKARP DRIFT | **10/8 (sen kväll), `tests/utkast2-alla-ytor.test.ts` (22 kontroller).** Nyhetsbrev, reels, veckoplan och blogg har nu samma `nollstall` som Studio, var och en med sin egen tömningsfunktion. "Börja om" och klientbytet delar EN funktion per yta — två listor som ska hålla samma sak isär glider isär. Grinden hittar ytorna själv i källan och fäller (a) en yta utan `nollstall`, (b) en tömning som missar ett fält som utkastet bär, (c) ett "Börja om" som går sin egen väg. Båda grindarna är **provade genom att brytas**: nollstall bort → 2 röda, `setHtml("")` bort ur bloggen → "lämnar kvar html från förra klienten". Ett eget test låser att fältlistan inte är tom (annars hade grönt betytt "inget fält glömdes" när läsningen i själva verket var trasig — G-5:s ihåliga grönt). **Två luckor som grinden hittade i Studio, som stod som klar:** Compass-chipsen och kanalvalet lämnades kvar vid byte, och `channelsSeeded` hindrade förikryssningen från att läsa den nya klientens kopplingar. Bildomdömet (G-6) tömdes vid byte men inte av "Börja om". ⚠ **Obevisat i skarp drift, och det är den ärliga kvarlevan:** `nollstall` körs när klient-id ändras UTAN att sidan monteras om. `components/ClientPicker.tsx:63` gör `window.location.reload()` vid varje byte, och ingen av de fem ytorna läser om aktiv klient efter montering — jag kan därför inte visa callbacken avfyras i drift, och **rotorsaken till Håkans sikte 10/8 är inte fastställd** (se raden nedan) | Ja | Nej |
| Autospar 5 ytor (UTKAST-1) | KLART OCH VERIFIERAT | `tests/utkast.test.ts`, `utkast-livscykel.test.ts`. **Fynd 10/8 (Håkan, i skarp drift): klientbytet tömde inte ytan.** Han stod på AluCon men såg Displaytekniks skyltförslag. Orsak: `useUtkast` returnerade direkt när den NYA klienten saknade utkast, utan att nollställa — förra klientens texter stod kvar under den nya klientens namn. Ingen data läckte mellan konton (allt är byråvyn), men nästa klick kunde ha publicerat fel kunds text i rätt kunds kanal. Haken tar nu en `nollstall`-callback som körs vid BYTE men aldrig vid första laddningen (annars hade djuplänkar och öppnade inlägg slagits sönder). 2 nya tester. ✔ **Alla fem ytor inkopplade 10/8 (UTKAST-2, raden ovan).** ⚠ **Öppet: rotorsaken till Håkans sikte är inte fastställd.** Fixen skyddar mot ett klientbyte som sker UTAN omladdning. Bytet i `ClientPicker` gör en hård `window.location.reload()`, och efter en omladdning kan förra klientens texter bara komma tillbaka ur `localStorage` — under den NYA klientens nyckel. För att en sådan rad ska ha skrivits måste ett byte ha skett i samma montering. Jag har inte hittat den vägen i koden. Alltså: fixen är rätt och nödvändig, men den bevisar inte att just det Håkan såg är stängt. **Kräver Håkans ögon:** hur bytte han klient när det hände (växlaren, `?kund=`-länk, två flikar, bakåtknappen)? | Ja | Nej |

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
| ONBOARD-3 källorna (Bokadirekt) | KLART OCH VERIFIERAT | Inkopplad 11/8: länken plockas ur lästa sidors innehåll (externa länkar kastas fortfarande i crawlen, med flit), å-slugs tål (Oppråby), adress/telefon ur JSON-LD (postnummer-buggen borta — slug-siffror avvisas med lookbehind), tjänster+priser+recensioner ur payload, "vecka 36-43"-kurser läses, `bokningslank` nytt fält hela vägen till GHL custom value. Bevis: 29/29 test + skarp körning mot opprabygamlaskola.se (telefon/adress/priser/citat fyllda, postnummer-konflikt 726 94 mot 725 94 flaggad för aktivt val) | Ja | Nej |
| ONBOARD-4+5 transkript + sammanvägning | BESTÄLLT, EJ PÅBÖRJAT | Etapp 3 i Håkans ordning. Gjordes FÖR HAND för Oppråby 11/8 (mötestranskript → brand-profil) — det är den manuella versionen av vad etappen ska automatisera | Nej | Nej |
| Djupgranskningen (kill switch 7/8) | KLART OCH VERIFIERAT | Återöppnad 11/8. Grinden `underlagDuger` ligger före prompten i `lib/deep-audit-generate.ts`: ingen läst sida / oläsbar startsida / <200 tecken = hårt fel med förklaring, aldrig rapport. 4 test låser det. Grinden sitter i generatorn så admin-vägen inte kan kringgå den. ⚠ `DOLJ_RAPPORTER_I_KUNDVYN` står KVAR PÅ — gamla rapporter ska granskas en och en | Ja | Nej |
| Kunden sköter sina egna färger | KLART OCH VERIFIERAT | `/k/brand-kit` 11/8 (Håkans beställning). PUT på `/api/brand-kit` öppnad för kund — tenant-låst via `getActiveClientId` (session, aldrig kroppen). Åker på `profil`-modulen som syskonlänk, så alla med Brand-profil får den utan nytt paket. AI-knappen "Hämta från webbplatsen" dold i kundläge (rutten är inte kund-släppt i proxy) | **Ja** | Nej |
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

## MENY, CTA-STEG OCH BILDTEXT — Håkans verifiering 10/8, kvällen

| Post | Status | Bevis / återstår | Kundsynligt | UI-löfte |
|---|---|---|---|---|
| UTKAST-2 alla fem skaparytor töms vid klientbyte | KLART, EJ VERIFIERAT I DRIFT | `b60582d`, `tests/utkast2-alla-ytor.test.ts` (22 kontroller). Båda grindarna provade genom att brytas | Ja | Nej |
| BILD-10 bildmodellen skriver ingen text | KLART, EJ VERIFIERAT I DRIFT | `c8a9c4f`, `tests/bild10-ingen-text-i-bild.test.ts` (12). **Rotorsaken var beställningen, inte grinden:** `DEPICTED_MESSAGE` krävde en kort svensk rad på VARJE synlig skylt, och modellen kan inte stava ("HÄLLBARA PROFILER FÖR FRAMITDEN" hos AluCon). Text i bild kommer nu bara ur fältet "Text i bilden", som vi ritar själva. Funnen felstavning ger 502 i stället för att släppas igenom när omtagen eller tidsbudgeten tar slut | **Ja** | **Var ja — nu nej** |
| Utkastet bär klient-id inuti kuvertet | KLART OCH VERIFIERAT | `c8a9c4f`, `tests/utkast.test.ts`. Nyckeln kan inte upptäcka ett utkast som skrivits under fel kund — den är ju rätt. VERSION 1 → 2 slänger varje gammalt kuvert, inklusive de som bar Displaytekniks förslag i Håkans webbläsare | Ja | Nej |
| CTA-2 tre varianter är tre val | KLART, EJ VERIFIERAT I DRIFT | `1dd807a`, `tests/cta2-vagar.test.ts`. Väg framåt OCH perspektiv delas ut per variant, deterministiskt — varianterna körs parallellt och kan inte undvika varandra. ⚠ **Obevisat:** att texterna faktiskt blir olika i skarp körning. Grinden låser instruktionerna, inte modellens utfall. **★ Delvis stängd av TON-1 (12/8):** samma DoD mätte att krokarna och vägarna FAKTISKT skiljer sig i skarp körning mot två tenants | Ja | Nej |
| KUNSKAP-1 kundens egna ord vinner | KLART OCH VERIFIERAT | **12/8, `scripts/kunskap1-dod.mts` + `tests/kunskap1-ordlista.test.ts` (23).** ★ **Beställningens premiss var fel, och det är fyndet:** blogg- och inläggsvägen hämtar INTE kunskap olika. Mätt före kod: alla fyra flöden fick identisk profiltext (10 879 tecken), samma klippning, och ordet fanns i allihop. **Rotorsaken är att ordet aldrig DEFINIERAS** — hos For Balance står "regression" som produktrad ("resa till ett tidigare liv") och som prisrad i sektionen märkt "skrivs aldrig ut", aldrig som förklaring. En lång artikel har plats för sammanhanget bredvid; ett kort inlägg har det inte, och tomrum fyller en språkmodell med allmän kunskap. **Byggt:** fältet `ordlista` på `hm_brand_profile` ("ord = betydelse"), `lib/ordlista.ts`, eget lager i prompt-core — UTANFÖR profilklippningen (en definition som kan klippas är ingen definition) och sent bland innehållsreglerna. Inkopplat i KÄRNAN, alltså alla flöden. Plus skyddsnät: ämnesord som finns i den KLIPPTA profiltexten får en påminnelse om att profilens betydelse gäller. **Bevis:** blocket når alla fyra flöden; blogg, inlägg och bildtext ger terapibetydelse utan statistikvokabulär. ⚠ **Mätstickan rättades två gånger** — först fällde den rätt texter som använde andra synonymer, sedan fällde den den avgränsande meningen ("inte statistisk regression utan…") som ordlistan själv uppmanar till. ⚠ **Kontrollen är ärlig:** utan blocket blev texten rätt ändå i den körningen — profilraden räcker ibland på egen hand. Blocket tar bort slumpen, det är inte enda källan till betydelsen | **Ja** | **Var ja — nu nej** |
| TON-1 varje variant får sitt eget tonläge | KLART OCH VERIFIERAT | **12/8, `scripts/ton1-dod.mts` (18 kontroller, skarpt mot två branscher) + `tests/ton1-varianter.test.ts` (18).** **Håkans fynd:** "DISC etc ska ju variras och hänga med här, allt är hela tiden lika." Innehållsprofilen visade samma tre inställningar hela dagen och alla tre captionvarianterna delade dem — kroken och vägen framåt delades ut per variant (CTA-2), tonen gjorde det inte. Tre "olika" förslag skrevs i exakt samma tonläge. **Orsaken är CTA-2:s, en gång till:** `compass` skickas EN gång till prompt-core och hamnar i SYSTEMprompten, som är gemensam för alla varianter. Varianterna körs parallellt och kan inte se varandra — tonen måste DELAS UT, inte önskas. **Byggt:** `lib/ton-varianter.ts` delar ut D/I/S/C deterministiskt med innehållsprofilens val som variant 0 (dagens förslag körs alltså aldrig över, det får sällskap), och i A/B-läget lyfts DISC UR den delade prompten — låg den kvar skulle systemprompten säga ett tonläge medan variantinstruktionen säger ett annat, och modellen följer då tillståndet (`lesson_sjalvmotsagande_instruktion_ger_fabricering`). **Steg i kundresan och berättarform ligger kvar delade med flit:** de säger vad inlägget ÄR, och varieras de är det inte tre varianter av ett inlägg utan tre olika inlägg. **Bevis:** Displayteknik och For Balance, båda med profil I → varianterna fick I, D, S; tre olika krokar, tre olika vägar, tre olika öppningsfraser, och tonen syns i texten (I bär emoji och vision, D korta meningar och siffror, S vi-känsla). **Ytan mätt i DOM:en på inloggad Studio:** korten visar tonen i klarspråk, och att välja BERÄTTELSE-kortet flyttade innehållsprofilen I → S, så raden inte längre kan säga ett tonläge medan texten under är skriven i ett annat. ⚠ **Sanningsgrinden höll under det tonläge som lockar mest:** D-varianten skrev "sedan 2015" och "2 500–3 500 nits" — kontrollerat mot profiltexten, båda står där ordagrant. Förbehållet ligger i toninstruktionen själv, låst i test, eftersom D:s hook ordagrant är "rak siffra". ⚠ Tonen loggas inte i generationsloggen (ingen kolumn finns) — spridningen går alltså att SE i ytan men inte att mäta över tid | **Ja** | **Var ja — nu nej.** Raden lovade en ton som alla tre delade |
| PLAN-2 planeringen är ÄGARENS kalender | KLART OCH VERIFIERAT | `3ad04ca`, `tests/plan2-egen-kalender.test.ts` (7). **Ingen kunddata korsades:** routen kräver huvudadmin (`getAdminScope() !== null` → 403), hq-tabellerna och kalenderspegeln har ingen klientkolumn, och den klient-scopade menyn saknar hq-sidorna. Felet var att sidan inte SA det — beskedet stod bara i det okopplade läget | Ja | **Var ja — nu nej** |
| MENY-1 tre zoner efter åtkomst | KLART OCH VERIFIERAT | `0ed042f`, `tests/meny1-zoner.test.ts` (24). Ditt eget / Om valda kunden (rubriken bär kundens NAMN) / Kundens egna ytor. Zon 3 är bevisad mot `app/k/` på disk, inte bedömd. Testet låser att ingen av de 41 sidorna försvann och att ingen sida ligger i två zoner. Provad genom att brytas | Ja | Nej |
| CTA-3 steget följer funnel-nivån | KLART, EJ VERIFIERAT I DRIFT | `1a2391d`. Ett TOFU-inlägg om ångest slutade "Boka ett första samtal via länken i profilen". Kopplingen nivå → typ låg i en mjuk bisats, och då vinner den starkaste uppmaningen. Nu är STEGETS STORLEK utskriven per nivå i prompt-core OCH byggd i urvalet (`vagarForFunnel`), så en tofu-variant inte KAN få kontaktvägen. Kryphålen namngivna: länk i profilen, kostnadsfritt, "veta mer". Promptversion `v1-3b3ea753` → **`v1-8f88f1c5`**, låset fällde ändringen | **Ja** | **Var ja — nu nej** |
| T-6b-GRIND uppfunna minnen fälls i koden | KLART, EJ VERIFIERAT I DRIFT | `68efff2`, `tests/t6b-minnesgrind.test.ts` (16). **Kontrollerat i profilen 11/8 av Håkan:** kvinnan med panikångest finns INTE under Kundberättelser. Det som finns är en ordagrann Bokadirekt-recension under Kundernas egna ord (2026-07-24), med profilens egen anmärkning att den bara får användas avidentifierat. Modellen gjorde alltså en SCEN av ett CITAT och satte terapeuten som ögonvittne. **Strukturell orsak:** `KLIPPORDNING` i prompt-core klipper `Story-bank` FÖRST när profilen är för lång — vinkeln bad om en händelse ur en sektion som samma bygge kan ha lyft ut. Nu: saknas story-banken i den FÄRDIGA prompten byts vinkeln mot en generell igenkänningsscen; faller grinden görs ett omtag som också måste klara CTA-golvet; står minnet kvar KASSERAS varianten; blir alla kasserade pekar svaret på Brand-profil → Kundberättelser. Ordagranna citat passerar | **Ja** | **Var ja — nu nej** |
| VECKA-1 antalet inlägg är kundens val | KLART, EJ VERIFIERAT I DRIFT | `a432641`, `tests/kalender1-dra-flytta.test.ts`. Kalendervägen (CC-4) hade dagval sedan tidigare — Håkan bevisade det själv 11/8 med 3 dagar → 3 utkast. Veckoplanssidan räknade ALLTID sju. Nu tar `/api/generate/week` emot `dagar[]`; utan fältet är beteendet exakt som förut, och ett tomt eller obegripligt val ger hela veckan i stället för noll inlägg. Rollen hör till VECKODAGEN, så tisdag + torsdag ger de dagarnas roller — inte de två första i listan. Dagvalet töms vid klientbyte (fångat av UTKAST-2:s grind) | **Ja** | **Var ja — nu nej.** Sidan lovade sju inlägg |
| KALENDER-1 flytta inlägg genom att dra | KLART, EJ VERIFIERAT — OBEKLICKAD | `a432641`. `PATCH /api/content/item` skriver i rätt datumkolumn per källa (studio → `scheduled_at`, social och linkedin → `scheduled_for`). Bloggen utelämnad med flit: dess datum ÄR publiceringstiden på sajten. Publicerat flyttas aldrig, bakåt i tiden avvisas med schemaläggningens egen gräns, och både läsning och skrivning är tenant-låsta. Klockslaget följer med dagbytet. Optimistisk flytt som lägger tillbaka gamla datumet och visar felet om skrivningen inte gick igenom. ⚠ **Själva dragningen är inte klickad** — den kräver inloggad dashboard | **Ja** | Nej |
| BILD-11 "Ändra bild" gick inte att klicka | KLART OCH VERIFIERAT | `1a2391d`. Två likadana rutor en rad ifrån varandra, bara den nedre tänder knappen. Rubrikerna säger nu vilken bild var ruta gäller, knappen säger varför den sover, och text i fel ruta erbjuds med ett klick | **Ja** | **Var ja — nu nej** |

### Öppet efter kvällen

1. **Rotorsaken till hur Displaytekniks förslag hamnade under AluCons nyckel är inte fastställd.**
   Kuvertkontrollen fångar den nu oavsett var skrivningen kom ifrån, men själva vägen är inte hittad i koden.
2. ~~**"Jag minns en kvinna..." hos For Balance**~~ — **BESVARAD 11/8.** Håkan sökte i profilen:
   panikångest står i Smärtpunkter, i en Bokadirekt-recension under Kundernas egna ord, och i
   hashtag-basen. **Inte** under Kundberättelser. Regeln höll alltså inte, och grinden är byggd
   (rad ovan). Kvar hos Håkan: fyll i de kundberättelser som faktiskt finns, och avgör om
   recensionen får citeras ordagrant efter Gittes godkännande.
3. **Skarp körning av UTKAST-2, BILD-10, CTA-2, CTA-3, minnesgrinden, VECKA-1 och KALENDER-1
   återstår.** Instruktionerna och grindarna är låsta i test; vad modellen och webbläsaren gör med
   dem i drift är inte mätt. Håkan testar enligt Google-dokumentets 23 steg.
4. **NYTT FYND 11/8, EJ ÅTGÄRDAT: sifferkontrollen räknar tal ur kundcitat som tillåtna.**
   `tillatnaTal` i captionvägen byggs av `talTokens(bygg.profilText)`, och profiltexten innehåller
   Customer Voice. Talet "15–30 panikångestattack per dag" kommer ur en enskild kunds recension. Det
   passerade grinden korrekt enligt dagens regel, men blev ett allmänt påstående i en text om någon
   annan. **Beslut behövs:** ska ett tal ur ett kundcitat räknas som en verifierad siffra? G-4:s
   bevislager och prisregeln säger nej i andan, koden säger ja i praktiken.
5. **NYTT FYND 11/8, EJ ÅTGÄRDAT: fyra inläggssidor saknas i sidomenyn.** `/dashboard/veckoplan`,
   `/dashboard/dm`, `/dashboard/social` och `/dashboard/fordon-inlagg` nås bara via flikraden i
   `components/dashboard/PostsTabs.tsx` — alltså bara om man redan står på en inläggssida. Håkan
   hittade inte veckoplanen när han skulle köra steg 11 i testlistan. En sida som inte går att hitta
   finns inte (samma regel som fällde G-9:s kvalitetssida).
6. **NYTT FYND 11/8, EJ ÅTGÄRDAT: dra-och-släpp i kalendern är obeklickad.** Logiken är låst i test
   men själva dragningen kräver inloggad dashboard, och jag kan inte logga in. Första riktiga
   dragningen är beviset.
7. **NYTT FYND 11/8, EJ ÅTGÄRDAT — Håkans fråga: balansmätaren STYR INGENTING.** Han frågade om nya
   inlägg läggs "rätt" när mixen ligger fel. Svaret är nej. `planWeek()` i `lib/content-compass/rules.ts`
   tar emot bara schemat och ett startdatum och läser aldrig `analyzeMix()` — de två funktionerna sitter i
   samma fil utan att prata med varandra. Ligger tenanten på 33/33/33 mot målet 70/25 planeras nästa vecka
   ändå rakt enligt veckodagskartan. Två regler agerar, men bara inom veckan de bygger: max ett BOFU per
   vecka, och BOFU varannan vecka på låg takt. Panelen säger "Din mix mot målet" — ett löfte som ingen kod
   håller. **Dessutom:** veckodagskartan är byggd för sju inlägg. Snabbvalet 3 dagar (tis/tors/sön) ger
   `tofu · bofu · tofu` = 67 % TOFU, **0 % MOFU**, 33 % BOFU — kadensvalet ändrar mixen tyst, och åt fel
   håll. Mätaren räknar dessutom 30 dagar BAKÅT (`t <= now`), så en korrigerande vecka syns inte förrän
   datumen passerat. **Tre vägar lagda fram 11/8:** (1) låt `planWeek` läsa mixen och byta funnel på den
   dag som ligger längst från målet, med klarspråksnotering — rekommenderad, ca en session; (2) rätta
   snabbvalen så 3 dagar blir tis TOFU · tors MOFU · sön TOFU med BOFU varannan vecka, ca halv session;
   (3) låt det vara men sluta lova styrning i panelens text. **Håkans besked: lägg på minnet, han kollar
   vidare.** Ingen kod rörd.


## DM, AFFISCH OCH RÖST — Håkans testning 2026-08-11, eftermiddag och kväll

Alla rader nedan är pushade. Sju commits, i ordning: `4b0b361` · `7631208` · `98e332f` ·
`45a0727` · `803428a` · `365e7c5` · den sista i tabellen.

| Post | Status | Bevis / återstår | Kundsynligt | UI-löfte |
|---|---|---|---|---|
| AFFISCH-1 texten PÅ bilden | KLART, EJ VERIFIERAT I DRIFT | `4b0b361`, `tests/affisch1-krok-och-langd.test.ts` (15). Håkans dom: "innehållet var inte speciellt bra för ett inlägg". **Fyra fel, alla släppta igenom:** (1) ÖPPEN LOOP — krokens uppgift i `lib/hook-typer.ts` är att "öppna en loop läsaren vill veta slutet på", en CAPTION-instruktion. På en affisch finns inget senare, så "Två månader senare står skärmen fortfarande där…" blev en berättelse utan början vars slut är att konkurrenten vinner. (2) LÄNGDEN — prompten ber om ~90 tecken, grinden släppte 150, hans text var 135. Taket är nu 105. (3) KOMMASTAPLING — staplingsgrinden räknade bara `. ! ? : ;` medan texten var staplad med kommatecken: en sats enligt gamla räkningen, fyra tankar i praktiken. (4) UPPREPNING — badgen sa samma sak som brödtexten. Två fel fångades av testet under bygget: "efter ett halvår" saknades i tidslistan, och ett `\b` hade blivit ett backspace-tecken så tredje mönstret aldrig matchade | **Ja** | Nej |
| BILD-12 skärmen visar köparens värld | KLART, EJ VERIFIERAT I DRIFT | `7631208`, `tests/bild10-ingen-text-i-bild.test.ts` utökad. Håkan fick berg, isberg och frukt på skyltarna hos ett SKYLTBOLAG: "vem visar ett isberg på en skärm". **Rotorsaken var min egen ändring dagen före:** BILD-10 förbjöd text och raden slutade "om en skärm måste synas visar den ett foto eller produkten" — och "ett foto" läste modellen som fritt val. Värst just där: för ett skyltbolag ÄR innehållet på skärmen produkten. Nu hör bilden till köparens egen värld, dekormotiven är utpekade med namn, och vägen ut är att visa skärmen SLÄCKT — en släckt skärm är ärlig, ett fjällpanorama är det inte | **Ja** | Nej |
| KARUSELL-2 punktsiffran | KLART OCH VERIFIERAT | `7631208`, `tests/akut-karusell.test.ts` utökad. `punktNummer(...) ?? 0` ritade nollan som **"00"** — insats- och bevis-sliden är `kind: "point"` men inte användarens punkter, så de får med flit inget nummer och fick därför noll. Uträkningen var rätt hela tiden; mallen förvandlade "inget nummer" till "nummer noll". Håkans besked: siffran tillför inget. Den är AV som standard, `overrides.visaPunktNummer` tänder den — G-2-arbetet är tystat, inte rivet | **Ja** | **Var ja — nu nej** |
| MENY-2 DM och veckoplanen i menyn | KLART OCH VERIFIERAT | `45a0727`, `tests/meny1-zoner.test.ts` utökad. Båda sidorna fanns men nåddes bara via flikraden i `PostsTabs` — alltså bara om man redan stod på en inläggssida. Han hittade inte veckoplanen när han skulle köra steg 11, och inte DM alls. Kvar utanför menyn med flit: `/dashboard/social` (legacy, ska bort per REV-4) och `/dashboard/fordon-inlagg` (ingen kundmotsvarighet) | **Ja** | Nej |
| DM-2 + DM-3 redigeringen | KLART, EJ VERIFIERAT — OBEKLICKAD | `45a0727` + `803428a`. Redigeringen låg INNE i kanban-kortet: tre rader i minsta textstorlek i en smal kolumn, och kortet växte så kolumnen hoppade. Nu egen yta, 90 % av fönsterhöjden, fältet i brödtextstorlek. **DM-3:** ytan äger nu VARJE fält kortet bär (namn, användarnamn, kanal, källa, läge, bokad tid, påminnelse, nästa steg, anteckningar) — PATCH-routen accepterade dem redan. Kortet håller inget eget formulärstate längre (två kopior glider isär), och ett misslyckat sparande visas i stället för att se ut som att det gick igenom | **Ja** | Nej |
| ROST-1 dikteringen hamnar i rätt fält | KLART, EJ VERIFIERAT — OBEKLICKAD | `803428a`, `lib/ai/faltfordelning.ts` + `app/api/ai/rost-till-falt/route.ts`, `tests/rost1-faltfordelning.test.ts` (29). Han sa "Elisabeth Andersson" i mikrofonen och namnet landade i ANTECKNINGAR. **Skärmdumpsvägen kunde fylla varje fält sedan tidigare; rösten hade aldrig fått samma behandling.** En yta skickar nu sitt fältschema och transkriptionen sorteras. Hårt mot tyst felplacering: bara nycklar ur schemat, ett val bara ur rutans egna alternativ, ett datum bara i fältets exakta form — och allt som kastas följer med till anteckningarna, för en tappad diktering är värre än en felplacerad. Användaren får en klarspråksrad om vad som hamnade var. Fail-open i varje led | **Ja** | **Var ja — nu nej** |
| DM-4 sju steg som grundplanen | KLART OCH VERIFIERAT (mot skärmbild) | `365e7c5`, `migrations/dm_vilande.sql` **KÖRD** (HTTP 201), `tests/dm4-sju-steg.test.ts` (19). Skärmbilden från MySales (AluCon, Kund pipeline) visar sju fack: Ny · Bekräftad · Dialog · Erbjudande · Bokad · Vilande · Förlorad. DM hade FYRA kolumner, Bokad och Förlorad i en lista under tavlan, och **Vilande fanns inte alls** — inte som kolumn, inte i formulären, inte som tillåtet värde i databasen. **Tre handskrivna kopior** av samma pipeline (`STAGES` 4, `LAGEN` 4+2, `STEG_VAL` 6) blev en; ingen av dem hade Vilande, och en `<select>` som saknar ett fack gör facket oanvändbart. **Räkningen "i pipeline"** byggde på "alla minus bokade och förlorade" och hade räknat en parkerad kontakt som pågående arbete — samma sammanblandning som FIX-1 B2, fast åt andra hållet. CHECK-villkoret släpps via `pg_constraint` i stället för med ett gissat namn: tabellen skapades utanför repot | **Ja** | **Var ja — nu nej.** Rubriken räknade upp fyra steg |
| DM-4b tavlan går att läsa | KLART, EJ VERIFIERAT — OBEKLICKAD | Sista commiten. "Det går ju inte att läsa kortens rubriker, duger inte." Sju kolumner i ett RUTNÄT delade bredden på sju → 130 px per fack, alltså "Bekr…", "Erbju…", "Vilan…", "Förlo…" och avhuggna namn. Ett rutnät är fel verktyg för en pipeline: det krymper kolumnerna när facken blir fler. Nu fasta kolumner på 272 px som rullar i sidled, som MySales egen tavla. Facknamnet och kontaktnamnet huggs aldrig av, och knappraden bryter i stället för att klippa "Kundregister" till "K" | **Ja** | Nej |

### FIX-1 B2 — blockeraren är borta

Skärmbilden 11/8 visar att facket **"Förlorad / Paus (nurture)" är delat i MySales**: Bokad,
Vilande och Förlorad är nu tre egna fack. Det var spärren sedan 9/8, den som fick **varje
parkerad kund att räknas som en förlorad affär**. Koden (`arVilande`, `harledSteglage` i
`lib/hq/pipeline.ts`) är byggd och medvetet tyst tills steg-id:t pekas ut. **Kvar hos Håkan:**
peka ut Vilande-stegets id, sortera de 12 affärerna. Kvar att bygga: VILOZON i UI:t, kravet på
återkontaktsdatum, uppgiften i Fokus idag när datumet infaller.

### AFFÄRSVY-1 — beställd 11/8, EJ PÅBÖRJAD

Kunden ska se affärsrörelsen i Cockpit utan att byta system: rutan "På gång just nu" i
kundvyn, en affärsrad i veckorapporten, och fellägen i klartext. Cockpit LÄSER från GHL och
skriver ingenting, ingen AI i etappen. DoD mot två tenants (DT med separat affärspipeline och
belopp på, en coachingtenant med enkel pipeline och belopp av).

**Första hindret, hittat vid kartläggningen och värt att veta innan bygget:** `hamtaHqGhl()` i
`lib/hq/pipeline.ts` slår upp **Displaytekniks** klientrad specifikt (`DT_CLIENT_ID`, eller
namnet som reserv). Läsningen är alltså inte per tenant idag, och `hq_pipeline_cache` har ingen
klientkolumn i det som lästs. Att göra läsningen tenant-buren är etappens första arbete, inte
en detalj i den — och utan det kan DoD:n mot en coachingtenant inte köras.


### Kvällens fyra sista (11/8) — alla pushade

| Post | Status | Bevis / återstår | Kundsynligt | UI-löfte |
|---|---|---|---|---|
| DM-4c + DM-4d tavlans bredd | KLART, EJ VERIFIERAT — OBEKLICKAD | `0bfefaa` + `6f5543f`. Tre försök innan rätt: (1) `grid-cols-7` delade bredden på sju → 130 px per fack; (2) fasta kolumner + `overflow-x` gav läsbara fack men sidledsrullning, avvisat: "vi kan inte ha så man behöver skrolla i sidled"; (3) två rader 4 + 3 — läsbart, men "det finns ju tom yta till både höger o vänster". Rotorsaken var att innehållet kapades till 1280 px (`max-w-7xl`) medan skärmen är bredare. `BREDA_SIDOR` i dashboard-layouten ger tavelsidor `max-w-none`; listan har EN sida med flit, eftersom löptext på 1600 px är svårläst | Ja | Nej |
| DM-4e tavlan mäter sin EGEN yta | KLART, EJ VERIFIERAT — OBEKLICKAD | `25ca976`, `tests/farg1-spara-brandkit.test.ts`. **Min egen regression, upptäckt av Håkan en halvtimme senare:** `2xl:grid-cols-7` mäter FÖNSTRET, men tavlan får bara den yta sidan ger den. Kundportalen (`/k/dm`, samma komponent) fick inte den breda sidan — så sju kolumner blev ~110 px och kontaktnamnet radbröts bokstav för bokstav. "För i helvete vad fult." Nu `@container` på sidans rot + `@[1400px]:grid-cols-7`, alltså mätning på den faktiska bredden i BÅDA ytorna. Grundläget är fyra per rad: värsta utfallet om mätningen inte slår till är två rader, aldrig 110 px. ⚠ **Samma misstag två gånger samma dag:** en JSX-kommentar som första syskon inne i `{!loading && (…)}` är inte giltig JSX — fångat av tsc båda gångerna | Ja | Nej |
| ROST-2 röstfelet säger vad som gick fel | KLART, EJ VERIFIERAT — OBEKLICKAD | `d42efc4`, `tests/rost2-felorsaker.test.ts` (18). Han sa "Eva Andersson via LinkedIn", fick "Kunde inte uppfatta rösten, försök igen" och frågade om tokens tagit slut. **Det var inte tokens** — kvot, betalning och kostnadstak har egna texter sedan 1/8, och budgetstoppet svarar 429 med sin egen rad. Men raden för "inget användbart transkript" slog ihop TRE lägen: tystnad (`[INGET_TAL]` — kort klipp, låg nivå, fel mikrofon; användaren kan agera), eko (modellen upprepade instruktionen) och tomt svar. De två sista är interna fel, och "försök igen" fick honom att prata tydligare i onödan. Nu egen text per läge, orsaken i svaret, och loggen bär orsak + längd + RÅSVARET. Vid tystnad och kort klipp står längden i felet ("inspelningen var 1 sekund"). Den släckta "Lägg till"-knappen säger nu i text att namn eller användarnamn behövs — skälet stod bara i en hover-titel | **Ja** | **Var ja — nu nej** |
| FARG-1 ändrad färg går att spara | KLART, EJ VERIFIERAT — OBEKLICKAD | `25ca976`, `tests/farg1-spara-brandkit.test.ts` (10). "Det går ju för fasen inte att spara en ändrad färg… finns ingen spara knapp." Knappen FANNS — i hjälmen, tre skärmhöjder upp från färgrutorna, och ingenting sa att något var osparat. Två fel i samma upplevelse: åtgärden utom synhåll, tillståndet osynligt. Nu håller sidan en kopia av det SPARADE kitet och skillnaden mot det visade ÄR det osparade (ingen egen dirty-flagga som kan glömmas att nollas). Osparat → en list fast längst ner med Spara och "Ångra ändringarna", som försvinner när allt är sparat. Snapshoten flyttas fram FÖRST när servern svarat ok, annars hade "osparat" slocknat fastän ändringen aldrig kom fram. Webbläsaren frågar innan fliken stängs med osparat | **Ja** | **Var ja — nu nej.** Sidan såg ut att sakna sparning |

### AluCons gula accentfärg — DATA, inte kod

Den gula accenten kommer ur AluCons brand kit i databasen, inte ur någon default i koden.
Den går nu att byta och spara (FARG-1 ovan). **Kvar hos Håkan:** välj färgerna för AluCon och
spara — och samma genomgång för övriga tenants, eftersom en accentfärg som inte hör till
varumärket syns i varje bild och varje CTA-bricka som mallen ritar.

### Deploy-kontroll utan gissning (11/8)

Håkan såg den trasiga tavlan EFTER att fixen pushats och frågade om den var ute. Svaret gick
att verifiera i stället för att gissa: **CSS-bunten är publik.** Hämta ett `<link rel=stylesheet>`
från `cockpit.gripcoaching.se` och sök i texten.

- Före deploy: bara `96rem` (fönsterbrytpunkten `2xl`), inget `container-type`, inget `1400px`.
- Efter deploy: `@container (min-width:1400px){.@[1400px]:grid-cols-7{…}}` och `container-type`.

Nyttigt varje gång något "ser gammalt ut": en 200 från servern säger ingenting om vilket bygge
som ligger där, men en klass som finns eller inte finns i CSS:en gör det. Och kom ihåg att
webbläsaren kan sitta kvar på den gamla filen — hårdladda innan du drar en slutsats.

### KLART 12–13/8 (allt pushat, `0c9c5d5`, sajten 200)

| Post | Status | Kärnan |
|---|---|---|
| OFFERT-2 offertmotorn | KLART, EJ KLICKAD | Kurs live från Riksbanken + marknadsbild med källor. Aldrig en gissad kurs |
| TON-1 tonlägen per variant | KLART OCH VERIFIERAT | Tre förslag = tre tonlägen. Mätt mot två branscher |
| MODELL-1 specialistens modell | KLART, EJ KLICKAD | `model:` i .md lästes ALDRIG — routen körde hårdkodad sonnet-4-5. Offertmotorn kör nu Fable 5. ⚠ **Migrationen `modell1_fable_pris.sql` måste köras**, annars faller den tillbaka |
| FONT-2 + KLARSPRÅK-1 | KLART OCH VERIFIERAT | text-xs 13→14, text-sm 15→16. "Konträr" → "Tvärtom" |
| KUNSKAP-1 + 1b | KLART OCH VERIFIERAT | Systemet läser ut ordets betydelse ur kundens EGEN profil. Ingen ordlista behöver fyllas i |
| KUNDREGISTER-1 | KLART OCH VERIFIERAT | 137 kontakter hos DT. ⚠ For Balance + AluCon ger 401 — nycklarna saknar kontakt-scope |
| FÄRG-2 + FONT-3 | KLART OCH VERIFIERAT | For Balances palett mätt på hennes sajt. Kalnia tillagd (OFL) |
| S-6 hämtningen | KLART, EJ VERIFIERAT I DRIFT | Djupgranskningens 500 mot forbalance.se. ⚠ **Härledning, ej återskapat fel** |

### VÄNTAR PÅ HÅKAN (blockerar annars)

1. **Kör migrationen** `node scripts/kor-migration.mjs migrations/modell1_fable_pris.sql --ja` — utan den kör offertmotorn kvar på sonnet-4-5.
2. **Kontakt-scope i MySales** för For Balance och AluCon, annars är deras kundlistor tomma (med felmeddelande, inte tyst).
3. **Kör djupgranskningen på For Balance** — det är enda beviset för att S-6 löste 500:an.
4. **Klicka igenom** offertmotorn och MODELL-1 (obeklickade).

### BESTÄLLT, EJ PÅBÖRJAT

**KANAL-2** (ersätter KANAL-1 helt). Verifieringen hans DEL 1c bad om ÄR gjord mot DT:
`google/location`, `facebook/page`, `instagram×2`, `linkedin/page`, `linkedin/profile` — sex
konton, inget utgånget. **GBP kommer redan med i API-svaret som `platform: "google"`** —
kanalväljaren filtrerar bort den. Låsningen sitter i `CHANNELS` i StudioMaker (hårdkodad
lista på tre) och `channelCaptions` (fast objekt med tre nycklar), inte i integrationen.
TikTok/Pinterest/YouTube/Threads/Bluesky är inte kopplade hos DT → ska gråas, inte döljas.
⚠ **Ej verifierat:** om publiceringsanropet accepterar ett Google-konto och vilka extra fält
GBP kräver (knapp + mål-URL). Kräver dokumentation eller en skarp testpublicering — den
senare är vad DoD:n begär, och Håkan ska säga ja innan något publiceras mot hans Google-profil.

### START HÄR I NÄSTA SESSION

1. **Håkan testar de sju obeklickade fixarna från i dag** (DM-tavlan, redigeringsytan,
   röstfördelningen, röstfelen, brandkit-sparningen, affischtexten, skärminnehållet i bilder).
   Allt är låst i test men ingenting är klickat av mig — jag kan inte logga in.
2. **AFFÄRSVY-1 är beställd och ej påbörjad.** Första hindret är kartlagt: `hamtaHqGhl()` i
   `lib/hq/pipeline.ts` slår upp **Displaytekniks** klientrad specifikt (`DT_CLIENT_ID`, med
   namnet som reserv), och `hq_pipeline_cache` läses utan klientfilter. GHL-läsningen måste bli
   tenant-buren FÖRST, annars kan DoD:n mot en coachingtenant inte köras.
3. **FIX-1 B2 kan avslutas.** Facket är delat i MySales; kvar är att peka ut Vilande-stegets
   steg-id och sortera de 12 affärerna, sedan går VILOZON att bygga.
4. **Öppna beslut som väntar på Håkan:** ska ett tal ur ett kundcitat räknas som verifierad
   siffra (sifferkontrollen släpper det i dag)? Ska balansmätaren styra planeringen eller bara
   mäta? Får Bokadirekt-recensionen citeras ordagrant?

## GRANSK G-0..G-9

| Post | Status | Bevis / återstår | Kundsynligt | UI-löfte |
|---|---|---|---|---|
| G-0 read-only-rapport | KLART OCH VERIFIERAT | `docs/gransk/G0-RAPPORT.md` | Nej | Nej |
| G-1 generationsloggen | KLART OCH VERIFIERAT (G-1a+b) | **Kört skarpt 9/8, `scripts/g1-dod.mjs`:** ett riktigt karusellanrop gav rad `71c8ea14` i `generation_log` med `syfte=karusell`, **`format=karusell`** (G0 0.4 punkt 2 stängd — karusell är inte längre samma rad som en statisk bild), `prompt_version=v1-712d3248`, `funnel=tofu` (syftets mjuka default, inte null), `varianter=5`, promptlagren, och **`ai_usage_event_id` kopplat till gemini/gemini-2.5-flash**. 12 kontroller gröna. Migration körd via Management API (15 kolumner, 7 index, RLS på, vy skapad). Promptversionen räknas ur regeltexten, inte ur ett handhållet nummer, och är låst i test. Inkopplad på **den obligatoriska vägen** (`lib/ai-usage`) i stället för på 21 ställen: båda ingångarna (`anropaProvider` + `loggaAnrop`) loggar, och sex kundtextflöden skickar sin metadata — karusell, studio-text, caption, LinkedIn, nyhetsbrev, reels, DM-svar. **G-1c klar samma dag:** genererings-id:t reser hela vägen — `generateCarousel` → routen → StudioMakers state → sparningen → `kopplaTillInlagg`. Bevisat i samma DoD: raden `8f88e0b1` fick `anvand_i_tabell=studio_posts` och `anvand_i_id=acf330a8`, och vyn räknar `publicerade: 1`. Id:t nollas efter kopplingen så samma generering inte kan bindas till två inlägg. **Alla flöden inkopplade och körda skarpt** (`scripts/g1c-flodena-dod.mjs`): LinkedIn → `linkedin_posts`, caption → `studio_posts`, reels → `studio_reels`, karusell → `studio_posts`. Klienten håller en LISTA av id:n, inte ett — ett karusellinlägg kommer ur både karusell- och captiongenereringen. **19 enhetstester + 16 + 14 DoD-kontroller.** ⚠ **Nyhetsbrevet är OBEVISAT och ligger kvar så** (Håkans beslut 9/8): kopplingen är kodmässigt identisk med reels, men modulen är av för **samtliga** klienter (kontrollerat i DB). Ingen åtgärd nu — bevisas när första kunden får modulen påslagen | Nej | Nej |
| G-2 formatanatomier som data | KLART OCH VERIFIERAT | **Kört skarpt 9/8, `scripts/g2-dod.mjs` (11 kontroller).** `lib/format-anatomi.ts` = anatomierna som data. **Story finns nu som syfte** (`TextSyfte`, egen anatomi, kopplad i `lib/studio/copy.ts` på 9:16 utan video) — bevisat: en story gav "Öppet till 18 idag", 4 ord, och raden i loggen bär `syfte=story`. **Karusellanatomin ur data** — rollista, anatomitext, JSON-schema och slide-räkning kommer nu ur SAMMA källa (förut tre uttryck på tre ställen); 4 punkter gav exakt 6 slides. Insats- och bevis-roller finns som valbara, av som standard. **Alla fyra reelmallar börjar med krok** — "Före och efter" saknade den helt och började med 3 s problem. **Säkerhetszon för statiska format** (`SAKER_ZON` + bildrad). **Skenfrågegrinden når alla flöden** via `rattaSkenfragor` i `saneraText`, deterministiskt. **Hashtags går genom prompt-core** — loggas nu med promptversion. **20 enhetstester.** ⚠ Insats/bevis styr dramaturgin i prompten men landar som `point` i payloaden: mallarna ritar tre roller | Ja | Nej |
| G-3 hook-lagret (a+b+c+d) | KLART OCH VERIFIERAT | **RÄTTAD NIVÅ 11/8:** raden stod som PÅBÖRJAT medan dess egen bevistext beskriver alla fyra delarna som klara och bevisade (`scripts/g3d-dod.mjs`, 18 kontroller, 15 enhetstester). Ingen ny kod — en nivå som låg efter sitt underlag. **9/8:** `lib/hook-typer.ts` — EN lista i stället för tre. G-0 hittade tre osammanhängande: playbookens fem typer, VARIANTREGELNS åtta ingångar och DISC:ens fyra tonlägen. De var tre olika INDELNINGAR av samma sak, delvis motstridiga. Playbookens fem är nu stommen (flödena namnger dem redan i sin JSON), VARIANTREGELNS extra ingångar blev VINKLAR inom en typ. `kraver`-fältet bär materialkravet hos typen själv, så varje flöde kan ställa samma fråga — förut låg den kunskapen bara i `lib/studio/copy.ts`. `VARIANTREGEL` byggs ur listan. ⚠ **Fångat av test:** den genererade texten tappade först förbehållet "endast verifierad ur profilen" — utan det blir regeln en uppmaning att hitta på ett tal. Förbehållet följer nu med typen. Promptversion `v1-5082a4b7` → `v1-32a4ec3d`, låset fällde ändringen. **G-3b, `hook_typ` skrivs nu:** kolumnen har funnits sedan G-1 utan att någon skrev den — en kolumn som alltid är tom är samma tysta lösa löfte som resten av dagen handlat om. `iterateGenerate` tar `hookTyper[]` i samma ordning som `variantSuffixes`, och eftersom **varje variant är ett eget betalt anrop** får varje variant sin EGEN rad med rätt hooktyp. En sammanslagen rad hade dolt spridningen, som är hela poängen med iterationsloopen. **G-3c klar:** `copy.ts` ställer nu materialfrågan till `lib/hook-typer` i stället för att ha egen kod — bildrollen ägs kvar där (bara det flödet vet något om den). `tests/g3-hooktyper.test.ts` (11 tester) innehåller ett **ekvivalenstest** som kör gammal och ny regel mot alla bildroller × all täckning: uppstädningen fick inte vara en tyst regeländring. **G-3d KLAR 9/8:** `nyligen` nådde 4 av 21 anropsställen (G-0 mätte 2, två kopplades in däremellan) → nu **14 av 21** genom `lib/rotation.ts`, som ger varje flöde EN källa till sin egen historik. Nya inkopplingar: karusell, studio-text/story, reel, nyhetsbrev, blogg (två vägar), veckoplan (två vägar), enskilt, fordon och **nattloopen** — det flöde där rotationen betyder mest, eftersom den kör varje natt mot samma profil med samma uppdrag och utan undvik-lista producerade samma idé om och om igen. De 7 återstående är MEDVETNA undantag med skäl i koden: `kanal-anpassning` ×4 (skriver om en text användaren just lämnat in — undvik-listan hade dragit omskrivningen bort från det den ska behålla), `dm-svar` (ett svar till en person, inte ett inlägg i en serie), hashtags (ska vara KONSEKVENTA över tid, annars byggs ingen sökbar tagg) och interaktiv specialist (`specialist_runs` blandar alla specialister — de senaste raderna är oftast någon annans svar). LinkedIn-idéer behåller sin egen läsning: den bär pelarprefix och status-filter som den generella källan inte modellerar, och en tyst "uppstädning" hade tappat båda. **Bevis:** `scripts/g3d-dod.mjs` 18 kontroller, före/efter mot skarp tenant. **15 enhetstester.** ⚠ Fem källor är inkopplade men ännu obevisbara i skarp data (nyhetsbrev 1 rad, reel 2, veckoplan 1 tenant) — redovisas som "ingen historik", aldrig som godkänt | Ja | Nej |
| G-4 bevis-motorn | KLART OCH VERIFIERAT | **9/8, `scripts/g4-dod.mjs` (19 kontroller) + `tests/g4-bevis.test.ts` (19 tester).** **Fyndet som blockerade etappen:** bevis-motorns utpekade huvudkälla — "profilens verifierade siffror" — fanns inte som fält. Enda numeriska fältet var `pricing_notes`, exakt det som prisregeln spärrar. Mätt över alla nio profiler: **20 av 51 tal som profilmätaren räknade som "siffror vi får använda" fanns BARA i pricing_notes** (For Balance 17 av 31). Nivå 5 heter "Med bevis" och lovar "texterna kan använda dina siffror" — ett löfte ingen kod kunde hålla. Åtgärdstexten bad dessutom kunden lägga in **priser** som bevissiffror. Håkans beslut 9/8: bygg fältet + rätta räkningen. **Byggt:** migration `g4_bevis.sql` (`verified_numbers`, körd), `lib/bevis.ts` (bevisläget per tenant + promptblocket), lagret inkopplat på KÄRNANS väg i `prompt-core` (når alla anropsställen, inte 21 ändringar — samma val som G-1), ny ruta "Siffror du kan stå för" i profilformuläret, och prisrutans hjälptext rättad (den lovade förut att priser skulle användas i inlägg — motsatsen till prisregeln, och sannolikt källan till missförståndet). Mätaren räknar inte längre `pricing_notes`; **ingen tenant byter nivå** av rättningen (kontrollerat: de tre som klarade fem siffror klarar det utan priserna). **Två grenar, och det är hela poängen:** med material blir lagret en INBJUDAN med siffrorna uppräknade; utan material ett uttryckligt FÖRBUD ("skriv helt utan sifferpåståenden", inkl. förbud mot antydd mätning som "många kunder vittnar om"). Ett tomt lager plus en anatomi som kräver bevis ÄR beställningen att fabricera. **Vinnande exempel förblir stilreferens**, aldrig citatkälla — en färdig text är ingen kontrollerad uppgift. **★ Karusellens bevis-slide är PÅ**, men gatad på faktiskt material: 7 slides hos Opticur (har bevis), 6 hos AluCon (har inte). **Bevis:** lager.bevis=true hos Opticur, false hos AluCon; **kundvägen bevisad före/efter** — AluCon gick false → true enbart av att ett värde skrevs i den nya rutan via samma API som formuläret, och fältet återställdes efteråt; **0 prisläckage** i 3 genereringar på prisfrågande ämnen mot For Balance (den tenant där risken är störst). Promptversion `v1-32a4ec3d` → **`v1-b9ab87e2`**, låset fällde ändringen. ⚠ Payloadens slide-typ har fortfarande tre roller — insats/bevis landar som `point` (känd G-2-gräns): antalet slides bevisar att rollistan bar bevis-sliden, inte att sliden bär ett bevis | Ja | **Var ja — nu nej** |
| G-5 CTA-motorn | KLART OCH VERIFIERAT | **10/8, `scripts/g5-dod.mts` (16 kontroller) + `tests/g5-cta-motor.test.ts` (25 tester).** **Rotorsaken satt i EN parentes:** vid mjukt satt funnel lades raden "(väg in den bara om inget annat framgår av ämnet)" EFTER hela compass-blocket. Blocket bär både funnel-nivån OCH CTA-typen, så mjukningen gällde båda. Nivån skulle vara mjuk (avsett), typen blev det också (inte avsett) — kvar stod bara golvets krav på en imperativ, vilket ger "Hör av dig gärna" och inget mer. **Byggt:** `CTA_TYP_KRAV` i prompt-core — typen är hård i ALLA tre grenarna (satt compass, mjuk default, ingen compass), mjukningen omformulerad så den träffar nivåns TYNGD. Plus en deterministisk grind, `harCtaVag` + `CTA_VAG_SKARPNING` i `sakerstallCaption`: golvet kontrollerade bara att en uppmaning FANNS, och "Hör av dig" passerade — verbet står i golvets egen godkända lista. Grinden kollar att avslutet NAMNGER en väg (kanal, länk, nyckelord, plats eller handling med konkret objekt) och gör exakt EN omgenerering, fail-open som resten. **BOFU orört:** typkravet säger uttryckligen att man aldrig byter till säljande uppmaning om inte ämnet handlar om att köpa; 57 genereringar i mätfönstret, noll fick bofu. **Bevis:** 12 skarpa captions över TVÅ branscher (For Balance, Engens Träd) — 12/12 slutar med en uppmaning som leder någonstans. ⚠ **Två fel som DoD:n hittade och som är rättade:** (1) första DoD:n var `.mjs`, kunde inte importera writing-rules, hoppade över hela mätningen och rapporterade ändå grönt — ihåligt grönt, nu `.mts` med import av produktionskoden; (2) grinden underkände fyra fungerande avslut i rad hos Engens ("Skicka en bild på trädet så tittar vi på det") — handlingens objekt ÄR vägen. Rättat och låst med fyra regressionstester. Promptversion `v1-b9ab87e2` → **`v1-3b3ea753`**. **Mottagarsidan för nyckelords-CTA är fortfarande inte byggd** (Håkans beslut) — noterad i koden vid `BOFU_CTA_MALL`: `/api/lobby/*` kan inte registrera en kommentator som lead. Hanterbart eftersom bofu aldrig är default; slås bofu på brett måste mottagarsidan byggas FÖRST | Ja | **Var ja — nu nej** |
| G-6 bildfeedback | KLART OCH VERIFIERAT | **10/8, `scripts/g6-dod.mts` (20 kontroller) + `tests/g6-bildfeedback.test.ts` (9 tester).** **Fyndet:** tummen lovade kunden "Bra bild — AI lär sig". Löftet var tomt i fyra led. (1) Bara legacy-vägen läste feedbacken; Studios Bildhjälpen — den väg kunderna faktiskt använder — läste den aldrig. (2) Bara ett betyg sparades, inget skäl. (3) Ingen koppling till genereringen. (4) **Mätt: alla tre rader som någonsin sparats har `client_id = NULL`** (skrevs i april, före multi-tenancy) och läsningen filtrerar på just det fältet — de tre tummarna har alltså aldrig påverkat en enda bild. Raderna lämnas orörda; en gissad tenant är värre än en tom historik. **Byggt:** migration `g6_bildfeedback.sql` (`generation_id` + `kommentar` + index, körd), `lib/bildfeedback.ts` (läsning + promptblock), inkopplat i `/api/studio/suggest-image`, feedback-routen tar kommentar och genererings-id, och tumme + fritextruta i StudioMaker. **Bildvägen loggar nu i generationsloggen** — den gjorde det inte alls förut, så `motiv_kategori` (byggd i G-1) bar aldrig ett värde. Egen regelversion `bild-v1`, eftersom bilden inte har någon prompt-core-prompt. **Routen var dessutom oskyddad:** den skrev med anon-nyckeln och saknade auth-grind helt; nu service-role + `requireAdminOrCustomer` som resten av kundvägarna. **Designbeslut:** kritiken väger tyngre än berömmet och ligger SIST i blocket ("choose a different subject entirely"), berömmet är en riktning som inte får kopieras rakt av. Skilt från rotationen (G-3d): rotationen säger "variera", feedbacken säger "det HÄR var fel". **Bevis:** hela kedjan körd skarpt — bild → rad i loggen med `syfte=bild`/`motiv_kategori=standard` → omdöme med kommentar bundet till genererings-id → nästa bildprompt bär kundens egna ord ordagrant. `rating=0` avvisas med 400. DoD:n städar efter sig | **Ja** | **Var ja — nu nej** |
| G-7 blindtest mot ribba | BESTÄLLT, EJ PÅBÖRJAT | — | Ja | Nej |
| G-8 mätloopen | BESTÄLLT, EJ PÅBÖRJAT | Kräver Meta-omkoppling per tenant | Ja | Nej |
| G-9 kvalitetssidan | KLART OCH VERIFIERAT | **10/8, `tests/g9-kvalitet.test.ts` (9 tester) + skarp läsning mot dev.** `/dashboard/kvalitet` + `/api/kvalitet` visar vyn `generation_per_promptversion`: antal, kasserade, publicerade och `utan_kostnadskoppling` per promptversion och syfte. **Beställningens hårda krav ("visa aldrig en nolla som ett mätvärde") är byggt som kod, inte som en formulering:** routen räknar ingen andel under 20 genereringar utan lämnar fältet `null`, och sidan skriver då "(för få — 5 av 20)". Tre lägen hålls isär: MÄTT, FÖR FÅ och SAKNAS — och SAKNAS säger rakt ut att data saknas i stället för att visa en tom tabell. Databasfel ger 500 med `rader: null`, aldrig en tom lista (en tom lista hade lästs som "inga genereringar"). Sidan sätter **inget betyg** — ett test låser att svaret inte innehåller fält som `score`/`betyg`/`rating`. **Bevisat mot riktig data:** 275 genereringar, 6 regeluppsättningar, 2 utan kostnadskoppling (bildvägen, som G-6 kopplade in). **Två saker som bara syntes genom att läsa den riktiga sidan:** (1) `0` följt av `0 %` renderades som "00 %" — nu parentes; (2) DoD-skriptens egna körningar ligger i siffrorna och visar 0 publicerade, vilket står utskrivet på sidan i stället för att tolkas som dålig kvalitet. Länkad i sidomenyn under Överblick — en sida som inte går att hitta finns inte | Nej | Nej |

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
| OFFERT-2 O-1 produktdatabasen | KLART, EJ VERIFIERAT | `b8ae213`, `tests/offert2-inkopsdata.test.ts` (22 tester) | Nej | Nej |
| OFFERT-2 offertmotorn (specialist 17) | PÅBÖRJAT | **⚠ OSTAGAT I ARBETSTRÄDET 11/8, alltså utanför git-historiken.** Oskrivna i git: `lib/offert/underlag.ts`, `prompts/specialists/17-offertmotorn.md` och två testfiler. Ändrade: `lib/offert/fx.ts`, `lib/specialists.ts`, `components/OffertSkapa.tsx`, `lib/iterate.ts`, specialist-routen och två sidor. Innehåll: valutakurs live från Riksbanken med buffert och åldersvarning, marknadsbild med citerade källor, kundtyp med partnerpris ~82 %. Byggd i parallell session. **Går förlorad vid en `git checkout` — behöver committas eller kastas medvetet** | Nej | Nej |

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

---

# BETAL-1 — kundfakturering, Stripe och betalspärr (2026-08-09)

Ersätter K2-4-piloten i masterkön. Bygger ovanpå K2-creditsystemet och KOSTNAD-1:s ledger.
Ingenting rivet: `credit_accounts`, `credit_transactions`, `credit_pricing` och `topup_orders`
är orörda, och Displaytekniks skarpa saldo (150/300) rördes aldrig.

## Levererat

| Del | Filer | Status |
|---|---|---|
| Databas (8 tabeller, RLS på utan anon-policy) | `migrations/billing.sql` | **KÖRD** mot Supabase, verifierad via REST |
| Inställningar med krypterade Stripe-nycklar | `lib/billing/installningar.ts` | Verifierat: klartext finns inte i DB |
| Stripe-klient och kopplingstest | `lib/billing/stripe.ts` | `stripe@22.4.0` |
| Kundaffärer, datummatte, MRR | `lib/billing/avtal.ts` | 38 tester |
| Statusmaskin och spärr | `lib/billing/status.ts` | Bevisad med curl, se nedan |
| Webhooks med idempotens | `lib/billing/webhook.ts`, `app/api/stripe/webhook/route.ts` | Signaturgrindad, ej körd mot riktig Stripe |
| Påminnelsetrappa | `lib/billing/paminnelser.ts` | Ej körd skarpt (dunning av) |
| Ownervy, fem flikar | `app/dashboard/betalning/*`, `app/api/billing/route.ts` | Verifierad i webbläsaren |
| Kundens betalsida | `app/k/betalning/*`, `app/api/k/betalning/route.ts` | Verifierad i webbläsaren |
| Tokens (namnbyte, mätare, 80/95/100) | `components/TokenMatare.tsx`, `app/k/credits/*` | Verifierad i webbläsaren |
| Dygnsjobb | `app/api/billing/cron/route.ts`, `vercel.json` | Ej körd i produktion |

## Spärren — fyra lager, en källa (`hamtaBetalstatus`)

1. `lib/customer-context.ts` — `billing_status` i sessionen
2. `app/k/layout.tsx` — sidspärr för alla `/k`-sidor utom betalsidan
3. `lib/api-auth.ts` `requireAdminOrCustomer()` — **402** på API-nivå
4. `lib/ai-usage.ts` — betalstopp på providervägen (fångar cron utan session)

**Bevis (localhost, 2026-08-09):** Displayteknik pausad via ownervyn →
`POST /api/studio/suggest-caption` 402 · `POST /api/linkedin/ideas` 402 · `GET /api/fokus/board` 402 ·
`GET /api/k/betalning` **200** (måste vara öppen, annars kan kunden inte betala sig ut).
Upplåst igen → alla fyra 200. Tenanten står i `aktiv` efteråt.

## Två skyddsnät som gör att INGEN kund kan spärras av misstag idag

- `billing_settings.dunning_aktiv = false` — automatiken är av tills Håkan slår på den
- Går statusläsningen sönder returneras `aktiv` (fail-open åt kundens håll)
- En kund utan e-postadress spärras aldrig, den hamnar i listan `utan_mottagare` i stället

## Ej gjort, medvetet

- Ingen kundaffär inlagd. Beloppen och datumen är Håkans, inte mina — formuläret står tomt.
- Stripe-nycklar ej ifyllda, Stripe-konto ej skapat, inget kört mot riktig Stripe-miljö.
- Test clocks, hela livscykeln och kvittolistan med riktig PDF återstår (kräver Stripe-konto).

## Tillägg 2026-08-10 — inmatningssidan byggd för att fyllas i

Fliken Kundaffärer gjordes om från visningsyta till inmatningsyta, `app/dashboard/betalning/Kundaffarer.tsx`.

- **Framstegsrad**: "0 av 13 kunder har en affär inlagd" plus knappen **Fyll i nästa**.
- **Filterchips**: Alla · Saknar affär · Saknar fakturamejl · Betalproblem, med antal.
- **Sök** på kundnamn.
- **Spara och nästa kund** hoppar direkt till nästa kund som saknar affär, utan att stänga.
- **Nästa betalning räknas fram medan man skriver** — samma funktioner som servern använder.
  Räknelogiken flyttades till `lib/billing/datum.ts` (inga imports) så den kan köras i
  webbläsaren. `avtal.ts` re-exporterar den, så inget anropsställe behövde ändras.
- **Inga native-dropdowns** i de fält som rörs oftast: plan är kort, intervall, betalsätt
  och status är segmenterade knappar, belopp har snabbval för planpriserna.
- Kund med affär men utan fakturamejl flaggas i listan och i redigeraren, med texten om
  att den aldrig kan påminnas och därför aldrig heller pausas.

**Verifierat i webbläsaren 2026-08-10**: plan intro + startdatum 2026-02-15 gav direkt
"Nästa betalning 15 augusti 2026, om 6 dagar, 2 488 kr med moms" utan att spara. Spara och
nästa kund sparade AluCon, uppdaterade räknaren till 1 av 13, satte MRR till 1 990 kr och
öppnade Annas Blommor. Testaffären raderades efteråt, `billing_avtal` är tom.

Build ren, tsc ren, 895 tester passerar (41 på betalningslogiken).

## BETAL-1b 2026-08-10 — påfyllning dras på kundens redan sparade kort

`dragPaSparatKort()` drar off_session på standardkortet och krediterar tokens direkt.
Tre utfall, alla med en väg framåt: kortet går igenom (tokens direkt), banken vill ha
bekräftelse (betallänk, samma köp), inget kort eller nekat (betallänk, samma köp).

**Dubbelkreditering var den verkliga risken** — påfyllningen kan nu komma in både direkt
och via webhooken. `credit_transactions.extern_referens` (Stripes betalnings-id) med
partiellt unikt index gör krediteringen idempotent. Raden skrivs först; kolliderar den
har köpet redan krediterats och saldot rörs inte.

**Bevisat mot databasen 2026-08-10:** två inserts med samma referens → första 201, andra
409 med kod 23505. Testraden borttagen, Displaytekniks saldo orört på 150 av 300.

`payment_intent.succeeded` hanteras nu också, som skyddsnät om servern tappar
anslutningen mitt i dragningen.

**Verifierat skarpt** efter deploy `f447cd0`: `/api/k/credits` svarar med det nya
`kort`-fältet. Det står null eftersom Stripe ännu inte är kopplat, vilket är rätt.

## BETAL-1c 2026-08-10/11 — koppla ihop med befintlig Stripe, och rabatterna

| Del | Bevis | Status |
|---|---|---|
| Tokenkortet i kundens översikt | `28efc15` | KLART, EJ VERIFIERAT. Beställningen ville se kortet på BÅDA ställena; bara sidhuvudet var byggt. Nu ligger det också högst upp på `/k`, direkt under stegen. Servervyn är rent visande och länkar vidare — påfyllningen sitter kvar på tokensidan där den fungerar |
| Fliken "Koppla ihop" mot skarp Stripe | `9f74572` | KLART, EJ VERIFIERAT. **Utgångspunkten ändrades:** Håkans Stripe-konto är inte tomt — han säljer via betallänkar (MySales 700 kr, Pro 1 990 kr, ex moms) med löpande abonnemang och riktiga pengar. "Skapa saknade priser" hade gett dubbletter i katalogen och ett andra abonnemang hade dubbeldebiterat en riktig kund. Fliken läser produkter, priser och abonnemang och låter Håkan peka ut vilken Cockpit-kund varje Stripe-kund är. **Skriver ENBART vår egen sida.** Matchning föreslås men tillämpas aldrig automatiskt, e-post väger tyngre än namn, och skälet visas ut |
| Rabatter (kampanjkoder) | `359dbb5`, `tests/betal1-rabatt.test.ts` | KLART, EJ VERIFIERAT. **Riktigt fel i föregående dags import:** den läste `price.unit_amount` och hade visat listpris 2 490 för en kund som med kampanjkod betalar 1 990 — och räknat upp intäkten med pengar som aldrig kommer in. Nu läses både `discounts` och äldre `discount`, listpris och faktiskt belopp visas bredvid varandra, och vid koppling hämtas beloppet ur Stripes KOMMANDE FAKTURA. Ett oexpanderat rabatt-id gissas aldrig. En kupong med `duration: once` flaggas — en engångsrabatt är inte en permanent intäktssänkning |
| Tre fel i inmatningsvyn | `359dbb5` | KLART OCH VERIFIERAT mot Håkans egna skärmbilder: två planer hette båda "MySales Pro" och gick bara att skilja på priset · datumfälten står i webbläsarens format, ofta mm/dd/yyyy, så datumet skrivs nu ut på svenska under fältet · "Eget upplägg" såg förvalt ut för en kund utan affär |

**Fångat av test, inte av kod:** `rabattPa(null)` föll på `.discounts`. Koden rättades, inte testet —
funktionen läser ett externt API där saknade fält är normalt.

### Öppen risk: video saknas i prislistan
`ai_pricing` har inget pris för video. En videogenerering loggas därför som 0 kr, taket
på 200 kr reagerar aldrig, och de 15 tokens per påbörjat femsekundersklipp vilar inte på
någon mätning. Ingen video har körts än, så ingenting läcker i dag. Sätt priset innan
video släpps på en betalande kund.
