import { NextRequest, NextResponse } from "next/server";
import { getActiveClient, resolveClientId } from "@/lib/client-context";
import { searchStockPhotos, generateImagen, visualScene, motivPassar } from "@/lib/images";
import { genereraMedExaktText, type TextAspekt } from "@/lib/studio/text-in-image";
import { getKitDirectives, imageDirectiveSuffix } from "@/lib/studio/kit";
import { supabaseService } from "@/lib/supabase-admin";
import { requireAdminOrCustomer } from "@/lib/api-auth";

export const runtime = "nodejs";
// B3-slingan (upp till 3 gen + vision + fallback) behöver mer tid än enkel generering.
export const maxDuration = 60;

const BUCKET = "studio-images";

// POST /api/studio/suggest-image — { mode: "stock" | "ai", topic, aspect }
// stock → Pexels-foton (publika URL:er, direkt användbara). ai → Imagen 4.0 → studio-images.
// Admin-grindad av proxy.ts.
export async function POST(req: NextRequest) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;

  try {
    const client = await getActiveClient();
    // ALDRIG en annan klients bransch som fallback (samma familj som Opticur-läckan) —
    // saknas industry används klientnamnet, annars neutralt.
    const niche = client?.industry || client?.name || "företaget";
    const body = await req.json().catch(() => ({}));
    const topic = (body.topic || "").toString().slice(0, 200) || niche;

    if (body.mode === "ai") {
      const ar = body.aspect === "story" ? "9:16" : body.aspect === "portrait" ? "3:4" : body.aspect === "square" ? "1:1" : "4:3";
      const directives = await getKitDirectives(await resolveClientId());

      // B3: exakt text i bilden — egen väg med vision-verifiering + programmatisk fallback.
      // Fältet är separat ("Text i bilden"), inte inbakat i friprompten.
      const exactText = String(body.exactText || "").slice(0, 120).trim();
      if (exactText) {
        const aspekt: TextAspekt = ar === "9:16" ? "9:16" : ar === "3:4" ? "3:4" : "1:1";
        const scen = await visualScene(topic, niche, { textYta: true });
        const res = await genereraMedExaktText({
          scen: `${scen} Verkligt foto, naturligt ljus.`,
          text: exactText,
          aspekt,
          stil: body.textStil === "overlay" ? "overlay" : "lapp",
          stilSuffix: imageDirectiveSuffix(directives),
          // textForsok 0 = direkt programmatisk (garanterat rättstavat) — QA/kraftläge.
          maxForsok: typeof body.textForsok === "number" ? body.textForsok : undefined,
        });
        const em = res.image?.match(/^data:image\/(\w+);base64,(.+)$/);
        if (res.error || !em) {
          return NextResponse.json({ error: res.error || "Kunde inte skapa bilden med texten — försök igen." }, { status: 500 });
        }
        const cid = await resolveClientId();
        const sbx = supabaseService();
        const { data: bks } = await sbx.storage.listBuckets();
        if (!bks?.some((b) => b.name === BUCKET)) await sbx.storage.createBucket(BUCKET, { public: true });
        const p = `${cid}/ai-text-${Date.now()}.${em[1] === "jpeg" ? "jpg" : "png"}`;
        const upx = await sbx.storage.from(BUCKET).upload(p, Buffer.from(em[2], "base64"), { contentType: `image/${em[1]}` });
        if (upx.error) return NextResponse.json({ error: upx.error.message }, { status: 500 });
        const pubx = sbx.storage.from(BUCKET).getPublicUrl(p);
        return NextResponse.json({
          photos: [{ url: pubx.data.publicUrl, thumb: pubx.data.publicUrl, credit: res.metod === "programmatisk" ? "AI + textsäkring" : "AI (Imagen)" }],
          description: scen,
          textInfo: { metod: res.metod, forsok: res.forsok, verifierad: res.verifierad, avlastText: res.avlastText },
        });
      }

      // Två steg: gör om ämnet/bildtexten (ofta prosa) till en visuell scen först — annars
      // svarar bildmodellen NO_IMAGE på ett meddelande/råd.
      const scene = await visualScene(topic, niche);
      let gen = await generateImagen(`${scene} Verkligt foto, naturligt ljus, inga texter, inga bokstäver.${imageDirectiveSuffix(directives)}`, ar);
      // Motiv-grind: bilden måste höra hemma i verksamheten (skarpt fel: "Sluta köpa
      // billigt" gav en sliten tröja för ett digital signage-företag). Ett omtag med
      // hårdare branschkrav, sen fail-closed — hellre "prova Sök foto" än fel bransch.
      if (gen.image && !(await motivPassar(gen.image, niche))) {
        gen = await generateImagen(`${scene} The scene must clearly and unmistakably belong to this business: ${niche}. Show its real environment, products or customers — no metaphors from other industries. Verkligt foto, naturligt ljus, inga texter, inga bokstäver.${imageDirectiveSuffix(directives)}`, ar);
        if (gen.image && !(await motivPassar(gen.image, niche))) {
          return NextResponse.json({ error: "Motivet ville inte träffa er verksamhet den här gången. Prova “Sök foto”, eller skriv i ämnesraden vad bilden ska föreställa." }, { status: 500 });
        }
      }
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
