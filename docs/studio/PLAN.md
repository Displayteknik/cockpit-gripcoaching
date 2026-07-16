# PLAN — Studio (Publiceringsmotorn)

> Fas 0-leverans enligt `KICKOFF-Publiceringsmotorn-Cockpit.md`. Skriven 2026-07-15.
> Status: VÄNTAR PÅ GODKÄNNANDE innan Fas 1 påbörjas.

---

## 1. Inventering (verifierad mot kod, ej minne)

| Område | Nuläge |
|---|---|
| **Ramverk** | Next.js 16.2.3 (Turbopack), React 19.2.4, Tailwind 4. OBS breaking changes: `await cookies()/headers()`, `params: Promise<>`, `proxy.ts` ersätter `middleware.ts`. Docs i `node_modules/next/dist/docs/` ska läsas per område före implementation (AGENTS.md-krav). |
| **Deploy-target** | Vercel (auto-deploy på push till master). `vercel.json` = 6 dagliga crons (Hobby-plan: EJ sub-dagliga crons, `maxDuration` upp till 300s OK). |
| **Node** | Lokalt v20.10.0. Ingen `engines`-pin i package.json (Vercel kör sin default). |
| **Supabase** | Delat projekt `liunepzrmygiaaibsbni`. Två klienter i `lib/supabase-admin.ts`: `supabaseServer()` (anon, legacy) och `supabaseService()` (service-role, för strikt-RLS-tabeller). Konvention för nya tabeller (se `migrations/client_assets.sql`): **strikt RLS från start, anon nekas allt, endast service-role via server-API som själv verifierar client_id.** Migrationer körs av Claude via Management API (PAT i `.shared-keys.env`) + `NOTIFY pgrst, 'reload schema';` efter DDL. |
| **Auth** | `proxy.ts`: admin-grind (HMAC-cookie `admin_session`) på `/dashboard` + `/admin` + **fail-closed default på ALLA `/api`-rutter** (undantagslistor för publika/cron/kund-servade). Tenant-resolution via `lib/client-context.ts` (`getActiveClientId()`, cookie `active_client_id`, kund-sessioner hårt låsta till egen tenant). |
| **Multi-tenant** | Tabellen `clients` (uuid-id) är navet. Opticur finns redan: id `81a509ae-ee67-4048-bb36-3d416c22d630`, slug `opticur`, resource_module `general`. Global `ClientPicker` i sidebaren styr aktiv klient överallt. |
| **Modulmönster** | "Motor" = egen nav-grupp i `app/dashboard/layout.tsx` + en sida `app/dashboard/<namn>/page.tsx` + API-routes `app/api/<namn>/…`. Exempel: Mejl-motor, LinkedIn-motor, Ikigai. |
| **Befintlig GHL-kod** | Endast webhook-push (`clients.ghl_webhook_url`, `app/api/dm/contacts/[id]/sync-ghl`) och MySales Coach-läsning (`coach_users.ghl_api_token/ghl_location_id`). **Ingen** Medias/Social Planner/Blogs-integration finns — byggs nytt i `lib/studio/ghl/`. |
| **Befintlig bildrendering** | `app/api/posts/[id]/render-carousel` + `render-photo-overlay` genererar **SVG** (ej pixelperfekt). Det tidigare bildmotor-försöket ligger kvar i `public/opticur-mall/` (html2canvas-baserat, `index.html` 38 kB). Studio ersätter detta med deterministisk HTML/CSS + Playwright — helt separat spår, gamla vägen rörs ej (behåll-fallback-regeln). |
| **Återanvändbara fynd i `public/opticur-mall/`** | `logo-green.png`, `zeiss.png`, `footer.png` (färdig fot!), `hero-photo.jpg`. Färgkandidater ur gamla mallen: gröna `#1a6a18` / `#236b23` / `#2d7a3c`, gul `#f0b429`, ljusgrön `#e8f5e9`. **Ska bekräftas mot Canva-originalets exakta hex (checklistan).** Saknas fortfarande: gult penseldrag (transparent PNG), badge-stjärna, sol-ikon, QR-kod. |
| **Uppladdningsmönster** | Direkt-uppladdning till Supabase Storage via signerad URL finns redan (`/api/assets/upload-url`, `/api/intake/storage-url`) — förbi Vercels ~4,5 MB body-gräns. Återanvänds för Studios foto-uppladdning. |
| **Env** | `ANTHROPIC_API_KEY` finns redan i `.env.local` (+ `@anthropic-ai/sdk` 0.32.1 redan installerat). `GEMINI_API_KEY` finns. `.env.example` **saknas i repot** — skapas i Fas 1 med alla befintliga+nya nyckelNAMN. |
| **Konstitution** | `CLAUDE.md` → `@AGENTS.md` (= läs Next-docs före kod). `LESSONS.md`/`DECISIONS.md` fanns INTE i repot — skapade nu som `docs/studio/LESSONS.md` + `docs/studio/DECISIONS.md` (scopade till detta bygge). |
| **Typsnitt** | Inga självhostade fonts i `public/` idag (ingen `public/fonts/`). Skapas i Fas 1. |

