# BILD-8 — skarpt bevis för stavningsgrinden (8a) och blickriktningsregeln (8b)

Koden låg i repot sedan `77b8564` men hade aldrig körts skarpt — bara statiskt verifierats.
Den här mappen är körningen. Tjugo genereringar genom Bildhjälpens riktiga route
(`app/api/studio/suggest-image`), tio per del, fördelade på två tenants med olika bransch
och olika grafisk profil: **Displayteknik** `a6a33547-…` (digital signage) och
**Annas Blommor** `7461fa8b-…` (florist).

```
npx tsx --tsconfig scripts/text1/tsconfig.json scripts/studio/bild8-exempel.mts
BILD8_DEL=a  ...   (bara stavningsdelen)
BILD8_FALL=a3,b7   (kör om enskilda fall)
```

Skriptet skickar `diagnostik: true`, vilket får routen att returnera grindens avläsningar
i klartext. Det är ren observabilitet — grinden beter sig exakt likadant utan flaggan
(avläsningarna hämtas genom den `kontrollera`-seam som redan fanns för test).

Rådata: `korning.log` (varje avläsning, framlänges och baklänges, samt modellens råsvar)
och `resultat.json`. Testbilderna raderades ur `studio-images` efter körningen —
**20/20 objekt borttagna**, kundernas mediabibliotek orört
(`feedback_live_client_no_disruption`).

---

## Del A — stavningsgrinden

Fem ämnen per tenant som medvetet lockar fram avbildad text: skyltfönster med erbjudande,
menyskärm, affisch i butik, skylt vid entré, prislapp.

| # | Tenant | Grindens dom | Omtag | Avläst i slutbilden | Vad bilden FAKTISKT säger (min avläsning) |
|---|--------|--------------|-------|---------------------|-------------------------------------------|
| a1 | DT | felstavning → tom skylt | 2 | `SJÖSTADEN BRYGGARI` | skärm utan läsbara ord (tomma vita rutor + produktbilder) — ✅ inget felstavat |
| a2 | DT | godkänd | 1 | `DAGENS LUNCH 129 KR` | **DAGENS LUNSCH 129 KR** — ❌ **grinden läste fel, felstavning nådde ut** |
| a3 | DT | godkänd | 1 | `NYA ANKOMSTER SOMMAR REA KLÄDER` | NYA ANKOMSTER SOMMAR + REA KLÄDER — ✅ rätt |
| a4 | DT | godkänd | 2 | `ÖPPET IDAG 9-18` | ÖPPET IDAG 9-18 — ✅ rätt (`IDAG`, inte BILD-7:s `IDÅG`) |
| a5 | DT | godkänd | 0 | `REA 50%` | REA 50% — ✅ rätt |
| a6 | AB | godkänd | 0 | `HELGENS BUKETT 299 KR` | HELGENS BUKETT 299 KR — ✅ rätt |
| a7 | AB | godkänd | 0 | `DAGENS SNITTBLOMMOR 35 KR. ST` | DAGENS SNITTBLOMMOR 35 KR. ST — ✅ rätt |
| a8 | AB | felstavning → tom skylt | 2 | – | affisch utan text — ✅ inget felstavat (se nedan, detta är fallet som avslöjade allt) |
| a9 | AB | godkänd | 0 | `ÖPPET IDAG 10-18` | ÖPPET IDAG 10-18 — ✅ rätt |
| a10 | AB | felstavning → tom skylt | 2 | – | blank prislapp, oläsligt klotter på griffeltavlan — ✅ inget felstavat |

**Utfall Del A: 9 av 10 uppfyller kravet** (rätt stavat eller blankt). **a2 gör det inte.**

## Del B — blickriktningen

Fem ämnen per tenant där en person syns tillsammans med produkten/skärmen/skylten.
Bedömningen är min egen avläsning av bilden — blickriktning går inte att mäta i kod.

