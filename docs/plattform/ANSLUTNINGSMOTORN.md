# Anslutningsmotorn — självbetjänad Meta/IG-koppling + tokenhälsovakt

Status: **byggd, tsc+build rent, migration körd, ej deployad** (2026-07-30).
Beslut: tokens krypteras at-rest (AES-256-GCM), ägar-UI på `/dashboard/installningar/meta`.

## Säkerhetsmodell (alla etapper)
- Nya tabeller: RLS på, **noll** policies, `REVOKE ALL FROM anon, authenticated` → bara service-role (verifierat: 0 policies, anon kan ej läsa).
- Tokens krypteras via `lib/crypto/token-vault.ts` (AES-256-GCM, `TOKEN_ENC_KEY`, format `enc:v1:iv:tag:ct`). Bevisat roundtrip + unik iv + plaintext-fallback.
- App-secret = `IG_APP_SECRET` (återanvänd, samma som webhook-HMAC). `appsecret_proof` på alla user-token-anrop.
- Inga tokens loggas eller lämnar servern. UI får aldrig token — bara namn/username/status.

## Datamodell (`migrations/anslut_motorn.sql`, körd)
- `meta_owner_connection` — 0–1 rad, ägarens long-lived user-token (`user_token_enc`), expiry, scopes, status.
- `tenant_ig_connections` — 1/tenant (UNIQUE client_id), `page_token_enc`, ig_business_account_id, ig_username, followers, source (oauth/manual), status, last_error.
- `token_health_checks` — historik (client_id NULL = ägar-token), scope, status, detail.

## Publiceringsväg (enda ripple)
`lib/instagram.ts getIgConnection` läser nu **tenant_ig_connections först** (dekrypterar), **fallback clients.ig_*** (DT/HM plaintext, oförändrat). `decryptMaybe` returnerar plaintext orört → DT/HM opåverkade även utan `TOKEN_ENC_KEY`. Webhook använder samma lösare.

## ANSLUT-1 — ägar-OAuth (`/dashboard/installningar/meta`)
- `GET /api/meta/oauth/start` — requireAdmin, state-cookie, redirect till FB Login for Business.
- `GET /api/meta/oauth/callback` — code→short→long-lived (`fb_exchange_token`)→kryptera→spara. State-verifiering.
- `GET/DELETE /api/meta/owner` — status (aldrig token) / koppla från.
- Komponenter: `MetaOwnerConnect.tsx`, sida `app/dashboard/installningar/meta/page.tsx`.

## ANSLUT-2 — tenant-koppling via dropdown
- `GET /api/meta/pages` — me/accounts server-side, returnerar sidor **utan** access_token.
- `GET/PUT/DELETE /api/meta/connect-tenant` — status / koppla vald sida (kryptera page-token + non-secret-spegling till clients, nolla clients-token) / full frånkoppling.
- `POST /api/meta/connect-tenant/manual` — fallback "Avancerat" (klistra in), samma lagring.
- Komponent `TenantIgConnect.tsx` ersätter `InstagramConnect` i Inställningar → Instagram (gamla behålls som fallback-fil).

## ANSLUT-3 — tokenhälsovakt
- `lib/meta-health.ts` `runHealthChecks()` — debug_token + billigt läsanrop per tenant + ägar-token → OK/warning(<7 dgr)/dead. Loggar `token_health_checks`, uppdaterar status, mejlar **vid statusövergång** (ingen spam).
- `lib/meta-health-notify.ts` — mail till `report_recipients` (page) / alla (owner), åtgärdslänk.
- `GET /api/meta/health/cron` — Bearer CRON_SECRET. `GET /api/meta/health?all=1` — översikt (badges).
- `.github/workflows/token-health.yml` — dagligen 06:30 UTC. Badge-lista på Meta-sidan (`MetaConnectionsHealth.tsx`).

## ANSLUT-4 — rotation + verifiering
- `scripts/verify-key-rotation.ts <GAMMAL_NYCKEL>` — 401 mot 5 känsliga tabeller = PASS.
- `scripts/inventory-secrets.ts` — hårdkodade eyJ/sbp_/re_/sk- + var env-nycklar konsumeras (körd: 0 hårdkodade, 670 filer).
- `docs/RUNBOOK-key-rotation.md` — Vercel→GH Actions→lokalt→invalidera→verifiera + sekundärhemligheter.

## AKTIVERING (kvar — kräver Håkans dashboards)
1. **Meta App Dashboard** → Facebook Login for Business → Valid OAuth Redirect URIs: lägg till `https://cockpit.gripcoaching.se/api/meta/oauth/callback`.
2. **Vercel env (production):** `IG_APP_SECRET` (från Meta App → Settings → Basic), `TOKEN_ENC_KEY` (finns i `.env.local`), ev. `META_APP_ID`/`META_OAUTH_REDIRECT` (annars fallback).
3. **Deploy** (git push master) — säkert för DT/HM (fallback-väg orörd).
4. Anslut Meta en gång → koppla ev. tenants via dropdown. DT/HM lämnas på fallback.

## Bevisat
tsc rent (alla etapper) · `npm run build` exit 0 · migration 201 + RLS 0 policies/anon nekad · vault roundtrip/iv/fallback · inventory 0 hårdkodade.
