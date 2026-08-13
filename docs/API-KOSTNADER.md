# API:er, konton och kostnader

> **Mätt, inte uppskattat.** Alla siffror kommer ur `ai_pricing` och `ai_usage_events` i den
> delade databasen, hämtade 2026-08-13. Levande vy: `/dashboard/kostnader`.
> Inga nyckelvärden står i den här filen — bara namnen och var de bor.

---

## Kort läge

| | |
|---|---|
| **Total AI-kostnad, 30 dagar** | **372 kr** |
| Anthropic | 294 kr (79 %) på 894 anrop |
| Google Gemini | 78 kr (21 %) på 848 anrop |
| Övrigt (Resend, PageSpeed, Pexels) | 0 kr |

Anthropic är **fyra gånger dyrare per anrop** än Gemini. Det är inte ett fel — de används
till olika saker — men det är därför nästan hela notan ligger där.

---

## Konton och var du betalar

| Tjänst | Typ | Saldo | Betalning |
|---|---|---|---|
| **Anthropic** | Förbetalt | Följs **inte** automatiskt | [console.anthropic.com/settings/billing](https://console.anthropic.com/settings/billing) |
| **Google Cloud** (Gemini, PageSpeed) | Efterskott | Faktura | [console.cloud.google.com/billing](https://console.cloud.google.com/billing) |
| **Fal.ai** (bildmodell FLUX) | Förbetalt | 9,57 USD | [fal.ai/dashboard/billing](https://fal.ai/dashboard/billing) |
| **46elks** (SMS) | Förbetalt | 48,16 SEK | [dashboard.46elks.com](https://dashboard.46elks.com/) |
| **Resend** (mejl) | Efterskott | Gratisnivå | [resend.com/settings/billing](https://resend.com/settings/billing) |

### ⚠ Anthropic-saldot följs inte automatiskt

Fal.ai och 46elks hämtar sitt saldo via API. Anthropic gör det **inte** — fältet är satt till
"manuellt" och står tomt. Därför kunde saldot gå till noll 13/8 utan att något larmade, och
felet syntes först när en kund tryckte på en knapp.

**Åtgärd:** slå på **auto reload** på Anthropics billing-sida. Det är enda skyddet i dag.

### Organisationer hos Anthropic — lätt att blanda ihop

| | |
|---|---|
| Claude-appen (Max-prenumerationen) | `38c0e7e8-df94-49f8-9c68-3cdbdc82e343` |
| **API-organisationen** (Displayteknik) | `7f6e7ea8-ea9b-4dd6-a391-b5aab487fc39` |

Två olika system, båda dina. **Max-prenumerationen betalar inte för API:et.** Cockpit
använder API:et, som har egen plånbok. Nyckeln heter `dt-vivid` i konsolen men används av
fyra projekt — namnet är missvisande.

---

## Prislista

Priserna ligger i tabellen `ai_pricing` och går att ändra **utan deploy**. Alla i USD per
miljon tokens, omräknat med kurs 10,5.

### Textmodeller

| Modell | In (USD/M) | Ut (USD/M) | In (kr/M) | Ut (kr/M) |
|---|---|---|---|---|
| `claude-fable-5` | 10,00 | 50,00 | 105 | 525 |
| `claude-sonnet-4-5` | 3,00 | 15,00 | 31,50 | 157,50 |
| `claude-sonnet-4-6` | 3,00 | 15,00 | 31,50 | 157,50 |
| `claude-haiku-4-5` | 1,00 | 5,00 | 10,50 | 52,50 |
| `gemini-2.5-pro` | 1,25 | 10,00 | 13,13 | 105 |
| `gemini-2.5-flash` | 0,30 | 2,50 | 3,15 | 26,25 |

**Fable 5 är 3,3 gånger dyrare än sonnet.** Bara offertmotorn kör den.
**Gemini flash är 10 gånger billigare än sonnet** på ingående text.

### Bilder och media

| Modell | Pris per bild | I kronor |
|---|---|---|
| `gemini-2.5-flash-image` | 0,039 USD | 0,41 kr |
| `gemini-3.1-flash-image-preview` | 0,039 USD | 0,41 kr |
| `fal-ai/flux/schnell` | 0,003 USD | 0,03 kr |

### Prissatta till noll (gratisnivå i dag)

`resend/send` · `google/pagespeed` · `pexels/search` · `pixabay/search` · `elks/sms`

---

## Vad som faktiskt kostar — 90 dagar

| Kostnad | Anrop | Snitt | Flöde | Leverantör |
|---|---|---|---|---|
| **222,46 kr** | 699 | 0,32 kr | **Studio: föreslå text** | Anthropic |
| **51,89 kr** | 180 | 0,29 kr | Nattloopen (★ avstängd 13/8) | Anthropic |
| **48,83 kr** | 531 | 0,09 kr | **Studio: föreslå bild** | Gemini |
| **19,58 kr** | 6 | **3,26 kr** | Djupgranskningen | Anthropic |
| 12,69 kr | 31 | 0,41 kr | Studio: redigera bild | Gemini |
| 5,16 kr | 23 | 0,22 kr | Onboarding: härled profil | Gemini |
| 3,69 kr | 131 | 0,03 kr | Studio: bildtext | Gemini |
| 1,50 kr | 10 | 0,15 kr | Veckoplan | Gemini |
| 0,84 kr | 24 | 0,04 kr | Karusell | Gemini |
| 0,76 kr | 2 | 0,38 kr | Blogginlägg | Gemini |
| under 0,70 kr | — | — | LinkedIn, reels, offert, hashtags, prata-in, DM | Gemini |

### Tre slutsatser

1. **Studio-texten är 60 % av hela notan.** 699 anrop, 222 kr. Den kör Anthropic sonnet.
   Skulle den flyttas till Gemini blir den ungefär en tiondel så dyr — men det är ett
   kvalitetsbeslut, inte ett tekniskt.
2. **Djupgranskningen är dyrast per körning: 3,26 kr.** Rimligt för det den gör, men den ska
   inte råka köras i onödan.
3. **Nattloopen kostade 52 kr/månad utan att någon bett om det.** Avstängd 13/8. Slås på med
   `NATTLOOP_PA=1` plus cron-raden i `vercel.json`.

---

## Nycklar — namn och var de bor

**Värdena står aldrig här.** Kanonisk plats: `Antigravity\.shared-keys.env`.
Lokalt per projekt: `.env.local`. I drift: Vercels miljövariabler.

| Nyckel | Går till | Delas av |
|---|---|---|
| `ANTHROPIC_API_KEY` | Anthropic | **4 projekt**: hmmotor-next, mysales-coach-pionjar, saljmaskinen, dt-vivid |
| `GEMINI_API_KEY` | **Alla** Google-API:er (Gemini, PageSpeed, Maps) | Flera |
| `FAL_KEY` | Fal.ai (FLUX-bilder) | — |
| `RESEND_API_KEY` | Resend (mejl) | — |
| `ELKS_API_USERNAME` / `ELKS_API_PASSWORD` | 46elks (SMS) | — |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Stripe (fakturering) | — |
| `PEXELS_API_KEY` / `PIXABAY_API_KEY` | Stockfoton | — |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth (GSC, GA4) | — |
| `SUPABASE_ACCESS_TOKEN` | Supabase Management (migrationer) | Alla projekt |
| `CRON_SECRET` | Skyddar cron-rutterna | — |
| `GH_DEPLOY_TOKEN` | GitHub Actions | — |

⚠ **Byter du `ANTHROPIC_API_KEY` måste alla fyra projekten få den nya**, annars slocknar de.
Ordning: skapa nyckeln → `.shared-keys.env` → varje projekts `.env.local` → Vercel →
redeploy → radera den gamla **sist**.

---

## Luckor att känna till

| Lucka | Följd |
|---|---|
| **Video saknas i `ai_pricing`** | En videogenerering loggas som **0 kr**. Kostnadstaket på 200 kr reagerar aldrig. Ingen video har körts, så inget läcker i dag — men priset måste sättas före första betalande kund |
| **SMS prissatt till 0** | 46elks kostar riktiga pengar (saldo 48 kr). Varje SMS loggas som gratis |
| **Anthropic-saldot följs inte** | Ingen förvarning när det tar slut. Det som hände 13/8 |
| **Fal.ai används inte** | 9,57 USD ligger kvar, noll anrop på 90 dagar. Bildgenereringen går via Gemini. Antingen ta i bruk eller avveckla |

---

## Var du ser det själv

- **`/dashboard/kostnader`** — levande vy per tjänst, med saldon och larm
- **`/dashboard/kvalitet`** — vad genereringarna gav, per promptversion
- Rådata: tabellen `ai_usage_events` (en rad per betalt anrop, med tokens, kostnad och fel)

Varje betalt anrop i hela plattformen går genom `lib/ai-usage.ts`. Det är enda vägen, och
det är därför den här sammanställningen går att lita på.
