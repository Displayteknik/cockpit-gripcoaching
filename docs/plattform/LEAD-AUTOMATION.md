# Leadautomation — L1 och L2

## L1 — Leadavisering. KLAR och LIVE (`62b9e30`)

Mejl till tenantens `report_recipients` vid varje nytt lead i Nya leads.

- `lib/lead-notify.ts` — `notifyNewLead()`, best-effort, kan aldrig fälla requesten som
  skapade leadet.
- Hookad i `POST /api/lobby/contacts` (täcker bild, röst, manuellt, formulär — alla fyra
  UI-källor går genom den routen) och i `app/api/coach/route.ts` (skapade leads utan
  avisering).
- **Inte** hookad i `app/api/lead/route.ts` (HM Motor) eller `app/api/lifeibalans/*` —
  de mejlar redan själva. Dubbelhook hade gett två mejl per lead.
- Djuplänk `/dashboard/leads?id=<uuid>` byggd (fanns inte).
- Per tenant: `clients.lead_notify_enabled`, default på.
- Verifierat: testlead Displayteknik → mejl skickat till hakan@displayteknik.se.

**GHL-synk aviseras inte.** `app/api/lobby/sync/route.ts` går åt andra hållet: den
pushar Cockpit-kontakter TILL GoHighLevel. Det finns ingen inkommande GHL-synk som
skapar leads i Nya leads idag. När den byggs anropas samma `notifyNewLead`.

---

## L2 — IG-DM och kommentarer in automatiskt

### Förutsättningen: mätt, inte antagen

Displaytekniks IG-koppling lever. `GET /{ig_account_id}` svarar 200 för `@displayteknik`
(konto `17841404822065836`). Token utgår **2026-09-25**.

Token-scopes (12 st, via `debug_token`) — de två vi behöver **finns**:

| Scope | Status |
|---|---|
| `instagram_basic` | har |
| `instagram_manage_comments` | **har** |
| `instagram_manage_messages` | **har** |
| `instagram_content_publish` | har |
| `instagram_manage_insights` | har |

Men skarpt anrop mot Messaging fallerar:

```
GET /{ig_account_id}/conversations?platform=instagram
→ (#3) Application does not have the capability to make this API call.
```

**Det här är avgörande och lätt att misstolka.** Felet är inte att token saknar scope,
utan att Meta-appen (`Display Engine AI`, app-id `2129511757816331`) saknar
**Instagram Messaging-förmågan i Live-läge**. Ett scope kan beviljas i en token utan att
appen har rätt att använda motsvarande API. Att bara begära om scopet löser ingenting.

Läsning av kommentarer fungerar däremot redan idag:

```
GET /{media_id}/comments?fields=id,text,username,timestamp  → 200
```

### Vad detta betyder för planen

| Delflöde | Går att bygga nu? |
|---|---|
| Läsa kommentarer på våra inlägg | **Ja** |
| Svara publikt på en kommentar | Troligen ja (samma scope). **Otestat** — ett POST lägger en publik kommentar på Displaytekniks riktiga konto, så det körs inte utan Håkans klartecken. |
| Skicka DM automatiskt | **Nej.** Blockerat på app-nivå. |
| Ta emot DM med bild via webhook | **Nej.** Samma blockering, plus att webhook-fältet `messages` kräver samma förmåga. |

Kärnan i din beskrivning, "kommentar med BILD eller PRIS → automatiskt DM-svar → kunden
skickar foto", **går alltså inte att bygga färdigt idag**. Steget som fattas är
Meta-godkännande, inte kod.

### Två vägar

**Väg A — ansök om Instagram Messaging hos Meta.** Krävs: appen i Live-läge,
Business-verifiering, App Review för `instagram_manage_messages` med skärminspelning av
flödet, samt publicerad integritetspolicy. Ledtid är typiskt veckor och utfallet är inte
i vår hand. Först därefter kan DM-delen byggas.

**Väg B — publik kommentarssvar plus uppladdningslänk. Rekommenderas som v1.**
Ingen ny Meta-behörighet behövs, och den passar Displaytekniks egen kundresa, där
steg 5 är "två låga trösklar" och en av dem redan är "skicka en bild".

