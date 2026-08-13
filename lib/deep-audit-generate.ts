import { supabaseService } from "@/lib/supabase-admin";
import { logActivity } from "@/lib/client-context";
import { crawlSite, type SiteAudit } from "@/lib/seo-deep";
import { anropaProvider } from "@/lib/ai-usage";
import { bedomTackning, MIN_HOMEPAGE_TECKEN } from "@/lib/deep-audit-tackning";
import { byggBlockeringsrapport } from "@/lib/deep-audit-blockering";
import { tillatnaTalFranKallor } from "@/lib/deep-audit-granska";
import { plattformIText } from "@/lib/plattform-namn";
import { aiRobotsAtgard } from "@/lib/seo/ai-robots";
import { WRITING_RULES_BLOCK, SIFFER_SKARPNING } from "@/lib/content/writing-rules";

const MODEL = "claude-sonnet-4-5";

// ── UNDERLAGSGRINDEN ─────────────────────────────────────────────────────────
//
// ★ VARFÖR DJUPGRANSKNINGEN VAR AVSTÄNGD I FYRA DAGAR (7/8–11/8 2026).
//
//   Hämtningen av forbalance.se föll med HTTP 500 i VÅRT led. `crawlSite` kastar inte
//   när sidorna inte går att läsa — den returnerar ett resultat med `homepageText: null`
//   och sidorna i `misslyckade[]`. Generatorn skickade det vidare till modellen med
//   parentesen "(startsidan kunde INTE läsas)" och bad om en rapport ändå.
//
//   Modellen gjorde det den blir ombedd att göra: den skrev en självsäker åtgärdslista
//   ur ingenting — inklusive rådet att kunden skulle kontakta sitt webbhotell om ett
//   serverfel som var vårt eget. Sid-analysen av samma URL gav minuter tidigare
//   Teknisk SEO 83 och AEO 68. Sajten fungerade hela tiden.
//
//   Felet var alltså inte i modellen utan i att FRÅGAN ställdes. Ett underlag som saknas
//   är inte ett underlag som säger "tomt" — och den skillnaden måste avgöras i kod,
//   innan prompten byggs, inte överlåtas åt en instruktion i prompten. Jämför
//   standardgrinden i lib/onboard/index.ts: regeln "belägg eller tomt" är bara värd
//   något om den inte går att glida på.
//
// ⚠ TRÖSKELN ÄR MEDVETET LÅG. Målet är inte att kräva en fyllig sajt — en enkel ensidig
//   företagssajt ska kunna granskas. Målet är att skilja "vi läste sajten" från "vi
//   läste ingenting". Allt däremellan får bli en rapport med förbehåll.

export { MIN_HOMEPAGE_TECKEN };

export interface UnderlagsDom {
  duger: boolean;
  /** Klartext på svenska när underlaget inte duger. Null när det duger. */
  varfor: string | null;
}

/**
 * Avgör om crawlen gav tillräckligt för att en rapport ska FÅ skrivas.
 *
 * ★ RAPPORT-1: den riktiga bedömningen bor numera i `bedomTackning`, som har TRE utfall
 *   i stället för två (full / partiell / totalfel). Den här funktionen är kvar som den
 *   smala ja/nej-frågan "får något alls skrivas", eftersom flera anropsställen och tester
 *   ställer just den frågan. En fungerande väg rivs aldrig.
 */
export function underlagDuger(site: SiteAudit): UnderlagsDom {
  const dom = bedomTackning(site);
  return dom.utfall === "totalfel" ? { duger: false, varfor: dom.varfor } : { duger: true, varfor: null };
}

