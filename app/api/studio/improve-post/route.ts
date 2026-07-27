import { NextRequest, NextResponse } from "next/server";
import { getActiveClient, resolveClientId } from "@/lib/client-context";
import { generate } from "@/lib/gemini";
import { getProfileAsMarkdown } from "@/lib/knowledge";
import { getKitDirectives, dontsRule } from "@/lib/studio/kit";
import { requireAdminOrCustomer } from "@/lib/api-auth";
import { DISC_TONE, DISC_HOOK } from "@/lib/content-compass/prompt";
import { DISC_LABEL_SV } from "@/lib/content-compass/labels";
import type { DiscLetter } from "@/lib/content-compass/data";

export const runtime = "nodejs";
export const maxDuration = 60;

// AI-språk som aldrig får slinka igenom (samma grind som suggest-caption).
const BANNED = [/kraftfull/i, /banbrytande/i, /game-?changer/i, /handlar\s+(inte\s+)?om/i, /nästa\s+nivå/i, /holistisk/i, /skalbar/i];
const hasBanned = (t: string) => BANNED.some((re) => re.test(t));

// Mekanisk sista-utväg + tankstreck bort (kundkrav: aldrig tankstreck).
function sanitize(t: string): string {
  return t
    .replace(/\bhandlar\s+inte\s+om\b/gi, "gäller inte")
    .replace(/\bhandlar\s+om\b/gi, "gäller")
    .replace(/\bkraftfullt\b/gi, "starkt").replace(/\bkraftfulla\b/gi, "starka").replace(/\bkraftfull\b/gi, "stark")
    .replace(/\bbanbrytande\b/gi, "nyskapande")
    .replace(/\bnästa\s+nivå\b/gi, "längre")
    .replace(/\bholistiskt?\b/gi, "helhet").replace(/\bholistiska\b/gi, "helhets")
    .replace(/\bskalbar[t]?\b/gi, "lätt att växa")
    // Tankstreck i alla former (em-dash — och en-dash –) → komma. Både omgivet av
    // mellanslag och hopskrivet, annars slinker "gör – men" igenom.
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/,\s*,/g, ",")
    .replace(/\s+,/g, ",");
}

// Gemensamma järnregler: aldrig hitta på, behåll rösten, aldrig tankstreck.
const REGLER = [
  "=== ABSOLUTA REGLER ===",
  "- Hitta ALDRIG på fakta, siffror, priser, resultat, tidsangivelser eller påståenden som inte finns i originalet.",
  "- Behåll skribentens du-tilltal, ton och personliga uttryck. Det ska låta som samma person, bara vassare.",
  "- Behåll alltid skribentens svarsord/nyckelord exakt som det står (t.ex. 'Svara BLUEPRINT').",
  "- Behåll erbjudandet precis som det är. Lägg inte till nya erbjudanden, garantier eller löften.",
  "- Svara ALLTID på samma språk som originalet.",
  "- Använd ALDRIG tankstreck. Använd komma, punkt eller kolon.",
  "- FÖRBJUDNA ord: kraftfull, banbrytande, game-changer, handlar om, nästa nivå, holistisk, skalbar.",
].join("\n");

// Påhittad statistik är den farligaste hallucinationen här (t.ex. "85% av alla upplever…").
// Flagga procenttal/studie-språk som INTE finns i originalet → generera om.
function inventedStats(out: string, original: string): boolean {
  const pct = out.match(/\d+\s?%/g) || [];
  if (pct.some((p) => !original.includes(p.replace(/\s/g, "")) && !original.includes(p))) return true;
  return /\b(studier|forskning|undersökning(ar)?|enligt en rapport|visar att \d)/i.test(out) && !/\b(studier|forskning|undersökning)/i.test(original);
}

