# AI-bildgenerering — master playbook

Detta är de hårda principerna för att producera bilder som INTE ser ut som AI. Följ dem exakt när du bygger prompts för Imagen 4, FLUX 1.1, Nano Banana (Gemini 2.5 Flash Image).

## 1. Modell-styrkor och svagheter

| Modell | Styrkor | Svagheter | Använd när |
|---|---|---|---|
| **Imagen 4** | Fotorealism, hudtoner, ljussättning, ansikten, händer | Långsam (~15s), kostsam, restriktiv | Porträtt, lifestyle, emotionella scener |
| **FLUX 1.1** | Snabb, billig, bra på kompositioner | Sämre på hudtoner, AI-look ofta | Wide-shots, miljöer, abstrakt |
| **Nano Banana** (Gemini 2.5 Flash Image) | Snabb, BÄST på image-edit (img2img), bra på enkla scener | Sämre på fotorealism, text instabil | Redigera befintlig bild, snabb iteration |
| **Pexels stock** | Riktiga foton, INGA AI-tells, gratis | Generisk, måste kuratereras | Default när AI-look skulle skada brandet |

**Nyckelinsikt:** För hög-kvalitet brand-content är Pexels med smart sökning ofta bättre än AI-generering. AI-generering bara när du behöver något som inte finns i stock.

## 2. Universal anti-AI-look-regler

### Skriv ALLTID på engelska
Bildmodeller hanterar engelska bäst. Svenska prompts ger sämre resultat. Och svenska tecken (å/ä/ö) i text-overlay kraschar 100% av tiden — trasig text varje gång.

### Inkludera ALLTID dessa modifiers
- `documentary photography` — direkt motgift mot AI-look
- `candid moment` — slipper poserade bilder
- `natural lighting` — slipper studio-glans
- `35mm film` eller `85mm lens` — ger fotograf-känsla
- `shallow depth of field` (eller `f/1.8`) — bakgrund suddig = professionellt
- `natural skin tones, slight imperfections` — slipper plastig hud
- `editorial style` — slipper stock-känsla

### Negativa keywords (tas BORT från resultatet)
Lägg ALLTID till:
- `no stock photo style`
- `no smiling business person`
- `no handshake`
- `no lightbulb`
- `no puzzle pieces`
- `no arrows`
- `no AI-generated look`
- `no oversaturation`
- `no perfect symmetry`

## 3. Promptstruktur som funkar

```
[SUBJECT — vem/vad, 1 rad]
[ACTION/EXPRESSION — vad personen gör, 1 rad]
[COMPOSITION — close-up / medium / wide]
[LIGHTING — natural / golden hour / overcast / studio]
[STYLE — documentary / editorial / cinematic]
[CAMERA — 35mm film / 85mm lens / shallow depth of field]
[MOOD — concentrated / hopeful / melancholic]
[NEGATIVES — what to avoid]
[ASPECT RATIO — last]
```

**Exempel som fungerar:**

```
A woman in her 50s in an optician's office, looking thoughtfully at the camera with subtle worry in her eyes. Soft natural light from window, candid documentary style, 85mm lens, shallow depth of field, muted earth tones, natural skin texture with slight imperfections. Avoid: stock photo look, plastic skin, AI-generated symmetry, smiling, glasses on subject. Square 1:1.
```

## 4. Komposition per format

| Format | Storlek | Komposition |
|---|---|---|
| Instagram feed | 1080×1080 | Center-vikt, 60-70% subject |
| Instagram portrait | 1080×1350 | Vertikal, högre engagement, bättre för text-overlay |
| Story/Reel cover | 1080×1920 | Action i mittersta 60%, top/bottom blir cropped |
| LinkedIn feed | 1200×627 (1.91:1) | Wide, mer luft, mindre mättnad än IG |

## 5. Belysning som funkar

| Ljus | Använd för | Modifier |
|---|---|---|
| Soft natural window light | Porträtt, intervju-stil, lugna ämnen | `soft natural light from window, overcast` |
| Golden hour | Optimism, känsla, slut-på-dagen | `golden hour, warm light, slight backlit` |
| Cool overcast | Allvar, reflektion, professionalism | `overcast diffused light, neutral tones` |
| Tungsten/warm interior | Hemkänsla, intim, mentor-stil | `warm tungsten lighting, evening interior` |

**Undvik alltid:** harsh studio lighting med 3-punkts-setup (ger AI-stock-look).

## 6. Text-i-bild — när och hur

**Regel 1:** Defaultvärde är **INGEN text i bilden**. Lägg text i extern editor (Opticur-mall, Canva, ImageStudio:s overlay-flikar).

**Regel 2:** Om text MÅSTE i bilden:
- Endast engelska / ASCII-säkra tecken
- Max 3-5 ord
- Brandnamn i versaler (OPTICUR, GRIPCOACHING, DISPLAYTEKNIK)
- Aldrig svenska tecken i AI-genererad text — alltid trasig

**Regel 3:** Brand-tagline ska ALDRIG översättas av AI. Skriv den exakt på engelska eller använd extern editor.

## 7. Brand-konsistens över serier

För att fler inlägg ska kännas som **samma röst visuellt**:

- **Samma lens** över serie: 85mm porträtt eller 35mm wide
- **Samma ljustyp**: window-light hela serien eller golden hour hela serien — blanda inte
- **Samma färgton-palett**: muted earth tones, eller cool blue, eller warm sepia
- **Brand-färg som accent** (10% av bilden) — inte main-färg
- **Samma "fotograf"-stil**: documentary genom hela, inte ibland editorial ibland documentary

I prompten: lägg till `consistent visual style with previous brand images: [stil]`.

## 8. Img2img / referensbild-redigering (Nano Banana)

När du har en bra bild men vill ha variation:

```
[base image] +
"Edit: same scene, same composition, same lighting style, but change [X to Y]. Keep all other elements identical."
```

Bra för:
- Byta person men behålla scen
- Ändra kläder/färg på objekt
- Lägga till/ta bort element
- Justera ljus eller mood

## 9. Quality-checklista innan du sparar

- [ ] Bilden ser INTE ut som typisk AI-stock (smiling person, lightbulb, handshake)
- [ ] Hudtonerna är naturliga (inte plastiga eller över-glansiga)
- [ ] Ingen osäker text/symbol i bilden
- [ ] Ljuset är konsistent (skuggor på rätt sida)
- [ ] Komposition har en tydlig fokuspunkt
- [ ] Aspect ratio matchar målformatet
- [ ] Bilden förstärker inläggets text (inte bara dekorativ)
- [ ] Inga generiska klyschor (se anti-cliches.md)

## 10. När AI-bild inte är rätt verktyg

Använd Pexels/riktigt foto istället när:
- Bilden ska ha logotyp eller text på svenska
- Du behöver specifik plats/byggnad/lokal
- Bilden ska visa specifik produkt
- Klienten har egna foton i biblioteket
- Du vill ha 100% äkta människa (inte AI-perfekt ansikte)

AI-genererat funkar bäst för:
- Abstrakta/känslomässiga scener
- Generiska miljöer (kontor, kafé, hem) utan specifik plats
- Konceptuella bilder ("ensamhet", "klarhet", "förtroende")
- Snabba carousel-bilder där varje slide har olika scen