```
kommentar innehåller BILD eller PRIS
  → publikt svar: "Kul att du frågar. Ladda upp en bild på fönstret här: <länk>,
     så har du pris inom 24 timmar."
  → länken går till en tenant-specifik uppladdningssida i Cockpit
  → bilden sparas i studio_media med source uploaded och kopplas till leadet
  → lead skapas i Nya leads, kort läggs i DM och Pipeline
  → L1-aviseringen går ut
```

Väg B ger hela kedjan från kommentar till avisering utan att vänta på Meta, och
uppladdningssidan blir återanvändbar för R6 (inmejlning) senare.

### Teknisk spec, gemensam för båda vägarna

**Webhook-endpoint** `app/api/instagram/webhook/route.ts`

- `GET` — Metas verifiering: jämför `hub.verify_token` mot `IG_WEBHOOK_VERIFY_TOKEN` och
  eko:a `hub.challenge` som ren text. Utan detta registreras aldrig prenumerationen.
- `POST` — signaturkontroll `X-Hub-Signature-256` (HMAC-SHA256 över rå body med appens
  secret) **innan** något annat. Ogrindad webhook är en öppen dörr.
- Svara `200` inom några sekunder och lägg allt arbete i en kö. Meta gör om leveransen
  vid timeout, vilket annars ger dubbla leads.
- Idempotens: spara Metas `id` per händelse i en `ig_events`-tabell med unikt index.
  Samma händelse levereras mer än en gång, det är normalt.
- Routen måste undantas från admin-grinden i `proxy.ts` (Meta skickar ingen cookie), och
  grindas i stället enbart på signaturen.

**Kommentarstrigger**

- Prenumerera på fältet `comments`.
- Nyckelordsmatchning på hela ordet, skiftlägesokänsligt: `BILD`, `PRIS`.
- Svara **en gång per kommentar**, aldrig på egna kommentarer (`username` == kontots eget)
  och aldrig på en kommentar vi redan svarat på (idempotensnyckeln).
- Takgräns per konto och dygn, så en viral tråd inte spammar.

**Bild in → lead**

- Bilden går genom `adoptReelMedia({ source: "uploaded" })`, samma väg som reels-materialet,
  och hamnar i `studio_media` med proveniens.
- Lead skapas via samma väg som Nya leads använder, så L1-aviseringen triggas automatiskt.
- Kort i DM och Pipeline: `cockpit_dm_contacts` med `stage: "new"`.
  **Obs:** kolumnen heter `stage`, och "HEJ-kolumnen" motsvarar `stage = 'new'` (etiketten
  "Ny" i `app/dashboard/(inlagg)/dm/page.tsx`). Det finns ingen `status`-kolumn och inget
  värde som heter HEJ.

**DM-co-pilot-principen (hård regel)**

Det automatiska svaret på kommentaren är **det enda** utskick som sker av sig självt.
Allt därefter formuleras som förslag och skickas av en människa. Ingen automatik får
skriva i en pågående dialog. Detta speglas i koden genom att bara kommentarssvaret har en
egen skrivväg; övriga förslag landar i befintlig förslagsvy.

**Meddelandefönstret** (gäller Väg A) — Instagram tillåter fritt DM-svar i 24 timmar
efter kundens senaste meddelande. Efter det krävs en godkänd mall. Bygg aldrig ett flöde
som antar att fönstret är öppet.

**Env som behövs:** `IG_WEBHOOK_VERIFY_TOKEN`, `IG_APP_SECRET`.

### Etapper

| Etapp | Innehåll | Beroende |
|---|---|---|
| L2a | Webhook-endpoint med verifiering, signaturkontroll, idempotens, händelselogg | ingen |
| L2b | Kommentarstrigger + publikt svar + uppladdningslänk (Väg B) | Håkans OK att posta publikt |
| L2c | Uppladdningssida → studio_media → lead → DM-kort → L1-avisering | L2b |
| L2d | DM in och ut (Väg A) | Metas godkännande |

### Öppen fråga till Håkan

Ska jag testa ett publikt kommentarssvar skarpt på ett av Displaytekniks inlägg? Det är
enda sättet att veta om `instagram_manage_comments` räcker för POST, men det lägger en
riktig, publik kommentar på kontot. Jag gör det inte utan klartecken.
