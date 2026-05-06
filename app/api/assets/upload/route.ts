import { NextRequest, NextResponse } from "next/server";
import { getActiveClientId } from "@/lib/client-context";
import { supabaseService } from "@/lib/supabase-admin";
import {
  validateUpload,
  buildStoragePath,
  sanitizeFilename,
  AssetType,
} from "@/lib/assets";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/assets/upload — multipart/form-data
// Fält: file, category?, title?, person_name?, person_label?
export async function POST(req: NextRequest) {
  try {
    const clientId = await getActiveClientId();

    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "Ingen fil" }, { status: 400 });

    const mime = file.type || "application/octet-stream";
    const bytes = file.size;

    const v = validateUpload(mime, bytes);
    if (!v.ok) return NextResponse.json({ error: v.reason }, { status: 400 });

    const type: AssetType = v.type;
    const safeName = sanitizeFilename(file.name || "file");
    const path = buildStoragePath(clientId, type, safeName);

    const sb = supabaseService();
    const buf = Buffer.from(await file.arrayBuffer());

    const up = await sb.storage.from("client-assets").upload(path, buf, {
      contentType: mime,
      upsert: false,
    });
    if (up.error) {
      return NextResponse.json({ error: up.error.message }, { status: 500 });
    }

    const insert = await sb
      .from("client_assets")
      .insert({
        client_id: clientId,
        asset_type: type,
        category: (form.get("category") as string) || null,
        title: (form.get("title") as string) || safeName,
        person_name: (form.get("person_name") as string) || null,
        person_label: (form.get("person_label") as string) || null,
        storage_path: path,
        mime_type: mime,
        file_bytes: bytes,
        status: type === "audio" || type === "video" ? "processing" : "active",
      })
      .select()
      .single();

    if (insert.error) {
      // Rulla tillbaka — ta bort filen från storage
      await sb.storage.from("client-assets").remove([path]);
      return NextResponse.json({ error: insert.error.message }, { status: 500 });
    }

    return NextResponse.json({ asset: insert.data });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
