import { NextResponse } from "next/server";
import { requireAdminOrCustomer } from "@/lib/api-auth";
import { getActiveClientId } from "@/lib/client-context";
import { supabaseService } from "@/lib/supabase-admin";
import { generateJSON } from "@/lib/gemini";
import mammoth from "mammoth";

export const runtime = "nodejs";
export const maxDuration = 120;

// POST /api/offert/products/extract (multipart: file, supplierName?) → läser en leverantörsprislista
// (docx/pdf) och skapar produkter i katalogen. Branschoberoende. Tenant-låst.

const PROMPT = `Du läser en LEVERANTÖRS PRISLISTA (vilken bransch som helst — virke, reservdelar, skärmar, fordon, tjänster; ofta utländsk/rörig layout). Extrahera EXAKT vad som står. Gissa aldrig.
Returnera ENBART JSON:
{
  "currency": "valutan EXAKT som den står i dokumentet (USD/EUR/CNY/SEK...). Konvertera ALDRIG.",
  "currency_uncertain": true/false,
  "production_note": "ev. 'delivery/production time' som text (obs: detta är oftast PRODUKTIONSTID, inte leveranstid)",
  "produkter": [{"name": "produktnamn", "sku": "artikelnr om finns", "category": "kategori om tydlig", "unit": "enhet (st/m/kg/tim...)", "purchase_price": tal (styckpris/EXW per enhet, rent tal), "freight": tal eller null (fraktkostnad PER ENHET i samma valuta), "shipping_way": "fraktsätt om angivet (sjö/flyg/bil)", "lead_time_days": heltal eller null}]
}
Regler: bara rader som är faktiska produkter med pris. Rent tal med punkt som decimal, ingen valutasymbol i talen. Frakt anges i SAMMA valuta som styckpriset. Hitta INTE på — null/utelämna där data saknas. Ingen text utanför JSON.`;

interface P { name: string; sku?: string; category?: string; unit?: string; purchase_price?: number | null; freight?: number | null; shipping_way?: string; lead_time_days?: number | null }

function flaggor(currency: string, uncertain: boolean, productionNote: string, produkter: P[]): string[] {
  const f: string[] = [];
  if (uncertain || !/^(USD|EUR|CNY|SEK)$/i.test(currency))
    f.push(`Valuta oklar (${currency || "?"}) — bekräfta innan kalkyl. Står siffrorna verkligen i ${currency || "den valutan"}?`);
  for (const p of produkter) {
    if (p.freight && p.purchase_price && p.freight > 0.5 * p.purchase_price)
      f.push(`${p.name}: frakt ${p.freight} > 50 % av varupris ${p.purchase_price} (${Math.round((p.freight / p.purchase_price) * 100)} %) — förhandla frakt eller byt leverantör.`);
  }
  if (productionNote)
    f.push(`"${productionNote}" är troligen produktionstid — lägg till transporttid (bil Kina–SE ~21 dgr, sjö 45–55, flyg ~7) för total ledtid i offerten.`);
  return f;
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
  const supplierName = (form.get("supplierName") as string) || null;
  if (!(file instanceof Blob)) return NextResponse.json({ error: "file saknas" }, { status: 400 });
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > 15 * 1024 * 1024) return NextResponse.json({ error: "Filen är för stor (max 15 MB)" }, { status: 400 });
  const namn = (file as File).name || "";
  const mime = file.type || "";

  interface Ex { currency?: string; currency_uncertain?: boolean; production_note?: string; produkter?: P[] }
  let ex: Ex = {};
  try {
    if (mime.includes("pdf") || namn.toLowerCase().endsWith(".pdf")) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
      const body = {
        contents: [{ role: "user", parts: [{ inlineData: { mimeType: "application/pdf", data: buf.toString("base64") } }, { text: PROMPT }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 8192, responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } },
      };
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) return NextResponse.json({ error: `Gemini PDF ${r.status}` }, { status: 500 });
      const d = await r.json();
      const txt = d?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      ex = JSON.parse(txt.slice(txt.indexOf("{"), txt.lastIndexOf("}") + 1)) || {};
    } else {
      const { value } = await mammoth.extractRawText({ buffer: buf });
      const raw = (value || "").trim();
      if (raw.length < 30) return NextResponse.json({ error: "Kunde inte läsa text ur filen. Ladda upp .docx eller .pdf." }, { status: 400 });
      ex = await generateJSON<Ex>({
        model: "gemini-2.5-flash",
        systemInstruction: PROMPT,
        prompt: `Prislistan:\n\n${raw.slice(0, 24000)}`,
        temperature: 0.1,
        maxOutputTokens: 8192,
      });
    }
  } catch (e) {
    return NextResponse.json({ error: "Kunde inte tolka prislistan: " + (e as Error).message }, { status: 500 });
  }

  const produkter = ex.produkter || [];
  const currency = (ex.currency || "SEK").toUpperCase();
  const rader = produkter
    .filter((p) => p.name)
    .map((p) => ({
      client_id: clientId,
      name: p.name,
      sku: p.sku || null,
      category: p.category || null,
      unit: p.unit || "st",
      currency,
      purchase_price: typeof p.purchase_price === "number" ? p.purchase_price : null,
      freight: typeof p.freight === "number" ? p.freight : null,
      lead_time_days: typeof p.lead_time_days === "number" ? p.lead_time_days : null,
      supplier_name: supplierName,
      notes: p.shipping_way ? `Fraktsätt: ${p.shipping_way}` : null,
    }));
  if (!rader.length) return NextResponse.json({ error: "Hittade inga produkter i filen." }, { status: 422 });

  const sb = supabaseService();
  const { data, error } = await sb.from("offert_products").insert(rader).select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    ok: true,
    antal: data?.length || 0,
    currency,
    flags: flaggor(currency, !!ex.currency_uncertain, ex.production_note || "", produkter),
  });
}
