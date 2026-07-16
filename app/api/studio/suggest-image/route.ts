import { NextRequest, NextResponse } from "next/server";
import { getActiveClient, getActiveClientId } from "@/lib/client-context";
import { searchStockPhotos, generateImagen } from "@/lib/images";
import { getKitDirectives, imageDirectiveSuffix } from "@/lib/studio/kit";
import { supabaseService } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 45;

const BUCKET = "studio-images";

// POST /api/studio/suggest-image — { mode: "stock" | "ai", topic, aspect }
// stock → Pexels-foton (publika URL:er, direkt användbara). ai → Imagen 4.0 → studio-images.
// Admin-grindad av proxy.ts.
export async function POST(req: NextRequest) {
  try {
    const client = await getActiveClient();
    const niche = client?.industry || "optiker";
    const body = await req.json().catch(() => ({}));
    const topic = (body.topic || "").toString().slice(0, 200) || niche;

    if (body.mode === "ai") {
      const ar = body.aspect === "portrait" ? "3:4" : body.aspect === "square" ? "1:1" : "4:3";
      const directives = await getKitDirectives(await getActiveClientId());
      const gen = await generateImagen(`${topic}. Branch: ${niche}. Verkligt foto, naturligt ljus, inga texter, inga bokstäver.${imageDirectiveSuffix(directives)}`, ar);
      const m = gen.image?.match(/^data:image\/(\w+);base64,(.+)$/);
      if (gen.error || !m) return NextResponse.json({ error: gen.error || "Bildgenerering misslyckades" }, { status: 500 });

      const clientId = await getActiveClientId();
      const sb = supabaseService();
      const { data: buckets } = await sb.storage.listBuckets();
      if (!buckets?.some((b) => b.name === BUCKET)) await sb.storage.createBucket(BUCKET, { public: true });
      const path = `${clientId}/ai-${Date.now()}.png`;
      const up = await sb.storage.from(BUCKET).upload(path, Buffer.from(m[2], "base64"), { contentType: "image/png" });
      if (up.error) return NextResponse.json({ error: up.error.message }, { status: 500 });
      const pub = sb.storage.from(BUCKET).getPublicUrl(path);
      return NextResponse.json({ photos: [{ url: pub.data.publicUrl, thumb: pub.data.publicUrl, credit: "AI (Imagen 4.0)" }] });
    }

    // stock (Pexels) — riktiga foton, brand-medveten sökfråga
    const res = await searchStockPhotos(topic, niche, 9);
    if (res.error) return NextResponse.json({ error: res.error }, { status: 500 });
    return NextResponse.json({
      photos: res.photos.map((p) => ({ url: p.src, thumb: p.srcMedium, credit: p.photographer })),
      query: res.query,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