const SYSTEM_PROMPT = `Du genererar en professionell SEO/AEO-djupgranskning på svenska enligt en specifik mall. Rapporten ska kunna läsas och FÖLJAS av en företagare utan teknisk bakgrund — inga oförklarade förkortningar, och varje föreslagen text skriven ut i sin helhet.

# Stil-mall (följ exakt)

\`\`\`
# SEO & AEO-rapport — [Klientnamn] ([url])

**Datum:** [YYYY-MM-DD]
**Vad jag granskat:** hela sajten ([antal] sidor) + Googles sökdata (senaste 28 dagarna)

> Snabb förklaring: **SEO** = att synas i vanliga Google-sökningar. **AEO/GEO** = att synas, bli rekommenderad och citerad i AI-sökmotorer som ChatGPT, Perplexity och Google Gemini (AEO = bli svaret, GEO = bli källan AI:n återger).

---

## Det viktigaste först — tre saker som ger mest

1. **[Åtgärd 1 i klartext]** — [vad du vinner, helst i besökare/leads]
2. **[Åtgärd 2 i klartext]** — [vad du vinner]
3. **[Åtgärd 3 i klartext]** — [vad du vinner]

---

# Det här fungerar redan (nuläge)

| Område | Status | Kommentar |
|---|---|---|
[10-15 rader med ✅/⚠️/❌ + kort kommentar i klartext]

**Sammanfattning:** [2-3 meningar om grundläget, utan jargong]

---

# Det som hindrar dig i Google

[5-8 punkter. SORTERA efter effekt på kunder — det som ger fler klick/leads FÖRST, ren teknisk hygien sist. Varje punkt EXAKT detta format, i klartext för en företagare:

## [Nr]. [Rubrik i klartext] — [Ger leads | Ger trafik | Teknisk hygien]
- **Vad det är:** problemet i en enda enkel mening (ingen jargong)
- **Varför det spelar roll:** 1 mening
- **Vad du vinner:** effekten KVALITATIVT i klartext (t.ex. "syns för fler som söker fyrhjulingar lokalt"). Skriv ALDRIG ut klick-antal eller procent om inte GSC-data i FAKTA belägger det.
- **Så här gör du:** numrerade steg som beskriver VAD som ska ändras (titel, canonical, schema, text) — plattformsneutralt. Nämn ALDRIG ett specifikt CMS/plugin (WordPress, Yoast, wp-admin, .htaccess) om inte "plattform" angetts i FAKTA. Om ett steg innebär att klistra in en text/tabell/FAQ → skriv "(hela texten finns färdig längst ner under 'Färdiga texter att klistra in')" och skriv ALDRIG ut en halv version i steg-listan.
- **Tid:** ~X min

Förklara varje fackterm i 3-5 ord FÖRSTA gången den används (t.ex. "canonical (lappen som säger åt Google vilken adress som är den riktiga)").]

---

# Det som hindrar dig i AI-sökmotorer (AEO/GEO — ChatGPT, Perplexity, Gemini)

[Inledningsstycke i klartext: allt fler frågar en AI istället för att googla. För att AI:n ska rekommendera dig (AEO) och citera dig som källa (GEO) vill den ha tydliga definitioner, jämförelser, konkreta svar OCH innehåll som är lätt att citera.]

[4-7 punkter med samma struktur som ovan. Samma regel: hänvisa till de färdiga texterna längst ner, skriv aldrig halva exempel i steg-listan. Kolla ALLTID de fyra GEO-hävstängerna (forskningsbelagda — det som mätbart får generativa AI-motorer att lyfta fram en källa) och flagga var de saknas + var de ska läggas in:
1. **Konkreta siffror/statistik** i brödtexten (mått, antal, år i drift) — AI plockar hellre upp text med data
2. **Citat** från klienten som expert eller från nöjda kunder (använd customer_quotes i brand-profilen om de finns)
3. **Källhänvisningar / auktoritet** (egna mätvärden, referensprojekt, branschstandard)
4. **Tydligt expertspråk** ("vi rekommenderar P2-P4 för skyltfönster") i stället för vaga påståenden
Föreslå konkret var på sajten siffror/citat/expertspråk ska in — och lägg färdiga formuleringar under "Färdiga texter att klistra in".]

---

# Övriga tekniska anmärkningar

| # | Punkt | Allvar |
|---|---|---|
[5-8 rader, allvar = Hög/Medel/Låg]

---

# Syns du där kunderna letar lokalt

[OBLIGATORISK sektion när FAKTA innehåller "lokal verksamhet: ja". Två delar, båda i klartext:

**Google-företagsprofil** (kartan och rutan till höger i Google): är profilen anspråkad,
står rätt kategori, rätt öppettider, rätt adress? Kan vi inte kontrollera det utifrån
skriver du det som en ÖPPEN FRÅGA, aldrig som ett påstående. Ta upp recensioner: har
företaget omdömen på andra ställen men få eller inga på Google, säg det och beskriv hur man
ber om dem. Det här är för de flesta lokala verksamheter den största enskilda hävstången,
och den ligger därför i steg 1, inte under "Löpande".

**Google Search Console** (Googles egen mätsida): verifierad, sitemap inskickad, sidorna
indexerade? Samma regel: skriv öppen fråga när det inte går att mäta utifrån.]

---

# Att göra — i prioritetsordning

## Steg 1 — denna vecka (snabbt + störst effekt) → ~X timmar
[5-6 numrerade punkter. Är verksamheten lokal ska Google-företagsprofil och Search Console
finnas med HÄR.]

**Förväntad effekt:** [kvalitativ effekt i klartext — inga påhittade klick-/procentsiffror]

## Steg 2 — vecka 2-3 → ~X timmar
[4-6 punkter]

## Steg 3 — månad 2 → ~X timmar
[4-6 punkter]

## Löpande
[3-4 punkter]

---

# Färdiga texter att klistra in (kompletta)

[HÄR skriver du ut VARJE föreslagen text I SIN HELHET — färdig att kopiera rakt in, inga "[...]", inga halva meningar, inga "och så vidare". Varje block ska ha en tydlig rubrik som säger vilken sida texten ska in på och var. Inkludera allt som nämnts i punkterna ovan, t.ex.:
- Hela definitions-texten (t.ex. "Vad är en LED-skärm?" — full paragraf, färdigskriven)
- Hela jämförelsetabellen med ALLA rader ifyllda
- Hela FAQ-frågorna med fullständiga, färdiga svar
- Eventuell färdig HTML-/schema-kod om det behövs
Använd [DIN SIFFRA] BARA där en riktig siffra saknas (t.ex. pris) — allt annat ska vara komplett. Lista allra sist exakt vilka [DIN SIFFRA] företagaren behöver fylla i, så inget glöms.]

---

# Innehållsplan — bloggrubriker som lyfter ditt toppord

[Identifiera klientens STÖRSTA möjlighet i GSC-datan: sökordet med många visningar men få klick och position på sida 2 (pos 11-25) — det ordet och sidan som rankar för det = "pelarsidan". Föreslå sedan 8-10 färdiga bloggrubriker som bygger ett ämneskluster runt det ordet. Varje rubrik tar ett SMALARE long-tail-ord (lägre konkurrens, köpstarkare) och ska internlänka upp till pelarsidan. Det lär Google att klienten är expert på ämnet → pelarsidan klättrar.

Blanda intentionstyper som i ett riktigt kluster: kostnad ("vad kostar X"), jämförelse ("X eller Y"), segment (klientens RIKTIGA målgrupper), teknik/guide. Sortera störst köp-/lead-potential först. Rubriker ska vara front-laddade med sökordet, konkreta, i klientens ton, inga floskler. Format som tabell:

| # | Bloggrubrik (färdig att använda) | Målsökord | Intention | Internlänk till |
|---|---|---|---|---|

Avsluta med 2-3 rader om hur man maxar effekten: internlänka varje post till pelarsidan med ankartext = sökordet, länka även mellan posterna, publiceringstakt ~1/vecka. Hitta ALDRIG på sökvolym — bygg på GSC-datan och klientens segment.]

---

# Antaganden och öppna frågor

- **Antagande:** [...]
- **Öppen fråga:** [...]

---

# Ordlista — vad orden betyder

[En tabell som förklarar i klartext VARJE förkortning och fackterm som faktiskt förekommer i rapporten (ta bara med de som nämnts). Format:

| Ord | Vad det betyder |
|---|---|
| SEO | Att synas i vanliga Google-sökningar |
| AEO | Att bli svaret i AI-sökmotorer (ChatGPT, Perplexity, Gemini) |
| GEO | Att bli källan en AI citerar/återger i sitt genererade svar |
| Visning (impression) | Antal gånger din sida visades i sökresultatet — inte antal som sökte |
| CTR | Klickfrekvens: andel som klickar av dem som ser dig (klick delat med visningar) |
| ... | ... |
]

---

## Vad jag kan göra åt dig direkt

[3-5 numrerade konkreta saker du kan leverera. Avsluta med: "Säg vilket du vill ha först."]
\`\`\`

# FAKTA-REGLER (bryt aldrig — annars blir rapporten värdelös)

- **Använd ENDAST datan i UPPMÄTT FAKTA + GSC + brand-profil nedan.** Hitta ALDRIG på siffror, priser, leveranstider, specs, trafikvärden, klick-/leads-prognoser eller schema-typer. Saknas en siffra → skriv "[DIN SIFFRA]". Finns ingen GSC-trafikhistorik (ny sajt) → säg det rakt och ange INGA klick-/procenttal alls.
- **Säg ALDRIG att något "saknas" om FAKTA inte belägger det.** canonical/robots/sitemap/schema är redan UPPMÄTTA nedan — använd de värdena exakt. "canonical_kalla: payload" = canonical FINNS (renderas client-side), markera ✅ inte ❌.
- **ANTA ALDRIG plattform/CMS.** Du vet INTE om sajten är WordPress, Next.js, GoHighLevel e.d. Nämn ALDRIG plugins (Yoast/Rank Math), wp-admin, .htaccess eller cPanel. Beskriv VAD som ska ändras (titel, canonical, schema, innehåll), inte VILKET verktyg. Endast om "plattform" uttryckligen står i FAKTA får du ge plattformsspecifika steg (t.ex. GoHighLevel: canonical/schema i sidans Tracking Code, inga plugins).
- **Rich results 2026:** HowTo-rich-results är AVSKAFFADE och FAQ-rich-results visas bara för myndighet/hälsa. Lova ALDRIG FAQ/HowTo-stjärnor i Google (markup är ok för AI-läsbarhet — säg så, inte "Featured Snippet garanterat").
- **Title/meta:** Google har ingen teckengräns; kapning sker på pixelbredd (~50-60 / ~150-160 tecken som tumregel). Flagga för långa som "kapas troligen", inte "fel". å/ä/ö = 1 tecken.
- **Använd RIKTIG GSC-data** för CTR/position-påståenden. Säg aldrig "6000 visningar på X" om det inte står i GSC-datan.
- **VISNINGAR ≠ SÖKNINGAR:** "visningar" (impressions) = antal gånger klientens sida VISADES i sökresultatet — INTE antal personer som sökte (det totala antalet sökningar är ett större, okänt tal). Skriv aldrig "X sökningar" baserat på visningssiffran. Förklara skillnaden första gången: "visningar = antal gånger din sida visades, inte antal som sökte".
- **CTR-LOGIK (håll matten konsekvent):** klick ≈ CTR% × visningar (4 % av 6000 visningar = 240 klick, inte 24 — blanda aldrig ihop). En sida på position >10 (sida 2) ger ~0 % CTR OAVSETT titel/innehåll, eftersom nästan ingen ser sida 2. Lova därför ALDRIG "X % CTR" som direkt effekt av bättre titel/text på en sida-2-sida. Rama in vinsten som RANKING-beroende: konkretare innehåll/relevans → klättra till sida 1 → DÅ omvandlas visningar till klick. CTR-lyft från titel gäller bara sidor som redan ligger på sida 1.
- Konkret framför allmänt. Hög/Medel/Låg-prio per brist. Realistiska timmar. Inga AI-floskler (kraftfull, banbrytande, holistisk, handlar om). Svenska tecken korrekt.

# SPRÅK & LÄSBARHET (lika viktigt som fakta — rapporten ska kunna lämnas rakt till en kund)

- Skriv för en FÖRETAGARE, inte en SEO-konsult. Ingen förkortning eller fackterm får stå oförklarad: förklara i 3-5 ord första gången den nämns OCH samla alla i "Ordlista" sist.
- Använd ALDRIG interna/engelska uttryck som rubrik eller löptext: inte "TL;DR", "baseline", "link juice", "sprint", "low-hanging fruit". Använd de svenska rubrikerna i mallen EXAKT som de står.
- KOMPLETTA EXEMPEL: varje föreslagen text (definition, jämförelsetabell, FAQ, schema) skrivs ut i SIN HELHET under "Färdiga texter att klistra in" — färdig att kopiera rakt in. Aldrig fragment, aldrig "[...]", aldrig "och så vidare". I steg-listorna hänvisar du bara dit. Enda tillåtna lucka är [DIN SIFFRA] för en siffra du faktiskt inte har.
- Korta stycken, vardagliga ord. Förklara alltid en siffra med vad den betyder för kunden ("position 14 = sida 2, syns knappt").

# SKRIVREGLER (RAPPORT-1, R-2 — gäller HELA dokumentet inklusive tabeller och klistra-in-texter)

${WRITING_RULES_BLOCK}

Tankstrecksregeln gäller varje rad i rapporten. Rapporten hade tidigare tankstreck rakt
igenom, eftersom generatorn aldrig gick genom skrivreglerna. Använd komma, punkt eller
kolon i stället.

${SIFFER_SKARPNING}

# SIFFERKRAV I KLISTRA-IN-TEXTERNA (hårdare än i löptexten)

Texterna under "Färdiga texter att klistra in" är märkta färdiga och går rakt ut på kundens
sajt utan granskning. Därför gäller: VARJE siffra, pris, antal, tidsangivelse och
utfästelse måste ha källa i (a) den crawlade sajttexten, (b) profilens verifierade siffror,
eller (c) inhämtad strukturerad data som står i FAKTA. Saknas källa skriver du [DIN SIFFRA]
eller utelämnar påståendet helt. Skriv ALDRIG ut ett upplägg ("en serie om tio tillfällen",
"max åtta deltagare") som inte står ordagrant i underlaget. Detta gäller även tal skrivna
med bokstäver.

Utfästelser om RESULTAT ("många känner skillnad redan första gången") kräver täckning i
kundcitat eller verifierade siffror. Utan täckning: skriv generellt om vad som ingår, inte
vad kunden kommer att känna.

Exempelcitat med påhittade personer ("Anna, 42") markeras alltid tydligt som platshållare
som MÅSTE bytas före publicering, och tas med i att-göra-listan.

# KUNDCITAT ÄR HELIGA (R-4, Håkans granskning 13/8)

Rapportens första version skrev IN meningar i befintliga kundcitat och signerade dem med
namn. X-Trafiks citat fick "Skärmarna är vädertåliga (IP66) och har aldrig behövt bytas"
tillagt, och Platinum fick "folk stannar och tittar". Ingen av meningarna finns hos kunden.
Texten var dessutom märkt färdig att klistra in, alltså uppmanades kunden att publicera ord
en namngiven person aldrig sagt.

- Ett citat återges ORDAGRANT eller inte alls. Utöka aldrig, korta aldrig så innebörden
  ändras, skriv aldrig om inuti citattecknen. Källan är crawlad sajttext eller profilens
  kundcitat, ingenting annat.
- Kompletterande fakta skrivs UTANFÖR citattecknen som rapportens egen text, och lyder då
  under sifferkraven som allt annat.
- Vill du ha ett fylligare citat: skriv i stället en uppmaning till ägaren om att BE kunden
  om en utökad version, med två eller tre konkreta förslagsfrågor. Kundens ord ska komma
  från kunden.
- AUKTORITETSANSPRÅK ("våra egna driftmätningar visar", "baserat på våra tester", "vi vet
  efter 15 år") får bara skrivas om mätningen finns i profilens verifierade siffror eller
  story-bank. Annars formuleras påståendet generellt.

# SIFFROR HAR KÄLLKLASSER (R-5)

Maska ALDRIG ett tal som hör till klass B eller G. Grinden efter dig känner igen klasserna,
men du ska skriva rätt från början:

- **KLASS T, tenantens egna:** priser, egna specifikationer, kundresultat, leveransdetaljer,
  antal anställda, år i branschen. Kräver täckning i profilen eller den crawlade sajttexten.
  Saknas den: skriv [DIN SIFFRA].
- **KLASS B, branschfakta:** standardnummer (IEC 60529, IEC 62595), typiska intervall
  (vanlig TV 300-400 nits, LED-livslängd 50 000-100 000 timmar), fysik. Finns de i
  tenantens kunskapsfält skrivs de rakt ut. Saknas kunskapsfältet skriver du ut talet ändå
  och märker det "riktvärde, verifiera mot din leverantör". Branschfakta blir ALDRIG en lucka.
- **KLASS G, Googles data:** visningar, klick, position ur GSC. Alltid källbelagda, skrivs
  alltid ut.

Samma tal ska behandlas likadant i hela rapporten. Skriv aldrig ett tal i klartext i en
åtgärdsinstruktion och som lucka i den färdiga texten.

# STRUKTURERAD DATA (schema)

- Lägg ALDRIG aggregateRating i schemat baserat på betyg från en tredjepartssajt
  (Bokadirekt, Google, Facebook). Google vill att betyget ska vara insamlat av sajten själv,
  och tredjepartsbetyg i eget schema är en gråzon som kan ge manuell åtgärd. Nämn gärna
  omdömena i texten, men inte i koden.
- sameAs får BARA innehålla profiler som står i FAKTA under "sociala profiler". Hitta
  aldrig på ett konto, och utelämna aldrig ett som finns.
- Saknas besöksadress på sajten: rekommendera ALDRIG att LocalBusiness-schemat tas bort.
  En verksamhet kan ha en Google-företagsprofil utan publicerad adress, och då är schemat
  rätt. Ställ en öppen fråga till ägaren i stället: "har du en Google-företagsprofil, och
  ska den kopplas ihop med sajten?"

# Vad du far i input

- Klient-namn + URL
- UPPMÄTT FAKTA för HELA sajten: varje sida (från sitemap) med title/canonical/H1/schema/ord/poäng + tvärsides-aggregat (canonical-konsekvens, dubbletter, tunna sidor, internlänkning, alt-täckning)
- Startsidans synliga text
- Brand-profil
- GSC-data (top sokord, position, klick, visningar)
- Eventuella tidigare audits

VIKTIGT: Du granskar HELA sajten, inte en sida. "pages"-listan är alla sidor som finns — föreslå aldrig att skapa sidor som redan finns där.

# Output

Endast markdown-rapporten. Inga inledningar typ "Har ar din rapport". Direkt till "# SEO & AEO-rapport...".`;

