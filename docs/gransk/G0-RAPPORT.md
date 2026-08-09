# G-0 — Inläggsmotorn, read-only-rapport

**Körd:** 2026-08-09. **Inga kodändringar gjordes under G-0.** Rapporten är beslutsunderlaget
för GRANSK v2 (G-1 … G-9) och för de två akutetapperna som Håkan lade före G-1.

> ⚠ **FIX-1 grupp A har ingen samlad rapport.** Det finns ingen "FIX-1:s rotorsaksrapport"
> i repot eller i minnet — leta inte igen. Det närmaste, och det som jämförelsen i
> avsnitt 0.1 görs mot, är minnesfilen `lesson_sjalvmotsagande_instruktion_ger_fabricering`
> (tre fynd, 2026-08-07, commit `d8bae1c`). Grupp A + B1 är levererade; B2 (Vilande) och
> hela grupp C återstår och ligger som eget steg mellan G-2 och G-3.

**Beslutad ordning efter G-0 (Håkan, tvingande):**
AKUT-KARUSELL → AKUT-DM → G-1 → G-2 → FIX-1-REST (B2+C) → G-3 → G-4 → G-5 → G-6 → G-7 →
G-8 (med Meta-förberedelsen) → G-9. Hårt stopp per etapp. Kundleverans (Madeleines
kundnyckel i provisioneringens steg 4) går alltid före granskningsarbete.

**Omfång för G-2…G-7 (beslutat):** Studio, captions, veckoplan, karusell, reels, story.
LinkedIn, blogg och nyhetsbrev ingår **inte** där, men **ska in i generationsloggen G-1** —
allt som genereras loggas, oavsett spår. LinkedIn-anatomin tas som eget spår senare.

---

## 0.1 Flödeskartan

`byggTextPrompt` ([lib/prompt-core.ts:353](../../lib/prompt-core.ts)) anropas från
**21 ställen i 19 filer**.

### Går genom prompt-core

| Flöde | Fil:rad | Syfte | Deterministisk grind efteråt |
|---|---|---|---|
| Skapa inlägg, 3 varianter | `app/api/generate/post/route.ts:110` | `enskilt` | **Ja** — siffergrind `:222` |
| Skapa om en variant | `app/api/generate/regenerate/route.ts:47` | `enskilt` | Nej |
| Veckoplan (7 dagar) | `app/api/generate/week/route.ts:127` | `veckoplan` | **Ja** — CTA `:199`, siffer `:208` |
| Compass-vecka | `lib/content-compass/vecka-prompt.ts:53` | `veckoplan` | **Ja** — CTA `:311`, siffer `:322` |
| Social (klassisk vy) | `app/api/social/generate/route.ts:123` | `social` | Nej |
| Studio: text på bilden + idéer | `lib/studio/copy.ts:149` | `studio-text` | **Ja** — fail-closed siffergrind `:493`, CTA-förbud `:234` |
| Studio: caption | `app/api/studio/suggest-caption/route.ts:94` | `caption` | **Ja** — `sakerstallCaption` `:153` |
| Studio: kanalanpassning | `app/api/studio/adapt-channel/route.ts:83` | `kanal-anpassning` | **Ja** — CTA `:131` |
| Studio: förbättra inlägg | `app/api/studio/improve-post/route.ts:126`, `:213` | varierar | Nej |
| **Studio: karusell** | `lib/studio/carousel.ts:37` | `karusell` | **Nej** |
| **Studio: reel-manus** | `lib/studio/reels-generate.ts:83` | `reel` | **Nej** |
| Blogg (Studio) | `lib/studio/blog.ts:73`, `:154` | `blogg` | Nej |
| Blogg (motorn) | `app/api/blog/generate/route.ts:77` | `blogg` | Nej |
| Nyhetsbrev | `lib/newsletter.ts:40` | `nyhetsbrev` | Nej |
| LinkedIn utkast / idéer | `app/api/linkedin/draft/route.ts:132`, `app/api/linkedin/ideas/route.ts:90` | `linkedin` | Nej |
| Fordonsinlägg | `app/api/fordon/post-suggest/route.ts:70` | `social` | Nej |
| Specialister | `app/api/specialist/[id]/run/route.ts:57` | `specialist` | Nej |
| Nattkörning | `app/api/agents/night-iterate/route.ts:95` | varierar | Nej |

