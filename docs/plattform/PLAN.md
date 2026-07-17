# MySales Pro-plattformen — PLAN (entitlements, roller, kundvy, publicering)

**Status:** Fas 0 (inventering) klar — väntar på Håkans godkännande innan Fas 1.
**Datum:** 2026-07-17. **Repo:** `Displayteknik/cockpit-gripcoaching` (`hmmotor-next/`), Next 16 + Puck + Supabase.

Detta dokument är Fas 0-leveransen: nuläge, datamodellförslag (Fas 1), fil-/routingstruktur och öppna frågor.
Affärsbeslutet (MySales Pro = GHL-bas + entitlement-styrda Cockpit-moduler) är fastställt och ifrågasätts inte här.

---

## 1. NULÄGE (kartlagt i kod, inte gissat)

### 1.1 Auth & roller — finns redan, men inte namngivna som "roller"
Ingen Supabase Auth. Två cookie-baserade sessioner:

| Sessionstyp | Mekanism | Motsvarar kickoffens roll |
|---|---|---|
| **Full admin** | `admin_session` HMAC-cookie, payload `<exp>` | **owner** (Håkan — allt, alla tenants) |
| **Klient-scopad admin** | samma cookie, payload `<exp>~<client_id>` (signaturskyddad) | mellanting — inloggning låst till EN tenant (HM Motor, CF) med bantat dashboard-nav |
| **Kund-session** | `customer_token` HttpOnly-cookie → slås upp mot `clients.customer_token` | **customer** (en tenant, `/k`-portalen) |

- `lib/admin-auth.ts` — HMAC sign/verify, `getSessionScope`.
- `lib/api-auth.ts` — `requireAdmin()`, `requireAdminOrCustomer()`.
- `lib/client-context.ts` — `getActiveClientId()` / `resolveClientId()`: **hård tenant-lås** — en kund-session ignorerar helt den manipulerbara `active_client_id`-cookien och returnerar alltid kundens egen `client_id`. Detta är redan bevisad multi-tenant-säkerhet.
- `lib/customer-context.ts` — `getCustomerSession()`, `requireCustomerFeature(key)` (serverside modul-spärr, **finns redan**).
- `proxy.ts` — grindar `/dashboard` + `/admin` (sidor) och alla `/api` (fail-closed default, med publika/cron/kund-undantag).

**Slutsats:** rollmodellen finns i praktiken redan (owner = full admin, customer = kund-session). Kickoffen formaliserar den och lägger till per-användar-mappning.

### 1.2 Entitlements — finns redan (enkel version)
- `clients.customer_features text[]` + `clients.customer_access_enabled bool` + `clients.customer_token`.
- `lib/customer-features.ts` — `CUSTOMER_FEATURES` (7 moduler, hårdkodad TS-lista) + `normalizeFeatures()` (NULL = alla, bakåtkompat).
- `/dashboard/kund-access` ("MySales Pro-access") — admin togglar moduler per aktiv klient, slår på/av access, roterar token. **Detta är fröet till Fas 4 Vy 2.**

**Gap mot kickoffen:** modulerna är hårdkodade strängar (ingen DB-registertabell); ingen Pro-standarduppsättning på EN plats; ingen kampanjmekanik; ingen override-tabell med källa; ingen per-användar-modell (idag EN delad länk-token per klient).

### 1.3 Kundvyn `/k` — redan mogen (Fas 3 blir additiv, inte ombyggnad)
- `app/k/layout.tsx` — egen sidomeny, kundens logga (initial + `primary_color`), MySales Pro-etikett, `CustomerNav` renderas ur `session.features`, "Logga ut". Metadata överskriver allt HM Motor-arv.
- `app/k/page.tsx` — brand-färgad hero, "Att göra nu"-insikter, per-modul-sektioner (SEO/trafik/innehåll), stat-kort, sparkline. Mobilanpassad grid.
- Portalsidor: `profil, seo, besokare, skapa, ideer, veckoplan, dm` + `[token]` (login).

**Gap mot kickoffen:** ingen modulkorts-grid (kundvänligt namn + 1-rad), ingen kampanjbadge, ingen "← Tillbaka till MySales"-länk, tunna tomma lägen. Allt additivt ovanpå befintlig design.

### 1.4 Owner-nav (6 grupper, efter 12→6-städning) — modulregistrets råmaterial
`app/dashboard/layout.tsx` → `buildNavSections()`:
1. **Överblick** — Översikt, HQ, MySales pionjärer
2. **Varumärke** — Brand-profil, Grafisk profil, Konkurrenter, Profil-analysator
3. **Innehåll** — Navet, Studio, Inlägg, Blogg, Kalender, LinkedIn, Mejl, Idé-bank
4. **SEO & sajt** — SEO & AEO, Sidor, Blogg-arkiv, (Fordon/Verk per resource_module)
5. **Kunder** — Godkännanden, Veckorapport, MySales Pro-access, Ikigai-motor
6. **System** — Onboarding, Setup-agent, AI-specialister, Handbok, Inställningar

