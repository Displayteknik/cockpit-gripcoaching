# PROFIL-1 — resultat

Byggt 2026-08-01 på beslutet i `PROFIL-RAPPORT.md` (K1–K8, viktning, nivåuppsättning A, förankringsflaggan kapar nivån och varnar). Allt nedan är mätt, inget uppskattat. Läsningarna mot skarp databas är read-only; inga rader har skrivits.

## TL;DR

1. **De fyra döda profilfälten når prompten nu.** Displaytekniks riktiga priser (och differentiering, tjänster, CTA-väg) fanns i formuläret men aldrig i en text. Klipptaket höjdes 9000 → 11000 så att de får plats utan att kosta kundorden.
2. **Vinnande exempel var avstängda i praktiken.** Engens 14 godkända exempel nådde 0 av 10 syften. Nu når de 3 per körning i samtliga kategorier — utan en enda DB-skrivning.
3. **Procenttalet är borta.** Profilen bedöms mot nivå 1–5 som beskriver vad texterna faktiskt blir. Skräpprofilen som fick 100 % och "Klar att producera" får nu nivå 1.

---

## Före/efter — de fyra skarpa profilerna

Dagens procenttal är den gamla formeln (oviktat medelvärde av fem teckenlängdsdimensioner). Nivån är den nya, deterministiska beräkningen (`lib/profil/kvalitet.ts`, ingen AI). Omräkningen är körd med `scripts/profil1/omrakning.mts`.

| Profil | Idag | Ny nivå | Vad nivån betyder |
|---|---|---|---|
| Displayteknik | 89 % | **4 — Egen röst** | texterna går att känna igen |
| Engens Träd & Trädgård | 61 % | **3 — Grund** | texterna låter som branschen, inte som du |
| Annas Blommor | 55 % | **2 — Skiss** | texterna blir korrekta men utbytbara |
| HM Motor Krokom | 27 % | **1 — Tom** + förankringsflagga | texterna blir gissningar |

Utfallet ligger på rapportens egen prognos (DT 3–4, Engens 3, Annas 1–2, HM 1 + flagga).

### Displayteknik — nivå 4 (intern poäng 66)

Berättelser 2/3 · Kundens röst 3/5 · GÖR INTE 8/5 · Verifierade siffror 10/5 · Vinnande exempel 0/3 · Egen röst 3/5 · Grundfakta 4/4

1. Klistra in 2 riktiga kundcitat, ordagrant som kunden sa det
2. Markera 3 inlägg du är nöjd med som vinnande exempel
3. Lägg till 1 kundberättelse som innehåller en siffra, ett namn eller ett datum

Nivån är kapad från 5: högsta nivån kräver både tre berättelser och fem kundcitat.

### Engens Träd & Trädgård — nivå 3 (poäng 47)

Berättelser 1/3 · Kundens röst 0/5 · GÖR INTE 4/5 · Verifierade siffror 1/5 · Vinnande exempel 14/3 · Egen röst 14/5 · Grundfakta 3/4

1. Klistra in 5 riktiga kundcitat, ordagrant som kunden sa det
2. Lägg till 2 kundberättelser som innehåller en siffra, ett namn eller ett datum
3. Lägg in 4 siffror med enhet (pris, årtal, antal, mått) i profilen

Engens är den enda klienten med ett riktigt bibliotek vinnande exempel — och efter F2 är det värt något.

### Annas Blommor — nivå 2 (poäng 15)

Berättelser 0/3 · Kundens röst 0/5 · GÖR INTE 1/5 · Verifierade siffror 1/5 · Vinnande exempel 0/3 · Egen röst 0/5 · Grundfakta 4/4

1. Lägg till 3 kundberättelser som innehåller en siffra, ett namn eller ett datum
2. Klistra in 5 riktiga kundcitat, ordagrant som kunden sa det
3. Lägg in 4 siffror med enhet (pris, årtal, antal, mått) i profilen

55 % lät som halvvägs. Profilen är en skiss, och nivån säger det.

### HM Motor Krokom — nivå 1 + förankringsflagga (poäng 5)

Berättelser 0/3 · Kundens röst 0/5 · GÖR INTE 0/5 · Verifierade siffror 0/5 · Vinnande exempel 0/3 · Egen röst 1/5 · Grundfakta 3/4

Flaggans text i UI:t: *"Profilen nämner inte ett enda ord ur er verksamhet (bilhandel, motor, krokom) i det som beskriver vilka ni är. Kontrollera att texten handlar om rätt företag. 2 kundröster kommer från ett wizardsteg ([Vad världen behöver]), inte från en kund."*

1. Lägg till 3 kundberättelser som innehåller en siffra, ett namn eller ett datum
2. Klistra in 5 riktiga kundcitat, ordagrant som kunden sa det
3. Skriv 5 egna GÖR INTE-regler: ord och vändningar just du undviker

