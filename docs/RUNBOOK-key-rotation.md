# Runbook — nyckelrotation (Cockpit)

Hur du roterar en läckt eller misstänkt komprometterad hemlighet utan driftstopp, och
bevisar att den gamla nyckeln är död. Gäller Supabase-nycklar i första hand, med checklista
för sekundärhemligheter sist.

**Princip:** lägg in den NYA nyckeln överallt FÖRST (Vercel → GH Actions → lokalt), deploya,
verifiera att appen lever på den nya — och SIST invalidera den gamla. Aldrig tvärtom (då tar
appen ner sig själv).

---

## 0. Innan du börjar
- [ ] Kör `npx tsx scripts/inventory-secrets.ts` — bekräfta att inga hemligheter är hårdkodade i repot och se var varje env-nyckel konsumeras.
- [ ] Notera vilken nyckel som roteras och varför (incidentlogg).

## 1. Vercel (produktion + preview)
- [ ] `npx vercel env rm <NAMN> production` följt av `npx vercel env add <NAMN> production` med det NYA värdet. Upprepa för `preview` om nyckeln används där.
- [ ] Trigga en ny deploy (`git commit --allow-empty -m "rotera <NAMN>"` + push, eller `vercel --prod`) så nya env-värden laddas.
- [ ] Verifiera: `curl -I https://cockpit.gripcoaching.se/dashboard` → 200, och en funktion som använder nyckeln fungerar (t.ex. logga in, ladda en tenant).

## 2. GitHub Actions (cron-secrets)
- [ ] Repo → Settings → Secrets and variables → Actions → uppdatera `CRON_SECRET` (och ev. andra) till NYA värdet.
- [ ] Kör workflow manuellt (`workflow_dispatch`): **Native schemaläggare** och **Tokenhälsovakt** → bekräfta grönt.

## 3. Lokalt (.env.local)
- [ ] Byt värdet i `hmmotor-next/.env.local`.
- [ ] Om det är en delad nyckel: uppdatera även `Antigravity/.shared-keys.env` (t.ex. `SUPABASE_ACCESS_TOKEN`).
- [ ] `npm run build` lokalt → passerar.

## 4. Invalidera den GAMLA nyckeln
- [ ] Supabase: Dashboard → Project Settings → API → rotera anon/service_role (eller JWT-secret). Detta dödar den gamla nyckeln globalt.
- [ ] Andra tjänster: återkalla den gamla nyckeln i respektive dashboard.

## 5. Verifiera att den gamla nyckeln är död
- [ ] `npx tsx scripts/verify-key-rotation.ts <GAMMAL_NYCKEL>` → ska ge **PASS** (401 mot alla 5 känsliga tabeller).
- [ ] `npx tsx scripts/inventory-secrets.ts` → fortfarande inga hårdkodade hemligheter.
- [ ] Appen fungerar fortfarande (steg 1-verifieringen igen).

---

## Sekundärhemligheter — checklista

Alla dessa bor ENDAST i env (Vercel + `.env.local`), aldrig i koden. Vid rotation: samma
ordning (Vercel → GH Actions → lokalt → invalidera → verifiera).

| Hemlighet | Env-namn | Var den används | Not vid rotation |
|---|---|---|---|
| Admin-PIN / lösen | `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET` | inloggning + HMAC-sessioner | Byte av `ADMIN_SESSION_SECRET` loggar ut alla admins (förväntat). |
| Kund-tokens | (`clients.customer_token`, `platform_users.login_token` i DB) | kundportal `/k` | Roteras per rad i DB, inte via env. Mint nya login-tokens. |
| GHL-PIT | (per tenant i DB / GHL) | GHL-integration | Byt i GHL, uppdatera tenantens PIT. |
| Google OAuth | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | GSC/GA4-koppling | Byt i Google Cloud Console, uppdatera env. Befintliga refresh-tokens kan behöva ny consent. |
| Meta app-secret | `IG_APP_SECRET` | OAuth, `fb_exchange_token`, `appsecret_proof`, webhook-HMAC | Byt i Meta App Dashboard. **OBS:** ägar-token + alla page-tokens måste kopplas om (ANSLUT-1 + ANSLUT-2) eftersom `appsecret_proof` beräknas med secret. |
| Token-krypteringsnyckel | `TOKEN_ENC_KEY` | krypterar Meta/IG-tokens at-rest | Byte gör alla `*_enc`-värden oläsbara → koppla om ägare (ANSLUT-1) och tenants (ANSLUT-2) efteråt. Rotera bara vid misstänkt läcka. |
| Resend | `RESEND_API_KEY` | mejl (lead, rapport, hälsovakt) | Byt i Resend, uppdatera env. |
| Cron | `CRON_SECRET` | schemaläggare + hälsovakt | Byt i Vercel-env OCH GitHub Actions-secret samtidigt. |
| Supabase PAT | `SUPABASE_ACCESS_TOKEN` (i `.shared-keys.env`) | migrations via Management API | Byt i Supabase → Account → Access Tokens. |

> IG-tokens (ägar-token + page-tokens) roteras genom att koppla om i UI:t, inte som env.
> Tokenhälsovakten (ANSLUT-3) larmar automatiskt om någon token dör efter en rotation.
