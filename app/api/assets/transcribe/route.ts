import { NextRequest, NextResponse } from "next/server";
import { getActiveClientId } from "@/lib/client-context";
import { supabaseService } from "@/lib/supabase-admin";
import { generate } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 300;

// POST /api/assets/transcribe { id }
// Hämtar audio/video-asset, transkriberar via Gemini och uppdaterar body.
export async function POST(req: NextRequest) {
  try {
    const clientId = await getActiveClientId();
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "id krävs" }, { status: 400 });

    const sb = supabaseService();
    const { data: asset, error } = await sb
      .from("client_assets")
      .select("*")
      .eq("id", id)
      .eq("client_id", clientId)
      .single();
    if (error || !asset) {
      return NextResponse.json({ error: "Asset hittades inte" }, { status: 404 });
    }
    if (!["audio", "video"].includes(asset.asset_type)) {
      return NextResponse.json({ error: "Bara audio/video kan transkriberas" }, { status: 400 });
    }
    if (!asset.storage_path) {
      return NextResponse.json({ error: "Saknar storage_path" }, { status: 400 });
    }

    // Hämta filen från storage
    const dl = await sb.storage.from("client-assets").download(asset.storage_path);
    if (dl.error || !dl.data) {
      return NextResponse.json({ error: "Kunde inte hämta fil" }, { status: 500 });
    }

    const buf = Buffer.from(await dl.data.arrayBuffer());
    if (buf.length > 19 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Fil för stor för inline-transkribering (>19 MB). Stöd för Gemini Files API kommer." },
        { status: 400 }
      );
    }
    const base64 = buf.toString("base64");

    // Anropa Gemini direkt (lib/gemini stödjer inte multimodal inline ännu — använder rå fetch)
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY saknas");

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const body = {
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType: asset.mime_type || "audio/mpeg", data: base64 } },
            {
              text:
                "Transkribera detta tal ord för ord på svenska. Behåll talspråk, tvekljud, " +
                "satsbyggnad och uttryck exakt som personen säger det — det här ska användas " +
                "som voice-sample för en AI som ska imitera personens röst. Returnera enbart " +
                "transkriptionen, inga rubriker eller kommentarer.",
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 8192,
        thinkingConfig: { thinkingBudget: 0 },
      },
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      await sb.from("client_assets").update({ status: "failed", notes: text.slice(0, 500) }).eq("id", id);
      return NextResponse.json({ error: `Transkribering misslyckades: ${res.status}` }, { status: 500 });
    }
    const data = await res.json();
    const transcript = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!transcript) {
      return NextResponse.json({ error: "Tomt svar från Gemini" }, { status: 500 });
    }

    // Snabb summering för listvisning
    let summary = "";
    try {
      summary = (
        await generate({
          model: "gemini-2.5-flash",
          prompt: `Sammanfatta detta tal i 1-2 meningar (max 200 tecken):\n\n${transcript.slice(0, 6000)}`,
          temperature: 0.3,
          maxOutputTokens: 200,
        })
      ).trim();
    } catch {
      summary = transcript.slice(0, 200);
    }

    const upd = await sb
      .from("client_assets")
      .update({
        body: transcript,
        ai_summary: summary,
        status: "active",
      })
      .eq("id", id)
      .eq("client_id", clientId)
      .select()
      .single();

    if (upd.error) return NextResponse.json({ error: upd.error.message }, { status: 500 });
    return NextResponse.json({ asset: upd.data });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
