import { NextRequest, NextResponse } from "next/server";
import { getActiveClientId } from "@/lib/client-context";
import { derivePostType, type StudioFormat } from "@/lib/studio/payload";
import { publishContent } from "@/lib/publish";
import { supabaseService } from "@/lib/supabase-admin";
import { requireAdminOrCustomer } from "@/lib/api-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/studio/publish — { postId?, channel?, accountIds[], caption, imageUrl, videoUrl, format, scheduleDate? }
// channel: "ghl-social" (default, utkast/schema i GHL) ELLER "ig-graph" (direkt till
// klientens kopplade Instagram, publiceras nu — PNG konverteras till JPEG). Via lib/publish.
// Uppdaterar studio_posts (ghl_status/ghl_post_id/caption) om postId ges.
export async function POST(req: NextRequest) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;

  try {
    const clientId = await getActiveClientId();
    const body = await req.json().catch(() => ({}));
    const channel = body.channel === "ig-graph" ? "ig-graph" : "ghl-social";
    const accountIds: string[] = Array.isArray(body.accountIds) ? body.accountIds.filter(Boolean) : [];
    const caption = (body.caption || "").toString();
    const imageUrl = (body.imageUrl || "").toString();
    const videoUrl = (body.videoUrl || "").toString();
    const format = (body.format || "1080x1350") as StudioFormat;
    // 9:16 + video = reel, 9:16 utan video = story, annars vanligt inlägg.
    const postType = derivePostType(format, videoUrl);
    // Reel publicerar videon (Studio-rendern är 9:16-cover); story/post publicerar bilden.
    const mediaUrl = postType === "reel" ? videoUrl : imageUrl;
    const scheduleDate = body.scheduleDate ? new Date(body.scheduleDate).toISOString() : undefined;
    if (postType === "reel" && !videoUrl) return NextResponse.json({ error: "Reel kräver en uppladdad video" }, { status: 400 });

    const result = channel === "ig-graph"
      // Direkt IG: bilden i mediaUrl (konverteras till JPEG i lib/publish), reel via videoUrl. Ingen schemaläggning.
      ? await publishContent({ clientId, channel: "ig-graph", postType, caption, mediaUrl: imageUrl, videoUrl: videoUrl || undefined })
      : await publishContent({ clientId, channel: "ghl-social", accountIds, postType, caption, mediaUrl, scheduleDate });
    if (result.status === "failed" || !result.id) {
      return NextResponse.json({ error: result.error || "Publicering misslyckades" }, { status: 400 });
    }

    // Uppdatera bibliotekets rad om vi publicerade en sparad skapelse.
    if (body.postId) {
      const sb = supabaseService();
      await sb
        .from("studio_posts")
        .update({ ghl_status: result.status, ghl_post_id: result.id, caption, scheduled_at: scheduleDate || null, updated_at: new Date().toISOString() })
        .eq("id", body.postId)
        .eq("client_id", clientId);
    }

    return NextResponse.json({ ok: true, postId: result.id, status: result.status });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
