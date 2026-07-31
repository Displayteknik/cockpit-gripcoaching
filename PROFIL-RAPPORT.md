# PROFIL-0 — granskningsrapport: brand-ID som kvalitetsgrund

Läge: **HÅRT STOPP.** Ingen kod ändrad, inga skrivningar mot databasen, inga commits. Rapporten är ett beslutsunderlag — kriterierna i avsnitt 0.6 byggs först när du godkänt dem.

Genererad 2026-07-31. Underlag: kodläsning i `hmmotor-next` + läsning (service-role, READ ONLY) av de fyra skarpa profilerna i Supabase.

---

## TL;DR — tre saker som avgör textkvaliteten

1. **Fyra profilfält som du redigerar når aldrig en textprompt.** `differentiators`, `services`, `pricing_notes` och `booking_url` finns i formuläret och räknas i procenttalet, men saknas i `getProfileAsMarkdown` (`lib/knowledge.ts:60-78`) — och det är den funktionen prompt-core injicerar. Displayteknik har 1 262 tecken riktiga, publika priser i `pricing_notes` (17 verifierade siffror) som ingen text någonsin har sett. Samtidigt förbjuder SANNINGSKRAVET modellen att hitta på siffror. Resultatet blir precis det mätningen visade: korrekt men utbytbart.
2. **Vinnande exempel (lager 5) är i praktiken avstängt.** `fetchWinningExamples` filtrerar på `client_assets.subcategory` (`lib/voice-score.ts:168`). Samtliga 15 winning_example-rader på hela plattformen har `subcategory = NULL`. Engens Träd har 14 godkända exempel — noll av dem når prompten i 10 av 12 flöden.
3. **Procenttalet mäter teckenlängd, ingenting annat.** En profil med tolv tomfraser (593 tecken totalt) plus fem kopierade inlägg, tre foton och tre vittnesmål ger **100 % och "Klar att producera"**. Displaytekniks riktiga profil på 9 507 tecken ger **89 %**. Mätaren belönar alltså ifyllnad och straffar substans.

---

## 0.1 Datamodell och källor

### Vad som utgör ett brand-ID idag

| Källa | Tabell | Redigeras i | Når prompten? |
|---|---|---|---|
| Varumärkesprofil | `hm_brand_profile` | `app/dashboard/profil/page.tsx` (+ `/k/profil`) | Delvis — se fälttabellen nedan |
| Kundens egna ord | `customer_voice` | Ingen egen redigeringsyta. Skrivs bara av `app/api/intake/commit/route.ts:155-174` | Ja, `lib/knowledge.ts:86-117` |
| Story-bank | `linkedin_posts` med `source_module='intake'` | Ingen egen yta. Skrivs bara av `app/api/intake/commit/route.ts:176-193` | Ja, `lib/knowledge.ts:119-136` |
| Röst-fingerprint | `client_voice_profile` | Byggs automatiskt ur `client_assets` (`lib/voice-fingerprint.ts:71`), redigeras via intake-förslag | Ja, lager 4 (`lib/prompt-core.ts:309-316`) |
| Råmaterial | `client_assets` (post/photo/audio/video/testimonial/link/document) | `components/profile/KnowledgeBank.tsx` | Indirekt — endast som `raw_samples` i fingerprintet (`lib/voice-fingerprint.ts:57-69`) |
| Vinnande exempel | `client_assets` med `category='winning_example'` | **Ingen UI-yta.** Sätts av setup-agentens verktyg (`lib/setup-tools/index.ts:122-147`), av kundens idé-godkännande (`app/api/customer/ideas/route.ts:40-53`) eller av seed-skript | Lager 5 — men blockeras av subcategory-filtret, se fynd F2 |
| Grafisk profil | `studio_brand_kits.kit` | `app/dashboard/brand-kit/page.tsx` via `app/api/brand-kit/route.ts` | Endast `kit.donts` når textprompten (`lib/studio/kit.ts:118`, lager 7), och bara för bildnära syften |

### Prompt-kedjan (så att "når prompten" är entydigt)

`byggTextPrompt` (`lib/prompt-core.ts:259`) är enda vägen in för de tolv textsyftena. Lager 3 hämtas med `getProfileAsMarkdown(clientId, { medVoice: false })` (`lib/prompt-core.ts:285-301`). Det betyder att `getProfileAsMarkdown`s egna voice- och winning-block (`lib/knowledge.ts:138-179`) hoppas över med flit — prompt-core äger de lagren. Kvar från profilen blir alltså exakt de sektioner som byggs på raderna 60-78 plus Customer Voice- och story-blocken.

### Fält för fält: lagras / redigeras / når prompten

| Fält i `hm_brand_profile` | Redigeras (UI) | Rubrik i prompten | Når prompten |
|---|---|---|---|
| `company_name` | Grundinfo | Företagsnamn | Ja |
| `tagline` | Grundinfo | Tagline | Ja |
| `location` | Grundinfo | Plats | Ja |
| `founder_name` | Grundinfo | Grundare | Ja |
| `founder_phone`, `founder_email` | Grundinfo | Kontakt | Ja (sammanslagna) |
| `brand_story` | Berättelsen | Brand story | Ja |
| `usp` | Berättelsen | USP | Ja |
| `tone_rules` | Ton & språk | Tonregler | Ja |
| `icp_primary` | Målgrupp | Primär ICP | Ja |
| `icp_secondary` | Målgrupp | Sekundär ICP | Ja |
| `pain_points` | Målgrupp | Smärtpunkter kunden har | Ja |
| `customer_quotes` | Kundernas egna ord | Voice of Customer (kundord) | Ja |
| `competitors` | Konkurrenter | Konkurrenter | Ja |
| `customer_journey` | Kundernas egna ord | Kundresa | Ja |
| `dos` | Ton & språk | GÖR | Ja |
| `donts` | Ton & språk | GÖR INTE | Ja (+ blir `forbidden_words`, `lib/voice-fingerprint.ts:98`) |
| `hashtags_base` | Ton & språk | Hashtag-bas | Ja |
| **`differentiators`** | Differentiering | — | **Nej** |
| **`services`** | Erbjudande & CTA | — | **Nej** |
| **`pricing_notes`** | Erbjudande & CTA | — | **Nej** |
| **`booking_url`** | Erbjudande & CTA | — | **Nej** |