Flaggan kapar nivån till 2 och varnar. Den blockerar ingenting (v1-beslutet).

---

## F1 — de fyra döda fälten är inkopplade

**Sektionsordning i lager 3** (`lib/knowledge.ts`): `Differentiering` direkt efter USP (auktoritet hör ihop), och ett samlat erbjudandeblock efter kundresan: `Erbjudande: tjänster och produkter`, `Erbjudande: priser (verifierade siffror)`, `Erbjudande: CTA-väg (bokningslänk)`. Rubrikerna börjar med "Erbjudande:" så CTA-golvets formulering *"Innehåller varumärkesprofilen färdiga CTA-formuleringar (Erbjudande/CTA-sektion …)"* nu pekar på något som finns.

**Klippprioritet** (`KLIPPORDNING` i `lib/prompt-core.ts`): priser och CTA-väg står **inte** i listan alls — de överlever därmed alltid, precis som Tonregler, USP, GÖR och GÖR INTE. Motivet: verifierade priser är den enda källan till konkreta tal som SANNINGSKRAVET tillåter, och CTA-vägen är exakt det CTA-golvet hänvisar till. `Erbjudande: tjänster` och `Differentiering` klipps sent, efter allt allmänt material (kundresa, konkurrenter, brand story) men före de billiga grundfakta-raderna (att klippa 30 tecken sparar ingenting).

**Klipptaket 9000 → 11000.** Displaytekniks profil växer 9 396 → 13 086 tecken. Vid 9000 hade klippet gått ända ned i `Voice of Customer (kundord)` och `Brand story` — exakt de röstbärande sektionerna som v2-höjningen (6000 → 9000) infördes för att skydda. Vid 11000 klipps bara Kundresa och Konkurrenter (13 086 → 10 842). Taket är mätt mot plattformens största profil.

Verifierat med `scripts/profil1/f1-verifiera.mts` (read-only):

| Profil | Profil i lager 3 | Klipps | Nya fält når prompten |
|---|---|---|---|
| Displayteknik | 13 086 → 10 842 | Kundresa, Konkurrenter | alla fyra, priserna intakta (21 000 kr, 27 500 kr, 36 900 kr, 20 000 kr) |
| Engens Träd | 4 883 | inget | differentiering, tjänster, priser |
| HM Motor | 1 717 | inget | tjänster |
| Annas Blommor | 1 254 | inget | tjänster, CTA-väg |

## F2 — vinnande exempel når prompten

`fetchWinningExamples` filtrerade hårt på `client_assets.subcategory`. Samtliga winning_example-rader på plattformen har `subcategory = NULL`, så lager 5 levererade noll exempel i tio av tolv syften.

Vald lösning: **fallback i koden, ingen migrering och ingen DB-skrivning.** Rätt kanal väljs först, därefter oklassade rader (saknad subcategory = exemplet är inte bundet till någon kanal). En **annan** kanals exempel väljs aldrig — ett mejlexempel ska inte styra en Instagram-caption.

Mätt med `scripts/profil1/f2-verifiera.mts`:

| Kategori | Engens före | Engens efter |
|---|---|---|
| studio_copy, caption, carousel, linkedin, blog, newsletter, post, reel | 0 | **3** i var och en |

`byggTextPrompt(linkedin)` för Engens har nu lager 5 påslaget (var av).

## F5 — onboard-status

`select(... target_audience)` mot en kolumn som inte finns gav PostgREST-fel 42703, hela profilfrågan felade tyst och steget "Brand-profil" kunde aldrig bli grönt för någon klient. Steget bedöms nu av samma kvalitetsmodul som allt annat.

| Profil | Före | Efter |
|---|---|---|
| Displayteknik | aldrig grön | grön (nivå 4) |
| Engens Träd | aldrig grön | grön (nivå 3) |
| Annas Blommor | aldrig grön | inte klar — nivå 2, med närmaste åtgärd |
| HM Motor | aldrig grön | inte klar — förankringsvarningen visas |

## F-intake — rotorsaken bakom HM Motor

`intake/commit` skrev över identitetsfälten rakt av. Nu gäller: en skrivning som **ersätter** ett ifyllt identitetsfält (`usp`, `icp_primary`, `icp_secondary`, `services`, `differentiators`, `brand_story`, `tagline`) kräver ett uttryckligt beslut.

- Utan beslut skrivs **ingenting** — routen svarar med en diff (nuvarande värde vs föreslaget) och lämnar sessionen orörd.
- Två vägar vidare i UI:t, där commit-knappen redan finns: *Behåll nuvarande, spara resten* eller *Skriv över med det föreslagna*. Beslutet loggas i `client_activity`.
- Tomt → ifyllt skrivs direkt (ingen förlust). Tillägg rör aldrig befintlig text.

