# SEO-1 / S-0 — kartläggning av SEO/AEO-verktygets hämtningskedja

**Datum:** 2026-08-02 · **Typ:** READ-ONLY kartläggning. Ingen kod ändrad, inga commits, inga DB-skrivningar.
**Verifieringsunderlag:** koden i `hmmotor-next`, live-anrop mot `forbalance.se` med curl/node, samt den
faktiskt lagrade kundrapporten (`client_assets.id = ade4ee75-69ac-43c8-b691-98ff58597b06`, läst read-only).

---

## Sammanfattning i en mening

Verktyget har **ingen enda kontroll av att en hämtning lyckades** — varken statuskod, kroppsstorlek eller
"fick jag HTML alls" — och matar därför nollor rakt in i en AI-prompt som är instruerad att lita på dem som
uppmätta fakta. Två separata defekter sammanföll i for-balance-körningen: (1) sitemapindexet följs inte, vilket
gav "2 sidor", och (2) startsidans hämtning gav en tom kropp som tolkades som "tom sida".

**⚠ Rättelse av arbetshypotesen:** UA-blockeringen på forbalance.se träffar **inte** verktygets egen
user-agent. Se avsnitt 8 — den blockeringen är ett riktigt problem, men den är inte det som fällde
for-balance-rapporten. Skillnaden spelar roll för vilken fix som behövs.

---

## 1. Alla kodvägar som hämtar en extern URL

### 1a. Sidhämtaren (den som ger allt innehåll)

| | |
|---|---|
| **Fil:rad** | `lib/seo-deep.ts:266-270` — `extractPageSignals()` |
| **HTTP-klient** | global `fetch` (Node/undici) |
| **User-Agent** | `Cockpit-SEO-DeepAudit/2.0` (rad 268) |
| **Timeout** | 20 000 ms (rad 269) |
| **Följer redirects** | Ja — `redirect` är inte satt, undici default = `"follow"` |
| **Kontrollerar statuskod** | **NEJ.** `res.ok` läses aldrig. Rad 271 gör `await res.text()` oavsett 200/403/404/500. |
| **Kontrollerar kroppsstorlek** | **NEJ.** Ingen minimigräns, ingen kontroll av `content-type`. |
| **Konsekvens** | En 403-sida, en tom kropp eller en JSON-felsida parsas som om den vore sidans HTML. |

Detta är motorn under **alla** sidmätningar: `crawlSite` (rad 489, 522), `auditUrlRendered`
(`lib/seo-audit.ts:115`), `/api/seo/report` (rad 81), `/api/seo/content-audit` (rad 32),
`/api/seo/page-text` (rad 32).

### 1b. robots.txt + sitemap-status

`lib/seo-deep.ts:108-137` — `fetchRobotsAndSitemap()`

* robots.txt: `fetch(origin + "/robots.txt")` rad 114. **Ingen UA sätts** → undici skickar
  `user-agent: node` (verifierat lokalt mot en egen HTTP-server). Timeout 8 000 ms. `r.ok` **kontrolleras**
  (rad 115) → vid ej-ok sätts `found:false`.
* sitemap: `fetch(smUrl)` rad 126, ingen UA, timeout 8 000 ms, `s.ok` kontrolleras (rad 127).
  Räknar bara `<loc>`-förekomster (rad 129) — se avsnitt 3.
* Hela funktionen är inbäddad i `try/catch` som sväljer allt tyst (rad 123, 134, 135).

### 1c. Sitemap → URL-lista för crawlen

`lib/seo-deep.ts:428-438` — `fetchSitemapUrls()`
Ingen UA (`user-agent: node`), timeout 10 000 ms, `r.ok` kontrolleras (rad 432).
Vid fel: tyst `catch` (rad 436) → tom lista, omöjligt att skilja från "sajten har ingen sitemap".

### 1d. Domän-redirect-proben (www vs icke-www)

`lib/seo-deep.ts:442-461` — `detectDomainRedirect()`
`fetch(..., { redirect: "manual" })` rad 448. **Ingen UA** (`user-agent: node`), timeout 8 000 ms.
Läser bara `status` + `location`. Detta är **en annan HTTP-identitet än sidhämtaren** — se avsnitt 8.

### 1e. Lighthouse / PageSpeed

