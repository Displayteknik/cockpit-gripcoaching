import { NextRequest, NextResponse } from "next/server";
import { getActiveClientId } from "@/lib/client-context";
import { getGhlConfig, ghlFirstUserId, ghlCreateDraft } from "@/lib/studio/ghl";
import { derivePostType, type StudioFormat } from "@/lib/studio/payload";
import { supabaseService } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/studio/publish — { postId?, accountIds[], caption, imageUrl }
// Skapar ett UTKAST i klientens GHL Social Planner (publicerar INTE skarpt).
// Uppdaterar studio_posts (ghl_status/ghl_post_id/caption) om postId ges.
export async function POST(req: NextRequest) {
  try {
    const clientId = await getActiveClientId();
    const body = await req.json().catch(() => ({}));
    const accountIds: string[] = Array.isArray(body.accountIds) ? body.accountIds.filter(Boolean) : [];
    const caption = (body.caption || "").toString();
    const imageUrl = (body.imageUrl || "").toString();
    const videoUrl = (body.videoUrl || "").toString();
    const format = (body.format || "1080x1350") as StudioFormat;
    // 9:16 + video = reel, 9:16 utan video = story, annars vanligt inlägg.
    const postType = derivePostType(format, videoUrl);
    // Reel publicerar videon (Studio-rendern är 9:16-cover); story/post publicerar bilden.
    const mediaUrl = postType === "reel" ? videoUrl : imageUrl;
    // ISO-datum i framtiden → schemalägg, annars utkast.
    const scheduleDate = body.scheduleDate ? new Date(body.scheduleDate).toISOString() : undefined;
    if (!accountIds.length) return NextResponse.json({ error: "Välj minst ett konto att publicera till" }, { status: 400 });
    if (postType === "reel" && !videoUrl) return NextResponse.json({ error: "Reel kräver en uppladdad video" }, { status: 400 });

    const cfg = await getGhlConfig(clientId);
    if (!cfg) {
      return NextResponse.json(
        { error: "GHL är inte kopplat för den här klienten. Lägg in location-id + Private Integration-token först." },
        { status: 400 },
      );
    }

    const userId = await ghlFirstUserId(cfg);
    if (!userId) return NextResponse.json({ error: "Kunde inte hämta GHL-användare för location" }, { status: 500 });

    const { postId, error, scheduled } = await ghlCreateDraft(cfg, { accountIds, summary: caption, mediaUrl, userId, postType, scheduleDate });
    if (error || !postId) return NextResponse.json({ error: error || "GHL skapade inget inlägg" }, { status: 500 });

    // Uppdatera bibliotekets rad om vi publicerade en sparad skapelse.
    if (body.postId) {
      const sb = supabaseService();
      await sb
        .from("studio_posts")
        .update({ ghl_status: scheduled ? "scheduled" : "draft", ghl_post_id: postId, caption, scheduled_at: scheduleDate || null, updated_at: new Date().toISOString() })
        .eq("id", body.postId)
        .eq("client_id", clientId);
    }

    return NextResponse.json({ ok: true, postId, status: scheduled ? "scheduled" : "draft" });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
