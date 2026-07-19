# BUILD-INVENTORY 2026-07-19 — hela Cockpit GripCoaching

> Total inventering av allt som finns byggt i repot `Displayteknik/cockpit-gripcoaching` (`hmmotor-next/`).
> Metod: filsystem + git-logg + migrations. Allt nedan är **verifierat att FINNAS** (routes/filer lästa/listade).
> "Finns" = koden är byggd och committad. Funktionell verifiering (att det fungerar live) är INTE gjord denna
> session utom där annat anges — se `STATUS.md` för plan-avstämning och verifieringsluckor.
>
> Omfattning: **361 commits** (2026-04-11 → 2026-07-19) · **40 owner-sidor** · **13 kund-sidor** ·
> **192 API-routes** · **~55 lib-moduler** · **19 migrations** · **6 Vercel-cron + GitHub Actions**.

---

## 1. PLATTFORM, AUTH & ACCESS
| Del | Var | Vad |
|---|---|---|
| Auth/roller | `lib/admin-auth.ts`, `lib/api-auth.ts`, `proxy.ts` | HMAC admin-session (owner + klient-scopad), HttpOnly kund-session, fail-closed API-grind |
| Tenant-lås | `lib/client-context.ts`, `lib/customer-context.ts` | Hård multi-tenant-isolering; kund-session ignorerar manipulerbar cookie |
| Entitlements | `lib/entitlements.ts`, `lib/customer-features.ts`, `lib/feature-flags.ts` | `getEffectiveModules`/`hasModule`, modul-grind per klient |
| Modulregister | `migrations/platform_modules.sql` (`platform_modules`, `tenant_modules`, `platform_users`, `clients.plan`) + `/api/platform/*` | EN källa för moduler, Pro-standard, kampanj, per-tenant-override, per-användar-roll (roll-tabell finns, magic-link-UI ej byggd) |
| Admin "Paket & moduler" | `/dashboard/paket`, `/dashboard/kund-access` | 3 vyer: Pro-standard, per kund, användare |
| Kund-access-toggle | `/api/clients/customer-access` | Slå på/av moduler + access + rotera token |
| Login/logout | `/logga-in`, `/login`, `/k-utloggad`, `/admin/login`, `/api/admin/*` | — |