`lib/seo-deep.ts:161-206` — `fetchLighthouse()`, och `lib/seo-audit.ts:153-173` — `pageSpeed()`.
Går via `anropaProvider` (`lib/ai-usage.ts:357`), timeout 45 000 ms. Se avsnitt 6.

### 1f. Äldre, rå-HTML-auditen (används fortfarande av konkurrentanalysen)

`lib/seo-audit.ts:28-40` — `auditUrl()`
UA `HM-Motor-SEO-Auditor/1.0` (rad 32). **Ingen timeout alls.** `res.ok` **kontrolleras** (rad 33) —
men bara som en `issue`-rad; rad 36 läser och poängsätter felsidans kropp ändå.
Anropas från `app/api/competitors/analyze/route.ts:49`.

### 1g. Konkurrent-hämtaren

`app/api/competitors/analyze/route.ts:40` — UA `Mozilla/5.0 HM-Cockpit-Intel/1.0`, timeout 20 000 ms,
`res.ok` kontrolleras inte i den anropande koden.

### 1h. Sidmatchningens sitemap-läsare

`lib/page-match.ts:18-31` — `fetchSitemapPages()`
UA `Mozilla/5.0` (rad 22), timeout 6 000 ms, `res.ok` kontrolleras (rad 25).
Samma `<loc>`-naivitet som 1c.

### 1i. Google Search Console (extern, men inte klientens sajt)

`lib/google.ts:151`, `:173`, `:220` — googleapis webmasters v3, OAuth-token. Ingår inte i crawl-problemet,
men är den enda källan till trafikdata i rapporten (`gsc_rows: 0` för For Balance).

### Sammanställning: fem olika identiteter i samma produkt

| UA-sträng | Var | Vad den hämtar |
|---|---|---|
| `Cockpit-SEO-DeepAudit/2.0` | `lib/seo-deep.ts:268` | **sidorna** (all innehållsmätning) |
| `node` (undici default) | `lib/seo-deep.ts:114, 126, 431, 448` | robots.txt, sitemap, redirect-prob |
| `HM-Motor-SEO-Auditor/1.0` | `lib/seo-audit.ts:32` | rå-HTML-audit (konkurrenter) |
| `Mozilla/5.0` | `lib/page-match.ts:22` | sitemap för sidmatchning |
| `Mozilla/5.0 HM-Cockpit-Intel/1.0` | `app/api/competitors/analyze/route.ts:40` | konkurrentsidor |

---

## 2. Datamodellen — kan den skilja på 0 och okänt?

**Nej. Ingenstans i kedjan.**

### 2a. `PageSignals` (`lib/seo-deep.ts:14-44`)

Typen har ingen plats för "kunde inte läsa". Fält som **alltid** får ett giltigt-utseende värde även när
kroppen var tom eller ett felsvar:

| Fält | Rad (beräkning) | Värde vid misslyckad hämtning | Kan skilja 0/okänt? |
|---|---|---|---|
| `wordCount` | 319-320 | `0` | Nej |
| `paragraphCount` | 321 | `0` | Nej |
| `listCount` | 322 | `0` | Nej |
| `images.total` / `images.withoutAlt` | 324-325, 369 | `0` / `0` | Nej |
| `links.internal` / `links.external` | 327-335, 370 | `0` / `0` | Nej |
| `headings` | 311-317 | `[]` | Nej |
| `emptyHeadings` | 313-317 | `0` | Nej |
| `schemaTypes` | 300-308 | `[]` | Nej |
| `faqs` | 301-308 | `[]` | Nej |
| `ogTags` | 295-298 | `{}` | Nej |
| `title` / `metaDescription` / `canonical` / `lang` / `robots` | 279-293 | `null` | Nej — `null` betyder både "saknas på sidan" och "ingen sida lästes" |
| `titleLength` / `metaLength` | 354, 357 | `0` | Nej |
| `canonicalSource` | 286-290 | `"none"` | Nej — saknar `"unknown"` |
| `hasUpdatedDate` | 337 | `false` | Nej |
| `platform` | 95-106 | `"okänd"` | Delvis (enda fältet med ett ärligt "okänd") |
| `mainText` | 379 | `""` | Nej |
| `lighthouseSeo` / `lighthouseAudits` / `cwv` | 176, 203 | `null` | `null` = både "inte kört" och "anropet föll" |
| `renderNote` | 346-349 | alltid "Signaler lästa från levererad HTML" | **Aktivt vilseledande** vid tom kropp |

