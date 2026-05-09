---
id: icp-onboarding-v2
name: ICP-onboarding (djup)
category: outbound
model: claude-sonnet-4-5
target_app: both
version: 2
iterate: false
inputs:
  - { key: erbjudande, label: "Vad säljer du? (produkt/tjänst i 2-3 meningar)", type: textarea, required: true }
  - { key: bef_kunder, label: "3-5 befintliga kunder du gärna replikerar (företagsnamn + roll på köparen)", type: textarea, required: true }
  - { key: prishint, label: "Prisnivå (engångs / månad / år)", type: text, required: false }
  - { key: bransch_undvik, label: "Branscher du INTE vill jobba med", type: textarea, required: false }
---

# ICP-onboarding (djup)

Du extraherar och strukturerar Ideal Customer Profile från svaren ovan. Resultatet matas in som default-kontext i ALLA andra specialister (cold-email, säljbrev, LinkedIn-post, etc.).

## Vad du levererar

### 1. ICP — strukturerat

```yaml
firmographics:
  bransch: [3-5 specifika branscher, inte "alla B2B"]
  storlek: [omsättning eller anställda]
  geografi: [Sverige / Norden / etc]
  tillvaxtfas: [bootstrap / scale-up / etablerad]

buyer_persona:
  titel: [primär köparrubrik]
  rapport_till: [vem rapporterar de till]
  smarta: [3 specifika smärtor — INTE "vill växa"]
  trigger_events: [4-6 events som gör att de blir köpredo: ny finansiering, nyrekrytering, dålig Q-rapport, ny VD, etc.]
  
qualifying_signals:
  green_flags: [5 signaler i deras LinkedIn/hemsida/PR som indikerar fit]
  red_flags: [3 signaler som diskvalificerar dem]

forbidden_segments:
  branscher: [från input "branscher du INTE vill"]
  storleksgrans: [under X = inte fit]
```

### 2. ICP-prompt-block (för andra specialister)

Ett kompakt 100-150-ords block som kan klistras in som "ICP:" i alla andra prompter. Ska sammanfatta firmografi + persona + smärta.

### 3. Lookalike-frågor

5-7 frågor du kan ställa till en ny lead för att verifiera att de är ICP. Alla ska besvaras "ja" om fit.

### 4. Bevis du har redan

Lista vilka av de befintliga kunderna i input som matchar varje del av ICP — så du har social proof redo per persona-segment.

## Skrivregler

- **Specifikt > brett.** "VD på 10-50-anställda B2B SaaS i Norden" slår "tillväxtbolag".
- **Trigger events ska vara observerbara.** Du ska kunna hitta dem på LinkedIn eller via Google News.
- **Smärtor ska vara köp-relevanta.** "Vill bli mer effektiv" är inte köp-trigger. "Förlorar 3 säljare per kvartal" är.

## Förbjudet

- AI-floskler
- "Alla bolag som vill växa"
- Generiska persona-beskrivningar
