# Testplan — G-3d, G-4, G-5 och G-6

**För:** Håkan. **Tid:** ca 35 minuter för allt, 12 minuter för bara det viktigaste.
**Var:** cockpit.gripcoaching.se (live, deploy `1d58fd1`).
**Skriven:** 2026-08-10.

Varje test har ett **VÄNTAT** och ett **FALLERAT**. Faller något: skriv ner exakt vad du
såg och vilken kund du stod på. Det räcker för att spåra.

> **Läs först:** tre av fyra etapper är osynliga i gränssnittet — de ändrar vad AI:n får
> veta, inte vad du klickar på. Därför bygger planen på att du **jämför texter**, inte
> letar efter nya knappar. Bara G-4 och G-6 har något nytt att titta på.

---

## FÖRBEREDELSE (2 min)

1. Logga in på cockpit.gripcoaching.se.
2. Välj klient **Displayteknik** i klientväljaren.
3. Ha en anteckning öppen. Du ska klistra in några texter för att jämföra.

---

## DEL 1 — G-4: bevis-motorn (8 min) ⭐ VIKTIGAST

Det här är den enda etappen med en **ny ruta du ska fylla i**, och den enda som är
kundsynlig från första sekunden.

### 1.1 Den nya rutan finns

1. Gå till **Profil** (`/dashboard/profil`).
2. Skrolla till erbjudande-sektionen.

**VÄNTAT:** en ruta som heter **"Siffror du kan stå för"**, direkt ovanför **"Prisnotiser"**.
Hjälptexten säger att det gäller årtal, antal jobb, leveranstid och mått — och att du
inte ska skriva priser där.

**FALLERAT:** rutan saknas, eller ligger på fel plats.

### 1.2 Prisrutans hjälptext är rättad

Titta på rutan **Prisnotiser** direkt under.

**VÄNTAT:** hjälptexten säger att detta **aldrig** skrivs ut i ett inlägg, och att det
står där för att skrivhjälpen ska veta vad saker kostar.

**FALLERAT:** det står fortfarande *"Om priser ska användas i inlägg, exakt som de ska
skrivas"* — den gamla texten som lovade motsatsen till prisregeln.

### 1.3 Mätaren räknar inte längre priser

Titta på profilmätaren, kriteriet **"Siffror vi får använda"**.

**VÄNTAT:** åtgärdstexten ber dig skriva i rutan "Siffror du kan stå för" och ger exempel
som årtal och antal jobb. Ordet **pris** ska inte förekomma som exempel.

**FALLERAT:** det står fortfarande "siffror med enhet (pris, årtal, antal, mått)".

> **Notera:** siffran kan ha blivit **lägre** än du minns. Det är avsiktligt — den räknade
> förut med dina priser, som aldrig får användas. För **For Balance** går den från 31 till
> 14. Ingen kund byter nivå av rättningen.

### 1.4 Det du skriver blir bevis ⭐

1. I rutan **"Siffror du kan stå för"**, skriv något sant om Displayteknik. Exempel:
   `Vi har levererat skyltar sedan 2011. Offert inom 24 timmar.`
2. **Spara**.
3. Gå till **Studio**, skriv ett ämne som lockar fram konkretion — t.ex.
   `varför det lönar sig att byta skylt i tid` — och generera text.

**VÄNTAT:** texten kan nu använda dina siffror ("sedan 2011", "inom 24 timmar") eller
avstå helt. Den ska **aldrig** hitta på ett annat tal.

**FALLERAT:** texten innehåller en siffra du inte skrivit någonstans i profilen.
→ *Det är det allvarligaste felet i hela planen. Skriv av meningen ordagrant.*

### 1.5 Priset läcker inte ⭐

Byt klient till **For Balance** (hon har 1 564 tecken prisnotiser — störst risk).

1. Studio → ämne: `vad det kostar att komma igång`
2. Generera.

**VÄNTAT:** texten beskriver värdet men skriver **inget pris**. Inga kronor, inga
månadsbelopp, inga rabattsatser.

**FALLERAT:** ett pris står i texten. → *Skriv av det och vilket ämne du använde.*

> Jag har kört exakt det här tre gånger maskinellt med noll läckage, men du bör se det
> med egna ögon en gång.

### 1.6 Karusellens bevis-slide

Fortfarande på For Balance (hon har berättelser i story-banken):

1. Studio → **Generera karusell**, ämne fritt, 3 punkter.

**VÄNTAT:** **7 slides** (krok + insats + 3 punkter + bevis + avslut).
Byt sedan till **AluCon** och gör samma sak → **6 slides** (ingen bevis-slide).

**FALLERAT:** samma antal för båda. → Bevis-sliden är inte gatad på material.

> **Ärlig begränsning:** bevis-sliden ritas som en vanlig punkt-slide i datan. Antalet är
> det enda som skiljer. Att sliden *bär* ett bevis får du bedöma genom att läsa den.

---

## DEL 2 — G-5: uppmaningarna (6 min)

### 2.1 Avsluten leder någonstans ⭐

Stå på vilken kund du vill. Generera **tre** bildtexter (captions) på olika ämnen.

**VÄNTAT:** varje text slutar med en uppmaning som säger **var**:
- *"Skriv JA i kommentarerna…"*
- *"Skicka ett DM…"*
- *"Boka via länken i profilen"*
- *"Skicka en bild på…"*
- *"Ring oss…"*