## 2. Placering i navigationen

Egen nav-grupp **"Studio"** i `app/dashboard/layout.tsx`, placerad mellan "Inlägg & Social" och "Innehåll & SEO":

```
Studio
└── /dashboard/studio   "Studio"  (ikon: Brush eller LayoutTemplate)
```

Motiv: Studio är kanal-överskridande (bild + social + blogg → GHL) och följer motor-mönstret (egen grupp, en ingång). Visas bara när aktiv klient har en `studio_clients`-rad (samma mönster som resource_module-styrda menyval).

## 3. Filstruktur (hela bygget, Fas 1–4)

```
app/
├── dashboard/studio/page.tsx              # Fas 2: Studio-UI (admin-grindas automatiskt av proxy.ts)
├── studio/render/[templateId]/page.tsx    # Fas 1: ren render-yta 1080×1350/1080×1080, ingen chrome
└── api/studio/
    ├── posts/route.ts                     # Fas 2: GET lista + POST skapa utkast (studio_posts)
    ├── posts/[id]/route.ts                # Fas 2: GET/PATCH/DELETE
    ├── suggest-text/route.ts              # Fas 2: AI-textförslag (ETT förslag, ingen loop)
    ├── upload-url/route.ts                # Fas 2: signerad upload-URL → bucket studio-images
    ├── publish/route.ts                   # Fas 3: export → GHL medias + social planner (DRAFT)
    └── blog/
        ├── fetch-doc/route.ts             # Fas 4: Google Doc → tvättad HTML + SEO-paket
        └── publish/route.ts               # Fas 4: GHL Blogs create post (status "DRAFT")

components/studio/
├── registry.ts                            # templateId → { komponent, format[], namn }
├── ClientFooterOpticur.tsx                # fast fot, återanvänds av alla Opticur-mallar
└── templates/
    ├── OpticurFotoGulRuta.tsx
    └── OpticurBageRubrik.tsx

lib/studio/
├── payload.ts                             # StudioPayload-typ + validering (ingen ny dep — manuell)
├── brand.ts                               # laddar clients/<slug>/brand.json (server-side)
├── ghl/
│   ├── client.ts                          # fetch-wrapper: base-URL, Version-header, token per kund, fel→publish_log
│   ├── medias.ts                          # uploadMedia()          [docs-sida noteras i koden]
│   ├── social.ts                          # createSocialPost()     [docs-sida noteras i koden]
│   └── blogs.ts                           # createBlogPost(), listAuthors/Categories [docs-sida noteras]
└── blog/
    ├── fetch-doc.ts                       # doc-ID ur URL → export?format=html
    ├── sanitize.ts                        # sanitize-html + egen mapping (NY dep, Fas 4)
    └── seo.ts                             # ETT AI-anrop → strikt JSON (seoTitle, meta, slug, FAQ …)

clients/opticur/
├── brand.json                             # exakta hex, typsnittsnamn, fot-texter, bokadirekt-URL
└── context.md                             # rubrikstruktur + TODO-markörer (Håkan fyller i)

public/
├── clients/opticur/                       # logo.png, zeiss.png, qr.png, brush-yellow.png, badge-star.svg, sun.svg
└── fonts/                                 # självhostade woff2 (inga CDN-anrop i render-routen)

scripts/studio-export.ts                   # Fas 1: Playwright-CLI → exports/{clientId}/{datum}-{slug}.png
exports/                                   # .gitignore:as
migrations/studio.sql                      # Fas 3: studio_clients, studio_posts, studio_publish_log + RLS
docs/studio/PLAN.md · LESSONS.md · DECISIONS.md
```