### Egna fynd — fält och funktioner som redigeras men aldrig når en prompt

**F1. Fyra profilfält saknas i lager 3.**
`differentiators`, `services`, `pricing_notes`, `booking_url` finns inte i sektionslistan i `lib/knowledge.ts:60-78`. De når därmed ingen av de tolv textsyftena. Var de ändå syns:

- `differentiators` — `app/api/review/post/route.ts:65`, `app/api/social/topic-suggest/route.ts:67`, `app/api/linkedin/seed-pillars/route.ts:45`. Sidokanaler för granskning/idégenerering, aldrig själva texten.
- `services` — `app/api/blog/ideas/route.ts:103`, `app/api/generate/hashtags/route.ts:30`, `app/api/social/topic-suggest/route.ts:65`, `lib/deep-audit-generate.ts:244`. Samma sak.
- `pricing_notes` — förekommer bara i formuläret och i kvalitetsmätaren (`app/api/profile/quality/route.ts:144`). **Helt dött fält i genereringen.**
- `booking_url` — används som länk i nyhetsbrev (`app/api/newsletter/generate/route.ts:46`) och som fotnot i karusell/SVG-rendering. Aldrig som text i prompten.

Detta är den enskilt allvarligaste kopplingen till mätresultatet. CTA-golvet i `lib/prompt-core.ts:135` säger ordagrant: *"Innehåller varumärkesprofilen färdiga CTA-formuleringar (Erbjudande/CTA-sektion, kundens egna ord): FÖREDRA dem framför nyskrivna."* Den sektionen existerar inte i prompten. Regeln pekar på ett tomrum.

**F2. Vinnande exempel filtreras bort av ett tomt fält.**
`fetchWinningExamples(clientId, category)` (`lib/voice-score.ts:157-171`) lägger på `.eq("subcategory", category)` när kategori är satt. Prompt-core sätter alltid kategori för de tio syften som finns i `KATEGORI` (`lib/prompt-core.ts:105-116`). Kontroll mot skarp databas: **15 winning_example-rader totalt på plattformen, samtliga med `subcategory = NULL`.** Lager 5 levererar alltså noll exempel i tio av tolv syften. Undantag: `kanal-anpassning` (ingen kategori sätts → filtret uteblir) och specialist-flödet (som sätter specialistens egen kategori och därmed också får noll).

**F3. `client_assets.subcategory` har ingen väg in i systemet.**
Kolumnen finns (en rad i skarp drift har `seo_aeo`), men varken KnowledgeBank-UI:t eller `createTextAsset` (`lib/assets.ts:120-150`) skriver den. Enda skrivaren är setup-agentens `mark_winning_example` (`lib/setup-tools/index.ts:122-147`). Det förklarar F2 fullständigt.

**F4. Kunskapsbanken saknar knapp för "vinnande exempel".**
`components/profile/KnowledgeBank.tsx` har flikar för post/photo/audio/video/testimonial/link, men ingen väg att markera något som `winning_example`. Kunden kan alltså inte själv leverera det lager som väger tyngst i röstimitationen.

**F5. `target_audience` finns inte — onboarding-steget "Brand-profil" kan aldrig bli grönt.**
`app/api/setup/onboard-status/route.ts:64` läser `select("client_id, tone_rules, dos, donts, usp, target_audience")`. Kolumnen finns inte i tabellen (verifierat: PostgREST svarar `42703 column hm_brand_profile.target_audience does not exist`). Hela profilfrågan felar tyst, `profile.data` blir `null`, och `brandComplete` (rad 105) blir `false` för samtliga klienter oavsett hur välfylld profilen är.

**F6. Kvalitetsrapporten hämtas och kastas.**
`components/SkapaInlaggMaker.tsx:133` anropar `/api/profile/quality` men använder bara svaret som villkor för att sedan hämta `/api/assets`. Själva rapporten används aldrig.

**F7. Customer Voice och story-bank har ingen redigeringsyta.**
Båda kan bara fyllas via intake-flödet (`app/api/intake/commit/route.ts`) eller Ikigai-flödet. Det finns ingen plats där en kund kan skriva in en kundberättelse direkt — trots att SANNINGSKRAVET (`lib/prompt-core.ts:154-162`) gör story-bank till enda tillåtna källan för kundberättelser i text.

**F8. `hashtags_base` sparas ibland som Postgres-arraylitteral.**
Engens värde är `{#trädfällning,#riskträd,...}` — klammer och kommatecken går rakt in i prompten som text.

---

## 0.2 Hur procenttalet beräknas idag

### Var koden ligger

Hela beräkningen sitter i **`app/api/profile/quality/route.ts`**. Visas av `components/profile/QualityMeter.tsx:71` (stora talet) och `:118` (per dimension), monterad i `app/dashboard/profil/page.tsx:191`.

Grundprimitiven, rad 26-31:

```ts
function len(s: unknown): number {
  return typeof s === "string" ? s.trim().length : 0;
}
function has(s: unknown, min = 10): boolean {
  return len(s) >= min;
}
```

**Det är hela definitionen av "ifyllt".** Ingen ordkontroll, ingen sifferkontroll, ingen dubblettkontroll, ingen floskelkontroll. Endast `trim().length >= tröskel`.

### De fem dimensionerna, tröskel för tröskel

| Dimension | Rad | Kontroller | Tröskel |
|---|---|---|---|
| Röst | 52-72 | `tone_rules` | ≥ 30 tecken |
| | | `dos` | ≥ 10 tecken |
| | | `donts` | ≥ 10 tecken |
| | | antal `post`-assets | ≥ 5 |
| | | `audio` + `video` | ≥ 1 |
| Målgrupp | 76-96 | `icp_primary` | ≥ 50 tecken |
| | | `icp_secondary` | ≥ 30 tecken |
| | | `pain_points` | ≥ 50 tecken |
| | | `customer_quotes` | ≥ 80 tecken |
| Auktoritet | 98-116 | `usp` | ≥ 40 tecken |
| | | `brand_story` | ≥ 100 tecken |
| | | `differentiators` | ≥ 30 tecken |
| Bevis | 118-137 | antal `testimonial` | ≥ 3 |
| | | antal `photo` | ≥ 3 |
| | | `customer_journey` | ≥ 80 tecken |
| Erbjudande | 139-161 | `services` | ≥ 30 tecken |
| | | `booking_url` | ≥ 8 tecken + `^https?://` |
| | | `pricing_notes` | ≥ 10 tecken, räknas ej i poängen |

