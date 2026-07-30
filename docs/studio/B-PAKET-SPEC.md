# B-paketet — Studio & Bildhjälpen förbättringar (spec)

Upptäckt vid skarp körning för Displayteknik 29–30/7. Tre etapper, alla tenants.

## B1 — Grundade text-på-bild-förslag (LEVERERAD `203eea2` + `7f38f83`)

Förslagen genereras ur (1) inläggets grundtext (`caption` i sessionen) och (2) bildens innehåll:
Bildhjälpen-bilder bär sin scenbeskrivning (`suggest-image` returnerar `description`, klienten
kopplar den till bild-URL:en), övriga bilder analyseras via Gemini-vision — **alltid med
grundtexten som kontext** (en blank lapp är "neutral" av pixlar ensamma men "problem" i berättelsen).

Roll styr förslagstyperna (`tillatnaHooks` i `lib/studio/copy.ts`):
- problembild → fråga / konträr / berättelse (aldrig säljande påstående ovanpå problemet)
- lösningsbild → påstående / konträr / berättelse
- statistik → **bara när tenanten har verifierade siffror** (`profilHarSiffror`: %/kr/tal ≥1000 i
  Brand-profilen). Annars döljs typen helt: ur variantSuffixes, ur deterministiska filtret, och
  prompten säger "inga siffror alls". Dessutom backas VARJE genererad siffra som hel token mot
  profilens tal (`harObackadSiffra`) — fångar även små kvoter som "3 av 4 butiker".

Styrningen är dubbel: prompt (variantSuffixes) + deterministiskt filter i urvalsloopen som
modellen inte kan prata sig runt.

## B2 — Fritt placerbara textrutor

**Datamodell:** sex nya fält i `StudioOverrides` (`lib/studio/payload.ts`):
`h1X,h1Y,h2X,h2Y,bodyX,bodyY` — offset i % av canvasmått från mallens naturliga position,
0 = mallens standard, klampas ±100. Ligger i overrides ⇒ sparas i inläggets payload och läses av
BÅDE live-editorn och export-PNG:n (samma React-komponent, `captureDesignBlob`) ⇒ positionen
följer automatiskt med till förhandsvisning, publicering och sparade inlägg. Reels-scenernas
overlay ritas redan programmatiskt med egen safe-zone-layout; B3:s programmatiska fallback
använder samma positionslogik (posY i % + IG-safe default).

**Rendering:** helper `dragPos(p, role)` i `lib/studio/overrides.ts` → `transform: translate(px)`.
Arketyperna märker sina textblock `data-drag="h1|h2|body"` och spreadar `dragPos`.

**Interaktion (StudioEditor):** i standardläget mäts `[data-drag]`-noderna och får varsitt
dragglager ÖVER bild-dragytan. Pointer events (mus + finger). Under drag:
- stödlinjer: vertikal/horisontell centrumlinje visas + snäpp när blockets centrum är inom ~1,5 %
- varningszon: nedre 20 % tonas röd med etikett "Täcks ofta av Instagrams gränssnitt"
- positionen skrivs kontinuerligt till overrides via `onTextPatch` (samma mönster som bilddrag)

## B3 — Stavningssäker text i genererade bilder

**Kärna:** `lib/studio/text-in-image.ts` (server-only):
1. `lasTextIBild(image)` — Gemini-vision läser av exakt synlig text (temp 0).
2. `normaliseraText(s)` — gemener, radbrytningar/whitespace → ett mellanslag, skiljetecken i
   kanterna bort. å/ä/ö är SIGNIFIKANTA (det är poängen).
3. `genereraMedExaktText({ scen, text, aspekt, stil })`:
   - Försök 1–3: förstärkt promptinstruktion (exakt sträng i citattecken, "spelled exactly,
     letter by letter", språk = svenska) → generera → vision-avläsning → normaliserad jämförelse.
     Match ⇒ klart, `metod: "ai"`, försöksantal loggas.
   - Efter 3 missar ⇒ **programmatisk fallback**: samma scen UTAN textinstruktion (+ "blank
     surface, no text"), texten renderas ovanpå server-side via Next inbyggda `ImageResponse`
     (satori + resvg, inga nya beroenden) med självhostade TTF:er:
     handskrift (Caveat, OFL) för lappar/skyltar, tenantens profiltypsnitt för overlays.
     Programmatisk text är stavningssäker per konstruktion. `metod: "programmatisk"`.
   - Resultatet bär alltid `{ metod, forsok, verifierad, avlastText }` — UI:t visar godkänt,
     eller bästa försöket med varningen "Texten i bilden avviker: [avläst text]".

**UI:** eget fält "Text i bilden" i Bildhjälpen (StudioMaker) och i Reels-scenernas
bildgenerering (ReelSceneMedia) — inte inbakat i friprompten. Reels-vägen tar bort sitt
"Avoid readable words"-förbud när exakt text begärts och kör samma slinga i 9:16.

## Verifiering (bevisas med faktisk output)
1. B1: problembild ⇒ förslag är problem/fråga; tenant utan verifierade siffror ⇒ ingen statistik-typ.
2. B2: drag + stödlinjer + varningszon; position överlever i payload → export-render (computed transform).
3. B3: "Öppet i sommar", "Välkommen in", "Rea på fönsterskärmar" — visa fångade fel, försök per
   bild, och att fallbacken ger korrekt text när den behövs.
