import { NextRequest, NextResponse } from "next/server";
import { getActiveClientId } from "@/lib/client-context";
import { supabaseService } from "@/lib/supabase-admin";

export const runtime = "nodejs";

// POST /api/studio/blog/publish-native — sparar bloggutkast i Cockpit-native (hm_blog, published:false).
// För klienter vars blogg ligger på Cockpit-sajten (t.ex. HM Motor) i stället för GHL.
export async function POST(req: NextRequest) {
  try {
    const clientId = await getActiveClientId();
    const b = await req.json().catch(() => ({}));
    const title = (b.title || "").toString().trim();
    const html = (b.html || "").toString();
    const slug = (b.urlSlug || "").toString().trim() || slugify(title);
    if (!title || !html) return NextResponse.json({ error: "Titel och innehåll krävs" }, { status: 400 });

    // Schemalägg (valfritt): framtida tid → published_at = tiden, ett studio_scheduled-jobb
    // publicerar (flippar published) vid rätt tid via cronet. Annars = utkast (nu).
    const scheduledAt = b.scheduledAt ? new Date(b.scheduledAt) : null;
    const scheduled = Boolean(scheduledAt && !Number.isNaN(scheduledAt.getTime()) && scheduledAt.getTime() > Date.now());

    const sb = supabaseService();
    const { data: clientRow } = await sb.from("clients").select("name").eq("id", clientId).maybeSingle();
    const { data, error } = await sb
      .from("hm_blog")
      .insert({
        client_id: clientId,
        slug,
        title,
        content: html,
        excerpt: (b.description || "").toString().slice(0, 300),
        author: clientRow?.name || "Redaktionen",
        published: false,
        published_at: scheduled ? scheduledAt!.toISOString() : new Date().toISOString(),
      })
      .select("id, slug")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (scheduled && data?.id) {
      await sb.from("studio_scheduled").insert({
        client_id: clientId, blog_id: data.id, channel: "cockpit-blog", title,
        scheduled_at: scheduledAt!.toISOString(), status: "queued",
      });
    }
    return NextResponse.json({ ok: true, id: data?.id, slug: data?.slug, destination: "native", scheduled });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[åä]/g, "a").replace(/ö/g, "o").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70) || "artikel";
}
