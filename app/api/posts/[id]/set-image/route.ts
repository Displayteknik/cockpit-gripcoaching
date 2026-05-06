import { NextRequest, NextResponse } from "next/server";
import { getActiveClientId } from "@/lib/client-context";
import { supabaseService } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/posts/[id]/set-image — sätt valfri image_url på inlägget (från upload, stock, bibliotek)
// { image_url } — direkt URL eller storage_path för fil i client-assets bucket
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const clientId = await getActiveClientId();
    const { id } = await params;
    const body = await req.json();
    const url = String(body.image_url || "").trim();
    if (!url) return NextResponse.json({ error: "image_url krävs" }, { status: 400 });

    const sb = supabaseService();
    await sb
      .from("hm_social_posts")
      .update({ image_url: url, image_engine: body.engine || "manual" })
      .eq("id", id)
      .eq("client_id", clientId);

    return NextResponse.json({ ok: true, image_url: url });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// PUT /api/posts/[id]/set-image — multipart upload av egen bild
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const clientId = await getActiveClientId();
    const { id } = await params;
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "Ingen fil" }, { status: 400 });
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ error: "Endast jpg/png/webp/gif" }, { status: 400 });
    }
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: "Max 20 MB" }, { status: 400 });
    }
    const sb = supabaseService();
    const ext = file.type.split("/")[1] || "png";
    const filename = `${clientId}/post-images/${id}-upload-${Date.now()}.${ext}`;
    const buf = Buffer.from(await file.arrayBuffer());
    const upload = await sb.storage.from("client-assets").upload(filename, buf, {
      contentType: file.type,
      upsert: true,
    });
    if (upload.error) return NextResponse.json({ error: upload.error.message }, { status: 500 });
    const { data: signed } = await sb.storage
      .from("client-assets")
      .createSignedUrl(filename, 60 * 60 * 24 * 365);
    const url = signed?.signedUrl;
    await sb
      .from("hm_social_posts")
      .update({ image_url: url, image_engine: "manual-upload" })
      .eq("id", id)
      .eq("client_id", clientId);
    return NextResponse.json({ image_url: url });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