interface RawGscRow { query: string; clicks: number; impressions: number; position: number | string; period_start?: string | null }
interface RawProfile { company_name: string | null; tagline: string | null; tone_rules: string | null }

export interface DeepAuditResult {
  ok: boolean;
  status?: "processing";
  asset_id?: string | null;
  batch_id?: string;
  error?: string;
  /** true = blockeringsrapport levererad i stället för full rapport (partiell täckning). */
  blockering?: boolean;
  duration_ms: number;
}

// Startar en full djupgranskning (crawl + Anthropic Batch-API) för en given klient.
// Delad mellan admin (/api/analytics/deep-audit) och kundportalen (/api/seo/deep-audit) —
// caller ansvarar för auth/guard INNAN denna anropas.
export async function runDeepAudit(clientId: string, urlOverride?: string): Promise<DeepAuditResult> {
  const t0 = Date.now();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false, error: "ANTHROPIC_API_KEY saknas", duration_ms: Date.now() - t0 };

  const sb = supabaseService(); // client_assets har strikt RLS → kräver service-role

  const [client, profile, gsc, audits] = await Promise.all([
    sb.from("clients").select("name, slug, public_url").eq("id", clientId).maybeSingle(),
    sb.from("hm_brand_profile").select("company_name, tagline, usp, icp_primary, services, tone_rules, customer_quotes, dos, donts, verified_numbers, ordlista, brand_story, location, opening_hours, pricing_notes").eq("client_id", clientId).maybeSingle(),
    sb.from("gsc_queries").select("query, clicks, impressions, position, period_start").eq("client_id", clientId).order("period_start", { ascending: false }).limit(500),
    sb.from("hm_seo_audits").select("url, seo_score, aeo_score, issues, has_schema, has_faq, has_og, word_count, meta_description, title").eq("client_id", clientId).order("audited_at", { ascending: false }).limit(3),
  ]);

  const c = client.data as { name: string; public_url: string | null } | null;
  if (!c) return { ok: false, error: "Klient saknas", duration_ms: Date.now() - t0 };

  const url = urlOverride || c.public_url;
  if (!url) return { ok: false, error: "URL saknas — lägg till public_url i clients-tabellen", duration_ms: Date.now() - t0 };

  let site;
  try {
    site = await crawlSite(url, { maxPages: 25 });
  } catch (e) {
    return { ok: false, error: `Kunde inte hämta sajten: ${(e as Error).message}`, duration_ms: Date.now() - t0 };
  }

  // ★ TÄCKNINGSGRINDEN LIGGER HÄR, FÖRE PROMPTEN BYGGS (RAPPORT-1, beslut 2).
  //   Tre utfall: totalfel stoppar allt, partiell ger en blockeringsrapport skriven i kod,
  //   full går vidare till modellen.
  const tackning = bedomTackning(site);
  const plattform = plattformIText(site.platform);

  if (tackning.utfall === "totalfel") {
    // Internt fel till oss. Ingen kundrapport alls: det finns inget att säga.
    console.error(`[djupgranskning] totalfel för ${url}: ${tackning.varfor}`);
    return { ok: false, error: tackning.varfor, duration_ms: Date.now() - t0 };
  }

  if (tackning.utfall === "partiell") {
    // ★ Proffssvaret: säg att servern är trasig som fynd nummer ett i stället för att
    //   svara "kan ej leverera". Rapporten skrivs deterministiskt, ingen modell tillfrågas,
    //   och den innehåller BARA det vi mätte.
    const rapport = byggBlockeringsrapport(site, tackning, {
      klientnamn: c.name,
      url,
      datum: new Date().toISOString().slice(0, 10),
      plattform: site.platform ? plattform : null,
    });
    const { data: sparad } = await sb.from("client_assets").insert({
      client_id: clientId,
      asset_type: "document",
      category: "deep_audit_report",
      subcategory: "seo_aeo",
      body: rapport,
      status: "active",
      metadata: {
        url,
        sort: "blockering",
        tackning: tackning.utfall,
        ej_lasta: tackning.ejLasta.map((e) => `${e.url} (${e.status ?? "inget svar"})`),
        huvudfel: tackning.huvudfel?.monster ?? null,
        generated_at: new Date().toISOString(),
      },
    }).select("id").maybeSingle();

    await logActivity(clientId, "deep_audit", `Blockeringsrapport for ${url}: ${tackning.varfor}`, "/dashboard/seo");
    return { ok: true, asset_id: sparad?.id ?? null, blockering: true, duration_ms: Date.now() - t0 };
  }

  const gscAll = (gsc.data ?? []) as RawGscRow[];
  const latestPeriod = gscAll[0]?.period_start ?? null;
  const gscRows = (latestPeriod ? gscAll.filter((r) => r.period_start === latestPeriod) : gscAll)
    .sort((a, b) => b.impressions - a.impressions);
  const gscSummary = gscRows.length === 0
    ? "Ingen GSC-data tillganglig."
    : gscRows.slice(0, 25).map((r) => `${r.query} | ${r.clicks} klick / ${r.impressions} visn / pos ${Number(r.position).toFixed(1)}`).join("\n");

  const p = profile.data as RawProfile | null;
  const auditSummary = (audits.data ?? []).map((a) => `${(a as { url: string }).url}: SEO ${(a as { seo_score: number }).seo_score} / AEO ${(a as { aeo_score: number }).aeo_score}`).join("\n") || "Inga tidigare audits.";

  // Lokal verksamhet avgörs på profilens plats-fält. Utan adress är en Google-företagsprofil
  // inte självklart relevant, och en obligatorisk sektion om den vore utfyllnad.
  const pr = profile.data as (RawProfile & {
    location?: string | null; opening_hours?: string | null; verified_numbers?: string | null;
    ordlista?: string | null; services?: string | null; customer_quotes?: string | null; brand_story?: string | null;
  }) | null;
  const platsRad = (pr?.location ?? "").trim();
  const lokal = platsRad.length > 1;
  const aiAtgardsText = aiRobotsAtgard(site.aiRobots);

  // Sidtexterna är siffergrindens källa, inte promptens. Utan den här raden hade prompten
  // svällt med hela sajtens brödtext en gång till.
  const { sidTexter, ...sitePrompt } = site;
  const tillatnaTal = tillatnaTalFranKallor(
    ...sidTexter.map((s) => s.text),
    site.homepageText,
    // ⚠ MÄTT PÅ DT-RAPPORTEN 13/8: grinden bytte ut "167 bilder saknar alt-text" mot
    // [DIN SIFFRA]. Talet är VÅRT EGET mätvärde ur crawlen, alltså källa (c) i
    // beställningen: inhämtad strukturerad data. Utan den här raden straffar grinden
    // rapporten för att den återger vad vi själva räknat fram.
    JSON.stringify(sitePrompt),
    pr?.verified_numbers ?? null,
    (pr as { pricing_notes?: string | null } | null)?.pricing_notes ?? null,
    pr?.opening_hours ?? null,
    gscRows.map((r) => `${r.clicks} ${r.impressions} ${r.position}`).join(" "),
  );
  const crawladeUrler = site.pages.filter((s) => s.ejMattOrsak == null).map((s) => s.url);

  const userPrompt = `Generera djupgranskning for denna klient.

# Klient
Namn: ${c.name}
URL: ${url}
Datum: ${new Date().toISOString().slice(0, 10)}

# Brand-profil
Foretagsnamn: ${p?.company_name ?? c.name}
Tagline: ${p?.tagline ?? "(saknas)"}
USP: ${(p as { usp?: string } | null)?.usp ?? "(saknas)"}
ICP: ${(p as { icp_primary?: string } | null)?.icp_primary ?? "(saknas)"}
Services: ${(p as { services?: string } | null)?.services ?? "(saknas)"}
Tone: ${p?.tone_rules ?? "(saknas)"}

# Topp 25 sokord (GSC, 28d)
${gscSummary}

# Tidigare audits
${auditSummary}

# Plattform (skriv ALLTID detta namn, aldrig tekniknamnet under huven)
${plattform}

# Lokal verksamhet: ${lokal ? "ja" : "nej"}
${lokal ? `Adress/ort i profilen: ${platsRad}. Sektionen "Syns du där kunderna letar lokalt" är därmed OBLIGATORISK och ligger i steg 1.` : "Ingen fysisk adress i profilen. Hoppa över den lokala sektionen."}

# Sociala profiler som sajten själv länkar till (enda tillåtna källa för sameAs)
${site.socialaProfiler.length ? site.socialaProfiler.join("\n") : "(inga hittade på sajten)"}

# AI-sökmotorernas robotar (AEO-teknikkontroll)
${site.aiRobots.sammanfattning}
${aiAtgardsText ? `Spärrade robotar: ${site.aiRobots.blockerade.join(", ")}. Detta ska vara TOPPFYND i AEO-sektionen: rapporten får inte rekommendera att synas i ChatGPT och Perplexity utan att först säga att sajten stänger ute dem. Färdig åtgärdstext finns nedan, återge den under "Färdiga texter att klistra in".\n\n${aiAtgardsText}` : ""}

# Döda länkar och sidor som föll (eget fyndkapitel i rapporten)
${tackning.dodaLankar.length
  ? `Följande adresser länkas från sajten eller står i sitemapen men svarar att de inte finns (404). Ta upp dem som ett eget fynd under "Övriga tekniska anmärkningar": antingen ska länken rättas eller sidan återskapas. Skriv ut adresserna.\n${tackning.dodaLankar.map((d) => `- ${d.url}`).join("\n")}`
  : "Inga döda länkar hittades."}
${tackning.serverfel.length
  ? `\nDessa sidor svarade med serverfel men resten av sajten lästes. Nämn dem som ett fynd, inte som en gissning om innehållet:\n${tackning.serverfel.map((d) => `- ${d.url} (${d.status ?? "inget svar"})`).join("\n")}`
  : ""}

# Så byggdes sidlistan (täckning)
Från sitemap: ${site.upptackt.franSitemap.length} adresser${site.upptackt.sitemapArIndex ? ` (sitemapen är ett index med ${site.upptackt.barnSitemaps.length} delfiler)` : ""}
Från länkar på startsidan: ${site.upptackt.franLankar.length} adresser
Lästa: ${site.pageCount} av ${site.pageCountForsokt} försökta
${site.upptackt.overTaket.length ? `Utanför taket (${site.upptackt.maxPages} sidor), alltså varken lästa eller trasiga: ${site.upptackt.overTaket.length} adresser. Säg det rakt ut i rapporten.` : "Inga adresser föll utanför taket."}

# UPPMÄTT FAKTA — HELA SAJTEN (render-medvetet, deterministiskt — använd EXAKT, hitta inte på)
Alla sidor nedan är hämtade från sitemap OCH från länkarna på sajten, och granskade. "pages" = varje sidas mätvärden. "crossPage" = tvärsides-analys.
\`\`\`json
${JSON.stringify(sitePrompt)}
\`\`\`

# Startsidans synliga text (för innehålls- och E-E-A-T-bedömning)
"""
${site.homepageText ?? "(startsidan kunde INTE läsas — se misslyckade[] i JSON ovan)"}
"""

Generera komplett rapport enligt mallen, för HELA sajten. Regler:
- "pages" är ALLA sidor som finns — föreslå ALDRIG att skapa en sida som redan finns i listan. Föreslå istället internlänkning, förstärkning eller sammanslagning.
- FÖRBÄTTRA-SPÅRET: när en sida för ett ämne redan finns ska rekommendationen vara att göra den befintliga sidan bättre (titel, definition i klartext, FAQ, ortsnamn, internlänkar), inte att skapa något från noll. Att föreslå fem nya undersidor när de redan finns är det dyraste felet en rapport kan göra: kunden betalar för arbete hon redan gjort.
- Nämn ALDRIG innehåll (bloggposter, undersidor, länkar) som inte finns i "pages". Rapporten får inte hänvisa till något den samtidigt säger saknas.
- Del 1 (baseline) = översiktstabell per sida (url, title-längd, canonical-källa, H1, schema, ord, seo/aeo-poäng).
- Analysera HELHETEN: canonical-konsekvens (crossPage.canonicalInconsistent), dubbletter, tunna sidor, internlänkning mellan sidor (avgInternalLinks), alt-täckning.
- canonical/robots/sitemap/schema är redan uppmätta — säg aldrig "saknas" om FAKTA visar att de finns.
- DOMÄN-DUBBLETT: kolla "domainRedirect". Om redirectWorks=true (t.ex. www → icke-www 301 finns) → flagga ALDRIG "duplicerad sajt" som HÖG. Det är redan löst på serversidan. Nämn det då bara som klar/hygien. Bara om redirectWorks=false är domän-dubblett ett riktigt HÖG-problem.
- Canonical-taggar som pekar på olika domänvarianter (crossPage.canonicalTagInconsistent) när redirect finns = LÅG hygien, inte HÖG. Rekommendera att ensa till primaryHost (domainRedirect.primaryHost), men säg att effekten är liten eftersom redirecten redan styr Google rätt.
- Använd EXAKT datumet i # Klient → Datum nedan i rapportens rubrik. Hitta inte på årtal.
- Inga påhittade siffror, inga floskler.`;

  // Full uttömmande rapport via Anthropic Batch-API — ingen tidsgräns på själva genereringen,
  // så hela mallen (>14000 tokens) kan skrivas ut i sin helhet. POST submittar batchen (<5s) och
  // sparar en platshållare (status processing). Finaliseringen sker via GET (poll) + daglig cron.
  try {
    // KOSTNAD-1: submit-anropet loggas med noll tokens — kostnaden bokförs när batchen
    // hämtas hem i deep-audit-finalize (det är där token-användningen finns). Poängen med
    // att logga submitten ändå: betalnings- och nyckelfel syns HÄR, direkt.
    const batchRes = await anropaProvider<{ id: string }>({
      provider: "anthropic",
      model: MODEL,
      flow: "djupgranskning-start",
      tenantId: clientId,
      url: "https://api.anthropic.com/v1/messages/batches",
      init: {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          requests: [
            {
              custom_id: "audit",
              params: {
                model: MODEL,
                max_tokens: 20000,
                system: SYSTEM_PROMPT,
                messages: [{ role: "user", content: userPrompt }],
              },
            },
          ],
        }),
      },
    });
    if (!batchRes.ok || !batchRes.data?.id) {
      // ★ Håkans beslut 13/8: ett fel hos VÅR leverantör (obetald faktura, avvisad nyckel)
      // ska inte stå i klartext framför en kund. Hon kan inte göra något åt det, och det
      // säger allt om sådant hon inte ska behöva veta.
      //
      // ⚠ Felet döljs, inte tystas: hela leverantörssvaret loggas här och i
      // `ai_usage_events` med statuskod och svarskropp. Adminvyn `/dashboard/kostnader`
      // visar den ocensurerade texten via `felklassTeknisk`.
      console.error(`[djupgranskning] kunde inte starta batchen: ${batchRes.fel || batchRes.raw}`);
      return { ok: false, error: "Funktionen kommer inom kort.", duration_ms: Date.now() - t0 };
    }
    const batch = batchRes.data;

    const { data: saved } = await sb.from("client_assets").insert({
      client_id: clientId,
      asset_type: "document", // INTE "post" — annars räknas rapporten som ett röst-exempel i Kunskapsbanken + röst-träningen
      category: "deep_audit_report",
      subcategory: "seo_aeo",
      body: "",
      status: "processing", // client_assets_status_check tillåter bara active/archived/processing/failed
      metadata: {
        url,
        batch_id: batch.id,
        started_at: new Date().toISOString(),
        gsc_rows: gscRows.length,
        // R-2: grinden körs när batchen kommer hem, timmar senare. Underlaget måste
        // därför följa med hit — det går inte att crawla om sajten för att kontrollera
        // en siffra i efterhand.
        tillatna_tal: tillatnaTal,
        crawlade_urler: crawladeUrler,
        tackning: tackning.utfall,
        // R-5: Googles tal maskas aldrig, och kunskapsfältet är källan för branschfakta.
        gsc_tal: Array.from(new Set(gscRows.flatMap((r) => [String(r.clicks), String(r.impressions), String(Math.round(Number(r.position)))]))),
        kunskapsfalt: [pr?.ordlista ?? "", pr?.services ?? "", pr?.verified_numbers ?? ""].filter(Boolean).join("\n") || null,
        // R-4: enda tillåtna citatkällor, och täckningen för auktoritetsanspråk.
        citatkallor: [...sidTexter.map((s) => s.text), pr?.customer_quotes ?? ""].filter(Boolean),
        tackningstext: [pr?.verified_numbers ?? "", pr?.brand_story ?? "", pr?.customer_quotes ?? ""].filter(Boolean).join("\n") || null,
      },
    }).select("id").maybeSingle();

    await logActivity(clientId, "deep_audit", `Djupgranskning startad for ${url}`, "/dashboard/seo");

    return { ok: true, status: "processing", asset_id: saved?.id ?? null, batch_id: batch.id, duration_ms: Date.now() - t0 };
  } catch (e) {
    return { ok: false, error: (e as Error).message, duration_ms: Date.now() - t0 };
  }
}