### Viktning

Rad 62, 83, 104, 124, 150: varje dimension = `Math.round(filled / total * 100)`. Alla kontroller inom en dimension väger lika.
Rad 163: `overall = Math.round(dims.reduce((s, d) => s + d.score, 0) / dims.length)` — **rakt oviktat medelvärde av de fem dimensionerna.**

Konsekvens av oviktningen: `booking_url` (en URL, 24 tecken) väger 10 % av totalen — exakt lika mycket som `brand_story`. Och `pricing_notes`, som innehåller de enda verifierade priserna i hela Displayteknik-profilen, väger 0 %.

Assetsräkningen kommer från `countAssetsByType` (`lib/assets.ts:103-117`), som räknar alla aktiva rader per `asset_type` utan hänsyn till kategori. Engens 14 `winning_example`-rader har `asset_type='post'` och räknas därför som "egna inlägg" — trots att KnowledgeBank-UI:t filtrerar bort systemgenererat material (`components/profile/KnowledgeBank.tsx:68`). De två räknesätten är alltså inte samma.

### Hypotestest: stiger procenten lika mycket av skräp?

Simulering i analys (inget skrivet till databasen). Tolv fält fyllda med tomfraser, precis över varje tröskel:

| Fält | Innehåll | Tecken | Tröskel |
|---|---|---|---|
| `tone_rules` | "Vi skriver proffsigt och trevligt." | 34 | 30 |
| `dos` | "vara trevlig" | 12 | 10 |
| `donts` | "vara tråkig" | 11 | 10 |
| `icp_primary` | "Kunder som vill ha bra kvalitet och bra service hos oss." | 56 | 50 |
| `icp_secondary` | "Andra kunder som också vill ha bra." | 35 | 30 |
| `pain_points` | "De vill ha bra kvalitet men vet inte var man ska välja." | 55 | 50 |
| `customer_quotes` | "Bra jobbat! Mycket nöjd. Rekommenderas varmt. Toppenservice. Kommer gärna tillbaka snart." | 89 | 80 |
| `usp` | "Vi är bäst i branschen på det vi gör här." | 41 | 40 |
| `brand_story` | "Vi startade för att vi ville göra något bra. Sedan dess har vi gjort bra saker för våra kunder varje dag." | 105 | 100 |
| `differentiators` | "Vi är bäst. Vi är snabbast. Vi bryr oss." | 40 | 30 |
| `customer_journey` | "Först hör de av sig. Sedan pratar vi. Sedan bokar de. Sedan levererar vi. Sedan är de nöjda." | 92 | 80 |
| `services` | "Vi gör det vi är bäst på för dig." | 33 | 30 |
| `booking_url` | `https://example.com` | 19 | 8 + URL |

**Summa: 593 tecken text. Noll siffror, noll egennamn, noll kundcitat, noll berättelser.**

Uträkning med koden i 0.2:

| Läge | Röst | Målgrupp | Auktoritet | Bevis | Erbjudande | **Totalt** | "Klar att producera"? |
|---|---|---|---|---|---|---|---|
| Skräptext, inga assets | 60 % | 100 % | 100 % | 33 % | 100 % | **79 %** | Nej |
| Skräptext + 5 kopierade inlägg, 3 foton, 1 video, 3 vittnesmål | 100 % | 100 % | 100 % | 100 % | 100 % | **100 %** | **Ja** |
| Ett enda tecken per fält + samma assets | 40 % | 0 % | 0 % | 67 % | 50 % | **31 %** | Nej |
| Displayteknik i skarp drift (9 507 tecken, 63 siffror) | 80 % | 100 % | 100 % | 67 % | 100 % | **89 %** | Nej |

**Slutsats: hypotesen bekräftas i sin starkaste form.** Skräpet ger inte "lika mycket" — det ger *mer*. 593 tecken tomfraser slår plattformens rikaste riktiga profil med elva procentenheter. Enda skillnaden mellan 79 % och 100 % är sex uppladdningar, som lika gärna kan vara samma text sex gånger — det finns ingen dubblettkontroll i `countAssetsByType`.

Enteckentestet visar samtidigt att trösklarna *gör något*: 31 % är rätt lågt. Men det enda de mäter är att någon orkat skriva en mening. Steget från "en mening" till "en mening med innehåll" mäts inte alls.

---

## 0.3 Vägledningen i UI

### Vad användaren ser när något saknas

Kvalitetsmätaren (`components/profile/QualityMeter.tsx:126-139`) visar per dimension en **"Saknas"-lista** med etiketterna ur `missing`, plus en `hint`-rad i kursiv stil. Etiketterna är konkreta i mängd men inte i kvalitet:

- "Minst 5 egna inlägg", "Minst 1 ljud/video-inspelning", "Minst 3 vittnesmål med namn", "Minst 3 foton från verksamheten" — konkret antalsmål.
- "Tonregler", "GÖR-lista", "GÖR INTE-lista", "Din viktigaste målgrupp", "Riktiga kundord", "Kundresan (5 stadier)", "Tre saker bara du kan säga", "Bokningslänk (giltig URL)" — säger *vilket fält* som är tomt, inte vad som gör det bra.

Hint-raderna är plattformens starkaste språk idag och de är faktiskt bra skrivna:

- Röst: "AI:n imiterar bara så bra som den får exempel. Lägg in fler riktiga inlägg och en ljudinspelning."
- Målgrupp: "Utan tydlig målgrupp blir innehållet generiskt. Kör \"Hitta din målgrupp\" om den saknas."
- Auktoritet: "Tre saker bara du kan säga är hjärtat i alla bra inlägg. Skriv ned dem."
- Bevis: "Vittnesmål och riktiga foton slår all stockfoto-design. Ladda upp."
- Erbjudande: "Ett inlägg utan tydlig nästa-handling konverterar inte. Bokningslänken måste fungera."

