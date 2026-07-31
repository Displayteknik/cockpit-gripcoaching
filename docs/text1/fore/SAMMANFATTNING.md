# TEXT-1 FÖRE-BATCH — sammanfattning

Genererad 2026-07-31T15:13:29.482Z mot **dagens kod** (före promptmigreringen). Detta är mätvärden att jämföra efter-batchen (T-4) mot — inte en kvalitetsbedömning i sig.

## Resultat per profil × flöde (lyckade/körda)

| Profil | studio-text | caption | karusell | linkedin | social | nyhetsbrev | blogg | veckoplan | enskilt |
|---|---|---|---|---|---|---|---|---|---|
| Displayteknik | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 |
| Engens Träd & Trädgård | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 |
| HM Motor Krokom | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 |
| Annas Blommor | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 |

**Totalt: 180 lyckade, 0 misslyckade av 180 genereringar.**

## Snitt-autochecks per flöde (alla profiler)

| Flöde | CTA-ord (snitt) | Svag hook | Förbjudna ord (snitt) | Floskler (snitt) | Tankstreck i löptext | Hashtags (snitt) | Röstmarkör-träff |
|---|---|---|---|---|---|---|---|
| studio-text | 0.0 | 0 % | 0.10 | 0.00 | 20 % | 0.0 | 3 % |
| caption | 0.5 | 5 % | 0.15 | 0.00 | 0 % | 4.3 | 18 % |
| karusell | 0.7 | 0 % | 0.10 | 0.00 | 25 % | 0.0 | 16 % |
| linkedin | 0.3 | 5 % | 0.15 | 0.15 | 40 % | 3.5 | 26 % |
| social | 0.6 | 5 % | 0.10 | 0.00 | 50 % | 10.0 | 22 % |
| nyhetsbrev | 0.1 | 0 % | 0.45 | 0.15 | 40 % | 0.0 | 13 % |
| blogg | 1.7 | 0 % | 1.45 | 0.70 | 60 % | 0.1 | 33 % |
| veckoplan | 3.6 | 0 % | 0.50 | 0.00 | 0 % | 24.9 | 30 % |
| enskilt | 0.6 | 0 % | 0.05 | 0.00 | 0 % | 5.0 | 19 % |

Anm: "CTA-ord" räknas med `raknaCta` (grov heuristik — flera träffar betyder inte alltid flera uppmaningar). "Röstmarkör-träff" = andel av klientens signature_phrases + pain_words + joy_words (ur `client_voice_profile`) som förekommer i texten. För JSON-flöden (linkedin, social, nyhetsbrev, veckoplan, enskilt) kördes autochecks på den sammanfogade kundtexten; för blogg på titel + avtaggad HTML; för enskilt på bästa varianten.

## Skippade flöden

Inga. Alla 9 flöden gick att köra utan kodändringar: lib-flöden (studio-text, karusell, nyhetsbrev, blogg) anropades direkt med explicit clientId; route-flöden (caption, linkedin, social, veckoplan, enskilt) anropades via importerad POST-handler med syntetisk Request. Session-beroendet (`cookies()`/`headers()`) löstes med en shim för `next/headers` (endast i batch-skriptets tsconfig — produktionskoden orörd) som bar en riktig HMAC-signerad admin-session + `active_client_id` per profil.

## Raderade bieffektsrader (tenant-datan orörd)

