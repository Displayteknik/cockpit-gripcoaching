import { NextRequest, NextResponse } from "next/server";
import { getActiveClientId } from "@/lib/client-context";
import { getGhlConfig, ghlFirstUserId, ghlCreateDraft } from "@/lib/studio/ghl";
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
    if (!accountIds.length) return NextResponse.json({ error: "Välj minst ett konto att publicera till" }, { status: 400 });

    const cfg = await getGhlConfig(clientId);
    if (!cfg) {
      return NextResponse.json(
        { error: "GHL är inte kopplat för den här klienten. Lägg in location-id + Private Integration-token först." },
        { status: 400 },
      );
    }

    const userId = await ghlFirstUserId(cfg);
    if (!userId) return NextResponse.json({ error: "Kunde inte hämta GHL-användare för location" }, { status: 500 });

    const { postId, error } = await ghlCreateDraft(cfg, { accountIds, summary: caption, mediaUrl: imageUrl, userId });
    if (error || !postId) return NextResponse.json({ error: error || "GHL skapade inget utkast" }, { status: 500 });

    // Uppdatera bibliotekets rad om vi publicerade en sparad skapelse.
    if (body.postId) {
      const sb = supabaseService();
      await sb
        .from("studio_posts")
        .update({ ghl_status: "draft", ghl_post_id: postId, caption, updated_at: new Date().toISOString() })
        .eq("id", body.postId)
        .eq("client_id", clientId);
    }

    return NextResponse.json({ ok: true, postId, status: "draft" });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