### Producerar publik text men går INTE genom prompt-core

| Flöde | Fil:rad | Vad som saknas | Beslut |
|---|---|---|---|
| **DM-/kommentarssvar** | `app/api/lobby/suggest-reply/route.ts:82` | `generateJSON` + eget röstblock. Text som går till en betalande kunds riktiga lead. Inget sanningskrav, ingen prisregel, ingen perspektivregel. | **AKUT-DM** (före G-1). Full lagertäckning, **ingen CTA-tvingning** — fel kontext för golvet. |
| **Hashtags** | `app/api/generate/hashtags/route.ts:59` | Egen systemprompt av fem profilfält (`:26–52`). Ingen röstprofil, inga innehållsregler. Skyddsnätet i `lib/gemini.ts:43` lägger bara på skrivreglerna. | Lägre risk → **in i prompt-core som del av G-2**. |
| **Karusell, gamla vägen** | `app/api/posts/[id]/render-carousel/route.ts:4` | Egen `generateJSON` + eget fingerprint-block. Renderar 1080×1080. Nås från `/dashboard/social`. | **AKUT-KARUSELL b** — pensioneras. En karusellmotor, inte två. |
| Bildpromptbygge (gamla vägen) | `app/api/posts/[id]/build-image-prompt/route.ts:11` | `getKnowledge` + `getProfileAsMarkdown` direkt — dubblettmönstret TEXT-1 byggdes för att stänga. | Följer med karusellpensioneringen där den är kopplad; annars G-2. |

Omgenereringarna i veckoflödet (`:405`, `:457`) återanvänder `bygg.system` från prompt-core
och är alltså inte hål.

**Bildvägarna ligger per definition utanför prompt-core** (den är textbärande):
`studio/suggest-image`, `social/generate-image`, `posts/[id]/nano-banana`, B3 i
`lib/studio/text-in-image.tsx`, samt reels bildprompter. Reglerna bor i `lib/images.ts`
och `lib/bildtext.ts`. Medvetet val — men det betyder att **det inte finns någon plats
där text- och bildreglerna för samma inlägg möts.**

### Jämförelse mot FIX-1 grupp A

Grupp A:s tre fynd handlade om *instruktionens innehåll* (ett tillstånd som upphäver ett
förbud i samma stycke; ett exempel i en instruktion som blir en instruktion). Alla tre satt
i filer som **redan går genom prompt-core**. Kartan ovan är den andra halvan av samma
problem: fyra flöden som aldrig ser reglerna alls. Grupp A gjorde reglerna rätta — kartan
visar var de inte gäller.

---

## 0.2 Formatinventering

Exportmåtten sätts på ett ställe: `lib/studio/payload.ts:109–113`. Den **riktiga** exporten
är klient-sidig `toBlob` i `components/StudioMaker.tsx:778` med `pixelRatio: 1` — alltså
exakt de måtten. (Playwright-rendern i `app/api/studio/export` är utvecklingsväg, ger 501
i molnet.)

