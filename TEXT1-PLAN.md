# TEXT1-PLAN — Enhetlig promptpipeline (T-0, design och migreringsplan)

**Datum:** 2026-07-31 · **Status:** UTKAST — inväntar Håkans godkännande. Ingen kod är ändrad.
**Princip:** Ingen text lämnar systemet utan full kontext. `lib/prompt-core.ts` blir ENDA stället där textprompter sätts ihop.

---

## 1. API-design: `lib/prompt-core.ts`

### Signatur

```ts
// lib/prompt-core.ts
export type TextSyfte =
  | "caption"          // Studio: caption till inlägg
  | "studio-text"      // Studio: text PÅ bilden (affischformat)
  | "karusell"         // karusell-slides
  | "kanal-anpassning" // adapt-channel
  | "linkedin"         // draft + ideas
  | "blogg"            // Studio-blogg + äldre blogg + repurpose
  | "nyhetsbrev"
  | "veckoplan"        // klassisk + compass-vecka
  | "enskilt"          // /api/generate/post
  | "social"           // /api/social/generate
  | "specialist"       // specialist-run + night-iterate
  | "reel";            // reels-manus

export interface ByggParams {
  clientId: string | null;         // null = neutral (t.ex. publik Ikigai) — då hoppas röst/profil över med varning i meta
  syfte: TextSyfte;
  kanal?: "instagram" | "facebook" | "linkedin" | "webb" | "mejl";
  uppdrag: string;                 // flödets rollrad + syftesspecifika HÅRDA regler (ägs av flödet)
  underlag?: string;               // ämne/artikel/idé → hamnar i user-delen
  compass?: CompassParams;         // valfritt — annars default per syfte (avsnitt 3)
  bildKontext?: { caption?: string; bildbeskrivning?: string; bildRoll?: string }; // "grunda texten i inlägget"
  knowledge?: string[];            // statiska knowledge-filer, t.ex. ["hook-playbook", "linkedin-foundation"]
  jsonSchema?: string;             // JSON-formatkravet — läggs ALLTID sist (avsnitt 5)
  maxProfilTecken?: number;        // default 6000
}

export interface ByggdPrompt {
  system: string;                  // hela lagerkakan, färdig för båda stackarna
  user: string;                    // underlag (+ ev. variantsuffix läggs av anroparen)
  fingerprint: VoiceFingerprint | null;  // vidare till voice-score (Stack B) utan omhämtning
  winning: string[];                     // dito
  meta: { lager: Record<string, boolean>; profilKlippt: boolean };  // för enhetstest + logg
}

export async function byggTextPrompt(p: ByggParams): Promise<ByggdPrompt>;

// Sanering — samma villkor överallt (avsnitt 2, lager 8):
export async function saneraText(text: string, clientId: string | null, kanal?: HashtagKanal): Promise<string>;
```

### Användning per stack

```ts
// Stack A (Gemini):
const b = await byggTextPrompt({ clientId, syfte: "linkedin", uppdrag: ROLL, underlag: amne, jsonSchema: SCHEMA });
const raw = await generateJSON({ systemInstruction: b.system, prompt: b.user });   // skrivregler redan i b.system

// Stack B (Anthropic):
const b = await byggTextPrompt({ clientId, syfte: "studio-text", uppdrag: ROLL, underlag: idé, bildKontext });
const r = await iterateGenerate({ prebuilt: b, userPrompt: b.user, variants: 7, variantSuffixes });
```

`iterateGenerate` får ett nytt fält `prebuilt?: ByggdPrompt`. När det är satt hämtar iterate **inte** röst/winning själv (ingen dubblering, ingen dubbel DB-läsning) utan använder `prebuilt.system` rakt av och `prebuilt.fingerprint/winning` för scoring. `SPECIALIST_GUARDRAILS` läggs kvar av iterate (Anthropic-specifik). Gamla vägen (`systemPrompt` utan `prebuilt`) behålls som fallback tills T-3 är klar, sedan tas den bort.

---

## 2. Lagerordning och sammanvävning

Ordning i `system` (senare = väger tyngre för modellen, formatkrav allra sist):