Det finns **inget `httpStatus`-, `bytes`- eller `ok`-fält** i `PageSignals`. Informationen kastas i rad 271.

### 2b. `SitePageSummary` (`lib/seo-deep.ts:384-402`) och `SiteAudit` (`403-426`)

Samma sak, ett lager upp. `pageCount` (rad 538) räknar *hämtningsförsök som returnerade något*, inte
*sidor som faktiskt lästes*. `crossPage.thinPages` (553), `pagesMissingH1` (554), `totalImagesNoAlt` (556),
`avgInternalLinks` (557) aggregerar nollorna vidare utan att veta att de är påhittade.

`crawlSite` sväljer dessutom fel på två ställen: rad 489 (`.catch(() => null)` för startsidan) och rad 522
(`.catch(() => null)` per sida). En sida som kastar försvinner **spårlöst** ur listan — `pageCount` blir
bara mindre, ingen flagga någonstans.

### 2c. `scoreSignals` (`lib/seo-deep.ts:220-264`)

Gör nollorna till ett betyg: `-15` för saknad title (234), `-12` meta (236), `-10` H1 (238), `-8` canonical
(241), `-10` för `wordCount < 300` (243). En sida som aldrig lästes får alltså ett **lågt men trovärdigt
tal**, inte ett fel. `indexerbar` (rad 229) blir dessutom `true` för ett tomt dokument — ingen `noindex`
hittades, alltså "ok".

### 2d. Lagring

* **`hm_seo_audits`** (skrivs i `app/api/seo/audit/route.ts:35-54`). Schema läst live via PostgREST:
  alla mätkolumner (`word_count`, `internal_links`, `images_total`, `images_no_alt`, `seo_score`,
  `aeo_score`, …) är `integer` **utan default** — de *kan* alltså hålla `NULL`. Men applikationen skriver
  aldrig `NULL`: `extractPageSignals` ger alltid ett tal, och `emptyResult` (`lib/seo-audit.ts:143-150`)
  skriver explicit `0` på allt. **Databasen skulle klara "okänt" — koden producerar det aldrig.**
  Ingen kolumn för HTTP-status eller hämtningshälsa finns.
* **`client_assets`** (djupgranskningen, `lib/deep-audit-generate.ts:315-328`). `body` = markdown,
  `metadata` = `{ url, batch_id, started_at, gsc_rows, generated_at }`. **Ingen crawl-hälsa sparas** —
  det går inte i efterhand att se vad hämtningen faktiskt gav.

---

## 3. Sitemap — läses den, och följs ett sitemapindex?

**Läses på tre ställen, parsas naivt på alla tre, och ett sitemapindex följs aldrig.**

1. `lib/seo-deep.ts:124-133` (`fetchRobotsAndSitemap`) — hämtar `robots.txt`-deklarerad sitemap eller
   `/sitemap.xml`, räknar `<loc>`-taggar (rad 129) → `sitemap.urlCount`. Ingen URL-lista.
   **Detta fält når aldrig djupgranskningen:** `crawlSite` rad 486 destrukturerar bara `{ robotsTxt }`
   och kastar `sitemap`.
2. `lib/seo-deep.ts:428-438` (`fetchSitemapUrls`) — hämtar **enbart** `${origin}/sitemap.xml`, plockar
   alla `<loc>` med regex (rad 434). Kollar **inte** rotelementet. `<sitemapindex>` och `<urlset>`
   behandlas identiskt.
3. `lib/page-match.ts:18-31` — samma mönster.

Ingen av dem hanterar `.gz`-sitemaps, `robots.txt`-deklarerade alternativa sökvägar i väg 2/3, eller
flera sitemaps.

### Vad "deklarerad" betyder i rapporten

`robotsTxt.sitemapDeclared` (rad 117) är bara första `Sitemap:`-raden i robots.txt — den hämtas aldrig
för att bekräftas i väg 2. Rapporten skrev därför "| Sitemap | ✅ | Deklarerad i robots.txt |"
(rad 26 i kundrapporten), vilket är sant och samtidigt intetsägande.

---

## 4. URL-listan för crawlen — och varifrån "2 sidor" kom

Byggs i `lib/seo-deep.ts:492-498`:

