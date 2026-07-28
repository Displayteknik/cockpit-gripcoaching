# Reels Creator — plan och spec

Status: **R0 klar och godkänd 2026-07-28.** R1 väntar på OK.

Detta är Etapp H3-v2 i `docs/CONTENT-STRATEGI.md:145`, där v1 var "video + text-cover"
och v2 stod som "bränn in overlay-text i videon, egen etapp, tyngre infra". Bygget sker
i befintlig Studio-struktur. Inga parallella system.

Första skarpa användning: Displayteknik (koncept-reels och pris-reels).
Långsiktig riktning: inkommande kundmaterial och avslutade affärer föder färdiga
reel-utkast som bara godkänns. Automatiken föreslår, människan godkänner, alltid.

---

## 1. Godkända arkitekturval (Håkan 2026-07-28)

| Val | Beslut |
|---|---|
| Renderare | **Client-side** i webbläsaren, `mediabunny` |
| Videoklipp som scen | **R3b**, direkt efter v1 |
| Placering | **Egen sida** `/dashboard/studio/reels` (+ `/k/reels`) |

### Varför client-side är enda vägen

Projektet ligger på Vercel Hobby. Bevis: `vercel.json` deklarerar sex crons, men
schemaläggaren tvingades ändå till GitHub Actions (`.github/workflows/scheduler.yml`,
fyra förskjutna körningar per timme) eftersom Hobby-cron inte räcker.

Serverless-funktioner har 250 MB bundle-tak. En statisk ffmpeg-binär är 70–100 MB och
Vercel avråder själva från ffmpeg i funktioner. Remotion skulle kräva AWS Lambda, alltså
ny infrastruktur och ny månadskostnad.

`mediabunny` (v1.51.0, MPL-2.0) är WebCodecs-baserat, skriver äkta mp4/H.264 från ett
canvas-element, fungerar i iOS Safari och kräver ingen SharedArrayBuffer. MPL-2.0 är
copyleft på filnivå och påverkar inte Cockpits egen kod så länge biblioteket används
oförändrat.

```js
const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() });
const videoSource = new CanvasSource(canvas, { codec: 'avc', bitrate: 6e6 });
output.addVideoTrack(videoSource, { frameRate: 30 });
await output.start();
// per frame: videoSource.add(tSekunder, 1/30)
await output.finalize();
const bytes = output.target.buffer;
```

---

## 2. Befintliga byggstenar som återanvänds

| Byggsten | Var |
|---|---|
| 9:16-format | `lib/studio/payload.ts:4,83-87` |
| `payload.videoUrl` | `payload.ts:67,123` |
| `derivePostType()` → `"reel"` | `payload.ts:128-131` |
| Video-uppladdning → bucket `studio-videos` (max 200 MB) | `app/api/studio/upload-url/route.ts:10-14` |
| Reel-publicering IG Graph | `lib/publish/index.ts:110-116` `publishReel()` |
| Schemaläggning med `video_url` + `post_type` | `studio_scheduled`, `app/api/studio/schedule/route.ts:66-67` |
| Promptlagren (anatomi → funnel → 4A → DISC → skrivregler sist) | `contentCompassBlock()` `lib/content-compass/prompt.ts:60-90` |
| Sanering | `sanitizeGenerated()` `lib/content/writing-rules.ts:113` |
| Grafisk profil, rollfärger, 5 självhostade TTF | `loadBrand()` `lib/studio/brand.ts:83`, `public/fonts/` |
| AI-bild, bildredigering, fotosök | `lib/images.ts` `generateImagen`/`editImagen`/`searchStockPhotos` |

---

## 3. Fällor som styr bygget

### a) "Mina bilder" har ingen databas
`app/api/studio/media/route.ts:21-23` är enbart `storage.list("studio-images", clientId)`.
Inget `source`-fält, inga taggar, ingen prompt, ingen lead-koppling. Källa kan idag bara
gissas ur filnamnsprefix (`ai-`, `edit-`, `blog-`). Hela R2:s datamodell byggs från noll.

