import { NextRequest, NextResponse } from "next/server";
import { getActiveClientId } from "@/lib/client-context";
import { supabaseService } from "@/lib/supabase-admin";
import { requireAdminOrCustomer } from "@/lib/api-auth";

export const runtime = "nodejs";

// Native schemaläggning (utan GHL). En rad i studio_scheduled = ett jobb som crontet
// (/api/scheduler/cron) publicerar vid rätt tid. För IG bär jobbet den FÄRDIG-renderade
// bilden (media_url) så cronet slipper rendera i webbläsaren. För blogg flippas hm_blog.
// Tenant-låst via getActiveClientId (kund når bara sin egen klient). RLS på tabellen → service-role.

// GET /api/studio/schedule — klientens köade/kommande jobb (nyast schemalagt först).
export async function GET() {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;
  try {
    const clientId = await getActiveClientId();
    const sb = supabaseService();
    const { data, error } = await sb
      .from("studio_scheduled")
      .select("id, channel, title, caption, media_url, scheduled_at, status, published_at, error")
      .eq("client_id", clientId)
      .order("scheduled_at", { ascending: true })
      .limit(200);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ jobs: data || [] });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// POST /api/studio/schedule — skapa ett schema-jobb.
// { channel, caption?, mediaUrl?, videoUrl?, postType?, format?, title?, scheduledAt, studioPostId?, blogId? }
export async function POST(req: NextRequest) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;
  try {
    const clientId = await getActiveClientId();
    const b = await req.json().catch(() => ({}));
    const channel = (b.channel || "ig-graph").toString();
    const scheduledAt = b.scheduledAt ? new Date(b.scheduledAt) : null;
    if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) {
      return NextResponse.json({ error: "Ogiltig tidpunkt" }, { status: 400 });
    }
    if (scheduledAt.getTime() < Date.now() - 60_000) {
      return NextResponse.json({ error: "Tidpunkten har redan passerat" }, { status: 400 });
    }
    // IG kräver en färdig bild (eller video för reel); blogg kräver blogId.
    if (channel === "ig-graph" && !b.mediaUrl && !b.videoUrl) {
      return NextResponse.json({ error: "Bild/video saknas för schemaläggning" }, { status: 400 });
    }
    if (channel === "cockpit-blog" && !b.blogId) {
      return NextResponse.json({ error: "blogId krävs för blogg-schema" }, { status: 400 });
    }

    const sb = supabaseService();
    const iso = scheduledAt.toISOString();
    const { data, error } = await sb.from("studio_scheduled").insert({
      client_id: clientId,
      studio_post_id: b.studioPostId || null,
      blog_id: b.blogId || null,
      channel,
      caption: (b.caption || "").toString() || null,
      media_url: (b.mediaUrl || "").toString() || null,
      video_url: (b.videoUrl || "").toString() || null,
      post_type: (b.postType || "post").toString(),
      format: (b.format || "").toString() || null,
      title: (b.title || "").toString() || null,
      scheduled_at: iso,
      status: "queued",
    }).select("id").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Spegla i innehålls-navet/kalendern.
    if (b.studioPostId) {
      await sb.from("studio_posts").update({ scheduled_at: iso, ghl_status: "scheduled", updated_at: new Date().toISOString() })
        .eq("id", b.studioPostId).eq("client_id", clientId);
    }
    if (channel === "cockpit-blog" && b.blogId) {
      await sb.from("hm_blog").update({ published: false, published_at: iso })
        .eq("id", b.blogId).eq("client_id", clientId);
    }
    return NextResponse.json({ ok: true, id: data.id });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// DELETE /api/studio/schedule?id= — avboka ett köat jobb.
export async function DELETE(req: NextRequest) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;
  try {
    const clientId = await getActiveClientId();
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id krävs" }, { status: 400 });
    const sb = supabaseService();
    // Läs jobbet först (för att kunna återställa speglingen).
    const { data: job } = await sb.from("studio_scheduled").select("studio_post_id, blog_id, channel").eq("id", id).eq("client_id", clientId).maybeSingle();
    const { error } = await sb.from("studio_scheduled").delete().eq("id", id).eq("client_id", clientId).eq("status", "queued");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (job?.studio_post_id) {
      await sb.from("studio_posts").update({ ghl_status: "draft", scheduled_at: null }).eq("id", job.studio_post_id).eq("client_id", clientId);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
