# STATUS 2026-07-19 — fullständig inventering

> Rekonstruerad ur repot denna session (git-logg, plan-/strategidokument, filsystem, migrations, grep).
> Metod: **statisk bevisgranskning** — jag har läst kod och SQL, men INTE kört den aktuella appen eller
> frågat live-DB denna session. Därför: kod som finns = "BYGGT". "KLART & VERIFIERAT" ges bara där
> mekanismen är logiskt bevisbar av mig nu. Tidigare sessioners QA-påståenden citeras men markeras
> som **ej reproducerade av mig**. Osäkert står under OSÄKERT — inget är gissat.

## SAMMANFATTNING
Innehålls-etapperna F–J och plattformsskalet Fas 0–6 är alla **byggda och committade** (2026-07-16→17) och
koden finns på disk (entitlements, publiceringsmodul med skarp IG, modulregister-migration, kundvy, admin
"Paket"). Ovanpå det byggdes 07-18→19 arbete **utanför båda planerna**: Offertmotorn, Fokusmotorn/SmartTextarea,
Studio Fas B/C och native schemaläggning. Största risken: den enda funktionella verifieringen som finns är
tidigare sessioners egna QA-påståenden (SÄKERHETSBEVIS 7/7, IG-live, 96 QA-bilder) — **inget av det är
återkört denna session**, och native schema har enligt föregående STATUS aldrig gått hela vägen job→cron→publicerat.

## ETAPP F–J (CONTENT-STRATEGI.md)
| Etapp | Status | Bevis (kontrollerat nu) | Lucka för KLART |
|---|---|---|---|
| F — Blogg-konsolidering | BYGGT | `42150a8`; nav-post "Blogg" + destinationsväljare. `blogg`+`blogg-maskin` finns kvar (motorerna behålls per plan) | Kör: EN blogg → GHL-utkast (DT) OCH native (HM) genom samma flöde |
| G — Formatbibliotek | BYGGT | `8bcab7a`; commit anger "Verifierat coach+Opticur". `ark-overlay`/`ark-textkort`/`contentProfile` | Visuell export ej återgranskad av mig |
| H — Kanaler/IG-rikedom | BYGGT | `78ff969` "Etapp H (IG-rikedom) + världsklass-lyft" | Story/karusell/reel-render ej återexporterad denna session |
| I — Innehålls-nav + kalender | BYGGT | `600f7cb`; `lib/content/overview.ts` (98 rader, `getContentOverview`) + `app/dashboard/innehall/page.tsx` | Kör: kalendern visar IG+Studio+blogg samtidigt för 3 klienter |
| J — En publiceringsmodul | BYGGT (stark) | `600f7cb`+`1b000f7`; `lib/publish/index.ts` routar 4 kanaler, **ig-graph fullt implementerad (ej stub)** | End-to-end genom samma modul ej kört; stale header-kommentar rad 9 |

## PLATTFORMSSKALET FAS 0–6 (docs/plattform/PLAN.md)
| Fas | Status | Bevis (kontrollerat nu) | Lucka för KLART |
|---|---|---|---|
| 0 — Inventering/plan | KLART | `docs/plattform/PLAN.md` finns och är komplett (leveransen = dokumentet) | — |
| 1–2 — Datamodell + åtkomstlager | BYGGT | `777ed8e`; `migrations/platform_modules.sql` = 4 tabeller (`clients.plan`, `platform_modules`, `tenant_modules`, `platform_users`) + RLS på alla + seed (7 live + 3 kommande) + kampanjkolumner. `lib/entitlements.ts` (`getEffectiveModules`/`hasModule`) | Ej verifierat mot live-DB att migrationen är **applicerad** och att grinden faktiskt nekar |
| 3–4 — Kundvy + admin "Paket" | BYGGT | `7e4cca0`; `app/dashboard/paket/page.tsx`, `app/k/ej-i-paket/page.tsx`, modulkorts-kundvy | Klick-/session-test ej gjort |
| 5 — IG in i lib/publish (en väg) | BYGGT (stark) | `1b000f7`; `publishIgGraph` delegerar till `lib/instagram` (single/carousel/story/reel + JPEG-konv). Gamla sidor pensionerade (redirects, se nedan) | Skarp IG-publicering ej reproducerad av mig |
| 6 — Säkerhetsbevis + Playwright-QA | DELVIS | `3e12577`; `docs/plattform/SAKERHETSBEVIS.md` (påstår 7/7 PASS live), `scripts/qa-screens.mjs`, `scratchpad/qa-security.mjs`, `qa-screens/` = **96 PNG** | Proven kördes 2026-07-17 av tidigare session — **jag har inte återkört qa-security.mjs eller granskat bilderna** |