| # | Tenant | Motiv | Blickriktning |
|---|--------|-------|---------------|
| b1 | DT | butikspersonal vid skärmen | ✅ vänd mot och tittar upp på skärmen |
| b2 | DT | gäst vid menyskärmen | ✅ hela kroppen vänd mot skärmen, blicken på den |
| b3 | DT | receptionist visar besökaren | ✅ vänd mot skärmen och pekar på den |
| b4 | DT | butiksägare vid skyltfönsterskärmen | ✅ vänd mot skärmen (som dock blev tom, se kvarlevor) |
| b5 | DT | kund vid digital skylt i galleria | ✅ vänd mot skylten (tom skärm) |
| b6 | AB | florist binder bukett | ✅ blicken i buketten hon arbetar med |
| b7 | AB | kund väljer blommor i kylen | ✅ lutar sig in mot blommorna, blicken i dem |
| b8 | AB | florist visar kunden veckans bukett | ✅ båda vända mot buketten mellan dem |
| b9 | AB | kund läser skylten utanför butiken | ❌ **hon håller buketten och tittar bort, uppåt — skylten läses inte** |
| b10 | AB | medarbetare ordnar skyltfönstret | ✅ blicken i buketten |

**Utfall Del B: 9 av 10.** Regeln håller när personen och saken är i samma
handling. Den brister i **b9**, där ämnet var *"kunden läser skylten"* men modellen gav en
porträttpose framför butiksskylten — personen är vänd mot kameran, inte mot skylten.
Blicken hamnar där handlingen är, inte där ämnet pekar.

---

## Vad körningen avslöjade — och vad som fixades

Grinden var **inte** klar. Tre fel hittades, alla med skarpt bevis i loggarna.

### 1. Ordlistan fällde rättstavade ord (fall a1, första körningen)

`FÅ` i *"KÖP 2 FÅ 1"* dömdes som felstavning: ordet saknas i skyltvokabulären och ligger
ett teckens avstånd från `får` → närmiss → underkänt. Korta svenska ord ligger tätt i
redigeringsavstånd, så ordlistan kan aldrig ensam veta att ett ord den saknar är felstavat.

**Fix:** närmiss är numera en **misstanke**, inte en dom. Bara STRUKTURfel (glyfer utanför
svenskan, bokstavsgröt) fälls utan att någon tillfrågas; närmissar och okända ord skickas
till textmodellen. Svarar den inte alls står misstanken kvar — fail-closed på misstanken,
fail-open på det helt okända.

### 2. Transkriptionen tolkades som en bokstav per ord (fall a1/a3, första körningen)

Modellen använder ibland `|` mellan **varje tecken** i stället för mellan orden:
`N | Y | H | E | T | ! / E | N | D | A | S | T | | 8 …`. Parsern läste då varje BOKSTAV
som ett ord, och enstaka bokstäver ligger ett steg från riktiga ord → 13 påstådda
felstavningar på en helt korrekt skylt, och ett bränt omtag.

**Fix:** rollen för `|` avgörs per rad. Är de flesta segmenten ett tecken långa är `|` en
teckenavgränsare och ordgränsen ligger i den tomma luckan (`| |`).

### 3. ⚠ Den stora: vision AUTOKORRIGERAR även teckenvis (fall a8)

Affischen sa **`HÖSTENS NYHIETER`**. Grinden läste `NYHETER` och godkände bilden — den
publicerade alltså en felstavning. Bevis sparat: `kor1-en-lasriktning/a8-zoom-NYHIETER.png`.

Riktat prov (`bild8-prov.log`, samma bild, temperatur 0):

| Läsning | 1 | 2 | 3 | 4 |
|---------|---|---|---|---|
| framlänges | NYHETER | NYHETER | NYHETER | NYHETER |
| baklänges | NYHIETER | NYHIETER | NYHIETER | NYHIETER |

Att läsa om hjälper alltså inte — felet är systematiskt. Att läsa **baklänges** bryter
språkpriorn: modellen kan inte "rätta" ett ord den läser sista bokstaven först.

