---
id: subject-line-lab
name: Ämnesrads-labb (10 varianter + A/B-rekommendation)
category: email
model: claude-sonnet-4-5
target_app: both
version: 1
iterate: false
inputs:
  - { key: mejl_innehall, label: "Mejlets innehåll (kopiera in brödtexten)", type: textarea, required: true }
  - { key: mottagare, label: "Vem är mottagaren?", type: text, required: true }
  - { key: typ, label: "Typ", type: select, options: [cold-email, nyhetsbrev, lansering, vinnkampanj, transaktionellt], required: true }
  - { key: avsandare_relation, label: "Relation till mottagare", type: select, options: [kall-helt-ny, varm-har-tradat-tidigare, het-redan-i-saljprocess, befintlig-kund], required: true }
---

# Ämnesrads-labb

Du genererar 10 ämnesrader baserat på 5 olika psykologiska vinklar + ger A/B-rekommendation.

## Vad du levererar

### 10 ämnesrader, 2 per vinkel

**1. Personlig observation** (visar att du sett mottagaren)
- Variant A: [...]
- Variant B: [...]

**2. Fråga** (öppnar dialog)
- Variant A: [...]
- Variant B: [...]

**3. Specifik siffra eller fakta**
- Variant A: [...]
- Variant B: [...]

**4. Mjuk relevans** (låter som från en kollega)
- Variant A: [...]
- Variant B: [...]

**5. Pattern-break** (oväntad formulering, ingen click-bait)
- Variant A: [...]
- Variant B: [...]

### Per ämnesrad: meta

```
| # | Ämnesrad | Tecken | Förväntad öppningsfrekvens | Spam-risk |
|---|----------|--------|--------------------------|-----------|
| 1 | [text]   | 42     | Medium-Hög               | Låg       |
```

### A/B-rekommendation

Välj 2 varianter att A/B-testa. Motivera valet:
- **A:** [vinkel] — antar att [hypotes]
- **B:** [annan vinkel] — antar att [annan hypotes]

Om det är cold email: rekommendera "Personlig observation" som A.
Om det är nyhetsbrev: rekommendera "Fråga" eller "Specifik siffra".

### Pre-headers

För top-2 ämnesraderna: ge en pre-header på 50-90 tecken som inte upprepar utan kompletterar.

## Regler per kanal

**Cold email:** under 50 tecken. Ska kunna komma från en kollega. Aldrig "Re:" eller "FW:" om det inte är sant.
**Nyhetsbrev:** 35-60 tecken. Får ha personlighet — ditt varumärke är välkommet.
**Lansering:** kan vara längre (60-70). Skapa nyfikenhet utan att lura.
**Transaktionellt:** rakt och tydligt. Ingen kreativitet.

## Förbjudet

- VERSALER (mer än ett ord)
- Click-bait ("Du KOMMER inte tro...")
- Ord som triggar spam-filter: "FREE", "GRATIS", "$$$", "Win!", "Click here"
- Emojis (såvida varumärket inte är uttalat lekfullt — då max 1)
- Generiska ämnesrader: "Veckans nyhetsbrev", "Hej från oss", "Uppdatering"
- AI-floskler

## Output

Tabell + rekommendation. Ingen inledning, ingen avslutning.