- linkedin_posts: 20 raderade (linkedin-flödets utkast) — kvar efter verifiering: 0. Ids: 93331dc4-d1a3-4f2d-89db-52a5b6f65997, 0c0fde0d-cf1a-484e-a575-683c6f5b57c2, ba6b7377-8069-4249-9276-bd28f5d3058a, 7e49bfc3-30e7-4e2b-9586-d6ff98175456, ba1d6f07-950c-42d8-b811-a99168a3ef9a, 73f07871-7ec3-4d2d-9f04-6a68d4a67520, 9be96dd7-db32-448c-a22d-0aff0e01392d, d16df2ea-5c45-41b9-bd18-9e06d42e999d, e3052b34-26d7-4e5a-9cb7-013069210a19, 7d574a1a-bd60-4499-95d9-dc67d0919c64, ff6c6549-f7ea-4dd9-b715-c651fa96b540, 0a238151-c4cf-4457-bb0e-93ae6506da0b, fbfc84d7-e400-4fbc-b466-2fd628d58d88, d8a033fc-2f00-4b8c-a927-9d416e373c95, 063558ed-a8a1-4d56-ae54-89f1dd75f2dc, b8f8a167-fa69-4665-b986-0efa80c4f9de, fa4c5b38-941c-4e0e-85b1-eab823b2d81c, fdd151e7-d736-4d65-bd43-39a19711aec1, 373f2a24-47cc-4942-9154-4e610511599d, 1a185fd4-174c-454f-a913-227857977058
- hm_social_posts: 20 raderade (social-flödets utkast) — kvar efter verifiering: 0. Ids: 7b298790-41d4-4c45-b6dd-4aa63a4ba640, b88c2a67-e14a-4039-ba6f-a61f8f3b230d, eeaa4113-ae58-4a87-aab9-633323927b7d, 1b66a8de-8bb2-4fbe-8c26-aecece55a58d, 1d5e5548-73d0-4ebe-b2c7-622f1f943bda, 854ce6cb-c27e-449f-a36e-f73234ee524e, 674ad25f-1653-4e7c-9e0a-569386c165ca, d79ce8a9-cb62-4ff0-94f8-e36a9e37054d, 5a04a39e-6ebe-453e-b8ba-5405eec0e431, 543e7b66-397e-4b28-9952-497c93c2589e, 57a8e0cd-3a83-4860-a9f1-649579be951d, 2d6c9d5f-c0c7-4604-a97b-1837728db4f8, 0e267965-7a7b-491b-b0a0-dc96a886dde1, ae42b40f-53b7-4f4f-a92a-51f444637292, 146162b1-93dd-43d9-bd5b-b3e8e1a04687, b3ec638b-9b96-41d0-96f4-cee8f775f2b4, 91d9f940-244c-406f-af0f-5f0364b4cb1c, cc5b11f7-bb2e-42aa-ba47-85519152a34b, 19ac6aa6-1831-4f76-b616-2d0e6d02c385, f2e53363-3118-48d4-9a65-21df015aeda1
- agent_experiments: 0 raderade (iterateGenerate-loggar under körningen) — kvar efter verifiering: 0. Ids: -
- client_activity: 40 raderade (logActivity under körningen) — kvar efter verifiering: 0. Ids: 01b808ce-87c4-46a7-850f-1e59f9a989f2, d00fff35-150f-461f-9c50-a16bdf01ccd5, d2e3ed5d-aabb-4222-8aab-3ce98db83120, 1f547f73-e732-47b1-8eda-79f3529a638a, d4ecefb2-5db8-41f9-b66a-f0ba615b7a08, 0c0fa0c6-3ccd-4996-9d9c-4d8b396f4e39, be9317e5-6a00-4ecb-a9c2-cea654a2dd98, 2f917c01-880c-46fb-b200-dc2d0cf028f7, 4d5a60f0-276e-4270-b293-358150394228, b988e930-b981-4591-b469-2efa0528bbf7, 9c7dd3e4-b0de-4253-9da0-8f56378259ac, 25efae07-5161-4b31-b892-680ca859be8c, 1ccd7373-8720-4857-97dd-cdc882134234, bd693b6d-4162-431a-878b-e66320f57757, 99bdd3f6-845e-43c6-9812-6494672cba0e, a98db5ac-3079-4977-b796-20bb9a782ea7, a85e1af2-b578-4070-8095-f89ac6f21b11, 0c755d6d-02a7-4d80-93e7-faa390ec1878, ad48eea7-d25a-443b-ad1c-39283db50db6, 9b026c4c-8667-431c-9515-71e6474737b5, d11e415d-8e93-4754-9c8c-9ccd0c07cec1, ecf3b640-e9a7-4a2c-b266-cc227798f72c, 024fd88c-c3f9-4af6-923d-239f5b15fae9, ef76f118-0233-4c69-8689-171303d16284, 649d5f9f-0333-4203-b8e7-830c6f5ee3c4, aa4e6c65-8429-4911-add6-498cc28d6301, 3c6578f3-0fd5-4358-b971-952e8cdcbfa7, 042c281e-178d-4c6d-98b6-8a6dbe62cf0d, 099eba84-2bdf-4daa-a42b-a8afe956eda3, fb38751e-0799-4610-a92c-f05ea17e24a5, 8ebff1d1-b730-4f94-bc69-1ccb29f3a428, 95a4445c-c7fd-4034-9bc8-7b0ada1a0cda, ea7f8d00-1ad9-4b13-9e2c-ae86c551083d, ef6d0208-4edd-41fa-9863-62aa8fca9d62, c4932cb2-7e3c-417a-8216-46240b4a4214, 5cea7e3c-5c2b-4c4c-89c5-44121ecfd225, 735f0e65-a15f-4c05-aa64-5b74f6732ccd, b26275c2-ccaa-40c4-8e15-1fdbebb912c2, 0cd68392-04b3-4a81-9022-98c7b96e938e, 846a7aac-f4d4-49e9-b5f5-189a3574ad03
- studio_posts: 0 nya rader under körningen (förväntat 0)
- client_voice_profile: a6a33547-5ca7-475f-9a62-43ff2c74d000 ombyggd under körningen → återställd till snapshot

## Kostnad & körtid

- Total körtid: **24 min 30 s** (summerad generering 40 min 1 s över parallella anrop)
- Utdata: 488 711 tecken ≈ **122 178 utdata-tokens** (grov uppskattning, tecken/4 — flödena exponerar inte usage-metadata)
- Modellmix enligt flödenas egna val: Anthropic claude-sonnet-4-5 (studio-text, 7 varianter/generering), gemini-2.5-pro (linkedin, social, nyhetsbrev, blogg, veckoplan, enskilt), gemini-2.5-flash (caption, karusell)

## Var filerna ligger

`docs/text1/fore/{profilslug}/{flode}.json` — profilsluggar: displayteknik, engens-trad, hm-motor, annas-blommor.

## Misslyckade genereringar

Inga.

## Komplettering 2026-07-31 em

De 15 studio-text-luckorna är fyllda: körda från en git-worktree pinnad på `186c12b` (T-2-koden — studio-text-vägen orörd fram till T-3), efter kreditpåfyllning. Före-batchen är därmed KOMPLETT: 180/180. Bieffekter (15 agent_experiments-rader) raderade och verifierade.
