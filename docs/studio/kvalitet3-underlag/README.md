# KVALITET-3 punkt 3 — bevis: idén är underlag, texten är genererad

```
npx tsx --tsconfig scripts/text1/tsconfig.json scripts/studio/underlag-bevis.mts
```

Skarp körning mot Displayteknik (`a6a33547-…`) genom de riktiga routerna. Rådata i
`bevis.json`.

## Kedjan

**1. Underlag** (det veckoplanen ger — en vinkel, ingen färdig text)

```
Veckotema: Skyltfönstret som säljer när butiken är stängd
Dagens vinkel: Digitala menyskärmar i skyltfönster syns även i dagsljus
```

**2. Caption** — genererad via `suggest-caption` → `byggTextPrompt` (röst, profil,
anatomi, skrivregler, sanering):

> Undrar du hur du får ditt skyltfönster att sälja även när butiken är stängd? Med en
> digital menyskärm syns ditt budskap tydligt, oavsett om solen skiner eller om mörkret
> faller. […] Skicka en bild på ditt skyltfönster, få offert inom 24 timmar.

**3. Text på bilden** — genererad via `suggest-text` → `generateStudioCopy`
(pa-bild-anatomin, ingen CTA, siffergrind), grundad i captionen:

| # | Hook | Rubrik | Underrubrik | Kort text |
|---|---|---|---|---|
| 1 | fråga | Vem ser din meny klockan åtta på kvällen? | Skyltfönstret säljer även när butiken är stängd | Med en digital menyskärm syns ditt budskap dygnet runt, även i direkt solljus. |
| 2 | konträr | Stängt är det nya öppet | Menyn syns dygnet runt | Skyltfönstret säljer även när du låst för dagen. Med rätt ljusstyrka syns budskapet i fullt solljus. |
| 3 | påstående | Skyltfönstret säljer dygnet runt | Dagsljus är ingen ursäkt längre | En digital menyskärm med 3 000 nits syns även i direkt solljus, kunden läser menyn när du är stängd. |

## Sida vid sida — det som var felet

| | FÖRE (det Håkan såg) | EFTER |
|---|---|---|
| Text på bilden | *"Digitala menyskärmar med högt ljus syns även i…"* — captionens/vinkelns egna ord, ordagrant, avklippta | *"Vem ser din meny klockan åtta på kvällen?"* — egen rubrik, skriven för affischformatet |
| Var den kom ifrån | `payload.headline1 = hook` (avskrift) | `generateStudioCopy` med captionen som grund |
| CTA på bilden | följde med från captionen | ingen — mallens fot och bildtexten bär den |
| Siffror | ärvda utan kontroll | siffergrind: 3 000 nits släpps igenom för att talet står i profilen |

## Kontroller i körningen

- `payload.headline1` och `payload.body` = `""` när veckoplanen sparar dagen. Inget kopieras.
- Vakten `arKopieradFranCaption` körs på alla nio genererade fälten: **0 ordagranna kopior**.
- Rubrik 3 nämner ett tal (3 000 nits). Siffergrinden i `lib/studio/copy.ts` släpper det
  bara för att talet finns i varumärkesprofilen — påhittad statistik hade filtrerats bort.

Enhetstester: `tests/pa-bild-underlag.test.ts` (11 st), där vakten fälls av exakt den
sträng som blev bildtext skarpt och friar en genererad rubrik.