```
for (const raw of [primaryRoot, ...sitemapUrls]) { normalisera, deduplicera }
const urls = list.slice(0, maxPages);   // maxPages = 25 från deep-audit-generate.ts:217
```

`primaryRoot` (rad 470) kommer från `detectDomainRedirect`, inte från sitemap. `sitemapUrls` kommer
enbart från `fetchSitemapUrls`. Det finns **ingen länk-crawl** — hittas inget i sitemap.xml granskas
bara startsidan.

### Reproducerat svar på "varifrån kom 2 sidor?"

`https://forbalance.se/sitemap.xml` är ett **sitemapindex med exakt en `<loc>`**:
`https://forbalance.se/sitemap_pages.xml`. Den riktiga sidlistan (13 URL:er) ligger i barnfilen.

Körning av samma logik i dag (read-only reproduktion, `Cockpit-SEO-DeepAudit/2.0`):

```
sitemap.xml status: 200 | locs funna: 1 ["https://forbalance.se/sitemap_pages.xml"]
URL-lista som crawlas (maxPages 25): 2
 ["https://forbalance.se/", "https://forbalance.se/sitemap_pages.xml"]
```

**Ja — `sitemap_pages.xml` räknas som en sida.** Den hämtas av `extractPageSignals` som vilken sida som
helst och sammanfattas av `toSummary` (rad 501-512): `title: null`, `h1: null`, `canonical: null`,
`imagesTotal: 0`, `internalLinks: 0`, `wordCount: 52`. Ingenting i koden ser att det är XML.

**Bevis att detta nådde kunden:** kundrapporten rad 189 —
"*Sitemap_pages.xml är indexerbar (robots tillåter) men bör uteslutas från indexering*".
Modellen tog alltså sitemap-filen för en av sajtens två sidor och skrev en åtgärdspunkt om den.

---

## 5. robots.txt — tolkas den, och reagerar verktyget på AI-blockering?

Tolkning sker på exakt två rader, `lib/seo-deep.ts:117-118`:

```ts
const sm = first(t, /sitemap:\s*(\S+)/i) || null;
const blocksEverything = /user-agent:\s*\*[\s\S]*?disallow:\s*\/\s*$/im.test(t);
```

Det är hela tolkningen. Resultatet används på **ett** ställe: `scoreSignals` rad 228-230
(`blocked` → `indexerbar = false` → poängtak 25). `sitemapDeclared` används i 3.1. Resten av filens
innehåll kastas.

**Svar på frågan: verktyget kollar bara att den egna crawlen får gå in.** Det finns ingen kod som läser
namngivna user-agents, ingen lista över AI-crawlers, ingen kontroll av `Disallow` per agent.

### Vad det kostade i for-balance-fallet

`forbalance.se/robots.txt` (verifierat live) blockerar **46 namngivna AI-agenter** med `Disallow: /` —
bland dem `GPTBot`, `ClaudeBot`, `anthropic-ai`, `Claude-Web`, `CCBot`, `Google-Extended`, `Bytespider`,
`Diffbot`, `PerplexityBot`-släktingar och det fristående ordet `Spider`. Sist i filen ligger
`User-agent: *` / `Allow: /`.

Regexen matchar inte, eftersom det enda `Disallow: /` står **före** `User-agent: *`.
`blocksEverything` blev alltså `false` → rapporten skrev
"| robots.txt | ✅ | Finns och blockerar inte sajten |" (kundrapport rad 25).

**Det är en inversion av sanningen i just det verktyg som säljs som AEO/GEO-analys:** sajten förbjuder
uttryckligen varje AI-motor att läsa den, och AEO-rapporten gav robots.txt grönt ljus.

Regexen är dessutom instabil åt andra hållet: `[\s\S]*?` är icke-girig och binder inte till ett
user-agent-block. Ligger AI-blocket **efter** `User-agent: *` matchar den, och sajten flaggas felaktigt
som helt blockerad.

---

## 6. Lighthouse / PageSpeed — vad händer när anropet misslyckas?

**Anropas från:**
* `lib/seo-deep.ts:161-206` `fetchLighthouse()` — via `extractPageSignals` rad 343.
  Körs bara på startsidan i en crawl (`skipLighthouse: true` på övriga sidor, rad 522).
* `lib/seo-audit.ts:153-173` `pageSpeed()` — via `app/api/seo/audit/route.ts:29`.

