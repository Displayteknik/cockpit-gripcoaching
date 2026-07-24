# Handoff-prompt till Fable 5 — SalesChallenge-demo (Cockpit / MySales Pro)

> Klistra in allt nedan till Fable 5.

---

Du jobbar i `C:\Users\hakan\OneDrive\Dokument\Antigravity\hmmotor-next` (Next.js 16 + Supabase multi-tenant, "Cockpit"/MySales Pro, prod: cockpit.gripcoaching.se, GH `Displayteknik/cockpit-gripcoaching`). Läs FÖRST projektminnet: `C:\Users\hakan\.claude\projects\C--Users-hakan-OneDrive-Dokument-Antigravity\memory\MEMORY.md` → `project_demo_challenge.md` + `solution_demo_tenant_seed.md`. Följ `CLAUDE.md`/`AGENTS.md`.

**Kontext:** LIVE-demo av MySales Pro **måndag 27/7 18:48** inför ~20 företagare. Hård frys lördag kväll. INGA nya features — bara verifiering och polish.

**Vad som är gjort (fre 24/7, commit `fb70269` pushad + Vercel-deployad):**
1. **Säkerhet:** qa-security 10/10 live (`scratchpad/qa-security.mjs`). Alla credential/PII-tabeller anon-låsta, inkl. `admin_users`-läckan (stängd via `DROP POLICY anon_admin` + `REVOKE`). Kvar (post-demo, rör EJ före måndag): Väg A anon-skriv på `hm_pages/hm_vehicles/art_works/art_exhibitions/hm_blog`; rotationer Google OAuth/IG-token/GHL-PIT (kräver Håkan).
2. **Demo-tenant "Annas Blommor"** (fiktiv florist, Östersund) seedad i prod-DB. `client_id=7461fa8b-3fcb-4729-9cf6-53e27687656e`, kund-login `cockpit.gripcoaching.se/k/06cb3d30-ec91-4810-9f02-b06af3e6127e`. Data: 8 studio-inlägg, 2 bloggar, 5 affärer (88 800 kr pipeline), 3 att-göra, 9 leads (värme-trappa), 2 IG+2 LinkedIn, 14 kalender-poster. Bygg-skript: `scratchpad/demo-assets.mjs` (logga+foton) + `demo-seed.mjs` (data). Egen logga i `brand-assets/<client_id>/`.
3. **Verifierat live:** /k, /k/fokus, /k/studio, Nya leads (API), Kalender (API), mobil 375. Drag utan GHL = tyst (ingen rad, inget fel).
4. **FunctionGuide** tillagd på Studio, Kalender, Nya leads, Fokus, /k-start (5 filer). tsc + prod-build rena.
5. **Docs:** `docs/DEMO-KORSCHEMA.md` (körschema) + `docs/FALTVALIDERING.md` (Håkans klick-lista).

**Kritiskt att veta:** Fokus + Nya leads scopas via `coach_users.id` (identity-bridge från `clients.ghl_location_id`), INTE `client_id`. Kampanj-badgen ✨ är en GLOBAL `platform_modules.campaign`-flagga (tänds för alla pro-kunder) — beslut: SKIPPAD i demon. Supabase-DDL körs via Management API (`SUPABASE_ACCESS_TOKEN` i `Antigravity/.shared-keys.env`).

**Om Håkan ber dig fortsätta:** trolig nästa uppgift är att gå igenom `docs/FALTVALIDERING.md`-punkterna som han inte hann, eller finslip på ytterligare sidor. Fråga honom vad som är kvar innan du börjar. Fråga ALLTID före ny deploy.
