# TEXT-1 FÖRE-BATCH — sammanfattning

Genererad 2026-07-31T06:24:23.248Z mot **dagens kod** (före promptmigreringen). Detta är mätvärden att jämföra efter-batchen (T-4) mot — inte en kvalitetsbedömning i sig.

## Resultat per profil × flöde (lyckade/körda)

| Profil | studio-text | caption | karusell | linkedin | social | nyhetsbrev | blogg | veckoplan | enskilt |
|---|---|---|---|---|---|---|---|---|---|
| Displayteknik | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 |
| Engens Träd & Trädgård | 0/5 (5 fel) | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 |
| HM Motor Krokom | 0/5 (5 fel) | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 |
| Annas Blommor | 0/5 (5 fel) | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 |

**Totalt: 165 lyckade, 15 misslyckade av 180 genereringar.**

## Snitt-autochecks per flöde (alla profiler)

| Flöde | CTA-ord (snitt) | Svag hook | Förbjudna ord (snitt) | Floskler (snitt) | Tankstreck i löptext | Hashtags (snitt) | Röstmarkör-träff |
|---|---|---|---|---|---|---|---|
| studio-text | 0.0 | 0 % | 0.40 | 0.00 | 40 % | 0.0 | 2 % |
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

- linkedin_posts: 20 raderade (linkedin-flödets utkast) — kvar efter verifiering: 0. Ids: 9e515b87-72f8-402e-bbf0-272bfff03793, b4aa08bf-3fa3-4a6f-b044-68d97042c719, 40ba1604-0333-4845-830a-0fd9c29d9c77, 22121bfc-af59-47ae-9134-3418bec86eea, ecabba64-2b6b-4f7f-a466-cbc733431198, 76ede4b6-c226-44fd-a241-f319500d4474, 73b0ab97-d50f-4700-bce1-42cf85921032, 09eeb68c-3783-4095-8b4e-9533f3885806, 2afb5a98-b86f-4578-b388-5a0f5cd5ef92, e6fba00a-7ef7-400f-98e0-9c495814c0b8, 250b49ac-ff44-400e-b7a7-7cad80d8ab4d, c49ff990-a104-4658-9193-b8f1aab6710d, 5b614e25-a552-43a9-8488-61b6a96a56cf, d3d70f9b-a145-44e0-b81f-8818f4005b9c, 6235b77c-fb27-434b-a6dd-c3bd5a8f40f0, b8b85a1d-4133-4ba0-bfa2-c0e27a036efc, 2f7bd354-7f52-4882-bc88-e17a1808b624, da6c2338-558d-4ec0-a5d8-b90d7f9d4f18, e481db90-b81a-4a34-9b7f-1ce010d649c6, 82d493e2-7a28-4a6a-b854-f031f50989a7
- hm_social_posts: 20 raderade (social-flödets utkast) — kvar efter verifiering: 0. Ids: b465cb93-358e-4e92-aa6d-7e6c886a550e, d8ec46e7-d5e8-4d53-8ee4-b86ba0261b9a, b219aa5e-d4f7-44c8-8376-7c439429dc1f, 186dceea-6ec9-432b-84e3-94a555904ab7, 4f00b9c7-8d52-4af9-af66-fcc7916ee13c, 36257551-c31d-4524-b839-5824a00c63f6, 2ef46419-de04-479c-91df-36a48d579131, 9cac2154-7781-4eb7-9bfc-6789e533c3fd, a5455435-3685-4751-9749-69a28dfa6457, d2048bb8-2f85-4b7c-aa9e-b713648e2943, 8bd36046-8ece-4470-9ff4-4fdba3b8f1c0, fcffc86a-4d01-4914-b43b-93b2f6d6392e, f9bd166e-9da0-4d89-9adf-4aab0bc46ee0, 6c96eb0f-7b75-4123-8bb2-5d8dc6957a0e, 1a56f884-35a4-45fd-8a7b-e3dfb5018092, b84a591a-726c-4609-9a5c-bfb9711de0a0, d3183df7-232b-4dc1-80c4-7f416de213e2, 2b34747d-f0ad-4a92-9c90-09d0a703265c, 0c49f4d7-85ea-446f-b3c2-6f986ed2c7a7, 7878782c-3ec1-4ef5-aa64-bbd85d60b164
- agent_experiments: 5 raderade (iterateGenerate-loggar under körningen) — kvar efter verifiering: 0. Ids: 732ce438-a907-473b-9e52-242bdd64229d, efeac134-a6cf-47ea-8860-708b7e7d7dc1, 98397c93-3ce0-4c4c-aa69-5c994b9414ba, 4e08d713-82ae-406b-9c61-76ebc74a3926, 10b3453c-ffaf-4b04-b7c7-3dd8811e29f4
- client_activity: 40 raderade (logActivity under körningen) — kvar efter verifiering: 0. Ids: ef049a66-474a-4719-af64-36e2eca5b7df, a610062b-d2b2-4a6d-9381-ab00e6f480c6, 79ee3555-ab19-40f9-af72-a76731daf0e6, 9c17920a-2e35-482f-a7b1-73ea410c6954, b5c6ed07-8d7f-405b-a427-c11ec08577c1, 4bbaa728-819c-4792-9f0b-ca46bef02851, 0e72c5d9-1196-4686-890c-fc32f4e1188e, d2f1716c-5a49-4295-b65b-ed0aa811d684, 1f89547a-47be-4427-9a4e-9a87172901f6, 11a4fe26-9bfb-4168-867d-7a58f6766a3b, f1e9560a-bb32-4c46-8f2e-8995d247491b, 961b8ffc-c582-4229-ba88-577340c01920, 90afbde5-9d88-4198-802b-3de401038949, 9e92ed9b-0060-4397-ab33-2903d5cee661, c4b0039c-0010-40e1-9d0c-aef66d0cc078, d8fedfb5-c635-4ea9-963e-b34392ac8938, 8ba465ab-8b14-400b-8ff4-f06f0210ca6e, 4ba2fe63-774e-4e97-825b-5be20a6cee40, 9cefc0b1-ee7f-44e9-80dd-b365660891d1, 50dd117c-dfdd-4233-b0b8-36b4a7427962, a707f8ca-5ff4-436b-852b-47edb6a2deaa, c42388ad-fb9d-461c-891e-6351cca2c9cc, 90e2455e-8291-4bac-a321-5001ce201d21, d193f9fb-b557-4ca9-b8b6-ae27733690a0, e4a14038-78af-4970-870f-e3912d887653, b0f2b93d-5900-4f9c-9f42-112fd2c13558, 16091046-48da-4efb-afc7-fed89974ad23, 4796f5e1-bfc3-4c9b-99f5-2c811b4c2c02, ebba6288-75f7-4976-91cb-84ecda82c9b8, e7c01135-1435-4391-9113-9a3e0eef0e6b, 9ca9e05e-34cf-464f-bb3d-cdba6099f61a, 27cddf30-9f60-4da9-ad31-646dfe495aa5, da7baa8f-3ed2-402a-a7a0-0011e12c9e3d, 92e59f61-945d-42e6-bea5-787934beb290, a44a68fe-9d0e-4318-9146-1d7fa9eba6b5, bcdcbdc6-431f-4512-a839-9d483c0bb7d3, 88594294-7d08-4e8f-8ae6-7c392a624bf7, b74f3ed6-eae1-42fb-bfef-4de14ca0db50, 62475167-5e82-4e22-896e-fa740bcd09f9, 0065234a-a1d5-4206-847b-4503e0acb517
- studio_posts: 0 nya rader under körningen (förväntat 0)
- client_voice_profile: 00000000-0000-0000-0000-000000000001 ombyggd under körningen → återställd till snapshot
- client_voice_profile: a6a33547-5ca7-475f-9a62-43ff2c74d000 ombyggd under körningen → återställd till snapshot

