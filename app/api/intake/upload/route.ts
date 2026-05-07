import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-admin";
import { getActiveClientId, logActivity } from "@/lib/client-context";

export const runtime = "nodejs";
export const maxDuration = 300;

interface JsonBody {
  source_type: "transcript" | "manual";
  source_label?: string;
  transcript: string;
  person_name?: string;
}

async function transcribeAudio(buf: Buffer, mimeType: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY saknas");
  const base64 = buf.toString("base64");
  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType, data: base64 } },
          {
            text: "Transkribera detta ljud ordagrant till svenska. Skriv i talspråk så som det sägs (inkludera tvekljud som 'eh', 'liksom' om de förekommer). Markera olika talare som [Talare A], [Talare B] om det är flera personer. Returnera ENDAST transkriptet, ingen kommentar.",
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 32000,
      thinkingConfig: { thinkingBudget: 0 },
    },
  };
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
  );
  if (!res.ok) throw new Error(`Gemini transcribe ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const out: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!out) throw new Error("Tomt transkript-svar");
  return out.trim();
}

export async function POST(req: NextRequest) {
  try {
    const sb = supabaseServer();
    const clientId = await getActiveClientId();
    const contentType = req.headers.get("content-type") || "";

    let transcript = "";
    let sourceType: "transcript" | "audio" = "transcript";
    let sourceLabel = "";
    let personName: string | null = null;
    let durationS: number | null = null;
    let mimeType: string | null = null;
    let fileBytes: number | null = null;

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file") as File | null;
      sourceLabel = (form.get("source_label") as string) || "";
      personName = (form.get("person_name") as string) || null;
      if (!file) return NextResponse.json({ error: "Ingen fil bifogad" }, { status: 400 });
      const buf = Buffer.from(await file.arrayBuffer());
      mimeType = file.type || "audio/mpeg";
      fileBytes = buf.length;
      if (fileBytes > 20 * 1024 * 1024) return NextResponse.json({ error: "Max 20 MB. Klipp filen eller exportera som mono MP3 ~64kbps." }, { status: 413 });
      sourceType = "audio";
      transcript = await transcribeAudio(buf, mimeType);
    } else {
      const body = (await req.json()) as JsonBody;
      transcript = (body.transcript || "").trim();
      sourceLabel = body.source_label || "";
      personName = body.person_name || null;
      if (!transcript || transcript.length < 100) return NextResponse.json({ error: "Transkript för kort (minst 100 tecken)" }, { status: 400 });
    }

    const { data: asset, error: assetErr } = await sb
      .from("client_assets")
      .insert({
        client_id: clientId,
        asset_type: sourceType === "audio" ? "audio" : "transcript",
        category: "intake",
        title: sourceLabel || `Intake ${new Date().toLocaleDateString("sv-SE")}`,
        body: transcript,
        person_name: personName,
        mime_type: mimeType,
        file_bytes: fileBytes,
        duration_s: durationS,
        status: "active",
      })
      .select()
      .single();
    if (assetErr) return NextResponse.json({ error: assetErr.message }, { status: 500 });

    const { data: session, error: sessErr } = await sb
      .from("intake_sessions")
      .insert({
        client_id: clientId,
        asset_id: asset.id,
        source_type: sourceType,
        source_label: sourceLabel || null,
        transcript,
        transcript_excerpt: transcript.slice(0, 800),
        status: "analyzing",
      })
      .select()
      .single();
    if (sessErr) return NextResponse.json({ error: sessErr.message }, { status: 500 });

    await logActivity(clientId, "intake_uploaded", `Intake: ${sourceType}, ${transcript.length} tecken`, "/dashboard/profil");
    return NextResponse.json({ session, asset });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
