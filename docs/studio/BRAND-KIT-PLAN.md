# Brand Kit & mall-arketyper — plan (v1 + v2)

> Skriven 2026-07-16 (Fable 5). Status: **VÄNTAR PÅ GODKÄNNANDE — ingen kod skrivs innan Håkan säger kör.**
> Kompletterar `PLAN.md` (Fas 0–5). Detta dokument ersätter Fas 5-punkten "Mallar för HM Motor, Ledarskapskultur, Displayteknik" med en starkare arkitektur.

---

## 1. Insikten (problemet, verifierat i kod + DB)

Studio är idag **Opticur-formad**. Texten är multi-klient, det visuella är enkelklient:

| Del | Läge idag (verifierat) | Konsekvens |
|---|---|---|
| `hm_brand_profile` | Enbart text (ton, story, ICP, dos/donts, tjänster, citat) | Branding-modulen vet inget om hur kunden SER ut |
| Visuell identitet | `clients.primary_color` (en färg) + `clients/opticur/brand.json` (handgjord, bara Opticur, ej redigerbar i UI) | Ny kund = konsulttimmar i repo |
| Mallar | 2 st hårdkodade Opticur-komponenter; färgtokens är Opticur-namngivna (`c.yellow`, `c.greenDark`, `c.mint`…) | Displayteknik/CF/HM Motor får Opticurs form i fel färg — "noll bra" |
| Fallback (`loadBrand`) | clients-raden → namn + primary_color + deriverade nyanser | Kraschar inte, men blir aldrig *rätt* — ingen logga, ingen fot, ingen prägel |
| Bildgen/blogg-omslag | Prompt utan visuell styrning per kund | Bildstil slumpas, ingen "vill-inte-ha"-respekt |

**Målbild:** varje kund får ~5 mallar med egen prägel + rätt bildstil i ALLT innehåll (social, blogg, omslag) — utan att en enda mallkomponent handbyggs per kund. Mallarbete blir SOP, inte konsulttid.

**Kärnidé:** `arketyper × brand kit = kundens mallar`. Arketypen äger LAYOUTEN (deterministisk, AI ritar aldrig). Kitet äger PRÄGELN (färgroller, typsnitt, logga, element, bildstil). Opticurs handgjorda mallar behålls orörda som premium-nivå ovanpå.

---

## 2. Arkitektur-översikt

```
Brand-profil-modulen (flik "Grafisk profil")
        │  redigerar
        ▼
studio_brand_kits (DB, jsonb, strikt RLS)          clients/<slug>/brand.json (repo)
        │  läses av                                        │ premium-override (Opticur)
        └──────────────► loadBrand v2 ◄────────────────────┘
                              │  StudioBrand v2 (ROLL-baserade tokens)
        ┌─────────────────────┼──────────────────────┐
        ▼                     ▼                      ▼
  5 arketyp-mallar      Blogg-omslag/bildgen    Repurposing/captions
  (components/studio/   (stilprompt + negativ-  (väljer arketyp per
   archetypes/)          lista ur kitet)         kund, rätt prägel)
```

Upplösningsordning i `loadBrand(slug)`:
1. `clients/<slug>/brand.json` finns → **premium-override** (Opticur; översätts till roll-tokens via adapter).
2. `studio_brand_kits`-rad finns → **kundens kit** (normalfallet efter v1).
3. Annars → dagens fallback (clients-raden), nu med roll-tokens.

Payload-kontraktet (`StudioPayload`) ändras INTE → biblioteket, export-CLI:t, GHL-publiceringen och render-routen är opåverkade.

---

## 3. Datamodell

### 3.1 `studio_brand_kits` (ny tabell, strikt RLS — service-role only, som studio_posts)

```sql
create table studio_brand_kits (
  client_id uuid primary key references clients(id) on delete cascade,
  kit jsonb not null default '{}'::jsonb,
  version int not null default 1,          -- bump vid strukturändring av kit-schemat
  source text not null default 'manual',   -- 'manual' | 'agent' (v2) | 'agent+manual'
  updated_at timestamptz not null default now()
);
alter table studio_brand_kits enable row level security;
```

En rad per klient (PK = client_id). Historik behövs inte i v1 — kitet är levande konfiguration, inte innehåll.

### 3.2 `kit`-jsonb — fullständigt schema (v1)

