import { NextResponse } from "next/server";
import { requireAdminOrCustomer } from "@/lib/api-auth";
import { groundedGenerate } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/offert/market { query } — marknads- & prishjälp via Gemini grounded search (live webb).
// Branschoberoende: "marknadspris begagnad Volvo V70", "timpris snickare Stockholm", "65 tum skylt".
export async function POST(req: Request) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;
  let body: { query?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 });
  }
  const q = (body.query || "").trim();
  if (!q) return NextResponse.json({ error: "query krävs" }, { status: 400 });

  try {
    const prompt = `Ge en kort marknads- och prisbild på svenska för: "${q}". Svara i 3–5 punkter: typiskt marknadspris/prisspann i Sverige idag, vad som driver priset, och ett riktpris att utgå från. Var konkret med siffror där det går. Om osäkert, säg det.`;
    const { text, sources } = await groundedGenerate(prompt, { maxOutputTokens: 1200 });
    if (!text) return NextResponse.json({ error: "Tomt svar" }, { status: 200 });
    return NextResponse.json({ ok: true, text, sources });
  } catch (e) {
    return NextResponse.json({ error: "Marknadskoll misslyckades: " + (e as Error).message }, { status: 200 });
  }
}