Båda går genom `anropaProvider` (`lib/ai-usage.ts:357-417`), som **gör** rätt sak: den läser statuskoden,
klassar felet (`klassaFel`) och loggar händelsen med felklass.

**Men anroparen kastar informationen:**

```ts
// lib/seo-deep.ts:176
if (!svar.ok) return { seo: null, cwv: null, audits: null };
// lib/seo-deep.ts:203-205
} catch { return { seo: null, cwv: null, audits: null }; }
```

`svar.fel`, `svar.status` och `svar.felklass` läses aldrig. Nyckel saknas, kvot slut, budgetspärr, 400 på
en URL PSI inte når, eller 45-sekunderstimeout ger **samma `null`**. Samma mönster i `pageSpeed`
(`lib/seo-audit.ts:165, 169`).

Nyckelvalet (`lib/seo-deep.ts:163`) faller tillbaka `PAGESPEED_API_KEY` → `GOOGLE_API_KEY` →
`GEMINI_API_KEY`. Saknas alla anropas PSI utan nyckel, vilket kvotas hårt — och även det syns som `null`.

Konsekvens i rapporten: `lighthouse_seo_renderad: null` går in i prompten (`app/api/seo/report/route.ts:117`,
`:228`) resp. i `SiteAudit.homepageLighthouseSeo` (`lib/seo-deep.ts:542`). Modellen kan bara skriva att
värdet saknas. Kundrapporten rad 190:
"*Lighthousescore för SEO saknas — kan inte bedöma laddningstid, mobilvänlighet eller teknisk prestanda | Medel*"
— utan orsak, eftersom orsaken aldrig lämnade `fetchLighthouse`.

---

## 7. Rapporttexten — var genereras den och exakt vad går in i prompten?

Två separata generatorer:

### 7a. Djupgranskningen (den som gick till For Balance)

**Fil:** `lib/deep-audit-generate.ts`. Modell `claude-sonnet-4-5` via Anthropic **Batch-API**
(rad 282-309, `max_tokens: 20000`). Systemprompt rad 8-178, användarprompt rad 233-273.
Finalisering i `lib/deep-audit-finalize.ts:12-86`.
Startas från `app/api/analytics/deep-audit/route.ts:17` (admin) och `app/api/seo/deep-audit/route.ts:59` (kund).

**Exakt vad som går in i prompten:**

| Block | Rad | Källa |
|---|---|---|
| `Namn`, `URL`, `Datum` | 236-238 | `clients.name`, `clients.public_url` / override |
| Brand-profil: `company_name`, `tagline`, `usp`, `icp_primary`, `services`, `tone_rules` | 241-246 | `hm_brand_profile` |
| Topp 25 sökord | 248-249 | `gsc_queries` (senaste `period_start`), tom → "Ingen GSC-data tillganglig." |
| Tidigare audits (url + poäng) | 251-252 | `hm_seo_audits`, senaste 3 |
| **`JSON.stringify(site)` — hela `SiteAudit`-objektet** | **257** | `crawlSite()` |
| Startsidans text | 262 | `site.homepageText` (`lib/seo-deep.ts:544`, `""` om startsidan inte lästes) |

Rad 257 är den avgörande: **hela crawl-resultatet serialiseras rakt in i prompten**, inklusive varje `0`
och varje `null`. Det finns ingen grind mellan `crawlSite` och modellen.

**Kan modellen påstå saker om nuläget som saknar täckning i mätdata? Ja — och den gjorde det.**

