import { NextRequest, NextResponse } from "next/server";
import { getActiveClientId } from "@/lib/client-context";
import { generate } from "@/lib/gemini";
import { byggTextPrompt, saneraText } from "@/lib/prompt-core";
import { requireAdminOrCustomer } from "@/lib/api-auth";
import { sakerstallCta } from "@/lib/content/writing-rules";

export const runtime = "nodejs";
export const maxDuration = 30;

// POST /api/generate/regenerate
// { hook, body, cta, instruction }  — instruction = "djärvare", "varmare", "kortare", fritext
//
// KVALITET-3/punkt 11 — DET HÄR VAR HÅLET I CTA-GOLVET.
// Omgenereringsvägen byggde sin EGEN systemprompt (KUND + USP + röstblock + fyra rader
// "REGLER") och rörde aldrig lib/prompt-core. Den missade därmed samtliga plattformslager:
// CTA-golvet, anatomin, sanningskravet, perspektivregeln, prisregeln, de globala
// skrivreglerna, vinnande exempel och klientens förbjudna ord. Ett inlägg som gick genom
// "gör om" tappade alltså allt som de andra flödena garanterar — exakt det mönster som
// gör CTA-golvet intermittent. Routen bygger nu prompten som alla andra flöden.
// Samtidigt tillkom admin-/kundgrinden, som också saknades.
export async function POST(req: NextRequest) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;

  try {
    const clientId = await getActiveClientId();
    const body = await req.json();
    const { hook, body: postBody, cta, instruction } = body;

    if (!instruction || String(instruction).trim().length < 2) {
      return NextResponse.json({ error: "Instruktion krävs" }, { status: 400 });
    }
    const anvisning = String(instruction).slice(0, 500);

    const uppdrag = [
      "Du redigerar ett befintligt socialt-medie-inlägg på instruktion. Behåll grundidén men förändra enligt anvisningen.",
      "",
      "=== REGLER ===",
      "- Behåll erbjudandet, svarsordet och skribentens tilltal. Det ska låta som samma avsändare, bara enligt anvisningen.",
      "- Hitta ALDRIG på fakta, siffror, priser eller resultat som inte finns i originalet.",
      "- Svenska tecken å/ä/ö korrekt. Skriv som en människa.",
      "- FÖRBJUDNA ord: kraftfull, banbrytande, game-changer, handlar om, nästa nivå, holistisk, skalbar.",
      "- Fälten hör ihop: hook öppnar, body bär, cta avslutar med uppmaningen. Lägg aldrig uppmaningen i body.",
    ].join("\n");

    // ⚠ G-3d: INGEN rotation här, med flit. Flödet skriver OM en text användaren just
    // lämnat in. En undvik-lista som innehöll originalets egen öppning hade drivit
    // omskrivningen bort från det den ska behålla.
    const bygg = await byggTextPrompt({
      // Samma syfte som improve-post: en omskrivning av en färdig text har ingen egen
      // funnel-nivå, så kärnan ger bar anatomi med CTA-golvet — aldrig en påtvingad
      // funnel som skulle motsäga inläggets ursprungliga roll.
      clientId,
      syfte: "kanal-anpassning",
      uppdrag,
      underlag: `BEFINTLIGT INLÄGG:\nHook: ${hook || "(tom)"}\nBody: ${postBody || "(tom)"}\nCTA: ${cta || "(tom)"}\n\nINSTRUKTION: ${anvisning}\n\nGenerera om enligt instruktionen. Returnera bara JSON.`,
      // KVALITET-3/punkt 5: instruktionen är användarens egen text. Skrev hen in ett pris
      // där är det hens beslut; originalets fält räknas inte som medgivande.
      anvandarText: anvisning,
      jsonSchema: '{ "hook": "...", "body": "...", "cta": "uppmaningen, i imperativ", "hashtags": ["..."], "notes": "vad du ändrade och varför" }',
    });

    const koraOm = async (skarpning: string): Promise<{ hook?: string; body?: string; cta?: string; hashtags?: string[]; notes?: string }> => {
      const raw = await generate({
        model: "gemini-2.5-pro",
        systemInstruction: skarpning ? `${bygg.system}\n\n${skarpning}` : bygg.system,
        prompt: bygg.user,
        temperature: 0.85,
        maxOutputTokens: 2500,
        jsonMode: true,
        skrivregler: false, // prompt-core äger skrivregler-flaggan (TEXT-1)
      });
      try {
        return JSON.parse(raw);
      } catch {
        const m = raw.match(/\{[\s\S]*\}/);
        return m ? JSON.parse(m[0]) : {};
      }
    };

    const parsed = await koraOm("");
    const output = {
      hook: parsed.hook || hook || "",
      body: parsed.body || postBody || "",
      cta: parsed.cta || cta || "",
      hashtags: parsed.hashtags || [],
      notes: parsed.notes || "",
    };

    // KVALITET-3/punkt 11: CTA-golvet på utdatan. EXAKT en omgenerering, fail-open.
    const golv = await sakerstallCta(output.cta, async (skarpning) => String((await koraOm(skarpning)).cta || ""), "regenerate");
    if (golv.text) output.cta = golv.text;

    // TEXT-1: enhetlig sanering via saneraText (flaggan avgörs i prompt-core).
    const [renHook, renBody, renCta] = await Promise.all([
      saneraText(output.hook, clientId),
      saneraText(output.body, clientId),
      saneraText(output.cta, clientId),
    ]);

    let voice_score = null;
    try {
      const { scoreText } = await import("@/lib/voice-enforce");
      const full = [renHook, renBody, renCta].filter(Boolean).join("\n\n");
      const s = await scoreText(full, clientId, "social");
      voice_score = { score: s.total, verdict: s.total >= 70 ? "pass" : s.total >= 55 ? "warn" : "block", issues: s.issues.slice(0, 5) };
    } catch {}

    return NextResponse.json({
      hook: renHook,
      body: renBody,
      cta: renCta,
      hashtags: output.hashtags,
      notes: await saneraText(output.notes, clientId),
      ctaOmgenererad: golv.omgenererad,
      voice_score,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