| # | Lager | Källa | Villkor |
|---|---|---|---|
| 1 | **Uppdrag** — rollrad + flödets hårda regler | `p.uppdrag` (ägs av flödet) | alltid |
| 2 | **Statisk kunskap** — hook-playbook, linkedin-foundation osv. | `getStaticKnowledge(...p.knowledge)` | om angiven |
| 3 | **Brand-profil** — företagsfakta, USP, ICP, tonregler, GÖR/GÖR INTE, Customer Voice, Story-bank | `getProfileAsMarkdown(clientId)` MINUS voice/winning-blocken (se dubblettbeslut) | clientId satt |
| 4 | **Röst-fingerprint** — ton, rytm, signaturfraser, förbjudna ord + 4 råa exempel | `fingerprintToPromptBlock(getVoiceFingerprint(clientId))` | clientId satt |
| 5 | **Vinnande exempel** | `fetchWinningExamples(clientId, kategori(syfte))` | clientId satt |
| 6 | **Anatomi + Compass** — POST_ANATOMY alltid; funnel/4A/DISC ur params eller default | ny `anatomiBlock(syfte, compass)` | alltid (variant per syfte, se nedan) |
| 7 | **Grafisk kontext** — `dontsRule(kit.donts)` + kort tonalitetsrad ur signaturen | `getKitDirectives(clientId)` | bildnära syften: caption, studio-text, karusell, reel, kanal-anpassning |
| 8 | **Skrivregler** — `WRITING_RULES_BLOCK` | writing-rules.ts | om `skrivreglerPa(clientId)` (se avsnitt 6) |
| 9 | **JSON-formatkrav** | `p.jsonSchema` | om angiven — ALLTID sist |

`bildKontext` renderas som eget `=== GRUNDA TEXTEN I INLÄGGET ===`-block mellan 5 och 6 (samma mönster som dagens `copy.ts:91-98` — det är BILD/B-paketets beprövade grundning och behålls).

### Dubblettbeslut — EN väg per lager (viktigaste städbeslutet)

I dag finns rösten på upp till TRE ställen samtidigt i Stack B: `getProfileAsMarkdown()` väver själv in voice-fingerprint-block, winning examples, customer voice och story-bank (`lib/knowledge.ts:134-175`), `getKnowledge()` prependar hela den profilen framför knowledge-filerna (`knowledge.ts:35-36`), och `iterate.ts:64-74` lägger fingerprint + winning EN gång till. Studio-text får därmed brand-profilen två gånger och rösten upp till tre gånger.

**Beslut:**
- `getProfileAsMarkdown(clientId, { medVoice?: boolean })` får en flagga (default `true` = oförändrat beteende för alla omigrerade anropare). Prompt-core anropar med `medVoice: false` och äger lager 4–5 själv. Customer Voice och Story-bank stannar i profilen (lager 3) — de är kundens ord, inte klientens röst.
- Prompt-core använder `getStaticKnowledge()` (utan profil-prepend), aldrig `getKnowledge()`. Profilen läggs exakt en gång, i lager 3.
- `contentCompassBlock()` slutar bädda in `WRITING_RULES_BLOCK` (rad 87) — skrivreglerna ägs av lager 8. Idempotensvakterna i `gemini.ts:41` och `iterate.ts:79` behålls som skyddsnät men ska aldrig behöva trigga.
- `medSkrivregler()` i gemini.ts lämnas kvar som sista skyddsnät för omigrerade/framtida anrop (dubbleras inte tack vare idempotensen).

### Anatomin per syfte — två varianter (kräver Håkans OK)

`POST_ANATOMY` rakt av ("CTA sist, exakt EN") skulle **förstöra** studio-text: affischtexten har idag den hårda regeln "INGEN uppmaning/CTA i något fält" (`copy.ts:110-123`) eftersom captionen bär CTA:n — två CTA i samma inlägg annars. Därför:

- **`anatomiBlock("full", …)`** — hook/story/nytta/exakt en CTA. Gäller: caption, linkedin, blogg, nyhetsbrev, veckoplan, enskilt, social, specialist, reel (captiondelen), karusell (sista sliden = CTA-slide), kanal-anpassning.
- **`anatomiBlock("pa-bild", …)`** — hook-principen + känsla + nytta, med uttrycklig rad: "Ingen CTA i texten på bilden — captionen bär uppmaningen." Gäller: studio-text.
- Blogg/nyhetsbrev får en mappningsrad ("hook = rubrik + ingress, CTA = avslutande sektion") så anatomin inte krockar med deras befintliga strukturblock.

### Token-budget

