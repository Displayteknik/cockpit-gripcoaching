import { NextRequest, NextResponse } from "next/server";
import { getActiveClientId } from "@/lib/client-context";
import { requireAdminOrCustomer } from "@/lib/api-auth";
import { supabaseService } from "@/lib/supabase-admin";
import { validateUpload, buildStoragePath, sanitizeFilename } from "@/lib/assets";

export const runtime = "nodejs";

// POST /api/assets/upload-url — JSON: { filename, mime, size }
// Returnerar en signerad upload-URL så klienten kan ladda upp filen DIREKT till
// Supabase Storage (förbi Vercels ~4,5 MB body-gräns på serverless-funktioner).
export async function POST(req: NextRequest) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;
  try {
    const clientId = await getActiveClientId();
    const { filename, mime, size } = await req.json();

    if (typeof mime !== "string" || typeof size !== "number") {
      return NextResponse.json({ error: "filename, mime och size krävs" }, { status: 400 });
    }

    const v = validateUpload(mime, size);
    if (!v.ok) return NextResponse.json({ error: v.reason }, { status: 400 });

    const safeName = sanitizeFilename(filename || "file");
    const path = buildStoragePath(clientId, v.type, safeName);

    const sb = supabaseService();
    const signed = await sb.storage.from("client-assets").createSignedUploadUrl(path);
    if (signed.error) {
      return NextResponse.json({ error: signed.error.message }, { status: 500 });
    }

    return NextResponse.json({ path, token: signed.data.token, type: v.type });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
