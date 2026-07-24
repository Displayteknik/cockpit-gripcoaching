# CONTENT COMPASS — SPEC

> Status: **spec för godkännande**. Ingen kod byggd. Bygg först efter Håkans OK, sedan etapp för etapp (CC-1 → CC-4) med qa-bevis per etapp.
> Metod: grundad i faktisk kod via tre kodgenomgångar (AI-genereringslagret, innehållsmodellen/kalendern, tenant-config + designsystem). Fil- och radhänvisningar nedan är verifierade.

---

## 0. Sammanfattning + nyckelinsikt

Content Compass gör att varje inlägg som skapas i Studio automatiskt hamnar rätt på tre axlar (funnel TOFU/MOFU/BOFU, 4A, DISC), utan att användaren behöver kunna teorin, och med fritt skrivande alltid kvar.

**Nyckelinsikt: halva grunden finns redan.**
- `lib/content-framework.ts` har redan en global `WEEK_ROLES`-konstant (7 dagar × `{fourA, disc, funnel, intent, recommended_formats}`) plus färdiga förklarings-texter `DISC_GUIDE`, `FOURA_GUIDE`, `FUNNEL_GUIDE`.
- `app/dashboard/(inlagg)/veckoplan/page.tsx` visar redan profilen per dag (idag som plान text, rad ~330) med `FOURA_COLORS` (kant-ton) och `FOURA_BADGE` (fyra färger).
- `app/api/generate/week/route.ts` konsumerar redan `WEEK_ROLES` + `DISC_GUIDE`.

Specen handlar alltså om att: **(a)** göra det globala schemat **per tenant** + lägga till kadens-nivå, **(b)** lägga tre metadata-fält på innehåll, **(c)** väva in profil-reglerna i AI-prompten på ett ställe per stack, **(d)** göra visningen premium och självförklarande, **(e)** auto-klassa fritt skrivna inlägg, **(f)** bygga balansmätare, **(g)** bygga "Skapa veckans innehåll". Inte bygga från noll.

**Två AI-stackar (viktigt för CC-2):**
- Stack A (Gemini, hand-rullad prompt per route): captions (`suggest-caption`), `adapt-channel`, carousel, blogg. Röst = varumärkesprofil-markdown (`getProfileAsMarkdown`) + kit-direktiv (`dontsRule`).
- Stack B (Anthropic, delad `iterateGenerate`): studio-copy (`suggest-text`) + specialister. Lägger fingerprint + vinnande exempel + guardrails.
- Compass-blocket vävs in på **två ställen** och täcker då alla generatorer: `lib/iterate.ts` (Stack B) + `getProfileAsMarkdown`/ny `compassRule()` i `lib/studio/kit.ts` (Stack A).

---

## 1. Datamodell

### 1.1 Metadata på innehåll (tre nya fält)
Innehåll lagras i fyra tabeller, unifieras bara vid läsning i `lib/content/overview.ts`. Det finns ingen delad innehållsrad, så fälten läggs **per tabell**:

Nya kolumner på `studio_posts`, `hm_social_posts`, `linkedin_posts`, `hm_blog`:
| Kolumn | Typ | Not |
|---|---|---|
| `funnel_level` | `text` | CHECK in ('tofu','mofu','bofu'), null = oklassat |
| `four_a` | `text` | CHECK in ('analytical','aspirational','actionable','authentic') |
| `disc` | `text[]` | t.ex. `{D,I}` |
| `compass_source` | `text` | 'schedule' (förifyllt) \| 'manual' (användaren satte) \| 'auto' (AI-klassat). Default null |
| `compass_confidence` | `numeric(3,2)` | bara för 'auto', 0.00–1.00 |

`studio_scheduled` (jobbkö, speglar `studio_posts`) behöver **inte** fälten. `studio_posts.payload` (jsonb) skulle kunna bära fälten utan migration, men de tre andra tabellerna saknar fri payload, så vi tar riktiga kolumner på alla fyra för konsekvent filtrering i kalender/balansmätare.