Problemet är att hintarna **försvinner så fort tröskeln passeras**. Skriv 40 tecken tomfraser i `differentiators` och rubriken blir grön — hinten "Tre saker bara du kan säga är hjärtat i alla bra inlägg" slutar visas. Och `differentiators` når som sagt aldrig en prompt (F1), så rådet är dessutom felriktat i dagens kod.

Fältnivån har `hint`-texter i formuläret (`app/dashboard/profil/page.tsx:270, 279, 291, 326, 344, 356, 363`). De är kvalitativa och pekar mot konkret innehåll, till exempel:

- Brand story: "2–4 stycken: varför företaget finns, hur det började, vad som gör det speciellt."
- Differentiering: "Det som ger dig tyngd: år av erfarenhet, certifieringar, lokal koppling, en metod ingen annan har. En per rad."
- Smärtpunkter: "Vad kunden oroar sig för, formulerat som de själva skulle säga det."
- Kundord: "Klistra in riktiga recensioner, mejl och samtalsanteckningar från dina kunder."

Ingen av dessa hintar är kopplad till mätningen. Formuläret säger "år av erfarenhet, certifieringar" — mätaren räknar tecken.

Det finns **ingen uppmaning någonstans** av typen "lägg till 2 kundberättelser". Story-bank och Customer Voice nämns inte i UI:t över huvud taget (jämför F7).

### Var procenten syns

Två ställen, båda i profilvyn: totalen (`QualityMeter.tsx:71`) och per dimension (`:118`). Klick på en dimension scrollar till rätt sektion och blinkar den (`app/dashboard/profil/page.tsx:97-110`) — bra mikro-UX. Kundportalen `/k/profil` renderar samma sida (`app/k/profil/page.tsx`) och visar alltså samma siffra för kunden.

### Används den som grind?

**Nej. Ingenstans.**

- `ready_to_produce` (`app/api/profile/quality/route.ts:164`) beräknas och returneras men konsumeras bara som en grön informationsruta (`QualityMeter.tsx:83-88`). Ingen funktion blockeras.
- `components/SkapaInlaggMaker.tsx:133` hämtar rapporten och slänger den (F6).
- Enda faktiska grind i genereringen är existenskontrollen i `app/api/generate/post/route.ts:90-99`: finns ingen rad alls i `hm_brand_profile` returneras "Brand-profil saknas — fyll i den först". En helt tom rad passerar.
- `app/k/page.tsx:68` har en egen, tredje kompletthetsberäkning (fem fält: `usp`, `icp_primary`, `tone_rules`, `customer_quotes`, `booking_url`) som inte hänger ihop med kvalitetsmätaren.
- Onboarding-statusen (`app/api/setup/onboard-status/route.ts`) har en fjärde definition, som dessutom är trasig (F5).

Fyra olika svar på "hur komplett är profilen?" i samma kodbas.

---

## 0.4 Ton-wizarden och intagsflödena

Kravet nedan är ordagranna citat ur koden.

### Ton-wizarden (`app/dashboard/profil/page.tsx:690-743`)

Två frågor totalt. Ledtexterna:

> "Klistra in 2–5 exempelmeningar som låter exakt som du vill låta."

> "Ord/uttryck du undviker?"

Platshållare:

> `t.ex. "Hej! Jag har hjälpt mina kunder sedan 2010. Hör av dig så hittar vi en tid."`

> `t.ex. 'kraftfull', 'banbrytande', storstadsslang`

Serverprompten (`app/api/profile/assist/route.ts:94-96`):

> "Du analyserar tonen i exempeltexter och skriver konkreta tonregler. Svenska. Raka punkter."
> "Svara med ren text — 6–10 regler som punktlista med (-) framför varje. Inkludera både \"GÖR\" och \"GÖR INTE\". Referera till konkreta ord eller meningsstrukturer från exemplen."

**Bedömning: leder mot konkret.** Wizarden kräver riktiga exempelmeningar som indata och instruerar modellen att referera till konkreta ord ur dem. Den är den bäst byggda av wizardarna. Två svagheter: (a) resultatet skrivs till `tone_rules` och inget annat — de riktiga exempelmeningarna kastas bort i stället för att sparas som `client_assets` av typen `post`, där de hade byggt röst-fingerprintet; (b) "ord du undviker" skrivs in i tonreglernas löptext och blir bara `forbidden_words` om `donts` råkar innehålla dem (`lib/voice-fingerprint.ts:98`).

### Målgrupps-wizarden (`app/dashboard/profil/page.tsx:612-619`)

Sex frågor, ordagrant:

1. "Bransch?" — platshållare: "t.ex. coaching, redovisning, bygg, frisör"
2. "Vad säljer du, kort?" — "t.ex. ledarskapsutbildning, takläggning, behandlingar"
3. "Vem köper mest idag?" — "ålder, kön, plats, yrke"
4. "Vem vill du gärna sälja MER till?" — "dröm-kunden"
5. "Prisklass?" — "t.ex. 1 000–10 000 kr"
6. "Något annat viktigt? (valfritt)" — "säsong, lokal kontext..."

Serverprompten (`app/api/profile/assist/route.ts:29-39`) ber om:

> `"primary": "3–5 stycken — namn på segment, demografi, geografi, smärtpunkter, köpbeteende, var de hänger, triggers som får dem att köpa. Skriv som prosa med korta rader."`
> `"pain_points": "5–7 punkter med streck (-) framför varje. Formulerade som kunden själv skulle säga det."`

**Bedömning: leder mot generiskt.** Frågorna efterfrågar kategorier ("bransch", "ålder, kön"), inte händelser. Ingen fråga ber om ett faktiskt kundnamn, ett faktiskt samtal eller en siffra ur verksamheten. Modellen får tunna kategorisvar och fyller ut till "3–5 stycken prosa" — den producerar alltså mer text än den har underlag för, och den texten hamnar i `icp_primary` som sedan går rakt in i varje prompt. Det är den mest direkta generiskhetsmotorn i systemet: den *skapar* utfyllnad och mätaren *belönar* den (`icp_primary` ≥ 50 tecken).