| Format | Mått | Var måtten sätts | Slide-nivå-struktur? |
|---|---|---|---|
| Statisk bild, porträtt | **1080×1350 (4:5)** — default | `payload.ts:110`, `:128` | — |
| Statisk bild, kvadrat | 1080×1080 | `payload.ts:111` | — |
| Story | 1080×1920 | `payload.ts:112` | — |
| **Ark-karusell (Studio)** | Ärver `payload.format`, alla slides samma ratio, default 4:5 | `payload.ts:109` + `components/studio/archetypes/ArkKarusell.tsx:37` | **Ja** — `kind: hook \| point \| cta`, max 10 (`payload.ts:94`) |
| **Karusell (gamla vägen)** | **1080×1080 hårdkodat** | `app/api/posts/[id]/render-carousel/route.ts:94` | Nej — alla slides ur samma instruktion |
| Reel | 1080×1920, `SAFE_ZONE` topp 220 / botten 450 / sida 35 | `lib/studio/reels.ts:15–19` | **Ja** — fasta scenspecar per mall, `:79–137` |
| AI-genererad bakgrundsbild | 3:4, 1:1, 4:3 eller 9:16 | `app/api/studio/suggest-image/route.ts:47` | — |

### Tre saker som inte hänger ihop

1. **Karusellen kan inte publiceras som karusell.** `captureDesignBlob` fångar EN nod
   (`StudioMaker.tsx:2760`) som renderar `slideIdx` — den valda sliden. `exportPng` laddar
   ner en fil, `renderDesignPng` laddar upp en bild, och publiceringsanropet skickar en
   `mediaUrl` (sträng). UI:t säger ändå *"{n} slides · exporteras som {n} bilder"*
   (`StudioMaker.tsx:2120`). **Löftet fanns i gränssnittet, inte i koden.**
   → åtgärdas i AKUT-KARUSELL.
   ★ Not: `publishCarousel` fanns redan färdig och korrekt i `lib/instagram.ts:82`, och
   `PublishRequest.slideUrls` fanns redan i `lib/publish/index.ts:27`. Bara anroparen saknades.
2. **Bildens ratio matchar inte kanvasens.** Kanvas 4:5 (0,800), AI-bilden begärs som 3:4
   (0,750) eftersom Imagen inte har 4:5. Täckbeskärningen äter ~6 % i höjd — precis där en
   hook-rad eller ett ansikte hamnar. **Ingen säkerhetszon är definierad för statiska
   format**; `SAFE_ZONE` finns bara för reels. → G-2.
3. **Två karusellmotorer**, olika mått (4:5 mot 1:1), olika regeltäckning, båda nåbara.
   → AKUT-KARUSELL b.

---

## 0.3 Anatomi-gap

**(a) Formatspecifik dramaturgi — finns delvis, men som hårdkod per flöde, inte som data.**

| Format | Finns? | Var |
|---|---|---|
| Statisk bild | Ja — `pa-bild`-anatomin (hook/story/nytta, ingen CTA) | `prompt-core.ts:265–289` |
| Karusell | Ja — men som **fritextsträng inuti flödesfilen** | `lib/studio/carousel.ts:26–35` |
| Reel | Ja — scenspecar per mall | `lib/studio/reels.ts:79–137` |
| **Story** | **Nej.** `story` finns inte i `TextSyfte` (`prompt-core.ts:44`). En story är bara "format 1080×1920 utan video" (`payload.ts:156`) och får samma text som ett vanligt inlägg. |

Karusellens anatomi är svagare än G-2 kräver: hook (~34 tecken) → N × point → cta.
**Ingen insats-slide, ingen bevis-slide.** `points ?? 3` → 5 slides som standard, inte 7–10.

Reelmallarna motsäger 1,7-sekundersregeln: *Före och efter* börjar med en `problem`-scen på
3 000 ms — **ingen hook-scen alls** (`reels.ts:87`). Tre av fyra mallar har hook, en har inte.
→ G-2: alla mallar får hook-scen först.

**(b) Hooktypologi som styrbart lager — nej.** Tre osammanhängande listor:
- 5 hooktyper som prosa i `knowledge/hook-playbook.md`, laddad av 4 flöden.
- 8 retoriska ingångar i `VARIANTREGEL` (`prompt-core.ts:252–256`) — gäller bara inom *ett* anrop.
- 4 DISC-hookar (`lib/content-compass/prompt.ts:20`) — bara om DISC är satt, vilket det aldrig är som default.