Pensioneringen (Fas 5 / §3.3c) är **verifierad av mig**: `app/dashboard/(inlagg)/skapa/page.tsx` och
`app/k/skapa/page.tsx` innehåller enbart `redirect("/dashboard/studio")` resp. `redirect("/k/studio")` —
deterministiska no-op-redirects, kan inte göra annat. → KLART.

## UTANFÖR PLAN (byggt, hör ej till F–J eller Fas 0–6)
- **Native schemaläggning utan GHL** — `8c7def9`,`6e809e5`,`2a9ce1f` (07-19). `studio_scheduled`-tabell + `/api/studio/schedule` + cron (Vercel dagligt + GitHub Actions var 15:e min) + schema-översikt/kö (se/avboka/ändra tid).
- **Studio Fas B/C** — `d8cc28f`,`5c18b65`,`adc747d`,`5ff165d` (07-19). Multi-kanal IG/FB/LI, färgkodade steg, inline-canvas-redigering på alla 10 mallar.
- **Offertmotorn Fas 1–4** — `b4818f3`→`a4f8734` (07-18). Blueprint ur uppladdad offert, produktkatalog, skapa-flöde, generera offert + PDF, valuta/FX (Riksbanken).
- **Fokus/SmartTextarea m.m.** — `bfadc45`,`f83de29`,`dd05487`,`6af0cee` (07-18). DISC-tooltip, faktaruta+planera kontakt, röst/bild på alla innehållsfält.
- **Bugfix:** `cc2eeab` Opticur-footer läckte till annan klient (delegerar nu till generisk KitFooter).

## BYGGT MEN INTE VERIFIERAT (vad som krävs för bevis)
- **Native schema end-to-end** — föregående STATUS: test-jobb lagt+raderat, aldrig fullt kört. Bevis: ETT riktigt schemalagt inlägg som traverserar job→cron→`published`.
- **Platform-entitlements live** — bevis: live-DB-query att de 4 tabellerna finns + curl som visar icke-köpt modul → `307 /k/ej-i-paket` och köpt → `200`.
- **Säkerhetsbevis 7/7 + hardening** — bevis: återkör `scratchpad/qa-security.mjs`; bekräfta att `platform_hardening.sql`/`_step2.sql` är applicerade (RLS på, 0 anon-policies) mot live-DB.
- **Skarp IG-publicering** — bevis: bekräfta att `p/Da6JT9rFQkD` gäller eller posta en ny testpost via `lib/publish`.
- **GHL-utkast via lib/publish** — bevis: en GHL-kopplad klient (Opticur PIT) → utkast skapat.
- **Studio inline-redigering (10 mallar), F–J-flödena** — auth-gated, bevis: klick-/rendertest i webbläsare.