Avvikelser från kickoffens förslag (motiverade):
- **Mallkomponenter i `components/studio/templates/`** i stället för `app/studio/templates/` — repots konvention är att `app/` bara innehåller routes; komponenter ligger i `components/`.
- **`clients/`-mappen** är ny i repo-roten (kickoffens förslag) — kod-nära konfiguration, inte publika assets. Bilder/typsnitt ligger i `public/` (måste vara statiskt servade för render-routen).

## 4. Supabase-schema (Fas 3) — justerat mot befintlig konvention

Kickoffens schema behålls, med **en ändring**: `studio_clients` nycklas mot befintliga `clients` (uuid) i stället för en egen text-id. Motiv: `active_client_id`-cookien, ClientPicker, activity-logg och all tenant-säkerhet arbetar med `clients.id` — en parallell id-rymd skulle ge mappningskod och risk för glapp.

```sql
create table studio_clients (
  client_id text? nej → uuid primary key references clients(id) on delete cascade,
  slug text not null,                    -- 'opticur' — pekar ut clients/<slug>/ + public/clients/<slug>/
  ghl_location_id text,
  ghl_token text,                        -- PIT-token; skyddas av strikt RLS (service-role only) — se Öppen fråga 3
  blog_id text,
  author_id text,
  categories jsonb,                      -- cache av GHL-kategorier {namn: id}
  social_accounts jsonb,                 -- cache av kopplade FB/IG-konto-id:n (hämtas vid onboarding)
  brand jsonb,                           -- speglar clients/<slug>/brand.json (DB = runtime-sanning)
  created_at timestamptz default now()
);

create table studio_posts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  template_id text not null,
  format text not null,                  -- '1080x1350' | '1080x1080'
  payload jsonb not null,
  image_export_url text,
  status text not null default 'draft'
    check (status in ('draft','exported','queued','published','failed')),
  channels jsonb,                        -- ['facebook','instagram','blog']
  ghl_refs jsonb,
  scheduled_at timestamptz,
  published_at timestamptz,
  created_at timestamptz default now()
);

create table studio_publish_log (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references studio_posts(id) on delete cascade,
  action text not null,
  request jsonb, response jsonb, ok boolean,
  created_at timestamptz default now()
);
-- RLS: alla tre tabellerna strikt RLS (enable + inga policies för anon) enligt
-- client_assets-mönstret. Åtkomst endast via service-role i /api/studio/* som
-- verifierar tenant via getActiveClientId(). NOTIFY pgrst efter DDL.
-- OBS status-CHECK: lärdom från deep-audit — okända statusvärden ger tysta insert-fel.
```

Storage: ny bucket **`studio-images`** (publik läs-URL enligt kickoff — bilderna ska ändå till GHL/sociala medier; inget känsligt).

## 5. Playwright-beslutet — REKOMMENDATION: A nu, ompröva vid Fas 3-stoppet

| Alt | Bedömning |
|---|---|
| **A) Lokal CLI-export** | ✅ **Rekommenderas för Fas 1–2.** Noll infrastrukturrisk, noll löpande kostnad, deterministisk (lokal Chromium, `deviceScaleFactor: 1`, `document.fonts.ready`). `playwright` läggs som **devDependency** (enda nya beroendet i Fas 1; hamnar inte i Vercel-bundlen). Begränsning: export kräver att Håkans maskin kör — acceptabelt i v1 där Håkan ändå är i loopen. |
| **B) `@sparticuz/chromium-min` + `playwright-core` i serverless** | ⚠️ Avrådes som första val. Vercels 250 MB-gräns (okomprimerat) är nåbar men versionsparningen chromium-min↔playwright-core är skör, Turbopack/Next 16-bundling av native-binärer är oprövad i detta repo, och felsökning sker i produktion. Utreds ordentligt endast om A:s begränsning blir ett verkligt hinder. |
| **C) Render-tjänst (Fly.io/Railway)** | 💰 **Kostnadsflagga: ~5 USD/mån.** Rätt långsiktigt svar om export ska ske utan Håkans maskin (t.ex. kund-självbetjäning eller schemalagd batch). Enkel att lägga till senare — render-routen är redan tjänst-agnostisk (Playwright pekar bara på en URL). |