Systemprompten förbjuder påhitt av *siffror* (rad 148: "Hitta ALDRIG på siffror, priser, leveranstider,
specs, trafikvärden…") och kräver att uppmätta fält används exakt (rad 149). Men:

* Förbudet gäller siffror och tekniska fält, **inte verksamhetsfakta**. Prompten skickar aldrig
  klientens ort, adress eller kontaktuppgifter — `hm_brand_profile`-urvalet på rad 204 innehåller
  ingen adress.
* Resultat i den levererade kundrapporten: **"Göteborg" förekommer 8 gånger**, bland annat i en
  färdig title-tagg (rad 239), i brödtext "Jag tar emot i Göteborg" (rad 310) och i **två färdiga
  LocalBusiness-JSON-LD-block med `"addressLocality": "Göteborg"`** (rad 328, 385) — märkta
  "färdiga att klistra in". Gitte Östling har verksamhet på **Åkarhagsgatan 2, 723 37 Västerås**.
* Mallen (rad 94-101) kräver aktivt att modellen skriver ut *kompletta* texter utan luckor och tillåter
  bara `[DIN SIFFRA]` som platshållare — det finns ingen motsvarande platshållare för en okänd *ort*
  eller ett okänt *faktum*. Formatkravet pressar alltså fram ifyllnad.
* Instruktionen "Säg ALDRIG att något saknas om FAKTA inte belägger det" (rad 149) är verkningslös när
  FAKTA säger `wordCount: 0` — då *belägger* fakta att det saknas.

### 7b. Ensidesrapporten

**Fil:** `app/api/seo/report/route.ts`. Gemini via `generateJSON`. Faktablocket byggs rad 112-146
(`facts`-objektet: 35 fält, samtliga från `extractPageSignals` + GSC), systemprompt rad 148-198.

Här finns en ansats till ärlighet som djupgranskningen saknar — rad 152:
"*Är ett fält null men kunde inte verifieras → skriv "[EJ VERIFIERAT]"*". Men modellen får aldrig veta
**vilka** fält som inte kunde verifieras, eftersom `facts` inte innehåller någon hämtningsstatus.
Instruktionen är alltså omöjlig att följa.

Denna väg är den enda i hela kartläggningen som failar hörbart på nätverksfel:
`app/api/seo/report/route.ts:82-84` returnerar 502 om `extractPageSignals` kastar. Men den kastar
inte vid 403 eller tom kropp — bara vid nätverksfel/timeout.

---

## 8. Avvikelsen: "www-redirecten fungerar"

**Rapportens påstående var korrekt — men den kom fram till det med en annan klient än sidhämtaren.**

| Kodväg | UA | Utfall mot `www.forbalance.se` (verifierat) |
|---|---|---|
| `detectDomainRedirect` (`lib/seo-deep.ts:448`) | `node` (ingen UA sätts) | 301 → `https://forbalance.se/` |
| `extractPageSignals` (`lib/seo-deep.ts:268`) | `Cockpit-SEO-DeepAudit/2.0` | 301 (följs) → 200 |
| en blockerad bot | `GPTBot/1.0` | **403** |

Att de två kodvägarna använder olika identiteter är alltså **belagt i koden** (rad 448 sätter inga
headers, rad 268 sätter UA). Det är en riktig och farlig inkonsekvens: två delar av samma rapport kan
tala om två olika sajter. I just detta fall gav det inte fel svar.

### ⚠ Rättelse: UA-blockeringen träffar inte verktyget

Uppmätt i dag mot `https://forbalance.se/`:

| User-Agent | Status | Bytes |
|---|---|---|
| `Cockpit-SEO-DeepAudit/2.0` (**verktygets egen**) | **200** | 487 413 |
| `node` (undici default) | 200 | 487 413 |
| `HM-Motor-SEO-Auditor/1.0` | 200 | 487 413 |
| `Mozilla/5.0 (Windows NT 10.0) Chrome/126` | 200 | 487 413 |
| `GPTBot/1.0` | 403 | 150 |
| `Mozilla/5.0 (compatible; SEO-Spider/1.0)` | 403 | 150 |

Verktygets user-agent står inte på sajtens 46-listan och blockeras inte. Blockeringen av GPTBot/ClaudeBot
är ett verkligt AEO-problem för kunden (avsnitt 5) — men den är **inte** förklaringen till nollorna.

### Vad 403-svaret faktiskt hade gett

403-kroppen är openrestys standardsida:

```html
<html><head><title>403 Forbidden</title></head>
<body><center><h1>403 Forbidden</h1></center><hr><center>openresty</center></body></html>
```

Hade sidhämtaren fått den, skulle `extractPageSignals` ha rapporterat `title: "403 Forbidden"`,
`h1Count: 1`, `wordCount: 3`. Rapporten sa "Title-taggar ❌ Saknas på båda sidorna" och "0 ord".
**Det utesluter att en 403-sida parsades.** Mätvärdena motsvarar en **tom kropp**.

---

## Så uppstod for-balance-rapporten — kedjan steg för steg

Rapporten: `client_assets.id = ade4ee75-69ac-43c8-b691-98ff58597b06`, `status: active`,
startad 2026-08-02T18:07:52Z, klar 18:14:59Z, `metadata.gsc_rows: 0`, 55 646 tecken.

1. **Start.** `runDeepAudit(clientId)` → `crawlSite("https://forbalance.se", { maxPages: 25 })`
   (`lib/deep-audit-generate.ts:217`). `public_url` saknar avslutande slash.

2. **Domän-proben körs först** (`lib/seo-deep.ts:469`) med UA `node`. Får 301 från www → icke-www.
   `domainRedirect.redirectWorks = true`, `primaryHost = "forbalance.se"`. → Rapportens rad
   "Domänredirect ✅ 301-redirect fungerar". **Korrekt, men mätt med en annan klient än sidorna.**

3. **robots.txt hämtas** (rad 114, UA `node`, 200). Regexen på rad 118 letar `Disallow: /` **efter**
   `User-agent: *`; filen har den före → `blocksEverything = false`.
   De 46 blockerade AI-agenterna läses aldrig. → "robots.txt ✅ blockerar inte sajten" och
   "Indexerbarhet ✅" (`scoreSignals` rad 229).

4. **sitemap.xml hämtas** (rad 431, UA `node`, 200, 365 byte). Filen är ett `<sitemapindex>` med **en**
   `<loc>` → `sitemap_pages.xml`. Koden skiljer inte index från urlset (rad 434) och följer inte vidare.
   `sitemapUrls = ["https://forbalance.se/sitemap_pages.xml"]`. Sajtens 13 riktiga URL:er hämtas aldrig.

5. **URL-listan byggs** (rad 495-498): `[startsidan, sitemap_pages.xml]` → **2 poster**.
   → `pageCount: 2` → rapportens "hela sajten (2 sidor)".

6. **Startsidan hämtas** (rad 267-270). Statuskoden läses aldrig (defekt 1a). Vid körningen returnerade
   hämtningen en **tom kropp** — inte en 403-sida (bevis i avsnitt 8). Vad som gav tom kropp går inte att
   fastställa i efterhand: verktyget sparar varken status eller storlek (avsnitt 2d), och samma kod
   ger i dag 200 med 487 413 byte och 678 ord från en vanlig internetanslutning. **Att hämtningen gav
   tomt går alltså inte att reproducera härifrån — men koden kan inte upptäcka skillnaden oavsett orsak.**

7. **Tomt dokument mäts som en sida** (rad 279-337). Alla regexer bommar:
   `title: null`, `metaDescription: null`, `canonical: null`, `canonicalSource: "none"`,
   `headings: []`, `wordCount: 0`, `images: {0,0}`, `links: {0,0}`, `hasUpdatedDate: false`,
   `mainText: ""`. Rad 346-349 sätter ändå `renderNote: "Signaler lästa från levererad HTML."`

8. **Nollorna blir ett betyg** (`scoreSignals`, rad 220-264). Ingen `noindex` i ett tomt dokument →
   `indexerbar: true`. Sidan får ett lågt men helt normalt utseende poäng.

9. **Sitemap-filen mäts som sida två** (rad 522 → `toSummary`). `title: null`, `h1: null`,
   `canonical: null`, `imagesTotal: 0`, `internalLinks: 0`.
   → "Saknas på **båda** sidorna" i rapporten. → och rapportens åtgärdspunkt nr 1 i tekniktabellen
   handlar om att avindexera `sitemap_pages.xml`.

10. **Tvärsides-aggregaten summerar fantomer** (rad 547-558): `totalImagesNoAlt: 0`,
    `avgInternalLinks: 0`, `thinPages: [båda]`, `pagesMissingH1: [båda]`.
    → "Bilder med alt-text ✅ Inga bilder utan alt-text (0 bilder totalt)". Sajten har 75 bilder,
    samtliga utan alt-text. **Grönt ljus på den enda check som var ett riktigt fel.**

11. **Lighthouse föll** (rad 176 eller 203) → `homepageLighthouseSeo: null`, orsaken kastad.

12. **Allt serialiseras in i prompten** (`lib/deep-audit-generate.ts:257`) plus `homepageText: ""`
    (rad 262). Ingen grind, ingen tröskel, ingen hälsokontroll.

13. **Modellen gör sitt jobb — och det är problemet.** Systemprompten säger "använd EXAKT, hitta inte på"
    (rad 254, 149). Modellen lyder: den *beskriver nollorna troget* som en tom sajt, och fyller sedan
    mallens tvingande "Färdiga texter att klistra in"-krav (rad 94-101) med det som saknas i indata —
    däribland orten **Göteborg**, som aldrig fanns i något faktafält.

14. **Batchen finaliseras** (`lib/deep-audit-finalize.ts:52-81`). Enda kontrollen är
    `failed || !text` (rad 77). 55 646 tecken text → `status: "active"` → rapporten är publicerad för
    kunden i `/k/seo`.

### Kärnan

Systemet hade **fyra tillfällen** att vägra svara — statuskod (1a), kroppsstorlek (1a),
sitemap-rotelement (3), och en rimlighetsgrind före prompten (7a) — och tog inget av dem.
Samma felfamilj som Gemini-betalningsspärren: **ett välformulerat svar där det korrekta hade varit
att inte svara alls.**

---

## Minsta möjliga ändring per etapp (S-1..S-5) — förslag, inget byggt

**S-1 — Gör hämtningen ärlig.** (`lib/seo-deep.ts:266-271`)
Läs `res.status` och `raw.length`. Lägg `httpStatus` och `bytes` på `PageSignals`. Kasta ett typat
`SidaEjLast`-fel vid `!res.ok`, vid kropp under en tröskel, eller vid `content-type` som inte är HTML.
Låt `crawlSite` (rad 489, 522) fånga det som `{ url, fel }` i en ny `misslyckade[]`-lista i stället för
att tappa sidan tyst. *En rad kod som läser något den redan har.*

**S-2 — Följ sitemapindexet.** (`lib/seo-deep.ts:428-438`)
Kolla om roten är `<sitemapindex>`; hämta i så fall barnfilerna (tak ~5) och slå ihop. Filtrera bort
`.xml` ur den crawlbara sidlistan (rad 495). Samma fix i `lib/page-match.ts:18-31`.
*Detta ensamt hade gett 13 sidor i stället för 2.*

**S-3 — Vägra generera på trasig data.** (`lib/deep-audit-generate.ts:217`)
Efter `crawlSite`: om startsidan saknas, eller om andelen misslyckade sidor överstiger en tröskel, eller
om `homepageText` är tom → returnera `{ ok: false, error: "..." }` **innan** batchen submittas.
Ingen batch, ingen kostnad, ingen kundrapport. Visa felet i UI:t i stället.

**S-4 — Bär orsaken hela vägen.** (`lib/seo-deep.ts:176, 203`; `lib/seo-audit.ts:165`)
Returnera `{ seo: null, orsak: svar.fel }` i stället för bara `null`, och lägg `orsak` i faktablocket så
rapporten kan skriva "Lighthouse kunde inte köras: kvot slut" i stället för "saknas". Spara samtidigt
crawl-hälsan i `client_assets.metadata` så en färdig rapport går att granska i efterhand.

**S-5 — Läs robots.txt på riktigt.** (`lib/seo-deep.ts:117-118`)
Parsa filen per user-agent-block i stället för en regex över hela texten (fixar även falsklarmet när
AI-blocket ligger efter `User-agent: *`). Lägg till ett fält `aiCrawlersBlockade: string[]` och mata in
det i AEO-avsnittet av prompten. För en AEO/GEO-produkt är "sajten förbjuder ChatGPT, Claude och Gemini
att läsa den" det enskilt viktigaste fyndet — i dag rapporteras det som en grön bock.

**Bonus, nära noll kod:** ensa user-agenten. Fem identiteter i samma produkt (avsnitt 1) betyder att
delar av samma rapport kan beskriva olika sajter. En konstant, en fil.

---

## Kunde inte avgöras

* **Exakt vad startsidans hämtning returnerade 2026-08-02 kl 18:07 UTC.** Mätvärdena utesluter
  403-sidan och pekar entydigt på en tom kropp, men verktyget sparar varken status eller storlek, och
  samma kod ger i dag ett fullständigt svar härifrån. Om orsaken var Vercels utgående IP, en tillfällig
  spärr hos sajtens openresty-lager, eller något annat går inte att fastställa i efterhand — och det är
  i sig ett av fynden (avsnitt 2d).
* **DDL för `hm_seo_audits`** finns inte i `migrations/`. Kolumnerna ovan är lästa live ur PostgREST-
  schemat, inte ur versionshanterad SQL.