### Kundernas egna ord (`app/dashboard/profil/page.tsx:477-518`)

Ledtext ordagrant:

> "Klistra in 3–10 verkliga citat från dina kunder (recensioner, mejl, chatt, samtalsanteckningar). Skrivhjälpen plockar ut exakta fraser, vad de oroar sig för och hur de uttrycker sig, och väver in det i dina tonregler."

Platshållare:

> `"Jag var helt slut innan jag kom hit..."` / `"Det skulle ta evigheter att fixa själv..."` / `Recensioner / mejl / DM hit`

Serverprompten (`app/api/profile/assist/route.ts:69-79`) ber om `common_phrases`, `pain_words`, `joy_words`, `objections`, `tone_patterns` och `summary_for_brand`.

**Bedömning: leder mot konkret indata men förstör den på vägen ut.** Frågan är rätt ställd. Men resultatet skrivs som **löpande sammanfattningstext appendad till `tone_rules`** (`app/dashboard/profil/page.tsx:463-468`) — inte som rader i `customer_voice`, inte som `pain_words`/`joy_words` i `client_voice_profile`. De exakta kundcitaten, som är det enda materialet SANNINGSKRAVET tillåter modellen att bygga kundberättelser på, sparas alltså aldrig som citat. Det förklarar varför tre av fyra skarpa profiler har noll `customer_voice`-poster trots att flödet finns.

### Intake-agenten (`app/api/intake/analyze/route.ts`)

Har inga egna frågor — den läser ett transkript. Reglerna (rad 111-119), ordagrant i urval:

> "Citera ALLTID exakt fras från transkriptet i evidence-fältet (max 200 tecken)"
> "Customer Voice-fraser ska vara EXAKTA citat från kunden/intervjuofret, INTE klientens egna ord"
> "Post-idéer: bara om transkriptet innehåller en KONKRET story/scen som direkt blir en LinkedIn-post (inkl konkreta namn, siffror, vändpunkt)."

**Bedömning: leder mot konkret, och är det enda flödet som gör det fullt ut.** Det är också enda vägen in till story-bank och `customer_voice`. Priset är att det kräver ett befintligt transkript — det ställer inga frågor själv och kan inte starta från ingenting.

### Ikigai-flödet (`lib/ikigai-questions.ts`, `lib/ikigai.ts:99-105`)

Fyra frågor med utförliga exempel, till exempel:

> "Vad världen behöver" — "Problem du ser hos andra — frågor folk ställer, sånt de kämpar med eller redan betalar någon för att lösa. Tänk på en konkret grupp människor."
> Exempel: "Många soloföretagare är duktiga på sitt hantverk men saknar ett system för att få kunder — det blir ryckigt och stressigt."

Flödet får skriva till brand-profilen via `brand_proposals` (`lib/ikigai.ts:99`) med `action="update"` för identitetsfälten.

**Bedömning: leder mot konkret för individen, men är farligt för tenanten.** Se HM Motor-fyndet i 0.5 — exempelmeningen ovan återfinns nästan ordagrant i HM Motors skarpa `icp_primary`, och `customer_voice`-radernas `context` är bokstavligen `[Vad världen behöver]`, alltså Ikigai-kvadrantens etikett.

### Brand-kit-agenten (`app/api/brand-kit/agent/route.ts:29-46`)

Ställer inga frågor — läser klientens webbplats plus profilen och föreslår grafisk profil. Enda textbärande utdata är `donts` (max 4), som når textprompten via `lib/studio/kit.ts:118`. Instruktionen är strikt: "Föreslå bara det profilen stödjer." Inget att anmärka.

### Setup-agenten (`app/api/setup/chat/route.ts`)

Admin-verktyg för dig, inte ett intagsflöde för kund. Dess checklista (rad 47-52) definierar "levande klient" som brand-profil + fingerprint + 3-5 winning examples per kanal + pixel + pelare. Den kunskapen finns alltså redan i systemprompten — men det är också där som subcategory-antagandet står skrivet ("subcategory ('linkedin', 'email', 'saljbrev')"), utan att någon UI-yta faktiskt sätter fältet (F3).

---

## 0.5 Profilinnehållet i verkligheten

Läst READ ONLY via Supabase REST med service-role. Procenttalet är beräknat med koden ur 0.2.

| | Displayteknik | Engens Träd | HM Motor | Annas Blommor |
|---|---|---|---|---|
| **Dagens procenttal** | **89 %** | **61 %** | **27 %** | **55 %** |
| Röst / Målgrupp / Auktoritet / Bevis / Erbjudande | 80/100/100/67/100 | 80/75/100/0/50 | 0/50/33/0/50 | 60/50/67/0/100 |
| Tecken i fält som **når** prompten | 9 507 | 3 295 | 685 | 807 |
| Tecken i fält som **aldrig når** prompten | 3 084 | 1 198 | 213 | 113 |
| Konkreta siffror i innehållsfälten | 63 | 9 | 1 | 4 |
| — därav i `pricing_notes` (når aldrig prompten) | 17 | 4 | 0 | 0 |
| Kundberättelser i story-bank | 0 | 0 | 1 (attrapp) | 0 |
| `customer_voice`-poster | 0 | 0 | 2 | 0 |
| GÖR-punkter | 8 | 6 | 0 | 1 |
| GÖR INTE-punkter | 9 | 5 | 0 | 1 |
| Råmaterial i kunskapsbanken (exkl. winning + rapporter) | 7 | 1 | 1 | 0 |
| — varav vittnesmål / foton / ljud / video | 3 / 0 / 0 / 1 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 |
| `winning_example` i databasen | 0 | 14 | 0 | 0 |
| — varav som **når prompten** (F2) | 0 | **0** | 0 | 0 |
| Röst-fingerprint: signaturfraser / förbjudna ord / källor | 8 / 18 / 3 | 8 / 21 / 14 | 5 / 5 / 1 | 0 / 3 / 0 |
| Grafisk profil: nycklar i `kit` | 5 | 1 | 1 | 8 |

### Teckenmängd per sektion (fält som når prompten)