// Deterministisk sista utväg: ta bort meningar som innehåller statistik/studier som INTE
// finns i originalet. Modellen kan envisas trots omgenerering, och en påhittad siffra live
// i en demo är värre än en mening mindre.
function stripInventedStats(out: string, original: string): string {
  if (!original) return out;
  const kept = out
    .split(/\n/)
    .map((rad) => {
      const meningar = rad.match(/[^.!?]+[.!?]*/g) || [rad];
      return meningar
        .filter((m) => {
          const pct = m.match(/\d+\s?%/g) || [];
          if (pct.some((p) => !original.includes(p) && !original.includes(p.replace(/\s/g, "")))) return false;
          if (/\b(studier|forskning|undersökning(ar)?|enligt en rapport)\b/i.test(m) && !/\b(studier|forskning|undersökning)\b/i.test(original)) return false;
          return true;
        })
        .join("")
        .trim();
    })
    .join("\n");
  // Föll allt bort (osannolikt) → behåll originalsvaret hellre än att returnera tomt.
  return kept.replace(/\n{3,}/g, "\n\n").trim() || out;
}

// strip=false när svaret är JSON (Förbättra-läget) — då strippas texten efter parsning istället.
async function genGuarded(system: string, prompt: string, temperature = 0.7, maxOutputTokens = 900, original = "", strip = true): Promise<string> {
  let out = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const sys = attempt === 0 ? system : `${system}\n\n=== VIKTIGT (försök ${attempt + 1}) ===\nFöregående svar bröt mot reglerna (förbjudet uttryck eller påhittad statistik). Skriv om helt. Använd inga siffror, procenttal eller studier som inte står i originalet.`;
    out = (await generate({ model: "gemini-2.5-flash", systemInstruction: sys, prompt, temperature: attempt === 0 ? temperature : 0.6, maxOutputTokens })).trim();
    if (!hasBanned(out) && !(original && inventedStats(out, original))) break;
  }
  const clean = sanitize(out);
  return strip ? stripInventedStats(clean, original) : clean;
}

