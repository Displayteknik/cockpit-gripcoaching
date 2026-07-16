import { NextRequest, NextResponse } from "next/server";
import { generate } from "@/lib/gemini";
import { getTemplateMeta } from "@/lib/studio/templates-meta";

export const runtime = "nodejs";
export const maxDuration = 20;

// POST /api/studio/parse-draft — { text, templateId } → { headline1, headline2, body }
// Delar upp användarens egna utkast i mallens fält. Ändrar inte innehållet i sak.
export async function POST(req: NextRequest) {
  try {
    const b = await req.json().catch(() => ({}));
    const text = (b.text || "").toString().trim();
    if (!text) return NextResponse.json({ error: "Ingen text" }, { status: 400 });
    const meta = getTemplateMeta((b.templateId || "").toString());

    // Heuristik-fallback (om AI:t skulle strula): första raden = rubrik, resten = brödtext.
    const lines = text.split("\n").map((l: string) => l.trim()).filter(Boolean);
    const fallback = { headline1: lines[0] || text.slice(0, 40), headline2: "", body: lines.slice(1).join(" ") || (lines.length === 1 ? "" : text) };

    try {
      const raw = await generate({
        model: "gemini-2.5-flash",
        systemInstruction: [
          "Dela upp användarens text i ett affisch-inläggs fält. Ändra INTE budskapet — bara fördela och korta ner till affisch-format.",
          meta ? `Fält: rubrik ("${meta.fields.headline1}"), underrubrik ("${meta.fields.headline2}"), text ("${meta.fields.body}").` : "Fält: rubrik, underrubrik, text.",
          "rubrik = kort slagkraftig (max ~28 tecken). underrubrik = kort (valfri). text = kort brödtext (1–2 meningar).",
          "Behåll användarens ord och ton. Svenska tecken korrekt. SVAR: strikt JSON {\"headline1\":\"...\",\"headline2\":\"...\",\"body\":\"...\"}",
        ].join("\n"),
        prompt: text.slice(0, 1500),
        temperature: 0.4,
        maxOutputTokens: 400,
        jsonMode: true,
      });
      const obj = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || "{}");
      return NextResponse.json({
        headline1: typeof obj.headline1 === "string" ? obj.headline1 : fallback.headline1,
        headline2: typeof obj.headline2 === "string" ? obj.headline2 : fallback.headline2,
        body: typeof obj.body === "string" ? obj.body : fallback.body,
      });
    } catch {
      return NextResponse.json(fallback);
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
