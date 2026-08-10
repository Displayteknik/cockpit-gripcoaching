# Nästa session — startprompt och läge

**Skriven 2026-08-10.** Commit `2dee6ac`, allt pushat, live svarar 200.
956 tester gröna, `tsc --noEmit` rent på HEAD (verifierat i ren worktree).

---

## KLISTRA IN DET HÄR FÖR ATT STARTA

```
# Cockpit — fortsätt granskningen

Repo: C:\Users\hakan\OneDrive\Dokument\Antigravity\hmmotor-next
Next.js 16 + Supabase + Gemini/Anthropic. Live: cockpit.gripcoaching.se (deploy vid push till master).

Läs först, i den ordningen:
1. docs/NASTA-SESSION.md  — det här dokumentet, hela läget
2. docs/STATUS.md         — totalinventeringen. En beställning utan rad där existerar inte

Utgångsläge: commit 2dee6ac, allt pushat. 956 tester gröna, tsc rent.

TVÅ STÅENDE REGLER

1. Tempomandat. Kör punkterna nedan i följd utan att invänta mig. Rapportera efter
   varje och uppdatera docs/STATUS.md. Stanna BARA om (a) något kundsynligt ändras
   som jag inte redan beslutat, (b) du hittar ett fynd i klass med karusellen (koden
   påstår något den inte gjort), (c) ett vägval saknar ett rimligt "om du inte vet"-
   default. Allt som kräver mina ögon samlas i en punktlista, inte ett i taget.

2. På vanlig svenska. Varje rapport avslutas med max fem rader utan systemord. Testet:
   en kund utan teknisk bakgrund ska förstå vad som blev bättre för henne.

ALDRIG GISSA. En 200 från servern bevisar inte att din kod gått ut. Kan du inte
verifiera något — säg det, gissa aldrig. Titta på den riktiga sidan när frågan gäller
vad jag ser (mcp claude-in-chrome når min inloggade webbläsare).

KÖR DESSA, I ORDNING — se docs/NASTA-SESSION.md för detaljerna:
1. UTKAST-2: klientbytet tömmer bara Studio. Fyra ytor kvar.
2. Fortsätt min verifiering — jag rapporterar fynd löpande i chatten.
3. De elva "klart men obevisat" i STATUS som jag inte kan testa själv.
```

---

## 1. FÖRSTA PUNKTEN: UTKAST-2 (halvfärdig, min prioritet)

**Fyndet 10/8, i skarp drift:** jag stod på AluCon men såg tre textförslag om skyltar
och solljus — Displaytekniks innehåll. Kontrollerat i databasen: AluCons egen profil
säger *"Personliga relationer, flexibilitet och hög kvalitet"* och tjänstefältet är tomt.
Ingenting om skyltar.

**Orsaken:** `lib/studio/useUtkast.ts` läste den nya klientens utkast och returnerade
direkt när det saknades — utan att tömma ytan. Förra klientens texter stod kvar under
den nya klientens namn.

Ingen data läcker mellan konton (allt är byråvyn). Risken är att jag publicerar fel
kunds text i rätt kunds kanal.

**Gjort:** haken tar en `nollstall`-callback som körs vid BYTE men aldrig vid första
laddningen. **Bara Studio är inkopplad.**

**Kvar:** samma inkoppling i fyra ytor. Var och en behöver sin egen tömningsfunktion:

| Yta | Fil | Rad (10/8) |
|---|---|---|
| Nyhetsbrev | `components/NewsletterMaker.tsx` | ~80 |
| Reels | `app/dashboard/studio/reels/page.tsx` | ~116 |
| Veckoplan | `app/dashboard/(inlagg)/veckoplan/page.tsx` | ~195 |
| Blogg | `app/dashboard/studio/blogg/page.tsx` | ~249 |

Mönstret finns i `components/StudioMaker.tsx` (`tomYtan`). Testmönstret finns i
`tests/utkast-livscykel.test.ts` — två tester som låser att bytet tömmer och att första
laddningen aldrig gör det.

---

## 2. VAD SOM BLEV GJORT 9–10 AUGUSTI

