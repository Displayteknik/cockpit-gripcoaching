# Cockpit Innehållsstrategi — en total enhet (v1)

> Skriven 2026-07-16 (Fable 5). Status: **STRATEGI KLAR — väntar på Håkans godkännande innan Etapp F byggs.**
> Överordnar `docs/studio/PLAN.md` och `docs/studio/BRAND-KIT-PLAN.md` för allt som rör innehåll i Cockpit.
> Utlösande insikter (Håkan 2026-07-16): (1) det finns flera bloggverktyg — måste säkras till ett,
> (2) inläggsmotorn är Opticur-formad — coaching/tjänsteföretag behöver andra format (mer text, overlay på bild),
> (3) motorerna vi redan byggt (IG-motorn, LinkedIn-motorn, Studio) måste sättas ihop till EN genomtänkt enhet.
> Förebild för känslan: MySales Coach-dashboarden — guidat stegflöde, statusbadges, allt på ett ställe.

---

## 0. Två hårda principer (gäller varje beslut nedan)

1. **Grymma verktyg, enkla att använda.** Varje flöde = max 3 beslut per steg, AI-förslag som default,
   och användaren ser ALDRIG verktyg/format som inte gäller den aktiva klienten. Kraften bor i motorn,
   inte i antalet knappar.
2. **En sak finns på ett ställe.** Ett bloggflöde. En kalender. Ett publiceringssteg. Dubbletter är buggar.

---

## 1. Nuläge — verifierad karta (2026-07-16, mot kod)

| Verktyg (meny) | Skapar | Lagring | Publicerar via | Kalender |
|---|---|---|---|---|
| **Skapa inlägg** (IG-motorn) | 7 format: single, carousel, reel, photo_overlay, big_stat, before_after, long_form + veckodags-logik + IG-preview | `hm_social_posts` | Scheduler → **IG Graph API** (`scheduled_posts`, cron) + granska-länkar | Veckoplan + Schemalägga |
| **LinkedIn-motorn** | Pelare→idéer→skrivare→post-bank (text-först) | `linkedin_pillars/posts/history` | Manuell kopiering | Egen historik |
| **Studio** | 5 arketyper + 2 Opticur-mallar (affisch: text PÅ bild, deterministisk PNG) | `studio_posts` | **GHL Social Planner** (utkast/schemalagt) | Publiceringsöversikt |
| **Blogg-maskin** + Blogg-arkiv | Outline-först, idéer, kö, cron, interna länkar | `hm_blog_queue` → `hm_blog` | **Cockpit-native sajt** (HM Motor `/blogg/[slug]`) | Kö-status |
| **Studio → Blogg → GHL** | SEO-artikel (interna länkar från live-sajt, FAQ-schema, omslagsbild) | — (direkt) | **GHL Blogs** (utkast) | — |
| **Grafisk profil** (Brand Kit) | Färgroller, logga, typsnitt, element, bildstil, donts | `studio_brand_kits` | — (försörjer allt ovan) | — |

**Fyra strukturproblem:**

1. **Två bloggspår.** Blogg-maskin (→ Cockpit-native) och Studio-bloggen (→ GHL Blogs) är två separata
   pipelines med olika styrkor. Användaren ska inte behöva veta vilken som är "rätt".
2. **Affisch-paradigmet.** Studios arketyper är retail-affischer (Opticur-DNA). GripCoaching/Ledarskapskultur
   behöver: foto med text-OVERLAY, citat, karuseller, text-först-inlägg där bilden är stöd. De formaten
   FINNS redan (IG-motorns photo_overlay/carousel/long_form) — men i en annan motor, utan Studios
   deterministiska render och utan brand kit.
3. **Två publiceringsvägar + två kalendrar.** IG Graph (Skapa inlägg) respektive GHL Social Planner (Studio);
   Veckoplan/Scheduler respektive Publiceringsöversikt. Ingen samlad bild av "vad går ut den här veckan".
4. **Klienttyps-blindhet.** Alla klienter möter samma verktygsmix oavsett om de är retail (Opticur),
   coach (GripCoaching), konsult (CF) eller B2B-tech (Displayteknik).

---

## 2. Målbild — "Innehåll" som EN upplevelse

En enda mental modell, samma för alla kanaler (som MySales Coach-pipelinen):

```
IDÉ ──► SKAPA ──► GRANSKA ──► PUBLICERA ──► FÖLJ UPP
 │        │          │            │             │
 idé-    text +     preview,     EN publicerings- analytics,
 bank,   visuellt   voice-check, modul: IG Graph · återanvänd
 ämnen   (format-   godkännande  GHL Social ·      (repurpose)
         bibliotek)              GHL Blogs · native
```

