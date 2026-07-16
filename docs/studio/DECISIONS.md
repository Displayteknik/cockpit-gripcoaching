# DECISIONS — Studio (Publiceringsmotorn)

Beslutslogg. Ett beslut per rad-block: vad, varför, när, status.

---

## D-001 · Export-arkitektur: A (lokal Playwright-CLI) för Fas 1–2
- **Datum:** 2026-07-15 (Fas 0)
- **Status:** GODKÄNT (Håkan: "kör" med defaults). Playwright 1.61 + tsx som devDependencies. Chromium installerat lokalt. Produktionsval (B/C) omprövas vid Fas 3-stoppet.
- **Vad:** PNG-export sker via `scripts/studio-export.ts` (Playwright som devDependency, lokal Chromium mot dev-servern). Produktionsbeslut (B serverless / C render-tjänst ~5 USD/mån) skjuts till Fas 3-stoppet.
- **Varför:** Playwright/Chromium kör inte pålitligt i Vercel standard-serverless; A blockerar aldrig Fas 1 och kostar inget. Render-routen är tjänst-agnostisk så B/C kan läggas till utan ombyggnad.

## D-002 · `studio_clients` nycklas mot befintliga `clients` (uuid FK)
- **Datum:** 2026-07-15 (Fas 0)
- **Status:** GODKÄNT (default accepterat). Öppna frågor 2 (global ClientPicker) + 3 (GHL-token i strikt-RLS-kolumn) likaså accepterade — implementeras i Fas 2–3.
- **Vad:** `studio_clients.client_id uuid PK REFERENCES clients(id)` + `slug text`, i stället för kickoffens fristående text-id.
- **Varför:** Hela Cockpits tenant-säkerhet (active_client_id, ClientPicker, getActiveClientId) arbetar med `clients.id`. En parallell id-rymd = mappningskod + risk för glapp.

## D-003 · Mallkomponenter i `components/studio/templates/`, inte `app/studio/templates/`
- **Datum:** 2026-07-15 (Fas 0)
- **Status:** BESLUTAT (konventionsföljd, ingen funktionsskillnad)
- **Varför:** Repots konvention: `app/` = routes, `components/` = komponenter.

## D-004 · Deterministisk layout — AI ritar ALDRIG
- **Datum:** 2026-07-15 (Fas 0, från kickoffen)
- **Status:** BESLUTAT (kärnprincip)
- **Vad:** Layout = HTML/CSS-mallar med fast payload-kontrakt. AI används endast för textförslag (Fas 2), SEO-paket (Fas 4), ev. foto (Fas 5).
- **Varför:** Lärdom från tidigare bildmotor-försök (`public/opticur-mall/`, html2canvas) som misslyckades. Gamla vägen lämnas orörd tills Studio bevisats live (behåll-fallback-regeln).

## D-006 · Fas 2 AI-textförslag använder Gemini, inte Anthropic
- **Datum:** 2026-07-16 (Fas 2)
- **Status:** BESLUTAT (flaggat för Håkan)
- **Vad:** `/api/studio/suggest-text` kör Gemini 2.5-flash (befintlig `lib/gemini.ts`), inte kickoffens `claude-sonnet-4-6`.
- **Varför:** Huset kör Gemini som default-provider (feedback_ai_provider), ingen Anthropic-kod-wrapper finns, och `claude-sonnet-4-6` är inte i aktuell modell-lista. Lägre risk, funkar direkt. Byte till Anthropic = enkelt om Håkan vill.

## D-007 · Fas 2 export = en-klicks lokal endpoint + payload-fallback
- **Datum:** 2026-07-16 (Fas 2)
- **Status:** BESLUTAT
- **Vad:** `/api/studio/export` kör Playwright på dev-servern (Node) → returnerar PNG-dataURL (en klick i UI). Runtime-import av `playwright` (devDependency) så prod-bygget inte drar in den; i molnet → 501 + "ladda ner payload / kör CLI".
- **Varför:** Bästa demo-UX lokalt utan att bryta alt A (Fas 0). Prod-export (B/C) beslutas fortf. vid Fas 3-stoppet.

## D-008 · Studio-UI på /dashboard/studio + utkast i localStorage (v1)
- **Datum:** 2026-07-16 (Fas 2)
- **Status:** BESLUTAT
- **Vad:** UI:t ligger på `/dashboard/studio` (admin-grindat av proxy.ts), egen nav-grupp "Studio". Utkast sparas i localStorage i v1.
- **Varför:** Konsekvent med Cockpits moduler + admin-skydd. `studio_posts`-tabellen (DB-utkast/publicering) byggs i Fas 3 tillsammans med GHL.

## D-009 · Hook-driven textmotor — motorval A (iterateGenerate/Anthropic)
- **Datum:** 2026-07-16 (Fas 2, efter Håkans granskning)
- **Status:** BESLUTAT & VERIFIERAT
- **Vad:** `/api/studio/suggest-text` kör nu `lib/studio/copy.ts` `generateStudioCopy()` = hook-playbook
  (`knowledge/hook-playbook.md`, destillerad ur Brendan Kane *Hook Point* + *Going Viral*) + brand-profil
  + voice-fingerprint + winning examples via `iterateGenerate()` (Anthropic sonnet, 5 varianter) →
  regelfilter (inga fragment/emoji/kontaktinfo, affisch-längd) → topp 3 (en per hook-typ) till UI.
- **Varför A (Anthropic/iterate) inte B (Gemini):** iterate finns, beprövad, voice-score + winning
  examples inbyggt. Det tidigare Gemini-anropet gav osäkra fragment ("EN LITEN SKÄV FÖRÄNDRAR").
- **Verifierat:** Opticur → optik-grundat (samsyn, blinkningar, Ingela); HM Motor → bil (vinterservice,
  däck). Hook-typer roterar, hela meningar, affisch-format. Kostnad ~5 sonnet-anrop/klick (~50 öre–1 kr).

## D-005 · Nya tabeller får strikt RLS från start + status-CHECK
- **Datum:** 2026-07-15 (Fas 0)
- **Status:** BESLUTAT (följer repo-konvention `client_assets.sql`)
- **Vad:** `studio_*`-tabellerna: RLS på, anon nekas allt, endast service-role via `/api/studio/*` som verifierar tenant. `studio_posts.status` har CHECK-constraint med exakt de värden koden skriver.
- **Varför:** Repo-standard sedan RLS-audit; status-CHECK-lärdomen från deep-audit (okänt statusvärde → tyst insert-fel → orphan).