| Fält | Displayteknik | Engens | HM Motor | Annas |
|---|---|---|---|---|
| `brand_story` | 1 124 | 605 | — | 188 |
| `usp` | 494 | 505 | 291 | 106 |
| `tone_rules` | 1 668 | 862 | — | 85 |
| `icp_primary` | 919 | 264 | 244 | 66 |
| `icp_secondary` | 401 | 75 | — | 60 |
| `pain_points` | 617 | 247 | 88 | — |
| `customer_quotes` | 411 | — | — | — |
| `competitors` | 1 176 | — | — | — |
| `customer_journey` | 1 036 | — | — | — |
| `dos` / `donts` | 725 / 557 | 212 / 267 | — / — | 76 / 42 |
| `hashtags_base` | 141 | 108 | — | 72 |
| **Aldrig i prompten:** `differentiators` | 1 149 | 460 | — | — |
| **Aldrig i prompten:** `services` | 649 | 223 | 213 | 85 |
| **Aldrig i prompten:** `pricing_notes` | 1 262 | 515 | — | — |

### Gapet mellan procent och substans

- **Annas Blommor: 55 % på 807 tecken.** Noll råmaterial, noll berättelser, noll kundcitat, noll vittnesmål, noll signaturfraser i fingerprintet (`source_asset_count = 0`, vilket triggar varningen i `lib/voice-fingerprint.ts:247-252`). Dimensionen "Erbjudande" står på 100 % för att `services` är 85 tecken och `booking_url` är en giltig URL. Profilen är en skiss och mätaren säger drygt halvvägs.
- **Engens Träd: 61 %, men 14 godkända vinnande exempel som ingen text får se.** Här är gapet omvänt — den enda klienten med ett riktigt bibliotek av vinnande exempel får inget värde av det (F2), och straffas dessutom i mätaren för avsaknad av foton och ljud. Engens är samtidigt profilen med starkast fingerprint (14 källor, 8 signaturfraser, 8 smärtord, 8 glädjeord).
- **Displayteknik: 89 % trots plattformens överlägset rikaste profil.** 63 verifierade siffror. De 17 mest användbara ligger i `pricing_notes` — riktiga, publika riktpriser som texterna aldrig får använda. Faller på "minst 5 egna inlägg" (har 3) och "minst 3 foton" (har 0). Har 3 vittnesmål och 1 video.
- **HM Motor: 27 %, och det är fel bransch.** Se nedan.

### HM Motor: branschfelet, konkret

Tenanten `00000000-0000-0000-0000-000000000001` heter "HM Motor Krokom" i `clients`. Kontaktuppgifterna i profilen är bilhandelns riktiga (Rydells väg 9d, 835 32 Krokom, 0640-62758, info@hmmotor.se). Allt innehåll är däremot en coachingverksamhet:

- `usp` (291 tecken): *"Till skillnad från rena teknikkonsulter som bara bygger system, eller affärscoacher som bara pratar strategi, kombinerar..."*
- `icp_primary` (244 tecken): *"Etablerade soloföretagare (t.ex. konsulter, coacher, experter) som har en fungerande verksamhet men saknar ett förutsägb..."*
- `services` (213 tecken): *"Kundflöde & Klarhet (6-veckors program): En kombinerad implementation- och coachingtjänst där vi bygger ditt automatiser..."*
- `pain_points` (88 tecken): *"Har testat olika system och verktyg men inget 'fastnar' som en naturlig del av vardagen."*

**Källan är identifierad.** De två `customer_voice`-raderna har `context = "[Vad världen behöver]"` — det är etiketten på Ikigai-kvadrant 3 (`lib/ikigai-questions.ts`, `key: "need"`). Story-bank-raden har `hook = "hook"` och `notes = "Från intake: [Content Hook 1]"` — platshållartext, inte innehåll. Profilen är alltså resultatet av en Ikigai-körning (troligen ett test av din egen coachingverksamhet) som committades mot standardtenanten via `app/api/intake/commit/route.ts`, där `action="update"` skriver över identitetsfälten rakt av (rad 81).

Två strukturella lärdomar, oberoende av just den här klienten:

1. **Intake-commit har ingen branschkontroll.** Den skriver över `usp`, `icp_primary`, `services` utan att jämföra mot `clients.industry` eller mot befintligt innehåll.
2. **Ingen mätning i systemet skulle ha upptäckt felet.** Kvalitetsmätaren gav 27 % — det låter som "tunn profil", inte som "fel bransch". En profil kan vara 100 % komplett och samtidigt handla om fel företag. Det är det starkaste argumentet för att kriterierna i 0.6 måste innehålla en *förankringskontroll*, inte bara en fyllnadskontroll.

---

## 0.6 Förslag på kvalitetskriterier — till ditt BESLUT

Inget av nedanstående är byggt. Varje kriterium är motiverat med vad mätningen faktiskt visade.

### Grundprincip att godkänna eller avvisa först

> **Ett fält räknas bara om det innehåller något som bara den här klienten kunde ha skrivit.**

Det är den enda regel som samtidigt fångar Annas 55 %-skiss, skräpprofilens 100 % och HM Motors branschfel. Allt nedan är operationaliseringar av den meningen.

### K1 — Berättelse (story-bank, `brand_story`, `customer_journey`)

**Kriterium:** posten räknas om den är ≥ 200 tecken **OCH** innehåller minst ett av: en siffra med enhet (kr, år, %, antal, mått), ett egennamn (versal mitt i mening som inte är klientens eget företagsnamn), eller ett datum/tidsuttryck ("i mars", "förra vintern").

**Motivering:** T-6b-skärpningen i `lib/prompt-core.ts:154-162` finns just för att modellen hittade på minnen. Skärpningen kan bara fungera om det finns äkta minnen att peka på. Mätningen visar noll story-bank-poster hos tre av fyra profiler och en attrapp hos den fjärde — SANNINGSKRAVET har alltså i praktiken tvingat samtliga texter till generella observationer. Det är precis den utbytbarhet TEXT1-RESULTAT beskriver.

**Minimikrav för nivå:** minst 3 berättelser som klarar kriteriet.

### K2 — Kundens röst (`customer_voice`, `customer_quotes`)