- **Innehålls-navet** (`/dashboard/innehall`): landningssida i MySales Coach-stil — stegen ovan som
  klickbara kort med statusbadges per klient ("3 utkast", "2 schemalagda denna vecka", "blogg publicerad ons").
  Befintliga motorer blir stegens verkstäder — de rivs inte, de får en gemensam ingång och ett gemensamt slut.
- **En kalender**: Publiceringsöversikten växer till att visa ALLT (hm_social_posts + studio_posts +
  linkedin_posts + blogg) med kanal-ikoner och status. Veckoplanen blir en vy i samma kalender.
- **Ett publiceringssteg**: en publiceringsmodul med kanalval per klient (IG direkt, GHL Social Planner,
  GHL Blogs, Cockpit-native). Motorerna anropar samma modul — aldrig egna publiceringsknappar med olika beteende.

---

## 3. Formatbiblioteket — rätt format per klienttyp (löser problem 2)

### 3.1 contentProfile (ny nyckel i `studio_brand_kits.kit`)

```jsonc
"contentProfile": {
  "clientType": "retail | coach | consultant | b2b-tech | automotive",
  "textWeight": "poster | balanced | text-first",   // hur mycket text vs bild
  "formats": ["overlay", "quote", "carousel", "poster", "list", "statement", "offer", "text-only"],
  "overlayStyle": "scrim-bottom | scrim-full | band", // hur text läggs på foto
  "defaultChannelMix": { "instagram": true, "facebook": true, "linkedin": false }
}
```

Sätts av auto-agenten (förslag ur profilen) + justeras i Grafisk profil.
**VIKTIGT (Håkan 2026-07-17): `formats` är en REKOMMENDATION, inte ett filter.** ALLA klienter har alltid
tillgång till ALLA format — man väljer per inlägg vad som passar just nu. `formats` sorterar bara de
föreslagna först och ger en "Föreslås"-markering. Flexibilitet byggs aldrig bort.

### 3.2 Nya arketyper (Studio-render, brand-kit-drivna som de fem befintliga)

| ID | Format | För | Beskrivning |
|---|---|---|---|
| `ark-overlay` | Foto + text-overlay | Coach/tjänst | Fullbleed-foto, mörk scrim (stil ur `overlayStyle`), rubrik + kort text I bilden, logga diskret. Det Håkan pekar på för GripCoaching/CF. |
| `ark-karusell` | Karusell (N slides → N PNG) | Alla | Hook-slide + 3–5 punkt-slides + CTA-slide. Payload utökas med `slides[]`. Render-routen tar `&slide=n`. Ersätter IG-motorns HTML-mockup med riktiga brand-kit-renders. |
| `ark-textkort` | Text-först-kort | Coach/konsult/LinkedIn | Typografiskt kort (lång text, luftigt, citat-känsla) för inlägg där texten är huvudsaken och kortet är stödet. |

Befintliga fem (foto-ruta, statement, citat, lista, erbjudande) behålls — retail/kampanj-familjen.
**Totalt 8 arketyper = formatfamiljer.** Kombinationen `contentProfile.formats` avgör vilka en klient ser
(Opticur: poster/offer/lista · GripCoaching: overlay/quote/carousel/text-only · Displayteknik: statement/lista/carousel).

### 3.3b Kanaler, format & video (Håkan 2026-07-17 — "IG-stilen tillbaka")

Ett inlägg väljer **kanal + format + stil** när du jobbar — full frihet, förvalt smart. Matrisen:

| Kanal | Format | Storlek | Render/medium | Status |
|---|---|---|---|---|
| Instagram | Feed-bild | 1080×1350 / 1080×1080 | Studio-PNG (8 arketyper) | KLART |
| Instagram | Story | 1080×1920 | Studio-PNG (9:16-arketyper) | H1 — nytt format |
| Instagram | Karusell | N × 1080×1350 | Studio multi-PNG (`ark-karusell`) | H2 |
| Instagram | Reel | 1080×1920 video + cover | **video-asset + text-cover + caption** | H3 — video |
| Facebook | Feed / story | samma som IG | delad render | H1 |
| LinkedIn | Bild / dokument-karusell | 1080×1080 / PDF | Studio-PNG / PDF | senare |

**Video/reels — så löser vi det realistiskt (Studio är PNG-deterministisk, inte videoredigerare):**
1. **v1 (H3):** ladda upp/välj video → Studio genererar en **9:16 text-cover** (overlay-arketyp i 1080×1920) + caption → publiceras som Reel via IG Graph (video-fil + cover). Ingen text bränns in i själva videon än — snyggt, enkelt, funkar nu.
2. **v2 (senare):** bränn in overlay-text/undertext i videon (ffmpeg/tjänst) — "video/bild+text" som rörligt. Egen etapp, tyngre infra.