### 1.2 Tenant-schema (`content_compass_schedules`)
Ny tabell, speglar `studio_brand_kits`-mönstret (en jsonb-blob per tenant, atomisk redigering):
```
content_compass_schedules
  client_id  uuid  PRIMARY KEY  REFERENCES clients(id)
  schedule   jsonb NOT NULL
  cadence    text  NOT NULL DEFAULT '7'     -- '7' | '4' | '2-3'
  source     text  DEFAULT 'standard'        -- 'standard' | 'manuell'
  updated_at timestamptz DEFAULT now()
  -- RLS: på, inga anon-policies, service-role only (som studio_brand_kits)
```
`schedule` jsonb-form:
```json
{
  "days": {
    "mon": { "four_a": "analytical", "funnel": "tofu", "disc": ["C"] },
    "tue": { "four_a": "analytical", "funnel": "tofu", "disc": ["D"] },
    "wed": { "four_a": "aspirational", "funnel": "mofu", "disc": ["I"] },
    "thu": { "four_a": "aspirational", "funnel": "bofu", "disc": ["D","I"] },
    "fri": { "four_a": "actionable", "funnel": "tofu", "disc": ["C","S"] },
    "sat": { "four_a": "actionable", "funnel": "mofu", "disc": ["D","C"] },
    "sun": { "four_a": "authentic", "funnel": "tofu", "disc": ["S"] }
  }
}
```
Kadens (`7`/`4`/`2-3`) styr vilka dagar som är aktiva (se 2.2). Läsare: ny `getCompassSchedule(clientId)` i `lib/content-compass/schedule.ts` som faller tillbaka på `WEEK_ROLES`-standarden om ingen rad finns (behåll-fungerande-väg, ingen tom profil).

### 1.3 Kadens-nivå
Kadens lagras i `content_compass_schedules.cadence` (inte som modul-flagga, eftersom modul är boolean på/av och tre nivåer blir tre uteslutande rader). Modulen `compass` (1.4) svarar "ser tenanten Content Compass alls"; kadensen svarar "hur många inlägg/vecka".

### 1.4 Entitlement (modul-grind)
Ny rad i `platform_modules`: `id='compass'`, `label='Content Compass'`, `href='/k/compass'` (eller in i innehålls-navet), `icon='Compass'`, `owner_area='content'`, `active`/`in_pro_default` enligt Håkans beslut. Grindas via `hasModule(clientId,'compass')`. Per-tenant på/av via `tenant_modules` + `/dashboard/paket` (befintligt flöde, noll ny kod i grind-lagret).

### 1.5 Hårda regler (delad motor)
Ny `lib/content-compass/rules.ts` — ren, testbar, används både av "Skapa veckans innehåll" (bygg en giltig vecka) och balansmätaren (varna):
- Max 1 BOFU per vecka.
- Aldrig två säljinlägg (MOFU/BOFU med säljande CTA) i rad.
- Minst 60 % TOFU över rullande månad.
- BOFU varannan vecka på kadens 2-3.
Funktioner: `validateWeek(days[])`, `analyzeMix(items[], window)`, `warningsFor(mix, target)`. Reglerna ligger som **data** (tröskel-konstanter överst i filen), inte utspridda.

---

## 2. Standardschemat (seed)

### 2.1 Grundtabell (7/vecka)
| Dag | 4A | Funnel | DISC |
|---|---|---|---|
| Mån | Analytical | TOFU | C |
| Tis | Analytical | TOFU | D |
| Ons | Aspirational | MOFU | I |
| Tors | Aspirational | BOFU | D+I |
| Fre | Actionable | TOFU | C+S |
| Lör | Actionable | MOFU | D+C |
| Sön | Authentic | TOFU | S |

### 2.2 Kadens-nivåer (vilka dagar som är aktiva)
- **7/vecka:** hela tabellen.
- **4/vecka:** Mån (Analytical TOFU C), Ons (Aspirational MOFU I), Tors (BOFU D+I), Sön (Authentic TOFU S).
- **2-3/vecka:** 2 TOFU + 1 MOFU, BOFU varannan vecka (motorn i `rules.ts` avgör vilka veckor).

