import { NextRequest, NextResponse } from "next/server";
import { resolveClientId } from "@/lib/client-context";
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
    const clientId = await resolveClientId();
    const body = await req.json().catch(() => ({}));
    const channel = body.channel === "ig-graph" ? "ig-graph" : "ghl-social";
    const accountIds: string[] = Array.isArray(body.accountIds) ? body.accountIds.filter(Boolean) : [];
    const caption = (body.caption || "").toString();
    const imageUrl = (body.imageUrl || "").toString();
    const videoUrl = (body.videoUrl || "").toString();
    // AKUT-KARUSELL: N slides = N bilder hela vägen. Under två bilder är det ingen
    // karusell och behandlas som ett vanligt inlägg (Metas eget krav är 2–10).
    const slideUrls: string[] = Array.isArray(body.slideUrls)
      ? body.slideUrls.map((s: unknown) => String(s || "")).filter(Boolean).slice(0, 10)
      : [];
    const arKarusell = slideUrls.length >= 2;
    const format = (body.format || "1080x1350") as StudioFormat;
    // 9:16 + video = reel, 9:16 utan video = story, annars vanligt inlägg.
    const postType = derivePostType(format, videoUrl);
    // Reel publicerar videon (Studio-rendern är 9:16-cover); story/post publicerar bilden.
    const mediaUrl = postType === "reel" ? videoUrl : imageUrl;
    const scheduleDate = body.scheduleDate ? new Date(body.scheduleDate).toISOString() : undefined;
    if (postType === "reel" && !videoUrl) return NextResponse.json({ error: "Reel kräver en uppladdad video" }, { status: 400 });

    const result = channel === "ig-graph"
      // Direkt IG: bilden i mediaUrl (konverteras till JPEG i lib/publish), reel via videoUrl. Ingen schemaläggning.
      // Karusell: slideUrls går som children-containers (publishCarousel).
      ? await publishContent({ clientId, channel: "ig-graph", postType, caption, mediaUrl: imageUrl, slideUrls: arKarusell ? slideUrls : undefined, videoUrl: videoUrl || undefined })
      // KANAL-3: publicera direkt i stallet for utkast. Schemalagd tid vinner alltid,
      // och en karusell publiceras aldrig direkt (spärr i lib/publish).
      : await publishContent({ clientId, channel: "ghl-social", accountIds, postType, caption, mediaUrl, slideUrls: arKarusell ? slideUrls : undefined, scheduleDate, publicera: body.publicera === true });
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

    // BILD-3: publiceringskvitto — direktlänk till inlägget på Instagram (nice-to-have,
    // får aldrig fälla en lyckad publicering).
    let permalink: string | undefined;
    if (channel === "ig-graph" && result.status === "published" && result.id) {
      try {
        const { getIgConnection, igGet } = await import("@/lib/instagram");
        const conn = await getIgConnection(clientId);
        if (conn?.ig_access_token) {
          permalink = (await igGet(`/${result.id}`, conn.ig_access_token, { fields: "permalink" }))?.permalink;
        }
      } catch { /* kvittolänken är valfri */ }
    }

    return NextResponse.json({ ok: true, postId: result.id, status: result.status, permalink, notis: result.notis });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