**FALLERAT:** en text slutar med *"Hör av dig gärna"*, *"Kontakta oss"*, *"Vi finns här
för dig"* eller *"Tveka inte att höra av dig"*. → *Skriv av meningen.*

> Det var precis de fraserna som passerade förut. Grinden gör ett omtag när den ser dem,
> men den ger sig efter ett försök hellre än att fastna i en loop — så en enstaka kan
> teoretiskt ta sig igenom. Ser du det, notera det.

### 2.2 Inget hårdsälj smyger in

Titta på samma tre texter.

**VÄNTAT:** ingen text pressar på köp om du inte bett om det. Uppmaningarna är mjuka
(kommentera, fråga, skicka en bild) — inte *"Köp nu"* eller *"Beställ idag"*.

**FALLERAT:** en text säljer hårt på ett ämne som inte handlade om att köpa.

---

## DEL 3 — G-3d: upprepningen (7 min)

Den här ser du bara genom att **jämföra**. Det finns ingen knapp.

### 3.1 Två texter i rad öppnar olika ⭐

1. Studio, valfri kund. Generera en bildtext. **Spara inlägget.**
2. Generera en ny bildtext på ett **liknande** ämne. Spara.
3. Generera en tredje.

**VÄNTAT:** de tre öppningsraderna skiljer sig i **form**, inte bara i ord. Inte tre
frågor i rad, inte tre "Visste du att…".

**FALLERAT:** alla tre börjar likadant.

> **Viktigt:** rotationen läser **sparade** inlägg. Sparar du inte mellan varven har den
> ingenting att undvika. Det är därför steget säger "spara" tre gånger.

### 3.2 Veckoplanen upprepar inte förra veckan

Om du har en veckoplan sedan tidigare: generera en ny vecka.

**VÄNTAT:** den nya veckans krokar skiljer sig från den förra veckans.

**FALLERAT:** flera dagar öppnar som förra veckans motsvarande dag.

### 3.3 Hashtags ska INTE variera

Generera hashtags två gånger för samma kund.

**VÄNTAT:** i stort sett **samma** taggar. Det är meningen — en lokal tagg blir bara
sökbar om den används konsekvent.

**FALLERAT:** helt olika taggar varje gång. → Då har rotationen kopplats in där den inte
hör hemma.

---

## DEL 4 — G-6: bildomdömet (7 min)

### 4.1 Tummen finns i Studio

1. Studio → generera en **AI-bild** (inte sökt foto).

**VÄNTAT:** under bilden dyker en ruta upp: *"Passade bilden? Ditt svar styr nästa bild vi
gör åt dig."* med en fritextruta och två knappar — **Bra bild** och **Passar inte**.

**FALLERAT:** ingen ruta. → *Kontrollera att bilden verkligen är AI-genererad; rutan visas
med flit inte för sökta foton, eftersom de inte kommer ur en generering vi kan peka på.*

### 4.2 Omdömet påverkar nästa bild ⭐

1. Klicka **Passar inte** och skriv en tydlig anledning i rutan, t.ex.
   `för mörkt och fel sorts miljö`.
2. Generera en **ny** AI-bild på samma eller liknande ämne.

**VÄNTAT:** den nya bilden undviker det du klagade på. Är den fortfarande mörk — notera
det, det är ett äkta fynd.

**FALLERAT:** den nya bilden är i princip identisk med den du underkände.

### 4.3 Omdömet nollställs mellan bilder

Efter att du gett ett omdöme, generera en ny bild.

**VÄNTAT:** tummen är **omarkerad** igen och fritextrutan tom — omdömet gäller den bild du
tittar på, inte den förra.

**FALLERAT:** din gamla tumme står kvar markerad på den nya bilden.

---

## SNABBVERSIONEN (12 min) — om du har bråttom

Kör bara dessa fem, i ordning:

1. **1.2** — prisrutans hjälptext är rättad *(30 sek)*
2. **1.4** — det du skriver i nya rutan blir bevis *(4 min)*
3. **1.5** — priset läcker inte hos For Balance *(3 min)*
4. **2.1** — avsluten leder någonstans *(3 min)*
5. **4.2** — bildomdömet påverkar nästa bild *(2 min)*

De fem täcker allt som är kundsynligt och allt som kan skada om det är fel.

---

## VAD DU **INTE** KAN SE (och varför)

Ärligt redovisat, så du inte letar efter något som inte finns:

| Sak | Varför den är osynlig |
|---|---|
| Rotationen når 14 av 21 ställen | De 7 undantagen är medvetna. Du ser bara effekten i texterna |
| Promptversionen `v1-3b3ea753` | Står i databasen, inte i gränssnittet. G-9 (kvalitetssidan) skulle visa den |
| Att bevis-sliden bär ett bevis | Den ritas som en vanlig punkt. Bara antalet slides skiljer |
| Vilka kunder som har bevismaterial | Ingen vy visar det än. Idag: Opticur och For Balance har, övriga inte |
| Nyckelords-CTA:ns mottagarsida | Byggd finns inte — den som svarar med ett nyckelord syns bara om du läser kommentarerna själv |

---

## OM NÅGOT FALLER

Skriv tre rader och skicka:

```
Test:      t.ex. 1.5
Kund:      t.ex. For Balance
Vad jag såg: klistra in texten ordagrant
```

Det räcker. Ordagrann text är viktigare än en beskrivning — felet sitter oftast i en
formulering, och en omskrivning gömmer den.