Seedas för alla tenants via migration + en backfill som skriver standard-blobben till `content_compass_schedules` (eller lazy: skapa raden först vid första redigering, med `WEEK_ROLES` som fallback tills dess). **Rekommendation: lazy** — ingen massiv backfill, ingen risk att röra live-klienter innan Håkan rullar ut.

---

## 3. Prompt-lagret (data, inte utspridda strängar)

### 3.0 Lager-hierarki (fast ordning i system-prompten)
Varje genererat inlägg byggs i denna ordning. Lager 1 finns redan; lager 2 till 5 är nya och ligger som data i `lib/content-compass/prompt.ts`:

1. **Klientens röst** — varumärkesprofil (`getProfileAsMarkdown`) + för Stack B även fingerprint + vinnande exempel (`iterate.ts`). Befintligt.
2. **Inläggsanatomin** — obligatorisk grundstruktur för ALLA inlägg oavsett profil (HOOK, STORY/PROBLEM, NYTTA/LÖSNING, CTA). Konstant; Compass-parametrarna färgar varje del. NYTT.
3. **Funnel-regler** — TOFU/MOFU/BOFU (mål + CTA-typ).
4. **4A-strukturmall** — story-formen (Analytical/Aspirational/Actionable/Authentic).
5. **DISC-tonregler** — ton och formulering (D/I/S/C).

### 3.1 Data i `lib/content-compass/prompt.ts`
```
export const POST_ANATOMY = {
  hook:    "Rad 1 till 2, stoppa scrollen. Aldrig annons-rubrik. Ton = dagens DISC.",
  story:   "Mitten: känsla och igenkänning, 'det där är jag'. Form = 4A-typen.",
  nytta:   "Kundens RESULTAT och transformation, inte våra tjänster/metod.",
  cta:     "Exakt EN uppmaning, aldrig två. Typ = funnel-nivån.",
}
export const DISC_HOOK = { D: "rak siffra eller kontroversiellt påstående", I: "vision eller känsloladdad fråga", S: "personlig igenkänning", C: "överraskande fakta" }
export const FOURA_STORY = { analytical: "fakta som utmanar", aspirational: "transformationsberättelse", actionable: "problemet som steget löser", authentic: "personlig erfarenhet" }
export const FUNNEL_CTA = {
  tofu: "engagemangs-CTA (kommentera, dela, följ, 'känner du igen dig?')",
  mofu: "mjukt nästa steg ('DM:a GUIDE så skickar jag den', 'läs hela caset via länken')",
  bofu: "nyckelords-CTA enligt BOFU_CTA_MALL",
}
export const FUNNEL_RULES    = { tofu, mofu, bofu }   // mål + ton per nivå
export const FOURA_TEMPLATES = { analytical: "3 fakta om [område] + varför det påverkar läsaren", aspirational: "Från [problem] till [resultat] på [tid]", actionable: "3 steg för att [resultat] utan [hinder]", authentic: "Vad jag önskar jag visste när [situation]" }
export const DISC_TONE       = { D: "resultat, siffror, korta meningar, rakt på", I: "energi, vision, känsla, du-tilltal", S: "trygghet, relation, vi-känsla, lugnt tempo", C: "fakta, detaljer, belägg, strukturerat" }
export const BOFU_CTA_MALL   = "Om du är [målgrupp] och du inte [problem], då kommer jag [lösning] så att du kan [drömmål]. Svara [NYCKELORD]."

export function contentCompassBlock(p: { funnel, four_a, disc[] }): string
```
`contentCompassBlock` sätter ihop lager 2 till 5 i ordning till ett `=== INLÄGGSANATOMI + CONTENT COMPASS ===`-block: anatomin (med DISC-färgad hook, 4A-färgad story, funnel-färgad CTA) följt av funnel-regel + 4A-strukturmall + DISC-ton (+ `BOFU_CTA_MALL` när funnel=bofu). Guide-texterna återanvänder befintliga `DISC_GUIDE`/`FOURA_GUIDE`/`FUNNEL_GUIDE`.

