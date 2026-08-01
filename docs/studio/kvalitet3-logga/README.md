# KVALITET-3 punkt 6 — loggvalet: bevis + manuellt val

Kör om beviset:

```
npx tsx --tsconfig scripts/text1/tsconfig.json scripts/studio/loggval-bevis.mts
```

Skriptet mäter inte om något på egen hand. Det anropar `computeLogoHint` ur
`lib/studio/logo-contrast.ts` — exakt den funktion render-vägen använder — och jämför
resultatet med den **gamla** regeln (medelvärde mot tröskel, plattbeslut mot medelvärde)
på samma uppmätta zon. Bilderna renderas sedan med mall-komponenten `ArkOverlay`, samma
komponent som render-routen och live-editorn ritar, och fotograferas med Playwright.

Loggan i bevisbilderna är en neutral platshållare (`MÄRKET`) i två varianter — mörk
original och vit. Det är kontrasten som prövas, inte en kunds grafiska profil.

## (a) Autovalet i render-vägen

Loggzon: översta vänstra rutan (`OVERLAY_TOP_ZONE`, 4–49 % bredd, 2–14 % höjd).

| Bild | Zon (medel / p05 / p95) | FÖRE (medelvärderegeln) | EFTER (BILD-6b) | Ändrades |
|---|---|---|---|---|
| Kräftskive-bilden — blomsteraffär, träd och ljus fasad i fönstret mot mörk interiör | 0,769 / 0,311 / 0,991 | mörk original, **ingen platta** | mörk original + **ljus platta** | ja |
| Menyskärms-bilden — lunchrestaurang, skärmen i fönstret, ljust trätak mot mörka skenor | 0,523 / 0,152 / 0,803 | **vit variant**, ingen platta | **mörk original + ljus platta** | ja |
| Kontrollfall — skyltfönster i kvällsljus, entydigt mörk toppzon | 0,173 / 0,016 / 0,429 | vit variant | vit variant | nej |

**Svaret på frågan: ja.** För båda bildtyperna Håkan visade väljer render-vägen numera
mörk variant och/eller platta.

- Menyskärms-bilden är det tydliga fallet. Medelvärdet 0,52 ligger under fototröskeln
  0,55, så den gamla regeln läste zonen som mörk och la en **tunn vit logga över ljust
  trätak och ett solbelyst fönster**. Spannet 0,65 avslöjar mixen: varians/max-regeln
  väljer mörk original och lägger en ljus platta under. Se `fore-menyskarm-skyltfonster.png`
  mot `efter-menyskarm-skyltfonster.png` — loggan går från nästan osynlig till läsbar.
- Kräftskive-bilden fick redan rätt variant av medelvärdet (zonen är ljus), men **ingen
  platta**: det mörkaste partiet (p05 0,31) ligger för nära den mörka loggan. Plattbeslutet
  mot zonens värsta parti fångar det.
- Kontrollfallet visar att regeln inte överkorrigerar: en entydigt mörk zon får fortfarande
  vit logga utan platta.

### Vad verifieringen också avslöjade

Render-routen (`/studio/render/...`) hade hinten, men **det är inte den som blir de
publicerade pixlarna i molnet**. Export, "spara i biblioteket" och publicering fångar
live-editorn i webbläsaren med `html-to-image` (Playwright-exporten svarar 501 i
produktion). Live-editorn fick aldrig någon hint och föll tillbaka på vit variant oavsett
bakgrund — alltså exakt det fel bevisbilderna visar, i den bild som faktiskt publicerades.

Åtgärdat: `POST /api/studio/logo-hint` ger klienten samma beslut, och `StudioEditor`
skickar det vidare till mallen. Auto gäller nu hela vägen till den publicerade bilden.

## (b) Manuellt loggval

`overrides.logoVariant` (`""` = auto, `ljus`, `mork`, `platta`) sparas med inlägget som
alla andra overrides. Väljaren ligger i editorns inställningar under "Logotypen på bilden".

Mätt på kräftskive-bilden:

| Val | Variant | Platta |
|---|---|---|
| Auto | mörk original | ljus |
| Ljus bakgrund | mörk original | ingen |
| Mörk bakgrund | vit variant | ingen |
| Platta bakom | mörk original | ljus |

Valet läses i mall-komponenten (`valjLogga` i `lib/studio/logo-style.ts`), inte bara på
servern — därför gäller det i live-editorn, i previewn och i den publicerade bilden.
Servern hoppar över mätningen helt vid `ljus`/`mork`; `platta` behåller autovalets variant
och lägger bara plattan på.

## Filer

| Fil | Innehåll |
|---|---|
| `matning.json` | Rådata: zonstatistik, före/efter-beslut, manuella val |
| `fore-*.png` / `efter-*.png` | Renderade bevis per bildtyp |
