import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-admin";
import { getActiveClientId, logActivity } from "@/lib/client-context";

export const runtime = "nodejs";
export const maxDuration = 300;

interface JsonBodyText {
  source_type: "transcript" | "manual";
  source_label?: string;
  transcript: string;
  person_name?: string;
}

interface JsonBodyStorage {
  source_type: "storage";
  storage_path: string;
  storage_bucket?: string;
  mime_type: string;
  file_bytes: number;
  source_label?: string;
  person_name?: string;
  original_name?: string;
}

const MAX_INLINE_BYTES = 18 * 1024 * 1024; // 18 MB säkerhetsmarginal mot Geminis 20 MB-gräns

const GEMINI_API = "https://generativelanguage.googleapis.com/v1beta";

async function geminiInline(buf: Buffer, mimeType: string, prompt: string, model = "gemini-2.5-flash"): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY saknas");
  const body = {
    contents: [{ role: "user", parts: [{ inlineData: { mimeType, data: buf.toString("base64") } }, { text: prompt }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 32000, thinkingConfig: { thinkingBudget: 0 } },
  };
  const res = await fetch(`${GEMINI_API}/models/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const out: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!out) throw new Error("Tomt Gemini-svar");
  return out.trim();
}

/**
 * Laddar upp större fil till Gemini Files API och returnerar fileUri.
 * Filen lever ~48h hos Gemini. Räcker för en analys-session.
 */
async function geminiFilesUpload(buf: Buffer, mimeType: string, displayName: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY saknas");

  // Step 1: initiate resumable upload
  const initRes = await fetch(`${GEMINI_API}/files?key=${apiKey}`, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(buf.length),
      "X-Goog-Upload-Header-Content-Type": mimeType,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file: { display_name: displayName } }),
  });
  if (!initRes.ok) throw new Error(`Gemini Files init ${initRes.status}: ${(await initRes.text()).slice(0, 300)}`);
  const uploadUrl = initRes.headers.get("X-Goog-Upload-URL");
  if (!uploadUrl) throw new Error("Saknar X-Goog-Upload-URL");

  // Step 2: upload bytes
  const upRes = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Length": String(buf.length),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: new Uint8Array(buf),
  });
  if (!upRes.ok) throw new Error(`Gemini Files upload ${upRes.status}: ${(await upRes.text()).slice(0, 300)}`);
  const upJson = await upRes.json();
  const fileUri: string | undefined = upJson?.file?.uri;
  if (!fileUri) throw new Error("Saknar file.uri i upload-svar");

  // Step 3: vänta tills filen är ACTIVE (för stora videos kan det ta sekunder)
  for (let i = 0; i < 30; i++) {
    const statusRes = await fetch(`${fileUri}?key=${apiKey}`);
    if (statusRes.ok) {
      const sj = await statusRes.json();
      if (sj?.state === "ACTIVE") return fileUri;
      if (sj?.state === "FAILED") throw new Error("Gemini Files state=FAILED");
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return fileUri; // fallback — låt analys-anropet visa fel om den inte är aktiv
}

async function geminiTranscribeFromUri(fileUri: string, mimeType: string, prompt: string, model = "gemini-2.5-flash"): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY saknas");
  const body = {
    contents: [{ role: "user", parts: [{ fileData: { fileUri, mimeType } }, { text: prompt }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 32000, thinkingConfig: { thinkingBudget: 0 } },
  };
  const res = await fetch(`${GEMINI_API}/models/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Gemini fileData ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const out: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!out) throw new Error("Tomt Gemini-svar");
  return out.trim();
}

const TRANSCRIBE_PROMPT = "Transkribera detta innehåll ordagrant till svenska. Markera olika talare som [Talare A], [Talare B] om flera personer pratar. För video-innehåll: fokusera på talet, ignorera bakgrundsljud. Returnera ENDAST transkriptet — ingen kommentar, ingen sammanfattning.";

const PDF_EXTRACT_PROMPT = "Extrahera och returnera ALL text från detta PDF-dokument ordagrant. Behåll struktur (rubriker, listor, tabeller). Om det finns flera språk — översätt INTE, behåll original. Returnera ENDAST texten — ingen kommentar.";

async function extractDocxText(buf: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer: buf });
  return result.value || "";
}