### b) `generateImagen()` skickar aldrig bildformatet till API:t
`lib/images.ts:244` klistrar bara in det i prompttexten:
```ts
const fullPrompt = `${prompt}\nBildformat/komposition: ${aspectRatio}.`;
```
9:16 är en prompt-förhoppning, inte en garanti. Reels kräver **deterministisk beskärning
till 1080×1920 efter generering**, annars smyger fel format in oupptäckt.

### c) Fotosöket kan inte hitta stående bilder
`lib/images.ts:511` har `orientation=square` hårdkodat. Måste parametriseras, annars är
stock-spåret oanvändbart för reels.

### d) IG Graph måste kunna hämta filen publikt
Det utesluter bucket `client-assets` (privat, signerade URL:er med en timmes livslängd).
Reels-media måste ligga i de publika `studio-images` / `studio-videos`. **Detta avgör
datamodellen** — se §4.

### e) Säkra zonen i botten är 450 px, inte 20 %
På 1080×1920: topp 220 px, botten 450 px, sidor 35 px. Nedre zonen rymmer caption,
användarnamn och ljudetikett. Kodas som konstanter, inte som procenttal.

### f) Text kan inte Ken Burns:as
Rasteriseras hela arketypen till en PNG som zoomas, zoomar rubriken med. Bilden animeras
på canvas, texten ritas som eget statiskt lager ovanpå.

### g) Videor är osynliga i biblioteket
`media/route.ts:12` filtrerar på `png|jpe?g|webp`. Uppladdade videor i `studio-videos`
kan varken återanvändas eller raderas via UI.

### h) Tre arketyper saknar 9:16
`ark-foto-ruta`, `ark-lista`, `ark-erbjudande` i `lib/studio/templates-meta.ts`.
`ark-overlay`, `ark-textkort`, `ark-statement`, `ark-citat` har det.

---

## 4. Datamodell

### Tabell `studio_media` — mediabanken med proveniens
Indexerar de **publika** bucketarna (krav d). Läggs framför dagens storage-listning med
fallback till `storage.list()` för allt som redan ligger där, så inget försvinner för
befintliga kunder. RLS på, service-role-only, samma mönster som `studio_posts`.

```
id            uuid PK
client_id     uuid  → clients(id) ON DELETE CASCADE
kind          text  CHECK IN ('image','video')
bucket        text
path          text
url           text
source        text  CHECK IN ('uploaded','email','ai','stock')
source_detail text        -- prompt vid ai, fotograf vid stock, avsändare vid email
mime          text
bytes         bigint
width         integer
height        integer
duration_s    numeric
dm_contact_id uuid  → cockpit_dm_contacts(id) ON DELETE SET NULL, nullable
consent       text  CHECK IN ('ja','nej','ej_tillfragad') DEFAULT 'ej_tillfragad'
created_at    timestamptz
updated_at    timestamptz
```

### Tabell `studio_reels` — reel-objektet
```
id            uuid PK
client_id     uuid  → clients(id) ON DELETE CASCADE
title         text
template_key  text  CHECK IN ('fore-efter','pris','erbjudande','fakta')
storyboard    jsonb NOT NULL
status        text  CHECK IN ('utkast','renderad','publicerad','forslag')
video_url     text
cover_url     text
caption       text
ai_generated  boolean DEFAULT false
dm_contact_id uuid nullable
duration_ms   integer
created_at    timestamptz
updated_at    timestamptz
```

`status='forslag'` är R7:s automatiska utkast. De renderas aldrig automatiskt och
publiceras aldrig av sig själva.

### Storyboard-JSON
Byggd som `StudioSlide` (`payload.ts:47`) så mönstret är igenkännbart.

