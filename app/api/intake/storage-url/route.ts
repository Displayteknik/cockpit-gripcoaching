import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-admin";
import { getActiveClientId } from "@/lib/client-context";

export const runtime = "nodejs";

const BUCKET = "client-assets";

/**
 * Skapar signed upload-URL till Supabase Storage så frontend kan ladda upp
 * direkt utan att passera Vercel API:n (ingen 4.5 MB-gräns).
 *
 * POST { filename, mime_type } → { signed_url, storage_path, token, bucket }
 */
export async function POST(req: NextRequest) {
  try {
    const sb = supabaseServer();
    const clientId = await getActiveClientId();
    const { filename, mime_type }: { filename: string; mime_type: string } = await req.json();
    if (!filename) return NextResponse.json({ error: "filename krävs" }, { status: 400 });

    const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
    const path = `intake/${clientId}/${Date.now()}-${safe}`;

    const { data, error } = await sb.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data) return NextResponse.json({ error: error?.message || "Kunde inte skapa upload-URL" }, { status: 500 });

    return NextResponse.json({
      signed_url: data.signedUrl,
      token: data.token,
      storage_path: path,
      bucket: BUCKET,
      mime_type,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
