import { NextResponse } from "next/server";
import { resolveClientId } from "@/lib/client-context";
import { requireAdminOrCustomer } from "@/lib/api-auth";
import { supabaseService } from "@/lib/supabase-admin";

export const runtime = "nodejs";

// GET /api/studio/blog/list — aktiv klients sparade blogginlägg (för repurpose av befintligt).
export async function GET() {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;
  try {
    const clientId = await resolveClientId();
    const sb = supabaseService();
    const { data } = await sb
      .from("hm_blog")
      .select("id, title, excerpt, content, published, created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(50);
    const posts = (data || []).map((p) => ({
      id: p.id, title: p.title, excerpt: p.excerpt || "",
      // plocka bort HTML → ren text för repurpose-prompten
      text: String(p.content || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
      published: !!p.published,
    }));
    return NextResponse.json({ posts });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