**Fix:** grinden läser nu bilden i **båda riktningarna parallellt** och dömer båda
resultaten. Riktningarna fångar olika fel — i omkörningen av a8 var det tvärtom
*framlänges* som såg `NYHIETER` medan *baklänges* städade det. Unionen fångade det, och
a8 slutade som tom skylt i stället för felstavad.

Baklängesläsningen kastar om ordföljden och hittar ibland på en extra bokstav
(`bild8-prov2.log`, a4: `IDAG` → `IDAGI`). Den ersätter därför inte framlängesläsningen
utan **läggs till**: ordföljd spelar ingen roll för en stavningsdom, och en falsk
misstanke kostar ett omtag medan ett missat fel når kunden.

---

## Ärliga kvarlevor

**1. Grinden kan inte garantera rätt stavning. Den minskar felen — den tar inte bort dem.**
Två felstavningar tog sig igenom den färdiga grinden i den här körningen:

- **a2** — skärmen säger `DAGENS LUNSCH 129 KR`. Båda läsriktningarna svarade `LUNCH`.
  Zoom: `a2-zoom-LUNSCH.png`.
- **b6** — griffeltavlan säger `SOMMARÖPPET TITLL 20.00`. Båda läsriktningarna svarade
  `TILL`. Zoom: `b6-zoom-TITLL.png`.

Det är **2 av 20 bilder** som bär en felstavning som grinden inte såg. Slutsatsen är
skarpare än BILD-7:s: stavningen går inte att garantera på promptnivå **och inte heller
med en vision-grind**. Enda vägen med garanti är fältet **"Text i bilden"** (B3), som
sätter texten programmatiskt. Säg det rakt ut till användaren i stället för att antyda att
avbildad text är säkrad.

**2. Priset för grinden är tomma skyltar — precis det BILD-7a byggdes för att få bort.**
**Sex av tjugo** bilder (a1, a8, a10, b4, b5, b7) slutade i sista utvägen
"tom skylt". Resultatet är en vit skärm (b4, b5) eller tomma etikettrutor (a1) i en bild
vars hela poäng var att skylten säger något. Kravet *"rätt stavat eller blankt"* är
uppfyllt, men blankt är ett sämre inlägg. Balansen mellan hur hårt grinden slår och hur
ofta skylten töms är inte inställd mot verklig användning — den är satt till max 2 omtag
och en tidsbudget på 46 s.

**3. Grinden dömer också bakgrundsklotter den inte borde bry sig om.**
I a1 fälldes uppfunna butiksnamn på fasader i bakgrunden (`BRYGGARI`, `DELBRAUCH`,
`SLOGEUM`) — text som varken är läsbar i sammanhanget eller en del av budskapet. De två
läsriktningarna var helt oense om vad som stod där, vilket är signalen att texten är för
liten för att bedöma. Grinden använder inte den signalen i dag.

**4. Blickriktningen styrs av handlingen i ämnet, inte av regeln ensam.**
b9 visar mönstret: när ämnet innehåller ett objekt personen ska rikta sig mot (*"läser
skylten"*) men motivet lockar till porträtt, vinner porträttet. Regeln är formulerad i
`PERSON_ATTENTION_EN/SV` och når både `visualScene` och bildprompten — den räckte i 9 av
10 fall, men den är ett önskemål till modellen, inte en grind. Det finns ingen
efterkontroll som mäter blickriktningen (motsvarande `motivPassar`).

**5. BILD-8b når inte reels.** `app/api/studio/reels/media/route.ts` importerar
`PERSON_ATTENTION_EN` men väver aldrig in den i prompten (dead import sedan `77b8564`,
syns som eslint-varning). Reels-vägen saknar alltså blickriktningsregeln helt. Inte
åtgärdat här — DoD:en gäller Bildhjälpen, och reels har en egen textpolicy.

**6. Säsongsmarkören lever kvar.** `KRÄFTSKIVA 8 AUGUSTI` dök upp igen i a6 (första
körningen) och b6 — samma motiv som BILD-7b sattes in för att variera bort. Rotationen i
`sasongsUttryck` gäller bildprompten; den styr inte vad modellen ritar på en griffeltavla
i bakgrunden.
