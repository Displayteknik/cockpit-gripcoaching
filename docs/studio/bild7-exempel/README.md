# BILD-7 — före/efter för bildpromptens kärnregler

Fem testgenereringar med avbildad skyltning, två tenants med olika bransch och olika
grafisk profil. Samma skript, samma ämnen, samma dag — enda skillnaden är koden:

```
BILD7_LAGE=fore  npx tsx --tsconfig scripts/text1/tsconfig.json scripts/studio/bild7-exempel.mts
BILD7_LAGE=efter npx tsx --tsconfig scripts/text1/tsconfig.json scripts/studio/bild7-exempel.mts
BILD7_FALL=1,3   ... (kör om enskilda fall)
```

FÖRE-bilderna kördes mot koden före BILD-7 (ändringarna stashade), EFTER mot koden i
repot. Testbilderna raderas ur `studio-images`-bucketen efter varje körning — kundens
mediabibliotek ska inte fyllas av QA (`feedback_live_client_no_disruption`).

**Tenants:** Displayteknik `a6a33547-…` (digital signage, signatur *mörk-kontrast*)
och Annas Blommor `7461fa8b-…` (florist, `colorGrade: "varm-naturlig"`).

| # | Tenant | Ämne | FÖRE | EFTER |
|---|--------|------|------|-------|
| 1 | Displayteknik | Skyltfönstret som säljer när butiken är stängd | skärm visar **KRÄFTSKIVA 8 AUGUSTI** — säsongsmarkören, inte butikens erbjudande | skärm visar plagget + **VÅRA NYHETER / SE MER** i butikens skyltfönster |
| 2 | Displayteknik | Digital menytavla i lunchrestaurangen | tre rätter på skärmen, budskapsraderna är **tomma vita rutor** | **DAGENS LUNCH 129 KR** + *UGNSBAKAD LAX MED FÄRSKPOTATIS & DILL* |
| 3 | Displayteknik | Skärmen i receptionen | besökarlista + **KRÄFTSKIVA 8 AGUSTI** och en hummerbild som "erbjudande" | **VÄLKOMMEN TILL OSS** + **MÖTE KL 10:00** |
| 4 | Annas Blommor | Skyltfönstret inför helgen | två griffeltavlor med **KRÄFTSKIVA PÅ GÅNG 8 AUGUSTI** i en blomsteraffär, sval ton | skylt med **HELGBUKETT 299 KR**, varmt kvällsljus |
| 5 | Annas Blommor | Veckans buketterbjudande | griffeltavla utan pris, texten avklippt | skylt med **VECKANS BUKETT 299 KR**, varm sommarton |

## Vad bevisen visar

**B1 — relevans *och* budskap.** FÖRE hade relevanta motiv men innehållslös skyltning:
tomma etikettrutor (fall 2) eller en helt orelaterad högtidsannons (fall 1, 3). EFTER
bär varje skylt både ett igenkännbart motiv och en kort trovärdig rad — erbjudande,
pris eller tid — i en vertikal som är rimlig för tenanten. Ingen av dem innehåller en
CTA som konkurrerar med inläggets egen, och inga tankstreck (BILD-6a håller).

**B2 — motivvariation i säsongslagret.** FÖRE landade **tre av fem** genereringar i
kräftskivan (fall 1, 3, 4 — plus hummertryck i fall 4) trots att de gällde tre olika
ämnen och två olika branscher: högtidsmarkören var den enda säsongsingången som fanns.
EFTER: **noll** kräftmotiv. Uttrycken varierar i stället över skymningsgata, ljus
lunchrestaurang, solig lobby, gyllene kvällsljus och varm sommardag.

**B3 — färgton ur den grafiska profilen.** Annas Blommor har `colorGrade:
"varm-naturlig"`. FÖRE tolkades bara exakt `"warm"` → tonen föll tyst bort och bilderna
blev svala (fall 4, 5). EFTER bär bilderna en tydligt varm ton. Displayteknik behåller
sin mörka, kontrastrika signatur (fall 1) — profilerna krockar inte.

## Kvarstående begränsning (ärlig notering)

Bildmodellen stavar fel i avbildad text då och då: `IDÅG`, `NYHIETES`, `VÄKLLOMEN`.
Regeln pekar nu ut felen med namn, men **stavningen går inte att garantera på
promptnivå** — det bekräftades av en riktad omkörning av fall 1 och 3 efter
skärpningen. Vägen med garanti är fältet **"Text i bilden"** (B3), som verifierar med
vision och faller tillbaka på programmatisk text. Budskapets *innehåll* och *placering*
styrs av BILD-7a; exakt formulering ska gå via B3.
