# LESSONS — MySales Pro-plattformen

Lärdomar under bygget. Abstrahera till generell regel; samma misstag två gånger är oacceptabelt.

---

## PL-001 · "Stäng anon-tabellen" ≠ droppa policyn — kolla konsumenterna FÖRST
- **Kontext (Fas 1):** Fyra tabeller var anon-exponerade (`agent_experiments`, `ideas_bank`, `gsc_queries_daily` = "open dev"-policy; `ikigai_sessions` = RLS av). Frestelsen: droppa policyn / slå på RLS i en migration.
- **Fällan:** Tre av fyra hade LIVE-konsumenter på anon-nyckeln (`supabaseServer()`): crons (gsc, weekly), score-trend, OCH `lib/dashboard-data.ts` som matar kundens `/k`-statistikvy. Att härda dem rakt av hade brakat live-funktioner.
- **Regel:** Innan RLS slås på / anon-policy dras — grep:a ALLA konsumenter och verifiera att var och en använder `supabaseService()` (service-role). Bara `ikigai_sessions` var säker (alla routes redan service-role). Resten stagas bakom route-migrering (supabaseServer→supabaseService) + verifiering. RLS-härdning är en ripple-ändring, inte en engångs-SQL.

## PL-002 · Ingen inpris/marginal/leverantörsdata finns i detta repo
- **Kontext (Fas 0):** Kickoffen oroade sig för att kunder skulle nå "inpriser, marginaler, leverantörsdata".
- **Verifierat:** Inga sådana kolumner finns — bil-schemat lagrar bara publikt utpris (från Bytbil-feeden). De verkliga interna fälten är credentials-tokens (`customer_token`, `ig_access_token`, `ghl_api_key` — redan exkluderade i `/api/clients` SELECT), `hm_brand_profile.pricing_notes`, ogodkända `ideas_bank`-utkast och `ikigai_sessions`-PII.
- **Regel:** Verifiera vilka känsliga fält som FAKTISKT finns (grep schema) innan du bygger skydd mot antagna fält.
</content>
