# Cockpits meny — så är den byggd idag, och varför den känns rörig

Skriven 2026-08-18 på Håkans fråga: *"kan du skriva ner hur rubriken är uppbyggd, vad varje
del gör?"* Allt nedan är läst ur `app/dashboard/layout.tsx`, inget är antaget.

## Uppbyggnaden — tre nivåer

```
ZON            (3 st)   fet, versal rubrik + en grå förklaringsrad
 └─ SEKTION    (8 st)   liten grå versalrubrik
     └─ POST   (~50)    ikon + text, den blå markeringen visar var du står
```

**Zonen svarar på: vems är den här sidan?**

| Zon | Rubrik i menyn | Betyder |
|---|---|---|
| `eget` | **Ditt eget** | Bara du. Byter inte när du växlar kund i väljaren högst upp. |
| `byra` | **Om valda kunden: `<kundnamn>`** | Ditt arbete med kunden. Kunden ser inte det här. |
| `kundens` | **Kundens egna ytor** | Samma innehåll som kunden själv når i sin portal (`/k/...`). Ändrar du här ser kunden det. |

Regeln som avgör zon 3: posten har en `kundHref` och sidan finns på riktigt under `app/k/`.
Saknas motsvarigheten hör posten i zon 2.

**Sektionen svarar på: vilken sorts sida?** Åtta stycken, och det är här logiken spricker.

| Zon | Sektion | Poster | Vad den egentligen samlar |
|---|---|---|---|
| Ditt eget | Din vecka | 6 | Founder HQ, På G, Planering, Uppstart, Vem har bollen, Städa pipelinen |
| Ditt eget | Agency | 7 | Pionjärer, två sorters onboarding, betalning, AI-kostnad, kvalitet, inställningar |
| Ditt eget | DT special | 5 | Produkter, prislista, inläsning, kalkylator, priscoach — bara Displayteknik |
| Ditt eget | Verktyg | 6 | Setup-agent, specialister, SMS, Reels (test), Webbdata (demo), Handbok |
| Om kunden | Läget | 6 | Översikt, Nya leads, Godkännanden, Veckorapport, Paket, Kund-access |
| Om kunden | Underlag och sajt | 6–8 | Konkurrenter, analysator, Navet, Mejl, Sidor, Blogg-arkiv (+ Fordon/Verk) |
| Kundens | Skapa och publicera | 10 | Grafisk profil, Studio, Blogg, Kalender, LinkedIn, Nyhetsbrev, Idé-bank, DM & pipeline, Kunder, Veckoplan |
| Kundens | Kundens dag | 5 | Brand-profil, Fokus idag, Offerter, SEO & AEO, Ikigai |

## Det verkliga felet: menyn är sorterad efter ÄGARE, inte efter ARBETE

Zonindelningen svarar på *vems sidan är*. Men när du sätter dig på morgonen frågar du dig
inte "vems sida är det här" — du frågar *"vad ska jag göra?"*.

Ta en enda arbetsuppgift: **sälja.** Så här ligger den utspridd idag:

| Sida | Ligger i |
|---|---|
| På G | Ditt eget → Din vecka |
| Vem har bollen | Ditt eget → Din vecka |
| Städa pipelinen | Ditt eget → Din vecka |
| Nya leads | Om kunden → Läget |
| Fokus idag | Kundens → Kundens dag |
| Offerter | Kundens → Kundens dag |
| DM & pipeline | Kundens → Skapa och publicera |
| Kunder | Kundens → Skapa och publicera |

**Åtta menyrader, tre zoner, fyra sektioner — för ETT jobb.** Och alla åtta leder förr eller
senare till samma affärskort. Det är inte konstigt att det känns som att leta.

Samma sak med att skapa innehåll: Studio, Blogg, Kalender, LinkedIn, Nyhetsbrev, Idé-bank,
Veckoplan och Grafisk profil är åtta rader för ett arbetspass.

Och samma namn dyker upp två gånger med olika betydelse: **"Brand-profil"** (Kundens dag) och
**"Grafisk profil"** (Skapa och publicera) — plus **"Blogg"** respektive **"Blogg-arkiv"**.

## Vad som ändrades 18/8

Sektionerna är nu **fällbara**, och bara den sektion du står i är öppen. 50 synliga rader blev
cirka 10. Valet sparas per webbläsare. Det är en plåsterlösning på symptomet — strukturen
under är oförändrad.

## Förslaget: sortera efter jobb, inte efter ägare

Sex ingångar i stället för åtta sektioner och femtio rader. Underytorna blir **flikar inne på
sidan**, inte egna menyrader — samma mönster som Fokus idag redan använder.

| Ny meny | Flikar inuti | Ersätter |
|---|---|---|
| **Sälj** | På G · Fokus idag · Nya leads · DM & pipeline · Kunder · Offerter · Vem har bollen · Städa | 8 rader i 3 zoner |
| **Skapa** | Studio · Blogg · Kalender · LinkedIn · Nyhetsbrev · Idé-bank · Veckoplan | 7 rader |
| **Kunden** | Översikt · Profil · Grafisk profil · Konkurrenter · Analysator · Godkännanden · Veckorapport · Paket · Access | 9 rader |
| **Sajt & SEO** | Sidor · Blogg-arkiv · SEO & AEO · Navet · Mejl (+ Fordon/Verk) | 5–7 rader |
| **Priser (DT)** | Produkter · Prislistan · Läs in · Kalkylator · Priscoach | 5 rader |
| **Byrån** | Pionjärer · Ny kund · Onboarding · Betalning · AI-kostnad · Kvalitet · Inställningar · Verktyg · Handbok | 13 rader |

Zonlogiken försvinner inte — den blir en **markering på fliken** ("kunden ser det här") i
stället för tre rubriker man måste läsa och komma ihåg.

Founder HQ blir kvar högst upp som egen ingång: det är kommandobryggan, inte ett arbetspass.