**Nya format-nycklar i `contentProfile.formats`** (fortsatt rekommendation, aldrig filter): `story`, `reel`, `video`.
**Nytt storleksstöd:** `StudioFormat` utökas med `1080x1920`. Arketyperna får 9:16-läge (overlay/statement/citat/textkort funkar utmärkt stående).

### 3.3 IG-motorn och Studio växer ihop (inte två motorer till en tredje)

- **Texthjärnan är redan gemensam** (voice-fingerprint, hooks, `generateStudioCopy`) — behålls som enda textkälla.
- IG-motorns formatval (photo_overlay, carousel …) mappas till arketyperna → "Skapa inlägg" får
  **riktiga brand-kit-renders som preview** i stället för handbyggd HTML-mockup.
- Studio slutar vara "en egen ö" och blir Cockpits **bildfabrik** — alla motorer som behöver ett visuellt
  anropar samma render (`/studio/render/<arketyp>?p=…`).

### 3.3c ★ BESLUT (Håkan 2026-07-17): var Instagram "blir klart"

**Instagram-delen görs klar i Studio + den gemensamma kalendern/publiceringen — INTE i det gamla
"Skapa inlägg"-mockup-verktyget.** Motiv: den gamla Inlägg-motorns visuella preview var HTML-mockuper,
inte riktiga renderingar. Studio gör nu äkta, on-brand, redigerbara renderingar (brand kit + editor).
Att bygga story/reel/karusell både i gamla verktyget OCH i Studio = bygga bort "en enhet"-principen.

- **Studio = MAKAREN** (format, renderingar, editor, brand kit). Reels/story/karusell byggs HÄR (Etapp H).
- **"Skapa inlägg"-sidan pensioneras** → blir en tunn genväg till Studio (val (b) valt; val (a) = bygga om
  gamla sidan till Studio-renders förkastat pga dubbelunderhåll). Görs i Etapp I (nav-städ).
- **Inlägg-motorns HJÄRNA vävs in, byggs ej om:** 4A-veckorytm/veckodagslogik → kalendern (Etapp I);
  DM & Pipeline + Analys → egna vyer i innehålls-navet (Etapp I); IG Graph direkt-publicering → den
  gemensamma publiceringsmodulen bredvid GHL Social Planner (Etapp J).
- Kort: Studio ritar, IG-motorns rytm/pipeline/analys/IG-publicering lever vidare runt omkring.

---

## 4. Bloggen — ETT flöde, tre destinationer (löser problem 1)

Ny gemensam modul **"Blogg"** (ersätter både Blogg-maskin och Studio→Blogg i menyn; motorerna under huven behålls):

```
Idé/ämne ──► Outline (godkänn) ──► Artikel ──► Granska ──► Destination:
                                                            ├─ GHL Blogs (utkast)        ← kunder på GHL-sajt
                                                            ├─ Cockpit-native (hm_blog)  ← HM Motor m.fl.
                                                            └─ Endast utkast/export
```

- **Bästa av båda:** Blogg-maskinens outline-först + idé-bank + kö/cron **plus** Studio-bloggens
  interna länkar från live-sajten, FAQ-schema, omslagsbild ur bildstilen.
- Destinationen är **per klient förvald** (GHL-kopplad klient → GHL Blogs; HM Motor → native) — användaren
  väljer bara om hen vill avvika. Ett beslut, inte tre.
- Repurposing-steget ("gör om till sociala inlägg") ligger kvar som steg 4 och använder contentProfile
  för arketypval (coach → overlay/textkort, retail → poster).

---

## 5. Publicering & kalender — en modul, en vy (löser problem 3)

- **Publiceringsmodulen** (`lib/publish/`): ett API som tar `{ innehåll, kanaler[], när }` och routar till
  IG Graph / GHL Social Planner / GHL Blogs / hm_blog. Statusmodell delas: `draft | scheduled | published | failed`.
- **Kalendern**: Publiceringsöversikten byggs ut till hela innehållsflödet (alla tabeller, kanal-ikoner,
  klicka → öppna i rätt verkstad). Veckoplan blir "vecko-vyn" av samma data.
- Befintliga cron-jobb (IG-publish, blogg-kö) behålls — de rapporterar bara in i den gemensamma statusmodellen.

---

## 6. Enkelhets-kontraktet (UX-regler, hårda)

