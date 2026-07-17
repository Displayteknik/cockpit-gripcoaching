// Internal endpoint — används av cron och kan ange client_id direkt
// (eftersom cron inte har user-cookie för aktiv klient).
// EN väg: delegerar till lib/publish (ig-graph); format-switchen lever där.
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-admin";
import { logActivity } from "@/lib/client-context";
import { publishContent, type PublishRequest } from "@/lib/publish";

export const runtime = "nodejs";
export const maxDuration = 180;

interface SocialPost {
  caption?: string; hashtags?: string; format?: string;
  slides?: { image_url?: string }[]; image_url?: string;
}
function toPublishRequest(clientId: string, post: SocialPost): PublishRequest {
  const caption = `${post.caption || ""}\n\n${post.hashtags || ""}`.trim();
  if (post.format === "carousel") {
    return { clientId, channel: "ig-graph", caption, slideUrls: (post.slides || []).map((s) => s.image_url || "").filter(Boolean) };
  }
  if (post.format === "story") {
    return { clientId, channel: "ig-graph", caption, postType: "story", mediaUrl: post.image_url };
  }
  return { clientId, channel: "ig-graph", caption, postType: "post", mediaUrl: post.image_url };
}

export async function POST(req: NextRequest) {
  const cronSecret = req.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { post_id, client_id } = await req.json();
  if (!post_id || !client_id) return NextResponse.json({ error: "post_id + client_id krävs" }, { status: 400 });

  const sb = supabaseServer();
  const { data: post } = await sb.from("hm_social_posts").select("*").eq("id", post_id).single();
  if (!post) return NextResponse.json({ error: "Inlägg saknas" }, { status: 404 });

  const result = await publishContent(toPublishRequest(client_id, post as SocialPost));
  if (result.status === "failed") return NextResponse.json({ error: result.error }, { status: 500 });

  await sb.from("hm_social_posts").update({ status: "published", published_at: new Date().toISOString() }).eq("id", post_id);
  await logActivity(client_id, "ig_auto_published", `Auto-publicerat: ${post.format}`, undefined, { ig_media_id: result.id });
  return NextResponse.json({ ok: true, ig_media_id: result.id });
}