| Lager | Tak | Anm |
|---|---|---|
| Brand-profil | 6 000 tecken (default) | standardiserar dagens spretiga 3 500–6 500; klipps på sektionsgräns, aldrig mitt i mening. **Fast klipprioritet (Håkans tillägg, godkänd):** Tonregler, GÖR/GÖR INTE och USP överlever ALLTID klippet; Story-bank och Customer Voice klipps först, därefter övriga sektioner i omvänd viktordning (Kundresa → Konkurrenter → sekundär ICP → …). `meta.profilKlippt` anger exakt vilka sektioner som klipptes (lista, inte boolean) |
| Fingerprint | ~3 800 tecken | redan kapat i källan (4 samples à 800) |
| Winning examples | 3 st à 800 tecken | samma som idag |
| Statisk kunskap | 2 500 tecken/fil | dagens praxis (`blog.ts:53`) |
| Anatomi+Compass | ~700 tecken | ren data |
| Uppdrag + formatkrav | flödets ansvar | |

Summa system ≈ 12–14 k tecken ≈ 4–5 k tokens. Fingerprint-cachen (24 h) gör att merkostnaden är två snabba DB-läsningar per anrop, ingen extra AI-körning.

---

## 3. Compass-default när inget är satt

Anatomin (lager 6) är ALLTID med. När `compass` saknas sätts **endast funnel** som mjuk default (formulerad "om inget annat framgår av ämnet") — 4A och DISC lämnas osatta, annars tvingas alla texter i samma berättarform, vilket skulle göra output MER likriktad, inte mindre.

| Syfte | Default-funnel | Motiv |
|---|---|---|
| linkedin | **mofu** | förtroendebygge, mjuk CTA — aldrig hårdsälj oombett |
| nyhetsbrev | **mofu** | befintlig relation, bevis/case |
| blogg | **mofu** | utbildande förtroendeinnehåll |
| caption, studio-text, karusell, social, reel, enskilt | **tofu** | organiskt flöde = väck intresse, engagemangs-CTA |
| veckoplan | ingen default | veckans mix ska styras av schema/WEEK_ROLES, inte en fast nivå |
| specialist, kanal-anpassning | ingen default | specialistens uppdrag resp. källinläggets nivå styr |

BOFU sätts ALDRIG som default — sälj-CTA ska alltid vara ett aktivt val.

---

## 4. Migreringstabell (alla textflöden ur 0.7)

| Flöde | Fil | Stack | Saknas idag | Etapp |
|---|---|---|---|---|
| LinkedIn draft | `app/api/linkedin/draft/route.ts:83-125` | A/JSON | röst, skrivregler, anatomi, compass, sanering | **T-2 (först)** |
| LinkedIn ideas | `app/api/linkedin/ideas/route.ts` | A/JSON | dito | T-2 |
| Social generate | `app/api/social/generate/route.ts:63-88` | A/JSON | skrivregler, anatomi, compass, enhetlig sanering | T-2 |
| Nyhetsbrev | `lib/newsletter.ts:31-57` | A/JSON | röst, skrivregler-i-JSON, anatomi (compass villkorat idag) | T-2 |
| Blogg Studio + repurpose | `lib/studio/blog.ts:50-79, 116-150` | A | röst, anatomi, compass; repurpose saknar sanering | T-2 |
| Studio caption | `app/api/studio/suggest-caption/route.ts:60-99` | A | röst; anatomi/compass villkorat; egen konkurrerande struktur (:65-71) ersätts av anatomiBlock | T-2 |
| Karusell | `lib/studio/carousel.ts:29-46` | A | röst; anatomi/compass villkorat; sanering saknas | T-2 |
| Kanal-anpassning | `app/api/studio/adapt-channel/route.ts:66-79` | A | röst; allt villkorat | T-2 |
| Improve-post | `app/api/studio/improve-post/route.ts` | A | röst; anatomi (egna 6 steg behålls som uppdrag, anatomin läggs till) | T-2 |
| Veckoplan klassisk | `app/api/generate/week/route.ts:85-139` | A | anatomi (WEEK_ROLES behålls som uppdragsdel) | T-2 |
| Enskilt inlägg | `app/api/generate/post/route.ts:268-347` | A | anatomi (Kane-hooks behålls i uppdrag) | T-2 |
| Fordon post-suggest | `app/api/fordon/post-suggest/route.ts` | A | anatomi, compass | T-2 |
| Studio-text (copy) | `lib/studio/copy.ts:69-148` | B | anatomi("pa-bild"), compass; dubblettstäd (profil ×2 → ×1) | **T-3** |
| Specialister | `app/api/specialist/[id]/run/route.ts:63` | B | brand-profil direkt, anatomi, compass | T-3 |
| Night-iterate | `app/api/agents/night-iterate/route.ts:92` | B | dito | T-3 |
| Reels-manus (FACIT) | `lib/studio/reels-generate.ts:56-109` | A | inget — flyttas SIST med utfallsjämförelse | T-3 |
| Compass-veckan (FACIT) | `app/api/generate/week/route.ts:222-368` | A | inget — dito | T-3 |

