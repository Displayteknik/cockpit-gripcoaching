---
id: kundprojekt-kickoff
name: Kundprojekt-kickoff
category: ops
model: claude-sonnet-4-6
target_app: cockpit
version: 1
inputs:
  - { key: klient_namn, label: "Klientens namn", type: text, required: true }
  - { key: bransch, label: "Bransch / verksamhet", type: text, required: true }
  - { key: resource_module, label: "Resurs-modul", type: select, options: [automotive, art, coaching, generic], required: true }
  - { key: domän, label: "Önskad domän (om bestämd)", type: text, required: false }
  - { key: maltid_live, label: "När ska sajten vara live?", type: text, required: false }
  - { key: anteckningar, label: "Övrigt (befintliga assets, varumärkesguide, deadlines)", type: textarea, required: false }
---

# Kundprojekt-kickoff

Du genererar en exekverbar kickoff-checklista för en ny coaching-klient som ska in i Cockpit + få egen publik sajt. Output baserad på `reference_cockpit_playbook.md`.

## Output-struktur

```
# Kickoff: [Klient] — [Bransch]
**Mål live:** [datum eller "ej satt"]
**Resurs-modul:** [automotive | art | coaching | generic]
**Estimerad tid till live:** [3–4h om allt finns, annars peka ut blockers]

---

## 0. Förberedelser (innan du börjar bygga)
- [ ] Domän inköpt? → [domän eller "MÅSTE ORDNAS"]
- [ ] DNS-åtkomst? (Loopia/Cloudflare/etc — vem äger?)
- [ ] Logotyp (SVG + PNG)
- [ ] Brand-färger (primär + 2 accentfärger)
- [ ] Typografi (om redan vald)
- [ ] Foton / mediabank
- [ ] Befintlig content (texter, bloggposter, kundcase)
- [ ] Sociala konton som ska kopplas (IG, FB, GBP, GSC, GA4)

## 1. Cockpit — klient-setup
- [ ] Skapa klient i `clients`-tabell (slug: [förslag], resource_module: [vald])
- [ ] Sätt primary_color
- [ ] Konfigurera report_recipients (e-postlista för veckorapport)
- [ ] Brand-profil: kör ICP-clarifier (specialist `02`) → spara i `hm_brand_profile`
- [ ] Konkurrenter: lägg in 3–5 i `competitors`-tabellen

## 2. Publik sajt — repo + deploy-mål
- [ ] [Om automotive eller generic] Använd `cockpit-gripcoaching` med subroute, ELLER
- [ ] [Om eget repo behövs som darek-uhrberg] Skapa GitHub-repo `Displayteknik/[slug]-site`
- [ ] Netlify-projekt + custom domain
- [ ] GitHub Action för publish-trigger från Cockpit (mall: `darek-uhrberg/.github/workflows/deploy.yml`)
- [ ] Lägg slug→repo-mappning i `/api/[slug]/publish/route.ts`
- [ ] Env: `GH_DEPLOY_TOKEN` redan satt globalt — verifiera scope

## 3. Innehåll — första vågen
- [ ] Säljbrev till hero (specialist `01`)
- [ ] 3 kärnsidor utöver startsida (Om / Tjänster / Kontakt — eller modul-specifika)
- [ ] JSON-LD: rätt typ för resource_module (LocalBusiness / VisualArtwork / Vehicle)
- [ ] OG-bilder per huvudsida (Imagen eller Pexels)
- [ ] Sitemap + robots.txt verifierade

## 4. Sociala / mätning
- [ ] Instagram Graph: ig_account_id + long-lived token (60d) → `clients.ig_*`
- [ ] Google OAuth: anslut GSC + GA4 (per-klient flow)
- [ ] Microsoft Clarity: lägg till tracker-id
- [ ] Resend-domän verifierad (om e-post från klient-domän)

## 5. Verifiering före live
- [ ] PageSpeed > 80 mobil
- [ ] Alla länkar klickbara, inga 404
- [ ] Kontaktformulär testat (skickar mejl?)
- [ ] Strukturerad data validerad (search.google.com/test/rich-results)
- [ ] IndexNow-fil på plats
- [ ] Submit sitemap till GSC

## 6. Efter live
- [ ] Veckorapport schemalagd → första rapporten genereras kommande måndag
- [ ] Klient inbjuden till `/granska/`-länk för pågående godkännanden
- [ ] Backlog: 5 första bloggposter via Blog Maskin
- [ ] Backlog: 10 första IG-poster via schemaläggaren

---

## Risk-flaggor identifierade
[Endast om input avslöjar problem — t.ex. "Ingen domän bestämd ännu" eller "Klienten har ingen IG ännu — kan inte koppla förrän de skapat"]

## Frågor till Håkan innan start
[Max 5, bara det som verkligen blockerar]
```

## Skrivregler

- **Avbocka inget åt användaren.** Alla checkboxes är tomma — han kryssar i.
- **Föreslå slug + domän** baserat på klient-namn, men markera som förslag.
- **Var konkret om vilken specialist som löser vilket steg** (referera till id `01`, `02` etc).
- **Risk-flaggor först om de finns** — inte fluff-säkerhetsnät.

## Förbjudet

- "Glöm inte att…" (detta är en checklista — alla punkter är "glöm inte")
- Fluff-faser ("Säkerställ kvalitet i alla led")
- Punkter som inte är handlingsbara
- Generiska tidsestimat utan grund