Regeln ligger i `lib/intake/identitet.ts` som ren funktion och testas med det skarpa HM Motor-fallet.

## F-mätare — en mätare, en definition

`lib/profil/kvalitet.ts` (beräkning, ren) + `lib/profil/las.ts` (läsning). **Ingen AI i beräkningen.**

| Kriterium | Vikt | Minimikrav | Vad som räknas |
|---|---|---|---|
| Berättelser | 25 | 3 | ≥ 200 tecken och en siffra med enhet, ett egennamn eller ett tidsuttryck — och inte generisk |
| Kundens röst | 20 | 5 citat i ≥ 2 kategorier | citatform, inte wizardetikett i `context` |
| GÖR INTE | 15 | 5 rader, 3 klientspecifika | rader ≥ 15 tecken som inte bara upprepar plattformens floskellista |
| Verifierade siffror | 15 | 5 | distinkta siffror med enhet i fält som **når** prompten |
| Vinnande exempel | 10 | 3 | ≥ 200 tecken |
| Egen röst | 10 | — | tonregler + distinkta egna inlägg + fingerprintkällor |
| Grundfakta | 5 | 4 | företagsnamn, plats, tjänster, giltig bokningslänk |

Utöver poängen:

- **Generisk-detektorn diskvalificerar**: ett fält räknas inte om minst hälften av meningarna är tomfraser (startlistan ur rapportens skräpsimulering) eller dubbletter.
- **Dubblettkontroll**: fem identiska inlägg räknas som ett (jaccard ≥ 0,6).
- **Tungviktarregeln**: noll berättelser → högst nivå 3, oavsett hur mycket annat som är ifyllt. Färre än 3 berättelser eller 5 kundcitat → högst nivå 4.
- **Förankringsflaggan**: identitetsfälten jämförs mot ett ankare som intake-flödet aldrig skriver (bransch, företagsnamn, plats, hashtags, GÖR/GÖR INTE). Ingen gemensam ordstam alls → flagga, varning och tak på nivå 2. Ingen blockering.

**Nivån ersätter procenttalet.** Procenttalet finns kvar internt som `poang` men returneras aldrig till UI:t.

**Vägledningen**: de tre åtgärder som just nu ger störst viktförlust, i imperativ ("Lägg till 2 kundberättelser som innehåller en siffra …"), uppdaterade vid varje beräkning.

**Mjuk grind** (`components/profile/ProfilGrind.tsx`): en diskret rad i genereringsvyerna — *"Texterna blir märkbart bättre med mer underlag i profilen"* plus närmaste åtgärd och länk. Visas under nivå 5, blockerar ingenting.

### De fyra konkurrerande definitionerna är nu en

| Plats | Före | Efter |
|---|---|---|
| `/api/profile/quality` | fem teckenlängdsdimensioner | `lib/profil/kvalitet.ts` |
| `/k/page.tsx` | egen 5-fältsräkning (>10 tecken) | samma modul via `profilKvalitet()` |
| `/api/setup/onboard-status` | egen kontroll mot en kolumn som inte fanns | samma modul (`brandProfilKlar`) |
| `SkapaInlaggMaker` | hämtade rapporten och slängde den | mjuka grinden använder den |

`KnowledgeBank`s `minRecommended` är kvar som uppladdningsmål per flik (5 inlägg, 3 vittnesmål …). Det är vägledning i inmatningen, inte en femte bedömning.

---

## Skräpsimuleringen (rapportens 0.2) — före/efter

Samma 593 tecken tomfraser, samma sex uppladdningar:

| | Före | Efter |
|---|---|---|
| Utfall | **100 %** och "Klar att producera" | **nivå 1 (Tom)** — intern poäng under 35, klar att producera: nej |

De fem identiska inläggen räknas som ett, tomfraserna diskvalificeras och noll berättelser kapar taket.

## DoD

- `npx tsc --noEmit` rent
- `npm test`: **137 gröna** (var 103 vid start; 34 nya: F1-klippning, F2-urval, F-intake-diff, kvalitetskriterierna)
- `npm run build` rent
- Verifieringsskript (read-only, inga DB-skrivningar): `scripts/profil1/f1-verifiera.mts`, `f2-verifiera.mts`, `omrakning.mts`

## Kvar / medvetet utanför

- WIZARD-1/2/3 är fortsatt parkerade.
- Ingen redigeringsyta för story-bank och Customer Voice — kunden kan alltså se åtgärden "Lägg till kundberättelser" men måste fortfarande gå via intake-flödet. Det är den enskilt största kvarvarande luckan efter det här bygget.
- Ingen UI-yta sätter `client_assets.subcategory`. F2 gör att det inte längre spelar någon roll för om exemplen används, bara för hur de kanalstyrs.
- `hashtags_base` sparas ibland som Postgres-arraylitteral (Engens) och går in i prompten med klammer.
