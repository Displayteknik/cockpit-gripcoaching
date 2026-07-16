import { NextRequest, NextResponse } from "next/server";
import { getActiveClientId } from "@/lib/client-context";
import { supabaseService } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const BUCKET = "studio-images"; // publik läs — bilderna ska ändå till sociala medier
const MAX_BYTES = 25 * 1024 * 1024;
const OK_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

// POST /api/studio/upload-url — { filename, mime, size }
// Signerad direkt-uppladdning till Supabase Storage (förbi Vercels ~4,5 MB-gräns).
// Admin-grindad av proxy.ts. Säkerställer bucketen (skapar publik om den saknas).
export async function POST(req: NextRequest) {
  try {
    const clientId = await getActiveClientId();
    const { filename, mime, size } = await req.json();

    if (typeof mime !== "string" || !OK_MIME.has(mime)) {
      return NextResponse.json({ error: "Endast JPG, PNG eller WebP" }, { status: 400 });
    }
    if (typeof size !== "number" || size > MAX_BYTES) {
      return NextResponse.json({ error: "Bilden är för stor (max 25 MB)" }, { status: 400 });
    }

    const sb = supabaseService();

    // Säkerställ publik bucket (idempotent — ignorerar "already exists").
    const { data: buckets } = await sb.storage.listBuckets();
    if (!buckets?.some((b) => b.name === BUCKET)) {
      await sb.storage.createBucket(BUCKET, { public: true });
    }

    const ext = (mime.split("/")[1] || "jpg").replace("jpeg", "jpg");
    const safe = String(filename || "foto").replace(/[^a-z0-9._-]/gi, "-").slice(0, 40);
    const path = `${clientId}/${Date.now()}-${safe}.${ext}`;

    const signed = await sb.storage.from(BUCKET).createSignedUploadUrl(path);
    if (signed.error) return NextResponse.json({ error: signed.error.message }, { status: 500 });

    const pub = sb.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({ path, token: signed.data.token, publicUrl: pub.data.publicUrl, bucket: BUCKET });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
