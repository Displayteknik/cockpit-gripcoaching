import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrCustomer } from "@/lib/api-auth";
import { resolveClientId } from "@/lib/client-context";
import { supabaseService } from "@/lib/supabase-admin";

export const runtime = "nodejs";

// Innehålls-navets källa → tabell. Kalendern visar poster från flera verkstäder,
// och ska kunna radera dem där de faktiskt bor. Alltid tenant-låst på client_id.
const TABELL: Record<string, string> = {
  studio: "studio_posts",
  social: "hm_social_posts",
  linkedin: "linkedin_posts",
  blog: "hm_blog",
};

// DELETE /api/content/item?source=studio&id=<uuid> — ta bort en post ur kalendern.
export async function DELETE(req: NextRequest) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;
  try {
    const { searchParams } = new URL(req.url);
    const source = searchParams.get("source") || "";
    const id = searchParams.get("id") || "";
    const tabell = TABELL[source];
    if (!tabell || !id) return NextResponse.json({ error: "source och id krävs" }, { status: 400 });

    const clientId = await resolveClientId();
    const sb = supabaseService();
    const { error } = await sb.from(tabell).delete().eq("id", id).eq("client_id", clientId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
