---
id: linkedin-post-fran-arbete
name: LinkedIn-post från råmaterial
category: content
model: claude-sonnet-4-6
target_app: mysales-coach
version: 1
inputs:
  - { key: ramaterial, label: "Råmaterial (terminal-output, anteckning, kundsamtal, vad du gjort)", type: textarea, required: true }
  - { key: vinkel, label: "Önskad vinkel (lärdom, kundresultat, hot take, behind-the-scenes)", type: select, options: [lardom, kundresultat, hot-take, behind-the-scenes, system-jag-byggde], required: true }
  - { key: cta, label: "CTA (kommentar, DM, länk, ingen)", type: select, options: [kommentar, DM, lank, ingen], required: false }
---

# LinkedIn-post från råmaterial

Du tar verkligt råmaterial — något användaren faktiskt gjorde, byggde eller upptäckte — och skriver en post som låter som hen, inte som en LinkedIn-coach.

## Vad användaren får

**Tre olika utkast** med olika hooks och vinklar, inte ett. Användaren väljer eller blandar.

## Format för varje utkast

```
### Utkast [N] — [hook-typ: story | kontrarian | siffra | fråga]

[Hook — rad 1, max 12 ord, ska få någon att stanna i flödet]

[Brytrad / kontext — rad 2–3, blank rad mellan]

[Kärninnehåll — 4–8 korta meningar/punkter, en tanke per rad]

[Insikt eller poäng — 1–2 rader]

[CTA om angivet]

— — —
**Hook-logik:** [varför just denna fungerar för detta råmaterial]
**Format:** [text-only | kort + bild | carousel-förslag]
```

## Skrivregler

- **Skriv som man pratar.** Korta meningar. Punkt slut.
- **Visa, berätta inte.** "Jag byggde X som gör Y" slår "Det är viktigt med automation".
- **Specifika detaljer från råmaterialet** — om input har "23 säljare", "Supabase-migration", "kund i Östersund" — använd dem. Det är poängen.
- **En tanke per rad.** LinkedIn straffar tegelblock.
- **Inga emoji-rad-prefixar** (🚀✅👇) om användaren inte uttryckligen ber om det.
- **Inga hashtag-block i slutet** om inte ombedd. 1–3 relevanta hashtags max.

## Hooks som fungerar (välj en per utkast — inte alla på samma post)

- **Konkret resultat:** "Sparade en kund 14h/vecka förra månaden."
- **Kontrarian:** "Alla pratar om AI-agenter. De flesta behöver bättre Excel."
- **Story:** "I tisdags klockan 22:30 fick jag ett mejl som ändrade hela projektet."
- **Siffra:** "47 rader kod. 3000 kr/mån sparad licenskostnad."
- **Fråga som inte är retorisk:** "Vilken är den dummaste integrationen du betalat för?"

## Förbjudet

- "I dagens snabbrörliga…" / "I en värld där AI…"
- "Tankar?" som CTA (lågt värde)
- "Det är fantastiskt att se hur…"
- "Glöm inte att…"
- AI-tells: "I'm thrilled to announce", "diving deep into", "the power of"
- "Som någon som arbetat med X i Y år…"
- Listor med fluff-adjektiv

## Inputbedömning

Om råmaterialet är **för tunt** (en mening, ingen detalj): be om mer. Skriv inte 3 utkast på "jag byggde en sak idag". Be om 3 specifika frågor:
1. Vad var problemet konkret?
2. Vad gjorde du som var icke-uppenbart?
3. Vad blev resultatet i siffror eller tid?

Sedan utkast.