### 3.2 Inkoppling (två edits täcker alla generatorer)
1. Stack B — `lib/iterate.ts` (~rad 58-70): optional `contentCompass?: string` i `IterateOptions`, appendas efter röst-lagret (fingerprint/vinnande exempel) och före `SPECIALIST_GUARDRAILS`, så hierarkin 1→2→5 hålls. Täcker studio-copy + specialister.
2. Stack A — `lib/studio/kit.ts`: ny `compassRule(compass)`-sibling till `dontsRule`, injiceras efter varumärkesprofil-blocket i varje Gemini-route. Täcker captions, adapt-channel, carousel, blogg.

Varje generator-route får compass-värdena (postens metadata eller dagens schema) och skickar in dem. Ingen route skriver egna ton- eller anatomi-strängar.

### 3.3 Fritt skrivande + omskrivning + granskning
- Anatomin gäller även **fritt skrivna inlägg när användaren ber AI:n förbättra eller skriva om** en text (rewrite-läget skickar samma anatomi-lager). Fritt skrivande utan AI rör inget.
- **AI-granskning av utkast** (när användaren ber om feedback): ny/utökad review kontrollerar mot anatomin: (a) finns en hook, (b) finns känsla/igenkänning, (c) är nyttan kundens resultat (inte tjänsten), (d) finns exakt EN CTA, (e) matchar CTA:n funnel-nivån. Returnerar konkreta brister i klarspråk. Byggs i CC-2 ovanpå befintlig voice-check-liknande feedback om sådan finns, annars ny lätt endpoint `/api/content/review`.

---

## 4. Design: kalender-visualisering

Återanvänd befintliga primitiver (`components/ui/dash.tsx`: `TONES`, `HeroChip`, `LivePill`; `FunctionGuide`; `FOURA_BADGE`/`FOURA_COLORS` i veckoplan). Tre nya små komponenter i `components/content-compass/`:

### 4.1 DISC-pluppar — `DiscDots`
Runda färgpluppar (`h-4 w-4 rounded-full` med bokstav), byggda på `LivePill`-pluppmönstret (dash.tsx:83-86) utan ping. Färger: **D röd, I gul, S grön, C blå**. Flera pluppar vid kombination. Varje plupp har `title="D: resultat, siffror, rakt på"` (native tooltip, samma mönster som `FunctionGuide.tsx:28`). Klick på en info-ikon bredvid öppnar `FunctionGuide` med `DISC_GUIDE`-texten (rikare "vad är DISC").

### 4.2 Funnel-ton — `FunnelTint` (kort-bakgrund/kant)
Speglar `FOURA_COLORS`-mönstret (border + faint bg). **Förslag A (rekommenderas): en-hue-ramp** på vänsterkant + svag bakgrund:
- TOFU: neutral/ljus (`border-l-slate-300 bg-slate-50/40`) — toppen av tratten, bygg räckvidd.
- MOFU: varm mellanton (`border-l-amber-300 bg-amber-50/40`).
- BOFU: stark (`border-l-emerald-400 bg-emerald-50/50`) — nära pengarna.
Förslag B: tre nyanser av brand-primary (mer diskret, mindre lättläst). **Visar A i CC-1, du väljer.**

### 4.3 4A-etikett — `FourALabel` (ikon + text)
Fyra distinkta lucide-ikoner + `FOURA_BADGE`-färgerna:
- Analytical: `BarChart3` (diagram)
- Aspirational: `Sparkles` (stjärna)
- Actionable: `CheckCircle2` (bock)
- Authentic: `Heart` (hjärta)
Liten pill: ikon + kort etikett ("Analytical"). `title` med `FOURA_GUIDE`-text.

### 4.4 Var det renderas
- `app/dashboard/studio/kalender/page.tsx` — `Row`-kortet (rad 46-62): funnel-ton på kortet, DISC-pluppar vid titeln, 4A-etikett i sublinjen.
- `app/dashboard/innehall/page.tsx` — "Senaste innehåll"-raden (rad 122-136): samma.
- `app/dashboard/(inlagg)/veckoplan/page.tsx` — byt dagens plain-text-profil (rad ~330) mot de tre komponenterna.
- Kräver att `ContentItem` (overview.ts:10-19) utökas med `funnel/four_a/disc` + att varje `select(...)` och push-loop tar med fälten.