Ingen är valbar, roterande över tid eller loggad. Det enda som finns över tid är `p.nyligen`
(undvik-lista), och den skickas från **2 av 21** anropsställen:
`app/api/linkedin/ideas/route.ts:97` och `app/api/studio/suggest-caption/route.ts:79`.

**(c) Bevismekanik — nej, och den är aktivt bortmotad.** Vinnande exempel går in som
*"matcha denna kvalitet"* (`prompt-core.ts:426`) — stilreferens, inte bevis. `pricing_notes`
är uttryckligen sanningsunderlag som inte får citeras (`prompt-core.ts:206`). Kundcitat får
bara användas om personen står i story-banken, och FIX-1 grupp A skärpte att customer voice
är *språk*, inte *händelser*. Nettot: modellen ser bevis men får inte använda dem, och ingen
position kräver dem.

> **Beslut inför G-4 (Håkan):** `pricing_notes` **förblir spärrad som citatkälla** —
> prisregeln står fast. Bevis-motorns källa är profilens **verifierade siffror**
> (eget fält, med täckning), **kundcitat ur story-banken** (som citat, aldrig omskrivet
> till eget minne), och **vinnande exempel**. Verifierade siffror och priser är två olika
> saker, två olika fält, två olika regler.

**(d) CTA-typ styrd av funnel — finns, men når nästan aldrig fram.** `FUNNEL_CTA`
(`content-compass/prompt.ts:32`) + `CTA_GOLV` (`prompt-core.ts:141`) finns, men:
- `DEFAULT_FUNNEL` sätter tofu på hela socialfamiljen och **bofu aldrig** (`prompt-core.ts:102–112`).
- Med bara mjuk default markeras funnel-CTA:n *"väg in den bara om inget annat framgår"* (`:279`).
- Nyckelords-CTA finns bara i `BOFU_CTA_MALL`, som alltså aldrig aktiveras utan aktivt val.
- Mottagarsidan saknas helt: `/api/lobby/*` har `contacts`, `extract`, `sync`, `suggest-reply` —
  ingen väg att registrera en kommentator som lead.

> **Beslut inför G-5 (Håkan):** funnel-designen står fast, **BOFU aldrig som default**
> (beslutet från 31/7). G-5 gör CTA-typens **existens** hård även när läget är mjukt satt.

---

## 0.4 Generationsloggning

**Sparas genereringar med id och metadata idag? Nej — inte som generering.**

Det som finns är `ai_usage_events` (`migrations/ai_usage.sql`), en rad per **betalt anrop**:

| Finns | Saknas för G-1 |
|---|---|
| `id` (uuid), `created_at` | — |
| `tenant_id` (auto ur `getActiveClientId()`) | — |
| `flow` (auto ur `x-pathname`) | **format** (4:5 / 9:16 / karusell) |
| `provider`, `model` | **promptversion** |
| tokens, `media_units`, kostnad | **hooktyp**, **motivkategori**, **funnel-läge** |
| `status`, `error_class`, `error_body`, `latency_ms` | **vilket inlägg genereringen hamnade i** |

`loggaHandelse` returnerar redan sitt `id` (`lib/ai-usage.ts:220`) — kroken finns, ingen sparar den.

Fyra konkreta hinder:
1. Ingen tabell binder ihop `ai_usage_events.id` med `studio_posts.id` / `studio_media.id` /
   `hm_social_posts.id`. Ledgern vet att en bild kostade 0,04 kr men inte vilken bild.
2. `flow` härleds ur URL:en. Karusell och statisk bild ur `suggest-text` blir **samma flow** —
   formatet syns inte.
3. **Ingen promptversionering existerar** (noll träffar på `prompt_version`/`promptVersion`).
   En kvalitetsändring i prompt-core kan idag inte kopplas till ett före/efter i utfallet.
4. `studio_media` har proveniens (`source`, `consent`, `source_detail`) men ingen koppling
   till anropet som skapade filen (`migrations/studio_reels.sql:15–37`).

