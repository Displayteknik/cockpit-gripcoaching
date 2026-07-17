import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-admin";
import { getActiveClientId, logActivity } from "@/lib/client-context";
import { publishContent, type PublishRequest } from "@/lib/publish";

export const runtime = "nodejs";
export const maxDuration = 180;

// hm_social_posts-rad → PublishRequest. EN väg: format-switchen lever i
// lib/publish (ig-graph), inte här. Bevarar tidigare beteende (reel/övrigt = enkel bild).
interface SocialPost {
  caption?: string; hashtags?: string; format?: string;
  slides?: { image_url?: string }[]; image_url?: string; platform?: string;
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
  const clientId = await getActiveClientId();
  const { post_id } = await req.json();
  if (!post_id) return NextResponse.json({ error: "post_id krävs" }, { status: 400 });

  const sb = supabaseServer();
  const { data: post } = await sb.from("hm_social_posts").select("*").eq("id", post_id).eq("client_id", clientId).single();
  if (!post) return NextResponse.json({ error: "Inlägg hittades inte" }, { status: 404 });
  if (post.platform !== "instagram") return NextResponse.json({ error: "Endast Instagram-inlägg kan publiceras härifrån" }, { status: 400 });

  const result = await publishContent(toPublishRequest(clientId, post as SocialPost));
  if (result.status === "failed") return NextResponse.json({ error: result.error }, { status: 500 });

  await sb.from("hm_social_posts").update({ status: "published", published_at: new Date().toISOString() }).eq("id", post_id);
  await logActivity(clientId, "ig_published", `Publicerat på Instagram: ${post.format}`, undefined, { ig_media_id: result.id });
  return NextResponse.json({ ok: true, ig_media_id: result.id });
}
