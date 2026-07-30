import { NextRequest, NextResponse } from "next/server";
import { getActiveClient, resolveClientId } from "@/lib/client-context";
import { searchStockPhotos, generateImagen, visualScene } from "@/lib/images";
import { getKitDirectives, imageDirectiveSuffix } from "@/lib/studio/kit";
import { supabaseService } from "@/lib/supabase-admin";
import { requireAdminOrCustomer } from "@/lib/api-auth";

export const runtime = "nodejs";
export const maxDuration = 45;

const BUCKET = "studio-images";

// POST /api/studio/suggest-image — { mode: "stock" | "ai", topic, aspect }
// stock → Pexels-foton (publika URL:er, direkt användbara). ai → Imagen 4.0 → studio-images.
// Admin-grindad av proxy.ts.
export async function POST(req: NextRequest) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;

  try {
    const client = await getActiveClient();
    const niche = client?.industry || "optiker";
    const body = await req.json().catch(() => ({}));
    const topic = (body.topic || "").toString().slice(0, 200) || niche;

    if (body.mode === "ai") {
      const ar = body.aspect === "story" ? "9:16" : body.aspect === "portrait" ? "3:4" : body.aspect === "square" ? "1:1" : "4:3";
      const directives = await getKitDirectives(await resolveClientId());
      // Två steg: gör om ämnet/bildtexten (ofta prosa) till en visuell scen först — annars
      // svarar bildmodellen NO_IMAGE på ett meddelande/råd.
      const scene = await visualScene(topic, niche);
      const gen = await generateImagen(`${scene} Verkligt foto, naturligt ljus, inga texter, inga bokstäver.${imageDirectiveSuffix(directives)}`, ar);
      const m = gen.image?.match(/^data:image\/(\w+);base64,(.+)$/);
      if (gen.error || !m) {
        // Snäll, handlingsbar text (t.ex. vid känsligt motiv som nekas) — peka mot Sök foto.
        // 500 → klientens felruta visar meddelandet.
        return NextResponse.json({ error: "Kunde inte skapa en bild för det här ämnet. Prova “Sök foto”, eller skriv kort i “vad det handlar om” vad bilden ska föreställa." }, { status: 500 });
      }

      const clientId = await resolveClientId();
      const sb = supabaseService();
      const { data: buckets } = await sb.storage.listBuckets();
      if (!buckets?.some((b) => b.name === BUCKET)) await sb.storage.createBucket(BUCKET, { public: true });
      const path = `${clientId}/ai-${Date.now()}.png`;
      const up = await sb.storage.from(BUCKET).upload(path, Buffer.from(m[2], "base64"), { contentType: "image/png" });
      if (up.error) return NextResponse.json({ error: up.error.message }, { status: 500 });
      const pub = sb.storage.from(BUCKET).getPublicUrl(path);
      // Returnera scenbeskrivningen: textförslagen grundas i vad bilden faktiskt föreställer
      // (så en säljande rubrik inte hamnar ovanpå en problembild).
      return NextResponse.json({ photos: [{ url: pub.data.publicUrl, thumb: pub.data.publicUrl, credit: "AI (Imagen 4.0)" }], description: scene });
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
