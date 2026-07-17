import { NextRequest, NextResponse } from "next/server";
import { getActiveClientId } from "@/lib/client-context";
import { supabaseService } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const DEFAULT_BUCKET = "studio-images"; // publik läs — bilderna ska ändå till sociala medier
const ALLOWED_BUCKETS = new Set(["studio-images", "brand-assets"]);
const VIDEO_BUCKET = "studio-videos";
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_VIDEO_BYTES = 200 * 1024 * 1024;
const OK_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/svg+xml"]);
const OK_VIDEO = new Set(["video/mp4", "video/quicktime", "video/webm"]);

// POST /api/studio/upload-url — { filename, mime, size, bucket? }
// Signerad direkt-uppladdning till Supabase Storage (förbi Vercels ~4,5 MB-gräns).
// Stödjer bild (studio-images/brand-assets) OCH video (studio-videos, för reels).
// Admin-grindad av proxy.ts. Säkerställer bucketen (skapar publik om den saknas).
export async function POST(req: NextRequest) {
  try {
    const clientId = await getActiveClientId();
    const { filename, mime, size, bucket: reqBucket } = await req.json();
    const isVideo = typeof mime === "string" && OK_VIDEO.has(mime);
    const BUCKET = isVideo ? VIDEO_BUCKET : ALLOWED_BUCKETS.has(reqBucket) ? reqBucket : DEFAULT_BUCKET;

    if (typeof mime !== "string" || (!OK_MIME.has(mime) && !isVideo)) {
      return NextResponse.json({ error: "Endast JPG, PNG, WebP, SVG eller video (MP4/MOV/WebM)" }, { status: 400 });
    }
    const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    if (typeof size !== "number" || size > maxBytes) {
      return NextResponse.json({ error: isVideo ? "Videon är för stor (max 200 MB)" : "Bilden är för stor (max 25 MB)" }, { status: 400 });
    }

    const sb = supabaseService();

    // Säkerställ publik bucket (idempotent — ignorerar "already exists").
    const { data: buckets } = await sb.storage.listBuckets();
    if (!buckets?.some((b) => b.name === BUCKET)) {
      await sb.storage.createBucket(BUCKET, { public: true });
    }

    const ext = (mime.split("/")[1] || "jpg").replace("jpeg", "jpg").replace("svg+xml", "svg");
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