// POST /api/studio/improve-post
//   { text }            → { analysis: string[], improved: string }
//   { text, mode:"disc" } → { variants: [{ letter, label, color, text }] }  (D/I/S/C = röd/gul/grön/blå)
// Förbättrar ett befintligt inlägg med kundens Brand-profil som kontext. Grindad som övriga studio-routes.
export async function POST(req: NextRequest) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;

  try {
    const client = await getActiveClient();
    const b = await req.json().catch(() => ({}));
    const text = (b.text || "").toString().trim().slice(0, 4000);
    if (!text) return NextResponse.json({ error: "Klistra in ett inlägg först." }, { status: 400 });
    const mode = (b.mode || "improve").toString();

    const profile = await getProfileAsMarkdown().catch(() => "");
    const directives = await getKitDirectives(await resolveClientId());
    // Brand-profilen används VILLKORAT: inlägget självt är primär källa. Passar profilen
    // inläggets bransch/röst är den förstärkande kontext, annars ignoreras den helt så
    // tenantens bransch aldrig blöder in i ett inlägg från en annan värld.
    const profilBlock = profile
      ? [
          "\n=== TENANTENS BRAND-PROFIL (villkorad referens, INTE facit) ===",
          profile.slice(0, 5000),
          "\n=== SÅ ANVÄNDER DU PROFILEN ===",
          "1. Härled FÖRST bransch, målgrupp, erbjudande, ton och tilltal ur det inklistrade inlägget. Det är din primära källa.",
          "2. Jämför sedan med profilen ovan. Samma bransch och röst: använd profilen som förstärkning (ton, målgruppsdetaljer).",
          "3. Olika bransch eller röst: IGNORERA profilen helt för den här körningen och arbeta enbart utifrån inlägget.",
          "4. Blanda ALDRIG in tenantens bransch, produkter, tjänster eller exempel i ett inlägg som handlar om något annat.",
        ].join("\n")
      : "";

    // ── Läge DISC: fyra varianter av samma inlägg, en per personlighetstyp ──
    if (mode === "disc") {
      const LETTERS: DiscLetter[] = ["D", "I", "S", "C"];
      const COLOR: Record<DiscLetter, string> = { D: "röd", I: "gul", S: "grön", C: "blå" };
      const variants = await Promise.all(
        LETTERS.map(async (letter) => {
          // Krokarna för D och C ("rak siffra", "överraskande fakta") lockar modellen att
          // uppfinna statistik. Styr om dem till siffror/detaljer som FINNS i originalet.
          const krok = letter === "C"
            ? "konkret, strukturerad ingång (t.ex. en tydlig frågeställning eller en uppräkning). Använd ALDRIG statistik, procenttal eller studier."
            : letter === "D"
              ? "rakt, kort påstående. Använd bara siffror som redan finns i originalet, hitta aldrig på nya."
              : DISC_HOOK[letter];
          const system = [
            `Du skriver om ett socialt inlägg för ${client?.name || "kunden"} så att det talar till EN personlighetstyp.`,
            profilBlock,
            `\n=== MÅLGRUPPSTYP: ${COLOR[letter]} (${DISC_LABEL_SV[letter]}) ===`,
            `Ton: ${DISC_TONE[letter]}.`,
            `Krok: ${krok}.`,
            "\nBehåll budskapet, erbjudandet och svarsordet identiskt. Ändra bara tilltal, krok och rytm så det passar typen.",
            "Inlägget självt styr bransch, målgrupp och erbjudande. Handlar det om något annat än profilen ovan: ignorera profilen helt och blanda aldrig in tenantens bransch eller produkter.",
            REGLER,
            "- Uppfinn ALDRIG statistik, procenttal, forskningsresultat eller studier. Inga siffror som inte står i originalet.",
            dontsRule(directives.donts),
            "\nReturnera ENDAST det omskrivna inlägget, ingen rubrik och ingen förklaring.",
          ].filter(Boolean).join("\n");
          const t = await genGuarded(system, `Originalinlägg:\n${text}\n\nSkriv om det för ${COLOR[letter]} nu.`, 0.75, 800, text);
          return { letter, label: DISC_LABEL_SV[letter], color: COLOR[letter], text: t };
        }),
      );
      return NextResponse.json({ variants: variants.filter((v) => v.text) });
    }

    // ── Läge Förbättra: analys + EN förbättrad huvudversion ──
    const system = [
      `Du är en erfaren copywriter som hjälper ${client?.name || "kunden"} att göra sitt sociala inlägg vassare.`,
      profilBlock,
      "\n=== METODEN (arbeta i den här ordningen, varje steg är obligatoriskt) ===",
      "",
      "STEG 1. MÅLGRUPPSTEST: symptom, inte lösning.",
      "En målgrupp som beskrivs genom skribentens LÖSNING är ingen målgrupp. 'kvinna som vill förändra sitt undermedvetna', 'du som vill jobba med mindset', 'företagare som vill skala' är lösningsspråk: kunden känner inte igen sig, för hon vet inte än att problemet heter så.",
      "Flagga det i analysen. Öppna sedan förbättringen med kundens UPPLEVDA SYMPTOM i hennes eget vardagsspråk: hur känns problemet inifrån, innan hon vet vad lösningen heter?",
      "Så här ser transformationen ut: 'vill förändra ditt undermedvetna' blir 'gör allt rätt på ytan men känner ändå att livet inte riktigt är ditt'.",
      "",
      "STEG 2. SKULDAVLASTNING.",
      "Riktar sig inlägget till någon som kämpat länge: lägg in EN mening som tar bort skulden, i stil med 'det är sällan viljan det hänger på, det är gamla mönster som styr'.",
      "Expertens egen term (t.ex. omprogrammering, mindset, funnel) placeras HÄR, i förklaringen av varför det inte är personens fel. Aldrig i öppningen.",
      "",
      "STEG 3. TRANSFORMATION, INTE PROCESS.",
      "Löftet ska beskriva det KÄNNBARA läget efteråt, t.ex. 'så att dina val börjar kännas som dina igen'.",
      "Vaga abstraktioner är förbjudna: 'i samklang med dig själv', 'nå din fulla potential', 'leva ditt bästa liv', 'ta klivet' och liknande luddigheter stryks. Beskriv hur vardagen känns annorlunda, konkret.",
      "",
      "STEG 4. CTA-SKÄRPNING.",
      "Svarsordet skrivs i VERSALER, exakt som skribenten stavat det.",
      "Använd ett bestämt verb: 'så bokar vi' slår 'så tar vi'. Erbjuds ett samtal eller möte och originalet inte nämner något pris: lägg till 'kostnadsfritt'.",
      "Stryk formuleringar där skribenten sätter sig själv i centrum: 'där jag berättar mer', 'så berättar jag om mitt program'. Samtalet ska handla om kunden, inte om avsändaren.",
      "",
      "STEG 5. DRAMATURGI (4A).",
      "Ordning: först äkthet och igenkänning (symptomet), sedan analytisk förklaring (varför det sitter fast), sist actionable (CTA).",
      "Radbrytningar används för rytm, men radbrytningar är ALDRIG hela förbättringen. Ett inlägg som bara fått nya radbrytningar är underkänt.",
      "",
      "STEG 6. BEHÅLL ALLTID: skribentens du-tilltal, erbjudande, svarsord och grundton.",
      "",
      "=== FÖREBILD (gör samma TYP av lyft, kopiera aldrig texten) ===",
      "FÖRE: \"Om du är en kvinna som vill förändra ditt undermedvetna för att kunna leva ett liv som känns mer rätt för dig, skriv 'omprogrammering' så tar vi ett samtal, där jag berättar mer\"",
      "EFTER: \"Om du är en kvinna som gör allt rätt på ytan men ändå känner att livet inte riktigt är ditt, då är det sällan viljan det hänger på. Det är gamla mönster i ditt undermedvetna som styr. Jag hjälper dig att omprogrammera dem, så att dina val börjar kännas som dina igen. Skriv OMPROGRAMMERING så bokar vi ett kostnadsfritt samtal.\"",
      "Notera vad som hände: symptom i öppningen, skuldavlastning med expertens term i förklaringen, kännbar transformation, versalt svarsord, bestämt verb, kostnadsfritt, och 'där jag berättar mer' struket.",
      "",
      "=== ANALYSEN ===",
      "2 till 4 korta punkter på uppmuntrande svenska, som en kollega och inte en lärare. Säg först vad som redan fungerar, peka sedan ut vad som saknas enligt stegen ovan (särskilt lösningsspråk i målgruppen och ett löfte som stannar i abstraktion).",
      "Exempel på ton: \"Tydligt svarsord, bra. Målgruppen är beskriven genom din lösning: hur känns problemet för henne innan hon vet vad det heter?\"",
      REGLER,
      dontsRule(directives.donts),
      "\n=== SVARSFORMAT (exakt) ===",
      "Returnera ENDAST giltig JSON, inget annat:",
      '{"profileMatch":true,"analysis":["punkt 1","punkt 2"],"improved":"hela det förbättrade inlägget med radbrytningar"}',
      'Sätt "profileMatch" till true om du använde Brand-profilen (samma bransch och röst), annars false.',
    ].filter(Boolean).join("\n");

    const raw = await genGuarded(system, `Inlägget som ska förbättras:\n${text}`, 0.7, 1400, text, false);
    const jsonStr = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    let parsed: { analysis?: unknown; improved?: unknown; profileMatch?: unknown } = {};
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      const m = jsonStr.match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch { /* faller igenom */ } }
    }

    const analysis = Array.isArray(parsed.analysis)
      ? parsed.analysis.map((x) => sanitize(String(x))).filter(Boolean).slice(0, 4)
      : [];
    const improved = typeof parsed.improved === "string" ? stripInventedStats(sanitize(parsed.improved), text).trim() : "";
    if (!improved) return NextResponse.json({ error: "Kunde inte förbättra inlägget just nu. Prova igen." }, { status: 502 });

    // Utan profil finns inget att matcha mot → visa ingen infotext alls.
    const profileMatch = profile ? parsed.profileMatch === true : null;
    return NextResponse.json({ analysis, improved, profileMatch });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
