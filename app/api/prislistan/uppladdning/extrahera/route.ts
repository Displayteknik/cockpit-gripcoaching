import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PRIS2-2 — extraktion, portad från mysales-coach/om-extract-pricelist.ts. Samma
// Gemini-prompt och schema, samma regel: gissa aldrig, markera osäkert.
const SYS = `Du är prislisteextraktören. Extrahera EXAKT vad som står i leverantörens prislista (ofta kinesisk, rörig layout). Gissa aldrig, markera osäkert.
REGLER:
- Ange valutan EXPLICIT som den står i dokumentet (USD/CNY/EUR...). Konvertera ALDRIG. Är en kolumn tvetydig: sätt "currency_uncertain": true.
- "delivery time"/"production time" = PRODUKTIONSTID, inte leveranstid. Spara i production_days_note.
- Extrahera varje artikel med alla volymnivåer (qty), styckpris (EXW/unit price), frakt per enhet, fraktsätt, totalpris om angivet.
- Fånga: leverantörsnamn, kontakt, land, incoterm, betalvillkor, garanti, giltighetstid.
Svara ENBART med giltig JSON enligt schemat.`;

const SCHEMA = {
  type: "object",
  properties: {
    supplier: {
      type: "object",
      properties: {
        name: { type: "string" }, contact_name: { type: "string" }, contact_email: { type: "string" },
        contact_phone: { type: "string" }, country: { type: "string" }, incoterm: { type: "string" },
        payment_terms: { type: "string" }, warranty: { type: "string" }, production_days_note: { type: "string" },
      },
    },
    currency: { type: "string" }, currency_uncertain: { type: "boolean" }, validity_days: { type: "integer" },
    articles: {
      type: "array",
      items: {
        type: "object",
        properties: {
          model_no: { type: "string" }, description: { type: "string" }, category: { type: "string" },
          tiers: {
            type: "array",
            items: {
              type: "object",
              properties: {
                qty: { type: "integer" }, unit_price: { type: "number" }, freight_per_unit: { type: "number" },
                shipping_way: { type: "string" }, total: { type: "number" },
              },
              required: ["qty", "unit_price"],
            },
          },
        },
        required: ["model_no", "tiers"],
      },
    },
  },
  required: ["supplier", "currency", "articles"],
};

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const KEY = process.env.GEMINI_API_KEY || "";
  if (!KEY) return NextResponse.json({ error: "GEMINI_API_KEY saknas" }, { status: 500 });

  const { fileBase64, mimeType } = await req.json();
  if (!fileBase64) return NextResponse.json({ error: "fileBase64 krävs" }, { status: 400 });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${KEY}`;
  const body = {
    systemInstruction: { parts: [{ text: SYS }] },
    contents: [{ role: "user", parts: [{ inline_data: { mime_type: mimeType || "application/pdf", data: fileBase64 } }, { text: "Extrahera hela prislistan enligt schemat." }] }],
    generationConfig: { responseMimeType: "application/json", responseSchema: SCHEMA, maxOutputTokens: 6000, temperature: 0.1, thinkingConfig: { thinkingBudget: 0 } },
  };
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) return NextResponse.json({ error: `Gemini ${r.status}`, detail: (await r.text()).slice(0, 300) }, { status: 200 });
  const d = await r.json();
  const text = d?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return NextResponse.json({ error: "Tomt svar från Gemini" }, { status: 200 });
  let ex;
  try { ex = JSON.parse(text); } catch { return NextResponse.json({ error: "Ogiltig JSON från Gemini" }, { status: 200 }); }

  const flags: string[] = [];
  if (ex.currency_uncertain || !/^(USD|EUR|CNY|SEK)$/.test(ex.currency || "")) flags.push(`Valuta oklar (${ex.currency || "?"}) — bekräfta innan kalkyl.`);
  for (const a of ex.articles || []) {
    for (const t of a.tiers || []) {
      if (t.freight_per_unit && t.unit_price && t.freight_per_unit > 0.5 * t.unit_price) {
        flags.push(`${a.model_no} qty ${t.qty}: frakt ${t.freight_per_unit} > 50% av varupris ${t.unit_price}.`);
      }
    }
  }

  return NextResponse.json({ extraction: ex, flags });
}