```jsonc
{
  "colors": {
    // ROLLER — inte kulörnamn. Mallar refererar ALDRIG "gul", alltid en roll.
    "primary":    "#1A6B3C",   // huvudfärg (rubriker, knappar, bärande ytor)
    "primaryDeep":"#0F4F2A",   // mörk variant (kontrast, footrar)
    "primaryLight":"#5AAF32",  // ljus variant (accY ytor, hover)
    "accent":     "#F2B01E",   // energifärg (penselruta, badge, CTA-detalj)
    "support":    "#7ECECA",   // lugn stödfärg (bakgrundszon, citat)
    "ink":        "#1A1A1A",   // brödtext på ljus yta
    "paper":      "#FFFFFF",   // ljus bakgrund
    "forbidden":  ["#FF0000"]  // färger som ALDRIG får användas (vill-inte-ha)
  },
  "fonts": {
    // Endast ur kuraterat självhostat bibliotek (public/fonts/) — render-determinism.
    "headline": "Archivo",     // Inter | Archivo | Poppins | Anton | Playfair Display
    "body":     "Inter",
    "logo":     ""             // tom = använd uppladdad logga-bild, ingen textlogga
  },
  "logo": {
    "primaryUrl": "https://…supabase…/brand-assets/<clientId>/logo.png",   // på ljus botten
    "onDarkUrl":  "",          // valfri variant för mörk botten
    "iconUrl":    ""           // valfri symbol/favicon-variant (badge, vattenmärke)
  },
  "elements": {
    // Grafiska element mallarna FÅR använda. Av = elementet renderas aldrig för kunden.
    "brush":     { "enabled": true,  "color": "accent" },   // penseldrags-ruta (BrushBox)
    "shapes":    { "enabled": false, "style": "rounded" },  // rounded | sharp | organic
    "lines":     { "enabled": true,  "weight": "thin" },    // thin | bold
    "badge":     { "enabled": true,  "shape": "starburst" },// starburst | circle | tag
    "underline": { "enabled": false }                        // handritad understrykning under rubrik
  },
  "imageStyle": {
    // Styr AI-bildgen + stockfoto-sök + blogg-omslag för kunden.
    "mode": "photo",           // photo | illustration | mixed
    "prompt": "Verkliga människor i nordisk miljö, naturligt ljus, varm ton",
    "negative": "stockfoto-känsla, blå AI-ton, plastigt leende, text i bild",
    "people": true,            // får bilder innehålla människor?
    "colorGrade": "warm"       // warm | cool | neutral — vävs in i prompt
  },
  "footer": {
    // Generisk kit-fot (arketyperna). Opticurs footer.png-override finns kvar ovanpå.
    "show": true,
    "tagline": "Leg. optiker",
    "address": "Storgatan 44 · Högsby · Tel 0491-200 62",
    "ctaLabel": "Boka online via bokadirekt.se",
    "ctaUrl": "https://…",
    "qrUrl": ""                // valfri QR-bild (Storage)
  },
  "donts": [
    // Fritext vill-inte-ha — konsumeras av copy/bildgen/arketyp-val som hårda regler.
    "Aldrig emojis i grafik",
    "Ingen röd färg",
    "Inga barnbilder utan glasögon"
  ]
}
```

### 3.3 Assets — Storage-bucket `brand-assets` (public)

`<clientId>/logo.png`, `logo-dark.png`, `icon.png`, `qr.png`, `element-*.png`. Uppladdning via befintligt signerad-URL-mönster (`/api/studio/upload-url` generaliseras med `bucket`-param). Publika URL:er → render-routen kan läsa dem utan auth (samma krav som studio-images).

### 3.4 `StudioBrand` v2 (interface) + adapter

`StudioBrand.colors` byter till roll-nycklarna ovan. **Adapter i `loadBrand`** översätter Opticurs gamla brand.json: `greenDark→primary`, `greenDeep→primaryDeep`, `greenLight→primaryLight`, `yellow→accent`, `mint→support`, `black→ink`, `white→paper`. De två Opticur-mallarna uppdateras till roll-tokens i samma etapp (ren find/replace, ingen visuell ändring — verifieras pixel-mot-pixel via export-CLI före/efter).

---

## 4. De fem arketyperna (`components/studio/archetypes/`)

Gemensamt: deterministisk layout, payload-kontraktet oförändrat, auto-kontrast via `isLightColor` på ALLA roll-ytor, fot = generisk `KitFooter` (logga + adress + CTA + ev. QR ur kitet; `footer.png`-override har företräde). Element renderas ENDAST om `elements.X.enabled`. Alla format: 1080×1350 + 1080×1080.