Beslutspunkt: vid Fas 3-stoppet vet vi hur ofta export sker och av vem → då väljs B/C eller A permanentas.

Säkerhetsnot: render-routen `app/studio/render/[templateId]` är inte admin-grindad (Playwright har ingen cookie). Den läcker inget (renderar bara sin inskickade payload + publika assets), men på produktions-domänen blir den publikt nåbar. I Fas 1 (alternativ A, lokal dev-server) är det en icke-fråga; om B/C väljs senare läggs en enkel render-nyckel (`?key=` mot env-var) till.

## 6. Öppna frågor till Håkan (svara vid fas-stoppet)

1. **`studio_clients` nycklas mot befintliga `clients` (uuid FK + slug)** i stället för kickoffens fristående text-id — OK? *Om du inte vet: ja (rekommenderas starkt, se §4).*
2. **Kundväljaren i Studio = befintliga globala ClientPicker** (aktiv klient), i stället för en egen dropdown i Studio-UI:t? Studio-menyn visas bara för klienter med studio-config. *Om du inte vet: ja — en väljare i appen, inte två.*
3. **GHL-token-lagring:** kickoff säger "ALDRIG klartext-token" (`ghl_token_secret_ref`). Supabase Vault är den formella lösningen men ger merarbete i varje anrop. Pragmatiskt alternativ som följer repots mönster: token i kolumn på **strikt-RLS-tabell** (anon totalnekas, endast service-role server-side — samma skyddsnivå som `SUPABASE_SERVICE_ROLE_KEY` själv ger). *Om du inte vet: strikt-RLS-kolumn (rekommenderas), Vault kan införas senare utan API-ändring.*

Noterat men ej blockerande: kickoffen anger AI-modell `claude-sonnet-4-6` för textförslag/SEO-paket. Modell-id:t verifieras mot aktuell modellista vid Fas 2 (repots `@anthropic-ai/sdk` finns redan; husets default-provider är annars Gemini — kickoffens val följs om inget annat sägs).

## 6b. Textmotor (hook-driven) — delad kvalitetskälla
`lib/studio/copy.ts` `generateStudioCopy()` = hook-playbook (`knowledge/hook-playbook.md`, Kane) +
brand-profil + voice-fingerprint + winning examples via `iterateGenerate()` (Anthropic, 5 varianter
→ regelfilter mot fragment/AI-språk → topp 3, en per hook-typ). **Återanvänds i Fas 3 (captions) och
Fas 4 (blogg-SEO-paket)** — EN motor för all Studio-text, inte parallella prompt-spår.

## 7. Fas 5 — parkerat (byggs INTE nu)

- AI-fotogenerering i Studio (fotostil-prompt i context.md).
- Repurposing-motorn: bloggutkast → 2–3 sociala inlägg + GBP-text.
- Mallar för HM Motor, Ledarskapskultur, Displayteknik (arkitekturen är förberedd: ny rad i `studio_clients` + ny mallkomponent i registry).
- Publiceringskalender-vy.

## 8. Kostnadsflaggor (löpande)

- Fas 2 AI-textförslag: ~ören per anrop (ett anrop per knapptryck, ingen loop).
- Fas 4 SEO-paket: ETT AI-anrop per bloggpost.
- Alternativ C (render-tjänst): ~5 USD/mån — endast om det väljs.
- GHL-anrop: ingår i MySales-abonnemanget (inga per-anrop-kostnader kända) — verifieras mot docs i Fas 3.
