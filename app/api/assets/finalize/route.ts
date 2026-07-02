import { NextRequest, NextResponse } from "next/server";
import { getActiveClientId } from "@/lib/client-context";
import { requireAdminOrCustomer } from "@/lib/api-auth";
import { supabaseService } from "@/lib/supabase-admin";
import { validateUpload, AssetType } from "@/lib/assets";

export const runtime = "nodejs";

// POST /api/assets/finalize — JSON: { path, mime, size, title?, category?, person_name?, person_label? }
// Anropas EFTER att klienten laddat upp filen till Supabase via den signerade URL:en.
// Skapar client_assets-raden. Verifierar att path hör till aktiv klient.
export async function POST(req: NextRequest) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;
  try {
    const clientId = await getActiveClientId();
    const body = await req.json();
    const { path, mime, size } = body;

    if (typeof path !== "string" || typeof mime !== "string" || typeof size !== "number") {
      return NextResponse.json({ error: "path, mime och size krävs" }, { status: 400 });
    }

    // Säkerhet: path MÅSTE ligga under aktiv klients mapp (clientId/...)
    if (!path.startsWith(`${clientId}/`)) {
      return NextResponse.json({ error: "Ogiltig sökväg" }, { status: 403 });
    }

    const v = validateUpload(mime, size);
    if (!v.ok) return NextResponse.json({ error: v.reason }, { status: 400 });
    const type: AssetType = v.type;

    const sb = supabaseService();

    // Bekräfta att filen faktiskt landade i storage innan vi skapar raden
    const folder = path.slice(0, path.lastIndexOf("/"));
    const name = path.slice(path.lastIndexOf("/") + 1);
    const listed = await sb.storage.from("client-assets").list(folder, { search: name });
    const exists = (listed.data || []).some((f) => f.name === name);
    if (!exists) {
      return NextResponse.json({ error: "Filen kunde inte hittas i storage" }, { status: 400 });
    }

    const insert = await sb
      .from("client_assets")
      .insert({
        client_id: clientId,
        asset_type: type,
        category: body.category || null,
        title: body.title || name,
        person_name: body.person_name || null,
        person_label: body.person_label || null,
        storage_path: path,
        mime_type: mime,
        file_bytes: size,
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