function detectKind(mime: string, filename?: string | null): "audio" | "video" | "pdf" | "docx" | "doc" | "vtt" | "srt" | "text" | "unknown" {
  const m = (mime || "").toLowerCase();
  const fn = (filename || "").toLowerCase();
  if (m === "text/vtt" || fn.endsWith(".vtt")) return "vtt";
  if (m === "application/x-subrip" || fn.endsWith(".srt")) return "srt";
  if (m.startsWith("audio/")) return "audio";
  if (m.startsWith("video/")) return "video";
  if (m === "application/pdf" || fn.endsWith(".pdf")) return "pdf";
  if (m === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || fn.endsWith(".docx")) return "docx";
  if (m === "application/msword" || fn.endsWith(".doc")) return "doc";
  if (m.startsWith("text/") || fn.endsWith(".txt")) return "text";
  return "unknown";
}

/**
 * Rensar WebVTT/SRT till ren dialog. Behåller talar-prefix om det finns.
 * Tar bort: WEBVTT-header, cue-nummer, timestamps, tomma block.
 */
function cleanSubtitleText(raw: string): string {
  const lines = raw.split(/\r?\n/);
  const out: string[] = [];
  let lastSpeaker = "";
  for (const ln of lines) {
    const t = ln.trim();
    if (!t) continue;
    if (t === "WEBVTT" || t.startsWith("WEBVTT")) continue;
    if (/^\d+$/.test(t)) continue; // cue-nummer
    if (/-->/.test(t)) continue; // timestamps
    if (/^NOTE\b/i.test(t)) continue;
    // Slå ihop konsekutiva rader från samma talare
    const speakerMatch = t.match(/^([^:]{2,40}):\s*(.*)$/);
    if (speakerMatch) {
      const speaker = speakerMatch[1].trim();
      const txt = speakerMatch[2].trim();
      if (speaker === lastSpeaker && out.length > 0) {
        out[out.length - 1] = out[out.length - 1] + " " + txt;
      } else {
        out.push(`${speaker}: ${txt}`);
        lastSpeaker = speaker;
      }
    } else {
      // Rad utan talar-prefix — fortsätt på senaste
      if (out.length > 0) out[out.length - 1] = out[out.length - 1] + " " + t;
      else out.push(t);
    }
  }
  return out.join("\n\n").trim();
}

