# BILD-paketet — Studios bild- och publiceringsflöde (spec)

Skarp testkörning med ny tenant (HM Motor) 30/7. Mål: användaren ska ALDRIG behöva öppna
Canva/externt verktyg för att anpassa ett foto till IG. Alla etapper gäller alla tenants.

## Verifierad rotorsak (läst i kod, inte gissad)
`StudioMaker.tsx` rad ~1025: i Skriv eget-läget publiceras **råfotot** —
`designUrl = mode === "simple" ? imageUrl : …`. "Vertikal fokuspunkt"-reglaget styr bara
mallarnas `objectPosition` och har därför NOLL effekt på det som publiceras i simple-läget.
Liggande mobilfoton skickas råa till IG som beskär dem blint. Mall-läget har däremot redan
interaktiv pan/zoom direkt i previewn (drag + scroll, WYSIWYG via samma komponent som exporten).

## BILD-1 — Inbyggd bildredigering i steg 3 (högsta prio)

**Datamodell (additiv, i payload):**
`imageEdit: { ratio, fit: "beskar" | "hela", crop: { x, y, w, h } | null, fill: "blur" | "farg", zoom }`
— `crop` normaliserad mot originalbilden (0–1), följer med i sparade inlägg/utkast.
Per-slide-variant på `slides[i]` i karusell (v1.1). `ratio`: 4:5 / 1:1 / 1.91:1 / 9:16.
VIKTIGT förenklande fynd: Skriv eget-läget har inget formatbegrepp idag (formatväljaren är
mallarnas) — ration bor därför i `imageEdit`, INGEN ny StudioFormat behövs (noll ripple i
mallar/publiceringsvägar). EXIF-rotation hanteras via `createImageBitmap(..., { imageOrientation:
"from-image" })` — mobilfoton är ofta roterade i metadata.

**Pixelparitet per konstruktion:** EN ren funktion `renderImageEdit(original, edit, w, h)`
(canvas, client-side) producerar publiceringsbilden. Previewn visar SAMMA funktions output
(dataURL) efter varje ändring — det som syns ÄR publicerings-pixlarna, ingen separat
CSS-approximation som kan glida. Vid publicering laddas exakt denna PNG/JPEG upp och blir
`designUrl` (ersätter råfoto-vägen i simple-läget).

**UI (`components/studio/BildRedigerare.tsx`), ersätter fokuspunkt-reglaget:**
1. Interaktiv beskärningsvy: HELA originalet visas, beskärningsram i valt formats proportion
   ovanpå, bortklippt yta nedtonad. Ramen flyttas med drag (pointer events = mus + touch),
   zoom via reglage + pinch (två pekare).
2. Formatväljare i samma steg med live-effekt. Default liggande foto: 1:1 centrerad.
3. "Hela bilden"-läge: originalet intakt (contain) på autogenererad bakgrund —
   blurrad version av samma bild ELLER enfärgad yta från klientens grafiska profil.
   Standardknepet som gör att liggande bilbild funkar i 4:5 utan att kapa fronten.
4. Matchar bilden redan formatet (±2 %): neutralläge — verktygen syns, ingen beskärning satt.
5. Gäller: Skriv eget (singel + story/reels-omslag = 9:16). Mall-läget behåller sin
   befintliga direkta pan/zoom i previewn (redan WYSIWYG); fokuspunkt-reglaget tas bort och
   ersätts av hänvisningen "dra i bilden". Karusell per slide: v1.1 (slides är mall-zoner
   med befintlig drag; "Hela bilden" per slide läggs där i nästa steg).

**QA:** preview-dataURL jämförs binärt med publicerings-uppladdningen (samma anrop) +
qa-screen preview vs publicerat.

## BILD-2 — Karusellflödet respekterar användarens material
1. Manifest före generering: ämne + befintliga slide-bilder + befintlig text inventeras.
2. "Skapa karusell" genererar ENDAST luckor: slides med egen bild behåller den exakt
   (AI kompletterar text), nya slides skapas bara där bild saknas.
3. Destruktiv ändring (ersätta befintlig bild/text) kräver diff-dialog, default **Behåll**.
4. Autospar av utkast (localStorage-draften finns redan — utökas till varje slide-ändring).
5. Regressionstest med qa-screens.

