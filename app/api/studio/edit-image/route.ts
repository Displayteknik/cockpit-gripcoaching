import { NextRequest, NextResponse } from "next/server";
import { getActiveClientId } from "@/lib/client-context";
import { editImagen } from "@/lib/images";
import { supabaseService } from "@/lib/supabase-admin";
import { requireAdminOrCustomer } from "@/lib/api-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const BUCKET = "studio-images";

// POST /api/studio/edit-image — { imageUrl, instruction }
// Redigerar en befintlig Studio-bild via textkommentar (bild-till-bild, Nano Banana).
// Ex: "visa bara barnet, inte optikern, annars lika". Admin-grindad av proxy.ts.
export async function POST(req: NextRequest) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;

  try {
    const body = await req.json().catch(() => ({}));
    const imageUrl = (body.imageUrl || "").toString();
    const instruction = (body.instruction || "").toString().trim().slice(0, 500);
    if (!imageUrl) return NextResponse.json({ error: "Ingen bild att ändra" }, { status: 400 });
    if (!instruction) return NextResponse.json({ error: "Skriv vad som ska ändras" }, { status: 400 });

    const gen = await editImagen(instruction, imageUrl);
    const m = gen.image?.match(/^data:image\/(\w+);base64,(.+)$/);
    if (gen.error || !m) {
      return NextResponse.json({ error: gen.error || "Bildändring misslyckades" }, { status: 500 });
    }

    const clientId = await getActiveClientId();
    const sb = supabaseService();
    const { data: buckets } = await sb.storage.listBuckets();
    if (!buckets?.some((b) => b.name === BUCKET)) await sb.storage.createBucket(BUCKET, { public: true });
    const path = `${clientId}/edit-${Date.now()}.png`;
    const up = await sb.storage.from(BUCKET).upload(path, Buffer.from(m[2], "base64"), { contentType: "image/png" });
    if (up.error) return NextResponse.json({ error: up.error.message }, { status: 500 });
    const pub = sb.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({ url: pub.data.publicUrl });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