export async function POST(req: NextRequest) {
  try {
    const sb = supabaseServer();
    const clientId = await getActiveClientId();
    const contentType = req.headers.get("content-type") || "";

    let transcript = "";
    let sourceType: "transcript" | "audio" | "video" | "document" = "transcript";
    let sourceLabel = "";
    let personName: string | null = null;
    let mimeType: string | null = null;
    let fileBytes: number | null = null;
    let storagePath: string | null = null;
    let originalName: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      // (legacy) liten direktuppladdning — behålls för text-paste-fallback
      const form = await req.formData();
      const file = form.get("file") as File | null;
      sourceLabel = (form.get("source_label") as string) || "";
      personName = (form.get("person_name") as string) || null;
      if (!file) return NextResponse.json({ error: "Ingen fil bifogad" }, { status: 400 });
      const buf = Buffer.from(await file.arrayBuffer());
      mimeType = file.type || "audio/mpeg";
      fileBytes = buf.length;
      if (fileBytes > 4 * 1024 * 1024) {
        return NextResponse.json({ error: "Filen är >4 MB — använd Storage-uppladdning istället." }, { status: 413 });
      }
      const kind = detectKind(mimeType);
      sourceType = kind === "video" ? "video" : kind === "audio" ? "audio" : "document";
      transcript = await geminiInline(buf, mimeType, kind === "pdf" ? PDF_EXTRACT_PROMPT : TRANSCRIBE_PROMPT);
    } else {
      const body = (await req.json()) as JsonBodyText | JsonBodyStorage;

      if ("storage_path" in body && body.storage_path) {
        // Storage-driven upload — laddat upp direkt från frontend
        const sBody = body as JsonBodyStorage;
        storagePath = sBody.storage_path;
        const bucket = sBody.storage_bucket || "client-assets";
        mimeType = sBody.mime_type;
        fileBytes = sBody.file_bytes;
        sourceLabel = sBody.source_label || "";
        personName = sBody.person_name || null;
        originalName = sBody.original_name || null;

        const { data: dl, error: dlErr } = await sb.storage.from(bucket).download(storagePath);
        if (dlErr || !dl) return NextResponse.json({ error: "Kunde inte hämta fil från Storage: " + (dlErr?.message || "okänt fel") }, { status: 500 });
        const buf = Buffer.from(await dl.arrayBuffer());
        const kind = detectKind(mimeType, originalName);

        if (kind === "vtt" || kind === "srt") {
          sourceType = "transcript";
          transcript = cleanSubtitleText(buf.toString("utf8"));
        } else if (kind === "docx") {
          sourceType = "document";
          transcript = await extractDocxText(buf);
          if (!transcript || transcript.trim().length < 50) {
            return NextResponse.json({ error: "Word-dokumentet verkar tomt eller otolkbart" }, { status: 400 });
          }
        } else if (kind === "doc") {
          // .doc gamla formatet — försök med mammoth ändå (begränsat stöd)
          try {
            sourceType = "document";
            transcript = await extractDocxText(buf);
            if (!transcript || transcript.trim().length < 50) throw new Error("tomt");
          } catch {
            return NextResponse.json({ error: "Gammalt .doc-format stöds dåligt — spara om som .docx eller PDF." }, { status: 400 });
          }
        } else if (kind === "text") {
          sourceType = "transcript";
          transcript = buf.toString("utf8");
        } else if (kind === "pdf" || kind === "audio" || kind === "video") {
          const prompt = kind === "pdf" ? PDF_EXTRACT_PROMPT : TRANSCRIBE_PROMPT;
          sourceType = kind === "pdf" ? "document" : kind;
          if (buf.length <= MAX_INLINE_BYTES) {
            transcript = await geminiInline(buf, mimeType, prompt);
          } else {
            // Stora filer (typiskt Zoom-video) → Files API
            const fileUri = await geminiFilesUpload(buf, mimeType, originalName || sourceLabel || "intake-file");
            transcript = await geminiTranscribeFromUri(fileUri, mimeType, prompt);
          }
        } else {
          return NextResponse.json({ error: `Filformat saknar stöd: ${mimeType}. Stödda: PDF, DOCX, MP3/M4A/WAV (ljud), MP4/MOV/WEBM (video), TXT.` }, { status: 415 });
        }
      } else {
        // Vanlig text-paste
        const tBody = body as JsonBodyText;
        transcript = (tBody.transcript || "").trim();
        sourceLabel = tBody.source_label || "";
        personName = tBody.person_name || null;
        if (!transcript || transcript.length < 100) return NextResponse.json({ error: "Transkript för kort (minst 100 tecken)" }, { status: 400 });
      }
    }

    transcript = transcript.trim();
    if (!transcript || transcript.length < 50) {
      return NextResponse.json({ error: "Inget användbart innehåll extraherat ur filen" }, { status: 400 });
    }

    const assetTypeForDb = sourceType === "video" ? "video" : sourceType === "audio" ? "audio" : sourceType === "document" ? "transcript" : "transcript";

    const { data: asset, error: assetErr } = await sb
      .from("client_assets")
      .insert({
        client_id: clientId,
        asset_type: assetTypeForDb,
        category: "intake",
        title: sourceLabel || originalName || `Intake ${new Date().toLocaleDateString("sv-SE")}`,
        body: transcript,
        person_name: personName,
        mime_type: mimeType,
        file_bytes: fileBytes,
        source_url: storagePath,
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
        source_label: sourceLabel || originalName || null,
        transcript,
        transcript_excerpt: transcript.slice(0, 800),
        status: "analyzing",
      })
      .select()
      .single();
    if (sessErr) return NextResponse.json({ error: sessErr.message }, { status: 500 });

    await logActivity(clientId, "intake_uploaded", `Intake: ${sourceType} (${mimeType ?? "text"}), ${transcript.length} tecken`, "/dashboard/profil");
    return NextResponse.json({ session, asset });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