**Premium + självförklarande:** varje visuell markör har tooltip/popover på svenska. En kund som aldrig hört talas om DISC förstår av att hovra. Alla nya UI-texter: svenska, inga tankstreck (komma/punkt/kolon).

Kund-vy: idag finns ingen `/k/kalender`. Om Content Compass ska synas för kund i CC-1 föreslås en läs-vy i `/k` som återanvänder overview-API:t; annars håller vi CC-1 till admin/dashboard och tar kund-vyn senare. **Öppen fråga (se 8).**

---

## 5. Berörda filer (per område)

**Datamodell/migrations:** `migrations/content_compass.sql` (nya kolumner ×4 tabeller + `content_compass_schedules` + `platform_modules`-rad + NOTIFY pgrst).

**Schema/config-lager (nytt):** `lib/content-compass/schedule.ts` (läs/fallback), `.../rules.ts` (hårda regler), `.../prompt.ts` (prompt-block + ton-data).

**AI-inkoppling:** `lib/iterate.ts` (Stack B), `lib/studio/kit.ts` + ev. `lib/knowledge.ts` (Stack A). Generatorer skickar in compass: `app/api/studio/{suggest-caption,suggest-text,adapt-channel,carousel/generate,blog/generate}/route.ts`, `lib/studio/{copy,blog,carousel}.ts`.

**Innehållsmodell/kalender:** `lib/content/overview.ts` (utöka ContentItem + select + push), `app/dashboard/studio/kalender/page.tsx`, `app/dashboard/innehall/page.tsx`, `app/dashboard/(inlagg)/veckoplan/page.tsx`, `app/api/content/overview/route.ts`.

**Skapa/spara med metadata:** `components/StudioMaker.tsx` (chips-UI + state), `lib/studio/payload.ts` (fält på StudioPayload), `app/api/studio/posts/route.ts` (skriv kolumner).

**Admin-redigering (spegla brand-kit + paket):** ny `app/api/content-compass/route.ts` (GET/PUT jsonb, `requireAdmin` på write, upsert `onConflict:"client_id"`), ny `app/dashboard/content-compass/page.tsx` (klient-`select` + veckogrid, modellerad på `paket/page.tsx` `PerKund`).

**Auto-klassning (CC-3):** ny `app/api/content/classify/route.ts` (Gemini flash, JSON-svar med funnel/4A/DISC + confidence), återanvänder `getProfileAsMarkdown` för kontext.

**Balansmätare (CC-3):** `lib/content-compass/rules.ts` `analyzeMix` + ny dashboard-kort-komponent (StatTile-stil).

**Batch (CC-4):** utöka befintlig `app/api/generate/week/route.ts` att läsa per-tenant-schemat + skriva utkast per kanal med metadata + bästa-tid; knapp i `components/StudioMaker.tsx`.

**Designkomponenter (nya):** `components/content-compass/{DiscDots,FunnelTint,FourALabel}.tsx`.

---

## 6. Etappindelning (bygg i denna ordning, qa-bevis per etapp)

### CC-1 — Datamodell + schema + kalendervisning
Leverans: migration (kolumner + `content_compass_schedules` + modul), `lib/content-compass/schedule.ts` med fallback, utökad `ContentItem`, de tre designkomponenterna, profilen renderad i kalender + innehålls-nav + veckoplan med tooltips.
**qa-bevis:** migration applicerad live (kolumner finns, RLS på, 0 anon-policies); en demo-post med satt funnel/4A/DISC syns med rätt plupp/ton/ikon i kalendern (skärmbild 1440 + 390); tooltip visar rätt guide-text; tenant utan schema faller tillbaka på standard utan fel.