Grupp 1 + 6 = byrå-interna (aldrig kundmoduler). Grupp 2–5 = kandidat-moduler.

### 1.5 Publiceringsmodul `lib/publish/` — J nästan klar, IG är stub
- `publishContent({clientId, channel, ...})` routar `ghl-social / ghl-blog / cockpit-blog / ig-graph`.
- **`ig-graph` = stub** som returnerar fail. All riktig IG Graph-logik ligger färdig och isolerad i `lib/instagram.ts` (`getIgConnection`, `publishSingle/Carousel/Story/Reel`, `waitContainerReady`). Token/konto läses ur `clients.ig_account_id/ig_access_token`.
- Två nästan identiska routes duplicerar format-switchen: `app/api/instagram/publish/route.ts` (Publicera nu) + `.../publish-internal/route.ts` (cron). Cron-schemaläggning drivs av tabellen `scheduled_posts` (`/api/scheduler/cron`).

### 1.6 RLS-läget — SANNINGEN (viktig, styr en beslutspunkt)
**Det finns ingen Supabase Auth → ingen `auth.uid()` → DB-RLS kan idag INTE uttrycka "denna användare = denna tenant".** All tenant-säkerhet sker på app-nivå (service-role-nyckel som bypassar RLS + `getActiveClientId`-lås i varje route).

Faktiskt RLS-läge (av 10 tabeller definierade i `migrations/`):
- **Strikt (RLS på, inga policies, endast service-role):** `client_assets`, `client_voice_profile`, `dm_pipeline_contacts`, `dm_automation_rules`. ✅
- **Anon LÄS tillåten:** `art_works`, `art_exhibitions` (`select using(true)`).
- **VIDÖPPNA (anon läs+skriv, "open dev"-policy):** `agent_experiments`, `ideas_bank`, `gsc_queries_daily`. ⚠️
- **INGEN RLS ALLS:** `ikigai_sessions` — och den innehåller `person_email` (lead-PII). ⚠️
- Kärntabellerna (`clients`, `hm_*`, `studio_*`) skapades via Management API, inte i `migrations/` → deras RLS läses från live-DB vid behov.

**Interna fält en kundroll aldrig får läsa:** `clients.customer_token / ig_access_token / ghl_api_key` (redan exkluderade i `/api/clients` SELECT), `hm_brand_profile.pricing_notes`, `ideas_bank` (ogodkända utkast), `ikigai_sessions` (PII).
**OBS:** Det finns **inga** inpris-/marginal-/leverantörskolumner i detta repo — bil-schemat lagrar bara publikt utpris. Kickoffens oro för "inpriser/marginaler/leverantörsdata" gäller alltså inte här (de fälten existerar inte). De verkliga interna fälten är tokens, `pricing_notes`, utkast och lead-PII ovan.

---

## 2. MODULREGISTER (förslag — Håkan justerar vid stoppet)

Moduler = **kundvända förmågor** (det kunden kan köpa/se), härledda ur owner-nav grupp 2–5 + de 7 befintliga `/k`-modulerna. Maskin-ID återanvänder befintliga `customer_features`-nycklar där de finns (undviker migration).

| Maskin-ID | Kundvänligt namn | En rad | Owner-grupp | `/k`-vy | Läge |
|---|---|---|---|---|---|
| `profil` | Varumärke & röst | Din röst, dina kunder och din ICP — grunden AI:n skriver utifrån. | Varumärke | finns | live |
| `seo` | SEO & AEO | Sid-analys, åtgärdslista och sökords-tracker för din egen sajt. | SEO & sajt | finns | live |
| `besokare` | Statistik & synlighet | Besök, kanaler, Google-sök och AI-synlighet på ett ställe. | Kunder | finns | live |
| `skapa` | Innehållsstudio | Skapa on-brand inlägg, bilder, karuseller och reels i din röst. | Innehåll | finns¹ | live |
| `ideer` | Idé-bank | Granska och godkänn AI-genererade idéer och utkast. | Innehåll | finns | live |
| `veckoplan` | Veckoplan | Sju färdiga inlägg enligt veckorytmen. | Innehåll | finns | live |
| `dm` | DM & Pipeline | Följ kontakter från kommentar till bokad kund. | Kunder | finns | live |
| `linkedin` | LinkedIn-motorn | Skriv och planera LinkedIn-innehåll i din röst. | Innehåll | — | kommande² |
| `mejl` | Mejl-motorn | Bygg mejl-kampanjer och sekvenser. | Innehåll | — | kommande² |
| `ikigai` | Ikigai-motor | Lead-magnet som fångar och kvalificerar intressenter. | Kunder | — | kommande² |

