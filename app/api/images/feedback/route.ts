import { NextRequest, NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase-admin";
import { getActiveClientId } from "@/lib/client-context";
import { requireAdminOrCustomer } from "@/lib/api-auth";

export const runtime = "nodejs";

// G-6: routen skrev förut med supabaseServer (anon-nyckeln) och saknade auth-grind helt.
// image_feedback är kunddata; läsningen ska vara tenant-låst och skrivningen inloggad.
// Service-role + requireAdminOrCustomer, som resten av kundvägarna.

export async function GET() {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;
  const clientId = await getActiveClientId();
  const sb = supabaseService();
  const { data } = await sb
    .from("image_feedback")
    .select("id, created_at, rating, prompt, kommentar, image_style, image_url, generation_id")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(50);
  return NextResponse.json(data || []);
}

export async function POST(req: NextRequest) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;
  const clientId = await getActiveClientId();
  const body = await req.json().catch(() => ({}));

  // Betyget är det enda obligatoriska, och bara +1/-1 finns. Ett ogiltigt värde
  // skrivs inte alls — en rad med rating 0 hade räknats som ett omdöme utan att vara ett.
  const rating = Number(body.rating);
  if (rating !== 1 && rating !== -1) {
    return NextResponse.json({ error: "rating måste vara 1 eller -1" }, { status: 400 });
  }

  const sb = supabaseService();
  const { error } = await sb.from("image_feedback").insert({
    client_id: clientId,
    prompt: typeof body.prompt === "string" ? body.prompt.slice(0, 2000) : null,
    image_style: typeof body.image_style === "string" ? body.image_style.slice(0, 60) : null,
    content_text: typeof body.content_text === "string" ? body.content_text.slice(0, 2000) : null,
    image_url: typeof body.image_url === "string" ? body.image_url.slice(0, 500) : null,
    // G-6: kundens egna ord. Ett betyg utan skäl går inte att lära sig av — "dålig bild"
    // säger inte om det var motivet, ljuset eller personerna som var fel.
    kommentar: typeof body.kommentar === "string" && body.kommentar.trim()
      ? body.kommentar.trim().slice(0, 400)
      : null,
    // G-6: kopplingen till genereringen. Ger modell, format och motivkategori utan att
    // duplicera dem här. Ogiltigt id skrivs som null hellre än att fälla hela sparningen —
    // ett tappat omdöme är värre än ett omdöme utan koppling.
    generation_id: typeof body.generationId === "string" && /^[0-9a-f-]{36}$/i.test(body.generationId)
      ? body.generationId
      : null,
    rating,
  });
  if (error) {
    console.error("[api/images/feedback] insert misslyckades:", error.message, "client:", clientId);
    return NextResponse.json({ error: "Kunde inte spara omdömet. Försök igen." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