```ts
interface ReelScene {
  kind: "hook" | "problem" | "losning" | "fakta" | "cta";
  overlay: { line1: string; line2: string };   // max 8 ord per rad
  mediaUrl: string;
  mediaKind: "image" | "video";
  source: "uploaded" | "email" | "ai" | "stock" | "";
  imagePrompt: string;        // driver både AI-generering och fotosök
  durationMs: number;
  transition: "overton" | "svep" | "ingen";
  kenBurns: { from: number; to: number; panX: number; panY: number };
  trimStartMs: number;        // endast video (R3b)
}
```

### Äkthetsregeln
`ai_generated` sätts på reel-objektet så fort någon scen har `source='ai'`.
Mallen Före/efter kräver då ett bekräftelsekryss före render:

> AI-bilder får visa koncept och visualiseringar, inte utges för verkliga
> kundinstallationer.

Material med `source` `uploaded` eller `email` räknas som äkta och används fritt i alla
mallar utan bekräftelseruta.

---

## 5. Placering och åtkomst

- Sida: `app/dashboard/studio/reels/page.tsx`, nav-post i Studio-gruppen
  (`app/dashboard/layout.tsx`).
- Kundyta: `app/k/reels/page.tsx` med `requireCustomerFeature("reels")`.
- Entitlement: ny rad i `platform_modules` med `id='reels'`, `in_pro_default=false`,
  därefter `tenant_modules`-rad enbart för Displayteknik.
  Carl-Fredrik och Ledarskapskultur ser ingenting. `NOTIFY pgrst,'reload schema';` efter DDL.

---

## 6. Etapper med hårda stopp

| Etapp | Innehåll | Bevis innan nästa etapp |
|---|---|---|
| **R1** | Manusmotorn: idé + mall → storyboard-JSON + caption, genom hela promptlagerhierarkin | Storyboard för Displayteknik-idén, inga tankstreck, texter inom ordgränsen |
| **R2** | `studio_media` + `studio_reels`, fyra materialspår, fix av fälla b, c och g | Alla fyra spår ger 1080×1920, källa sparad korrekt |
| **R3** | Canvas-renderare + förhandsvisning med redigerbara texter och scenlängder | Spelbar mp4 under 25 MB, texter innanför säkra zoner, Ken Burns synlig |
| **R3b** | Videoklipp som scen: trim till scenlängd, beskär till 9:16 | Reel med videoklipp som scen 2 |
| **R4** | Spara i biblioteket med storyboard, Ladda ner, Använd i inlägg | Reel öppnas och redigeras igen |

### Mallar i v1 (fasta scenstrukturer, 8–15 sek)
1. **Före/efter** — problembild 3 s, lösningsbild 5 s, sluttext 2 s
2. **Pris rakt ut** — hookfråga, produktbild med pris som stor overlay, CTA
3. **Erbjudande** — hook, vad kunden får, CTA
4. **Kunskap / 3 fakta** — hookfråga, tre faktascener, CTA

### Krav på output
1080×1920, 30 fps, mp4 H.264, max 30 sek. Ken Burns på alla stillbilder, aldrig statiska.
Text i tenantens grafiska profil, innanför säkra zoner. Övergångar överton och svep.
Inget ljud i v1, med notis efter export: *Lägg på trendljud när du publicerar i
Instagram-appen för bäst räckvidd.*

---

## 7. Senare etapper (specade, byggs efter v1 är bevisad skarpt)

**R5 — API-publicering av reels.** Resumable upload, processningspolling, schemaläggning
via samma kedja som bildinlägg, felhantering i Kalender och Godkännanden. Byggs först
när v1 använts skarpt några veckor. Notera att API-publicerade reels saknar tillgång till
trendljud, därför är nedladdning + manuell publicering rekommenderad väg i v1.

**R6 — Inmejlning av kundmaterial.** Egen mottagningsadress per tenant. **Resend Inbound**
är rätt val: Resend används redan för nyhetsbrevet, och deras inbound-webhook levererar
parsat innehåll plus ett attachments-API med `download_url`, vilket är nödvändigt i
serverless där request-body är begränsad. Bilagor sparas i `studio_media` med
`source='email'`. Matchar avsändaradressen ett leadkort sätts `dm_contact_id`.
Okänd avsändare hamnar i en inkorg för sortering.

