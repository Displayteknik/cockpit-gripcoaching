# LESSONS — Cockpit

Dyrköpta lärdomar. Varje post: vad som hände, vad det kostade, och regeln som följer.
Nyast överst. Regler här är plattformsregler — de gäller varje tenant och varje flöde.

---

## 2026-08-02 — En grind som inte kan garantera något ska säga det till användaren

**Vad som hände.** Stavningsgrinden för avbildad text (BILD-8a) byggdes i två lager:
prompten ber om rätt stavning, och en vision-grind läser av bilden och begär omtag.
Den skarpa DoD-körningen (20 genereringar, två tenants,
`docs/studio/bild8-exempel/`) gav 9 av 10 rätt — men **2 av 20 felstavningar tog sig
igenom hela kedjan**: skärmen sa `DAGENS LUNSCH`, griffeltavlan sa `SOMMARÖPPET TITLL`,
och båda läsriktningarna svarade det rättstavade ordet. Autokorrigeringen finns kvar
även när man läser baklänges.

**Vad det kostade.** Två publicerbara bilder med felstavning som såg verifierade ut, och
sex av tjugo bilder som tömdes på skyltext av sista utvägen — precis den tomma skylt
BILD-7a byggdes för att få bort.

**Regel.** En sannolikhetsgrind (modell dömer modell) minskar fel, den tar inte bort dem.
Där en garanti finns i ett annat lager ska den vägen **rekommenderas i UI:t med
klarspråk**, och grindens skydd får aldrig beskrivas som säkert. För avbildad text är
garantin fältet "Text i bilden" (B3), som sätter texten programmatiskt.

**Följdregel.** Mät alltid grindens PRIS, inte bara dess träffar. En grind vars sista
utväg gör resultatet sämre än problemet den löser är felinställd: sista utvägen ska vara
ett *textlöst motiv* (ingen textbärande yta i bild), aldrig en tom skylt.

**Följdregel 2.** När två oberoende avläsningar är oense om ett ord är det en signal om
avläsningens kvalitet, inte om stavningen. Signalen får bara frikänna text som ligger
UTANFÖR motivet: oenighet om huvudskylten är precis det fel grinden finns för.

---

## 2026-08-01 — Ett fel som döljer sin egen orsak kostar mer än felet självt

**Vad som hände.** Röstinmatningen ("Prata in") slutade fungera. Användaren fick
"Kunde inte uppfatta rösten, försök igen" och drog den rimliga slutsatsen att funktionen
var trasig. Vi letade i koden: mimetyp, ljudformat, transkriptionsgrind. Inget av det
var fel. Det verkliga svaret kom först när ett direktanrop mot Gemini kördes:

```
HTTP 403 — "Lightning dunning decision is deny for project: projects/773740289261"
```

Googles projekt var **betalningsspärrat**. Hela Gemini-API:t låg nere: captions,
bildgenerering, bildläsning, blogg, nyhetsbrev. Allt som gick via Anthropic
(Studio-textförslag, specialister) fortsatte fungera — och den asymmetrin var
ledtråden ingen läste, eftersom ingen kunde se felkoden.

**Varför vi inte såg det.** `app/api/ai/transcribe/route.ts` loggade bara statuskoden:

```ts
console.error(`[transcribe] Gemini svarade ${res.status}`);   // ← kroppen kastades
```

Svarskroppen innehöll hela förklaringen. Den kastades bort, och användaren fick ett
meddelande som pekade på fel orsak.

**Kostnad.** En session spenderad på en påhittad bugg. Två agenter startade för att
laga kod som inte var trasig. Och en användare som med rätta tappade förtroendet för
en funktion som fungerade.

### REGEL (permanent, gäller alla externa anrop)

1. **Logga alltid svarskroppen vid fel**, aldrig bara statuskoden. Kroppen är där
   orsaken står. Trunkera om den är lång — kasta den aldrig.