¹ `/k/skapa` pekas om mot Studio i Fas 5 (§3.3c: Studio är makaren, gamla Skapa-sidan pensioneras).
² **kommande** = registrerad i registret så den kan säljas/kampanjas, men saknar kundvy → `active=false` tills en `/k`-vy byggs (senare session, utanför detta scope). Håkan säger vid stoppet vilka som ska ingå i Pro-standard från start (förslag: de 7 live-modulerna, med `skapa`+`seo`+`besokare`+`profil` som kärna).

---

## 3. DATAMODELL (Fas 1 — förslag)

Alla nya tabeller: **strikt RLS från start** (repo-konvention D-005) — RLS på, inga anon-policies, endast service-role via `/api/*` som verifierar tenant. Status/enum-fält med CHECK-constraint (lärdom: okänt värde → tyst insert-fel).

### 3.1 `platform_modules` — modulregistret (EN källa, ersätter hårdkodad TS-lista)
```
id            text PRIMARY KEY            -- maskinnyckel ('seo', 'skapa' …)
label         text NOT NULL              -- kundvänligt svenskt namn
description   text                        -- en rad
href          text                        -- /k-route
icon          text                        -- lucide-namn (ikon-map stannar i TS)
owner_area    text                        -- nav-grupp (informativt)
sort_order    int  DEFAULT 100
active        boolean DEFAULT true        -- false = registrerad men ingen kundvy än
in_pro_default boolean DEFAULT false      -- ★ ingår i MySales Pro-standard (EN plats)
campaign      boolean DEFAULT false       -- ★ "Ingår just nu"-kampanj
campaign_label text                       -- "Just nu ingår även Instagram-motorn"
campaign_until date                       -- valfritt utgångsdatum
```
Seedas från `CUSTOMER_FEATURES`. Pro-standard = raderna med `in_pro_default=true` → **ändras på ETT ställe, slår mot alla Pro-tenants**. Kampanjfälten ligger här eftersom det finns EN Pro-uppsättning (tenant-specifika prisplaner = v2).

### 3.2 `tenant_modules` — per-tenant-overrides (ge/ta enskild modul)
```
client_id   uuid REFERENCES clients(id)
module_id   text REFERENCES platform_modules(id)
enabled     boolean NOT NULL             -- true = manuellt tillägg, false = manuellt avdrag
source      text CHECK (source IN ('standard','kampanj','manuell')) DEFAULT 'manuell'
created_at  timestamptz DEFAULT now()
PRIMARY KEY (client_id, module_id)
```
Så Håkan kan ge en GDÅM-kund allt eller dra en modul utanför standarden. Källa spåras för Vy 2-visning.

### 3.3 `clients.plan` — ny kolumn
```
plan text CHECK (plan IN ('mysales','pro')) DEFAULT 'pro'
```
Alla nuvarande Cockpit-klienter = `pro`. `mysales` = bara basen (inga Cockpit-moduler utom manuella tillägg).

### 3.4 `platform_users` — per-användar-mappning (Fas 4 Vy 3; inga delade konton)
```
id             uuid DEFAULT gen_random_uuid() PRIMARY KEY
email          text UNIQUE NOT NULL
client_id      uuid REFERENCES clients(id)   -- NULL = owner (alla tenants)
role           text CHECK (role IN ('owner','customer','customer_member')) NOT NULL
login_token    text UNIQUE                    -- per-användar magic-link (ersätter delad klient-token)
token_expires_at timestamptz
invited_at     timestamptz DEFAULT now()
activated_at   timestamptz
active         boolean DEFAULT true
```
Magic-link/Supabase-invite-flöde, **aldrig lösenord i klartext, aldrig delade konton**. Löser sig ovanpå den befintliga HttpOnly kund-session-cookien (per-användar-token i stället för delad klient-token). `customer_member` = värde reserverat, ingen UI byggs. Befintlig delad klient-token behålls som fallback tills per-användar bevisats live.

