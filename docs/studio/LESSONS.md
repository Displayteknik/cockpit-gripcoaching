# LESSONS — Studio (Publiceringsmotorn)

Lärdomar under bygget. Abstrahera till generell regel; samma misstag två gånger är oacceptabelt.

---

## L-001 · Ärvda lärdomar från repot (inlästa i Fas 0, gäller Studio från dag ett)
- **Next 16 ≠ träningsdata:** `await cookies()/headers()`, `params: Promise<>`, `proxy.ts` i stället för `middleware.ts`. Läs `node_modules/next/dist/docs/` för berört område FÖRE kod.
- **Tysta insert-fel via CHECK-constraints:** skriv aldrig ett statusvärde som inte finns i tabellens CHECK; destrukturera alltid `error` från Supabase-anrop och hantera det.
- **Strikt-RLS-tabeller kräver `supabaseService()`** — anon blockeras tyst.
- **Lokal `next build` kan faila med EPERM/fillås** (OneDrive + annan dev-server låser `.next`) → typkolla med `tsc --noEmit`, låt Vercel bygga auktoritativt.
- **Tidigare bildmotor-försöket** (`public/opticur-mall/`, html2canvas): AI/canvas-baserad layout gav inte pixelperfekt resultat → Studio kör deterministisk HTML/CSS + riktig browser-screenshot.

## L-002 · Fas 1 — renderingsmotorn
- **Root-layout läcker HM Motor-globaler till nya ytor.** `app/layout.tsx` `isHmMotorSurface()` returnerar `true` som default → CoachWidget (synlig!), Clarity, VisitorTracker och localbusiness-schema injiceras. Varje ny publik render-/kundyta MÅSTE läggas i exclusion-listan. Studio: `path.startsWith("/studio/")` tillagt. (Samma familj som [[lesson_root_layout_leaks_to_customer_portal]].)
- **Next.js dev-indikatorn fastnar i Playwright element-screenshots.** `<nextjs-portal>` ligger `position:fixed` och överlappar canvas-elementets bounding box → "N"-märket hamnar i exporten. Fix: `page.addStyleTag({content:"nextjs-portal{display:none !important}"})` före screenshot (dev-only, rör ej next.config).
- **Browser-panelens screenshot-verktyg hänger på mycket stora bilder** (2.9 MB progressiv JPEG). DOM/JS-verifiering (`getComputedStyle`, `document.fonts.check`, `img.complete`) + Playwright element-screenshot är pålitliga alternativ för visuell verifiering.
- **Självhostade TTF från Googles statiska host** (`fonts.gstatic.com/s/.../*.ttf`) fungerar offline och deterministiskt — en fil per vikt, innehåller alla glyfer inkl. å/ä/ö. `font-display: block` så text aldrig renderas i fallback under export.
- **Element-screenshot > full-page.** Screenshotta `#studio-canvas` (Playwright locator) → exakt 1080×1350/1080×1080 oavsett body-layout, ingen clip-matte behövs.

## L-003 · Fas 1 — mallarna underkändes först ("helt kasst"), ombyggda mot referens
- **GISSA ALDRIG typsnitt.** Första försöket använde Anton (smal/kondenserad) — helt fel mot Opticurs Canva-mallar som använder en tung BRED rundad sans (Poppins-klass). Rätt approach: gör typsnittet till en brand.json-variabel (`fonts.headline/body`) som byts på en rad, och BEKRÄFTA namnet mot kundens Canva innan man kallar det klart. [[feedback_never_guess]]
- **Platshållar-assets får resultatet att se billigt ut.** Riktiga assets (logga stor+centrerad, ZEISS-logga, penseldrag-PNG, QR) är inte "nice to have" — de ÄR designen. Bygg layouten rätt mot referensbilden, men flagga tydligt vad som är platshållare och vad som krävs skarpt.
- **Font var Inter, inte Poppins.** Definitiv källa = kundens egen editor-fil (`Opticur_Editor_Tisdag.html`): Inter (rubrik/brödtext) + Playfair Display (logotyp). MEN riktiga publicerade annonsen (v14d) använder sans-wordmark `logo.png` för OPTICUR → använd den riktiga logo-filen, inte Playfair-text. Färger: `#1A6B3C` / `#0F4F2A` / gul `#F2B01E`.
- **Använd ALDRIG en godtycklig platshållar-bild** (jag satte ett moody kvinno-foto → "helt kasst", såg inget ut som exemplet). Klipp den RENA bilden ur kundens egna färdiga annonser: `scratchpad/crop.mjs` (Playwright + canvas via data-URL, inte file:// som blockeras) klipper barn-fotot ur `opticur barn202607.png` / `v14d.jpg` utan text/pensel/stjärna.
## L-004 · Fas 2 — textkvalitet (Håkans "usel text-skapare")
- **Ett billigt Gemini-anrop med generisk prompt räcker inte för träffsäker copy.** Hårda teckengränser
  → amputerade fragment ("EN LITEN SKÄV FÖRÄNDRAR"). Fix: hook-metodik (Kane) + brand-grundning +
  N varianter + kvalitetsfilter. Använd `iterateGenerate()` (finns), inte ett eget prompt-spår.
- **Affisch-text ≠ caption.** Motorn gav först långa caption-inlägg (emoji, ✅-listor, "— Ingela",
  telefonnummer) — passar inte i en bildmalls fält. Prompten MÅSTE säga "text PÅ en bild" + hård
  längd/renhet, och koden filtrera bort emoji/listor/signatur/kontaktinfo (finns redan i foten).
- **Teckengräns = MJUK riktlinje i prompt + UI-varning, aldrig ett hårt krav** (annars offras grammatik).
- **Studera ALLTID referensbilden pixel för pixel innan man bygger** (fot-lockup, badge-position, sol-stil, proportioner). Att bygga från textbeskrivning ensam → missar exakt layout. Håkan levererade referensbilder som avslöjade: centrerad stor OPTICUR-logga, badge nere-höger (ej uppe), kontur-sol i penseln vs fylld sol i mall 2.