2. **Skilj tjänstefel från tomma resultat i det användaren ser.** 401/403/429 och
   nertid är inget användaren kan tala sig ur: *"Tjänsten svarar inte just nu. Försök
   igen om en stund."* Ett tomt resultat är något annat: *"Kunde inte uppfatta rösten."*
   Samma text för båda skickar folk att felsöka fel sak.
3. **Tyst retur är förbjuden.** `if (blob.size < 1200) return;` gav "det händer bara
   inget". Säg vad som gick fel: *"Inspelningen blev för kort."*
4. **Slutar flera AI-funktioner fungera samtidigt — misstänk betalning eller kvot
   före kod.** Testa nyckeln med ett minimalt anrop innan en rad ändras.

Implementerat i `6bf3143`. Grindfunktionerna finns i `lib/ai/transkription.ts`
(`ROST_FELMEDDELANDE`, `ROST_FOR_KORT`, `ROST_TJANSTEFEL`).

---

## 2026-08-01 — Promptregeln är första försvaret, aldrig enda försvaret

**Mönstret upprepade sig tre gånger på en dag:**

| Regel | Prompt räckte inte | Deterministisk grind behövdes |
|---|---|---|
| CTA-golvet | En caption fick imperativ-CTA, nästa slutade i ett konstaterande | `harCtaISlutet` + en omgenerering |
| Sanningskravet | Ämnet "en kund tvekade länge" framkallade påhittade kundminnen | Fail-closed siffer- och minnesgrind i `copy.ts` |
| Siffror om omvärlden | "En standardskärm har cirka 400 nits" kom tillbaka trots skärpt promptregel | `obackadeSiffror` + omgenerering |

**Regeln:** en instruktion till modellen är en önskan. Där utfallet är verifierbart
med kod ska det verifieras med kod — och rättas med **exakt en** omgenerering, aldrig
en loop. **Fail-open**: användaren ska aldrig bli utan text för att en grind slog till.

**Följdregel:** en grind som mäter fel sak ser ut att fungera. CTA-kontrollen mätte
sista *stycket* och godkände "Skicka en bild… Vi finns i Roslagen och norra Stockholm"
— uppmaningen fanns, men läsaren lämnades i ett konstaterande. Mät det regeln
faktiskt säger: sista *meningen*.

---

## 2026-08-01 — Text skriven för ett format får inte återbrukas i ett annat

Veckoplanen skrev captionens hook och brödtext rakt in i fälten för texten **på bilden**.
En caption har hook, story och CTA; en affisch har ~26 tecken rubrik och ingen CTA.
Resultatet såg ut som ett fel i idéflödet — men idéflödet var oskyldigt.

**Regel:** en idé, en vinkel eller ett tema är UNDERLAG. Publik text genereras alltid
för sitt eget format, genom `byggTextPrompt`. Kopiera aldrig text mellan format.

---

## 2026-08-01 — Verifiera på den väg som faktiskt når kunden

Loggvalet verifierades på render-routen. Men Playwright-exporten svarar 501 i molnet,
så publicering och export fångar **live-editorn** med html-to-image. Rätt logga i
förhandsvisningen, fel i den publicerade bilden.

**Regel:** följ artefakten baklänges från det användaren faktiskt får, och verifiera
på den vägen. "Det ser rätt ut i previewn" är inte ett bevis.

---

## 2026-07-31 — Modellen ekar prompten som "svar"

Vid för kort eller talfritt ljud svarade Gemini med **sin egen instruktion**, med
HTTP 200 och `finishReason: STOP`. Texten skrevs rakt in i användarens ämnesfält, och
kunde sparas som klientens "röstexempel" och som intake-transkript.

**Regel:** utdata från en modell är aldrig betrodd bara för att svaret är 200. Där den
går rakt in i ett fält eller en databaskolumn ska den grindas mot instruktionen som
skickades. Be om transkription **tecken för tecken** och jämför programmatiskt —
vision- och ljudmodeller autokorrigerar gärna till det de tror att du vill höra.
