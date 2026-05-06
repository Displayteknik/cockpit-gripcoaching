import { NextRequest, NextResponse } from "next/server";
import { getActiveClientId } from "@/lib/client-context";
import { supabaseService } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/posts/[id]/nano-banana
// Använder Google Gemini 2.5 Flash Image (Nano Banana) för bildgenerering.
// Bra på svensk text-i-bild, snabb, billig.
// { prompt, base_image_url? } — om base_image_url ges = edit-mode, annars = generate-mode
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY saknas" }, { status: 500 });

    const clientId = await getActiveClientId();
    const { id } = await params;
    const body = await req.json();
    const userPrompt = String(body.prompt || "").trim();
    if (!userPrompt) return NextResponse.json({ error: "prompt krävs" }, { status: 400 });

    const sb = supabaseService();
    const { data: profile } = await sb
      .from("hm_brand_profile")
      .select("company_name, location")
      .eq("client_id", clientId)
      .maybeSingle();
    const { data: client } = await sb
      .from("clients")
      .select("primary_color")
      .eq("id", clientId)
      .single();

    // Bygg en prompt som väver in brand-kontext
    const fullPrompt = `${userPrompt}\n\nStil: professionell social-media-bild för ${profile?.company_name || "klienten"}${profile?.location ? ` i ${profile.location}` : ""}. Använd brand-färg ${client?.primary_color || "#1A6B3C"} som accent. Modern, ren, scrollstoppande. Inga flaggor, inga generiska stockfoto-stilar.`;

    // Anropa Gemini 2.5 Flash Image (preview eller stable beroende på tillgång)
    const parts: { text?: string; inlineData?: { mimeType: string; data: string } }[] = [
      { text: fullPrompt },
    ];

    if (body.base_image_url) {
      // Hämta basbilden och skicka som inline för redigering
      try {
        const imgRes = await fetch(body.base_image_url);
        const buf = Buffer.from(await imgRes.arrayBuffer());
        if (buf.length < 19 * 1024 * 1024) {
          parts.unshift({
            inlineData: {
              mimeType: imgRes.headers.get("content-type") || "image/jpeg",
              data: buf.toString("base64"),
            },
          });
        }
      } catch {
        // ignorera om hämtningen misslyckas — fall back till generate-mode
      }
    }

    // Försök Nano Banana Pro (premium) först, fall tillbaka till stable
    const models = body.model === "pro"
      ? ["nano-banana-pro-preview", "gemini-3.1-flash-image-preview", "gemini-2.5-flash-image"]
      : ["gemini-2.5-flash-image", "gemini-3.1-flash-image-preview"];

    let res: Response | null = null;
    let lastError = "";
    for (const model of models) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: { responseModalities: ["IMAGE"] },
        }),
      });
      if (res.ok) break;
      lastError = await res.text();
      res = null;
    }

    if (!res || !res.ok) {
      return NextResponse.json(
        { error: `Nano Banana misslyckades: ${lastError.slice(0, 300)}` },
        { status: 500 }
      );
    }

    const data = await res.json();
    const imagePart = data?.candidates?.[0]?.content?.parts?.find(
      (p: { inlineData?: { data?: string; mimeType?: string } }) => p.inlineData?.data
    );
    if (!imagePart?.inlineData?.data) {
      return NextResponse.json(
        { error: "Nano Banana returnerade ingen bild — försök igen eller byt prompt" },
        { status: 500 }
      );
    }

    const imageBuf = Buffer.from(imagePart.inlineData.data, "base64");
    const mime = imagePart.inlineData.mimeType || "image/png";
    const ext = mime.includes("png") ? "png" : "jpg";
    const filename = `${clientId}/post-images/${id}-nb-${Date.now()}.${ext}`;

    const upload = await sb.storage.from("client-assets").upload(filename, imageBuf, {
      contentType: mime,
      upsert: true,
    });
    if (upload.error) return NextResponse.json({ error: upload.error.message }, { status: 500 });

    const { data: signed } = await sb.storage
      .from("client-assets")
      .createSignedUrl(filename, 60 * 60 * 24 * 365);
    const finalUrl = signed?.signedUrl;

    await sb
      .from("hm_social_posts")
      .update({ image_url: finalUrl, image_engine: "nano-banana" })
      .eq("id", id)
      .eq("client_id", clientId);

    return NextResponse.json({ image_url: finalUrl });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
