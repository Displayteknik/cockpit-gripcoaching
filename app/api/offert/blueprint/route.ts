import { NextResponse } from "next/server";
import { requireAdminOrCustomer } from "@/lib/api-auth";
import { getActiveClientId } from "@/lib/client-context";
import { supabaseService } from "@/lib/supabase-admin";
import { generateJSON } from "@/lib/gemini";
import mammoth from "mammoth";

export const runtime = "nodejs";
export const maxDuration = 120;

// Offertmotorn (generisk) — offert-blueprint per klient. Lär sig klientens EGNA offertstruktur
// ur en uppladdad tidigare offert (docx/pdf), så nya offerter kan byggas i samma form —
// oavsett bransch. Tenant-låst via getActiveClientId (Cockpit-native, ej coach-bryggan).

const PROMPT = `Du analyserar en FÄRDIG OFFERT eller ett AVTAL från ett företag. Extrahera företagets offert-MALL så att vi kan skapa nya offerter i EXAKT samma struktur och ton — oavsett bransch (snickeri, fordonsverkstad, tjänster, produkter, fordon...).

Returnera ENBART denna JSON:
{
  "sektioner": [{"rubrik": "sektionens rubrik ordagrant", "syfte": "1 mening om vad sektionen gör", "exempeltext": "kort parafras/utdrag med platshållare för kunddata"}],
  "villkor": {"betalning": "", "garanti": "", "giltighet": "", "leverans": "", "ovrigt": []},
  "ton": "1 mening om hur de skriver",
  "sprak": "svenska",
  "valuta": "SEK",
  "rubrik_stil": "hur de rubricerar/numrerar sektioner",
  "signatur": "avsändarblock/kontakt sist i offerten"
}
Regler: sektionerna i SAMMA ordning som i offerten. Behåll deras egna rubriker ordagrant. Hitta INTE på — utelämna det som saknas (tom sträng/array). Ingen text utanför JSON.`;

interface Blueprint {
  sektioner: { rubrik: string; syfte: string; exempeltext: string }[];
  villkor: Record<string, unknown>;
  ton: string;
  sprak: string;
  valuta: string;
  rubrik_stil?: string;
  signatur?: string;
}

export async function GET() {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;
  const clientId = await getActiveClientId();
  const sb = supabaseService();
  const { data } = await sb.from("offert_blueprint").select("*").eq("client_id", clientId).maybeSingle();
  return NextResponse.json({ hasBlueprint: !!data, blueprint: data || null });
}

export async function POST(req: Request) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY saknas" }, { status: 500 });

  const clientId = await getActiveClientId();

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Förväntar multipart/form-data med 'file'" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof Blob)) return NextResponse.json({ error: "file saknas" }, { status: 400 });
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > 15 * 1024 * 1024) return NextResponse.json({ error: "Filen är för stor (max 15 MB)" }, { status: 400 });
  const namn = (file as File).name || "offert";
  const mime = file.type || "";

  let bp: Blueprint;
  let raw = "";
  try {
    if (mime.includes("pdf") || namn.toLowerCase().endsWith(".pdf")) {
      // Gemini läser PDF direkt (multimodal inline).
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
      const body = {
        contents: [
          {
            role: "user",
            parts: [{ inlineData: { mimeType: "application/pdf", data: buf.toString("base64") } }, { text: PROMPT }],
          },
        ],
        generationConfig: { temperature: 0.2, maxOutputTokens: 4096, responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } },
      };
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) return NextResponse.json({ error: `Gemini PDF ${r.status}` }, { status: 500 });
      const d = await r.json();
      const txt = d?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      bp = JSON.parse(txt.slice(txt.indexOf("{"), txt.lastIndexOf("}") + 1));
    } else {
      // docx → text via mammoth → Gemini.
      const { value } = await mammoth.extractRawText({ buffer: buf });
      raw = (value || "").trim();
      if (raw.length < 40) return NextResponse.json({ error: "Kunde inte läsa text ur filen. Ladda upp en .docx eller .pdf." }, { status: 400 });
      bp = await generateJSON<Blueprint>({
        model: "gemini-2.5-flash",
        systemInstruction: PROMPT,
        prompt: `Offertens innehåll:\n\n${raw.slice(0, 24000)}`,
        temperature: 0.2,
        maxOutputTokens: 4096,
      });
    }
  } catch (e) {
    return NextResponse.json({ error: "Kunde inte tolka offerten: " + (e as Error).message }, { status: 500 });
  }

  if (!bp?.sektioner?.length) return NextResponse.json({ error: "Hittade ingen offertstruktur i filen." }, { status: 422 });

  const sb = supabaseService();
  const row = {
    client_id: clientId,
    sektioner: bp.sektioner,
    villkor: bp.villkor || {},
    ton: bp.ton || "",
    sprak: bp.sprak || "svenska",
    valuta: bp.valuta || "SEK",
    meta: { rubrik_stil: bp.rubrik_stil || "", signatur: bp.signatur || "" },
    source_name: namn,
    raw_excerpt: raw.slice(0, 1000),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await sb.from("offert_blueprint").upsert(row, { onConflict: "client_id" }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, blueprint: data });
}