| Etapp | Vad som var trasigt |
|---|---|
| **G-3d** rotationen | Prompten sa "upprepa inte" utan att veta vad som använts. Nådde 4 av 21 ställen, nu 14 |
| **G-4** bevis-motorn | Huvudkällan fanns inte som fält. Mätaren räknade 20 av 51 priser som "bevis" |
| **G-5** CTA-motorn | En parentes gjorde uppmaningens typ valfri. "Hör av dig gärna" passerade |
| **G-6** bildfeedback | Tummen skrev rader ingen läste. Alla tre sparade rader saknade kund-id |
| **G-9** kvalitetssidan | Fanns inte. Nu `/dashboard/kvalitet`, med noll som aldrig får se ut som ett mätvärde |

Plus fyra fynd ur min egen verifiering samma kväll: karusellens punktnummer, insats/bevis
märkta "Punkt", platshållaren som lärde ut rabatt, och klientbytet ovan.

Promptversionen gick `v1-32a4ec3d` → `v1-3b3ea753`.

---

## 3. VERIFIERINGEN JAG HÅLLER PÅ MED

Google-dokument med 23 steg:
https://docs.google.com/document/d/1Rv3aa-tyW1WbuiCNrp6QcvGbSdW2_fkuS-IGTiaUn5A/edit

Steg 1–15 = det nya. Steg 16–23 = äldre saker som aldrig kontrollerats
(karusellexport, GHL med flera bilder, schemaläggning, DM-svar, bildredigering).

**Klart när sessionen bröts:** steg 1 och 4. Fynden ovan kom ur steg 5–7.

---

## 4. FEM PUNKTER JAG INTE KAN TESTA SJÄLV

De kräver databas eller curl:

- Anon-skrivningen (3 filer, bara `storage.uploadToSignedUrl` — men policyerna är
  aldrig bevisade dragna live)
- `/k/credits` med riktig inloggad kund (modulen är av för alla)
- PLAN-1 + START-1
- KONTAKT-1 tystnadsmätaren
- OFFERT-2 O-1 produktdatabasen

---

## 5. GRANSK-SERIEN

**Klart:** G-0 till G-6 och G-9.

**Kvar, och båda kräver mig:**
- **G-7 blindtestet** — 10 texter per profil, nivå 1–3, ribba 7/10. Min bedömning, inte
  AI:ns. Beställd 31 juli. En rigg kan byggas: generera, avidentifiera, lägg fram ett
  bedömningsark.
- **G-8 mätloopen** — tre brott samtidigt (scopet saknas, kopplingen skrivs aldrig, fel
  tabell). Kodfixarna går att bygga; själva Instagram-omkopplingen är kundkontakt.

---

## 6. KONVENTIONER SOM GÄLLER

- **Migrationer:** `node scripts/kor-migration.mjs migrations/<fil>.sql --ja`
  (torrkörning utan `--ja`). PAT i `../.shared-keys.env`.
- **Bevis före påstående.** Varje etapp får ett `scripts/<etapp>-dod.mts` som kör skarpt
  och läser resultatet ur databasen. Skriptet ska vara `.mts`, inte `.mjs` — en `.mjs`
  kan inte importera produktionskoden och rapporterar då grönt utan att ha mätt.
  DoD-skript får aldrig lämna kvar rader i ett kundkonto.
- **Promptversionen är låst i test.** Ändrar du en regel i `lib/prompt-core` faller
  `tests/g1-generationslogg.test.ts`. Det är avsikten.
- **`git add` med namngivna filer, aldrig `-A`** — och kontrollera `git status` FÖRE
  staging: en fil kan redan bära någon annans ostagade arbete.
- **Verifiera HEAD i en ren worktree före push** (`git worktree add <dir> HEAD --detach`
  + `tsc --noEmit`). Arbetsträdets bygge svarar på fel fråga.
- **Fråga före push.**
- Allt textflöde genom `lib/prompt-core`, allt betalt genom `lib/ai-usage`, alla
  genereringar genom `lib/generationslogg`. Inga fabricerade siffror.