### 3.5 Effektiv behörighet — EN central funktion
`lib/entitlements.ts`:
```
getEffectiveModules(clientId) =
   plan = clients.plan
   bas   = plan==='pro' ? moduler där in_pro_default ELLER (campaign && campaign_until giltig) : []
   +      tenant_modules(enabled=true)          -- manuella/kampanj-tillägg
   −      tenant_modules(enabled=false)          -- manuella avdrag
hasModule(clientId, moduleId) → bool
```
`normalizeFeatures` / `requireCustomerFeature` / `CustomerSession.features` refaktoreras att härledas härifrån. `clients.customer_features` behålls som legacy-fallback under övergången (behåll-fungerande-väg-regeln).

### 3.6 Säkerhetshärdning (konkret vinst i detta bygge, del av "säkerhet visas")
Stäng de anon-exponerade tabellerna till service-role-only: `agent_experiments`, `ideas_bank`, `gsc_queries_daily` (droppa "open dev"-policy) + slå på RLS på `ikigai_sessions`. **Verifieras** att varje route som rör dem redan använder service-role (särskilt publika `/api/ikigai/public`) INNAN policyn dras — annars går lead-magneten sönder. Bevisas i Fas 6.

---

## 4. FIL-/ROUTINGSTRUKTUR

| Fas | Nya/ändrade filer |
|---|---|
| 1 | `migrations/platform_modules.sql` (4 tabeller + `clients.plan` + seed + RLS + härdning). `lib/entitlements.ts` (central funktion). |
| 2 | `lib/entitlements.ts` `hasModule`. `app/k/*/` layouts/route-guards → central check. `components/PaketSaknas.tsx` ("Ingår inte i ditt paket" + "Hör av dig till Håkan"). `CustomerNav` renderas ur effektiv behörighet. |
| 3 | `app/k/page.tsx` (modulkorts-grid + kampanjbadge), `app/k/layout.tsx` ("← Tillbaka till MySales" → app.mysales.se), tomma lägen. Återanvänder befintlig hero/design. |
| 4 | `app/dashboard/paket/page.tsx` (Vy 1 Pro-standard, Vy 2 per kund, Vy 3 användare) + `app/api/platform/modules`, `.../tenant-modules`, `.../users`. Befintliga `/dashboard/kund-access` + `/api/clients/customer-access` vävs in i Vy 2. |
| 5 | `lib/publish/index.ts` (`publishIgGraph` + utökad `PublishRequest`: `slideUrls/videoUrl/coverUrl`), importerar `lib/instagram.ts`. `publish`+`publish-internal`-routes → kallar `publishContent` (en väg). `app/dashboard/(inlagg)/skapa` → tunn genväg till Studio. |
| 6 | `scripts/qa-screens.ts` (Playwright-svep → `qa-screens/`). Test-användare via `platform_users`. |

---

## 5. BESLUTSPUNKT SOM KRÄVER HÅKAN (innan Fas 1)

**"RLS i databasen är sanningen" vs verkligheten.** Kickoffen säger att RLS ska vara sanningen och UI-gömning bara kosmetika. Men appen har **ingen Supabase Auth** → `auth.uid()`-baserad DB-RLS är inte möjlig idag. Två vägar:

- **A (rekommenderas — MVP, live-klient-säker):** Behåll den beprövade app-nivå-modellen (service-role + hård tenant-lås) som redan bevisats. Sanningslagret = (1) strikt RLS + service-role-only på ALLA känsliga tabeller (inkl. härdningen i §3.6) och (2) EN central serverside `hasModule`/tenant-check som varje layout+route använder. Kickoffens ANDA ("säkerhet visas, inte antas") uppfylls via Fas 6-bevis (test-användare, cross-tenant-försök). Full `auth.uid()`-RLS = v2-beslut.
- **B (kickoffens bokstav):** Inför Supabase Auth + JWT-buren `client_id` → äkta DB-RLS. Fler dagars auth-migration som rör varje dataväg och **riskerar live-klienter (CF får aldrig störas)**. Passar inte 2-dagars-scope.

**Rekommendation: A.** Ärlig avgränsning: vi levererar bevisbar tenant-isolering nu, och flaggar äkta JWT-RLS som v2. Behöver Håkans OK att köra A.

Övriga defaults (accepteras om inget sägs): modulregistrets 3 "kommande"-moduler registreras men `active=false`; Pro-standard = de 7 live-modulerna; magic-link via befintlig Resend; kampanjfält på `platform_modules`.

---

## 6. KOSTNAD
Försumbar. Nya tabeller: ~10 modulrader, ~0–10 `tenant_modules`/klient, ~1–2 `platform_users`/klient. Inga nya tjänster. IG-publicering = befintliga Meta Graph-anrop (ingen ny kostnad). Magic-link-mejl = befintlig Resend. Inga nya env-hemligheter (återanvänder `ADMIN_SESSION_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `RESEND_API_KEY`).
</content>
</invoke>