## 2. INNEHÅLL & PUBLICERING
| Del | Var | Vad |
|---|---|---|
| **Innehålls-navet (Etapp I)** | `/dashboard/innehall`, `lib/content/overview.ts` | Stegmodell IDÉ→SKAPA→GRANSKA→PUBLICERA→FÖLJ UPP, statusbadges, läser alla innehållstabeller |
| **Publiceringsmodul (Etapp J)** | `lib/publish/index.ts` | EN väg → IG Graph / GHL Social / GHL Blogs / cockpit-native, gemensam statusmodell. IG fullt implementerad |
| **Studio (makaren)** | `/dashboard/studio`, `/k/studio`, `lib/studio/*` (brand, kit, copy, carousel, payload, templates, ghl, logo-assets), `components/StudioMaker.tsx` | 8 arketyper + Opticur-mallar, brand-kit-driven PNG-render, inline-redigering (10 mallar), multi-kanal IG/FB/LI, caption-skapare, 9:16 story/reel |
| Studio API | `/api/studio/*` (~25 routes: brand, adapt-channel, carousel, edit-image, export, media, publish, schedule, suggest-caption/image/text, blog/*) | Rendering, kanalanpassning, publicering, schema |
| **Skapa inlägg (IG-motorn)** | `/dashboard/(inlagg)/*` (skapa→redirect, social, veckoplan, scheduler, dm, analytics, fordon-inlagg) | Pensionerad skapa-sida → Studio; rytm/DM/analys/IG-publicering lever kvar |
| IG Graph | `lib/instagram.ts`, `/api/instagram/{connect,publish,publish-internal,sync}`, `components/InstagramConnect.tsx` | single/carousel/story/reel + JPEG-konv, cron-publicering via `scheduled_posts` |
| Post-render | `/api/posts/[id]/{render-carousel,render-photo-overlay,render-svg,nano-banana,build-image-prompt,set-image}` | Bild-render per format |
| Generatorer | `/api/generate/{post,week,hashtags,regenerate}`, `/api/social/*` | AI-inlägg, veckoplan, hashtags, topic-suggest |
| **Blogg (Etapp F, konsoliderad)** | `/dashboard/blogg`, `/dashboard/blogg-maskin`, `/dashboard/studio/blogg`, `lib/studio/blog.ts` | EN modul + destinationsväljare (GHL Blogs \| native \| utkast), outline-först, idé-bank, kö/cron, interna länkar, FAQ-schema, omslagsbild |
| Blogg API | `/api/blog/*` (cron, generate, generate-cover, ideas, internal-links, outline, queue, voice-check), `/api/studio/blog/*` | — |
| **LinkedIn-motorn** | `/dashboard/linkedin`, `/k/linkedin`, `components/LinkedinMaker.tsx`, `/api/linkedin/*` (analyze, draft, ideas, import, pillars, posts, seed-pillars) | Pelare→idéer→skrivare→post-bank |
| **Mejl-motorn** | `/dashboard/mejl` | Mejl-kampanjer/sekvenser |
| **Native schemaläggning** | `studio_scheduled`-tabell, `/api/studio/schedule`, `/api/scheduler/cron`, `.github/workflows/scheduler.yml`, `/dashboard/studio/kalender` | Cron publicerar IG / flippar blogg utan GHL. Vercel dagligt + GH Actions var 15:e min. Se/avboka/ändra tid |
| Kalender | `/dashboard/studio/kalender`, `/dashboard/(inlagg)/veckoplan`, `/k/veckoplan` | Publiceringsöversikt + veckoplan |
| Idé-bank | `/dashboard/ikigai`… `/k/ideer`, `/api/agents/ideas`, `/api/customer/ideas` | Godkänn AI-idéer/utkast |
| Godkännanden | `/dashboard/godkannande`, `/api/review/post`, `/granska/[token]` | Kund granskar/godkänner via länk |

## 3. VARUMÄRKE, RÖST & INTAKE
| Del | Var | Vad |
|---|---|---|
| Brand Kit (grafisk profil) | `/dashboard/brand-kit`, `lib/studio/{brand,kit,brand-agent,logo-assets}.ts`, `/api/brand-kit`, `/api/brand-kit/agent` | Färgroller, logga (ljus/mörk), typsnitt, element, bildstil, donts, contentProfile; auto-setup-agent ur webbplats |
| Brand-profil (röst/ICP) | `/dashboard/profil`, `/k/profil`, `/api/profile*`, `/api/brand/prefill` | Röst, kunder, ICP |
| Profil-analysator | `/dashboard/analysator`, `/api/profile-analyzer`, `/api/profile/quality` | Analysera profilkvalitet |
| Konkurrenter | `/dashboard/konkurrenter`, `/api/competitors`, `/api/competitors/analyze` | Konkurrentanalys |
| Voice-motor | `lib/voice-fingerprint.ts`, `lib/voice-score.ts`, `lib/voice-enforce.ts`, `/api/{text,blog}/voice-check`, `/api/voice/rebuild` | Röst-fingerprint, voice-score-iterationer, AI-språk-grind |
| Intake-agent | `components/IntakeAgent.tsx`, `/api/intake/*` (analyze, clarify, commit, proposals, sessions, upload) | Transkript/dokument → brand-insikter |
| SmartTextarea (röst/bild) | `components/SmartTextarea.tsx`, `/api/ai/transcribe`, `/api/ai/vision` | Röstinmatning + bildanalys på ~alla innehållsfält |

## 4. SEO / AEO / GEO & SAJT
| Del | Var | Vad |
|---|---|---|
| SEO-verktyg (Pro) | `/dashboard/seo`, `/dashboard/seo-aeo`, `/k/seo`, `/api/seo/*` (audit, content-audit, deep-audit, ai-visibility, keyword-ideas, keywords, keywords/import-gsc, paa, page-text, report) | Sid-analys, åtgärdslista, sökords-tracker, AI-synlighet, djupgranskning |
| Deep-audit | `lib/{seo-deep,seo-audit,deep-audit-generate,deep-audit-finalize}.ts`, `/api/analytics/deep-audit` | Async batch-djupgranskning, kundvänd read-only-vy |
| Google GA4/GSC | `lib/{ga4,google}.ts`, `/api/google/*` (auth, callback, ga4/*, gsc/*, indexing, status) | Auto-matcha domän, rapporter, GSC-import, IndexNow |
| Sidor/schema | `/dashboard/sidor`, `/api/pages`, `lib/structured-data.ts`, `/api/indexnow` | Sid-CMS + schema-injektion |

## 5. KUNDPORTAL /k (kund-vänd)
| Modul | Route | Status |
|---|---|---|
| Kundportal-skal | `app/k/layout.tsx`, `app/k/page.tsx`, `/api/k/dashboard` | Egen meny, kundens brand, modulkorts-grid, "Att göra nu" |
| Varumärke & röst | `/k/profil` | live |
| SEO & AEO | `/k/seo` | live |
| Statistik & synlighet | `/k/besokare` | live |
| Innehållsstudio | `/k/studio` (`/k/skapa`→redirect) | live |
| Idé-bank | `/k/ideer` | live |
| Veckoplan | `/k/veckoplan` | live |
| DM & Pipeline | `/k/dm` | live |
| LinkedIn-motorn | `/k/linkedin` | live (kund) |
| Ikigai-motor | `/k/ikigai` | live (kund) |
| Fokus idag | `/k/fokus` | live (kund) |
| Offert | `/k/offert` | read-only lista |
| Ej-i-paket | `/k/ej-i-paket` | paket-grind |

## 6. OFFERTMOTORN (07-18)
| Del | Var | Vad |
|---|---|---|
| Blueprint | `/api/offert/blueprint`, `migrations/offert_blueprint.sql` | Lär klientens offertstruktur ur uppladdad offert (docx/pdf) |
| Produktkatalog | `/api/offert/products`, `/products/extract`, `migrations/offert_products.sql` | CRUD + AI-importera prislista + prisförslag |
| Offert-flöde | `/api/offert/{customers,quote,quotes,generate,market}`, `migrations/offert_quotes.sql` | Kundväljare, produktrader, live-kalkyl, marknadskoll, generera + PDF |
| Valuta/FX | `lib/offert/fx.ts`, `lib/offert/kalkyl.ts`, `/api/offert/fx` | USD/EUR/CNY + Riksbanken-FX + SEK-omräkning + frakt-flaggor |

## 7. FOKUSMOTORN (07-18)
| Del | Var | Vad |
|---|---|---|
| IDAG-tavla | `/k/fokus`, `components/FokusClient.tsx`, `lib/fokus/*` (priority, coach, config, types) | Prioritetsmotor, set-värde, AI-säljcoach, faktaruta, planera kontakt (→ Att göra idag + GHL-uppgift), DISC-tooltip |
| API | `/api/fokus/*` (board, coach, contact, overview, plan, set-varde), `migrations/fokus_planering.sql` | — |
| Coach-brygga | `lib/coach-bridge.ts`, `/api/coach`, `components/CoachWidget.tsx`, `/api/cockpit/coach-users` | Identitetsbrygga mot MySales Coach |

## 8. FORDON (HM Motor)
| Del | Var | Vad |
|---|---|---|
| Fordonshantering | `/dashboard/fordon`, `/dashboard/(inlagg)/fordon-inlagg`, `lib/bytbil.ts` | Bilar från Bytbil, edit-bevarande |
| API | `/api/fordon/*` (sync-bytbil, sync-cron, mark-sold, post-suggest, sales-stats), `app/fordon` (publik) | Daglig auto-synk, säljräknare, publik fordonssida |

## 9. BILD & MEDIA
| Del | Var | Vad |
|---|---|---|
| Image Studio | `components/ImageStudio.tsx`, `components/ImagePicker.tsx`, `/api/social/generate-image`, `/api/images/*` (search, pexels, upload, feedback) | Industri-medveten bildgen, Pexels/stock, feedback |
| Nano-banana | `/api/posts/[id]/nano-banana`, `/api/studio/edit-image` | AI-bildredigering |
| Assets/media | `lib/assets.ts`, `/api/assets/*` (upload, upload-url, finalize, transcribe), `/api/studio/media` | Personligt mediabibliotek per tenant, signerad direkt-upp |
| Stock | `lib/stock.ts`, `/api/social/stock` | — |

## 10. KLIENTSAJTER & PUCK-BYGGARE
| Del | Var | Vad |
|---|---|---|
| Life i Balans (route-serverad sajt) | `app/sites/lifeibalans/`, `lib/puck-config-lifeibalans.ts`, `lib/puck-lifeibalans-*.ts`, `/api/lifeibalans/{lead,test}` | Startsida + 5 undersidor, native form (Resend), host-rewrite proxy |
| Darek (art) | `lib/puck-config-darek.ts`, `components/Darek*`, `/api/darek/*` (content, publish, puck, render), `/dashboard/verk`, `/dashboard/utstallningar` | Konst-klient, Puck-editor, verk/utställningar |
| Art-modul | `lib/puck-config-art.ts`, `migrations/art_module.sql` | `art_works`, `art_exhibitions` |
| Scandinavian Hay Days | `/dashboard/haydays`, `/api/haydays/*` (content, preview, publish) | Event-sajt |
| Publik render | `app/[slug]`, `app/blogg`, `app/fordon`, `lib/puck-config.ts`, `/api/admin/[[...path]]` | Puck-serverade sidor + blogg + fordon |

## 11. RAPPORTER, INSIKTER & ANALYS
| Del | Var | Vad |
|---|---|---|
| Analytics-dashboard | `/dashboard/analytics`? → `/dashboard/(inlagg)/analytics`, `components/AnalyticsDashboard.tsx`, `components/CustomerAnalytics.tsx`, `/api/analytics/*` | GA4/GSC-dashboard, kundvänd analys |
| Veckorapport | `/dashboard/rapport`, `/api/reports/weekly*`, `/api/reports/weekly/[id]/mail` | Automatisk veckorapport + mejl |
| HQ | `/dashboard/hq` | Byrå-översikt |
| Insikter | `lib/{dashboard-data,dashboard-insights,insights}.ts` | "Att göra nu"-insikter |
| Aktivitet/spårning | `/api/activity`, `/api/track`, `/api/share`, `/api/share/[token]`, `/api/lead` | Lead-fångst, delning, pixel-spårning |

## 12. AI-INFRA & SPECIALISTER
| Del | Var | Vad |
|---|---|---|
| Gemini-lager | `lib/gemini.ts` | thinkingBudget-hantering, alla AI-anrop |
| Specialister | `/dashboard/specialister`, `/dashboard/specialister/[id]`, `lib/specialists.ts`, `/api/specialist`, `/api/specialist/[id]/run` | AI-specialist-prompter, synk mot källa |
| Natt-iteration | `/api/agents/night-iterate`, `/api/setup/night-iterate`, `lib/iterate.ts`, `/dashboard/agents`, `/api/agents/{ideas,score-trend}` | Nattlig auto-förbättring |
| Handbok/kunskap | `/dashboard/handbok`, `lib/{knowledge,knowledge-links}.ts` | Intern kunskapsbank |

## 13. SETUP & ONBOARDING
| Del | Var | Vad |
|---|---|---|
| Setup-agent | `/dashboard/setup`, `/dashboard/setup/onboard`, `lib/setup-tools/index.ts`, `/api/setup/*` (chat, onboard-status, pixel-snippet, voice-rebuild) | Guidad onboarding, pixel-snippet, voice-rebuild |
| MySales-kunder | `/dashboard/mysales-kunder`, `/api/cockpit/coach-users` | Pionjär-hantering |
| Klientväxling | `/api/clients/{active,switch}`, `components/ClientPicker.tsx` | Referer-medveten switch |
| Import | `/api/import/instagram-pro` | — |

## 14. IKIGAI (lead-magnet)
| Del | Var | Vad |
|---|---|---|
| Ikigai | `/dashboard/ikigai`, `/k/ikigai`, `app/ikigai` (publik), `components/IkigaiMaker.tsx`, `lib/{ikigai,ikigai-questions}.ts`, `/api/ikigai/*` (generate, public, sessions), `migrations/ikigai_sessions.sql` | Lead-magnet som fångar/kvalificerar (person_email = PII) |

## 15. DATAMODELL & CRON
**Migrations (19):** `platform_modules`, `platform_hardening`, `platform_hardening_step2`, `platform_backfill_live`, `client_assets`, `dm_pipeline`, `ideas_bank`, `agent_experiments`, `gsc_queries_daily`, `ikigai_sessions`, `art_module`, `multitenant_resources`, `offert_blueprint`, `offert_products`, `offert_quotes`, `fokus_planering`, `displayteknik_brand_init`, `engens_trad_onboard/strategidoc` + seed (darek). Kärntabeller (`clients`, `hm_*`, `studio_*`) skapade via Management API.

**Cron (Vercel `vercel.json`):**
- `/api/blog/cron` — mån/ons/fre 07:00 (blogg-kö)
- `/api/scheduler/cron` — dagligen 07:00 (IG-publicering / native schema)
- `/api/agents/night-iterate` — 02:30 (natt-iteration)
- `/api/google/gsc/cron` — 03:00 (GSC-synk)
- `/api/fordon/sync-cron` — 06:00 (Bytbil-synk)
- `/api/reports/weekly-cron` — mån 07:00 (veckorapport)

**GitHub Actions:** `.github/workflows/scheduler.yml` — native schema var 15:e min (kräver `CRON_SECRET`).

---

## KLIENTER ONBOARDADE (per minne + migrations/seed — ej live-återtestat denna session)
HM Motor (default), Carl-Fredrik/Ledarskapskultur, Darek Uhrberg, Engens Träd, Opticur, Displayteknik, Life i Balans, Scandinavian Hay Days.

## VERIFIERINGSLÄGE (se STATUS.md för detaljer)
Allt ovan är **byggt och committat** (verifierat att finnas). **Funktionell** verifiering (körd app / live-DB /
skarp publicering) är INTE gjord denna session — den vilar på tidigare sessioners egna QA (SÄKERHETSBEVIS 7/7,
IG-live, 96 QA-bilder), som inte är reproducerade. Största overifierade riskpunkten: native schema end-to-end.