1. Max **3 beslut per steg**; allt annat är AI-förslag med "ändra"-möjlighet.
2. **Rekommendation, inte bortfiltrering**: alla format/kanaler finns ALLTID tillgängliga — profilen
   sorterar och markerar det som passar ("Föreslås"), men tar aldrig bort val. Enkelhet genom bra
   default + tydlig vägledning, inte genom att gömma kraft. (Destinationer/kanaler kan förväljas men
   alltid bytas.)
3. **Förslag först**: varje tomt fält har en "Föreslå"-knapp som drar från profil + brand kit + historik.
4. **Statusbadges överallt** (MySales Coach-mönstret): Aktiv/Utkast/Schemalagd/Publicerad — alltid synligt
   var innehållet befinner sig.
5. **Aldrig fråga om det vi vet**: destination, kanal-mix, format-mix, färger, röst — allt är förvalt ur
   klientens profil/kit. Användaren kör på Enter, justerar vid behov.

---

## 7. Etapper (hårda stopp, MVP-först)

| Etapp | Innehåll | Verifiering | Värde |
|---|---|---|---|
| **F — Blogg-konsolidering** | En "Blogg"-modul med destinationsväljare (förvald per klient); Blogg-maskin + Studio-blogg-sidorna pekas om/slås ihop; menyn städas | Blogg → GHL-utkast för Displayteknik OCH native-publicering för HM Motor genom SAMMA flöde | Tar bort förvirringen NU |
| **G — Formatbiblioteket** | `ark-overlay` + `ark-textkort` + `contentProfile` (+ agent-förslag); klient-filtrerad formatvisning | Overlay + textkort exporterade för GripCoaching + CF + Opticur, Håkan godkänner varje arketyp | Löser coaching/tjänst-gapet — störst innehållsvärde |
| **H — Kanaler & format (IG-rikedomen)** | H1: 9:16-storlek (`1080x1920`) för story/reel-cover + kanalval (IG/FB) med rätt mått. H2: `ark-karusell` (slides[], multi-PNG). H3: reel/video (video-asset + 9:16 text-cover + caption → IG Graph reel) | Story renderad 9:16 för 2 klienter; 5-slide-karusell; ett reel-utkast med cover+video | Full IG-stil tillbaka: feed/story/karusell/reel per kanal |
| **I — Innehålls-navet + en kalender** | `/dashboard/innehall` (stegkort, statusbadges) + Publiceringsöversikten läser alla innehållstabeller; meny-grupperna städas | Navet visar korrekt status för 3 klienter; kalendern visar IG + Studio + blogg samtidigt | Helheten blir EN upplevelse |
| **J — En publiceringsmodul** | `lib/publish/` + Skapa inlägg och Studio anropar samma modul; gemensam statusmodell | Samma inlägg → IG Graph OCH GHL Social Planner via ett steg | Sista dubbletten borta |

Ordningen är vald så att varje stopp lämnar Cockpit bättre än före: F städar risken, G/H ger innehållsvärdet,
I/J förseglar helheten. Opticur påverkas inte negativt i någon etapp (premium-mallarna orörda).

---

## 8. Öppna frågor (defaults om du inte vet)

1. **Menynamn för navet:** "Innehåll" som egen grupp överst (ersätter splittringen Studio/Inlägg & Social)?
   *Default: ja — en grupp "Innehåll" med Navet, Skapa, Blogg, Kalender; gamla ingångar behålls som redirects.*
2. **LinkedIn-motorn** in i navet redan i Etapp I (läs-status) men behåller sitt eget arbetsflöde tills vidare?
   *Default: ja — full integration är en senare etapp.*
3. **Veckoplanen**: ersätts av kalenderns veckovy i Etapp I, eller kvar parallellt en övergångsperiod?
   *Default: kvar parallellt tills Håkan bekräftat att kalendern täcker allt.*

---

## 9. Prompt för nästa fas (klistra in när du vill köra)

> **Kör Etapp F + G enligt `docs/CONTENT-STRATEGI.md`:**
> F: konsolidera bloggen till EN modul med destinationsväljare (GHL Blogs | Cockpit-native | utkast),
> förvald per klient, bästa funktionerna från båda pipelines (outline-först, idé-bank, interna länkar,
> FAQ-schema, omslagsbild). Städa menyn.
> G: bygg `ark-overlay` + `ark-textkort` + `contentProfile` i brand kit (agent föreslår ur profilen),
> klient-filtrerad formatvisning. Verifiera med export för GripCoaching + Ledarskapskultur + Opticur.
> Hårt stopp + visuell granskning efter varje etapp. Följ enkelhets-kontraktet (§6).