### CC-2 — Förifyllnad + promptbyggare (inkl. inläggsanatomin)
Leverans: `prompt.ts` (anatomi-data + ton-data + `contentCompassBlock` i 5-lager-hierarkin), inkoppling i `iterate.ts` + `kit.ts`, förifyllda redigerbara chips i StudioMaker (från dagens schema), fritt läge orört, metadata sparas via `/api/studio/posts`, anatomin gäller även rewrite/förbättra, samt granskning mot anatomin (`/api/content/review` eller utökad befintlig feedback).
**qa-bevis:** skapa post för en tisdag → chips förifylls Analytical/TOFU/D, redigerbara; generera caption → prompten innehåller lagren i rätt ordning (röst, anatomi, funnel, 4A, DISC) och captionen har hook + känsla + kund-nytta + exakt EN CTA som matchar funnel; BOFU-post genererar nyckelords-CTA enligt mallen; "förbättra min text" tillämpar anatomin; granskning av ett utkast utan hook/med två CTA:n flaggar rätt brister; fritt läge utan profil fungerar precis som idag (inget nytt obligatoriskt steg).

### CC-3 — Auto-klassificering + balansmätare
Leverans: `/api/content/classify` (sätter funnel/4A/DISC + confidence på fritt skrivna inlägg, användaren kan rätta), balansmätare-kort i dashboard (faktisk mix vecka/månad mot mål), varningar i klarspråk via `rules.ts`.
**qa-bevis:** klistra in ett fritt inlägg → får rimliga taggar + confidence, rättning sparas; mätaren visar korrekt mix mot tenantens schema; varningarna "2 säljinlägg i rad" / "ingen Authentic på 3 veckor" / "för lite TOFU denna månad" utlöses av riktig data.

### CC-4 — Skapa veckans innehåll
Leverans: "Skapa veckans innehåll"-knapp i Studio → genererar hela veckan enligt tenantens schema+kadens, färdigprofilerat, som utkast i kalendern med bästa-tid-förslag; granska/redigera/godkänn per inlägg; inget autopubliceras; kostnad loggas per körning (förberett för credit-system, Etapp K).
**qa-bevis:** ett klick → N utkast (enligt kadens) i kalendern, var och en med rätt profil + föreslagen tid, ingen publicerad; hårda regler respekterade (max 1 BOFU, ingen dubbel-sälj); token-kostnad loggad; batchen är token-effektiv (mät mot enskild generering).

---

## 7. Avgränsningar (Håkans krav)

- Rör **inte** publiceringskedjan (`lib/publish`, native scheduler-cron), säkerhetsarbetet eller Fas 1B (anon-skriv/RLS). Metadata-kolumnerna läggs additivt, inga befintliga policies ändras.
- Inga nya beroenden. Allt löses med befintliga libbar (Gemini/Anthropic-wrappers, Supabase, lucide-ikoner, Tailwind). Ingen tooltip-lib behövs (native `title` + befintlig `FunctionGuide`).
- Svenska i all användarvänd text. Inga tankstreck i UI-text (komma/punkt/kolon).
- Ton- och strukturregler ligger som data i `prompt.ts`/`content-framework.ts`, finslipas på ett ställe.
- Behåll fritt skrivande som förstaklassval. Profilen är alltid ett förslag, aldrig ett tvång, aldrig ett nytt obligatoriskt steg.
- Lazy seed (ingen massiv backfill) så inget rör live-klienter innan du rullar ut. Ny modul default enligt ditt beslut (föreslås av tills utrullning, i linje med live-klient-lagen).

---

## 8. Öppna frågor (svara i godkännandet)

1. **Kund-vy i CC-1?** Ska profilen synas för kund i `/k` redan i CC-1 (kräver ny `/k`-läsvy) eller håller vi CC-1 till admin/dashboard och tar kund-vyn i en senare etapp? (Rekommendation: admin först, kund-vy efter demo/utrullning.)
2. **Funnel-ton A eller B?** En-hue-ramp (slate→amber→emerald, tydligast) eller tre nyanser av brand-primary (mest diskret)? (Rekommendation: A, jag visar den i CC-1.)
3. **Modul default:** `in_pro_default` på direkt, eller av tills du rullar ut per tenant? (Rekommendation: av, som övriga nya features.)
4. **"Säljinlägg" i regeln "aldrig två i rad":** räknas all BOFU + MOFU-med-CTA, eller bara BOFU? (Rekommendation: BOFU + MOFU med säljande CTA.)
