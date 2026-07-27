import { NextRequest, NextResponse } from "next/server";
import { getActiveClient, resolveClientId } from "@/lib/client-context";
import { generate } from "@/lib/gemini";
import { getProfileAsMarkdown } from "@/lib/knowledge";
import { getKitDirectives, dontsRule } from "@/lib/studio/kit";
import { requireAdminOrCustomer } from "@/lib/api-auth";
import { DISC_TONE, DISC_HOOK, BOFU_CTA_MALL } from "@/lib/content-compass/prompt";
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
    .replace(/\s+—\s+/g, ", ").replace(/—/g, ",");
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

async function genGuarded(system: string, prompt: string, temperature = 0.7, maxOutputTokens = 900): Promise<string> {
  let out = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const sys = attempt === 0 ? system : `${system}\n\n=== VIKTIGT (försök ${attempt + 1}) ===\nFöregående svar innehöll ett förbjudet uttryck. Skriv om helt och undvik dem.`;
    out = (await generate({ model: "gemini-2.5-flash", systemInstruction: sys, prompt, temperature: attempt === 0 ? temperature : 0.6, maxOutputTokens })).trim();
    if (!hasBanned(out)) break;
  }
  return sanitize(out);
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
    const profilBlock = profile ? `\n=== VARUMÄRKESPROFIL (kontext: röst, målgrupp, erbjudande) ===\n${profile.slice(0, 5000)}` : "";

    // ── Läge DISC: fyra varianter av samma inlägg, en per personlighetstyp ──
    if (mode === "disc") {
      const LETTERS: DiscLetter[] = ["D", "I", "S", "C"];
      const COLOR: Record<DiscLetter, string> = { D: "röd", I: "gul", S: "grön", C: "blå" };
      const variants = await Promise.all(
        LETTERS.map(async (letter) => {
          const system = [
            `Du skriver om ett socialt inlägg för ${client?.name || "kunden"} så att det talar till EN personlighetstyp.`,
            profilBlock,
            `\n=== MÅLGRUPPSTYP: ${COLOR[letter]} (${DISC_LABEL_SV[letter]}) ===`,
            `Ton: ${DISC_TONE[letter]}.`,
            `Krok: ${DISC_HOOK[letter]}.`,
            "\nBehåll budskapet, erbjudandet och svarsordet identiskt. Ändra bara tilltal, krok och rytm så det passar typen.",
            REGLER,
            dontsRule(directives.donts),
            "\nReturnera ENDAST det omskrivna inlägget, ingen rubrik och ingen förklaring.",
          ].filter(Boolean).join("\n");
          const t = await genGuarded(system, `Originalinlägg:\n${text}\n\nSkriv om det för ${COLOR[letter]} nu.`, 0.75, 800);
          return { letter, label: DISC_LABEL_SV[letter], color: COLOR[letter], text: t };
        }),
      );
      return NextResponse.json({ variants: variants.filter((v) => v.text) });
    }

    // ── Läge Förbättra: analys + EN förbättrad huvudversion ──
    const system = [
      `Du är en erfaren copywriter som hjälper ${client?.name || "kunden"} att göra sitt sociala inlägg vassare.`,
      profilBlock,
      "\n=== VAD DU SKA GÖRA ===",
      "1. ANALYS: 2 till 4 korta punkter på uppmuntrande svenska. Säg först vad som redan fungerar, sedan vad som saknas.",
      "   Bedöm särskilt: finns en tydlig MÅLGRUPP (vem är detta för?), går LÖFTET hela vägen till en konkret förändring (inte bara en insikt?), finns ett tydligt svarsord/CTA, och är rytmen läsbar?",
      "   Skriv som en kollega, inte som en lärare. Exempel på ton: \"Tydligt svarsord, bra. Målgrupp saknas: vem är detta för?\"",
      "2. FÖRBÄTTRAD VERSION: skriv om inlägget så att det behåller skribentens röst, erbjudande och svarsord, men:",
      "   - lägger till målgruppen där den saknas (använd profilens målgrupp om originalet inte anger någon, annars håll det öppet)",
      "   - skärper löftet så det går hela vägen till förändring, inte bara insikt",
      "   - förbättrar rytm och radbrytningar så det är lätt att läsa i ett flöde",
      `\nEn stark struktur att luta sig mot när det passar: "${BOFU_CTA_MALL}"`,
      REGLER,
      dontsRule(directives.donts),
      "\n=== SVARSFORMAT (exakt) ===",
      "Returnera ENDAST giltig JSON, inget annat:",
      '{"analysis":["punkt 1","punkt 2"],"improved":"hela det förbättrade inlägget med radbrytningar"}',
    ].filter(Boolean).join("\n");

    const raw = await genGuarded(system, `Inlägget som ska förbättras:\n${text}`, 0.7, 1400);
    const jsonStr = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    let parsed: { analysis?: unknown; improved?: unknown } = {};
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      const m = jsonStr.match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch { /* faller igenom */ } }
    }

    const analysis = Array.isArray(parsed.analysis)
      ? parsed.analysis.map((x) => sanitize(String(x))).filter(Boolean).slice(0, 4)
      : [];
    const improved = typeof parsed.improved === "string" ? sanitize(parsed.improved).trim() : "";
    if (!improved) return NextResponse.json({ error: "Kunde inte förbättra inlägget just nu. Prova igen." }, { status: 502 });

    return NextResponse.json({ analysis, improved });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
