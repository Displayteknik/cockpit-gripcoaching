import { NextRequest, NextResponse } from "next/server";
import { getActiveClientId } from "@/lib/client-context";
import { supabaseService } from "@/lib/supabase-admin";
import { requireAdminOrCustomer } from "@/lib/api-auth";

export const runtime = "nodejs";

// Personligt mediabibliotek: alla bilder klienten laddat upp eller genererat i Studio
// (uppladdningar, AI-bilder och AI-redigeringar landar alla i studio-images/<clientId>/).
// Tenant-låst: listar/raderar ENBART under den aktiva klientens egen mapp.
const BUCKET = "studio-images";
const IMG_RE = /\.(png|jpe?g|webp)$/i;

// GET /api/studio/media — lista klientens bilder (nyast först).
export async function GET() {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;
  try {
    const clientId = await getActiveClientId();
    const sb = supabaseService();
    const { data, error } = await sb.storage
      .from(BUCKET)
      .list(clientId, { limit: 200, sortBy: { column: "created_at", order: "desc" } });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const items = (data || [])
      .filter((o) => o.id && IMG_RE.test(o.name)) // hoppa över mappar/icke-bilder
      .map((o) => {
        const path = `${clientId}/${o.name}`;
        const pub = sb.storage.from(BUCKET).getPublicUrl(path);
        return { path, url: pub.data.publicUrl, name: o.name, updated: o.updated_at || o.created_at || null };
      });
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// DELETE /api/studio/media — { path } — radera en egen bild (måste ligga under klientmappen).
export async function DELETE(req: NextRequest) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;
  try {
    const clientId = await getActiveClientId();
    const body = await req.json().catch(() => ({}));
    const path = (body.path || "").toString();
    // Tenant-lås: bara filer i den egna mappen får raderas (aldrig cross-tenant via manipulerad path).
    if (!path || !path.startsWith(`${clientId}/`) || path.includes("..")) {
      return NextResponse.json({ error: "Ogiltig sökväg" }, { status: 400 });
    }
    const sb = supabaseService();
    const { error } = await sb.storage.from(BUCKET).remove([path]);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