| # | ID | Namn | Layout & kit-användning | Bäst för |
|---|---|---|---|---|
| 1 | `ark-foto-ruta` | Foto + textruta | Fullbleed-foto, textruta över nederkant: `brush` på → BrushBox i `elements.brush.color`; av → ren rundad ruta i `accent`/`primary`. Badge om `elements.badge` | Generalisering av dagens Opticur-mall — vardagsinlägg med foto |
| 2 | `ark-statement` | Statement | Typografidrivet: jätterubrik i `headline`-font på `primary`- eller `paper`-yta, `underline`-element om på, liten logga. Inget foto krävs | Åsikter, hooks, konträra påståenden — LinkedIn-känsla |
| 3 | `ark-citat` | Citat/kundröst | Stort citattecken (vektor), citat i `headline`-font, attribution i `body`, `support`-färgad bakgrundszon. Foto valfritt som liten cirkel | Social proof — drar ur `customer_quotes` i profilen |
| 4 | `ark-lista` | Lista/tips | Rubrik + 3 numrerade/checkade rader (payload.body radsplittas "·" eller "\n"), `lines`-element som avdelare | Repurposing-motorns naturliga mål — "3 saker att tänka på" |
| 5 | `ark-erbjudande` | Erbjudande/CTA | Foto- eller färgyta + stor badge (`elements.badge.shape`) med pris/erbjudande + tydlig CTA-remsa i `accent` | Kampanjer, pris, "boka nu" |

`templates-meta.ts` utökas: `{ archetype: true, requiredElements?: [], clientSlug?: string }`. Studio-UI:ns mallväljare visar **arketyperna för alla + kund-exklusiva mallar** (Opticurs 2 visas bara när aktiv klient = opticur). Repurposing-motorn väljer arketyp per inlägg (statement för konträr hook, lista för tips, citat när kundcitat finns) i stället för hårdkodad Opticur-mall.

**Kvalitetsgrind per arketyp:** exporteras via CLI för 3 olika kit (Displayteknik blå, CF, HM Motor) + Opticur-adapter → visuell inspektion av alla 4 innan arketypen godkänns. Kontrastregel: text får aldrig hamna under WCAG-ish läsbarhet — `isLightColor` styr ink/paper-val per yta.

---

## 5. UI — flik "Grafisk profil" i Brand-profil

`app/dashboard/profil/page.tsx` har idag sektionsankare (`sec-berattelse`, `sec-ton` …). Grafisk profil läggs som **egen flik** ovanför sektionerna (profil-sidan är 700+ rader → ny komponent `components/BrandKitEditor.tsx`, lazy-laddad).

Sektioner i fliken (samma ordning som kit-schemat):
1. **Logotyp** — dra-och-släpp (primär/mörk/ikon), förhandsvisning på ljus+mörk yta.
2. **Färger** — roll-väljare med color-picker + "hämta från primärfärg"-knapp (deriverar Deep/Light via `shade()` som startförslag). Förbjudna färger som chips.
3. **Typsnitt** — dropdown per roll ur font-biblioteket, live-exempel ("Aa Rubrik / brödtext").
4. **Grafiska element** — toggles med mini-preview per element (pensel, former, linjer, badge, understrykning).
5. **Bildstil** — mode, stil-prompt, negativ-prompt, människor på/av, färgton.
6. **Fot** — texter + CTA + QR-uppladdning.
7. **Vill inte ha** — fritextlista (chips).
8. **Live-mallprov** — längst ner: alla 5 arketyper renderade i miniatyr (render-routen i iframes, samma teknik som biblioteket) med exempeltext → **ändra färg, se prägeln direkt**. Detta är fliken killer-feature och kvalitetskontrollen.

API: `/api/brand-kit` GET/PUT (admin-grindad, service-role). QualityMeter i profilen får ny dimension "Grafisk profil" (completeness: logga + färger + bildstil satta).

---

## 6. v2 — Auto-setup-agenten ("Skapa grafisk profil från kundens webb")

Knapp i fliken: **"Hämta från webbplatsen"** (kräver `clients.public_url`).

Pipeline (server, `/api/brand-kit/agent`):
1. **Hämta sajten** (server-fetch av startsida + ev. /om-oss). GHL-sajter är client-side-renderade → hämta ren HTML OCH rendera via lokal Playwright när tillgängligt; i molnet: HTML-parsning räcker för steg 2–3, screenshot-steget markeras "kör lokalt" (samma mönster som PNG-exporten). [[lesson: GHL client-side verify]]
2. **Logga:** leta `<link rel="icon">`-varianter, `og:image`, `<img>` med logo-heuristik (alt/src/klass innehåller "logo", toppläge i DOM). Ladda ned → föreslå som primärlogga (Håkan godkänner).
3. **Färger:** extrahera hex ur inline-CSS/style-taggar + färgfrekvens; komplettera med `clients.primary_color`. Kvantisera till 3–5 kandidater → mappa mot roller (mest förekommande mörka = primary, mest mättade avvikare = accent).
4. **Typsnitt:** läs `font-family`-deklarationer → närmaste match i vårt bibliotek (Poppins→Poppins, annars Inter).
5. **Bildstil + donts:** genereras ur `hm_brand_profile` (ton, målgrupp, dos/donts) via Gemini — TEXTFÖRSLAG, inga påhittade fakta.
6. **Förslaget sparas ALDRIG direkt** — det fyller fliken i "förslags-läge" (gul markering per fält) och Håkan godkänner/justerar → spara (`source: 'agent+manual'`).