## BILD-3 — Publiceringskvitto och felpresentation
1. Felmappning Graph API → klartext med åtgärd (`lib/studio/graph-fel.ts` som DATA):
   "Tried accessing nonexisting field" / "Object with ID does not exist" → "Det här ser ut
   som ett sid-id — fältet vill ha Instagram-kontots id som börjar med 17841…".
2. Id-validering i formulären FÖRE anrop: IG-id `^17841\d+`, page-id numeriskt, token `EAA`-prefix.
3. Kvittovy efter lyckad publicering: direktlänk till inlägget, tid, tenant, format.

## ANSLUT-1..4 — efter BILD-etapperna (oförändrad scope, se ANSLUTNINGSMOTORN.md)
DT + HM Motor rörs inte (permanenta sidtokens). Inga tokens i loggar/client bundle.

## BILD-7 — bildpromptens kärnregler (KVALITET-2 del B)

Tre plattformsregler i centrala lager. Inga tenant- eller branschundantag: samma krav
gäller blomsteraffär, bilhandlare och coach. Bevis: `docs/studio/bild7-exempel/`
(fem före/efter-par, två tenants), tester i `tests/bild7-bildprompt.test.ts`.

**7a — avbildat exempelinnehåll ska ha RELEVANS *och* BUDSKAP** (`lib/images.ts`).
Allt som porträtteras som innehåll i scenen (skärmar, skyltar, menytavlor, affischer,
dokument, förpackningar) ska vara trovärdigt och relevant både för verksamheten och för
inläggets budskap — aldrig dekorativ utfyllnad. Syns tenantens produkt eller miljö ska
bilden samtidigt visa VERKLIG ANVÄNDNING. Regeln är delad i två halvor:
`DEPICTED_RELEVANCE_*` gäller alltid (även i flöden som förbjuder läsbar text, t.ex.
reels), `DEPICTED_MESSAGE_*` gäller där avbildad skyltning får bära text och kräver
BÅDE motiv OCH en kort rad (erbjudande, pris, event eller tid) — menyskärm visar rätten
plus "DAGENS LUNCH 129 KR". Budskapstexten är svensk, tankstreckfri (bygger på BILD-6a)
och får aldrig vara en CTA som konkurrerar med inläggets.
Det gamla blanka "inga texter, inga bokstäver" är ersatt: pålagd rubrik/uppmaning/logotyp
är förbjuden, skyltning som hör hemma i miljön ska säga något. Förbudet stoppade ändå
aldrig modellen från att rita skyltar — det gjorde dem bara innehållslösa.
KVARSTÅENDE: stavningen i avbildad text kan inte garanteras på promptnivå. Exakt text
går via "Text i bilden" (B3) med vision-grind och programmatisk fallback.

**7b — motivvariation i säsongslagret** (`lib/content/sasong.ts`). Markörlistan innehåller
bara HÖGTIDER, så den närmaste vann varje generering (kräftskiva i tre av fem
testbilder). `sasongsUttryck()` ger nu årstidens bredare uttryck — ljus, väder,
växtlighet, rytm, miljö — i ett roterande urval (frö injicerbart för test, slumpat i
drift). Både `sasongsPromptRad` (sv) och `seasonPromptLineEn` (en) bär variationsregeln.
Uttrycken är branschneutrala: de beskriver stämning, aldrig produkt. Flöden med egen
historik skickar `nyligenMotiv` → "välj ett annat den här gången" (social-flödet läser
`hm_social_posts.image_prompt`; ingen ny datamodell).

**7c — färgton mot grafisk profil** (`lib/studio/kit.ts`). `fargTon()` tolkar profilens
färgtemperatur språkoberoende — brand-kit-agenten skriver "varm-naturlig", formuläret
skriver "warm". Den gamla likhetsjämförelsen mot exakt "warm" gjorde att tenanter tyst
tappade sin ton. Direktivet säger nu konkret vad tonen betyder och att den går före en
neutral/dämpad behandling (signaturens "muted desaturated palette" vann annars). Fortsatt
bara färg och ljus — motivet ägs av budskapet.