## KVAR (KOD) — föreslagen ordning
1. **Återkör QA-svepet** (`qa-security.mjs` + granska `qa-screens/`) — säkerhet ska vara bevisad, inte påstådd, före bredare utrullning.
2. **E2E-verifiera native schema** (ett riktigt jobb hela vägen) — kunder kan annars schemalägga inlägg som aldrig går ut.
3. **GHL-utkast-test genom lib/publish** (Opticur PIT) — enda publiceringsvägen som aldrig bevisats skarpt.
4. **Städa stale kommentar** `lib/publish/index.ts` rad 9 (säger ig-graph "migreras hit" — redan gjort) — vilseleder nästa utvecklare. (litet)
5. **Utrullning Studio/innehåll till fler klienter** bakom `customer_features`, default av — värdet realiseras först hos kund, men per live-klient-lagen.
6. **`platform_users` magic-link-flöde** — tabell finns, ingen UI/inloggning byggd; delad klient-token kvar som enda väg.

## BLOCKERAT AV HÅKAN
- **Skarp IG live-test:** OK att posta EN testpost på DT:s IG (~5 min), annars bara fel-vägen kan bevisas.
- **GHL-utkast-test:** kräver Opticur GHL-PIT-token (väntar). ~10 min när token finns.
- **Utrullningsbeslut:** vilka klienter får Studio/innehåll och i vilken takt (`customer_features`).
- **Cron-infra:** Vercel Hobby → native cron via GitHub Actions kräver repo-secret `CRON_SECRET` (föregående STATUS: löst — verifiera). Beslut om Vercel Pro?
- **RLS-väg:** Path A (app-nivå-lås) godkänd; äkta JWT/`auth.uid()`-RLS är flaggad som v2-beslut.

## TEKNISK SKULD & RISKER
- **Rent från debt-markörer:** grep efter TODO/FIXME/HACK/STUB i all `.ts/.tsx/.js/.mjs` → inga träffar (bara HTML-`placeholder`-attribut och ordet "stubin"). Positivt.
- **Stale kommentar** `lib/publish/index.ts` rad 9 motsäger den skarpa implementationen 20 rader ner.
- **Ingen Supabase Auth** → all tenant-säkerhet på app-nivå (service-role + `getActiveClientId`). DB-RLS kan inte uttrycka "user = tenant". Medvetet val (Path A) men innebär att RLS ensamt inte är sanningslager.
- **RLS-hardening ej live-verifierad:** `platform_hardening.sql`/`_step2.sql` finns i repot; PLAN §1.6 listar tidigare vidöppna tabeller (`agent_experiments`, `ideas_bank`, `gsc_queries_daily`, `ikigai_sessions` med lead-PII). Applicerat live? Ej kontrollerat denna session.
- **Cron-beroende:** native schema hänger på extern GitHub Actions-cron (kan pausas/fördröjas) pga Vercel Hobby.
- **Stor auth-gated yta byggd utan klick-verifiering** → förhöjd bugg-risk.
- **Ocommittat arbete:** git status rent — bara två untrackade filer (`HM-Motor-Fordonsguide.pdf`, denna `STATUS.md`). Inget halvfärdigt tracked-arbete döljer sig utanför loggen.
- **Historisk rapporteringsrisk:** föregående STATUS självflaggar att den sa "live" om odeployade Fas B/C när `*/15`-cron bröt alla Vercel-deploys. Läs live-påståenden med den bakgrunden.

## OSÄKERT (kunde ej avgöras ur repot — ej gissat)
- Om platform-migrationerna (`platform_modules`, hardening) faktiskt är **applicerade i live-DB** — SQL finns, live-state ej frågad.
- Om SÄKERHETSBEVIS 7/7 och IG-live (`p/Da6JT9rFQkD`) **fortfarande gäller** — ej reproducerat.
- Om `qa-screens/` (96 PNG) speglar aktuell kod eller är från 07-17-körningen — ej granskat bild-för-bild.
- Exakt status för **Offert-verkstad STEG 6-auth** och **Fokus v1.5** (väntar-på-offert/Inflödet) — nämns i projektminnet/handoffs, inte entydigt avläsbart i koden denna session.
- Om alla 10 Studio-mallar renderar korrekt vid inline-redigering — auth-gated, ej testat.
