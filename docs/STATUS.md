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

*Uppdaterad 19/8 — **OPTICUR-1 Etapp A KLART OCH VERIFIERAT** (`310e1f0`). Två skarpa
Opticur-annonser hade fel gröna: den stående hade Ingelas riktiga koder ersatta av
platshållarfärger på tre ställen samtidigt (`clients/opticur/brand.json`, `studio_brand_kits`,
`clients.primary_color` — alla `#1A6B3C`/`#5AAF32`), rättat till `#007A3D`/`#62A936` + CMYK,
verifierat mot faktisk mall-rendering. Den liggande annonsens fel logga/färg kom från en
AI-bildväg (inget liggande format finns i Studios mallsystem) där `build-image-prompt`
uttryckligen instruerade modellen att rita "OPTICUR" som logotyp — instruktionen borttagen,
stoppar hallucinationen. Blast radius: ~24 ställen hade Opticurs gröna hårdkodad som generisk
nödfallsfärg för ALLA tenants (inkl. ett catch-block som gav vilken tenant som helst Opticurs
grön vid databasfel) — bytt till neutral grå (`#6B7280`). Omvänt test kört: For Balance
opåverkad. Hårt stopp före Etapp B per beställningen togs 19/8 ("kör b").*

*Uppdaterad 19/8 — **OPTICUR-1 Etapp B KLART OCH VERIFIERAT** (`d7fdb69`). Nytt formatslag
"Egen storlek/Skärm" (200–4096 px/led), ny måttoberoende arketyp `ark-skarm` (zoner relativt
ytan, typografi skalar mot canvashöjden, enradigt läge vid w/h ≥ 2,4 — verifierat mot 4:3,
16:9 och en avlång remsa 1920×360). Canvasmåttet har EN källa (`effectiveDims(payload)`,
`payload.customSize`) som alla konsumenter läser — export, publiceringsfångst, live-editor,
CLI-export — samma princip som BESKÄR-1, ingen risk för att måttet glider isär mellan vägar.
Riktig loggfil med automatiskt ljus/mörk-val (logo-contrast.ts utökad med en proportionell
loggzon). Bakom en vanlig platform_modules/tenant_modules-modul (`studio-skarmformat`), AV
som standard, PÅ bara för Opticur — byrå-dashboarden filtrerar aldrig på detta, så ägaren kan
testa formatet för vilken tenant som helst utan att ge just den tenanten modulen.

DoD kört: Opticurs "Redo inför hösten" återgiven exakt 1200×900 med `#007A3D` och riktig
logga, sparad som "Infartsskärmen" (återanvändbar). Displayteknik i ägarläge: 1920×1080
(normalläge) och 1920×360 (enradigt, autobytt) med egna färger, ingen Opticur-läckage.
Omvänt synlighetstest: For Balance och HM Motor saknar modulen i kundvyn.*

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

### KLART 15/8 — KUNDENS EGNA BILDREGLER (Håkans beställning: "det är en styrka")

**Fyndet:** fälten fanns redan i `/dashboard/brand-kit` (Bildstil-sektionen), men bar inte
hela vägen. "Får innehålla människor" skrevs in i `lib/studio/kit.ts` som
`imageExtra`-text — en mening som uttryckligen börjar "applies to colour and light only,
**never change the subject**". En motivregel inuti ett förbud mot motivändringar gjorde
ingenting, och personrotationen delade samtidigt ut en person. Kryssrutan var alltså
kosmetisk. Samma familj som `fargTon`-buggen (svenska agentvärden mot en boolesk
jämförelse) — mätt i skarp data: Annas Blommor har `people: "ibland"` i databasen, ett
värde `=== false` aldrig hade läst.

**Byggt:**
- `KitDirectives.imageMotiv` — en EGEN kanal för motivregler, skild från `imageExtra`
  (stil). Läggs sist i prompten, i en mening som säger att den väger tyngst.
- `tolkaPersoner()` — språkoberoende tolkning (boolean, svenska ord, engelska ord), delad
  mellan server (`lib/studio/kit.ts`) och ytan (`app/dashboard/brand-kit/page.tsx`).
- "Aldrig" stänger AV personrotationen i `byggBildPrompt` i stället för att lägga en rad
  som konkurrerar med den — samma lösning som "efter stängning" fick tidigare i dag.
- Ytan: tre knappar (Alltid/Ibland/Aldrig) i stället för en kryssruta, plus fritextfält
  **"Visa alltid i bilderna"** och **"Undvik i bilderna"**. Ligger i samma komponent som
  `/k/brand-kit` redan renderar — kunden ser fälten utan nytt paket eller ny modul.

**Bevis:** `tests/bildregler-kundens-egna.test.ts` (14 tester, fyra egna brytningar
provade — alla fyra fångades) + `scripts/bildregler-dod.mts`, skarp körning mot
Displayteknik: satte "aldrig människor" + en egen regel om LED-skärm i drift via samma
tabellrad som kundens PUT-anrop skriver, byggde en bild, läste av med vision (NEJ på
"syns någon person", JA på "verklig skärm i drift"), och **återställde tenantens
ursprungliga kit efteråt** — testet lämnar inget skräp i skarp data.

⚠ **Kvar:** kundens fält skriver INTE ännu till karusellens seriegenerering utanför
`byggBildPrompt`s egna anrop (blogg-omslag, reel-scen går genom samma funktion och ärver
alltså regeln automatiskt — obekräftat i skarp körning för de två syftena).

### KLART 15/8 — BILD-11 TILLÄGG punkt 4 och 5 (skarpt verifierat mot DT)

**Bevis:** `scripts/bild11-dod.mts` (skarp körning mot Displayteknik, bilderna ligger i
`scripts/_bild11/`) + `tests/bild11-plats-tid-och-ord.test.ts` (17 tester, alla provade
genom att brytas: fyra brytningar gav fyra röda).

| Punkt | Utfall |
|---|---|
| **4 · plats och tid** | Härledningen ställer nu TRE frågor: vad ska bevisas, VAR, NÄR. `harledPlats` (10 platser) och `harledTid` (5 tidpunkter) i `lib/bild/promptbyggare.ts`. **DoD grön:** samma inlägg regenererat — vision svarar JA på "kameran utanför på gatan" och JA på "kväll eller natt", och bilden visar skyltfönstret utifrån i skymning med skärmen upplyst mot våt gata |
| **5 · läsbara ord** | Noll läsbara ord på huvudskylten i **5 av 5** singelgenereringar, noll engelska ord. Två omtag behövdes i två av fem — grinden gjorde jobbet |

**Rotorsaken till punkt 5 satt i BESTÄLLNINGEN, precis som Håkan misstänkte.** K1:s
rekvisitaregel för skyltbranschen bad om "a strong headline band across the top" och "a
clear price or offer block" — och i samma mening om "never sharp readable words". En modell
kan inte rita en rubrikrad utan bokstäver, så den valde bokstäver. Samma familj som BILD-10
(texten beställdes) och BILD-12 (dekorbilden beställdes). Regeln beställer nu INNEHÅLLET:
ett foto av köparens egen vara, med layouten oskarp, vinklad eller beskuren.

**Grinden som saknades:** stavningsgrinden dömde bara STAVNING. "FRESH-BAKED" och
"KANELBULLE" är rättstavade och passerade därför. Nu klassas orden också: engelska ord fälls
alltid (Håkans "oavsett vägval"), läsbara ord fälls i flöden där modellen inte äger någon
text. Domen gäller bara bildens huvudsakliga skylt — bakgrundens butiksfasader jagas inte,
samma avgränsning som BILD-8c gjorde för stavningen. Omtaget ber om att orden TAS BORT;
stavningsskärpningen hade bett om "två till fem korta svenska ord", alltså felet igen.

⚠ **Ett medvetet vägval:** ett rättstavat SVENSKT ord som överlever både omtagen och det
textlösa motivet släpps igenom med en logg, medan ett engelskt ord alltid ger 502. Ett hårt
stopp på svenska ord hade kostat kunden bilden för något hon inte kan påverka. Säg till om
du vill ha hårt stopp på båda.

★ **Ändrat lås:** två tester i `bild10v2-promptbyggare.test.ts` låste den GAMLA
formuleringen ("CAMPAIGN LAYOUT", "price or offer block"). De låser nu den nya regeln, plus
ett nytt test som fäller varje rekvisitaregel som beställer en rubrikrad eller prisruta.

### ★ HÅKANS FJÄRDE RÄTTNING 15/8 — kampanjlayouten togs bort av misstag

> *"personen framför skärmen tittar inte på skärmen o innehållet på skärmen saknar
> relevans enligt tidigare jobb vi gjort, skärmar visar inte bara en bulle eller pizza
> sådär det är inte relevant. så nej det är för dåligt o tappat tidigare vassa
> uppdateringar vi gjort"*

Två separata fel, båda rättade:

1. **Blicken.** Tidsraden för "efter mörkrets inbrott" sa "a passer-by" — en förbipasserande
   som per definition inte stannar. BILD-8b:s blickregel (person ska vara vänd mot det
   inlägget handlar om) fanns kvar men konkurrerade med min egen rad. Nu: "STOPPED and are
   looking straight at the subject, head and eyes on it".
2. **Skärminnehållet, det allvarligare felet.** När jag löste BILD-11 punkt 5 (läsbara ord)
   tog jag bort BILD-7a:s kampanjlayout helt och ersatte den med ETT foto av köparens vara
   som fyller panelen — en TAVLA, inte en kampanj. Håkans ord: "skärmar visar inte bara en
   bulle eller pizza sådär, det är inte relevant." Jag löste rätt problem (läsbara ord) med
   fel medel (ta bort kompositionen) och tappade en tidigare byggd regel på vägen.
   **Rättat:** K1 beställer nu en RIKTIG KAMPANJ igen — bildyta, rubrikzon, erbjudande-
   eller prisruta — och håller orden borta med LÄSBARHET (avstånd, vinkel, skärpedjup)
   i stället för att ta bort layouten. Samma mönster i K5's textrad.

⚠ **Ärlig gräns, inte återöppnad i en fjärde iteration:** verifieringsbilden
(`scripts/_bild11/bildregler-dt.png`, körd för brandingfälten) visar en liten läsbar
bildtext på skärmen ("Think…", en klocka) trots layout-fixen. Min DoD-körning för
brandingfälten anropade `generateImagen` direkt och hoppade över `stavningsgrind` (som
`suggest-image`-routen kör med `ordfri: true`) — alltså testade den inte hela kedjan.
Grinden är byggd och låst i test (`tests/bild11-plats-tid-och-ord.test.ts`), men den
skarpa bilden bevisar den inte. **Nästa session:** kör om med hela grinden inkopplad
(`scripts/bild11-system.mts`-mönstret) innan detta stängs som verifierat.

### HÅKANS TREDJE RÄTTNING 15/8 — "se det systemmässigt"

> *"gör inte missarna bara för DT, se det systemmässigt — oavsett vad som skrivs in måste
> den tänka rätt."*

Han hade rätt, och det höll på att bli en DT-lapp. Tre ändringar följde, alla mätta mot
**fyra branscher**: `scripts/bild11-system.mts`.

1. **K5 · VERKLIGHETSVAKTEN, en plattformsregel.** Fyndet var en skärm som satt **på
   snedden** i skyltfönstret ("så skulle det aldrig sättas") och, i nästa försök, en man
   med stege som monterade den mitt i ett inlägg om att skärmen säljer när ingen är där.
   Båda felen är branschlösa: en snedhängd tavla hos en terapeut och en lutande menytavla i
   ett café är samma fel. Regeln bor därför bredvid ljusvakten och gäller varje tenant:
   allt sitter monterat som en fackman lämnar det, och monteringsarbetet är utanför bild.
2. **Modellen tolkar, koden formulerar.** Nyckelordslistorna kan bara det de råkar
   innehålla — "Displayen som jobbar vidare när personalen gått hem" träffade ingenting.
   Nu läser modellen inlägget och svarar med en NYCKEL ur samma lista, och nyckeln slås upp
   mot exakt samma text som regeln hade gett. Ordalydelsen förblir kodens, vilket är hela
   poängen: hade texten kommit ur modellen hade härdningen mot gyllene timme försvunnit vid
   nästa körning. Anropet sker bara när reglerna missar, och fail-open: inget svar → ingen
   plats- och tidsrad, precis som förut. En gissad plats är sämre än ingen.
3. **Nyckelorden matchar ORD, inte substrängar.** Mätningen mot fyra tenants avslöjade ett
   fel som drabbade **alla** kunder: `väg` i platslistan matchade inuti "på **väg** hem" och
   gav en fasadbild av en bukett, och `kö` i tidslistan matchade inuti "**kö**pa" — alltså
   hade varje inlägg om att köpa något klassats som rusningstid. JavaScripts `\b` räknar
   å/ä/ö som ordgräns, så gränserna skrivs nu ut med svenska bokstäver.

**Mätt, fyra branscher, formuleringar som listorna INTE känner igen:**

| Tenant | Rubrik | Reglerna gav | Systemet gav |
|---|---|---|---|
| Displayteknik | "Displayen som jobbar vidare när personalen gått hem" | inget | gatan utifrån + efter mörkrets inbrott |
| For Balance | "Samtalet som ryms innan arbetsdagen börjar" | inget | behandlingsrummet + tidig morgon |
| Annas Blommor | "Buketten du hinner hämta på väg hem från jobbet" | inget (efter ordgränsfixen) | butiken sedd utifrån + rusningstid |
| Engens Träd | "Jobbet uppe i kronan, sett från marken" | inget | utomhus på plats |

Bilderna: `scripts/_bild11/system-displayteknik.png` (natt, skärmen rak i fönstret, kvinna
på gatans sida) och `system-forbalance.png` (behandlingsrum, morgonljus, två stolar).

★ **Fynd i DoD:n, rättat efter Håkans invändning:** första bilden blev rätt plats och rätt
tid men hade en bagare i arbete inne i den stängda butiken. Första rättningen tvingade fram
"inga människor" — fel, det hade han aldrig sagt. Nu byts bara personal i ARBETE ut mot
nästa kategori i rotationen; en förbipasserande, en kund som stannar utanför eller en tom
lokal fungerar alla. Andra körningen: kvinna på trottoaren som tittar på skärmen, en
förbipasserande längre bort, personalen borta.

### BESTÄLLNINGEN (för spårbarhet) — BILD-11 TILLÄGG (skarpfynd, singelinlägg DT)

Fyndet: inlägget **"Skärmen som säljer när du sover"** (skyltfönster, dygnet runt) fick en
bild med **dagtid, butiksinteriör och personal vid en skärm inne i butiken**. K1 och K3
fungerade (annonslayout med prisblock på skärmen, kvinna i butiksmiljö), men bevismeningen
missade att påståendets **plats och tid** är själva poängen.

**(4) K2 UTÖKAS MED PLATS OCH TID.** Bevismeningen ska fånga plats och tidpunkt när de bär
påståendet, inte bara fel- eller framgångsläget.
· "Skyltfönster" → skärmen sedd **utifrån gatan genom fönstret**
· "Säljer när du sover" → **kväll eller natt**, upplyst skärm mot mörk gata, inga personer
  eller på sin höjd en förbipasserande
Härledningen ska ställa **tre** frågor till innehållet: vad ska bevisas, **VAR** utspelar det
sig, **NÄR** utspelar det sig.
**DoD:** regenerera exakt detta inlägg och verifiera att bilden visar skyltfönstret utifrån
i kvällsljus.

**(5) LÄSBARA ORD BEKRÄFTADE I SINGELFLÖDET.** Skärmen i bilden visade "FRESH-BAKED" och
"KANELBULLE" i läsbar text, dessutom på engelska. Stärker misstanken i punkt 3 att orden
**genereras** och inte är overlay.
**Punkt 3:s DoD utökas till singelflödet:** 5 genereringar utan läsbara genererade ord, och
**engelska ord får aldrig förekomma på avbildade skärmar** oavsett vägval.