**Migreras INTE** (ingen kundtext → ska uttryckligen sätta `skrivregler: false` efter avsnitt 5-ändringen): content/review, content/classify, vision/transcribe-extraktion, build-image-prompt, intake-extraktion, voice-fingerprint-analysen själv, SEO-tekniska anrop. Dessa listas och stämplas i T-2:s sista commit.

**Död kod:** `components/SkapaInlaggMaker.tsx` (0 importörer) migreras inte — hanteras enligt REVISION-beslutet (borttag).

---

## 5. generateJSON-lösningen

Problemet: `generateJSON()` sätter `skrivregler: false` som default (`gemini.ts:174`) — så LinkedIn/social/nyhetsbrev tappar bl.a. "exakt EN CTA".

**Lösning i tre delar:**
1. `generateJSON()` slutar defaulta till `false`. Samma default som `generate()`: skrivregler PÅ när `systemInstruction` finns. Rena klassnings-/extraktionsanrop (listan ovan) sätter `skrivregler: false` **explicit** — avsiktsdeklaration i stället för tyst default.
2. Prompt-core bäddar redan in skrivreglerna i lager 8, så migrerade flöden är oberoende av gemini-defaulten (idempotensen förhindrar dubblering).
3. **Formatkravet sist:** `p.jsonSchema` renderas som `=== SVARSFORMAT (styr ENDAST formen, aldrig innehållsreglerna ovan) ===` allra sist i system. JSON-mode (`responseMimeType: application/json`) garanterar parsebar output; skrivreglerna styr texten i fälten. Det är exakt så Compass-veckan redan kör (skrivregler + JSON-schema samtidigt, `week/route.ts:242-279`) — bevisat fungerande, ingen formatrisk.

---

## 6. `writing_rules_enabled` — enhetlig regel

I dag styr flaggan bara saneringen; promptblocket läggs alltid in (`writing-rules.ts:125` vs `gemini.ts:38-43`). **Beslut:** flaggan styr regel 1–4 i BÅDA lagren — prompt-core hoppar lager 8 och `saneraText()` hoppar tankstreck/hashtag-städ när flaggan är av. **Undantag:** `taBortFloskler()` (förbjudna AI-ord: kraftfull, banbrytande, game-changer…) körs ALLTID — det är plattformens kvalitetsgolv, inte en tenant-preferens. Fail-open som idag: DB-fel → reglerna på.

`saneraText()` i prompt-core blir enda saneringsingången: `skrivreglerPa()` + `sanitizeGenerated()` + floskelgolvet, samma villkor i alla flöden (punkt 7 i beställningen). `lib/publish/index.ts:53-60` (sanering före publicering) behålls orörd som sista skyddsnät.

---

## 7. Risker och regressionstest

### Risker

1. **Anatomi × affischtext** — löst med `pa-bild`-varianten (avsnitt 2). Utan den hade Studio-text fått CTA-krav som captionen redan bär. Störst enskild risk, därför eget planbeslut.
2. **Facit-flödena får dubbla lager** — Reels/Compass-veckan bygger redan compass själva. De migreras SIST (T-3) med före/efter-jämförelse; DoD är "likvärdig eller bättre".
3. **Mer röstkontext kan trumfa flödesregler** — 4 råa exempel + winning examples väger tungt; om klientens gamla inlägg alltid slutar med dubbel-CTA kan modellen härma det. Motmedel: skrivreglerna ligger EFTER rösten (lager 8 > lager 4) + automatisk CTA-räkning i testbatchen.
4. **Nyhetsbrev/blogg-strukturkrock** — anatomin mappas explicit (avsnitt 2) i stället för att läggas rakt på.
5. **Token-kostnad upp för tidigare tunna flöden** (LinkedIn: från ~2 k till ~5 k tokens system). Medveten och beställd; fingerprint-cachen håller latensen nere.
6. **`getProfileAsMarkdown`-flaggan** rör en funktion med många anropare — default oförändrad, bara prompt-core använder nya flaggan; ripple-check i T-1.
7. **Blindtest-jämförbarhet** — före-batchen MÅSTE köras innan T-1 ändrar en enda rad (se nedan), annars finns inget "före".