**Kriterium:** varje post ska vara ett **citat** — antingen inom citattecken eller en rad i första person med talspråksmarkör. Den ska ha en `category` (pain/desire/objection/transformation/catchphrase) och en `context` som inte är en kvadrantetikett. Fältet `customer_quotes` räknas bara om det innehåller minst 2 citattecken-par eller minst 3 rader som var för sig är ≥ 40 tecken.

**Motivering:** Displayteknik är enda klienten med `customer_quotes` ifyllt (411 tecken, i formen `Media 2011: "..."`) och den enda vars röst-träff låg högt i förmätningen. Tre av fyra har noll `customer_voice`-poster trots att flödet finns — därför att VoC-extraktorn skriver sammanfattning i stället för citat (0.4). Citatformen är också det enda som gör klientens ordförråd återanvändbart ordagrant, vilket är hela poängen med Customer Voice-blocket i `lib/knowledge.ts:115`.

**Minimikrav:** minst 5 citat, fördelade på minst 2 kategorier.

### K3 — GÖR INTE (`donts`)

**Kriterium:** minst 5 rader, var och en ≥ 15 tecken, och minst 3 av dem ska vara **klientspecifika** — alltså inte återfinnas i plattformens fasta floskellista (`lib/content/writing-rules.ts:101-114`).

**Motivering:** `donts` blir `forbidden_words` i röst-fingerprintet (`lib/voice-fingerprint.ts:98`) och lyftes i T-5 till ett eget hårt block sist i prompten (`lib/prompt-core.ts:398-404`) — det är alltså ett av de tyngst vägande lagren i hela systemet. Engens `donts` innehåller ordagrant plattformens egen floskellista ("kraftfull", "banbrytande", "game-changer"...) — den dubbleras alltså i stället för att tillföra något. HM Motor har inga alls. Kravet på klientspecifika förbud är det som skiljer ett fungerande röstfilter från en kopia av plattformsregeln.

### K4 — Verifierade siffror

**Kriterium:** profilen räknas som "sifferbelagd" när minst 5 distinkta siffror med enhet finns i fält som **når prompten**. `pricing_notes` och `differentiators` måste alltså in i lager 3 innan detta kriterium blir meningsfullt (F1).

**Motivering:** siffergrinden i `lib/studio/copy.ts:95` och sanningskravet gör att modellen bara får använda tal som *exakt* står i profilen. Displayteknik har 63 siffror men 17 av de mest säljande ligger i ett fält som prompten inte ser. Det här kriteriet mäter alltså inte bara profilen — det tvingar fram fixen av F1.

### K5 — Vinnande exempel

**Kriterium:** minst 3 exempel **som faktiskt matchar den kanal texten skrivs för** (`subcategory` satt), var och en ≥ 200 tecken.

**Motivering:** F2 och F3. Att räkna `winning_example` utan att räkna `subcategory` skulle ge Engens grönt ljus för ett lager som levererar noll. Kriteriet måste mäta det som når prompten, inte det som ligger i tabellen.

### K6 — Förankring (branschkontroll)

**Kriterium:** profilen flaggas om `usp`, `icp_primary` eller `services` saknar **varje** ord ur klientens bransch-/tjänstevokabulär (härledd ur `clients.industry` + `company_name` + `hashtags_base`), eller om `context`-fältet i `customer_voice` innehåller en flödesetikett i klamrar (`[...]`).

**Motivering:** HM Motor. Ingen fyllnadsmätning i världen hade fångat att en bilhandel beskrivs som coachingverksamhet. En förankringsflagga hade gjort det på en sekund — profilen innehåller inte ett enda ord om bil, verkstad, däck eller Krokom utanför adressfältet, och klamrarna i `context` avslöjar direkt vilket flöde som skrev.

### K7 — Generisk-detektor (diskvalificerar, sänker inte bara)

**Kriterium:** ett fält räknas **inte** om ≥ 50 % av dess meningar matchar tomfrasmönster. Förslag till startlista, byggd på skräpsimuleringen i 0.2 och därmed direkt testbar:

| Mönster | Exempel som fångas |
|---|---|
| `bäst|störst|snabbast|ledande` utan efterföljande belägg (siffra/egennamn/år) | "Vi är bäst i branschen på det vi gör" |
| `bra (kvalitet|service|priser|bemötande)` | "Kunder som vill ha bra kvalitet och bra service" |
| `hög (kvalitet|klass|standard)` utan mätetal | "Hög kvalitet i allt vi gör" |
| `personlig service`, `nöjda kunder`, `lång erfarenhet` utan årtal | "Lång erfarenhet och nöjda kunder" |
| `vi (bryr oss|finns här för dig|lyssnar)` som hel mening | "Vi bryr oss." |
| Mening utan substantiv som är unikt för branschen | "Vi gör det vi är bäst på för dig." |
| `alltid|aldrig` som ensamt kvalitetspåstående | "Vi levererar alltid i tid" |
| Meningar identiska (efter normalisering) med en annan post i samma fält | dubblettinlägg |

Plus återanvändning av det som redan finns: `harSvagHook` (`lib/content/writing-rules.ts:182`) fångar öppningar på "många/de flesta/alla/i dagens" — samma mönster är en utmärkt tomfrasindikator i profiltext.

**Motivering:** hela 0.2. Utan diskvalificering är varje teckentröskel en instruktion i hur man fuskar.

### K8 — Dubblettkontroll på råmaterial

**Kriterium:** `client_assets` av typen `post` räknas bara om texten är ≥ 150 tecken och har < 60 % jaccard-likhet mot varje annan räknad post. Återanvänd `jaccardSimilarity` (`lib/voice-score.ts:143`).

**Motivering:** skräpsimuleringen nådde 100 % med fem identiska inlägg. `countAssetsByType` (`lib/assets.ts:103-117`) räknar rader, inte innehåll.

### Förslag till viktning

Dagens oviktade medelvärde ger `booking_url` samma tyngd som hela berättelsen. Förslag, med de fyra tunga posterna först:

| Komponent | Vikt | Varför |
|---|---|---|
| Berättelser (K1) | 25 % | Enda källan sanningskravet accepterar för kundcase |
| Kundens röst (K2) | 20 % | Bär klientens ordförråd; röst-träffen sjönk mätbart när blocket klipptes |
| GÖR INTE (K3) | 15 % | Väger tyngst i prompten (eget hårt block sist) |
| Verifierade siffror (K4) | 15 % | Enda vägen till konkretion under sanningskravet |
| Vinnande exempel (K5) | 10 % | Starkast röstimitation när det fungerar |
| Egen röst: tonregler + råmaterial + fingerprintkällor | 10 % | Lager 4 |
| Grundfakta: företag, plats, tjänster, CTA-väg | 5 % | Nödvändigt men inte särskiljande |
| Förankring (K6) | Grind, ej poäng | En profil om fel bransch ska aldrig kunna få en hög siffra |

Förankringsflaggan bör kapa taket, inte dra poäng: flaggad profil kan inte nå över nivå 2 oavsett övrig ifyllnad.

### Förslag till nivånamn — välj en uppsättning

Krav du satt: ärliga, inte smickrande. Fem alternativa uppsättningar, fyra eller fem steg:

**A. Vad texterna faktiskt blir** (min rekommendation — beskriver konsekvensen, inte kunden)
1. Tom — texterna blir gissningar
2. Skiss — texterna blir korrekta men utbytbara
3. Grund — texterna låter som branschen, inte som du
4. Egen röst — texterna går att känna igen
5. Belagd — texterna kan använda dina siffror och dina kunders ord

**B. Kort och rakt**
1. Tom · 2. Tunn · 3. Grund · 4. Egen röst · 5. Belagd

**C. Vad som saknas**
1. Inget underlag · 2. Bara påståenden · 3. Påståenden och regler · 4. Regler och röst · 5. Röst och bevis

**D. Fyra steg**
1. Otillräcklig · 2. Generisk · 3. Igenkännbar · 4. Belagd

**E. Arbetsläge**
1. Inte påbörjad · 2. Påbörjad · 3. Halvvägs · 4. Användbar · 5. Fullständig
*(Nämns för fullständighets skull — den här är svagast, den beskriver arbetet i stället för resultatet och riskerar samma smickerproblem som procenttalet.)*

Oavsett uppsättning: **nivån ska visas i stället för procenttalet, inte bredvid det.** Ett procenttal kan alltid tolkas som "89 % klart". En nivå som säger "texterna låter som branschen, inte som du" kan det inte.

### Vad kriterierna hade gett de fyra skarpa profilerna

Grov indikation med förslagen ovan (uppsättning A), som beslutsunderlag — inte en färdig beräkning:

| Profil | Idag | Med K1-K8 |
|---|---|---|
| Displayteknik | 89 % | Nivå 3-4 (stark text och siffror, men noll berättelser och noll vinnande exempel som når prompten) |
| Engens Träd | 61 % | Nivå 3 (starkast fingerprint av alla, men noll citat, noll berättelser, exempel som inte når fram) |
| Annas Blommor | 55 % | Nivå 1-2 |
| HM Motor | 27 % | Nivå 1 + förankringsflagga |

---

## Parkerat

Idéer som dök upp under granskningen. Inget av detta byggs nu.

- **WIZARD-1 — målgrupps-wizarden leder mot generiskt.** Sex kategorifrågor ger sex kategorisvar som modellen fyller ut till "3–5 stycken prosa". Utfyllnaden hamnar i `icp_primary` och går in i varje prompt. Skulle behöva frågor som tvingar fram händelser i stället för kategorier ("Beskriv den senaste kunden som ringde — vad sa hen först?"). Föreslår inget bygge nu; det är en egen beställning.
- **WIZARD-2 — VoC-extraktorn kastar citaten.** Resultatet appendas som prosa till `tone_rules` i stället för att skrivas som rader i `customer_voice` och som `pain_words`/`joy_words`. Enkel omkoppling med stor effekt, men den ändrar datamodellens flöde och hör hemma i ett eget beslut.
- **WIZARD-3 — Ton-wizardens exempelmeningar sparas inte.** De 2-5 meningar kunden klistrar in är exakt det material `rebuildVoiceFingerprint` vill ha, men de kastas efter analysen.
- **PROFIL-F1 — koppla in `differentiators`, `services`, `pricing_notes` och CTA-formuleringar i lager 3.** Största enskilda kvalitetsvinsten i hela granskningen, och en förutsättning för K4. Kräver eget beslut om sektionsordning och klippprioritet i `KLIPPORDNING`.
- **PROFIL-F2 — sätt `subcategory` på befintliga winning_example.** 15 rader plattformsbrett. Kräver beslut om vem som sätter värdet (backfill, UI eller automatiskt ur `asset_type`).
- **PROFIL-F5 — `target_audience` i onboard-status.** Enradsfix, men den är i en annan modul och rör setup-agenten.
- **Fyra konkurrerande kompletthetsdefinitioner.** `/api/profile/quality`, `/k/page.tsx:68`, `/api/setup/onboard-status` och KnowledgeBanks `minRecommended`. Bör bli en.
- **Ingen redigeringsyta för story-bank och Customer Voice.** Kunden kan inte skriva in en kundberättelse utan att gå via ett transkript.
- **Intake-commit saknar branschkontroll och skriver över identitetsfält rakt av.** HM Motors rotorsak.
- **`hashtags_base` som arraylitteral.** Engens värde går in i prompten med klammer och kommatecken.

---

## Rekommendation

1. **Godkänn eller ändra grundprincipen först** ("ett fält räknas bara om det innehåller något som bara den här klienten kunde ha skrivit"). Allt annat hänger på den.
2. **Bygg inte om mätaren innan F1 är löst.** Ett kriterium som mäter siffror i profilen är meningslöst så länge de mest sifferrika fälten inte når prompten. Ordningen bör vara: F1 och F2 (koppla in det som redan finns) → sedan kriterierna → sedan nivåerna.
3. **Ta bort procenttalet när nivåerna införs.** Två mått bredvid varandra betyder att det generösare vinner.
4. **Välj nivåuppsättning.** Rekommendation: A.

Öppen fråga jag inte kunnat besvara från koden: ska förankringsflaggan (K6) blockera generering helt för en klient, eller bara kapa nivån och varna? Om du inte vet — förslaget är att kapa nivån och varna i v1, och först i v2 införa blockering, eftersom en felaktig flagga annars stoppar en fungerande klient.