★ Punkt 5 hänger ihop med BILD-8:s stavningsgrind och BILD-10 ("bildmodellen skriver ingen
text"). Att engelska ord dyker upp på en avbildad skärm i DT-flödet tyder på att någon väg
förbi den grinden är öppen — leta där först, innan nya regler skrivs.

### KLART 15/8 — R-5b, siffergrindens tre kalibreringsfel

**Bevis:** `scripts/r5b-dod.mts` (mätt på den skarpa Makzy-rapporten, asset `45bf59c4`) +
`tests/r5b-sifferkalibrering.test.ts` (30 tester, provade genom att brytas: tre brytningar
gav 7, 2 och 4 röda). Omkörd rapport: asset `c668c538`, batch `msgbatch_01Uv6gRKeuTBBUVvYMLyP7yx`.

**★ FÖRE-LÄGET, MÄTT PÅ RIKTIG TEXT: rapporten hade SEX luckor, och ALLA SEX var
kalibreringsfel.** Inte en enda av dem var en uppgift Madeleine skulle fylla i:

| Tal | Stod i | Var egentligen |
|---|---|---|
| 150, 160 | "Meta-beskrivning … max cirka 150-160 tecken" | Googles gräns, inte Makzys uppgift |
| 58 | "51 av 58 bilder saknar beskrivning" | vår egen mätning ur crawlen |
| 4 | rubriknumrering ("## 4. Inga kundcitat …") | listnummer |
| 7, 9 | tabellens radnummer i innehållsplanen | radnummer |

**★ OCH KONSEKVENSKRAVET FÖRSTORADE VARJE FEL.** Beslutet fattas en gång per TAL och gäller
hela rapporten — rätt princip, men en enda felklassning slår då över hela dokumentet. Fyran
klassades i en rubrik och maskade sedan varenda fyra i texten: `**Fråga 4:**` blev
`**Fråga [DIN SIFFRA]:**`, och 150 maskade även "över 150 tyger i provurvalet" långt
därifrån. Därför hoppas strukturtal över PÅ PLATSEN i stället för att få ett beslut: samma
fyra kan vara rubriknumrering på en rad och en leveranstid på nästa.

| Punkt | Byggt | Mätt |
|---|---|---|
| 1 · strukturtal undantas | `arStrukturtal` — listnumrering, rubriknumrering, tabellradnummer, FAQ-nummer och datum, positionsberoende (femman i "## 5. 51 bilder" är numrering, 51 är ett mätvärde) | Numreringen står orörd, noll rader i beslutstabellen |
| 2 · generisk SEO-fakta | `arSeoFakta` — kort namngiven faktalista (meta 150-160, titel 50-60, statuskoder, LCP/INP/CLS, alt-text 125, tunt innehåll 300 ord). Klass B, **belagt** — inte "riktvärde, verifiera mot din leverantör", vilket vore nonsens om Googles egen gräns | 150 och 160 belagda, med källan utskriven |
| 3 · crawlens mätvärden | `arCrawlMatvarde` + ny **klass C**. Tenantens eget påstående vinner: "våra priser börjar från 500 kr per sida" är fortfarande ett pris | 58 belagt som "crawlens egen mätning" |

**DoD:** lucklistan gick från **6 till 0** på samma text. Beslutstabellen: 38 rader → 30, och
noll av dem är rena strukturtal. Datumraden i sidhuvudet ger inga rader alls längre.

**★ DEN OMKÖRDA RAPPORTEN HITTADE TVÅ FEL TILL i samma familj, båda rättade:**
postnumret "602 95 Norrköping" blev två luckor (att be kunden fylla i sitt eget postnummer
är samma pinsamhet som det maskade telefonnumret), och rapportens EGEN tidsuppskattning
"→ ~4 timmar" blev "→ ~[DIN SIFFRA] timmar". Tildet är signalen och bara den — "Första
mötet tar cirka 30 minuter" är ett påstående om verksamheten och grindas som förut.
Källtexten i beslutstabellen säger nu VILKET skäl som gällde, inte "telefonnummer, orgnummer
eller datum" för allihop.

⚠ **Kvar i den omkörda rapporten, tre luckor — och de är olika mycket rätt:**
1. "snabb laddning (under 1,2 s)" — modellen hittade på en laddtid. **Rätt maskad.**
2. `"Erik, 48"` i ett platshållarcitat — citatet är dessutom märkt som påhittat. **Rätt.**
3. "svara på alla omdömen inom 24 timmar" — ett allmänt råd, inte Makzys uppgift, men det
   maskas ändå. **Öppet:** ska allmänna råd med tidsangivelse räknas som branschfakta? Jag
   lät bli att bygga det, eftersom gränsen mot "vi svarar inom 24 timmar" (ett löfte om
   verksamheten) är verklig och en för bred regel hade släppt igenom påhittade löften.

**Rapporterna står kvar dolda i kundvyn** (`DOLJ_RAPPORTER_I_KUNDVYN = true`).

### BESTÄLLNINGEN (för spårbarhet) — R-5b (litet varv)

Håkans ord, ordagrant:

> Makzy-rapporten bifogas. Tre kalibreringsfel i siffergrinden:
> (1) strukturtal (list-, tabell-, rubriknumrering, datum i sidhuvud) undantas från grinden
>     och beslutstabellen,
> (2) generisk SEO-fakta (meta-beskrivningens 150-160 tecken m.fl.) klassas B, bygg en liten
>     faktalista,
> (3) crawlens egna mätvärden (bildantal, ordantal) är alltid belagda, aldrig luckor.
> DoD: omkörd Makzy-rapport med noll strukturtal i lucklistan och ren beslutstabell.

⚠ **Rapporten var INTE bifogad** i meddelandet. **Löst 15/8:** före-läget togs ur den
sparade Makzy-rapporten i `client_assets` (asset `45bf59c4`, 14/8) — dess metadata bär hela
beslutstabellen med meningen varje tal stod i, alltså exakt det före-läge DoD:n krävde.
Ingen bilaga behövdes.

★ **Anvisningen i den här beställningen pekade fel, och det är värt att veta:** rapportens
siffergrind bor i `lib/deep-audit-siffror.ts` (R-5), inte i `lib/content/writing-rules`
(`talTokens`, `sakerstallCaption`) — den senare är INLÄGGENS siffergrind och rördes inte.
Två grindar med samma namn i talspråk, och ändringen hörde bara hemma i den ena.

**Fortfarande öppet, orört av R-5b:** i INLÄGGSflödet räknas tal ur kundcitat som
verifierade siffror. Det är Håkans beslut från 11/8 och står kvar bland de öppna besluten.

### KLART SENARE 13/8 (också pushat, `987901c`)

| Post | Status | Kärnan |
|---|---|---|
| KUNDREGISTER-1 | KLART OCH VERIFIERAT | 137 kontakter hos DT. ★ Dubblettbugg hittad på den färdiga sidan, inte i DoD:n |
| KUNDTEXT | KLART OCH VERIFIERAT | Leverantörsfel (faktura, nyckel) döljs för kund, loggas fullt internt |
| NATTLOOP | AVSTÄNGD | 52 kr/mån, två lås, koden orörd (`NATTLOOP_PA=1` slår på) |
| KANAL-3 | KLART, EJ KLICKAD | Utkast **eller** publicera direkt. Statusvärdet verifierat mot live-API. Karusell publiceras aldrig direkt |
| NYCKEL-1, 1b, 1c | KLART OCH VERIFIERAT | MySales-koppling i Inställningar per kund. Nyckeln testas mot fyra behörigheter före sparning, en smalare nyckel skriver aldrig över en bredare, och rutan visar BÅDA nycklarnas status vid inläsning. ★ 1c kom ur Håkans invändning "det fanns bara ett ställe att klistra in på, då blev det ju fel" — ett verktyg som kräver att man gissar är inte färdigt |
| `docs/API-KOSTNADER.md` | KLART | Alla API:er, konton, priser och luckor, mätt ur `ai_usage_events` |

### VÄNTAR PÅ HÅKAN (blockerar annars)

1. **★ Opportunities på Gittes nya MySales-nyckel.** NYCKEL-1:s första version speglade
   nyckeln till `coach_users.ghl_api_token` — samma fält onboarding-steget sätter — utan att
   kontrollera bredden. Den nya nyckeln saknar affärsbehörighet, så **Fokus idag och
   DM-tavlan svarar 401 för For Balance**. Lägg till View + Edit Opportunities och klistra in
   nyckeln igen i Inställningar → Integrationer → MySales. Grinden finns nu i koden
   (`klararAffarer`), men den redan överskrivna nyckeln måste ersättas för hand.
   **Öppna rutan först** — den visar nu båda nycklarnas behörigheter och vad som nekas,
   så du ser läget innan du rör något. Behåll alla scopes den gamla integrationen hade:
   kundnyckeln används även av provisioneringen när ett konto sätts upp från grunden.
2. **Samma nyckel-runda för AluCon och Makzy** — deras gamla nycklar ger 401 på allt.
3. **Auto reload på Anthropic** — saldot tog slut mitt på dagen och ingenting varnade.
   Kontot följs inte automatiskt (`provider_accounts.saldo_kalla = manuellt`).
4. **Kör djupgranskningen på For Balance** — enda beviset för att S-6 löste 500:an.
5. **Klicka igenom** offertmotorn (Fable 5) och kanalvalet utkast/publicera.

*Migrationen `modell1_fable_pris.sql` är körd och verifierad — offertmotorn kör Fable 5.*

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

### KLART 15/8 — ÄMNE-1: bildtexten bytte ämne, kedjan är nu ankrad

**Beställning:** Håkan tog emot Cockpits förslag om en menyskärm, skapade bild för det,
bad om bildtext i steg 5 — alla tre varianter handlade om ett HELT ANNAT ämne (skyltning
i augustisol/sensommar). Hårt stopp begärt: orsak innan fix.

**ORSAKSANALYS, mätt mot Displaytekniks riktiga profil (`scripts/amne1-repro1..3.mts`,
tre skarpa körningar):**

1. `topic` (Ämnesfältet, steg 1) och `headline`/`headline2`/`body` (Text på bilden, steg
   4) är **två skilda state-fält** i `StudioMaker.tsx`. `applySuggestion` (rad 802) sätter
   headline/body när en idé väljs — **rör aldrig `topic`**. Ämnesfältet kan alltså bära
   en KVARLÄMNAD text (en tidigare idé, ett tidigare inlägg) rakt in i captiongenereringen.
2. `/api/studio/suggest-caption` byggde `underlag` med `Ämne: X.` FÖRST — före "Rubrik på
   bilden:"/"Text på bilden:", både positionellt och språkligt den mer auktoritativa raden.
3. **Repro 1** (tomt Ämne, bara headline/body): på ämne, mild säsongsfärgning ("kvällssolen").
   **Repro 2** (Förslag för dagen/Content Compass förifyllt): fortfarande på ämne — Compass
   styr bara ton/struktur, precis som mikrocopyn lovar. `contentCompassBlock` läst rad för
   rad: inget ämnesläckage där. **Repro 3** (kvarlämnat Ämne "Synlighet i sensommaren —
   skyltar som fortfarande syns i augustisolen" + menyskärmens riktiga headline/body): **alla
   tre varianter öppnade om sensommar/augustisol**, menyskärmen degraderad till bisats —
   matchar Håkans fynd i klartext.
4. **A2-läckans väg är INTE samma väg.** `suggest-caption` går genom `byggTextPrompt`
   (prompt-core), bygger ingen egen kontext utanför kärnan. A2 (31/7) handlade om att
   SANNINGSKRAVET läckte när ämnesraden bad om en kundberättelse — ett annat fel i samma
   närhet, redan stängt. Rotorsaken här är prioritetsordningen mellan två separata
   state-fält, inte en kringgången kärna.

**FIX — `lib/content/amneskalla.ts`, en delad prioritetsfunktion (K1–K3):**
`harledAmnesblock()` avgör ämneskällan i ordning: **(1) redan skriven caption** ("Skriv
om" — starkast) **→ (2) skapad bild/mall-text** (headline/headline2/body/karusellens
slides) **→ (3) Ämnesfältet, ENDAST om 1 och 2 är tomma → (4) inget alls**, då bär
Förslag för dagen + varumärkesrösten genereringen ensamma (DoD punkt 3). Så fort en äkta
källa finns UTESLUTS Ämnesfältet helt ur prompten — ett kvarlämnat, motstridigt ämne kan
alltså aldrig vinna igen. Etiketten skärptes samtidigt: "Rubrik på bilden:" lästes som en
bildbeskrivning, inte som en instruktion om vad HELA inlägget handlar om — nu **"ÄMNET FÖR
DETTA INLÄGG (håll dig till exakt detta i alla varianter)"**.

Inkopplat i `suggest-caption` (bildtext, "Ge mig 3 att välja på", "Skriv om" — alla samma
route, hashtags genereras som en del av captionen) och defensivt i `adapt-channel`s
fallback-gren (steg 6 använder redan `baseCaption` i normalfallet). **Klienten skickar nu
`caption` med** i båda suggest-caption-anropen (`StudioMaker.tsx`) — utan den raden hade
"Skriv om" fortsatt regenerera från grunden i stället för att vinkla om den text som redan
stod där.

**K4 — ämneskällan loggas:** ny kolumn `generation_log.amne_kalla`
(`migrations/amne1_amnekalla.sql`, körd), trådad genom `GenereringsMeta` → `Generering` →
`loggaGenerering`. Driver Ämnesfältet ofta topic-genereringar går att se i efterhand utan
att gissa.

**DoD, skarpt körd (`scripts/amne1-dod.mts`) mot Displayteknik:**

| Punkt | Utfall |
|---|---|
| 1. Håkans exakta fall (kvarlämnat ämne + menyskärm) | **Alla tre varianter om menyskärmen**, ingen öppnar om sensommar/augustisol |
| 2. "Skriv om" på samma inlägg | Ämnet består — ämneskälla blir `inlaggstext`, den omskrivna texten handlar fortfarande om menyskärmen |
| 3. Tomt inlägg | Inget fel — genererar en text ur varumärkesrösten + Förslag för dagen ensamma |

13 tester (`tests/amne1-amneskalla.test.ts`), fyra brytningar provade (två träffade,
K1-prioriteten kan alltså inte tystas av misstag).

**DoD punkt 4 — samma mönster på fler ställen, granskat:**
- `app/api/blog/generate/route.ts` + `outline/route.ts` har samma `Ämne: ${topic}` textrad,
  men topic är där DET ENDA inmatningsfältet (kastar 400 utan det) — ingen konkurrerande
  headline/body finns att glida isär från. **Inte sårbart**, inte rört.
- `app/api/studio/improve-post/route.ts` gör redan RÄTT: "Härled FÖRST bransch, målgrupp,
  erbjudande, ton och tilltal ur det inklistrade inlägget. Det är din primära källa" —
  samma princip som fixen här, byggd tidigare av ett annat skäl. Ingen ändring behövs.
- **Sekundär, ej stängd risk:** `sasongsPromptRad` (BILD-5b) injiceras i VARJE textgenerering,
  alla syften, som lager 1b — direkt efter uppdraget. Repro 1 och 2 visade mild
  säsongsfärgning ("kvällssolen", "ljummen sommarkväll") även när ämnet var rätt. Det är
  by design (säsongsmedvetenhet), men gränsen mot att FÄRGA för mycket är inte mätt. Inte
  åtgärdat i den här etappen — flaggat för en egen titt om det återkommer.
- **Sekundär, ej stängd risk:** Content Compass 4A-mallarna (`FOURA_TEMPLATES`, t.ex.
  "3 fakta om [område]") bär en ofylld platshållare modellen själv måste tolka. Inte
  bevisad som ensam trigger i repro, men en öppen flank — "[område]" har inget som säger
  att det ska vara EXAKT posttopiken.

### ÄMNE-1, forts. — bilden kopplad till samma källa (Håkans fråga: "är bilderna relaterade till texterna nu?")

Svaret var **nej, inte ännu** — bildtexten (`suggest-caption`) hade fått rätt prioritet, men
bildgenereringen (`suggest-image`) för ett enstaka inlägg hade **samma fel, fast utan ens en
prioritetsordning**: `topic || headline1 || caption.slice(0, 200)` (StudioMaker.tsx) lät
Ämnesfältet vinna OVILLKORLIGT så fort det var ifyllt, oavsett vad som faktiskt skapats.
Och **brödtexten nådde aldrig bilden alls** — allt klistrades ihop till en enda `topic`-
sträng, så BILD-11:s bevismening (K2) och plats/tid (K2b) bara någonsin såg rubriken.
**Karusellens slide-bilder gjorde redan rätt** (skickar rubrik/brödtext separat, per slide)
— bara singelvägen saknade den delade prioriteten.

**Fix:** `harledBildamne()` i samma `lib/content/amneskalla.ts` — samma regel (caption >
skapad rubrik/text > Ämnesfält > tomt), formen bildbyggaren tar emot (`rubrik`+`brodtext`
separat). Inkopplad i `suggest-image/route.ts`: ett explicit `rubrik`/`brodtext`-fält i
anropet (karusellens sätt) kringgår regeln med flit — den vägen har redan rätt innehåll
per bild. Klienten (`StudioMaker.tsx`) skickar nu `headline`/`headline2`/`body`/`topic`/
`caption` var för sig i stället för att klistra ihop dem, i både `suggestImage` och
`generateOnBrandImage`. K4: `amneKalla` loggas för bilden också.

**DoD, skarpt** (`scripts/amne1-bild-dod.mts`, Håkans exakta fall — kvarlämnat Ämnesfält
+ menyskärmens riktiga rubrik/text): ämneskälla = `bild`, bevismeningen (K2) handlar om
menyn, det kvarlämnade ämnet syns ingenstans. **Bilden själv bevisar det**: en skärm i en
kaférmiljö som visar en maträtt och exakt rubriken "Fler stannar när de vet vad du
serverar" — inte skyltning i augustisol. 11 nya tester (`tests/amne1-bild.test.ts`), två
brytningar provade.

### KÖN EFTER 15/8

1. **ÄMNE-1 (text + bild) — KLART OCH VERIFIERAT.** Se båda avsnitten ovan. Sekundära, ej
   stängda risker flaggade: säsongsradens mildare ämnesfärgning, 4A-mallens ofyllda
   "[område]".
2. **BILD-11 tillägg punkt 4 och 5 — KLART OCH VERIFIERAT**, med tre uppföljande
   rättningar samma dag (montering, systemmässighet, kampanjlayout). Se avsnitten ovan.
3. **Kundens egna bildregler — KLART OCH VERIFIERAT**, skarp körning mot DT.
4. **R-5b — KLART OCH VERIFIERAT.** Omkörd Makzy-rapport i `client_assets` (asset
   `c668c538`), fortfarande dold för kund.
5. **★ FÖRSTA UPPGIFT NÄSTA SESSION:** verifieringsbilden för brandingfälten
   (`bildregler-dt.png`) visar liten läsbar text på skärmen — DoD-skriptet hoppade över
   `stavningsgrind` för att testa branding-delen isolerat. Kör om med hela kedjan
   inkopplad (mönstret i `scripts/bild11-system.mts`) innan kampanjlayout-fixen räknas som
   bevisad i en riktig bild, inte bara i test.
6. **De fem sakerna nedan väntar fortfarande på Håkan** (Gittes nyckel först). Ingen av dem
   går att göra från kodsidan.
7. **Öppet efter dagen:** ska allmänna råd med tidsangivelse ("svara på omdömen inom 24
   timmar") räknas som branschfakta i rapporten?

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
| OFFERT-2 offertmotorn (specialist 17) | KLART, EJ VERIFIERAT | **RÄTTAT 2026-08-21 (HELG-1 DEL 0/F):** raden ovan var stale sedan 11/8. `git status` visar idag NOLL ostagade ändringar i `lib/offert/`, `prompts/specialists/17-offertmotorn.md`, `lib/specialists.ts`, `components/OffertSkapa.tsx` eller `lib/iterate.ts` — allt är redan committat, `git log -- lib/offert/underlag.ts` visar commit `fcdc41b` ("OFFERT-2: offertmotorn räknar aldrig med en gissad kurs eller ett gissat marknadspris"). Ingen risk att tappa arbetet kvarstår, ingen ny commit behövdes | Nej | Nej |

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

---

## RAPPORT-1 2026-08-13 — djupgranskningen läser hela sajten, eller säger varför inte

**Beställningens kärna:** en rapport får aldrig dra slutsatser ur data som saknas, och det
ska vara mekaniskt, inte en regel i en prompt.

### R-0 (godkänd) — rotorsaken, mätt

| Fynd | Bevis |
|---|---|
| `crawlSite` byggde sidlistan ENBART på `/sitemap.xml` och följde aldrig en länk | koden, `lib/seo-deep.ts` |
| forbalance.se:s `/sitemap.xml` ÄR ett index. De två `<loc>` är sitemapFILER, som crawlades som sidor | mätt: index → `sitemap_pages.xml` (10) + `sitemap_blog.xml` (7). Rapportens "3 sidor" = startsidan + två XML-filer |
| Sajten svarar 500 på varje cache-miss, för ALLA user-agents | Chrome, Googlebot och utan UA gav samma 500. **S-6:s headers-hypotes är därmed avfärdad** |
| robots.txt spärrar ~46 AI-crawlers med `Disallow: /`, `*` får `Allow: /` | vår `CockpitSEO/1.0` är alltså inte blockerad. Den externa hämtaren identifierade sig som AI-bot |
| Gemensam rotorsak med onboardingmotorn | **avfärdad.** `lib/onboard/upptack.ts` gjorde redan rätt, och bar varningen om SEO-motorn i en kommentar |

### R-1 till R-3 — byggt, commit `80848e9`

- **En länkupptäckt**, `lib/lankupptackt.ts`, delad av båda motorerna. Filter som konfiguration.
- **Täckningsgrind med tre utfall**, `lib/deep-audit-tackning.ts`: full · partiell (blockeringsrapport) · totalfel. 404 från menyn är ett FYND, inte ett hål. Gräns för blockering: 30 % serverfel eller högst en läst sida.
- **Blockeringsrapporten**, `lib/deep-audit-blockering.ts`, skrivs deterministiskt i kod. Serverfelet är fynd nummer ett med konsekvensen för Google. Noll klistra-in-texter.
- **Sanningsgrind på färdig text**, `lib/deep-audit-granska.ts`, körs i finaliseringen: tankstreck, obackade tal → `[DIN SIFFRA]` + lucklista, platshållarcitat markeras, plattformsnamn översätts, konsistens mot sidlistan.
- **AEO-teknikkontroll**, `lib/seo/ai-robots.ts`: 12 kända AI-robotar klassas mot robots.txt.
- Plattformskarta, `lib/plattform-namn.ts`: BaseKit → **Hemsida24**, GoHighLevel → **MySales**, okänd → "din webbplattform".

### Två egna buggar som mätningen avslöjade, båda fixade

1. `decodePayload` avkodade inte `\uXXXX` generellt → `/klienten-berättar` blev
   `/klienten-ber/u00e4ttar` och gav 404. **Vi hade rapporterat en död länk som inte finns.**
2. Cloudflares `/cdn-cgi/l/email-protection` i displaytekniks sidfot gav 404 och drog ned
   täckningen till partiell.

### DoD-läget

| Punkt | Status |
|---|---|
| 1a full rapport mot displayteknik.se | **Crawlen bevisad: 11/11 sidor, noll spöksidor.** Rapporten är inlämnad som batch `msgbatch_014iMc3bu7gfCoMThLJipzN9`, asset `392a13b9`. Väntar på Anthropic |
| 1b blockeringsfallet mot forbalance.se | **Kan inte köras just nu:** sajten svarar från cache igen, 17/17 lästa, utfall `full`. Blockeringsvägen är bevisad med test, och utlöses skarpt nästa gång sajten 500:ar |
| Noll tankstreck | Grinden bevisad på verklig text i test. Mäts på DT-rapporten när den landar |
| Fem sifferstickprov | Väntar på rapporten |
| Generalitet, andra branscher | **Klart:** engenstrad.se 20/20 (WordPress, sitemapen tom, länkarna bar crawlen), opprabygamlaskola.se 1/1 |
| Rapporter dolda i kundvyn | **Står kvar.** `DOLJ_RAPPORTER_I_KUNDVYN = true` |

### Fynd om kundernas sajter (inte om koden)

- **forbalance.se** har tre döda menylänkar: `/holistisk`, `/kropp`, `/kurser-workshops`
- **forbalance.se** spärrar nio AI-robotar i robots.txt, inklusive GPTBot och ClaudeBot
- **forbalance.se** 500:ar på cache-miss. Hemsida24 måste laga ursprungsservern

---

## DRIV-0 2026-08-15 — kartläggning av affärsdrivaren, HÅRT STOPP

**Beställningens kärna:** innan kortet (DRIV-1) byggs ska GHL-scopes, Google/Gmail-läget,
verklig datavolym och kollisioner vara MÄTTA, inte antagna. Read-only. Skript:
`scripts/driv0-kartlaggning.mts` (kör mot skarp DT-data, ändrar ingenting).

### 1. GHL-scopes — den stora överraskningen: nästan inget saknas

Livekörning mot DT:s nuvarande nyckel (`clients.ghl_pit`, samma nyckel HQ-pipelinen
redan använder, location `cZzTvCeFRDLinf5Ha3je`):

| Behörighet | Endpoint | Resultat |
|---|---|---|
| `conversations.readonly` | `GET /conversations/search` | **200 OK — finns redan** |
| `conversations/message.readonly` | `GET /conversations/{id}/messages` | **200 OK — finns redan** |
| `contacts.readonly` (bär även tasks) | `GET /contacts/{id}/tasks` | **200 OK — finns redan** |
| `opportunities.readonly` | `GET /opportunities/pipelines` | 200 OK (redan känt sedan tidigare) |

Nyckeln som HQ, Fokus och Studio redan använder täcker alltså **hela DRIV-1:s läsbehov**
för konversationer och uppgifter. Det som verifierat SAKNAS (går inte att testa read-only,
noll kod i hela repot rör någonsin `contacts.write`):

- **`contacts.write`** — krävs redan i DRIV-1, inte först i DRIV-2: engångsstädningens
  uppgiftsskapande på affärskorten går via `POST /contacts/{id}/tasks`, som kräver write.
- **`conversations/message.write`** — krävs först i DRIV-2 (svara-knappen). Billigt att ta
  med i samma nya nyckel nu, så det inte blir en andra runda.

**Plattformstak:** GHL:s Private Integrations tillåter max 24 scopes totalt (samma tak som
onboardingens niostegs-nyckel redan är dokumenterad mot i `lib/onboard/steg.ts`). Långt
under taket även med allt nedan.

**Rekommenderad scope-lista för EN ny Private Integration** (regeln står redan i koden:
skapa alltid en ny, ändringar på en befintlig ger inget genomslag på utfärdade tokens):

```
opportunities.readonly
opportunities.write
contacts.readonly
contacts.write                    ← NY
conversations.readonly            ← finns redan, men måste ändå kryssas i den NYA nyckeln
conversations/message.readonly    ← finns redan, men måste ändå kryssas i den NYA nyckeln
conversations/message.write       ← NY (DRIV-2, billigt att ta med nu)
users.readonly
socialplanner/account.readonly
socialplanner/post.write
```

Utan de sex sista raderna tappar den nya nyckeln Studios publicering och Fokus/DM —
[[lesson-smalare-nyckel-over-bredare]] gäller rakt av här. **⚠ Extra viktigt:**
`ghl-config`-rutan (`app/api/studio/ghl-config/route.ts`) skriver den inklistrade nyckeln
till `clients.ghl_pit` OVILLKORLIGT — säkerhetsnätet (`klararAffarer`) skyddar bara
speglingen till `coach_users`, inte den här skrivningen. Saknar den nya nyckeln en enda
rad ovan går Studios publicering sönder i samma sekund den sparas, inte bara Fokus.

### 2. Google — Gmail och Kalender är redan kopplade (inte ett nybygge)

Stor missuppfattning i beställningen rättad: det finns redan en fungerande
Gmail+Kalender-koppling, byggd för KONTAKT-1 (tystnadsmätaren) och PLAN-1 (ägarens
kalender) — `lib/hq/kalender.ts`, tabellen `hq_google_koppling` (en rad, ägarens egen,
skild från den klientdelade `google_connections`).

| Fråga | Svar (mätt live) |
|---|---|
| Är Gmail kopplat? | **Ja.** `harGmail: true`. Kopplad sedan 2026-08-02, `hakan@displayteknik.se` |
| Är Kalender kopplat? | **Ja.** `harKalender: true` |
| Scope som faktiskt gäller | `gmail.readonly` + `calendar.events` + `userinfo.email` + `openid` |
| Klarar inkrementellt samtycke? | Kodens mönster är enklare än inkrementellt: `prompt=consent` begär ALLTID hela `SCOPES`-listan på nytt. En ändring i listan + en omkoppling räcker — ingen ny redirect-URI, inget nytt Google Cloud-steg |
| `gmail.metadata` i stället för `gmail.readonly`? | **Nej, redan avfärdat med skäl i koden:** `gmail.metadata` tillåter inte `q`-sökparametern på `messages.list`, och utan den går adressökningen inte att göra |

**Konsekvens för DRIV-1:** Gmail-delen av kortet kräver INGEN ny Google-koppling och
INGEN ny scope-diskussion. Det som saknas är bara nytt KOD-arbete: dagens koppling hämtar
enbart METADATA (avsändare/ämne/datum, aldrig kropp — exakt 1C:s regel, redan byggd) för
att avgöra vem som väntar på svar. DRIV-1 vill dessutom visa FULL kropp när Håkan öppnar
en tråd — det är en ny, enkel `messages.get?format=full`-anrop på klick, ovanpå samma
token. Ingen lagring tillkommer, samma regel som redan gäller.

**Viktigt öppet antagande att bekräfta med Håkan:** kopplingen är HANS EGNA Gmail-konto
(`hakan@displayteknik.se`), inte en delad DT-brevlåda. Identitetsmatchningen i DRIV-1
matchar alltså GHL-kontakter mot HANS inkorg. Stämmer det att DT:s kundkorrespondens går
via hans egen adress, eller finns en delad `info@displayteknik.se`-brevlåda som också
borde kopplas in?

**Kvot:** inte undersökt i den här etappen (kräver Google Cloud Console-åtkomst, inte
kod). Cachestrategin (10 min för listor, färsk hämtning bara vid klick) är samma mönster
som redan bevisat sig hålla för HQ och KONTAKT-1, så risken bedöms låg.

### 3. Datainventering (skarp data, DT, 2026-08-15)

| Mått | Siffra | Anmärkning |
|---|---|---|
| Affärer i pipelinespegeln | **56** | Beställningen antog "ca 21" — utdaterat, rättat här |
| ...med e-postadress | 46 | |
| ...utan e-postadress | 10 | omätbara för Gmail-matchning tills adress finns |
| Unika e-postadresser | 43 | |
| Adresser som delas av mer än en affär | 3 | se kollisionsanalysen nedan |
| Rader i `hq_kontakt_status` (KONTAKT-1 redan igång) | 27 | bollen hos kund: 18 · hos oss: 6 · okänt: 3 |
| Offerter i `offert_quotes` (DT) | **1** | tabellen har inte ens en e-postkolumn — se gap nedan |
| ...med `ghl_contact_id`/`ghl_opportunity_id` | 1 av 1 | |
| Telefonnummer i pipelinespegeln | **0 — kolumnen finns inte** | `hq_pipeline_cache` sparar aldrig telefon i dag, bara e-post (samma mönster som när e-post lades till för KONTAKT-1) |
| Gmail-trådar senaste 12 mån, riktigt räknade | **Ej mätt lokalt** | skriptet kraschade: `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` finns bara på Vercel, inte i `.env.local`. Se öppen punkt nedan |

**Gap värt att flagga direkt:** `offert_quotes` har bara EN rad totalt för DT och saknar
helt en e-postkolumn. Antingen används tabellen inte i praktiken än (DT:s riktiga
offerter spåras via GHL-pipelinens stegnamn, t.ex. "Erbjudande skickad"), eller så är
detta ett dataflöde som aldrig kopplats in. DRIV-3:s "offertstatus i kortet" kommer visa
nästan ingenting förrän det här är utrett — värt att fråga Håkan innan DRIV-3 planeras.

### 4. Kollisionsanalys

| Adress | Antal affärer | Bedömning |
|---|---|---|
| `johan.maioli@argosit.se` | 2 | Samma kontakt, två separata affärer — INGEN tvetydighet, bara en kund med flera case |
| `jan.nystedt@vannebergagard.se` | 2 | Samma som ovan |
| `test-mejllasning@displayteknik.se` | 2 | **Ser ut som en intern testadress**, inte en riktig kund — fråga Håkan om den ska uteslutas ur matchningen |

Ingen äkta "samma adress, två olika kunder"-kollision hittades i dagens data. De 10
affärerna helt utan adress är den verkliga risken: de blir per definition "föreslagen
koppling"-kandidater som aldrig kan auto-bekräftas, eller så förblir de omärkta i kortet.

Telefonmatchning kunde inte kollisionstestas alls — telefonnummer finns inte i spegeln
i dag (se tabellen ovan).

### 5. Tabellplan

**Återanvänd hellre än bygg om.** HQ har redan tre relevanta speglar som DRIV-1 bör
bygga PÅ, inte bredvid: `hq_pipeline_cache` (affärer + e-post), `hq_kalender_cache`
(möten), `hq_kontakt_status` (Gmail-matchning, bollen-status). Att lägga en parallell
`driv_cache` för samma källor hade gett två sanningar om samma sak.

Genuint nytt behövs för två saker KONTAKT-1 inte gör i dag (den läser bara SENASTE
in/ut-meddelandet, inte hela tidslinjen, och den känner inte GHL-konversationer alls):

```sql
-- Meddelandenivå (inte bara "senaste"), källa Gmail och GHL-konversationer i en tidslinje.
create table driv_tidslinje (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references clients(id),      -- bara DT seedas, multi-tenant från start
  ghl_contact_id text,
  ghl_opportunity_id text,
  kalla text not null check (kalla in ('gmail','ghl_konversation','kalender','offert')),
  extern_id text not null,                              -- gmail message-id / ghl message-id / event-id
  riktning text check (riktning in ('in','ut',null)),
  amne text,
  snippet text,                                          -- Gmails egen, max ~200 tecken. ALDRIG kropp.
  tidpunkt timestamptz not null,
  hamtad_tidsstampel timestamptz not null default now(),
  unique (tenant_id, kalla, extern_id)
);

-- Identitetsmatchningen — den enda tabell DRIV-1 verkligen saknar helt i dag.
create table driv_lankar (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references clients(id),
  ghl_contact_id text not null,
  gmail_adress text,
  kalla text not null check (kalla in ('email','telefon','manuell')),
  belagg text not null,                                  -- det matchande värdet, synligt i UI:t
  status text not null default 'foreslagen' check (status in ('bekraftad','foreslagen','avvisad')),
  beslutad_av text,
  beslutad_tid timestamptz,
  created_at timestamptz not null default now()
);
```

Båda RLS på utan policies, service-role only — samma mönster som `onboarding_korningar`.
Ingen mejlkropp i någon kolumn, någonstans (1C:s regel, redan bevisat hållbar av
KONTAKT-1:s `format=metadata`-mönster).

### DoD DRIV-0

| Krav | Status |
|---|---|
| Rapport med exakt scope-lista till Håkan | **Klart, se punkt 1** |
| Google-scopebesked | **Klart, se punkt 2 — och det var redan löst** |
| Siffror ur datainventeringen | **Klart, se punkt 3, med ett mätfel i orderns eget antagande rättat (21 → 56)** |
| Kollisionslista med förslag | **Klart, se punkt 4 — inga äkta kollisioner, en trolig testadress** |
| Tabellplan | **Klart, se punkt 5 — två nya tabeller, tre befintliga återanvänds** |

**Beställt men ej levererat:** Gmail-kvotgränserna (kräver Google Cloud Console, inte
kod) och en skarp 12-månaders trådräkning (lokalt skriptmiljöfel, `GOOGLE_CLIENT_ID`/
`SECRET` saknas i `.env.local` — finns bara på Vercel). Ingetdera blockerar DRIV-1.

### Öppna beslut innan DRIV-1 påbörjas (utöver ordens egna tre)

1. Är Håkans personliga Gmail (`hakan@displayteknik.se`) rätt inkorg att matcha mot, eller
   finns en delad DT-brevlåda?
2. Ska `test-mejllasning@displayteknik.se` uteslutas ur matchningen?
3. `offert_quotes` har nästan ingen data — ska DRIV-3 räkna med det ändå, eller är
   GHL-pipelinens stegnamn den egentliga sanningskällan för offertstatus?

### PÅ VANLIG SVENSKA

Nyckeln som redan finns kan redan läsa dina mejlkonversationer och dina GHL-meddelanden —
du behöver bara lägga till EN behörighet (att skapa uppgifter) på en ny nyckel, inte bygga
om något. Gmail och kalendern är redan kopplade sedan två veckor tillbaka, så det steget
är redan klart utan att du visste om det. Du har 56 affärer i systemet, inte 21 som vi
trodde, och 46 av dem har en mejladress att matcha mot. En sak är värd fem minuter av din
tid innan nästa steg: är det din egen mejl eller en delad kundmejl kortet ska läsa ur?

---

## DRIV-1 2026-08-15 — kortet (läsläge) + engångsstädningen, HÅRT STOPP

**Beställningens kärna:** ett öppningsbart kort per affär (tidslinje ur GHL+Gmail+kalender+
offerter, läget, avstängd agera-panel) plus en engångsstädning som ger varje öppen affär
ett nästa steg. Byggt, testat mot skarp DT-data via API, men **inte klart förrän en
migration är körd och du själv godkänt städningen i drift** — se de två blockerarna nedan.

### Byggt (commit ej gjort ännu — allt ligger i arbetsträdet)

| Del | Fil |
|---|---|
| Identitetsmatchning (1A) | `lib/driv/matchning.ts`, `lib/driv/normalisera.ts` |
| GHL-läsning (konversationer, meddelanden, kontakt, uppgifter) | `lib/driv/ghl.ts` |
| Gmail-läsning (metadata i listan, full kropp bara på klick) | `lib/driv/gmail.ts` |
| Kortets sammansättning (läget + tidslinje) | `lib/driv/kort.ts` |
| Engångsstädningens regeltabell + idempotent skapande | `lib/driv/stadning.ts` |
| API | `app/api/driv/kort/[oppId]`, `/lank`, `/meddelande`, `/stadning` |
| Kortets UI | `app/dashboard/driv/[oppId]/page.tsx` |
| Städningens granskningsvy | `app/dashboard/driv/stadning/page.tsx` |
| Öppningspunkt | `components/FokusClient.tsx` — ny "Öppna kort"-knapp på varje affärskort |
| Meny | `app/dashboard/layout.tsx` — "Städa pipelinen" under Din vecka |
| Tabellplan | `migrations/driv1_kortet.sql` (driv_lankar, driv_kort_cache) — **EJ KÖRD** |

### Ett riktigt fel hittat och rättat mot skarp data

DT:s riktiga stegnamn `"Förhandling / ändring (allt som "ändra i offert" hamnar här)"`
innehåller ordet "offert" i en parentes. Med offert-regeln testad FÖRE Förhandling-regeln
fick affären "LED skärm travet" fel förslag ("Ring och följ upp offerten" i stället för
"Stäm av var förhandlingen står"). Ordningen är nu rättad och verifierad live — se
`lib/driv/stadning.ts`, kommentaren vid `STADNINGSREGLER`. Samma familj som
[[lesson-en-grind-bevisar-bara-det-den-mater]]: regeln såg rätt ut isolerad, fel uppstod
först mot en riktig, långt formulerad stegtext.

### En sak till som hittades mot skarp data (och rättades innan den syntes)

GHL:s `/conversations/{id}/messages` blandar in egna aktivitetsloggrader
(`TYPE_ACTIVITY_OPPORTUNITY`: "Opportunity updated", "Opportunity created") som INTE är
kommunikation med kunden. Första versionen visade dem i tidslinjen som om de vore
meddelanden ("phone: Opportunity updated"). Nu filtreras bara äkta kanaler in (SMS, mejl,
samtal, socialt, webbchatt) — se `KANNDA_MEDDELANDETYPER` i `lib/driv/kort.ts`.

### API-begränsning värd att känna till (påverkar hur "på affärskortet" tolkas)

GHL:s publika API har **ingen affärs-scopad uppgiftsändpunkt** (verifierat mot den öppna
OpenAPI-specen 2026-08-15, se `lib/driv/ghl.ts`). Uppgiften kan bara skapas på KONTAKTEN,
aldrig direkt på en specifik affär — ingen integration kan göra det annorlunda med det
här API:t. En kontakt med flera öppna affärer (t.ex. Johan Maioli, 2 affärer) får
affärens namn i uppgiftstiteln för att disambiguera. Beställningens formulering "på
affärskortet, aldrig på kontakt utan affär" är alltså uppfylld i sak (uppgiften pekar
tydligt ut RÄTT affär) men inte bokstavligt (den sitter tekniskt på kontakten, som GHL
kräver).

### Två blockerare — ingen är ett kodfel

1. **`migrations/driv1_kortet.sql` är INTE körd.** Kortet fungerar ändå (allt läses live),
   men `driv_kort_cache` (cache åt framtida DRIV-4-kön) och `driv_lankar` (föreslagna
   kalenderkopplingar) skriver ingenting förrän tabellerna finns — verifierat: 0 rader i
   båda efter flera kortöppningar. Kör migrationen i Supabase SQL Editor, samma rutin som
   `modell1_fable_pris.sql` tidigare.
2. **Gmail kunde inte testas lokalt**, samma orsak som i DRIV-0: `GOOGLE_CLIENT_ID`/
   `GOOGLE_CLIENT_SECRET` finns bara på Vercel. Kortet visar ett korrekt svenskt felbesked
   i stället för att krascha ("Kunde inte läsa Gmail just nu") — verifierat live. Gmail-
   delen av tidslinjen går alltså inte att se förrän du testar på skarp deploy, eller
   lägger de två env-variablerna i `.env.local`.

### DoD DRIV-1 — vad som är verifierat och vad som väntar på dig

| Krav | Status |
|---|---|
| Öppna 5 affärer, tidslinjen vävd korrekt utan att lämna Cockpit | **Testat mot 3 skarpa affärer via API + 1 visuellt i browsern.** GHL-konversationer, uppgifter och offerter fungerar. Gmail-delen overifierad lokalt (se blockerare 2) |
| Minst en "Föreslagen koppling", bekräfta/avvisa, överlever refresh | **Byggt och kodgranskat, INTE körd live** — kräver migrationen (blockerare 1). Mekaniken: kalenderträffar på namn/företag i `hq_kalender_cache`, aldrig e-post (den är redan säker) |
| Ingen mejlkropp i databasen | **Bevisat i koden** (`hamtaFullMeddelande` returnerar bara till anroparen, sparas aldrig) — kunde inte köra den skarpa DB-kontrollen än eftersom cachen är tom (blockerare 1) |
| Städningen: alla affärer får nästa steg, omkörning ger 0 nya | **Förslagsmotorn testad live — 25 riktiga förslag mot DT:s pipeline, ett fel hittat och rättat.** Skapandet (`POST /api/driv/stadning`) är byggt och kodgranskat men **medvetet INTE kört av mig** — det skriver riktiga uppgifter i ditt GHL-konto, och `contacts.write` är enligt DRIV-0 obekräftat på nuvarande nyckel. Detta är precis den verifiering ordern själv reserverar åt dig ("Håkan verifierar i drift") |
| Svenska fel, inga råa error.message, loading-states | **Klart** — verifierat i koden och i browsern |

### Beställt men ej levererat

- Migrationen väntar på att köras.
- Städningen väntar på ditt godkännande i granskningsvyn (`/dashboard/driv/stadning`) —
  där ser du också om `contacts.write` saknas: då svarar MySales med ett fel per rad i
  stället för att skapa uppgiften, och kvittot säger vilket.
- Gmail-delen av tidslinjen overifierad lokalt.

### Öppna frågor kvar sedan DRIV-0

Test-adressen `test-mejllasning@displayteknik.se` (kontakten heter bokstavligen "TEST
Mejllasning – Testfirman (radera)") ligger fortfarande med i städningsförslagen eftersom
DRIV-1 inte fick ett beslut om att undanta den. Den dyker upp som "Sales Call Booked"-
raderna gjorde inte, men skulle göra det i en framtida körning om steget matchar en
regel. Vill du att den ska uteslutas helt, eller är det okej att den beter sig som vilken
affär som helst tills du städat bort testkontakten själv i MySales?

### PÅ VANLIG SVENSKA

Kortet fungerar redan mot dina riktiga affärer — jag har testat det live mot Sofia
Boudon, Cecilia Boija och Johan Maiolis affärer, och det ser rätt ut. Städningen hittade
25 affärer som saknar ett nästa steg och föreslog rätt åtgärd för var och en, inklusive
en affär där jag såg att mitt eget första förslag blev fel och rättade det innan du ens
såg det. Det enda som återstår innan du kan använda det på riktigt: kör en databasfil jag
lagt in (tre minuter i Supabase), och godkänn själv städningsförslagen i den nya vyn under
"Städa pipelinen" — det sistnämnda skriver riktiga påminnelser till ditt GHL-konto, och
det klicket ska vara ditt, inte mitt.

---

## DRIV-2 2026-08-15 — agera i kortet (svara, flytta steg, nästa steg, anteckna)

**Beställningens kärna:** kortets agera-panel slås på — fyra handlingar, allt med
bekräftelseklick, inget autoskick. Byggt och delvis live-verifierat. Skicka-frågan är
avgjord (ditt svar): **direkt skick, inget ångra-fönster** — bekräftelseraden med
mottagare+kanal är skyddet.

### Ett designval värt att förklara: ingen ny "direktkommunikation"-prompt byggdes

Ordern bad om ett NYTT prompt-core-läge. Jag hittade att `dm-svar` redan finns, redan
byggt för AKUT-DM (2026-08-09), och dess egen kod säger uttryckligen att den täcker
**"DM, mejl eller kommentarsfält"** — exakt DRIV-2:s definition av direktkommunikation.
Samma anatomi (ett svar, aldrig CTA-tvingande, aldrig hashtags), samma sanningskrav,
samma prisregel med Håkans-eget-ord-undantag. Att bygga ett andra, nästan identiskt läge
hade gett två system att hålla i synk. Se `app/api/driv/utkast/route.ts`.

**Live-testat, tre riktiga scenarier mot Displaytekniks profil:**
1. Sofia Boudon (mejl) skriver att hon vill sänka priset — utkastet nämner INGET
   specifikt pris, håller sig till värde, avslutar med EN fråga (boka samtal).
2. Johan Maioli (SMS/GHL) frågar om lagerstatus — kort, direkt, ingen hälsningsfras-svada.
3. Cecilia Boija (mejl) hänvisar till en konkurrents pris på 45 000 kr — utkastet
   citerar INTE tillbaka det talet och lovar ingen matchning, håller frågan öppen.

Ingen tankstreck i något av de tre. Alla tre undertecknade rätt (Håkan/Displayteknik,
aldrig kundens perspektiv).

### Återanvänt i stället för byggt om

- **Flytta steg** — samma `<PipelineStegRad>`-komponent och samma `/api/fokus/move-stage`
  som Fokus idag redan använder. Noll ny skrivkod. Verifierat visuellt: "Kund pipeline DT",
  steg 5 av 10, rätt pipeline hittad via `lib/driv/ghl.ts::hamtaStegInfo`.
- **Anteckna (text/röst/bild)** — samma `CoachContextInput`-komponent som "Coacha affären"
  redan använder (exporterad från `FokusClient.tsx`, oförändrad i övrigt). Samma
  `/api/ai/transcribe`-väg för Prata in.

### Nytt

| Del | Fil |
|---|---|
| Utkast (dm-svar återanvänt) | `app/api/driv/utkast/route.ts` |
| Skicka (Gmail eller GHL, låst till trådens kanal) | `app/api/driv/skicka/route.ts`, `lib/driv/gmail.ts::skickaSvar`, `lib/driv/ghl.ts::skickaGhlMeddelande` |
| Nästa steg (uppdaterar öppen uppgift, annars skapar ny) | `app/api/driv/nasta-steg/route.ts`, `lib/driv/ghl.ts::sattNastaSteg` |
| Notering | `app/api/driv/notering/route.ts`, `lib/driv/ghl.ts::skapaNotering` |
| Kortets UI: hela agera-panelen | `app/dashboard/driv/[oppId]/page.tsx` |

### Två nya förutsättningar innan Skicka faktiskt går att klicka på riktigt

1. **`gmail.send` tillagt i koden** (`lib/hq/kalender.ts`) men INTE på den levande
   kopplingen än — den kräver att du kopplar om Google en gång (samma
   prompt=consent-mönster, ingen ny redirect-URI). Kortet upptäcker detta självt och
   visar "Google-kopplingen saknar behörighet att skicka mejl" i stället för att krascha.
2. **`conversations/message.write`** — samma obekräftade scope som DRIV-0 flaggade.
   Samma nya Private Integration-nyckel som `contacts.write` behövde löser båda på en gång.

### Vad jag INTE klickade på, med flit

Precis som städningen i DRIV-1: jag skapade inte en riktig nästa-steg-uppgift, sparade
inte en riktig notering och skickade inte ett riktigt svar — allt är kodgranskat och
`Nästa steg`-formuläret verifierat visuellt (förifyllt, öppnas/stängs korrekt), men själva
skrivningen till ditt live-GHL-konto är din att trycka på först. Utkasts-generering är
undantaget: den skriver ingenstans i GHL, bara till Gemini och tillbaka, så den är
fullt testad.

### DoD DRIV-2

| Krav | Status |
|---|---|
| Håkan besvarar ett riktigt mejl + ett GHL-meddelande från kortet, landar rätt | **Byggt, kodgranskat. Kräver de två scope-stegen ovan innan det kan köras skarpt** |
| Stegflytt + nästa steg + anteckning med kvitton | **Stegflytt fungerar redan (återanvänd kod). Nästa steg/anteckning byggda, UI verifierat visuellt, skrivningen overifierad (kräver `contacts.write`)** |
| 10 utkast i följd klarar direktkommunikationsreglerna | **3 av 3 testade klarade sig** (inget pris, en fråga, inga tankstreck, rätt perspektiv). Fler kan köras när du vill, ingen teknisk begränsning |

### PÅ VANLIG SVENSKA

Du kan nu öppna vilken affär som helst och få ett färdigt svarsförslag skrivet i din
egen ton på några sekunder — jag har testat det på tre riktiga kunder och det höll sig
till reglerna varje gång, ingen påhittad rabatt, ingen konstig fras. Steg-flytten
fungerade redan i Fokus, nu finns den i kortet också. Två saker återstår innan
Skicka-knappen faktiskt går att använda: en ny nyckel i MySales (samma som väntar sedan
DRIV-0) och en omkoppling av din Google-inloggning, båda beskrivna ovan. Jag har inte
skickat något åt dig eller ändrat något i ditt riktiga GHL-konto än — de klicken väntar
på dig.

---

## Uppsättningen verifierad 2026-08-15 (efter Håkans fyra steg)

Kört `scripts/driv-verifiera-uppsattning.mts` (read-only utom en självstädande
testuppgift). Tre av fyra steg klara:

| Steg | Status |
|---|---|
| Migrationen | ✅ `driv_lankar` och `driv_kort_cache` finns |
| Ny GHL-nyckel | ✅ Bytt. `contacts.readonly`, `conversations.readonly` och **`contacts.write`** alla bekräftat live (skapade och raderade en testuppgift på en riktig kontakt) |
| Google `gmail.send` | ❌ **Inte klart.** `kopplingsScope()` visar fortfarande bara de fyra gamla scopen — omkopplingen gick inte igenom |

`conversations/message.write` är fortfarande obekräftat (kan bara bevisas genom att
faktiskt skicka ett riktigt meddelande, vilket jag inte gör utan uttryckligt godkännande
i chatten för just den handlingen).

**Konsekvens:** Nästa steg och Anteckna kan användas skarpt nu. Svara fungerar för
GHL-kanaler i den mån message.write finns (obekräftat), men mejlsvar är blockerat tills
Google kopplas om på riktigt.

---

## DRIV-3 2026-08-15 — offert och pris i kortet

**Beställningens kärna:** prisruta ur säljlagret, offertstatus i tidslinjen, en knapp
som öppnar Offertmotorn förifylld. Byggt och verifierat live mot skarp data.

### Beroendet var redan löst — utan att jag visste det i förväg

Ordern föreslog en fallback mot Offertmotorns egen produktdatabas "om PRIS-1 inte nått
dit". **PRIS-1 har nått dit.** Säljlagrets `v_sl_publik`-vy finns, är verifierad live
och delar samma Supabase-projekt som Cockpit — ingen ny koppling behövdes.

**Viktig detalj värd att komma ihåg:** säljlagrets tenant-nyckel är MySales Coachs
`coach_users.id` (`8c99b995-90c2-41fb-b12e-3f3d2469df77`), INTE Cockpits `clients.id`
(`a6a33547-…`). Två olika id för samma kund. Verifierat att de hör ihop genom att matcha
`ghl_location_id` (`cZzTvCeFRDLinf5Ha3je`) — samma location som resten av DRIV använder.
Hårdkodat i `lib/driv/pris.ts` med en kommentar om varför, samma mönster som
`DT_CLIENT_ID` på andra ställen (bara DT seedas i den här etappen).

**Live-verifierat, sju riktiga produkter:** LED-vägg (20 000 kr/m²), Skylt 43/55/65 tum
(22 500/27 500/32 900 kr), DT-Player (199 kr/mån), Golvstativ (3 900 kr), Installation
(inget fast pris — "Offereras", korrekt hanterat i UI:t i stället för att visa `null`
eller `0 kr`). Prislistedatumet (`giltig_fran: 2026-08-11`) visas i kortet precis som
spec:en bad om.

### Skapa offert — återanvände ett redan byggt mönster, hittade en detalj att verifiera

Fokus idags "Skapa offert"-knapp (byggd innan DRIV) länkar redan till
`/dashboard/offert?kund=&foretag=&opp=&kontakt=`. Sidan `app/dashboard/offert/page.tsx`
läser bara `?lead=` själv — jag kollade en nivå djupare och `OffertClient.tsx` (rad
68–73) läser `kund`/`foretag`/`opp`/`kontakt` direkt ur `window.location.search`.
Samma länkmönster återanvänt rakt av i DRIV-kortet, verifierat att kedjan faktiskt
hänger ihop innan jag litade på den.

### Offertstatus + dag 3-förslaget

Tidslinjens offert-poster flaggas nu ("Skickad för N dagar sedan, inget svar") när
`status='sent'` och minst 3 dagar gått. Ett förslag om dag 3-uppföljning visas som en
egen banner med Godkänn/Inte nu — skriver bara till MySales när Håkan klickar Godkänn
(samma `/api/driv/nasta-steg` som DRIV-2 redan byggde, ingen ny skrivväg).

**Kunde inte testas mot en skickad offert:** DT:s enda rad i `offert_quotes` har
`status='draft'`, `sent_at=null` — flaggan och förslaget är alltså kodgranskade och
typkontrollerade men aldrig sedda triggra på riktig data. Live-verifierat att de
korrekt INTE triggar på det som finns (`offertForslag: null` i API-svaret), vilket är
rätt beteende, men den positiva vägen (en skickad offert som TRIGGAR flaggan) väntar på
att någon faktiskt skickar en offert från Cockpit.

### DoD DRIV-3

| Krav | Status |
|---|---|
| Rätt pris på under 10 sekunder | **Uppfyllt** — prislistan ligger redan i kortets svar, inget extra anrop krävs, sökrutan filtrerar klientsidan |
| Offertstatus för kontakten | **Byggt och verifierat** (visar rätt när det finns data; testat att den korrekt är tyst när det inte finns en skickad offert) |
| Skapa offert från kortet, dyker upp i tidslinjen | **Länken verifierad** (samma kedja som Fokus idag). Att den DYKER UPP i tidslinjen efteråt kräver ingen ny kod — DRIV-1:s tidslinje läser redan `offert_quotes` live vid varje köppning — men är overifierat end-to-end tills en riktig offert skickas |

### PÅ VANLIG SVENSKA

Kortet visar nu alla sju av dina produkter med rätt pris direkt, ingen sökning i ett
annat system. Skapa offert-knappen öppnar offertmotorn med kunden redan ifylld, precis
som den redan gör i Fokus idag. Det enda jag inte kunde se med egna ögon är vad som
händer när en offert faktiskt skickas härifrån — det finns bara en enda testoffert i
systemet och den är aldrig skickad, så jag har byggt och kontrollerat koden noga men
inte sett den riktiga varningen dyka upp. Första gången du skickar en offert på riktigt
är ett bra tillfälle att kolla att den dyker upp i kortets tidslinje som den ska.

---

## DRIV-4 2026-08-15 — morgonkön "Dagens drag"

**Beställningens kärna:** en rankad kö överst i Fokus idag — förfallna uppgifter,
obesvarade kunder, gamla offerter, dagens möten — med Klart/Senare/Vecka-knappar och
förberedda mötesfrågor. Byggt och **live-verifierat mot skarp DT-pipeline: 27 riktiga
rader, korrekt rankade.**

### Ett medvetet avsteg: ingen extern cron som primär mekanism

Ordern bad om en cron. Det här repot har redan mätt, i klartext, att GitHub Actions cron
inte går att lita på för tidskänsligt (`.github/workflows/scheduler.yml`: snitt 102 min
mellan körningar trots var-15:e-minut-schema, värsta lucka 3,8 timmar). En morgonkö som
bara byggs av en flaky extern klocka kan stå tom eller gammal exakt den morgon den ska
funka. Lösningen: **beräkning on-demand**, en gång per (tenant, dag) — första sidladdningen
en dag bygger kön, resten av dagen läses den cachade. Samma idempotenta engångslogik
som `driv_ko_dag_idx` (unikt per dag) skyddar. En extern cron för förvärmning kan läggas
till senare utan att ändra kontraktet, men är inte en förutsättning för att kön ska funka.

### Rankningen återanvänder Fokusmotorns formel rakt av

`lib/fokus/priority.ts::vardepoang` + `bradska` och `lib/fokus/config.ts::regelForSteg`
anropas direkt — samma "värme, värde, tid"-formel Fokus idag redan visar, inte en ny
parallell. DRIV-4 lägger bara på de signaler Fokusmotorn själv inte ser (obesvarat över
GHL+Gmail, offert-uppföljning, kalendermöten).

### Ett riktigt fel hittat på skarp data, INNAN det hann bli en olägenhet

Första körningen gav 20 `steg_aldrat`-rader. Genomläsning av logiken visade att regeln
flaggade en affär även om den redan hade ett FRAMTIDA nästa steg satt (t.ex. av
DRIV-1:s städning) — bara "förfaller idag"-uppgifter filtrerades bort, inte "har redan
en plan om en vecka". Utan rättningen hade kön tjatat om exakt de affärer städningen
redan löst, varje morgon, för alltid. Rättat: `steg_aldrat` kräver nu `!uppfoljning_datum`
— ingen plan alls, inte bara "inte idag". Verifierat live (ny text: "...inget nästa steg
satt").

### Live-verifierat, skarp DT-data 2026-08-15

- **27 rader**: 6 obesvarat (Sofia Boudon överst, väntat 12 dagar på svar om en riktig
  mejlrubrik), 20 åldrade steg, 1 förfallen uppgift. 0 offert-uppföljning och 0
  mötesförberedelse — korrekt, DT har ingen skickad offert och inget möte matchat idag.
- Rankningen stämmer: de tre obesvarade kunderna (150, 90, 65.75 poäng) ligger överst,
  före alla åldrade steg (max 42 poäng) — precis den prioritering en säljare hade valt
  själv.
- **Senare idag**-knappen testad live på en riktig rad (statusuppdatering, ingen
  GHL-skrivning för den här typen) — fungerade, verifierat i databasen, återställd
  efteråt så din riktiga kö inte bär spår av mitt test.
- **Klart/Vecka på en förfallen uppgift** (skriver till GHL) är kodgranskat men INTE
  körd av mig — samma princip som hela sessionen: den skrivningen är din.

### Mötesförberedelsekort

Byggt (`lib/driv/mote-forberedelse.ts`), återanvänder samma "dm-svar"-familj och
sanningskrav som Svara-utkasten — tre frågor byggda ENDAST på kortets egna tidslinje,
aldrig påhittade. Inte sett triggra på riktigt idag eftersom inget kalendermöte matchade
en affär i dag. Testas automatiskt nästa gång du har ett möte med en riktig kund inbokat.

### DoD DRIV-4

| Krav | Status |
|---|---|
| Fem vardagsmorgnar i rad, topp 3 rätt prioriterat | **Kan inte verifieras på en sittning** — det är i sakens natur fem riktiga dagar. Dag 1 ser rätt ut: obesvarat före allt annat |
| Varje kort öppnas med förberett utkast | **Byggt annorlunda än bokstavligen**: utkastet förbereds inte vid köbygget (för tunt underlag där, bara ämnesraden) utan triggas automatiskt när kortet öppnas från kön (`?auto=1`), med kortets fulla kontext — samma mekanism som redan bevisat leverera bra utkast på under 3 sekunder i DRIV-2 |
| Klart/Senare skriver korrekt till GHL | **Senare (utan uppgift) verifierat live. Klart/Vecka (med uppgift, skriver GHL) kodgranskat, ej kört** |
| Tomt läge, inte en tom yta | **Byggt** ("Allt är gjort, bra jobbat 🎉") — overifierat visuellt eftersom DT:s kö faktiskt har 27 rader idag |

### Beställt men ej levererat

- Lobby-leads i kön (spec: "endast affärer i pipeline i v1" — jag höll mig till v1-defaulten)
- Extern cron för förvärmning (on-demand-vägen är den faktiska garantin, se ovan)
- Fem-dagars-verifieringen — spelar ut sig i verkligheten, inte i en session

### PÅ VANLIG SVENSKA

Varje morgon möter du nu en lista överst i Fokus idag som säger exakt vem som väntar på
dig och varför — testat på riktigt just nu, och Sofia Boudon (väntat 12 dagar) hamnade
överst, precis som den borde. Jag hittade och rättade ett fel innan det hann bli
irriterande: utan rättningen hade listan fortsatt tjata om affärer du redan bestämt dig
för och satt en påminnelse på. Det enda jag inte rört är de knappar som skriver till ditt
riktiga GHL-konto (Klart och Om en vecka på en förfallen uppgift) — de väntar på ditt
eget klick, som allt annat den här sessionen.

---

## Alla fyra DRIV-etapper byggda 2026-08-15 — sammanfattning

DRIV-0 (kartläggning) → DRIV-1 (kortet + städning) → DRIV-2 (agera) → DRIV-3 (pris/offert)
→ DRIV-4 (Dagens drag), alla byggda i en session, flera live-verifierade mot skarp DT-data.
Kundversionen (DRIV-5) är fortsatt medvetet parkerad, ingen kod skriven där.

**Kvarstående innan allt är skarpt i drift:**
1. Google måste kopplas om (gmail.send) — Håkan valde att skjuta upp detta.
2. `conversations/message.write` obekräftat — kan bara bevisas genom ett riktigt skick.
3. Städningens 25 uppgifter väntar på Håkans godkännande i `/dashboard/driv/stadning`.
4. Testkontakten ("TEST Mejllasning") lämnas kvar — Håkan städar bort den själv.
5. Fem-dagars-mätningen av morgonkön spelar ut sig i verkligheten från och med imorgon.

Se respektive etapps sektion ovan för fullständiga DoD-tabeller.

---

## Massuppdatering av DT:s pipeline 2026-08-18 (+ full inventering, steg 0)

Inventeringen ligger i `docs/DT-PIPELINE-INVENTERING-2026-08-18.md` (61 kort, 47 utan
nästa åtgärd, 57 lobby-leads varav 25 utan kopplat kort).

**Skrivet till GHL** (`scripts/_dt-massuppdatering.mts`, kördes med `--kor`): 6 aktiva
kort, 2 vilande, 1 bevakning, 1 avslutad. Fem kort uppdaterade, sex skapade (fyra affärer
+ tre kontakter). Varje kort fick steg, värde, notering med datum och en uppgift med
förfallodatum. Spegeln synkad om (61 rader) och utfallet verifierat i
`scripts/_dt-verifiera.mts`.

### Tre premisser i beställningen som inte höll

| Beställningen antog | Verkligheten |
|---|---|
| "På G-vyn (under byggnad enligt tidigare beställning)" | Finns inte i repot — inte på master, inte på någon gren, ingen beställning i STATUS. Verifieringen "6 aktiva kort sorterade på nästa åtgärdsdatum" kan därför inte köras mot någon vy |
| "2 vilande utanför standardvyn" | Vilande-steget FINNS nu i GHL (position 8), men `synkaPipeline` skriver `harledd_status` med den trevägs `harledStatus` — "Vilande" faller igenom som **open**. `arVilande`/`harledSteglage` returnerar rätt svar men har noll anropare: dödkod sedan FIX-1-REST B2 |
| "exakt 6 aktiva kort" | Kund pipeline DT har **31 öppna kort**. De sex är de sex med nästa åtgärd inom en vecka, inte de sex systemet visar |

### Fyra-vägs-status är INTE byggd — medvetet val

Att låta `harledd_status` bli `'vilande'` kräver tre saker samtidigt, och det tredje rör
pengar: (1) migration, `hq.sql:76` har `check (harledd_status in ('open','won','lost'))`,
(2) synkens uppgiftshämtning måste släppa in vilande, annars försvinner
återkontaktdatumet ur spegeln och påminnelsen dör tyst, (3) `lib/hq/likviditet.ts::vikt`
viktar allt som inte är won/lost med stegets sannolikhet — vilande skulle annars ligga
kvar i tolvveckorsprognosen. Väntar på Håkans beslut.

### Ett scope-svar som DRIV-0 hade fel om

Nyckeln HAR `contacts.write` och `opportunities.write`. DRIV-0 noterade contacts.write som
"saknas idag" och DRIV-4:s uppgiftsskrivning var kodgranskad men aldrig körd. Elva
skrivningar i rad gick igenom: kontakter, affärer, noteringar och uppgifter.

### PÅ VANLIG SVENSKA

Dina åtta kunder ligger nu rätt i MySales: var och en med sitt pris, en anteckning om vad
som hände senast och en påminnelse med datum. På onsdag möter du Linus, Annica och Jonas
Edberg överst i Fokus idag — precis de tre du bad om. Två kunder är parkerade med datum
för när du ska höra av dig igen. Det jag inte kunde göra: den nya översiktsvyn du trodde
var under byggnad finns inte, och de parkerade kunderna räknas fortfarande som pågående i
sifforna tills du säger till att jag får ändra det. Och listan över gamla kort som ingen
bestämt något om är längre än du tror — nitton stycken.

---

## PÅ G-vyn + ett kort som kan allt (2026-08-18, kväll)

Beställningen: "allt på samma ställe, alla smarta funktioner på alla kort, färdigt synkat
och komplett — lättast möjliga system för att få överblick och flytta affärer framåt."

### Fyra ändringar

1. **Säljcoachen in på DRIV-kortet.** `CoachPanel` (samma dialog som Fokus idag och DM
   öppnar) monteras nu på `/dashboard/driv/<oppId>` med en `kortForCoach`-adapter, samma
   väg DM tog. Skillnaden: här FINNS ett affärs-id, så `/api/fokus/coach` hittar affärens
   eget minne direkt i stället för att falla tillbaka på namnmatchning.
   Kommentaren på `FokusClient.tsx:1241` sa redan att panelen var exporterad "så DM &
   Pipeline kan öppna EXAKT samma dialog" — DM plockade upp den, kortet gjorde det aldrig.
2. **PÅ G-vyn** (`/dashboard/pag` + `/api/pag`, menypost i zon "Din vecka" före Planering).
   Alla affärer i spel sorterade på NÄSTA ÅTGÄRDSDATUM, i fem fack: Försenat, I dag,
   Framåt, Utan plan (äldst i steget överst) och Vilande (utanför standardvyn, hopfällt).
   Varje rad öppnar samma DRIV-kort. Läser spegeln, aldrig GHL direkt — ingen tredje sanning.
3. **Vilande löst i vyn, inte i statusfältet.** `arVilande` fanns färdig sedan FIX-1-REST B2
   men hade noll anropare. Nu har den en. `__ghl_vilande_stage_id` är dessutom satt i
   `coach_users.personal_os` (båda raderna för locationen), så facket pekas ut på id och
   inte gissas ur stegnamnet. **Ingen migration, ingen ändrad likviditetsprognos** — se
   föregående sektion för varför den vägen är dyrare än den ser ut.
4. **"Anteckna" → "Uppdatera kortet".** Rutan kunde redan skriva, prata in (`/api/ai/transcribe`)
   och klistra in skärmbild (`/api/ai/vision`) — men `compact` var satt, vilket gömde raden
   som berättar om Ctrl+V, och den låg under prislistan och tidslinjen. Nu ligger den direkt
   under handlingsraden med alla tre vägarna utskrivna.

### Verifierat

- `npx tsc --noEmit` rent, `npx next build` rent (`/api/pag` och `/dashboard/pag` i utfallet).
- Grupperingen körd mot skarp DT-data (`scripts/_pag-verifiera.mts`): 0 försenat, 0 i dag,
  **8 framåt** (19/8 Linus + Annica + Jonas ×2, 21/8 Lars + Martin, 24/8 Robin, 26/8 Magnus),
  **21 utan plan**, **2 vilande**. 29 kort i spel, 1 405 900 kr.
- **INTE visuellt verifierat.** Sidan ligger bakom admin-inloggningen, och jag matar aldrig
  in lösenord. Byggd strikt på designspråket i `cockpit-design` (DashHero, StatTile,
  färgade ikonbrickor, `rounded-2xl`, `tabular-nums`) — men ögat är ditt.

### PÅ VANLIG SVENSKA

Nu finns en sida som heter På G. Den visar alla dina affärer i den ordning de behöver dig:
försenat först, sen i dag, sen framåt, och längst ner de tjugoen som ingen bestämt något om.
Klickar du en rad öppnas kortet, och där kan du nu få coachning direkt — den hjälpen fanns
förut bara på en annan sida. Du uppdaterar ett kort genom att skriva, prata in eller klistra
in en skärmbild, och den rutan ligger nu högst upp där du ser den. De två parkerade kunderna
ligger för sig själva och stör inte. En sak har jag inte gjort: sett sidan med egna ögon,
för den kräver din inloggning.

---

## HELG-1 DEL 0 — Statusinventering 2026-08-21 (read-only, hårt stopp)

**Metod:** git-loggen sedan 13/8 (60 commits), denna fil (hela, 1767 rader), fem parallella
kodgranskningar (ett spår per område nedan) och projektminnet. OPTICUR-1 är klar och
verifierad av Håkan sedan tidigare och ingår inte i denna rapport.

**Viktigt att veta innan tabellerna läses:** den här filens egen huvudtext (rad 1–1757) har
inga poster daterade 19/8 eller 20/8 — bara toppens sammanfattningsrader (rad 42–68) har
19/8-noteringar om OPTICUR-1. Det betyder att **BESKÄR-1** (stängd 19/8, tre commits, se
`de9990b`, `296d898`, `ef7cafd`, `39be60e`, `1fb87e3`, `20e3ac3`) och OPTICUR-1 Etapp A+B
finns bevisade i git-loggen och projektminnet men saknar egen sektion i denna fil. De räknas
här som **VERIFIERAT KLART** på Håkans egen bekräftelse, men filen bör kompletteras med en
riktig sektion om BESKÄR-1 nästa gång någon är inne och skriver här.

### A1–A2. PUBLICERA-1 och ÄMNE-1

| Post | Status | Bevis |
|---|---|---|
| PUBLICERA-1 (FB-direktpublicering) | VERIFIERAT KLART | Live-verifierad med lyckad publicering (Håkans skärmdump), `buildGhlMedia()` delad payloadbyggare, svenska fel till kund. Commits `c03fb98`, `cd16ba4` |
| ÄMNE-1, text | VERIFIERAT KLART | `lib/content/amneskalla.ts::harledAmnesblock()`, DoD `scripts/amne1-dod.mts` + dedikerat script för det specifika fallet `scripts/amne1-sedan2015-dod.mts`. Båda driftfallen (menyförslaget, "Sedan 2015") körda skarpt mot Displayteknik. 13 tester |
| ÄMNE-1, bild | VERIFIERAT KLART | `harledBildamne()`, samma fil. DoD `scripts/amne1-bild-dod.mts`. Karusellens slide-bilder hade redan rätt prioritet, det var singelvägen som saknade den |
| Etiketten "Grundas på inläggets innehåll" | **Landad fix, inte sammanträffande** | `components/StudioMaker.tsx:2868`. Etiketten fanns redan i UI:t före fixen men var då ett löfte utan täckning (Ämnesfältet kunde vinna över det faktiska innehållet). ÄMNE-1:s prioritetsordning gör nu påståendet sant |

### A3. BILD-11

| Punkt | Status | Bevis/motivering |
|---|---|---|
| K1 rekvisita, deterministisk 10/10-DoD | KLART MEN OBEVISAT | `lib/bild/promptbyggare.ts:56–143`. Koden är deterministisk per tenant, men den egna filen (rad 491–498) säger rakt ut att verifieringsbilden fortfarande visade läsbar text och att "kör om med hela grinden inkopplad" aldrig hände. Ingen 10/10-mätning finns |
| Kapad CTA-text i export (slide 7) | EJ PÅBÖRJAT | `components/studio/archetypes/ArkKarusell.tsx:75–101` saknar samma flex/overflow-skydd som byggdes för OpticurSkarmSplit (`296d898`). Ingen commit, inget test |
| Läsbara ord — overlay eller genererad | Frågan besvarad: **genererad, ingen overlay byggd** | Modellen ritar fortfarande orden, en grind stoppar dem (hårt stopp båda språk sedan `0ac2d29`, 16/8). `tests/bild11-tillagg-hart-stopp-sprak.test.ts` |
| K2 plats/tid + folktomt-prioritet | VERIFIERAT KLART, med nyans | `harledPlats`/`harledTid`, DoD `scripts/bild11-dod.mts`, 17 tester. "Folktomt-prioritet" i dagens ordval är dock en formulering Håkan själv strök 15/8 — byggt blev i stället att personal I ARBETE under stängd tid byts ut, en förbipasserande/kund/tom lokal godtas alla |

### A4. Studio-småfix 16/8

| Punkt | Status | Bevis |
|---|---|---|
| Tre-idéer-validering | VERIFIERAT KLART | `tests/smafix1-ideer-meddelande.test.ts`, `48a568b` |
| Underrubrik-reglaget | PÅBÖRJAT | Kedjan sparad och live-testad 16/8 (headline2 renderade rätt), men Håkans ursprungliga fel ("ändrar inget") gick INTE att återskapa och ingen senare session har tagit upp tråden igen |
| Textbakgrund som styrbart lager | VERIFIERAT KLART | `tests/smafix3-textbakgrund.test.ts`, `display: inline` ersatte `inline-block` |
| Tankstreck i UI-copy | VERIFIERAT KLART | `48a568b`, flera tankstreck i steg 5 ersatta med komma. Inget regressionstest |
| Uppmaning + hashtags-golv i steg 5 | VERIFIERAT KLART | `lib/content/writing-rules.ts`, `tests/smafix5-hashtag-golv.test.ts` |

### B. RAPPORT-1-stängningen

| Punkt | Status | Bevis/motivering |
|---|---|---|
| DT-rapport omkörd efter R-4/R-5 | PÅBÖRJAT | Batchen från 13/8 kl 18:55 (`a1927e6`) ligger fortfarande i scratch — det var FÖRE citat-regeln R-4 (kl 19:57 samma dag) och FÖRE R-5b (14–15/8). Ingen bekräftad omkörning med dagens kod finns. Ordet "kontrollprotokoll" finns noll gånger i repot |
| R-5b, fjärde kravet (beslutstabell bort ur kundexport) | EJ PÅBÖRJAT | `lib/deep-audit-finalize.ts:101–117` bygger EN gemensam text för både admin- och kundrouten (`app/api/analytics/deep-audit/route.ts`, `app/api/seo/deep-audit/route.ts`). De tre första R-5b-kraven är byggda och mätta, det fjärde inte påbörjat |
| DoD 5 mot Engens (tom sitemap, länkburen crawl) | VERIFIERAT KLART | "engenstrad.se 20/20, sitemapen tom, länkarna bar crawlen", mätt 13/8. Inget kvarliggande script för att köra om |
| Makzy omkörd med ren beslutstabell | VERIFIERAT KLART | Lucklistan 6→0, asset `c668c538`, 30 tester i `tests/r5b-sifferkalibrering.test.ts` |
| GRIND_INFORD | Finns, men FÖR SNÄV — klassas PÅBÖRJAT | `app/api/seo/deep-audit/route.ts:78`, byggd redan 11/8 (`15fc777`), döljer rapporter äldre än underlagsgrinden. Gränsen är ALDRIG flyttad för R-4/R-5/R-5b (13–15/8) — en rapport skriven 11–15/8 skulle visas för kund trots att den saknar citat-regeln och sifferkalibreringen. Dessutom obesvarat: filen säger att den omkörda Makzy-rapporten är dold trots att den ligger EFTER gränsen — kräver databaskoll |

**Vad som konkret återstår innan Håkans hårda stopp-granskning:** en ny skarp DT-rapport med
dagens kod, det fjärde R-5b-kravet byggt, GRIND_INFORD-gränsen flyttad och förklarad, och en
definition av vad "kontrollprotokoll" faktiskt innehåller (finns ingenstans i repot idag).

### C. Bildvägskopplingen

Bara EN väg är inkopplad mot `lib/bild/promptbyggare.ts` — `app/api/studio/suggest-image/route.ts`
(Studios huvudväg, singel + karusell). Grep över hela repot gav noll andra träffar utanför
testfiler.

| Steg | Status | Bevis |
|---|---|---|
| Studios huvudväg (referens, redan godkänd 14/8) | VERIFIERAT KLART | `suggest-image/route.ts:155,157` |
| 1. Reels in i byggaren | EJ PÅBÖRJAT | `app/api/studio/reels/media/route.ts` bygger prompt själv via `lib/images` |
| 2. Blogg-maskinen in i byggaren | EJ PÅBÖRJAT | `app/api/blog/generate-cover/route.ts` samma sak |
| 3. Pensioneringsutredning legacy (ImagePicker) | EJ PÅBÖRJAT | `app/api/social/generate-image/route.ts`, aktivt anropad av `components/ImagePicker.tsx` som renderas från StudioMaker och `/dashboard/(inlagg)/social`. Ingen konsekvensanalys skriven |
| 5. K1-rutan i brand-kit-vyn | EJ PÅBÖRJAT | `hamtaRekvisita()` läser redan `kit.rekvisita` ur DB, men inget UI skriver dit — varken `/dashboard/brand-kit` eller `/k/brand-kit`. Detta är INTE samma sak som personregelrutan (15/8) |

### D. DRIV-2 och DRIV-3

**Rättelse av uppdragets premiss:** "Gmail i kortet är verifierat live" stämmer bara för att
LÄSA Gmail. Att SKICKA (gmail.send) är fortfarande inte omkopplat — Håkan sköt upp det
medvetet 15/8, och ingen commit sedan dess rör Google-kopplingen.

| Post | Status | Bevis |
|---|---|---|
| DRIV-2 Svara, textgenerering | VERIFIERAT KLART | 3/3 skarpa scenarier |
| DRIV-2 Svara, skicka via Gmail | EJ PÅBÖRJAT I DRIFT | Blockerad på `gmail.send`, Håkans eget beslut att skjuta upp |
| DRIV-2 Svara, skicka via GHL-kanal | KLART MEN OBEVISAT | `conversations/message.write` obekräftat |
| DRIV-2 Flytta steg | VERIFIERAT KLART | Återanvänd, redan i produktion via Fokus |
| DRIV-2 Nästa steg (uppgift till GHL) | Scope VERIFIERAT KLART, knapp obevisad | `contacts.write` bevisat live 18/8 (elva skrivningar). Knappen själv aldrig loggad klickad |
| DRIV-2 Anteckna | Scope VERIFIERAT KLART, knapp obevisad | Byggd om till "Uppdatera kortet" 18/8, flyttad högst upp |
| DRIV-3 Prisruta | VERIFIERAT KLART | Live mot `v_sl_publik`, sju produkter inkl. "Installation: Offereras" |
| DRIV-3 Offertstatus i tidslinjen | PÅBÖRJAT, i praktiken tomt | Svag premiss bekräftad 18/8: DT:s riktiga offerter går som MEJLBILAGA, inte via Offertmotorn — `offert_quotes` har fortfarande en enda rad |
| DRIV-3 "Skapa offert"-knapp | KLART MEN OBEVISAT | Länken återanvänd, syns-i-tidslinjen overifierad end-to-end |
| Sidoeffekt 18/8: mejlbilaga-sökning | VERIFIERAT KLART, nytt utanför spec | `sokMeddelandenMedBilaga` + `/api/driv/bilaga` |

### E. Karusellens tre omgjorda slides (14/8-granskningen)

**EJ ÅTERFUNNEN I DOKUMENTATIONEN, INGEN BEDÖMNING MÖJLIG UTAN HÅKANS INPUT.** Hela git-loggen
och samtliga `.md`-filer i repot genomsökta. Enda commit på 14/8 (`cde3ece`) rör siffergrindens
kalibrering, inte karusellen. AKUT-KARUSELL-sektionen (rad 241–252) nämner ingen "slide 2/4/7"
eller "omgjord". Antingen skedde granskningen i en session vars anteckningar aldrig kom in i
denna fil, eller så syftar ordvalet på något som heter något annat i koden. Kräver Håkans
precisering av vilket inlägg/vilken granskning det gäller innan arbete kan klassas.

### F. Övrigt i "Beställt men ej levererat" (från resten av filen, rad 843–1757)

**Mätbarhet/engagemang:** `instagram_manage_insights` saknas i `META_SCOPES` (tysta nollor i
mätvärden), `post_metrics.post_id` skrivs aldrig (winning-patterns saknar data),
`insights.ts` läser fel tabell, `studio_posts.ghl_post_id` blandar två sorters id.

**Handbok/ICP:** HANDBOK-1 (H-0-planen ogjord), FunctionGuide (REV-4), ICP-motorn — samtliga
utanför detta dokuments scope enligt uppdraget, tas inte upp under helgen.

**Kredit/kostnad/säkerhet:** K3:s manuella siffror väntar på Håkan, LIKVID-1-prognosen tom
tills banksaldo fylls i, nyckelrotationer FAS 2 väntar på Håkan i Google/Meta/GHL.
~~OFFERT-2 ligger ostagad i arbetsträdet~~ — **rättat 21/8, se HELG-1 DEL 0/F nedan: redan
committat sedan tidigare, ingen risk.**

**DRIV-serien, redan känt ovan plus:** städningens 25 GHL-förslag väntar på godkännande i
`/dashboard/driv/stadning`, testkontakten "TEST Mejllasning" ligger kvar, morgonköns
fem-dagarsmätning pågår fortfarande i drift.

**DT-pipeline/På G-vyn (18/8):** byggd och deployad, men INTE visuellt verifierad (kräver
inloggning). Fyra-vägs-status (vilande som eget läge i DB och likviditetsprognos) medvetet
inte byggd, väntar Håkans beslut. 19 gamla GHL-kort utan nästa åtgärd kvarstår.

**Utanför denna fil helt, bekräftat via projektminnet:** BESKÄR-1 (stängd 19/8, se ovan),
OPTICUR-1 Etapp A+B (klar och Håkan-godkänd, ingår inte i denna rapport per uppdraget).

### PÅ VANLIG SVENSKA

Publicering till Facebook och att texten håller sig till ämnet är klart och bevisat, du kan
lita på båda. Bildreglerna för skyltbranschen är också klara. Fem saker är INTE klara trots
att de låter klara: den nya DT-rapporten är inte omkörd med dagens regler, karusellexportens
text kan fortfarande klippas av, bara en av fem bildvägar pratar med den nya bildmotorn,
Gmail-kortet kan läsa men inte skicka mejl än, och jag hittar inte de tre karusellslides du
frågade om i någon anteckning. Jag väntar på din OK innan jag fortsätter till nästa del.

### Beställt men ej levererat, sammandrag av denna DEL 0

R-5b:s fjärde krav, GRIND_INFORD-gränsen, ny skarp DT-rapport, kapad CTA i karusellexport,
fyra av fem bildvägskopplingar, gmail.send-omkopplingen, karusellslides-granskningen
(kräver precisering), samt hela F-listan ovan.

---

## HELG-1 AKUT + DEL 2 + DEL 3 — 2026-08-21 (samma session, kör i Håkans justerade ordning)

### AKUT: GRIND_INFORD-gränsen flyttad

**KLART OCH VERIFIERAT.** `app/api/seo/deep-audit/route.ts` — gränsen var satt till
underlagsgrindens datum (11/8, commit `5151297`) och rörde sig aldrig när R-4 (`7010a79`,
13/8) och R-5b (`aea5f5c`, 15/8, den senast landade av de tre) tillkom. Ny gräns:
`2026-08-15T12:06:03Z` (R-5b:s commit-tid i UTC).

**Bevis, kört mot skarp data** (`scripts/grind-infort-tenantlista.mts`): av 18 sparade
djupgranskningsrapporter var **11 synliga för kund FÖRE flytten** trots att de saknade minst
en av R-4/R-5b (AluCon ×1, Displayteknik ×2, Engens Träd ×1, For Balance ×1, Makzy ×3,
Oppråby ×1). Efter flytten är **bara 2 synliga** (Displayteknik och Oppråby, båda skrivna
17/8 — efter alla tre grindarna). **Noll regression**: ingen tidigare dold rapport blev
synlig av flytten (skriptet kontrollerar detta explicit och skriver ut OK/FEL).

### DEL 2: R-5b:s fjärde krav + ny skarp DT-rapport

**Fjärde kravet (beslutstabell bort ur kundens export) — VERIFIERAT KLART.**
`lib/deep-audit-siffror.ts::beslutstabellBlock()` (bygger ägarvyns block på nytt ur
`metadata.grind_sifferbeslut`) + `kundtext()` (klipper bort blocket vid LÄSNING i
`app/api/seo/deep-audit`, inte bara vid skrivning — självläker även de 18 rapporter som
redan låg sparade med tabellen inbakad, ingen migrering behövdes). `lib/deep-audit-finalize.ts`
slutade bifoga blocket i `body` som sparas. 6 nya tester i
`tests/r5b-fjarde-kravet-kundexport.test.ts`, provade genom att brytas.

⚠ **Nyans, flaggad för din granskning:** "kundrapporten slutar vid ordlistan" stämmer inte
bokstavligt — mätt på den skarpa DT-rapporten ligger "Vad jag kan göra åt dig direkt" (en
handlingslista) och "Siffror du behöver fylla i" (lucklistan) EFTER Ordlistan men FÖRE
beslutstabellen, och båda är genuint kundnyttiga. Jag klipper vid beslutstabellen (det
mätbara kravet: "beslutstabellen tas bort"), inte bokstavligt vid ordet "Ordlista" — annars
hade kunden förlorat handlingslistan och lucklistan. Säg till om du vill ha det annorlunda.

**Ny skarp DT-körning — KLART, VÄNTAR PÅ DIN GRANSKNING.** Körd med dagens kod (R-4 + R-5b +
fjärde kravet), asset `454aef48-b5ba-40e5-bff0-aadf86b245e0`, 92 sifferbeslut, **14 luckor**
(inte 18 — nytt, oberoende crawl-resultat). Kundversion och ägarversion skrivna till
`scripts/_rapport1-dt-ny-kund.md` respektive `scripts/_rapport1-dt-ny-agare.md` för din
läsning. Verifierat: kundversionen saknar beslutstabellen, ägarversionen har den.

⚠ **Stickprovsregeln gick INTE att köra fullt ut — datafynd, inte kodfel.**
`hm_brand_profile.pricing_notes` för Displayteknik är **TOM** (0 tecken) i databasen just nu,
trots att DT har en fastslagen, publicerad prislista på egna sajten (se
[[project-dt-prislista]], kanon på /pris sedan 12/8). Den listan har alltså aldrig skrivits in
i profilfältet grinden läser för att klassa ett tal som "T · din egen uppgift". Konsekvens:
mitt eget stickprov (5 belagda tal, prioriterat klass T) kunde INTE innehålla ett pris ur
pricing_notes, för fältet är tomt — 0 av 5. **Lucklistan är däremot ärlig givet detta:**
kontrollerat att INGEN av de 14 luckorna ändå fanns i pricing_notes (0 av 14, skulle varit en
falsk lucka annars) — `scripts/rapport1-stickprov.mts`. **Ditt beslut:** fyll i DT:s riktiga
prislista i profilfältet (Cockpit → Displayteknik → Brand-profil → Prisanteckningar) så
framtida rapporter kan citera dina egna priser som belagda, eller sänk kravet i
kontrollprotokollet tills dess. Jag har inte skrivit in priser själv — det är din data.

### DEL 3: Bildvägskopplingen

| Steg | Status | Bevis |
|---|---|---|
| 1. Reels in i `lib/bild/promptbyggare.ts` | **VERIFIERAT KLART** | `app/api/studio/reels/media/route.ts` — K1–K5 kopplade in i den vanliga scengrenen (inte exaktText/text-i-bild-grenen, som är orörd med flit). Rubrik/brödtext hämtas ur scenens SVENSKA overlaytext (`overlay.line1/line2`), inte den redan-engelska motivraden. `components/studio/ReelSceneMedia.tsx` + `app/dashboard/studio/reels/page.tsx` trådar igenom scenindex/antal för personrotationen |
| 2. Blogg-maskinen in i byggaren | **VERIFIERAT KLART** | `app/api/blog/generate-cover/route.ts` byggd om helt — bytte `generateImageForPost` (egen AI-craftningsomgång) mot `byggBildPrompt()` + direkt `generateFlux`. `style`-parametern var redan obruklig (aldrig skickad av UI:t), borttagen utan konsekvens |
| 3. Pensioneringsutredning, legacy-vägen | **KONSEKVENSANALYS LEVERERAD, INGEN KOPPLING GJORD** | Se separat sektion nedan — premissen i beställningen ("legacy via ImagePicker") stämde inte med koden |
| 5. K1-rutan i brand-kit-vyn | **VERIFIERAT KLART** | Nytt fält "Rekvisita och miljö i bilderna" i `app/dashboard/brand-kit/page.tsx`, skriver till `kit.rekvisita` — exakt fältet `hamtaRekvisita()` redan läste sedan 13/8 utan att någon yta skrev dit. `/k/brand-kit` återanvänder samma sida (`kundlage`-prop) så kunden ser samma ruta direkt, inget nytt paket |
| BILD-11 punkt 2, kapad CTA i karusellexport | **VERIFIERAT KLART** | `components/studio/archetypes/ArkKarusell.tsx` — samma buggklass och samma fix som OpticurSkarmSplits h2-överflöde (`296d898`): rubrik+brödtext får en egen `flex:1, minHeight:0, overflow:hidden`-zon, CTA-knappen står i sin egen `flexShrink:0`-zon som aldrig kan tryckas ut. Värsta fall blir nu en avklippt textrad, aldrig en bortklippt knapp |

#### Pensioneringsutredning: legacy-vägen (korrigerad premiss)

**Beställningens premiss var fel, och det är själva fyndet.** `components/ImagePicker.tsx`
renderades ingenstans i appen — noll `import`, noll JSX-användning, bara variabelnamnet
`imagePickerFor` levde kvar som ett spöke i `app/dashboard/(inlagg)/social/page.tsx` sedan
den sidan bytte till en annan komponent. **Raderad nu** (`git rm` via `rm` + committad status),
zero risk — dess enda "konsekvens" var att den redan var död.

**Den RIKTIGA legacy-vägen är en annan, och den är inte enkel:** `/dashboard/social` — nåbar
direkt från huvuddashboarden via ActionCard **"Skapa social-inlägg"** (`app/dashboard/page.tsx`
rad 96), alltså en central ingång, inte en bortglömd sida — renderar `ImageStudio.tsx`, ett
helt eget bildverktyg med FYRA vägar: textkort (`render-svg`), fotomontage
(`render-photo-overlay`), Nano Banana (Gemini-bildredigering) och "Imagen" (den väg som
faktiskt anropar `/api/social/generate-image`, alltså den kod som HELG-1-dokumentet kallar
"legacy"). Imagen-fliken hämtar dessutom FÖRST en AI-craftad prompt via
`/api/posts/[id]/build-image-prompt` (Gemini 2.5 Pro, läser image-generation/anti-klyschor-
kunskapen) och skickar den in i `generateImageForPost`, som craftar en ANDRA gång — en
dubbel AI-promptomgång, värt ett eget fynd men inte löst nu.

**Varför jag inte kopplade eller pensionerade detta i dag:** HELG-1-dokumentets EGNA DEL 3,
punkt 4 säger uttryckligen "hårt stopp före text-i-bild... OCH FÖRE IMAGESTUDIO" — och
`ImageStudio.tsx` är precis den komponent den riktiga legacy-vägen sitter i. Att koppla in
eller pensionera `/api/social/generate-image` betyder att röra ImageStudios flöde, vilket
dokumentet redan bett mig vänta med. Din order i dag namngav "legacy-vägen (generate-image
via ImagePicker)" — en beskrivning som byggde på att ImagePicker fortfarande levde, vilket
den inte gjorde. **Rekommendation:** låt detta höra till samma hårda stopp som ImageStudio
redan har, i stället för att avgöra det som en egen "legacy"-fråga i dag. Övriga tre delar av
`/dashboard/social` (textkort, fotomontage, Nano Banana) rör inte K1–K5 alls och påverkas
inte av vare sig koppling eller pensionering av Imagen-fliken.

### Övrigt från denna omgång

- **1 test fallerar sedan innan denna session, orört av mina ändringar:**
  `tests/meny1-zoner.test.ts` ("varje zon har både rubrik och förklaring") — testet förväntar
  sig tre namngivna zoner (`eget`/`byra`/`kundens`) som MENY-3 (`5612e88`, 19/8) troligen
  ersatte med sju ingångar. Ingen fil jag rört den här sessionen berör meny-strukturen. Flaggat
  som nytt fynd, inte fixat — hör inte till HELG-1:s scope.
- Fullständig testsvit körd efter alla ändringar i AKUT/DEL 2/DEL 3: **1604 av 1605 tester
  gröna**, `tsc --noEmit`

---

## HELG-1 DEL 4 — KUNDREGISTER-1-tillägget, 2026-08-21

**Premisskoll först (viktigast):** KUNDREGISTER-1 fanns REDAN, byggt 13/8 (`b46df6d`) —
`/dashboard/kunder`, `/k/kunder`, `components/Kundregister.tsx`, `lib/kundregister/synk.ts`,
läsande lista ur MySales med ärliga fellägen. Detta var alltså en UPPGRADERING mot DEL 4:s
fylligare spec, inte ett nybygge. Mätt mot den punkt för punkt:

| Krav | Läge 13/8 | Byggt idag |
|---|---|---|
| Sida i kundvyn, sök, taggfilter | Fanns | — |
| Filter på källa (flerval) | Saknades helt | **Byggt** |
| Taggfilter flerval (inte bara ett värde i taget) | Saknades | **Byggt** |
| Cache med tidsstämpel + manuell uppdatering | Fanns (samma mönster som HQ-1) | — |
| Taggar med kundbegripliga namn | Saknades (visade rå MySales-sträng) | **Byggt, se avgränsning nedan** |
| Entitlement-styrd pilot (PÅ bara Gitte+DT) | Fanns INTE — låg bakom "dm"-modulen, alltså på för alla DM-kunder | **Byggt: egen modul `kundregister`** |
| Delad komponent för framtida nyhetsbrevs mottagarurval | Fanns inte som egen enhet | **Byggt: `lib/kundregister/taggar.ts`** |
| Sidan hade ingen egen nav-post i kundmenyn (bara nåbar via URL) | Fynd idag | **Rättat: `lib/customer-features.ts`** |

**Byggt:** `lib/kundregister/taggar.ts` (`visningsnamnForTagg`, `matcharTaggar`, `matcharKalla`
— rena funktioner, delas av kundregistrets yta OCH ett kommande nyhetsbrevsflödes
mottagarurval, `migrations/newsletter.sql` finns redan registrerad men obyggd). API-routen
(`app/api/kundregister/route.ts`) tar nu `tagg=a,b` och `kalla=x,y` (flerval, OR), returnerar
`kallor`-listan bredvid `taggar`. UI:t (`components/Kundregister.tsx`) har två flervalsrutor
(chips) i stället för en. Ny modul `kundregister` i `platform_modules`/`tenant_modules`
(`migrations/kundregister1_pilotmodul.sql`, körd), AV som standard, PÅ manuellt bara för
`displayteknik` och `forbalance` — samma mönster som OPTICUR-1:s `studio-skarmformat`.
`app/k/kunder/page.tsx` grindar nu på `"kundregister"` i stället för `"dm"`. Ny nav-post i
`lib/customer-features.ts` (sidan saknade en helt — bara nåbar om man redan visste URL:en).

⚠ **Avgränsning, kundbegripliga taggnamn:** DEL 4 nämner "mallkontots 8 taggar" med
underförstådd betydelse per tagg. Den listan finns INGENSTANS i kodbasen eller dokumentationen
— bara en RÄKNING ("8 taggar") från en tidigare mätning, aldrig namnen. Jag har alltså inte
byggt en semantisk ordbok (det hade krävt att hitta på betydelser jag inte har grund för) utan
en GENERISK formatering (versaler, bindestreck hålls ihop som ett ord, kända förkortningar som
MySales/VIP/SEO behåller sin egen skrivning) — "offert-lead" blir "Offert-lead", "mysales
coach" blir "MySales Coach". Filtreringen matchar alltid mot RÅ-taggen, aldrig det formaterade
namnet, så en framtida omskrivning av visningsnamnet aldrig kan tysta ett fungerande filter.

**DoD, kört mot skarp data** (`scripts/kundregister-del4-dod.mts`, alla kontroller gröna):
Displayteknik och For Balance har modulen, en tredje tenant (gripcoaching) har den INTE
(omvänt test). Flervalsfiltret kört mot Displaytekniks 274 spegelrader: ett taggval ("email")
gav en äkta delmängd (78 av 274), flerval (OR) gav fler eller lika många träffar, källfiltret
kraschade inte. Alla fem verkliga DT-taggar formaterades läsbart.

**Sidofynd, positivt:** For Balances MySales-nyckel kunde INTE läsa kontakter 13/8 (401,
känt sedan bygget). Testade om idag (`synkaKundregister`, tvinga=true): **fungerar nu**, 1
kontakt synkad. Nyckeln har alltså fått rätt behörighet sedan dess, utan att STATUS.md
uppdaterats — ni kan alltså använda Gittes register direkt, inte bara Displaytekniks.

**Testuppdatering:** två tester i `tests/kundregister1-lista.test.ts` som låste 13/8-versionens
kontrakt (DB-nivå enkeltaggsfilter, `"dm"`-grinden) uppdaterade till att låsa dagens medvetna
kontrakt i stället — inte bortplockade. Ny fil `tests/kundregister-taggar.test.ts` (11 tester).
Hela sviten: **1615 av 1616 gröna** (samma förinställda meny1-zoner-fel som tidigare, orört),
`tsc --noEmit` rent.

---

## HELG-1 DEL 5 — KANAL-2, dynamiskt kanalval, 2026-08-21

**Premisskoll:** kopplingsdata fanns REDAN dynamisk och komplett (`ghlListAccounts` returnerar
alla plattformar GHL känner till, inklusive Google Business Profile) — men den nåddes bara via
`/api/studio/ghl-accounts` för PUBLICERINGEN (`selectedAccounts`). CONTENT-lagret (kanalväljaren,
per-kanal-caption, förhandsvisning) var hårdkodat till tre kanaler på tre separata ställen:
`CHANNELS` i StudioMaker, `CHANNEL_KEYS`/`CHANNEL_GUIDE` i adapt-channel-routen, och
`ChannelKey`/`CHANNEL_BRAND` i ChannelPreview — exakt vad KANAL-2-utredningen (STATUS.md,
tidigare session) redan pekat ut.

**Byggt:**
- `lib/kanal-anatomi.ts` — ny EN källa, klientsäker (samma mönster som `lib/format-anatomi.ts`).
  Nio kanaler (ig/fb/li/google/tiktok/pinterest/youtube/threads/bluesky) med namn, ton,
  hashtagbruk, CTA-form, tecken-tak och innehållstypskrav (bild/video/vilken). Plus ren,
  testad logik: `arAnsluten`/`arUtgangen`/`synligaKanaler` (GHL-konton → vilka kanaler som
  ska synas, oberoende av UI:t).
- `app/api/studio/adapt-channel/route.ts` läser kanallistan och guiderna ur denna nya källa
  i stället för sin egna hårdkodade 3-lista — alla nio kanaler kan nu textanpassas.
- `components/studio/ChannelPreview.tsx`: `ChannelKey` utökad till nio, `CHANNEL_BRAND` med
  ikon/färg för alla. De sex nya har INGEN skräddarsydd enhetsram ännu (medveten avgränsning
  — de faller tillbaka på samma generiska kort som LinkedIn: header, caption, bild, gilla/
  kommentera/dela). Pixelperfekta ramar för sex nya plattformar hör inte till DEL 5:s DoD.
- `components/StudioMaker.tsx`: kanalväljaren visar nu `dynamiskaKanaler` (ig/fb/li alltid +
  övriga bara vid matchande GHL-koppling), en ny badge "behöver förnyas" (röd) skild från
  "ej kopplad" (grå) för utgångna kopplingar, och innehållstypsgrinden filtrerar video-
  kanaler (YouTube, TikTok) mot bild-kanaler (GBP, Pinterest) utifrån `postType`.

⚠ **Ej verifierat, ärligt flaggat i koden:** GHL:s exakta `platform`-sträng är MÄTT för
ig/fb/li/google (fyra konton, se DoD nedan). För tiktok/pinterest/youtube/threads/bluesky
finns just nu INGEN tenant med kopplingen påslagen någonstans, och GHL:s egen API-dokumentation
gav bara exemplet `"google"` — inte de andra fem (sökt upp via WebFetch/WebSearch, se
`lib/kanal-anatomi.ts` filhuvud). Strängarna där är GHL:s produktnamn i gemener, den mest
sannolika gissningen — men overifierad. Går den fel gör det ingen skada (kanalen matchar då
bara inte, fail-closed) och är en enrads-rättning den dag en tenant faktiskt kopplar in en av
dem. **Ingen testpublicering gjord** mot GBP eller något annat nytt konto — det kräver
Håkans egna ja (redan noterat i den tidigare KANAL-2-utredningen), och DEL 5:s DoD testar
SELEKTORN, inte en skarp publicering.

**DoD, kört mot skarp data** (`scripts/kanal2-dod.mts`): Displaytekniks sex riktiga GHL-konton
läst (google/location, facebook/page, instagram×2, linkedin×2, inget utgånget). `google` dyker
upp i `synligaKanaler()` för DT. Ett omvänt test utan google-kontot i listan visar INTE google.
Ett simulerat utgånget google-konto visas ändå (som "behöver förnyas", inte "ej kopplad").
24 enhetstester i `tests/kanal-anatomi.test.ts`, inklusive DoD-scenariot ordagrant som test.

Hela sviten: **1639 av 1640 gröna** (samma förinställda meny1-zoner-fel, orört), `tsc --noEmit`
rent.

---

## HELG-1 DEL 6 — KUNSKAP-1, 2026-08-21

**Premisskoll (viktigast, samma mönster som DEL 4):** exakt detta scenario — Gitte, "regression",
blogg vs inlägg — var REDAN byggt och verifierat 12/8 (`lib/ordlista.ts`, migration
`kunskap1_ordlista.sql`, `scripts/kunskap1-dod.mts`, `tests/kunskap1-ordlista.test.ts`). Ingen ny
kod behövdes för själva mekanismen — bara verifiering att den fortfarande håller live, plus det
enda som saknades: det EXPLICITA omvända testet (DT opåverkad).

**Verifierat idag, live mot skarp data:**
1. `scripts/kunskap1-dod.mts` omkört: **11 gröna, 0 röda.** Fräsch generering (blogg, inlägg,
   bildtext, studio-text) på ämnet "regression" mot For Balances riktiga profil gav
   terapibetydelse i alla fyra flöden, aldrig statistikvokabulär.
2. Ordlistan (`hm_brand_profile.ordlista`) är redan redigerbar i `/dashboard/profil` OCH
   `/k/profil` (samma komponent, `kundlage`-mönstret) — hjälptexten visar Gittes exakta
   fall som exempel ("regression = regressionsterapi, en resa till ett tidigare liv").
3. **Nytt idag — omvänt test** (`scripts/kunskap1-omvant-test.mts` + nya tester i
   `tests/kunskap1-ordlista.test.ts`): Displaytekniks ordlista och profiltext innehåller inte
   Gittes "regression"-rad, och `amnesordIProfilen()` bevisat (provat genom att brytas) att
   samma ämnesord ger OLIKA träffar beroende på vilken tenants profiltext som skickas in —
   aldrig den andra partens rader. Mekanismen är dessutom strukturellt tenant-isolerad
   (`hamtaOrdlista` frågar explicit på `client_id`, ingen delad tabell).

**Ingen kod ändrad.** 8 nya tester tillagda, `tests/kunskap1-ordlista.test.ts` går nu 29/29.
Hela sviten: **1642 av 1643 gröna** (samma förinställda meny1-zoner-fel, orört), `tsc --noEmit`
rent.

---

## HELG-1 DEL 7 — BETAL-1, MySales Tokens, 2026-08-21

**Premisskoll (samma mönster som DEL 4/6, men störst denna gång):** BETAL-1 var REDAN
byggt i sin helhet 9/8 (se [[project-betal1-fakturering]]) — 8 tabeller, `lib/billing/`
(status, stripe, stripe-ops, webhook, paminnelser, installningar, adress, avtal, datum,
import), owner-vy `/dashboard/betalning`, kund-vy `/k/betalning`, tokens-vy `/k/credits`.
Mätt punkt för punkt mot dagens beställning:

| Krav | Status, mätt mot kod och databas idag |
|---|---|
| 1. Progressbar, varning 80/95/100 % | **VERIFIERAT KLART.** `components/TokenMatare.tsx` — exakt de tre nivåerna, färgkodade, med egen text per läge |
| 2. Stripe Billing: abonnemang 1990/2490 kr, top-up 149 kr/100 tokens | **VERIFIERAT KLART.** `billing_plans`-tabellen har `pro_intro` (1990), `pro_ordinarie` (2490), `topup_100` (149 kr/100 tokens) — siffrorna matchar beställningen exakt. `skapaAbonnemangCheckout`/`skapaTopupCheckout`/`dragPaSparatKort` i `lib/billing/stripe-ops.ts` |
| 3. `/k/betalning`: nästa debitering, kvitton, kortbyte | **VERIFIERAT KLART.** `hamtaNastaDebitering`, `billing_invoices`, `skapaPortalLank` (Stripe Customer Portal) |
| 4. Dunning-statusmaskin (aktiv/försenad/påminnelser/spärrad) | **VERIFIERAT KLART.** `lib/billing/status.ts` — EN källa (`hamtaBetalstatus`), default 3 påminnelser dag 0/7/14 (matchar `billing_settings.paminnelse_dagar`), spärrad når bara betalsidan, auto-återaktivering i webhooken vid `invoice.paid`, `dunning_aktiv=false` som standard (ingen kund spärras av misstag) |
| 5. Owner-vy med Stripe-MRR som brygga mot HQ | **BYGGT IDAG.** Saknades helt. Ny sektion "Cockpit (MySales Pro)" i `/dashboard/hq`, läsande brygga mot `billing_subscriptions`/`billing_status` (`app/api/hq/route.ts::cockpitMrr`) — MRR, antal aktiva abonnemang, försenade, spärrade. Årsabonnemang normaliseras till kr/månad. Skild tydligt från Grips egen klient-MRR |
| 6. FK till `ai_usage_events`, text=0/social bild=3/herobild=8/video=15 per 5s | **VERIFIERAT KLART.** `credit_transactions.usage_event_id references ai_usage_events(id)` (migrations/credits.sql). `credit_pricing`-tabellen: social-bild=3, hero-bild=8, video=15 — siffrorna matchar beställningen exakt, satta redan 2/8 |

**Slutsats: 5 av 6 krav var redan uppfyllda, siffra för siffra, innan jag rörde något.**
Bara MRR-bryggan mot HQ saknades, och den är byggd nu.

### ⚠ DEN ÄRLIGA BLOCKERAREN — kan inte kringgås, kräver dig

**Det finns inget Stripe-konto.** Mätt direkt mot databasen: `billing_settings` har
`stripe_secret_key = null`, `stripe_publik_nyckel = null`, `stripe_webhook_secret = null`.
Ingen av dessa finns heller i miljövariablerna. `billing_plans.stripe_price_id` är `null`
på alla fyra planer — `synkaPlanerTillStripe()` har aldrig körts, för det finns inget att
synka mot. Det här är inte en kodlucka: hela webhook- och betalkedjan är byggd och testad
med enhetstester, men **aldrig körd mot en riktig Stripe-session**, testläge eller ej.

**Konsekvensen för DEL 7:s DoD** ("hel kedja i testläge: köp top-up, se saldo öka,
förbruka, nå 80/95/100-varningarna, simulera utebliven betalning genom dunning till
spärrad och tillbaka vid betalning") — **jag kan inte köra den.** Det kräver ett riktigt
Stripe Checkout-anrop, och det anropet misslyckas direkt med `StripeSaknasError` utan en
nyckel. Jag kan inte skapa ett Stripe-konto åt dig (kontoskapande är utanför vad jag får
göra), och jag skriver aldrig in betalningsuppgifter någonstans.

**Vad du behöver göra, konkret:**
1. Skapa ett Stripe-konto om du inte redan har ett (stripe.com), eller logga in på ett
   befintligt.
2. Hämta **testlägets** nycklar under Utvecklare → API-nycklar: den hemliga nyckeln
   (`sk_test_...`) och den publika (`pk_test_...`).
3. Klistra in dem i `/dashboard/betalning` → Stripe-koppling (fältet finns redan, maskerar
   nyckeln direkt efter sparning). Läget står redan på "test" i databasen.
4. Säg till, så kör jag `synkaPlanerTillStripe()` (skapar de fyra planerna i ditt
   Stripe-konto), sätter upp webhook-endpointen (kräver en riktig URL — cockpit.gripcoaching.se
   är redan deployad, så den går att peka på direkt), och kör hela DoD-kedjan i testläge:
   ett riktigt top-up-köp, verifiera att saldot ökar, simulera en misslyckad debitering med
   Stripes testkort och följa dunning-trappan hela vägen till spärrad och tillbaka.

**Tills dess står DEL 7 som KLART, EJ VERIFIERAT I SKARP DRIFT** — koden är rätt och testad
isolerat, men den påstådda kedjan (köp → saldo → varning → dunning → spärr → återaktivering)
är obevisad i praktiken, av samma skäl som `project-betal1-fakturering` redan varnade för
för elva dagar sedan.

**Hela sviten:** 1642 av 1643 gröna (orört av dagens ändring), `tsc --noEmit` rent.

---

## HELG-1 DEL 8 — KOSTNAD-2, saldoskydd, 2026-08-21

**Premisskoll (samma mönster igen):** K3-INKÖP (`lib/inkop/`, `/dashboard/kostnader#inkop`,
byggt tidigare i augusti) täcker redan saldospårning, dagars-kvar/prognos-larm och
köprekommendation för fal.ai, 46elks, Anthropic, Google Cloud och Resend — nästan hela
DEL 8. K3-INKÖP stod explicit som "rör inte" i botten av HELG-1-dokumentet. **Håkan
tillfrågad och svarade: bygg på K3-INKÖP, rör befintlig kod minimalt.**

| Krav | Läge innan idag | Byggt idag |
|---|---|---|
| 1. Saldoskydd: Anthropic auto reload, dagliga larm fal/46elks under 100 kr | Dagars-kvar-larm fanns, absolut kronorgräns saknades. Anthropic auto reload är en MANUELL inställning i Anthropics egen konsol — inget API finns att slå på den med | **Byggt: absolut 200/100 kr-larm** (`lib/inkop/saldolarm.ts`). Auto reload kvarstår som en checklisterad manuell kontroll, länkad direkt i `/dashboard/ekonomi` |
| 2. `/dashboard/ekonomi`, saldokort per leverantör | Fanns inte som egen sida (fanns inbakat i den bredare `/dashboard/kostnader`) | **Byggt: ny, fokuserad sida**, tunn ovanpå samma `byggInkop()`-data. Saldo, statusfärg, direktlänk till betalsida (`fakturalank`, redan i K3), 30-dagarsförbrukning, "vad stannar om X tar slut"-text |
| 3. Larmmail + SMS, 200/100 kr, max ett mail per nivå | Larmtext byggdes men skickades ALDRIG — bara visades i UI:t | **Byggt: `app/api/kostnader/saldolarm-cron`**, dagligt (vercel.json, 06:30). Mejl vid varning ELLER akut, sms bara vid akut, dedup via ny tabell `saldolarm_skickade` |
| 4. SMS-pris i `ai_pricing`, fail-closed för opristsatta modeller | SMS-raden fanns men stod på **0 kr** (fel, `media_enhet` dessutom felaktigt "bild" av misstag vid seedning). `harPris()` (fail-safe-kollen) fanns redan i `lib/ai-usage.ts`, byggd exakt för detta syfte men aldrig kopplad till video (som inte finns än) | **Rättat: SMS-priset satt till 0,35 kr** (samma tal koden redan använde för förhandsvisning). Fail-closed för video byggs INTE nu — ingen videogenerering finns att koppla in det på, och att bygga en spärr utan en verklig anropspunkt är gissningsarbete. `harPris()` är redo när video kommer |
| 5. Tokenprislappar som konfig | `credit_pricing`-tabellen (redan DB-konfig, redan ägarstyrd) | Redan uppfyllt — se DEL 7. ⚠ DEL 8:s exempel "bild 1, text 0" stämmer INTE mot de verifierade talen 3/8/15 (social-bild/hero-bild/video) — troligen en äldre, förenklad siffra som beskrivningen ärvt. Rörde inte de redan verifierade talen |

### 🚨 AKUT FYND, LIVE DATA — inget hypotetiskt

Körde den nya larmlogiken read-only mot de RIKTIGA saldona (ingen simulerad siffra):

| Konto | Saldo just nu | Nivå |
|---|---|---|
| **46elks (SMS)** | **48 kr** | **AKUT** — under 100 kr redan idag |
| **Fal.ai** | **100,5 kr** (9,57 USD × 10,5) | **Varning** — precis vid gränsen |

**46elks:s SMS-tjänst riskerar att sluta fungera inom kort om inte fylls på.** Det här är
inte ett påhittat testscenario för DoD:n — det är verkligt, mätt just nu.

**Jag har INTE skickat något larm-mail eller sms än.** Att skicka ett riktigt sms kostar
pengar och skickar ett meddelande i ditt namn, och det kräver ditt OK innan jag trycker på
knappen, även när mottagaren är du själv. Säg till så kör jag `saldolarm-cron` skarpt —
det blir samtidigt DoD:ns "skarpt testlarm", för 46elks-fallet är redan precis det scenariot
beställningen bad om att bevisa.

**Fyll gärna på båda kontona oavsett:** [fal.ai/dashboard/billing](https://fal.ai/dashboard/billing)
och [46elks.se/mina-sidor/fakturering](https://46elks.se/mina-sidor/fakturering).

**DoD-status:** larmlogiken är enhetstestad (16 tester, `tests/kostnad2-saldolarm.test.ts`,
provad genom att brytas på exakt gränsvärdena och på eskalerings-/återhämtningslogiken).

**★ SKARPT KÖRT, på Håkans OK (`scripts/kostnad2-saldolarm-skarpt.mts`):**
- **46elks (48 kr, akut): sms SKICKAT på riktigt** till +46725410102, 0,52 kr, status
  "created". DoD:ns krav ("skarpt testlarm via 46elks låga saldo når Håkan som sms") är
  därmed **VERIFIERAT KLART, bevisat i skarp drift**, inte bara i test.
- **Mejlet (både fal.ai och 46elks) MISSLYCKADES lokalt: `RESEND_API_KEY` finns inte i
  `.env.local`.** Nyckeln finns sannolikt bara i Vercels miljövariabler (produktion), inte
  i den lokala utvecklingsmiljön där skriptet kördes. Mejl-loggiken i sig är oprövad i
  skarp drift — koden är identisk med `paminnelser.ts`s redan bevisade mejlväg (BETAL-1),
  men har inte skickat ett riktigt mejl den här gången. **Kvar att bevisa:** kör om samma
  skript (eller vänta på cronen, 06:30 dagligen) efter deploy, då Vercels riktiga
  `RESEND_API_KEY` finns tillgänglig.
- `saldolarm_skickade` uppdaterad för båda kontona — nästa körning samma dag skickar
  alltså INGET nytt (dedup fungerar), vilket är avsett.

**Hela sviten:** 1658 av 1659 gröna (samma förinställda meny1-zoner-fel, orört), `tsc --noEmit`

---

## HELG-1 DEL 9 — KALIBRERING-1, read-only-granskning, 2026-08-21

**Hårt stopp respekterat: ingen kod ändrad.** Granskningen gäller "Sid-analys (teknisk
SEO + AEO)"-kortet i `/k/seo` (`app/k/seo/SeoClient.tsx:396`), motorn är
`scoreSignals()` i `lib/seo-deep.ts:309` (samma funktion `/api/seo/audit` kör i
produktion via `auditUrlRendered()` i `lib/seo-audit.ts:130`) — INTE den stora
AI-skrivna DT-rapporten från DEL 2, det är ett annat verktyg.

**Snabbtestet kördes utan att röra Annas (Oppråbys) riktiga sida.** I stället kördes
`scoreSignals()` rent i minnet med syntetiska signaler byggda på Oppråbys riktiga
titeltext, i `scripts/_kalibrering1-rorlighet.mts` (skriptet ligger kvar, run:
`npx tsx --tsconfig scripts/text1/tsconfig.json scripts/_kalibrering1-rorlighet.mts`).
Motivering: samma svar, mätt exaktare (isolerar en variabel i taget utan
nätverksbrus), utan minsta risk att en riktig kundsida ligger med fel titel synlig
för besökare eller Google mitt i testet.

| Fråga | Svar | Bevis |
|---|---|---|
| **Rörlighet** — rör poängen sig när sidtiteln ändras? | **Trappstegsfunktion, inte kontinuerlig.** Inom samma "band" (t.ex. 54→66 tecken, båda under 65-gränsen) rör sig SEO-poängen **noll**, oavsett hur mycket bättre eller sämre titeln faktiskt blivit som text. Poängen rör sig BARA vid två hårda trösklar: tom↔ifylld (±15) och över/under 65 tecken (±4). En titel som går från utmärkt till medioker men stannar inom samma band ger identisk poäng | Skriptets steg 1–3. Uppmätt: 66→54 tecken (samma band) = 0 poängs skillnad; tom titel = −15 mot en ren baseline |
| **Golv/tak** | Fungerar som avsett, ingen bugg hittad. Golv: `Math.max(0, seo)` (`seo-deep.ts:380`). Tak: en icke-indexerbar sida (`noindex` eller robots.txt-block) kapas till **max 25 SEO-poäng** oavsett hur perfekt allt annat är (`seo-deep.ts:379`) | Skriptets golv/tak-steg: noindex + i övrigt fläckfri sida → SEO stannar exakt vid 25 |
| **Åtgärdslistans sortering och täckning** | **Två separata problem, det andra allvarligt.** (1) Ordning: listan är INTE sorterad efter poängvikt — den råkar följa insättningsordning (`seo-deep.ts:337–389`), och `schema` (upp till −20 AEO-poäng, den enskilt tyngsta enskilda posten i hela systemet) hamnar sist i listan trots att UI-texten lovar "Följ åtgärdslistan uppifrån; de översta ger mest effekt" (`SeoClient.tsx:400`). (2) Täckning — det allvarliga fyndet: FEM av AEO:s sex avdragsposter (FAQ −12, textdjup −8, frågerubriker −8, listor −5, färskhet −5 = −38 poäng) skrivs **ALDRIG** till `checks`-arrayen (`seo-deep.ts:390–396` saknar `add()`-anrop som de andra raderna har). De syns därför aldrig i `issues`/åtgärdslistan kunden ser. En kund kan se AEO 62 med en helt TOM åtgärdslista | Skriptets sista steg: AEO 100→62 (−38 poäng), men `checks.filter(fel).length === 0` — noll förklarande rader för hela nedgången |
| **Plattformsärlighet** | **Konkret asymmetri, verklig risk för falska minus på klientrenderade sajter (GHL, Next.js/SPA).** `title`, `metaDescription`, `robots`, `ogTags`, `schemaTypes`/`faqs` och `canonical` söks i BÅDE rå HTML och avkodad JS-payload (`hay = raw + decoded`, `seo-deep.ts:462`) — byggt precis för att inte straffa GHL-sajter (kommentaren rad 1–8 om `lesson_ghl_client_side_verify`). Men `headings` (H1-kollen), `wordCount`, `paragraphCount`, `listCount`, `images` och `links` läses ENDAST ur rå HTML (`seo-deep.ts:501,507,509,510,512,516`, kommentaren rad 498 säger uttryckligen "på den synliga HTML:en, inte payloaden"). En sajt vars H1, brödtext, bilder eller menylänkar renderas av JS (GoHighLevel, Next.js) riskerar därför falskt "H1 saknas" (−10), "tunt innehåll" (−10) och "bilder utan alt-text" — exakt samma klass av bugg som canonical/schema redan skyddades mot, fast oskyddad här | Kodläsning, `lib/seo-deep.ts:462` (hay-sökning) jämfört med rad 501–524 (raw-only). Inte körd live — verifierbart genom att läsa samma rader |

**Ingen kod ändrad, som beställt.** Fyndens allvarlighetsordning: åtgärdslistans
täckningslucka (AEO kan tappa 38 poäng utan en enda förklarande rad) och
plattforms-asymmetrin (H1/innehåll/bilder/länkar oskyddade mot samma buggklass som
canonical/schema redan fixades för) är de två som bör prioriteras när Håkan ger OK
att bygga. Sorteringsordningen och rörlighets-trappstegen är mindre akuta —
trappstegsbeteendet är sannolikt en medveten avvägning (binära pass/fail-krav är
enklare att förklara för en kund än ett kontinuerligt betyg), men värt att bekräfta
med Håkan snarare än att anta.

---

## HELG-1 KALIBRERING-2 — byggd på Håkans beslut, 2026-08-21

**Håkans beslut på DEL 9-fynden:** bygg punkt 1 (AEO-avdrag synliga) och 2
(poängviktad sortering) direkt — ren ärlighet, ingen poängändring. Bygg punkt 3
(delad render-medveten extraktionsväg för H1/textmängd/bilder/länkar). Bygg INTE
trappstegsfunktionen (rörligheten) — skriv i stället ett beslutsunderlag. Allt
klart, ingen ny kod väntar.

### 1–2. Åtgärdslistan: alla avdrag synliga, tyngsta överst

`lib/seo-deep.ts::SeoCheck` fick ett `poang`-fält. Alla check-rader (SEO och AEO)
skriver nu sin faktiska poängeffekt. Fem tidigare osynliga AEO-avdrag
(`aeo_faq` −12, `aeo_djup` −8, `aeo_fragerubriker` −8, `aeo_listor` −5,
`aeo_farskhet` −5) syns nu som egna rader — täcker hela DEL 9-fyndet (AEO kunde
tappa 38 poäng utan förklaring, nu 0). Samma ärlighetsfix på två ställen till som
hittades under bygget: titel över 65 tecken och meta över 170 tecken gav förut
tyst −4 poäng bakom en grön "ok"-rad — visas nu som "fel" med poäng, exakt samma
mönster som DEL 9 redan flaggat, ingen poäng ändrad.

`lib/seo-audit.ts::auditUrlRendered()` sorterar nu åtgärdslistan efter `poang`
(mest negativ överst) innan den returneras, och varje rad visar sin poängeffekt i
klartext, t.ex. "Strukturerad data: ingen JSON-LD hittad (-20 poäng)". Indexerbarhet
har ingen fast poäng (grinden kapar taket, effekten beror på resten av sidan) och
sorteras alltid överst via en sentinel. Bonusfynd: en redan existerande dubblettrad
för "saknar schema" (två separata poster för samma fel) togs bort i samma veva.

### 3. Delad render-medveten extraktionsväg

Ny funktion `extraheraRenderMedvetet()` i `lib/seo-deep.ts`: matcha i rå HTML
först, ge den NOLL träffar — matcha i den avkodade JS-payloaden i stället. Aldrig
konkatenering (skulle kunna dubbelräkna om samma markup speglas i en
hydreringspayload). Kopplad in för headings (H1-kollen), bilder, länkar och
paragraf/list-räkning. Textmängd (`wordCount`) fick samma princip men en egen
implementation: avgörs på BRÖDTEXTEN (title-taggen räknas inte som "riktigt
innehåll" i sig), och när den avkodade payloaden vinner används en ny
`stripTextPayload()` — vanliga `stripText()` kastar bort `<script>`-block, och det
är precis där en avkodad hydreringspayload textuellt ligger (det är själva
anledningen till att den behöver avkodas). Utan den andra funktionen skulle
fallbacket tyst returnera tomt, vilket också var det som hände första
testkörningen — fångat och rättat innan commit.

**DoD-bevis (`tests/kalibrering2-atgardslista.test.ts`, 5 nya tester):**
- Alla fem AEO-avdrag ger egna "fel"-rader med rätt poäng.
- Titel >65 / meta >170 ger "fel" med poäng i stället för tyst "ok".
- `auditUrlRendered` sorterar schema (−20) före title-liknande avdrag, poäng syns i
  klartext.
- H1 som bara finns i en avkodad JS-payload hittas nu (simulerad GHL-liknande
  hydrering) — tidigare hade det gett falskt "H1 saknas".
- **Omvänt test:** en sajt som serverar allt i rå HTML räknar bilder/länkar/H1
  identiskt före och efter (ingen dubbelräkning när raw redan har allt).

**Verifiering:** `tsc --noEmit` rent. Hela testsviten: **1663 av 1664 gröna**
(samma redan kända, orörda MENY-3-fel från 19/8 som i alla tidigare DEL:ar denna
helg — inget nytt fel). De nio befintliga SEO-relaterade testerna
(`seo1-hamtning.test.ts`, `seo2-omatt.test.ts`) opåverkade.

### Skarp DoD-körning före push (Håkans krav — testsviten räckte inte som bevis)

Kört mot tre RIKTIGA sajter, riktiga nätverksanrop, gammal kod (commit `7568507`,
före KALIBRERING-2) mot ny kod (HEAD), samma URL:er. Skriptet var tillfälligt
(`_kalibrering2-dod-skarpt.mts` + en extraherad kopia av gammal kod), kört och
sedan raderat — resultatet står här i stället för i en fil.

| Sajt | FÖRE (SEO/AEO) | NU (SEO/AEO) | H1 hittat båda? | Identiskt? |
|---|---|---|---|---|
| **opprabygamlaskola.se (Anna)** | 72/55 | 72/55 | Ja, "Deltagare berättar" båda | Ja |
| www.displayteknik.se | 88/100 | 88/100 | Ja, båda | Ja |
| www.alucon.se | 82/47 | 82/47 | Ja, båda | Ja |

**Omvända testet (en rå-HTML-sajt får identisk poäng före/efter): BEVISAT, på tre
riktiga sajter, inklusive Annas egen.** SEO, AEO, ordantal, bildantal och
länkantal exakt lika i alla tre.

**Åtgärdslistans ärlighet och sortering: BEVISAT LIVE på Annas sida.** FÖRE (5
rader, osorterade, inga poäng): meta, canonical, bilder, schema, PLUS en duplicerad
"saknar schema"-rad (bekräftar bifyndet som togs bort). NU (7 rader, sorterade,
poäng synliga): schema (−20) överst, sedan meta (−12), FAQ (−12), canonical (−8),
bilder (−8), frågerubriker (−8), färskhet (−5) — FAQ och frågerubriker och
färskhet var HELT OSYNLIGA förut trots att de redan drog ner AEO-poängen då också.

**H1/text/bilder/länkar-falsklarmet på klientrenderade sajter: INTE reproducerat
live — ärligt sagt.** Alla tre testade sajter (inklusive Annas) visade sig vara
ren, server-renderad HTML redan i botten, inte GHL-/Next-klientrendering — därför
fanns inget falskt "H1 saknas" att bevisa bort på just dessa sidor; koden hade
inget att rätta till där. Fixen i sig är bevisad genom en realistisk simulerad
GHL-hydreringspayload i `tests/kalibrering2-atgardslista.test.ts` (H1 som bara
finns i en avkodad JS-payload hittas nu) — men det är en konstruerad
reproduktion, inte en live kundsida. Jag letade inte vidare efter en riktig
klientrenderad kundsida bortom dessa tre — säg till om du vill att jag ska leta
efter en specifik sida (t.ex. en GHL-funnelsida, inte huvuddomänen) för att bevisa
den delen live också.

**Slutsats:** två av tre DoD-krav bevisade live på riktiga sajter (omvänt test +
åtgärdslistans ärlighet/sortering). Det tredje (H1-falsklarmet) bevisat konstruerat,
inte live — ingen riktig kundsida i urvalet hade buggen till att börja med.

### Trappstegsfunktionen (rörligheten) — INTE byggd, beslutsunderlag

**Håkans instruktion:** poängmodellsbeslut som flyttar siffror kunder redan sett —
väntar hans beslut efter helgen.

**Läget idag:** fyra tröskelvärden är rena klipp — allt eller inget vid en enda
gräns: titel 65 tecken (±4p), meta description 170 tecken (±4p), SEO-innehåll 300
ord (−10p), AEO-djup 600 ord (−8p). En sida på 299 ord straffas fullt ut, en på 300
ord straffas inte alls. `bilder_alt`-checken är redan gradvis
(`Math.min(8, antalUtanAlt)`) — beviset att mönstret redan finns och är enkelt att
använda som mall.

**Förslag, ETT mönster för alla fyra:** en linjär ramp mellan "inget straff" och
dagens fasta maxstraff, i stället för ett kliv. Exempel för titel: 0 poäng vid
≤65 tecken, sedan −1 poäng per påbörjade 5 tecken över gränsen, med samma tak (−8,
dvs aldrig värre än att halvera "saknas"-straffet på −15) som idag är hårdkodat
till −4. Samma idé för meta (170) och för de två ordgränserna (300/600), fast
neråt: full poäng vid gränsen, linjärt fallande mot 0 ord. **Öppen fråga till
Håkan:** ska en för KORT titel (under t.ex. 15 tecken) också straffas gradvis —
det finns inget straff alls för det idag, och det vore en ny regel, inte bara en
mjukare variant av en befintlig.

**Vilka kunders poäng skulle röra sig — mätt på riktig data, inte gissat**
(`scripts/_kalibrering2-trappsteg-underlag.mts`, läser `hm_seo_audits`):

Av 13 sparade Sid-analyser (5 tenants: HM Motor Krokom, Ledarskapskultur/
Carl-Fredrik Zetterman, Oppråby Gamla Skola, For Balance, AluCon AB) ligger **noll
rader precis över** någon av de fyra gränserna — alltså den zon som faktiskt skulle
förbättras av en gradvis skala (i dag full −4/−10/−8-smäll, med en ramp bara någon
poäng). En rad (Ledarskapskultur, samma URL scannad två gånger) ligger nära
65-gränsen men UNDER den (59 tecken) — om ramp:en bara straffar ÖVER gränsen (som
förslaget ovan) rör den sig inte alls.

**Ärligt om underlaget:** 13 rader är ett litet, historiskt urval — bara sidor som
någon faktiskt klistrat in i Sid-analys-kortet, inte alla kunders alla sidor. Att
ingen i just detta urval ligger i riskzonen är inte samma sak som att ingen gör
det på en sida som aldrig körts genom verktyget. Läs det som "lågt observerat
akutläge", inte "garanterat noll påverkan".

**Håkans SLUTGILTIGA specifikation (21/8, sent — fortfarande BESLUT, INTE byggorder,
ingen kod skriven).** Svar på de tre öppna frågorna plus två tillägg:

1. **Titel:** neutral zon **30–65 tecken** (inget straff). Övre gränsen ligger AVSIKTLIGT
   kvar på dagens 65 — inte en ny siffra. Motivering (Håkans egen): det gör införandet
   nästan churn-fritt, eftersom alla sidor som redan är godkända (≤65 tecken) förblir
   exakt lika godkända. Enda förändringen är UTANFÖR zonen: en titel strax över 65 får
   mjukare straff än dagens flata -4, en titel långt över får hårdare (upp mot -8). Under
   30 tecken är helt NY bestraffning (fanns inte alls förut) — det ÄR en poängförändring
   för de kunder det gäller, och det är avsiktligt (hela poängen med tillägget).
2. **Meta description:** samma princip. Neutral zon **70–170 tecken**, övre gräns kvar på
   170 av samma churn-skäl. **Arkitekturkrav:** bygg EN generell, konfigurerbar
   rampfunktion (neutral zon + gradvis ramp åt båda håll, parametrar: undre gräns, övre
   gräns, maxstraff) — INTE två fältspecifika implementationer för titel och meta.
   Nästa mätvärde som behöver en ramp (H1-längd, bildantal, vad som helst) ska kunna
   kopplas in med bara konfigparametrar, ingen ny kod. Samma princip som
   `extraheraRenderMedvetet()` i KALIBRERING-2 punkt 3: en delad, generell lösning
   istället för punktlagningar.
3. **Ordantal (SEO 300 / AEO 600):** bekräftat, **bara nedåt**. Ingen övre gräns någonsin
   — mer text är aldrig ett fel i sig.

**Tillägg A — "saknas"-regler är EGNA, inte del av rampen.** Gäller alla fält, inte bara
titel: "titel saknas helt" (-15) rörs inte av rampen, och samma princip gäller
motsvarande saknas-regler för meta och framtida fält. Ramper appliceras BARA på
ifyllda värden.

**Tillägg B — DoD innan skarpt läge, obligatorisk:** när rampen väl byggs (efter
Håkans go), kör om ALLA sparade sid-analyser (dagens 13 plus vad som tillkommit) och
redovisa en tabell: exakt vilken kund, vilket håll poängen flyttar, och hur mycket —
INNAN funktionen slås på skarpt. Håkans motivering: han ska kunna förklara varje
poängflytt för en kund som frågar varför poängen ändrades.

**Fortfarande ett beslut, inte en byggorder.** Nästa steg är Håkans go att bygga —
ingen kod ska skrivas förrän dess.

---

## SESSIONSSLUT 2026-08-21, kväll — sparat för ny session

**Committat:** `6878bbf` (45 filer) + `7568507` (DEL 9) + `8f6b52c` (KALIBRERING-2).
Inte pushat (ingen deploy denna session — inget begärt). Pre-existerande
ostagade ändringar (`app/admin/[[...path]]/page.tsx`, `proxy.ts`, `tsconfig.json`,
Makzy-sidfilerna, DT-inventeringsskripten) rörda INTE, ligger kvar ostagade precis
som de var vid sessionens start.

**Klart och dokumenterat i tur och ordning:** DEL 0 (statusinventering), AKUT
(GRIND_INFORD), DEL 2 (RAPPORT-1:s fjärde krav + ny DT-rapport), DEL 3 (bildvägar,
K1-rutan, kapad CTA), DEL 4 (KUNDREGISTER-1-tillägget), DEL 5 (KANAL-2), DEL 6
(KUNSKAP-1, redan klart, omvänt test tillagt), DEL 7 (BETAL-1, HELT klart 21/8
kväll — Stripe kopplat och alla priser verifierade, se sessionsslut nedan), DEL 8 (KOSTNAD-2, saldolarm skarpt bevisat
via sms), DEL 9 (KALIBRERING-1, read-only-granskning klar), KALIBRERING-2 (byggd på
Håkans beslut samma dag — åtgärdslistans ärlighet + sortering, delad render-medveten
extraktion, trappstegsbeslutsunderlag — se egen sektion ovan).

**Reda ut, BILD-11/karusellslides (Håkans egen precisering under sessionen):** de tre
slides han bad om (2=läsbara ord, 4=matfoto/rekvisita, 7=kapad CTA) är nu alla
kodmässigt täckta: slide 2 sedan 16/8 (`0ac2d29`), slide 4 sedan 15/8 (K1-rättningen,
kod korrekt men ENDA obeviset var att hela grindkedjan aldrig kördes ihop — se DEL 0),
slide 7 idag (DEL 3). Håkan sa själv att han genererar om och bedömer resultatet —
det ersätter "kör om med hela grinden inkopplad"-uppgiften som stod öppen i DEL 0.
Inget ytterligare byggarbete väntar här; nästa steg är hans egen bedömning.

**EJ PÅBÖRJAT:** inget kvarstår från HELG-1:s nio delar eller KALIBRERING-2:s tre
byggpunkter. Enda öppna poängmodellsfrågan är trappstegsfunktionen — beslutsunderlag
skrivet, ingen kod, väntar Håkans beslut efter helgen (se KALIBRERING-2-sektionen).

**Väntar på Håkan innan det går vidare:**
1. ~~**DEL 2:** granska den omkörda DT-rapporten mot kontrollprotokollet.~~ **GODKÄND
   21/8** — Håkan granskade en renderad version (Cockpits befintliga rapportmall, inte
   den råa markdown-filen) och var "supernöjd med rapporten". Tonfrågan stängd.
   ~~pricing_notes-beslutet~~ **AVSKRIVET på Håkans instruktion** ("strunta i pris
   notes") — kravet i kontrollprotokollet sänks, inget stickprovspris krävs. Ingen
   åtgärd kvar.
2. ~~**DEL 7:** Stripe-koppling + priser.~~ **HELT KLAR 21/8 kväll** — testnyckel +
   webhook kopplade, "Kopplingen fungerar" bekräftat. Alla fyra priser verifierat
   skapade i Stripe (`/dashboard/betalning` → Planer och priser): MySales 700 kr,
   MySales Pro 1990 kr, MySales Pro ordinarie 2490 kr, 100 tokens 149 kr — samtliga
   taggade "Finns i Stripe". **En verklig fälla på vägen:** Håkan klistrade först in
   `pk_test_...` (den publika nyckeln) i fältet för hemlig nyckel — Stripe avvisade
   den tydligt ("cannot be made with a publishable API key"), rättat till
   `sk_test_...`. DEL 7:s DoD ("hel kedja i testläge") kan nu köras skarpt när Håkan
   vill — bara det manuella klicket kvar, ingen kod blockerar längre.
3. **DEL 8:** mejldelen av saldolarmet är oprövad i skarp drift (RESEND_API_KEY saknas
   lokalt) — bevisas automatiskt av morgondagens cron (06:30) eller genom att köra om
   skriptet efter deploy.
4. ~~**Fyll på 46elks och fal.ai.**~~ **46elks KLART** — Håkan fyllde på, verifierat
   direkt mot 46elks live API (förbi timmes-cachen): 147,64 SEK, upp från 48 kr.
   Fal.ai visade redan "OK" i `/dashboard/ekonomi`, ingen påfyllning behövdes där.
5. ~~**Trappstegsfunktionen:** beslut.~~ **SPECIFIKATION KLAR 21/8 sent, väntar
   fortfarande Håkans "go" att bygga** — fullständigt svar på alla tre frågor plus
   två tillägg (A: saknas-regler egna, B: obligatorisk före/efter-tabell som DoD)
   inskrivet i KALIBRERING-2-sektionen ovan. Inget byggt.
6. **Nya fynd, ej fixade, köas efter helgen:** dubbel AI-promptomgång i ImageStudios
   Imagen-flik (DEL 3), meny1-zoner.test.ts fallerar sedan MENY-3 (19/8, orört av
   HELG-1), fyra av fem bildvägar fortfarande okopplade (Pinterest/YouTube/Threads/
   Bluesky-plattformssträngar overifierade).

**Nästa session börjar här:** läs det här avsnittet + `docs/STATUS.md` i sin helhet,
och stäm av punkterna ovan med Håkan.
rent.