### Regressionstest (T-0 sparar före-batchen, T-4 mäter)

- **Skript:** `scripts/text1-batch.mjs` — anropar flödenas lib-funktioner/API-routes direkt med service-nycklar ur `.shared-keys.env`/`.env.local`. Körs INTE i CI, bara lokalt.
- **Matris:** 4 klientprofiler (DT, Engens Träd, HM Motor, Annas Blommor) × 9 flöden (linkedin, social, nyhetsbrev, blogg, caption, karusell, veckoplan, enskilt, studio-text) × 5 fasta ämnen per flöde = **180 texter**. Ämneslistan låses i `docs/text1/amnen.json`.
- **Före-batch:** körs direkt efter att denna plan godkänts, FÖRE T-1 påbörjas → `docs/text1/fore/{profil}/{flode}.json`. (Reels + Compass-veckan ingår som facit-referens.)
- **Automatiska kontroller per text** (skrivs till samma JSON): `raknaCta() === 1` · `!harSvagHook()` · inga ord ur fingerprint.forbidden_words eller floskellistan · tankstrecksregeln · hashtag-tak per kanal · röstmarkör-närvaro (andel signature_phrases/joy/pain-ord som förekommer).
- **Efter-batch (T-4):** samma matris, samma ämnen → `docs/text1/efter/`, sida-vid-sida i `TEXT1-RESULTAT.md` + Håkans blindbedömning (ribban 7/10 nivå 1–2 per profil).
- Kostnad: ~360 genereringar totalt (före+efter) ≈ enstaka tiokronor i API-kostnad. Ingen publicering, inga skrivningar till tenant-data.

---

## 8. Teststrategi T-1 (DoD: enhetstester på kärnan)

Repot saknar testrunner. Förslag: **vitest** som devDependency (standard i Next/TS-ekosystemet, noll config för ren TS-logik). `tests/prompt-core.test.ts` verifierar per syfte: alla obligatoriska lager närvarande i `system` (via blockmarkörerna), rätt ordning (indexjämförelse), `pa-bild`-varianten CTA-fri, JSON-schema sist, exakt EN förekomst av `GLOBALA SKRIVREGLER`/`KUNDENS RÖST`/brand-profil-rubriken (dubblettvakt), compass-default per syfte, flaggan av → lager 8 borta men floskelgolv kvar i `saneraText`. DB-anrop mockas (fingerprint/profil som fixtures).

---

## 9. Etappordning (bekräftelse)

- **T-1:** prompt-core + anatomi-frikoppling + gemini/iterate-ändringarna + enhetstester. Inga flöden migreras än — noll beteendeförändring för produktion (nya kärnan är oanvänd tills T-2).
- **T-2:** Stack A svagast-först enligt tabellen, en commit per flöde.
- **T-3:** Stack B + facit-flödena sist + städning av lokala promptkonstanter. DoD: grep visar ingen promptbyggnad utanför prompt-core (kontrollgrep: `fingerprintToPromptBlock|contentCompassBlock|WRITING_RULES_BLOCK` får bara träffa prompt-core, writing-rules, gemini/iterate-skyddsnäten).
- **T-4:** efter-batch + `TEXT1-RESULTAT.md` + blindbedömning.

## 10. Beslut som behöver Håkans OK (utöver planen som helhet)

1. **`pa-bild`-anatomin** för studio-text (ingen CTA i bildtext, captionen bär den) — ja/nej?
2. **Compass-default-tabellen** i avsnitt 3 (särskilt: aldrig BOFU som default) — ok?
3. **Floskelgolvet alltid på** även när `writing_rules_enabled` är av — ok?
4. **Vitest** läggs till som devDependency för T-1:s enhetstester — ok?
5. **Före-batchen körs direkt efter godkännande** (180 genereringar mot skarpa klientprofiler, ~tiokronor, inga skrivningar) — ok?
