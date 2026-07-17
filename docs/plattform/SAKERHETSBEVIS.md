# SÄKERHETSBEVIS & QA — MySales Pro (Fas 6)

Visat, inte antaget. Alla bevis körda 2026-07-17 mot **live prod** (cockpit.gripcoaching.se)
respektive lokal dev för admin-vyn. Skript: `scratchpad/qa-security.mjs` (isolering/grind),
`scripts/qa-screens.mjs` (visuellt svep).

---

## 1. Tenant-isolering & modul-grind — 7/7 PASS (live prod)

Testtenanter: **A = Carl-Fredrik / Ledarskapskultur** (delmängd `seo/besokare/profil`),
**B = HM Motor Krokom** (default). Körda anrop med riktiga sessions-cookies:

| # | Bevis | Resultat |
|---|---|---|
| 1 | Kund A ser sin egen tenant på `/k` | ✅ A:s namn i HTML |
| 2 | Kund A ser **inte** tenant B:s namn/data | ✅ ingen "HM Motor"/"Krokom" |
| 3 | **Förfalskad `active_client_id=B`-cookie ignoreras** → visar ändå A | ✅ hård tenant-lås |
| 4 | Icke-köpt modul `/k/skapa` → `307 → /k/ej-i-paket` (paketsida, ej data) | ✅ |
| 5 | Köpt modul `/k/seo` laddar (`200`) | ✅ |
| 6 | Ingen session → `307 → /k-utloggad` | ✅ |
| 7 | Paketsidan kräver session | ✅ |

**Slutsats:** en kund-session är hårt låst till sin egen tenant på tre nivåer — nav filtrerar,
varje sida grindar (`requireCustomerFeature`), och `getActiveClientId`/`resolveClientId` ignorerar
den manipulerbara `active_client_id`-cookien för kund-sessioner. Modul-behörighet räknas i EN
central funktion (`getEffectiveModules`) och bevisades per klient i DB (A=3 moduler, null-kunder=7).

---

## 2. Interna fält en kundroll ALDRIG når — och policyn som skyddar

**Viktig sanning:** det finns **inga inpris-/marginal-/leverantörskolumner** i repot — bil-schemat
lagrar bara publikt utpris (Bytbil-feed). De verkliga interna fälten och deras skydd:

| Fält / tabell | Typ | Skydd (policy) |
|---|---|---|
| `clients.customer_token`, `ig_access_token`, `ghl_api_key`, `ghl_webhook_url`, `customer_pin` | credentials | `/api/clients` läser **explicit allowlist** (aldrig `select *`); dessa kolumner skickas aldrig till klient. IG-token läses bara server-side i `lib/instagram`. |
| `client_assets` (notes, ai_summary, storage_path, voice_score) | per-tenant kunskapsbank | **Strikt RLS** (RLS på, inga policies) → endast service-role via `/api/*` som tenant-verifierar. |
| `client_voice_profile` | röst-fingerprint | Strikt RLS. |
| `dm_pipeline_contacts` (notes, next_action, lead-PII) | intern CRM | Strikt RLS. |
| `hm_brand_profile.pricing_notes` | intern prisstrategi | Nås bara via tenant-låst server-API; visas aldrig i kund-portalen. |
| `ideas_bank` (ogodkända utkast) | internt innehåll | ⚠️ "open dev"-policy kvar (staged härdning — kräver route-migrering först, se `platform_hardening.sql`). |
| `ikigai_sessions` (person_email, PII) | lead-PII | ✅ **RLS påslagen i detta bygge** (var av tidigare) → service-role only. |

Härdning av de tre kvarvarande anon-öppna tabellerna (`ideas_bank`, `gsc_queries_daily`,
`agent_experiments`) är stagad bakom en route-migrering (`supabaseServer→supabaseService`) —
dokumenterad, inte tyst hoppad. [[PL-001]]

---

## 3. Visuellt QA-svep — 72 skärmbilder

`scripts/qa-screens.mjs` loopar **owner-dashboarden (27 sidor)** + **kundvyn (9 sidor)** i
**desktop (1440)** och **mobil (390)** → `qa-screens/*.png`. Owner-svepet kördes mot lokal dev
(giltig admin-cookie), kundvyn mot samma Supabase.

Spot-checkade med ögon (Read renderar PNG):
- **`/dashboard/paket`** (ny admin) — DashHero-gradient, 3 flikar, 7 modulkort + kampanj-toggle, KOMMANDE-sektion. ✅
- **`/k`** (kundvy) — "Dina verktyg" (7 modulkort), "← Tillbaka till MySales", brand-grön hero, mobilanpassad. ✅

Håkan bläddrar igenom `qa-screens/` som slutgodkännande av de tidigare oQA:ade sidorna.

---

## 4. Kvarstår (kräver Håkan / senare)
- **Studio → lib/publish → GHL-utkast** för en testtenant: kräver en GHL-kopplad klient (Opticur GHL-PIT väntar). Publiceringsvägen är byggd + IG-delen bevisad skarp; GHL-utkasttestet görs när token finns.
- **Skarp IG live**: ✅ redan bevisad (feed-inlägg publicerat till @displayteknik via `lib/publish`-vägen, `p/Da6JT9rFQkD`).
</content>
