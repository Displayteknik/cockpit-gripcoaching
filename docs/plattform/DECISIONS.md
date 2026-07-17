# DECISIONS — MySales Pro-plattformen

Beslutslogg för entitlements/roller/kundvy-bygget. Ett beslut per block: vad, varför, när, status.

---

## P-001 · MySales Pro = GHL-bas + entitlement-styrda Cockpit-moduler
- **Datum:** 2026-07-17 (Fas 0). **Status:** GODKÄNT (affärsbeslut, fastställt av Håkan).
- **Vad:** MySales (basen) = GHL (app.mysales.se, orörd). MySales Pro = MySales + ett konfigurerbart urval Cockpit-moduler, styrt av ett modulregister + Pro-standarduppsättning + kampanjmekanik. Kundens hubb förblir GHL; Cockpit är satellit via Custom Menu Link.
- **Varför:** Säljbart paket där Håkan styr innehållet på ETT ställe (inkl. "Just nu ingår även XYZ"-kampanj).

## P-002 · Säkerhet = app-nivå + härdning (Path A), inte JWT-RLS
- **Datum:** 2026-07-17 (Fas 0-stopp). **Status:** GODKÄNT (Håkan valde A).
- **Vad:** Behåll den bevisade app-nivå-modellen (service-role + hård tenant-lås via getActiveClientId/customer_token). Sanningslager = strikt RLS/service-role-only på känsliga tabeller + EN central `hasModule`/tenant-check. Bevisas i Fas 6 med test-användare.
- **Varför:** Ingen Supabase Auth finns → `auth.uid()`-baserad DB-RLS är omöjlig idag. Att införa Supabase Auth = fler dagars migration som rör varje dataväg och riskerar live-klienter (CF får aldrig störas). Full JWT-RLS = uttalat v2.

## P-003 · Modulregistret i DB (platform_modules) ersätter hårdkodad TS-lista
- **Datum:** 2026-07-17 (Fas 1). **Status:** BYGGT, väntar körning vid Fas 1-stopp.
- **Vad:** `platform_modules` (id, label, description, href, icon, owner_area, sort_order, active, in_pro_default, campaign, campaign_label, campaign_until). Pro-standard = `in_pro_default=true` (EN plats). Kampanjfält på modulraden (EN Pro-uppsättning; tenant-prisplaner = v2). Seedas från CUSTOMER_FEATURES; legacy `customer_features` behålls som fallback.
- **Varför:** Kickoffen kräver ett register + Pro-standard-på-ett-ställe + kampanj. Behåll-fallback så befintliga kunder aldrig påverkas.

## P-004 · Effektiv behörighet beräknas i EN funktion (lib/entitlements.ts)
- **Datum:** 2026-07-17 (Fas 1). **Status:** BYGGT.
- **Vad:** `getEffectiveModules(clientId)` = (Pro-standard ∪ aktiv kampanj ∪ manuella tillägg) − manuella avdrag. `hasModule()` bygger på den. Aldrig ad hoc i komponenter.
- **Varför:** Kickoffens uttryckliga krav på central beräkning.

## P-005 · Per-användar-roller (platform_users), inga delade konton
- **Datum:** 2026-07-17 (Fas 1). **Status:** SCHEMA BYGGT (UI i Fas 4).
- **Vad:** `platform_users` (email, client_id NULL=owner, role owner|customer|customer_member, login_token magic-link). Löser sig ovanpå befintlig HttpOnly kund-session. `customer_member` reserverat, ingen UI. Delad klient-token behålls som fallback.
- **Varför:** Kickoffen kräver email→tenant+roll, aldrig lösenord i klartext, aldrig delade konton.
</content>