**Relation till `ai_usage_events`:** rätt grund, fel granularitet. G-1 ska inte ersätta den —
den ska **peka på** den, precis som credits gör (`credit_transactions` → `ai_usage_events`).
Mönstret finns och fungerar.

---

## 0.5 Mätbarhet

**Vad kan läsas tillbaka per publicerat inlägg idag: i praktiken ingenting.** Tre oberoende
brott, alla i kedjan samtidigt.

**Brott 1 — scopet saknas.** `META_SCOPES` (`lib/meta-oauth.ts:15`) är
`pages_show_list, pages_read_engagement, pages_manage_posts, business_management,
instagram_basic, instagram_content_publish`. `GET /{ig-media-id}/insights` kräver
**`instagram_manage_insights`**, som inte finns. `getMediaInsights` har `try/catch` som
sväljer felet och returnerar `{data: []}` (`lib/instagram.ts:136–140`). Räckvidd, sparningar
och delningar blir tyst noll — utan felmeddelande. **Samma familj som SEO-1: nollor som ser
ut som mätvärden.**

**Brott 2 — kopplingen skrivs aldrig.** `app/api/instagram/sync/route.ts:33–43` upsertar
`post_metrics` på `ig_media_id` och sätter **inte** `post_id`. `lib/insights.ts:43–45` läser
med `.in("post_id", ids)`. Joinen kan aldrig träffa. `getWinningPatterns` — som matas in i
`generate/post:102` — returnerar alltid tomt. **Återkopplingsloopen "vinnande hooks tillbaka
in i prompten" har aldrig fungerat.**

**Brott 3 — fel tabell.** `insights.ts` läser `hm_social_posts`. Studio sparar i
`studio_posts`. Allt som skapas i Studio är osynligt för mätningen även om 1 och 2 lagas.

**Publiceringsvägen försvårar:** default är `ghl-social`, och `studio_posts.ghl_post_id` får
GHL:s post-id (`app/api/studio/publish/route.ts:48`). Vid `ig-graph` skrivs IG:s media-id i
**samma kolumn** — två ID-rymder, ingen kolumn som säger vilken.

**3-sekundershållning för reels finns inte att hämta.** Metriklistan är
`plays, reach, likes, comments, saved, shares, total_interactions` (`lib/instagram.ts:133`).
Hållningsmåttet (`ig_reels_video_view_total_time` / `ig_reels_avg_watch_time`) kräver **också**
`instagram_manage_insights`, och en äkta 3-sekundersgräns finns inte som fält — den måste
approximeras ur snittvisningstid. **Det ska sägas rakt ut i vyn, aldrig presenteras som mätt.**

> **Beslut inför G-8 (Håkan):** omkopplingen förbereds som del av G-8. Saknad behörighet
> visas i **klartext** ("Instagram behöver kopplas om för att visa siffror"), aldrig som
> nollor. Själva omkopplingen per tenant är kundkontakt och ligger på Håkan — G-8 levererar
> en checklista per tenant (Gitte, DT, HM Motor) med exakt vad de ska klicka.

---

## De fem tyngsta fynden

1. **Karusellen publicerades som en enda bild.** Koden fångade bara den valda sliden; UI:t
   lovade N bilder. → AKUT-KARUSELL.
2. **Mätloopen är bruten i tre led samtidigt**, och det tredje (scopet) gör att felet ser ut
   som "inget engagemang" i stället för "ingen behörighet". → G-8.
3. **Två karusellmotorer** med olika mått och olika regeltäckning, båda nåbara. → AKUT-KARUSELL b.
4. **DM-/kommentarssvar går utanför alla regler** — och det är den text som går direkt till en
   betalande kunds lead. → AKUT-DM.
5. **Story är inget format i motorn**, bara en bildstorlek. Den får ett vanligt inläggs text
   i en yta som inte tål det. → G-2.