**R7 — Automatiska reel-utkast.** Två triggers:
1. Äkta material (`uploaded`/`email`) på ett leadkort som når `stage='won'`
2. Ägaren markerar en bild i biblioteket som "gör reel av denna"

Utkast läggs som `studio_reels.status='forslag'`. De renderas inte automatiskt och
publiceras aldrig själva. Kundmaterial i automatiska utkast kräver `consent='ja'` på
mediaraden innan utkastet kan renderas.

**Viktigt om statusnamnet:** det finns ingen status "BOKAD". Det heter `stage='won'` i
tabellen `cockpit_dm_contacts`. "Bokad" är enbart en svensk UI-etikett
(`app/dashboard/(inlagg)/dm/page.tsx:280`). Tabellen `dm_pipeline_contacts` i
`migrations/dm_pipeline.sql` är död legacy, migrerad i
`app/api/import/instagram-pro/route.ts:19`.

**Om Godkännanden:** `share_links` är byggd för *extern* mottagare och dess vy hanterar
bara `resource_type` `'social'` och `'blog'`
(`app/api/share/[token]/route.ts:17`, `app/granska/[token]/page.tsx:119`). R7:s förslag
är ägarens egen granskningskö, inte en extern delning. Därför `status='forslag'` i
`studio_reels`, synligt i Reels-sidan och innehålls-navet — inte via `share_links`.

---

## 8. Verifiering av v1

Skarpt slutprov för tenant Displayteknik.

Mall **Erbjudande**, idé:
> Skicka en bild på din butik så visar vi hur den ser ut med skärm, gratis montage och
> pris inom 24 timmar

Kör med AI-genererade bilder, rendera, visa filen. Kontrollera:
- 9:16, exakt 1080×1920
- texter innanför säkra zoner (topp 220, botten 450, sidor 35)
- inga tankstreck i overlays eller caption
- Ken Burns synlig
- spelbar fil under 25 MB

Kör därefter samma flöde en gång till med en **uppladdad egen bild** som scen 2, för att
bevisa eget material-spåret.

---

## 9. Byggregler för denna modul

- **Next.js 16.2.3.** Läs `node_modules/next/dist/docs/` innan kod skrivs. API:er och
  konventioner avviker från äldre versioner.
- **Service-role-mönstret gäller.** Nya tabeller har strikt RLS utan anon-policies och
  läses med `supabaseService()`. Se `lesson_brand_profile_anon_rls_silent_drop` — anon mot
  RLS-skyddad tabell ger tyst tomt resultat, inte fel.
- **Rör inget i FAS 1B-säkerhetsmönstren.**
- **Blockera inte höstlanseringens etapp 1** (schemaläggningskedjan, deadline 2026-08-02).
  Etapp 1 ligger som commit `d01b66e`.
- **Alla genererade texter** går genom `sanitizeGenerated()` innan de sparas eller visas.
- **Prioritetsordning i materialförslag:** eget material före AI och stock.

---

## 10. Kända gap utanför denna plan

- `IterateOptions.contentCompass` (`lib/iterate.ts:21,72`) sätts aldrig av någon anropare.
  `generateStudioCopy()` kör därför utan Compass-lagren och utan `WRITING_RULES_BLOCK` i
  prompten; endast efterhandssaneringen räddar resultatet. Egen uppgift.
- `app/api/studio/upload-url/route.ts:46-48` ger dubbelsuffix (`bild.jpg.jpg`).
- `editImagen` (`lib/images.ts:312`) saknar `assertSafePublicUrl` som resten av filen har.
- `app/api/social/generate-image/route.ts:53` tvingar `styleId='cinematic'` som default,
  vilket motsäger regel 1 i huvudet på `lib/images.ts:5-7`.