## Kostnad & körtid

- Total körtid: **27 min 44 s** (summerad generering 42 min 14 s över parallella anrop)
- Utdata: 472 197 tecken ≈ **118 049 utdata-tokens** (grov uppskattning, tecken/4 — flödena exponerar inte usage-metadata)
- Modellmix enligt flödenas egna val: Anthropic claude-sonnet-4-5 (studio-text, 7 varianter/generering), gemini-2.5-pro (linkedin, social, nyhetsbrev, blogg, veckoplan, enskilt), gemini-2.5-flash (caption, karusell)

## Var filerna ligger

`docs/text1/fore/{profilslug}/{flode}.json` — profilsluggar: displayteknik, engens-trad, hm-motor, annas-blommor.

## Misslyckade genereringar

- engens-trad × studio-text × misstag: Inga varianter genererades
- engens-trad × studio-text × bakom-kulisserna: Inga varianter genererades
- engens-trad × studio-text × tre-fragor: Inga varianter genererades
- engens-trad × studio-text × tvekade: Inga varianter genererades
- engens-trad × studio-text × billigaste: Inga varianter genererades
- hm-motor × studio-text × misstag: Inga varianter genererades
- hm-motor × studio-text × bakom-kulisserna: Inga varianter genererades
- hm-motor × studio-text × tre-fragor: Inga varianter genererades
- hm-motor × studio-text × tvekade: Inga varianter genererades
- hm-motor × studio-text × billigaste: Inga varianter genererades
- annas-blommor × studio-text × misstag: Inga varianter genererades
- annas-blommor × studio-text × bakom-kulisserna: Inga varianter genererades
- annas-blommor × studio-text × tre-fragor: Inga varianter genererades
- annas-blommor × studio-text × tvekade: Inga varianter genererades
- annas-blommor × studio-text × billigaste: Inga varianter genererades

## Kända luckor (fylls före T-3)

De 15 felen (studio-text × Engens Träd, HM Motor, Annas Blommor) har EN rotorsak, verifierad med direktanrop mot Anthropic API: **kreditsaldot är slut** ("Your credit balance is too low to access the Anthropic API", HTTP 400). Displayteknik-profilens 35 Sonnet-anrop förbrukade de sista krediterna. Åtgärd: Håkan fyller på krediter i Anthropic Console (Plans & Billing), därefter körs `npx tsx --tsconfig scripts/text1/tsconfig.json scripts/text1-rerun-studio-text.mts` som fyller exakt dessa 15 luckor. Giltigt som "före"-mätning så länge T-3 (Stack B-migreringen) inte påbörjats — T-1 och T-2 rör inte studio-text-vägen.