Princip: **agenten föreslår bara det den faktiskt hittat** (URL:er till nedladdade assets, hex som förekommer på sajten). Osäkert fält lämnas tomt med notis — aldrig gissning. [[feedback_never_guess]]

---

## 7. Genomslag i övriga motorn (ripple, v1-scope)

| Konsument | Ändring |
|---|---|
| `suggest-image` (Studio-foto) | Stil- + negativ-prompt ur `imageStyle` vävs in i Pexels-sök och Nano Banana-prompt |
| Blogg-omslag (`makeCoverImage`) | Samma — omslag följer kundens bildstil, respekterar `people`/`negative` |
| Repurposing | Väljer arketyp per hook-typ (se §4) i stället för hårdkodad Opticur-mall |
| `generateStudioCopy`/captions | `donts`-listan läggs till som hårda regler i prompten |
| Bild-redigering (kommentar) | Negativ-prompt appendas ("ändra, men aldrig: …") |
| Studio-UI färgswatches | `BRUSH_SWATCHES` genereras ur kitets roller i stället för hårdkodad Opticur-palett |

---

## 8. Etapper med hårda stopp

**Etapp A — Fundament (roll-tokens + DB + loadBrand v2).**
Tabell + Storage-bucket, `StudioBrand` v2, adapter för Opticurs brand.json, Opticur-mallarna till roll-tokens. *Verifiering:* pixeljämförelse Opticur före/efter (export-CLI) — noll visuell diff. tsc. **STOPP.**

**Etapp B — Grafisk profil-fliken.**
`BrandKitEditor` + `/api/brand-kit` + uppladdning + QualityMeter-dimension. Utan live-mallprovet (arketyperna finns inte än) — provet visar tills vidare färg/typsnitt-paletten. *Verifiering:* skapa kit för Displayteknik i UI:t, läs tillbaka, render-routen plockar upp det. **STOPP.**

**Etapp C — Arketyperna (5 st) + mallväljare + KitFooter.**
En arketyp i taget, kvalitetsgrind per arketyp (§4). Repurposing byter till arketyp-val. *Verifiering:* 5 arketyper × 3 kit exporterade + visuellt granskade av Håkan. **STOPP.**

**Etapp D — Genomslag (§7) + swatches ur kit.**
*Verifiering:* blogg-omslag + AI-bild för Displayteknik följer bildstilen; donts respekteras i copy. **STOPP.**

**Etapp E (v2) — Auto-setup-agenten.**
*Verifiering:* körd mot displayteknik.se + ledarskapskultur.se — loggor + färger korrekt föreslagna, inget påhittat. **STOPP.**

Ordningen är vald så att varje etapp ger användbart värde även om vi pausar efter den: A gör systemet redo, B ger dig redigerbar grafisk profil, C ger kunderna mallar, D ger rätt bilder överallt, E gör onboarding snabb.

---

## 9. Risker & motmedel

| Risk | Motmedel |
|---|---|
| Arketyper blir "generisk AI-stil" (kvalitetsstandard-brott) | Kvalitetsgrind per arketyp: Håkan godkänner varje arketyp mot 3 riktiga kit innan den släpps; element/typsnitt-variationen bär prägeln |
| Roll-migrationen förstör Opticurs pixel-perfekta mallar | Adapter + pixeljämförelse i Etapp A innan något annat byggs |
| Fonts-licens/rendering | Endast självhostade OFL-typsnitt i `public/fonts/` (finns redan: Inter, Archivo, Poppins, Anton, Playfair) |
| Agent-extraktion ger fel färger (gradienter, foton) | Förslags-läge med mänskligt godkännande — aldrig autospar |
| Kit-schema växer okontrollerat | `version`-fält + normaliserare med defaults (samma mönster som `normalizePayload`) |
| GHL-sajter client-side → agenten ser tom HTML | Playwright-läge lokalt; HTML-läge klarar ikoner/og-taggar som ligger i head |

---

## 10. Öppna frågor till Håkan (defaults om du inte vet)

1. **Font-biblioteket:** räcker de 5 självhostade (Inter, Archivo, Poppins, Anton, Playfair) som start, fler läggs till på begäran? *Default: ja.*
2. **Live-mallprovet i fliken** (8 iframes-miniatyrer) kan göra fliken tung på svag uppkoppling — OK, eller bakom "Visa mallprov"-knapp? *Default: bakom knapp.*
3. **HM Motor:** ska HM Motor få kit + arketyper i Etapp C-verifieringen (tredje testkund), eller räcker Displayteknik + CF? *Default: alla tre — bredare test.*
